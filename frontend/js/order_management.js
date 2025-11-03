/**
 * Admin Order Management
 * Handles order listing, filtering, pagination, and real-time updates
 */

import { getIdToken, getCurrentUser, onAuthReady, initAuth } from './auth_manager.js';

const API_BASE = '/api/orders/admin';
let currentPage = 1;
let totalPages = 1;
let currentFilters = {
  orderStatus: '',
  paymentStatus: '',
  search: ''
};
let firestoreListener = null;

/**
 * Initialize page
 */
async function initializePage() {
  try {
    // Initialize auth if not already initialized
    initAuth();
    
    // Wait for auth to be ready AND user to be authenticated
    await new Promise((resolve, reject) => {
      let resolved = false;
      
      // Set a timeout to prevent hanging
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          const user = getCurrentUser();
          if (user) {
            console.log('[Order Management] Auth ready (timeout), user:', user.email);
            resolve();
          } else {
            console.error('[Order Management] Auth timeout - no user');
            showError('Authentication timeout. Please refresh the page.');
            resolve(); // Resolve to prevent hanging
          }
        }
      }, 5000); // 5 second timeout
      
      onAuthReady((user, claims) => {
        if (resolved) return;
        
        if (user) {
          console.log('[Order Management] Auth ready, user:', user.email);
          clearTimeout(timeout);
          resolved = true;
          resolve();
        } else {
          // User not authenticated - wait a bit more in case auth is still initializing
          setTimeout(() => {
            if (!resolved) {
              const currentUser = getCurrentUser();
              if (currentUser) {
                console.log('[Order Management] Auth ready (delayed), user:', currentUser.email);
                clearTimeout(timeout);
                resolved = true;
                resolve();
              } else {
                console.error('[Order Management] No user authenticated');
                clearTimeout(timeout);
                resolved = true;
                showError('Please login to access order management.');
                resolve(); // Still resolve to prevent hanging
              }
            }
          }, 1000);
        }
      });
    });
    
    // Double-check user is authenticated before proceeding
    const user = getCurrentUser();
    if (!user) {
      showError('User not authenticated. Please login.');
      return;
    }
    
    // Setup event listeners
    setupEventListeners();
    
    // Fetch initial orders
    await fetchOrders();
    
    // Setup Firestore real-time listener
    setupFirestoreListener();
    
  } catch (error) {
    console.error('[Order Management] Failed to initialize page:', error);
    showError(`Failed to load orders: ${error.message}`);
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Search input
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentFilters.search = e.target.value.trim();
        currentPage = 1;
        fetchOrders();
      }, 500); // Debounce 500ms
    });
  }

  // Order status filter
  const orderStatusFilter = document.getElementById('orderStatusFilter');
  if (orderStatusFilter) {
    orderStatusFilter.addEventListener('change', (e) => {
      currentFilters.orderStatus = e.target.value;
      currentPage = 1;
      fetchOrders();
    });
  }

  // Payment status filter
  const paymentStatusFilter = document.getElementById('paymentStatusFilter');
  if (paymentStatusFilter) {
    paymentStatusFilter.addEventListener('change', (e) => {
      currentFilters.paymentStatus = e.target.value;
      currentPage = 1;
      fetchOrders();
    });
  }

  // Pagination buttons
  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');
  
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        fetchOrders();
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (currentPage < totalPages) {
        currentPage++;
        fetchOrders();
      }
    });
  }
}

/**
 * Setup Firestore real-time listener
 * Reuses existing Firebase app from auth_manager
 */
function setupFirestoreListener() {
  // Wait a bit for Firebase to be fully initialized
  setTimeout(() => {
    try {
      // Get the existing Firebase app from window.firebaseAuth (set by auth_manager)
      // The auth object has an 'app' property
      if (window.firebaseAuth) {
        const auth = window.firebaseAuth;
        const app = auth.app;
        
        if (!app) {
          console.warn('[Order Management] Firebase app not found, skipping real-time listener');
          return;
        }
        
        // Import Firestore and use existing app
        import('https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js').then(firebaseFirestore => {
          try {
            const db = firebaseFirestore.getFirestore(app);
            
            // Listen to orders collection changes
            firestoreListener = firebaseFirestore.onSnapshot(
              firebaseFirestore.collection(db, 'orders'),
              (snapshot) => {
                console.log('[Order Management] Orders collection updated, refreshing...');
                fetchOrders(); // Refresh data when orders change
              },
              (error) => {
                console.error('[Order Management] Firestore listener error:', error);
              }
            );
            
            console.log('[Order Management] Firestore real-time listener initialized');
          } catch (firestoreError) {
            console.warn('[Order Management] Could not initialize Firestore:', firestoreError);
          }
        }).catch(error => {
          console.warn('[Order Management] Could not load Firestore module:', error);
        });
      } else {
        console.warn('[Order Management] Firebase auth not found, skipping real-time listener');
      }
    } catch (error) {
      console.warn('[Order Management] Could not setup Firestore listener:', error);
      // Continue without real-time updates
    }
  }, 1500); // Wait 1.5 seconds for auth to initialize
}

/**
 * Fetch orders from API
 */
async function fetchOrders() {
  try {
    showLoading();
    hideError();

    // Check if user is authenticated before getting token
    const user = getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated. Please login.');
    }

    let token;
    try {
      token = await getIdToken();
    } catch (tokenError) {
      console.error('[Order Management] Failed to get token:', tokenError);
      throw new Error('Failed to get authentication token. Please refresh the page.');
    }
    
    // Build query string
    const params = new URLSearchParams({
      page: currentPage.toString(),
      limit: '5'
    });
    
    if (currentFilters.orderStatus) {
      params.append('orderStatus', currentFilters.orderStatus);
    }
    if (currentFilters.paymentStatus) {
      params.append('paymentStatus', currentFilters.paymentStatus);
    }
    if (currentFilters.search) {
      params.append('search', currentFilters.search);
    }

    const response = await fetch(`${API_BASE}/all?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    
    if (data.success) {
      currentPage = data.page;
      totalPages = data.totalPages;
      
      renderOrdersTable(data.orders);
      updateOrderCount(data.total);
      updatePagination(data.page, data.totalPages, data.total);
      hideLoading();
    } else {
      throw new Error(data.error || 'Failed to fetch orders');
    }

  } catch (error) {
    console.error('[Order Management] Fetch orders error:', error);
    hideLoading();
    showError(`Failed to load orders: ${error.message}`);
  }
}

/**
 * Render orders table
 */
function renderOrdersTable(orders) {
  const tbody = document.getElementById('ordersTableBody');
  if (!tbody) return;

  if (orders.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 40px; color: #6B7280;">
          No orders found
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = orders.map(order => {
    const date = formatDate(order.createdAt);
    const total = formatCurrency(order.totalAmount);
    const orderStatusClass = getStatusClass(order.orderStatus);
    const paymentStatusClass = getPaymentStatusClass(order.paymentStatus);
    const buyerName = order.buyer?.displayName || 'Unknown User';
    const canEdit = order.orderStatus === 'processing';
    const canCancel = order.orderStatus === 'processing';

    return `
      <tr>
        <td><p>${order.id}</p></td>
        <td><p>${date}</p></td>
        <td>
          <div class="user-info">
            <img src="/img/icon/user.png" alt="">
            <div class="user-info-2">
              <div class="user-name">${buyerName}</div>
            </div>
          </div>
        </td>
        <td>${order.productName || 'N/A'}</td>
        <td>${total}</td>
        <td class="form_table ${paymentStatusClass}"><p>${capitalizeFirst(order.paymentStatus)}</p></td>
        <td class="form_table ${orderStatusClass}"><p>${capitalizeFirst(order.orderStatus)}</p></td>
        <td class="table_action">
          <img src="/img/icon/icons8-edit-50.png" alt="Edit" title="Edit Order" 
               onclick="handleEditOrder('${order.id}')" 
               style="cursor: pointer; ${canEdit ? '' : 'opacity: 0.5; cursor: not-allowed;'}"
               ${canEdit ? '' : 'onclick="alert(\'Can only edit orders with status: processing\')"'}>
          <img src="/img/icon/icons8-view-24.png" alt="View" title="View Details" 
               onclick="handleViewOrder('${order.id}')" style="cursor: pointer;">
          <img src="/img/icon/icons8-delete-user-male-24.png" alt="Cancel" title="Cancel Order" 
               onclick="handleCancelOrder('${order.id}')" 
               style="cursor: pointer; ${canCancel ? '' : 'opacity: 0.5; cursor: not-allowed;'}"
               ${canCancel ? '' : 'onclick="alert(\'Can only cancel orders with status: processing\')"'}>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Update order count
 */
function updateOrderCount(total) {
  const countElement = document.querySelector('.user_management_3_1_1 span');
  if (countElement) {
    countElement.textContent = total;
  }
}

/**
 * Update pagination UI
 */
function updatePagination(page, totalPages, total) {
  // Update pagination info
  const paginationInfo = document.getElementById('paginationInfo');
  if (paginationInfo) {
    const start = total === 0 ? 0 : (page - 1) * 5 + 1;
    const end = Math.min(page * 5, total);
    paginationInfo.textContent = `Showing ${start} to ${end} of ${total} results`;
  }

  // Update prev/next buttons
  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');
  
  if (prevBtn) {
    prevBtn.disabled = page === 1;
  }
  if (nextBtn) {
    nextBtn.disabled = page >= totalPages;
  }

  // Update page numbers
  const pageNumbersContainer = document.getElementById('pageNumbers');
  if (pageNumbersContainer) {
    let pageNumbersHTML = '';
    for (let i = 1; i <= totalPages; i++) {
      const activeClass = i === page ? 'active_page' : '';
      pageNumbersHTML += `<button class="user_management_4_page_number ${activeClass}" onclick="goToPage(${i})">${i}</button>`;
    }
    pageNumbersContainer.innerHTML = pageNumbersHTML;
  }
}

/**
 * Go to specific page
 */
window.goToPage = function(page) {
  if (page >= 1 && page <= totalPages) {
    currentPage = page;
    fetchOrders();
  }
};

/**
 * Handle view order
 */
window.handleViewOrder = async function(orderId) {
  try {
    const token = await getIdToken();
    const response = await fetch(`${API_BASE}/${orderId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch order details');
    }

    const data = await response.json();
    if (data.success) {
      showViewModal(data.order);
    } else {
      throw new Error(data.error || 'Failed to fetch order');
    }
  } catch (error) {
    console.error('View order error:', error);
    alert(`Failed to load order details: ${error.message}`);
  }
};

/**
 * Handle edit order
 */
window.handleEditOrder = async function(orderId) {
  try {
    const token = await getIdToken();
    const response = await fetch(`${API_BASE}/${orderId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch order details');
    }

    const data = await response.json();
    if (data.success) {
      if (data.order.orderStatus !== 'processing') {
        alert('Can only edit orders with status: processing');
        return;
      }
      showEditModal(data.order);
    } else {
      throw new Error(data.error || 'Failed to fetch order');
    }
  } catch (error) {
    console.error('Edit order error:', error);
    alert(`Failed to load order details: ${error.message}`);
  }
};

/**
 * Handle cancel order
 */
window.handleCancelOrder = async function(orderId) {
  const reason = prompt('Enter cancellation reason:');
  if (!reason || reason.trim() === '') {
    return;
  }

  try {
    const token = await getIdToken();
    const response = await fetch(`${API_BASE}/${orderId}/cancel`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ cancellationReason: reason.trim() })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to cancel order');
    }

    const data = await response.json();
    if (data.success) {
      alert('Order cancelled successfully');
      fetchOrders(); // Refresh table
    } else {
      throw new Error(data.error || 'Failed to cancel order');
    }
  } catch (error) {
    console.error('Cancel order error:', error);
    alert(`Failed to cancel order: ${error.message}`);
  }
};

/**
 * Show view modal
 */
function showViewModal(order) {
  const modal = document.getElementById('viewOrderModal');
  if (!modal) {
    // Create modal if it doesn't exist
    createViewModal();
  }

  const modalElement = document.getElementById('viewOrderModal');
  const buyerName = order.buyer?.displayName || 'Unknown User';
  const buyerEmail = order.buyer?.email || 'N/A';
  const sellerName = order.seller?.displayName || 'Unknown User';
  const sellerEmail = order.seller?.email || 'N/A';
  const date = formatDate(order.createdAt);
  const total = formatCurrency(order.totalAmount);
  const address = order.shippingAddress || {};

  // Populate modal
  document.getElementById('viewOrderId').textContent = order.id;
  document.getElementById('viewOrderDate').textContent = date;
  document.getElementById('viewBuyerName').textContent = buyerName;
  document.getElementById('viewBuyerEmail').textContent = buyerEmail;
  document.getElementById('viewSellerName').textContent = sellerName;
  document.getElementById('viewSellerEmail').textContent = sellerEmail;
  document.getElementById('viewProductName').textContent = order.productName || 'N/A';
  document.getElementById('viewQuantity').textContent = order.quantity || 1;
  document.getElementById('viewTotal').textContent = total;
  document.getElementById('viewOrderStatus').textContent = capitalizeFirst(order.orderStatus);
  document.getElementById('viewPaymentStatus').textContent = capitalizeFirst(order.paymentStatus);
  document.getElementById('viewPaymentMethod').textContent = order.paymentMethod || 'N/A';
  document.getElementById('viewFullName').textContent = address.fullName || 'N/A';
  document.getElementById('viewAddress').textContent = address.address || 'N/A';
  document.getElementById('viewPhone').textContent = address.phone || 'N/A';
  document.getElementById('viewCity').textContent = address.city || 'N/A';
  document.getElementById('viewPostalCode').textContent = address.postalCode || 'N/A';
  
  if (order.cancellationReason) {
    document.getElementById('viewCancellationReason').textContent = order.cancellationReason;
    document.getElementById('viewCancellationSection').style.display = 'block';
  } else {
    document.getElementById('viewCancellationSection').style.display = 'none';
  }

  modalElement.style.display = 'block';
}

/**
 * Show edit modal
 */
function showEditModal(order) {
  const modal = document.getElementById('editOrderModal');
  if (!modal) {
    createEditModal();
  }

  const modalElement = document.getElementById('editOrderModal');
  const address = order.shippingAddress || {};

  // Populate form
  document.getElementById('editOrderId').value = order.id;
  document.getElementById('editOrderStatus').value = order.orderStatus;
  document.getElementById('editFullName').value = address.fullName || '';
  document.getElementById('editAddress').value = address.address || '';
  document.getElementById('editPhone').value = address.phone || '';
  document.getElementById('editCity').value = address.city || '';
  document.getElementById('editPostalCode').value = address.postalCode || '';

  modalElement.style.display = 'block';
}

/**
 * Submit edit form
 */
window.submitEditOrder = async function() {
  const orderId = document.getElementById('editOrderId').value;
  const orderStatus = document.getElementById('editOrderStatus').value;
  const shippingAddress = {
    fullName: document.getElementById('editFullName').value.trim(),
    address: document.getElementById('editAddress').value.trim(),
    phone: document.getElementById('editPhone').value.trim(),
    city: document.getElementById('editCity').value.trim(),
    postalCode: document.getElementById('editPostalCode').value.trim()
  };

  // Validate
  if (!shippingAddress.fullName || !shippingAddress.address || !shippingAddress.phone) {
    alert('Full name, address, and phone are required');
    return;
  }

  try {
    const token = await getIdToken();
    
    // Update status if changed
    if (orderStatus) {
      const statusResponse = await fetch(`${API_BASE}/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ orderStatus })
      });

      if (!statusResponse.ok) {
        const errorData = await statusResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update status');
      }
    }

    // Update shipping address
    const addressResponse = await fetch(`${API_BASE}/${orderId}/shipping-address`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ shippingAddress })
    });

    if (!addressResponse.ok) {
      const errorData = await addressResponse.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to update shipping address');
    }

    alert('Order updated successfully');
    closeEditModal();
    fetchOrders(); // Refresh table

  } catch (error) {
    console.error('Update order error:', error);
    alert(`Failed to update order: ${error.message}`);
  }
};

/**
 * Close modals
 */
window.closeViewModal = function() {
  const modal = document.getElementById('viewOrderModal');
  if (modal) modal.style.display = 'none';
};

window.closeEditModal = function() {
  const modal = document.getElementById('editOrderModal');
  if (modal) modal.style.display = 'none';
};

/**
 * Create view modal HTML
 */
function createViewModal() {
  const modalHTML = `
    <div id="viewOrderModal" class="modal" style="display: none;">
      <div class="modal-overlay" onclick="closeViewModal()"></div>
      <div class="modal-content modal-large">
        <h3>Order Details</h3>
        <div class="order-details">
          <div class="detail-section">
            <h4>Order Information</h4>
            <div class="detail-row"><strong>Order ID:</strong> <span id="viewOrderId"></span></div>
            <div class="detail-row"><strong>Date:</strong> <span id="viewOrderDate"></span></div>
            <div class="detail-row"><strong>Order Status:</strong> <span id="viewOrderStatus"></span></div>
            <div class="detail-row"><strong>Payment Status:</strong> <span id="viewPaymentStatus"></span></div>
            <div class="detail-row"><strong>Payment Method:</strong> <span id="viewPaymentMethod"></span></div>
          </div>
          <div class="detail-section">
            <h4>Buyer Information</h4>
            <div class="detail-row"><strong>Name:</strong> <span id="viewBuyerName"></span></div>
            <div class="detail-row"><strong>Email:</strong> <span id="viewBuyerEmail"></span></div>
          </div>
          <div class="detail-section">
            <h4>Seller Information</h4>
            <div class="detail-row"><strong>Name:</strong> <span id="viewSellerName"></span></div>
            <div class="detail-row"><strong>Email:</strong> <span id="viewSellerEmail"></span></div>
          </div>
          <div class="detail-section">
            <h4>Product Information</h4>
            <div class="detail-row"><strong>Product:</strong> <span id="viewProductName"></span></div>
            <div class="detail-row"><strong>Quantity:</strong> <span id="viewQuantity"></span></div>
            <div class="detail-row"><strong>Total:</strong> <span id="viewTotal"></span></div>
          </div>
          <div class="detail-section">
            <h4>Shipping Address</h4>
            <div class="detail-row"><strong>Full Name:</strong> <span id="viewFullName"></span></div>
            <div class="detail-row"><strong>Address:</strong> <span id="viewAddress"></span></div>
            <div class="detail-row"><strong>Phone:</strong> <span id="viewPhone"></span></div>
            <div class="detail-row"><strong>City:</strong> <span id="viewCity"></span></div>
            <div class="detail-row"><strong>Postal Code:</strong> <span id="viewPostalCode"></span></div>
          </div>
          <div class="detail-section" id="viewCancellationSection" style="display: none;">
            <h4>Cancellation</h4>
            <div class="detail-row"><strong>Reason:</strong> <span id="viewCancellationReason"></span></div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-primary" onclick="closeViewModal()">Close</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

/**
 * Create edit modal HTML
 */
function createEditModal() {
  const modalHTML = `
    <div id="editOrderModal" class="modal" style="display: none;">
      <div class="modal-overlay" onclick="closeEditModal()"></div>
      <div class="modal-content modal-large">
        <h3>Edit Order</h3>
        <form onsubmit="event.preventDefault(); submitEditOrder();">
          <input type="hidden" id="editOrderId">
          
          <div class="form-group">
            <label>Order Status *</label>
            <select id="editOrderStatus" required>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="processing">Processing</option>
              <option value="delivered">Delivered</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <h4 style="margin-top: 20px;">Shipping Address</h4>
          
          <div class="form-group">
            <label>Full Name *</label>
            <input type="text" id="editFullName" required>
          </div>

          <div class="form-group">
            <label>Address *</label>
            <textarea id="editAddress" rows="2" required></textarea>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Phone *</label>
              <input type="text" id="editPhone" required>
            </div>
            <div class="form-group">
              <label>City</label>
              <input type="text" id="editCity">
            </div>
          </div>

          <div class="form-group">
            <label>Postal Code</label>
            <input type="text" id="editPostalCode">
          </div>

          <div class="modal-actions">
            <button type="button" class="btn-secondary" onclick="closeEditModal()">Cancel</button>
            <button type="submit" class="btn-primary">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

/**
 * Utility functions
 */
function formatDate(timestamp) {
  if (!timestamp) return 'N/A';
  
  let date;
  if (timestamp.toDate) {
    date = timestamp.toDate();
  } else if (timestamp.seconds) {
    date = new Date(timestamp.seconds * 1000);
  } else {
    date = new Date(timestamp);
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

function formatCurrency(amount) {
  if (!amount) return '₫0';
  return `₫${Number(amount).toLocaleString('vi-VN')}`;
}

function getStatusClass(status) {
  const statusMap = {
    'pending': 'pending',
    'paid': 'active',
    'processing': 'processing',
    'delivered': 'delivered',
    'completed': 'delivered',
    'cancelled': 'cancelled'
  };
  return statusMap[status] || 'pending';
}

function getPaymentStatusClass(status) {
  const statusMap = {
    'pending': 'pending',
    'paid': 'active',
    'failed': 'nonactive'
  };
  return statusMap[status] || 'pending';
}

function capitalizeFirst(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function showLoading() {
  const loading = document.getElementById('loadingState');
  if (loading) loading.style.display = 'block';
  
  const tbody = document.getElementById('ordersTableBody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px;">Loading...</td></tr>';
  }
}

function hideLoading() {
  const loading = document.getElementById('loadingState');
  if (loading) loading.style.display = 'none';
}

function showError(message) {
  const errorDiv = document.getElementById('errorState');
  if (errorDiv) {
    errorDiv.innerHTML = `
      <div style="background: #FEE2E2; color: #B91C1C; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0 0 10px;">${message}</p>
        <button onclick="fetchOrders()" style="padding: 8px 16px; background: #B91C1C; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Retry
        </button>
      </div>
    `;
    errorDiv.style.display = 'block';
  } else {
    alert(message);
  }
}

function hideError() {
  const errorDiv = document.getElementById('errorState');
  if (errorDiv) errorDiv.style.display = 'none';
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePage);
} else {
  initializePage();
}

// Cleanup listener on page unload
window.addEventListener('beforeunload', () => {
  if (firestoreListener) {
    firestoreListener();
  }
});

