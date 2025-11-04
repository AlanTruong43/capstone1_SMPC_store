/**
 * Admin Commission Management
 * Handles commission listing, filtering, pagination for completed and paid orders
 */

import { getIdToken, getCurrentUser, onAuthReady, initAuth } from './auth_manager.js';

const API_BASE = '/api/orders/admin';
const COMMISSION_RATE = 0.05; // 5%
let currentPage = 1;
let totalPages = 1;
let currentFilters = {
  search: ''
};

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
            console.log('[Commission] Auth ready (timeout), user:', user.email);
            resolve();
          } else {
            console.error('[Commission] Auth timeout - no user');
            showError('Authentication timeout. Please refresh the page.');
            resolve();
          }
        }
      }, 5000);
      
      onAuthReady((user, claims) => {
        if (resolved) return;
        
        if (user) {
          console.log('[Commission] Auth ready, user:', user.email);
          clearTimeout(timeout);
          resolved = true;
          resolve();
        } else {
          setTimeout(() => {
            if (!resolved) {
              const currentUser = getCurrentUser();
              if (currentUser) {
                console.log('[Commission] Auth ready (delayed), user:', currentUser.email);
                clearTimeout(timeout);
                resolved = true;
                resolve();
              } else {
                console.error('[Commission] No user authenticated');
                clearTimeout(timeout);
                resolved = true;
                showError('Please login to access commission management.');
                resolve();
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
    
    // Fetch initial commissions
    await fetchCommissions();
    
  } catch (error) {
    console.error('[Commission] Failed to initialize page:', error);
    showError(`Failed to load commissions: ${error.message}`);
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
        fetchCommissions();
      }, 500); // Debounce 500ms
    });
  }

  // Pagination buttons
  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');
  
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        fetchCommissions();
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (currentPage < totalPages) {
        currentPage++;
        fetchCommissions();
      }
    });
  }
}

/**
 * Fetch commissions from API
 * Only fetches orders with paymentStatus=paid AND orderStatus=completed
 */
async function fetchCommissions() {
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
      console.error('[Commission] Failed to get token:', tokenError);
      throw new Error('Failed to get authentication token. Please refresh the page.');
    }
    
    // Build query string - filter for paid AND completed orders
    const params = new URLSearchParams({
      paymentStatus: 'paid',
      orderStatus: 'completed',
      page: currentPage.toString(),
      limit: '5'
    });
    
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
      
      renderCommissionsTable(data.orders);
      updateCommissionCount(data.total);
      updatePagination(data.page, data.totalPages, data.total);
      hideLoading();
    } else {
      throw new Error(data.error || 'Failed to fetch commissions');
    }

  } catch (error) {
    console.error('[Commission] Fetch commissions error:', error);
    hideLoading();
    showError(`Failed to load commissions: ${error.message}`);
  }
}

/**
 * Render commissions table
 */
function renderCommissionsTable(orders) {
  const tbody = document.getElementById('commissionsTableBody');
  if (!tbody) return;

  if (orders.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 40px; color: #6B7280;">
          No commissions found
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = orders.map(order => {
    const date = formatDate(order.createdAt);
    const saleAmount = formatCurrency(order.totalAmount);
    const commissionAmount = formatCurrency(order.totalAmount * COMMISSION_RATE);
    const sellerName = order.seller?.displayName || 'Unknown User';
    const sellerEmail = order.seller?.email || 'N/A';

    return `
      <tr>
        <td><p>${order.id}</p></td>
        <td><p style="font-weight: bold;">${saleAmount}</p></td>
        <td><p>5%</p></td>
        <td><p style="font-weight: 700; color: #16A34A;">${commissionAmount}</p></td>
        <td><p>${date}</p></td>
        <td class="form_table collected"><p>Collected</p></td>
        <td>
          <div class="user-info">
            <img src="/img/icon/user.png" alt="">
            <div class="user-info-2">
              <div class="user-name">${sellerName}</div>
              <div class="user-email">${sellerEmail}</div>
            </div>
          </div>
        </td>
        <td class="table_action">
          <img src="/img/icon/icons8-edit-50.png" alt="">
          <img src="/img/icon/icons8-view-24.png" alt="">
          <img src="/img/icon/icons8-delete-user-male-24.png" alt="">
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Update commission count
 */
function updateCommissionCount(total) {
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
    paginationInfo.innerHTML = `Showing ${start} to ${end} of <span>${total}</span> results`;
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
    fetchCommissions();
  }
};

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

function showLoading() {
  const tbody = document.getElementById('commissionsTableBody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px;">Loading...</td></tr>';
  }
}

function hideLoading() {
  // Loading is handled by table content
}

function showError(message) {
  const errorDiv = document.getElementById('errorState');
  if (errorDiv) {
    errorDiv.innerHTML = `
      <div style="background: #FEE2E2; color: #B91C1C; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0 0 10px;">${message}</p>
        <button onclick="fetchCommissions()" style="padding: 8px 16px; background: #B91C1C; color: white; border: none; border-radius: 4px; cursor: pointer;">
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

// Make fetchCommissions available globally for retry button
window.fetchCommissions = fetchCommissions;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePage);
} else {
  initializePage();
}

