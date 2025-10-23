// Sell Product - Form Functionality
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

// State
let currentUser = null;
let categories = [];

// DOM Elements
const categorySelect = document.getElementById('productCategory');
const conditionSelect = document.getElementById('productCondition');
const titleInput = document.getElementById('productTitle');
const priceInput = document.getElementById('productPrice');
const imageUrlInput = document.getElementById('productImageUrl');
const descriptionTextarea = document.getElementById('productDescription');
const charCount = document.getElementById('charCount');
const submitBtn = document.getElementById('submitProductBtn');
const cancelBtn = document.getElementById('cancelProductBtn');
const messageContainer = document.getElementById('messageContainer');

// Authentication check
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        await init();
    } else {
        // Redirect to login
        showMessage('Please login to sell products', 'error');
        setTimeout(() => {
            window.location.href = '/pages/login_page.html';
        }, 2000);
    }
});

// Initialize
async function init() {
    try {
        await fetchCategories();
        setupEventListeners();
    } catch (error) {
        console.error('Initialization error:', error);
        showMessage('Failed to load form. Please refresh the page.', 'error');
    }
}

// Fetch categories from API
async function fetchCategories() {
    try {
        const response = await fetch(`${API_BASE}/metadata/categories`);
        if (!response.ok) throw new Error('Failed to fetch categories');
        
        categories = await response.json();
        populateCategoryDropdown();
    } catch (error) {
        console.error('Error fetching categories:', error);
        showMessage('Failed to load categories', 'error');
    }
}

// Populate category dropdown
function populateCategoryDropdown() {
    if (!categorySelect) return;
    
    // Clear existing options except the first one
    categorySelect.innerHTML = '<option value="">Select Category</option>';
    
    // Add categories from API
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.slug;
        option.textContent = cat.name;
        categorySelect.appendChild(option);
    });
}

// Setup event listeners
function setupEventListeners() {
    // Character counter for description
    if (descriptionTextarea && charCount) {
        descriptionTextarea.addEventListener('input', updateCharCount);
        updateCharCount(); // Initialize
    }
    
    // Form submission
    if (submitBtn) {
        submitBtn.addEventListener('click', handleSubmit);
    }
    
    // Cancel button
    if (cancelBtn) {
        cancelBtn.addEventListener('click', handleCancel);
    }
}

// Update character count
function updateCharCount() {
    const currentLength = descriptionTextarea.value.length;
    const maxLength = 500;
    charCount.textContent = `${currentLength}/${maxLength} characters`;
    
    if (currentLength > maxLength) {
        charCount.style.color = '#ef4444';
    } else {
        charCount.style.color = '#9ca3af';
    }
}

// Validate form
function validateForm() {
    const errors = [];
    
    // Product Title
    if (!titleInput.value.trim()) {
        errors.push('Product title is required');
    }
    
    // Category
    if (!categorySelect.value) {
        errors.push('Please select a category');
    }
    
    // Condition
    if (!conditionSelect.value || conditionSelect.value === 'condition') {
        errors.push('Please select product condition');
    }
    
    // Price
    const price = parseFloat(priceInput.value);
    if (!priceInput.value || isNaN(price) || price <= 0) {
        errors.push('Please enter a valid price greater than 0');
    }
    
    // Image URL
    if (!imageUrlInput.value.trim()) {
        errors.push('Image URL is required');
    } else if (!isValidUrl(imageUrlInput.value.trim())) {
        errors.push('Please enter a valid image URL (starting with http:// or https://)');
    }
    
    // Description
    if (!descriptionTextarea.value.trim()) {
        errors.push('Product description is required');
    } else if (descriptionTextarea.value.length > 500) {
        errors.push('Description must not exceed 500 characters');
    }
    
    return errors;
}

// Validate URL
function isValidUrl(string) {
    try {
        const url = new URL(string);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

// Handle form submission
async function handleSubmit(e) {
    e.preventDefault();
    
    // Clear previous messages
    hideMessage();
    
    // Validate form
    const errors = validateForm();
    if (errors.length > 0) {
        showMessage('Please fix the following errors:', 'error', errors);
        return;
    }
    
    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loading-spinner"></span> Listing Product...';
    
    try {
        // Prepare product data
        const productData = {
            name: titleInput.value.trim(),
            categorySlug: categorySelect.value,
            condition: conditionSelect.value,
            price: parseFloat(priceInput.value),
            quantity: 1, // Default quantity
            location: 'Vietnam', // Default location, could be made dynamic
            imageUrl: imageUrlInput.value.trim(),
            description: descriptionTextarea.value.trim(),
            status: 'available'
        };
        
        // Get user token
        const idToken = await currentUser.getIdToken();
        
        // Submit to API
        const response = await fetch(`${API_BASE}/products/customer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify(productData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || error.errors || 'Failed to create product');
        }
        
        const result = await response.json();
        console.log('Product created:', result);
        
        // Show success message
        showMessage('Product listed successfully! Redirecting to your products...', 'success');
        
        // Redirect to customer products page after 2 seconds
        setTimeout(() => {
            window.location.href = '/pages/customer_products.html';
        }, 2000);
        
    } catch (error) {
        console.error('Error creating product:', error);
        
        // Handle validation errors
        if (error.message.includes('errors')) {
            try {
                const errorObj = JSON.parse(error.message);
                const errorList = Object.values(errorObj.errors || {});
                showMessage('Validation failed:', 'error', errorList);
            } catch {
                showMessage(error.message || 'Failed to list product. Please try again.', 'error');
            }
        } else {
            showMessage(error.message || 'Failed to list product. Please try again.', 'error');
        }
        
        // Re-enable submit button
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'List My Item';
    }
}

// Handle cancel
function handleCancel(e) {
    e.preventDefault();
    
    if (confirm('Are you sure you want to cancel? All entered data will be lost.')) {
        // Clear form
        if (titleInput) titleInput.value = '';
        if (categorySelect) categorySelect.value = '';
        if (conditionSelect) conditionSelect.value = 'condition';
        if (priceInput) priceInput.value = '';
        if (imageUrlInput) imageUrlInput.value = '';
        if (descriptionTextarea) descriptionTextarea.value = '';
        updateCharCount();
        
        // Redirect to home or products page
        window.location.href = '/pages/index.html';
    }
}

// Show message
function showMessage(message, type = 'info', errorList = []) {
    if (!messageContainer) {
        // Create message container if it doesn't exist
        const container = document.createElement('div');
        container.id = 'messageContainer';
        container.className = 'message-container';
        const seller3 = document.querySelector('.seller_3');
        if (seller3) {
            seller3.insertBefore(container, seller3.firstChild);
        }
    }
    
    const container = document.getElementById('messageContainer') || messageContainer;
    
    let html = `<div class="message ${type}">${message}`;
    
    if (errorList.length > 0) {
        html += '<ul>';
        errorList.forEach(err => {
            html += `<li>${err}</li>`;
        });
        html += '</ul>';
    }
    
    html += '</div>';
    
    container.innerHTML = html;
    container.style.display = 'block';
    
    // Scroll to message
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Hide message
function hideMessage() {
    if (messageContainer) {
        messageContainer.innerHTML = '';
        messageContainer.style.display = 'none';
    }
}

// Export functions for inline event handlers if needed
window.handleSubmit = handleSubmit;
window.handleCancel = handleCancel;

