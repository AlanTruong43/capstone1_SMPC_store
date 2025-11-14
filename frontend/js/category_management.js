// Category Management JavaScript
// Handles CRUD operations for admin category management page

const API_BASE_URL = 'http://localhost:4000';

// State management
let currentFilters = {
  search: '',
  page: 1,
  limit: 50
};

// DOM Elements
let categoriesTableBody;
let searchInput;
let categoryCountSpan;
let showingStartSpan;
let showingEndSpan;
let totalCategoriesSpan;
let currentPageSpan;
let prevPageBtn;
let nextPageBtn;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Get DOM elements
  categoriesTableBody = document.getElementById('categoriesTableBody');
  searchInput = document.getElementById('searchInput');
  categoryCountSpan = document.getElementById('categoryCount');
  showingStartSpan = document.getElementById('showingStart');
  showingEndSpan = document.getElementById('showingEnd');
  totalCategoriesSpan = document.getElementById('totalCategories');
  currentPageSpan = document.getElementById('currentPage');
  prevPageBtn = document.getElementById('prevPageBtn');
  nextPageBtn = document.getElementById('nextPageBtn');

  // Attach event listeners
  attachEventListeners();

  // Load categories on page load
  loadCategories();
});

/**
 * Attach event listeners to UI elements
 */
function attachEventListeners() {
  // Search input with debounce
  let searchTimeout;
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentFilters.search = e.target.value.trim();
        currentFilters.page = 1; // Reset to first page
        loadCategories();
      }, 300); // Wait 300ms after user stops typing
    });
  }

  // Add category button
  const addCategoryBtn = document.getElementById('addCategoryBtn');
  if (addCategoryBtn) {
    addCategoryBtn.addEventListener('click', openAddCategoryModal);
  }

  // Delete confirmation checkbox
  const deleteCheckbox = document.getElementById('deleteConfirmCheckbox');
  if (deleteCheckbox) {
    deleteCheckbox.addEventListener('change', (e) => {
      document.getElementById('confirmDeleteBtn').disabled = !e.target.checked;
    });
  }

  // Pagination buttons
  if (prevPageBtn) {
    prevPageBtn.addEventListener('click', () => {
      if (currentFilters.page > 1) {
        currentFilters.page--;
        loadCategories();
      }
    });
  }

  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', () => {
      currentFilters.page++;
      loadCategories();
    });
  }
}

/**
 * Get ID token from localStorage
 */
function getIdToken() {
  return localStorage.getItem('idToken');
}

/**
 * Load categories from backend API
 */
async function loadCategories() {
  if (!categoriesTableBody) return;

  // Show loading state
  categoriesTableBody.innerHTML = `
    <tr>
      <td colspan="5" style="text-align: center; padding: 40px;">
        <div style="font-size: 16px; color: #6B7280;">Loading categories...</div>
      </td>
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
    params.append('page', currentFilters.page);
    params.append('limit', currentFilters.limit);

    const response = await fetch(`${API_BASE_URL}/metadata/admin/categories?${params.toString()}`, {
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
        throw new Error('Failed to fetch categories');
      }
      return;
    }

    const data = await response.json();
    renderCategoriesTable(data.categories);
    updateCategoryCount(data.pagination.total);
    updatePagination(data.pagination);

  } catch (error) {
    console.error('Error loading categories:', error);
    showError('Failed to load categories. Please try again.');
  }
}

/**
 * Render categories in the table
 */
function renderCategoriesTable(categories) {
  if (!categoriesTableBody) return;

  // Clear table
  categoriesTableBody.innerHTML = '';

  // Check if no categories
  if (!categories || categories.length === 0) {
    categoriesTableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 40px;">
          <div style="font-size: 16px; color: #6B7280;">No categories found</div>
        </td>
      </tr>
    `;
    return;
  }

  // Render each category
  categories.forEach(category => {
    const row = createCategoryRow(category);
    categoriesTableBody.appendChild(row);
  });
}

/**
 * Create a table row for a category
 */
function createCategoryRow(category) {
  const tr = document.createElement('tr');
  
  tr.innerHTML = `
    <td>${escapeHtml(category.name || 'N/A')}</td>
    <td style="font-family: monospace; font-size: 0.9em;">${escapeHtml(category.slug || 'N/A')}</td>
    <td>${escapeHtml(category.description || '-')}</td>
    <td>${category.productCount || 0}</td>
    <td class="table_action">
      <img src="/img/icon/icons8-edit-50.png" alt="Edit" title="Edit category" style="cursor: pointer;" onclick="editCategory('${category.id}')">
      <img src="/img/icon/icons8-view-24.png" alt="View" title="View details" style="cursor: pointer;" onclick="viewCategory('${category.id}')">
      <img src="/img/icon/icons8-delete-user-male-24.png" alt="Delete" title="Delete category" style="cursor: pointer;" onclick="deleteCategory('${category.id}', '${escapeHtml(category.name || '')}')">
    </td>
  `;
  
  return tr;
}

/**
 * Update category count display
 */
function updateCategoryCount(count) {
  if (categoryCountSpan) {
    categoryCountSpan.textContent = count;
  }
}

/**
 * Update pagination display
 */
function updatePagination(pagination) {
  if (showingStartSpan) {
    const start = pagination.page === 1 ? 1 : (pagination.page - 1) * pagination.limit + 1;
    showingStartSpan.textContent = start;
  }
  
  if (showingEndSpan) {
    const end = Math.min(pagination.page * pagination.limit, pagination.total);
    showingEndSpan.textContent = end;
  }
  
  if (totalCategoriesSpan) {
    totalCategoriesSpan.textContent = pagination.total;
  }
  
  if (currentPageSpan) {
    currentPageSpan.textContent = pagination.page;
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
  if (categoriesTableBody) {
    categoriesTableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 40px;">
          <div style="font-size: 16px; color: #EF4444;">${escapeHtml(message)}</div>
        </td>
      </tr>
    `;
  }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// CRUD OPERATIONS
// ============================================

// Global variables to store current operation data
let currentDeleteCategoryId = null;
let currentDeleteCategoryName = null;

/**
 * Delete Category - Show confirmation modal
 */
function deleteCategory(categoryId, categoryName) {
  currentDeleteCategoryId = categoryId;
  currentDeleteCategoryName = categoryName;
  
  document.getElementById('deleteCategoryName').textContent = categoryName;
  document.getElementById('deleteModal').style.display = 'block';
  document.getElementById('deleteConfirmCheckbox').checked = false;
  document.getElementById('confirmDeleteBtn').disabled = true;
}

/**
 * Close delete modal
 */
function closeDeleteModal() {
  document.getElementById('deleteModal').style.display = 'none';
  currentDeleteCategoryId = null;
  currentDeleteCategoryName = null;
}

/**
 * Confirm delete - Actually delete the category
 */
async function confirmDelete() {
  if (!currentDeleteCategoryId) return;
  
  const confirmBtn = document.getElementById('confirmDeleteBtn');
  confirmBtn.disabled = true;
  confirmBtn.textContent = 'Deleting...';
  
  try {
    const idToken = getIdToken();
    const response = await fetch(`${API_BASE_URL}/metadata/admin/categories/${currentDeleteCategoryId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete category');
    }
    
    const result = await response.json();
    console.log('Category deleted:', result);
    
    closeDeleteModal();
    alert('Category deleted successfully!');
    loadCategories(); // Reload the category list
    
  } catch (error) {
    console.error('Error deleting category:', error);
    alert('Failed to delete category: ' + error.message);
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Delete Category';
  }
}

/**
 * View Category - Show details modal
 */
async function viewCategory(categoryId) {
  try {
    const idToken = getIdToken();
    const response = await fetch(`${API_BASE_URL}/metadata/admin/categories/${categoryId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch category details');
    }
    
    const category = await response.json();
    
    // Get product count
    const listResponse = await fetch(`${API_BASE_URL}/metadata/admin/categories?page=1&limit=1000`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    let productCount = 0;
    if (listResponse.ok) {
      const listData = await listResponse.json();
      const foundCategory = listData.categories.find(c => c.id === categoryId);
      if (foundCategory) {
        productCount = foundCategory.productCount || 0;
      }
    }
    
    // Populate modal
    document.getElementById('viewName').textContent = category.name || 'N/A';
    document.getElementById('viewSlug').textContent = category.slug || 'N/A';
    document.getElementById('viewDescription').textContent = category.description || 'N/A';
    document.getElementById('viewProductCount').textContent = productCount;
    document.getElementById('viewCategoryId').textContent = categoryId;
    
    document.getElementById('viewCategoryModal').style.display = 'block';
    
  } catch (error) {
    console.error('Error viewing category:', error);
    alert('Failed to load category details: ' + error.message);
  }
}

/**
 * Close view modal
 */
function closeViewCategoryModal() {
  document.getElementById('viewCategoryModal').style.display = 'none';
}

/**
 * Edit Category - Show edit modal
 */
async function editCategory(categoryId) {
  try {
    const idToken = getIdToken();
    const response = await fetch(`${API_BASE_URL}/metadata/admin/categories/${categoryId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch category details');
    }
    
    const category = await response.json();
    
    // Populate form
    document.getElementById('editCategoryId').value = categoryId;
    document.getElementById('editName').value = category.name || '';
    document.getElementById('editSlug').value = category.slug || '';
    document.getElementById('editDescription').value = category.description || '';
    
    document.getElementById('editCategoryModal').style.display = 'block';
    
  } catch (error) {
    console.error('Error loading category for edit:', error);
    alert('Failed to load category details: ' + error.message);
  }
}

/**
 * Close edit modal
 */
function closeEditCategoryModal() {
  document.getElementById('editCategoryModal').style.display = 'none';
}

/**
 * Submit edit category form
 */
async function submitEditCategory() {
  const categoryId = document.getElementById('editCategoryId').value;
  const name = document.getElementById('editName').value.trim();
  const slug = document.getElementById('editSlug').value.trim().toLowerCase();
  const description = document.getElementById('editDescription').value.trim();
  
  if (!name || !slug) {
    alert('Name and slug are required');
    return;
  }
  
  // Validate slug format
  if (!/^[a-z0-9_-]+$/.test(slug)) {
    alert('Slug must contain only lowercase letters, numbers, hyphens, and underscores');
    return;
  }
  
  try {
    const idToken = getIdToken();
    const response = await fetch(`${API_BASE_URL}/metadata/admin/categories/${categoryId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, slug, description })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update category');
    }
    
    const result = await response.json();
    console.log('Category updated:', result);
    
    closeEditCategoryModal();
    alert('Category updated successfully!');
    loadCategories(); // Reload the category list
    
  } catch (error) {
    console.error('Error updating category:', error);
    alert('Failed to update category: ' + error.message);
  }
}

/**
 * Open add category modal
 */
function openAddCategoryModal() {
  // Clear form
  document.getElementById('addName').value = '';
  document.getElementById('addSlug').value = '';
  document.getElementById('addDescription').value = '';
  
  document.getElementById('addCategoryModal').style.display = 'block';
}

/**
 * Close add category modal
 */
function closeAddCategoryModal() {
  document.getElementById('addCategoryModal').style.display = 'none';
}

/**
 * Submit add category form
 */
async function submitAddCategory() {
  const name = document.getElementById('addName').value.trim();
  const slug = document.getElementById('addSlug').value.trim().toLowerCase();
  const description = document.getElementById('addDescription').value.trim();
  
  if (!name || !slug) {
    alert('Name and slug are required');
    return;
  }
  
  // Validate slug format
  if (!/^[a-z0-9_-]+$/.test(slug)) {
    alert('Slug must contain only lowercase letters, numbers, hyphens, and underscores');
    return;
  }
  
  try {
    const idToken = getIdToken();
    const response = await fetch(`${API_BASE_URL}/metadata/admin/categories`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, slug, description })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create category');
    }
    
    const result = await response.json();
    console.log('Category created:', result);
    
    closeAddCategoryModal();
    alert('Category created successfully!');
    loadCategories(); // Reload the category list
    
  } catch (error) {
    console.error('Error creating category:', error);
    alert('Failed to create category: ' + error.message);
  }
}

