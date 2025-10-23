// Customer Products Management
// Firebase configuration (matches login/register project)
const firebaseConfig = {
    apiKey: "AIzaSyDI1V6BaKvdeLo2kbXAREWweZyiGAF4508",
    authDomain: "smartshopai-45959.firebaseapp.com",
    projectId: "smartshopai-45959",
    storageBucket: "smartshopai-45959.firebasestorage.app",
    messagingSenderId: "550339763780",
    appId: "1:550339763780:web:b9b8957b1597ef09d5a611"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const API_BASE = "http://localhost:4000";

// State management
let currentUser = null;
let allProducts = [];
let filteredProducts = [];
let categories = [];
let currentEditingProductId = null;
let currentDeletingProductId = null;

// DOM Elements
const loadingState = document.getElementById('loadingState');
const emptyState = document.getElementById('emptyState');
const productsTableContainer = document.getElementById('productsTableContainer');
const productsTableBody = document.getElementById('productsTableBody');
const searchInput = document.getElementById('searchProducts');
const filterStatus = document.getElementById('filterStatus');
const editModal = document.getElementById('editModal');
const deleteModal = document.getElementById('deleteModal');
const editForm = document.getElementById('editProductForm');
const toast = document.getElementById('toast');

// Stats elements
const statTotal = document.getElementById('statTotal');
const statAvailable = document.getElementById('statAvailable');
const statSold = document.getElementById('statSold');

// Authentication check
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        await init();
    } else {
        // Redirect to login if not authenticated
        window.location.href = '/pages/login_page.html';
    }
});

// Initialize
async function init() {
    try {
        showLoading();
        
        // Fetch categories first for the edit form
        await fetchCategories();
        
        // Fetch user's products
        await fetchUserProducts();
        
    } catch (error) {
        console.error('Initialization error:', error);
        showToast('Failed to load products. Please refresh the page.', 'error');
        hideLoading();
    }
}

// Fetch categories
async function fetchCategories() {
    try {
        const response = await fetch(`${API_BASE}/metadata/categories`);
        if (!response.ok) throw new Error('Failed to fetch categories');
        categories = await response.json();
        populateCategoryDropdown();
    } catch (error) {
        console.error('Error fetching categories:', error);
        showToast('Failed to load categories', 'error');
    }
}

// Populate category dropdown in edit form
function populateCategoryDropdown() {
    const select = document.getElementById('editCategory');
    select.innerHTML = '<option value="">Select category</option>';
    
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.slug;
        option.textContent = cat.name;
        select.appendChild(option);
    });
}

// Fetch user's products
async function fetchUserProducts() {
    try {
        const idToken = await currentUser.getIdToken();
        
        const response = await fetch(`${API_BASE}/products/customer`, {
            headers: {
                'Authorization': `Bearer ${idToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch products');
        }
        
        allProducts = await response.json();
        filteredProducts = [...allProducts];
        
        updateStats();
        renderProducts();
        hideLoading();
        
    } catch (error) {
        console.error('Error fetching products:', error);
        showToast('Failed to load products', 'error');
        hideLoading();
    }
}

// Update statistics
function updateStats() {
    const total = allProducts.length;
    const available = allProducts.filter(p => p.status === 'available').length;
    const sold = allProducts.filter(p => p.status === 'sold').length;
    
    statTotal.textContent = total;
    statAvailable.textContent = available;
    statSold.textContent = sold;
}

// Render products table
function renderProducts() {
    if (filteredProducts.length === 0) {
        showEmptyState();
        return;
    }
    
    showProductsTable();
    
    productsTableBody.innerHTML = filteredProducts.map(product => {
        const categoryName = getCategoryName(product.categoryId);
        const formattedPrice = formatPrice(product.price);
        const formattedDate = formatDate(product.postDate);
        
        return `
            <tr>
                <td>
                    <div class="product-cell">
                        <img src="${product.imageUrl || '/img/placeholder.svg'}" 
                             alt="${product.name}" 
                             class="product-image"
                             onerror="this.src='/img/placeholder.svg'">
                        <div class="product-info">
                            <div class="product-name">${escapeHtml(product.name)}</div>
                            <div class="product-id">ID: ${product.id.substring(0, 8)}...</div>
                        </div>
                    </div>
                </td>
                <td>${categoryName}</td>
                <td class="price-cell">${formattedPrice}</td>
                <td><span class="condition-badge">${product.condition || 'N/A'}</span></td>
                <td><span class="status-badge ${product.status}">${product.status}</span></td>
                <td class="date-cell">${formattedDate}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon edit" onclick="openEditModal('${product.id}')" 
                                title="Edit product">
                            Edit
                        </button>
                        <button class="btn-icon delete" onclick="openDeleteModal('${product.id}')" 
                                title="Delete product">
                            Delete
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Filter products
function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const statusFilter = filterStatus.value;
    
    filteredProducts = allProducts.filter(product => {
        const matchesSearch = !searchTerm || 
            product.name.toLowerCase().includes(searchTerm) ||
            product.description.toLowerCase().includes(searchTerm);
        
        const matchesStatus = !statusFilter || product.status === statusFilter;
        
        return matchesSearch && matchesStatus;
    });
    
    renderProducts();
}

// Event listeners for filters
searchInput.addEventListener('input', debounce(applyFilters, 300));
filterStatus.addEventListener('change', applyFilters);

// Open edit modal
async function openEditModal(productId) {
    currentEditingProductId = productId;
    const product = allProducts.find(p => p.id === productId);
    
    if (!product) {
        showToast('Product not found', 'error');
        return;
    }
    
    // Check if product can be edited
    try {
        const idToken = await currentUser.getIdToken();
        const response = await fetch(`${API_BASE}/products/customer/${productId}/can-edit`, {
            headers: {
                'Authorization': `Bearer ${idToken}`
            }
        });
        
        const result = await response.json();
        
        if (!result.canEdit) {
            showToast(result.reason || 'This product cannot be edited', 'warning');
            return;
        }
    } catch (error) {
        console.error('Error checking edit permission:', error);
        showToast('Failed to verify edit permission', 'error');
        return;
    }
    
    // Populate form
    document.getElementById('editName').value = product.name;
    document.getElementById('editCategory').value = product.categorySlug || getCategorySlug(product.categoryId);
    document.getElementById('editCondition').value = product.condition;
    document.getElementById('editPrice').value = product.price;
    document.getElementById('editQuantity').value = product.quantity;
    document.getElementById('editLocation').value = product.location;
    document.getElementById('editStatus').value = product.status;
    document.getElementById('editImageUrl').value = product.imageUrl;
    document.getElementById('editDescription').value = product.description;
    
    // Show modal
    editModal.style.display = 'flex';
}

// Close edit modal
function closeEditModal() {
    editModal.style.display = 'none';
    currentEditingProductId = null;
    editForm.reset();
}

// Handle edit form submission
editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!currentEditingProductId) return;
    
    try {
        const formData = {
            name: document.getElementById('editName').value.trim(),
            categorySlug: document.getElementById('editCategory').value,
            condition: document.getElementById('editCondition').value,
            price: parseFloat(document.getElementById('editPrice').value),
            quantity: parseInt(document.getElementById('editQuantity').value),
            location: document.getElementById('editLocation').value.trim(),
            status: document.getElementById('editStatus').value,
            imageUrl: document.getElementById('editImageUrl').value.trim(),
            description: document.getElementById('editDescription').value.trim()
        };
        
        const idToken = await currentUser.getIdToken();
        
        const response = await fetch(`${API_BASE}/products/customer/${currentEditingProductId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify(formData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update product');
        }
        
        showToast('Product updated successfully!', 'success');
        closeEditModal();
        await fetchUserProducts();
        
    } catch (error) {
        console.error('Error updating product:', error);
        showToast(error.message || 'Failed to update product', 'error');
    }
});

// Open delete modal
function openDeleteModal(productId) {
    currentDeletingProductId = productId;
    const product = allProducts.find(p => p.id === productId);
    
    if (!product) {
        showToast('Product not found', 'error');
        return;
    }
    
    document.getElementById('deleteProductName').textContent = product.name;
    deleteModal.style.display = 'flex';
}

// Close delete modal
function closeDeleteModal() {
    deleteModal.style.display = 'none';
    currentDeletingProductId = null;
}

// Confirm delete
async function confirmDelete() {
    if (!currentDeletingProductId) return;
    
    try {
        const idToken = await currentUser.getIdToken();
        
        const response = await fetch(`${API_BASE}/products/customer/${currentDeletingProductId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${idToken}`
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete product');
        }
        
        showToast('Product deleted successfully!', 'success');
        closeDeleteModal();
        await fetchUserProducts();
        
    } catch (error) {
        console.error('Error deleting product:', error);
        showToast(error.message || 'Failed to delete product', 'error');
    }
}

// Close modals on background click
editModal?.addEventListener('click', (e) => {
    if (e.target === editModal) closeEditModal();
});

deleteModal?.addEventListener('click', (e) => {
    if (e.target === deleteModal) closeDeleteModal();
});

// Utility functions
function showLoading() {
    loadingState.style.display = 'block';
    emptyState.style.display = 'none';
    productsTableContainer.style.display = 'none';
}

function hideLoading() {
    loadingState.style.display = 'none';
}

function showEmptyState() {
    emptyState.style.display = 'block';
    productsTableContainer.style.display = 'none';
}

function showProductsTable() {
    emptyState.style.display = 'none';
    productsTableContainer.style.display = 'block';
}

function showToast(message, type = 'info') {
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function formatPrice(price) {
    try {
        return Number(price).toLocaleString('vi-VN') + ' VND';
    } catch {
        return price + ' VND';
    }
}

function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    
    try {
        let date;
        if (timestamp.seconds) {
            date = new Date(timestamp.seconds * 1000);
        } else {
            date = new Date(timestamp);
        }
        
        if (isNaN(date)) return 'N/A';
        
        return date.toLocaleDateString('vi-VN');
    } catch {
        return 'N/A';
    }
}

function getCategoryName(categoryId) {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : 'Unknown';
}

function getCategorySlug(categoryId) {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.slug : '';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Make functions globally accessible
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.openDeleteModal = openDeleteModal;
window.closeDeleteModal = closeDeleteModal;
window.confirmDelete = confirmDelete;

