/**
 * Cart Script
 * Handles all cart operations with real-time updates from database
 */

import { getCurrentUser, getIdToken, showLoginRequiredModal } from './auth_manager.js';

const API_BASE = 'http://localhost:4000';

// DOM Elements
let loadingState;
let mainContent;
let cartItemsContainer;
let emptyCartState;
let cartItemCount;
let selectAllCount;
let summaryItemCount;
let summarySubtotal;
let summaryShipping;
let summaryTotal;
let checkoutCount;
let checkoutBtn;
let clearCartBtn;
let refreshCartBtn;
let selectAllCheckbox;

// Cart state
let currentCart = null;

/**
 * Initialize cart
 */
async function initCart() {
  // Get DOM elements
  loadingState = document.getElementById('loadingState');
  mainContent = document.getElementById('mainContent');
  cartItemsContainer = document.getElementById('cartItemsContainer');
  emptyCartState = document.getElementById('emptyCartState');
  cartItemCount = document.getElementById('cartItemCount');
  selectAllCount = document.getElementById('selectAllCount');
  summaryItemCount = document.getElementById('summaryItemCount');
  summarySubtotal = document.getElementById('summarySubtotal');
  summaryShipping = document.getElementById('summaryShipping');
  summaryTotal = document.getElementById('summaryTotal');
  checkoutCount = document.getElementById('checkoutCount');
  checkoutBtn = document.getElementById('checkoutBtn');
  clearCartBtn = document.getElementById('clearCartBtn');
  refreshCartBtn = document.getElementById('refreshCartBtn');
  selectAllCheckbox = document.getElementById('selectAllCheckbox');

  // Check authentication
  const user = getCurrentUser();
  if (!user) {
    showLoginRequiredModal('Please log in to view your cart');
    return;
  }

  // Attach event listeners
  if (clearCartBtn) {
    clearCartBtn.addEventListener('click', handleClearCart);
  }
  if (refreshCartBtn) {
    refreshCartBtn.addEventListener('click', () => loadCart());
  }
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', handleCheckout);
  }
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', handleSelectAll);
  }

  // Load cart
  await loadCart();
}

/**
 * Load cart from API
 */
async function loadCart() {
  try {
    showLoading();

    const user = getCurrentUser();
    if (!user) {
      showLoginRequiredModal('Please log in to view your cart');
      return;
    }

    const token = await getIdToken();
    const response = await fetch(`${API_BASE}/api/cart`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to load cart');
    }

    const cart = await response.json();
    currentCart = cart;

    // Render cart
    renderCart(cart);
    hideLoading();

  } catch (error) {
    console.error('Error loading cart:', error);
    showNotification('Failed to load cart. Please try again.', 'error');
    hideLoading();
  }
}

/**
 * Render cart items and summary
 */
function renderCart(cart) {
  if (!cart.items || cart.items.length === 0) {
    // Show empty state
    if (cartItemsContainer) cartItemsContainer.style.display = 'none';
    if (emptyCartState) emptyCartState.style.display = 'flex';
    updateOrderSummary(0, 0, 0);
    if (checkoutBtn) checkoutBtn.disabled = true;
    return;
  }

  // Hide empty state
  if (cartItemsContainer) cartItemsContainer.style.display = 'block';
  if (emptyCartState) emptyCartState.style.display = 'none';
  if (checkoutBtn) checkoutBtn.disabled = false;

  // Render items
  if (cartItemsContainer) {
    cartItemsContainer.innerHTML = cart.items.map(item => createCartItemHTML(item)).join('');
  }

  // Attach event listeners to cart items
  attachCartItemListeners();

  // Update summary
  updateOrderSummary(cart.subtotal, cart.total, cart.itemCount);
}

/**
 * Create HTML for a cart item
 */
function createCartItemHTML(item) {
  const product = item.product;
  const conditionClass = product.condition ? product.condition.toLowerCase().replace(/\s+/g, '-') : 'new';
  
  return `
    <div class="product_cart" data-product-id="${item.productId}">
      <div class="product_cart_img">
        <img src="${product.imageUrl || '/img/placeholder.svg'}" alt="${product.name}" onerror="this.src='/img/placeholder.svg'">
      </div>
      <div class="product_cart_info">
        <div class="product_cart_info_1">
          <h3 class="product_title">${product.name}</h3>
          <img src="/img/icon/icons8-trash-32.png" alt="Remove" class="remove-item-btn" data-product-id="${item.productId}">
        </div>
        <p>Sold by <span>${product.sellerName}</span></p>
        <span class="status_item_cart ${conditionClass}">${product.condition || 'New'}</span>
        <div class="product_cart_info_2">
          <p class="product_price">${formatPrice(product.price)} VND</p>
          <div class="quantity_btn">
            <button class="quantity_short" data-product-id="${item.productId}" ${item.quantity <= 1 ? 'disabled' : ''}>-</button>
            <input type="number" class="quantity_input" value="${item.quantity}" min="1" max="99" data-product-id="${item.productId}" readonly>
            <button class="quantity_long" data-product-id="${item.productId}" ${item.quantity >= 99 ? 'disabled' : ''}>+</button>
          </div>
        </div>
        <p class="item-total">Item Total: ${formatPrice(item.itemTotal)} VND</p>
      </div>
    </div>
  `;
}

/**
 * Attach event listeners to cart item controls
 */
function attachCartItemListeners() {
  // Remove buttons
  document.querySelectorAll('.remove-item-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const productId = e.target.dataset.productId;
      handleRemoveItem(productId);
    });
  });

  // Quantity decrease buttons
  document.querySelectorAll('.quantity_short').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const productId = e.target.dataset.productId;
      const input = document.querySelector(`.quantity_input[data-product-id="${productId}"]`);
      const currentQty = parseInt(input.value);
      if (currentQty > 1) {
        handleUpdateQuantity(productId, currentQty - 1);
      }
    });
  });

  // Quantity increase buttons
  document.querySelectorAll('.quantity_long').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const productId = e.target.dataset.productId;
      const input = document.querySelector(`.quantity_input[data-product-id="${productId}"]`);
      const currentQty = parseInt(input.value);
      if (currentQty < 99) {
        handleUpdateQuantity(productId, currentQty + 1);
      }
    });
  });
}

/**
 * Handle select all checkbox
 */
function handleSelectAll() {
  // This is a placeholder - implement if needed for future features
  // Currently items are always selected by default
}

/**
 * Handle update quantity
 */
async function handleUpdateQuantity(productId, newQuantity) {
  try {
    const user = getCurrentUser();
    if (!user) {
      showLoginRequiredModal('Please log in to update cart');
      return;
    }

    // Optimistic UI update
    const input = document.querySelector(`.quantity_input[data-product-id="${productId}"]`);
    const oldValue = input.value;
    input.value = newQuantity;

    const token = await getIdToken();
    const response = await fetch(`${API_BASE}/api/cart/item/${productId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ quantity: newQuantity })
    });

    if (!response.ok) {
      // Rollback on error
      input.value = oldValue;
      throw new Error('Failed to update quantity');
    }

    // Reload cart to get updated totals
    await loadCart();
    showNotification('Quantity updated', 'success');

  } catch (error) {
    console.error('Error updating quantity:', error);
    showNotification('Failed to update quantity', 'error');
  }
}

/**
 * Handle remove item
 */
async function handleRemoveItem(productId) {
  if (!confirm('Remove this item from cart?')) {
    return;
  }

  try {
    const user = getCurrentUser();
    if (!user) {
      showLoginRequiredModal('Please log in to modify cart');
      return;
    }

    // Add removing animation
    const itemEl = document.querySelector(`.product_cart[data-product-id="${productId}"]`);
    if (itemEl) {
      itemEl.classList.add('removing');
    }

    const token = await getIdToken();
    const response = await fetch(`${API_BASE}/api/cart/item/${productId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to remove item');
    }

    // Reload cart
    await loadCart();
    showNotification('Item removed from cart', 'success');

  } catch (error) {
    console.error('Error removing item:', error);
    showNotification('Failed to remove item', 'error');
    
    // Remove animation class on error
    const itemEl = document.querySelector(`.product_cart[data-product-id="${productId}"]`);
    if (itemEl) {
      itemEl.classList.remove('removing');
    }
  }
}

/**
 * Handle clear cart
 */
async function handleClearCart() {
  if (!confirm('Are you sure you want to clear your entire cart?')) {
    return;
  }

  try {
    const user = getCurrentUser();
    if (!user) {
      showLoginRequiredModal('Please log in to modify cart');
      return;
    }

    const token = await getIdToken();
    const response = await fetch(`${API_BASE}/api/cart`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to clear cart');
    }

    // Reload cart
    await loadCart();
    showNotification('Cart cleared', 'success');

  } catch (error) {
    console.error('Error clearing cart:', error);
    showNotification('Failed to clear cart', 'error');
  }
}

/**
 * Handle checkout
 */
function handleCheckout() {
  if (!currentCart || currentCart.items.length === 0) {
    showNotification('Your cart is empty', 'info');
    return;
  }

  // Redirect to checkout page
  window.location.href = '/pages/checkout.html';
}

/**
 * Update order summary
 */
function updateOrderSummary(subtotal, total, itemCount) {
  if (cartItemCount) {
    cartItemCount.textContent = `${itemCount} item${itemCount !== 1 ? 's' : ''} in your cart`;
  }
  if (selectAllCount) {
    selectAllCount.textContent = itemCount;
  }
  if (summaryItemCount) {
    summaryItemCount.textContent = itemCount;
  }
  if (summarySubtotal) {
    summarySubtotal.textContent = formatPrice(subtotal);
  }
  if (summaryTotal) {
    summaryTotal.textContent = formatPrice(total);
  }
  if (checkoutCount) {
    checkoutCount.textContent = `(${itemCount})`;
  }
}

/**
 * Show loading state
 */
function showLoading() {
  if (loadingState) loadingState.style.display = 'flex';
  if (mainContent) mainContent.style.display = 'none';
}

/**
 * Hide loading state
 */
function hideLoading() {
  if (loadingState) loadingState.style.display = 'none';
  if (mainContent) mainContent.style.display = 'block';
}

/**
 * Show toast notification
 * Creates notification dynamically if it doesn't exist (for use on any page)
 */
function showNotification(message, type = 'info') {
  let toast = document.getElementById('toastNotification');
  let toastMessage = document.getElementById('toastMessage');

  // If toast doesn't exist, create it dynamically
  if (!toast) {
    const toastHTML = `
      <div id="toastNotification" class="toast-notification">
        <div class="toast-content">
          <span id="toastMessage"></span>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', toastHTML);
    
    toast = document.getElementById('toastNotification');
    toastMessage = document.getElementById('toastMessage');
  }

  toastMessage.textContent = message;
  toast.className = `toast-notification ${type} show`;

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

/**
 * Format price with thousand separators
 */
function formatPrice(price) {
  return Number(price).toLocaleString('vi-VN');
}

/**
 * Add item to cart (for use from product pages)
 */
export async function addToCart(productId, quantity = 1) {
  try {
    const user = getCurrentUser();
    if (!user) {
      showLoginRequiredModal('Please log in to add items to cart');
      return false;
    }

    const token = await getIdToken();
    const response = await fetch(`${API_BASE}/api/cart/add`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ productId, quantity })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to add to cart');
    }

    showNotification('Item added to cart successfully!', 'success');
    return true;

  } catch (error) {
    console.error('Error adding to cart:', error);
    showNotification(error.message || 'Failed to add to cart', 'error');
    return false;
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  // Wait for auth to be ready
  setTimeout(() => {
    initCart();
  }, 500);
});

// Export functions for use in other modules
export { loadCart, showNotification };
