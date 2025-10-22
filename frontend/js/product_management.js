// Product Management JavaScript - Admin CRUD Operations
// Handles all product management functionality for admin panel

const API_BASE_URL = 'http://localhost:4000';

// State management
let currentFilters = {
  search: '',
  category: '',
  status: '',
  page: 1,
  limit: 50
};

let allCategories = [];
let currentDeleteProductId = null;
let isEditMode = false;

// DOM Elements
let productsTableBody;
let searchInput;
let categoryFilter;
let statusFilter;
let productCountSpan;
let currentPageSpan;
let prevPageBtn;
let nextPageBtn;
let totalProductsSpan;
let showingStartSpan;
let showingEndSpan;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  initializeDOMElements();
  attachEventListeners();
  loadCategories();
  loadProducts();
});

/**
 * Initialize DOM element references
 */
function initializeDOMElements() {
  productsTableBody = document.getElementById('productsTableBody');
  searchInput = document.getElementById('searchInput');
  categoryFilter = document.getElementById('categoryFilter');
  statusFilter = document.getElementById('statusFilter');
  productCountSpan = document.getElementById('productCount');
  currentPageSpan = document.getElementById('currentPage');
  prevPageBtn = document.getElementById('prevPageBtn');
  nextPageBtn = document.getElementById('nextPageBtn');
  totalProductsSpan = document.getElementById('totalProducts');
  showingStartSpan = document.getElementById('showingStart');
  showingEndSpan = document.getElementById('showingEnd');
}

/**
 * Attach event listeners to UI elements
 */
function attachEventListeners() {
  // Search with debounce
  let searchTimeout;
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentFilters.search = e.target.value.trim();
        currentFilters.page = 1;
        loadProducts();
      }, 300);
    });
  }

  // Category filter
  if (categoryFilter) {
    categoryFilter.addEventListener('change', (e) => {
      currentFilters.category = e.target.value;
      currentFilters.page = 1;
      loadProducts();
    });
  }

  // Status filter
  if (statusFilter) {
    statusFilter.addEventListener('change', (e) => {
      currentFilters.status = e.target.value;
      currentFilters.page = 1;
      loadProducts();
    });
  }

  // Add product button
  const addProductBtn = document.getElementById('addProductBtn');
  if (addProductBtn) {
    addProductBtn.addEventListener('click', openAddProductModal);
  }

  // Pagination buttons
  if (prevPageBtn) {
    prevPageBtn.addEventListener('click', () => {
      if (currentFilters.page > 1) {
        currentFilters.page--;
        loadProducts();
      }
    });
  }

  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', () => {
      currentFilters.page++;
      loadProducts();
    });
  }

  // Delete confirmation checkbox
  const deleteCheckbox = document.getElementById('deleteConfirmCheckbox');
  if (deleteCheckbox) {
    deleteCheckbox.addEventListener('change', (e) => {
      document.getElementById('confirmDeleteBtn').disabled = !e.target.checked;
    });
  }

  // Modal overlay clicks
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal');
      if (modal) {
        modal.classList.remove('show');
      }
    });
  });
}

/**
 * Get ID token from localStorage
 */
function getIdToken() {
  return localStorage.getItem('idToken');
}

/**
 * Get current user UID from decoded token
 * Firebase ID tokens are JWT format: header.payload.signature
 */
function getCurrentUserUid() {
  const token = getIdToken();
  if (!token) {
    console.error('No token found in localStorage');
    return null;
  }
  
  try {
    // Decode JWT payload (base64)
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    console.log('Decoded token:', decoded); // Debug log
    
    // Firebase tokens use 'user_id' or 'sub' for the UID
    const uid = decoded.user_id || decoded.sub || decoded.uid;
    console.log('Extracted UID:', uid); // Debug log
    
    return uid;
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
}

/**
 * Load categories from API
 */
async function loadCategories() {
  try {
    const response = await fetch(`${API_BASE_URL}/metadata/categories`);
    if (!response.ok) throw new Error('Failed to load categories');
    
    const data = await response.json();
    // API returns array directly, not { categories: [...] }
    allCategories = Array.isArray(data) ? data : [];
    
    console.log('Loaded categories:', allCategories); // Debug log
    
    // Populate category filters
    populateCategorySelects();
  } catch (error) {
    console.error('Error loading categories:', error);
  }
}

/**
 * Populate category select dropdowns
 */
function populateCategorySelects() {
  const categorySelects = [categoryFilter, document.getElementById('editCategory')];
  
  categorySelects.forEach(select => {
    if (!select) return;
    
    // Keep first option (All Categories or Select Category)
    const firstOption = select.options[0];
    select.innerHTML = '';
    select.appendChild(firstOption);
    
    // Add category options
    allCategories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat.id;
      option.textContent = cat.name;
      select.appendChild(option);
    });
  });
}

/**
 * Load products from API
 */
async function loadProducts() {
  if (!productsTableBody) return;

  // Show loading state
  productsTableBody.innerHTML = `
    <tr>
      <td colspan="9" class="loading">Loading products...</td>
    </tr>
  `;

  try {
    const idToken = getIdToken();
    if (!idToken) {
      showError('Authentication required. Please login again.');
      return;
    }

    // Build query string
    const params = new URLSearchParams();
    if (currentFilters.search) params.append('search', currentFilters.search);
    if (currentFilters.category) params.append('category', currentFilters.category);
    if (currentFilters.status) params.append('status', currentFilters.status);
    params.append('page', currentFilters.page);
    params.append('limit', currentFilters.limit);

    const response = await fetch(`${API_BASE_URL}/products/admin/all?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 403) {
        showError('Admin access required');
      } else if (response.status === 401) {
        showError('Session expired. Please login again.');
      } else {
        throw new Error('Failed to fetch products');
      }
      return;
    }

    const data = await response.json();
    renderProductsTable(data.products);
    updatePagination(data.pagination);

  } catch (error) {
    console.error('Error loading products:', error);
    showError('Failed to load products. Please try again.');
  }
}

/**
 * Render products in the table
 */
function renderProductsTable(products) {
  if (!productsTableBody) return;

  // Clear table
  productsTableBody.innerHTML = '';

  // Check if no products
  if (!products || products.length === 0) {
    productsTableBody.innerHTML = `
      <tr>
        <td colspan="9" class="no-data">No products found</td>
      </tr>
    `;
    return;
  }

  // Render each product
  products.forEach(product => {
    const row = createProductRow(product);
    productsTableBody.appendChild(row);
  });
}

/**
 * Create a table row for a product
 */
function createProductRow(product) {
  const tr = document.createElement('tr');
  
  // Format price
  const price = formatPrice(product.price);
  
  // Format date
  const date = formatDate(product.createdAt || product.postDate);
  
  // Status badge
  const statusClass = product.status === 'available' ? 'status-available' : 'status-sold';
  const statusText = product.status === 'available' ? 'Available' : 'Sold';
  
  // Category
  const categoryName = product.categoryName || 'N/A';
  
  // Seller
  const sellerName = product.sellerName || 'Unknown';
  
  tr.innerHTML = `
    <td>
      <img src="${escapeHtml(product.imageUrl || '/img/placeholder.svg')}" 
           alt="${escapeHtml(product.name)}" 
           class="product-image"
           onerror="this.src='/img/placeholder.svg'">
    </td>
    <td>
      <strong>${escapeHtml(product.name)}</strong>
    </td>
    <td>
      <span class="category-badge">${escapeHtml(categoryName)}</span>
    </td>
    <td>${price}</td>
    <td>${product.quantity || 0}</td>
    <td>
      <span class="status-badge ${statusClass}">${statusText}</span>
    </td>
    <td>${escapeHtml(sellerName)}</td>
    <td>${date}</td>
    <td>
      <div class="action-buttons">
        <button class="action-btn view" onclick="viewProduct('${product.id}')">View</button>
        <button class="action-btn edit" onclick="editProduct('${product.id}')">Edit</button>
        <button class="action-btn delete" onclick="deleteProduct('${product.id}', '${escapeHtml(product.name)}')">Delete</button>
      </div>
    </td>
  `;
  
  return tr;
}

/**
 * Update pagination UI
 */
function updatePagination(pagination) {
  if (!pagination) return;

  // Update product count
  if (productCountSpan) {
    productCountSpan.textContent = pagination.total;
  }

  // Update current page
  if (currentPageSpan) {
    currentPageSpan.textContent = pagination.page;
  }

  // Update total products
  if (totalProductsSpan) {
    totalProductsSpan.textContent = pagination.total;
  }

  // Calculate showing range
  const start = (pagination.page - 1) * pagination.limit + 1;
  const end = Math.min(pagination.page * pagination.limit, pagination.total);

  if (showingStartSpan) {
    showingStartSpan.textContent = pagination.total > 0 ? start : 0;
  }

  if (showingEndSpan) {
    showingEndSpan.textContent = end;
  }

  // Update pagination buttons
  if (prevPageBtn) {
    prevPageBtn.disabled = pagination.page <= 1;
  }

  if (nextPageBtn) {
    nextPageBtn.disabled = pagination.page >= pagination.totalPages;
  }
}

/**
 * Show error message
 */
function showError(message) {
  if (productsTableBody) {
    productsTableBody.innerHTML = `
      <tr>
        <td colspan="9" class="error">${escapeHtml(message)}</td>
      </tr>
    `;
  }
}

// ============================================
// CRUD OPERATIONS
// ============================================

/**
 * View Product Details
 */
async function viewProduct(productId) {
  try {
    const idToken = getIdToken();
    const response = await fetch(`${API_BASE_URL}/products/${productId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) throw new Error('Failed to fetch product details');

    const product = await response.json();

    // Populate modal
    document.getElementById('viewImage').src = product.imageUrl || '/img/placeholder.svg';
    document.getElementById('viewName').textContent = product.name || 'N/A';
    document.getElementById('viewDescription').textContent = product.description || 'N/A';
    document.getElementById('viewCategory').textContent = product.category?.name || 'N/A';
    document.getElementById('viewPrice').textContent = formatPrice(product.price);
    document.getElementById('viewQuantity').textContent = product.quantity || 0;
    document.getElementById('viewStatus').textContent = product.status || 'N/A';
    document.getElementById('viewCondition').textContent = product.condition || 'N/A';
    document.getElementById('viewLocation').textContent = product.location || 'N/A';
    document.getElementById('viewSeller').textContent = product.sellerName || product.sellerEmail || 'Unknown';
    document.getElementById('viewCreated').textContent = formatDate(product.createdAt || product.postDate);
    document.getElementById('viewId').textContent = productId;

    // Show modal
    document.getElementById('viewModal').classList.add('show');

  } catch (error) {
    console.error('Error viewing product:', error);
    alert('Failed to load product details: ' + error.message);
  }
}

/**
 * Close view modal
 */
function closeViewModal() {
  document.getElementById('viewModal').classList.remove('show');
}

/**
 * Edit Product
 */
async function editProduct(productId) {
  try {
    const idToken = getIdToken();
    const response = await fetch(`${API_BASE_URL}/products/${productId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) throw new Error('Failed to fetch product details');

    const product = await response.json();

    // Set edit mode
    isEditMode = true;

    // Populate form
    document.getElementById('editModalTitle').textContent = 'Edit Product';
    document.getElementById('editProductId').value = productId;
    document.getElementById('editName').value = product.name || '';
    document.getElementById('editDescription').value = product.description || '';
    document.getElementById('editPrice').value = product.price || '';
    document.getElementById('editQuantity').value = product.quantity || '';
    document.getElementById('editCondition').value = product.condition || 'new';
    document.getElementById('editStatus').value = product.status || 'available';
    document.getElementById('editLocation').value = product.location || '';
    document.getElementById('editImageUrl').value = product.imageUrl || '';
    document.getElementById('editCategory').value = product.categoryId || '';

    // Show modal
    document.getElementById('editModal').classList.add('show');

  } catch (error) {
    console.error('Error loading product for edit:', error);
    alert('Failed to load product details: ' + error.message);
  }
}

/**
 * Open Add Product Modal
 */
function openAddProductModal() {
  // Set add mode
  isEditMode = false;

  // Clear form
  document.getElementById('editModalTitle').textContent = 'Add Product';
  document.getElementById('editProductId').value = '';
  document.getElementById('editName').value = '';
  document.getElementById('editDescription').value = '';
  document.getElementById('editPrice').value = '';
  document.getElementById('editQuantity').value = '';
  document.getElementById('editCondition').value = 'new';
  document.getElementById('editStatus').value = 'available';
  document.getElementById('editLocation').value = '';
  document.getElementById('editImageUrl').value = '';
  document.getElementById('editCategory').value = '';

  // Show modal
  document.getElementById('editModal').classList.add('show');
}

/**
 * Close edit modal
 */
function closeEditModal() {
  document.getElementById('editModal').classList.remove('show');
}

/**
 * Submit Product (Add or Edit)
 */
async function submitProduct() {
  try {
    const productId = document.getElementById('editProductId').value;
    const name = document.getElementById('editName').value.trim();
    const description = document.getElementById('editDescription').value.trim();
    const price = parseFloat(document.getElementById('editPrice').value);
    const quantity = parseInt(document.getElementById('editQuantity').value);
    const condition = document.getElementById('editCondition').value;
    const status = document.getElementById('editStatus').value;
    const location = document.getElementById('editLocation').value.trim();
    const imageUrl = document.getElementById('editImageUrl').value.trim();
    const categoryId = document.getElementById('editCategory').value;

    // Validation
    if (!name || !description || !price || !quantity || !location || !imageUrl || !categoryId) {
      alert('Please fill in all required fields');
      return;
    }

    const idToken = getIdToken();
    
    // Prepare payload
    const payload = {
      name,
      description,
      price,
      quantity,
      condition,
      status,
      location,
      imageUrl,
      categoryId
    };

    // Add sellerId for create - use current admin's UID (optional, backend will override)
    if (!isEditMode) {
      const adminUid = getCurrentUserUid();
      if (adminUid) {
        payload.sellerId = adminUid;
      }
      // Note: Backend will automatically set sellerId from authenticated user
    }

    let url, method;
    if (isEditMode) {
      url = `${API_BASE_URL}/products/admin/${productId}`;
      method = 'PUT';
    } else {
      url = `${API_BASE_URL}/products/admin`;
      method = 'POST';
    }

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || error.errors || 'Failed to save product');
    }

    const result = await response.json();
    console.log('Product saved:', result);

    closeEditModal();
    alert(isEditMode ? 'Product updated successfully!' : 'Product created successfully!');
    loadProducts();

  } catch (error) {
    console.error('Error saving product:', error);
    alert('Failed to save product: ' + error.message);
  }
}

/**
 * Delete Product - Show confirmation modal
 */
function deleteProduct(productId, productName) {
  currentDeleteProductId = productId;
  
  document.getElementById('deleteProductName').textContent = productName;
  document.getElementById('deleteModal').classList.add('show');
  document.getElementById('deleteConfirmCheckbox').checked = false;
  document.getElementById('confirmDeleteBtn').disabled = true;
}

/**
 * Close delete modal
 */
function closeDeleteModal() {
  document.getElementById('deleteModal').classList.remove('show');
  currentDeleteProductId = null;
}

/**
 * Confirm delete - Actually delete the product
 */
async function confirmDelete() {
  if (!currentDeleteProductId) return;
  
  const confirmBtn = document.getElementById('confirmDeleteBtn');
  confirmBtn.disabled = true;
  confirmBtn.textContent = 'Deleting...';
  
  try {
    const idToken = getIdToken();
    const response = await fetch(`${API_BASE_URL}/products/admin/${currentDeleteProductId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete product');
    }
    
    const result = await response.json();
    console.log('Product deleted:', result);
    
    closeDeleteModal();
    alert('Product deleted successfully!');
    loadProducts();
    
  } catch (error) {
    console.error('Error deleting product:', error);
    alert('Failed to delete product: ' + error.message);
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Delete Product';
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Format price to VND currency
 */
function formatPrice(price) {
  if (!price) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  }).format(price);
}

/**
 * Format date string
 */
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  } catch (e) {
    return 'N/A';
  }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

