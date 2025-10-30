/**
 * Seller Orders Management
 * Handles seller dashboard functionality for managing sales
 */

import { initAuth, getCurrentUser, getIdToken, onAuthReady } from './auth_manager.js';

const API_BASE = 'http://localhost:4000';

// State
let allOrders = [];
let currentFilter = 'all';
let currentOrderId = null;

// DOM Elements
let loadingState, emptyState, ordersGrid;

/**
 * Initialize seller orders page
 */
async function init() {
    // Initialize Firebase auth
    initAuth();

    // Wait for auth
    onAuthReady(async (user) => {
        if (!user) {
            alert('Please log in to view your sales');
            window.location.href = '/pages/login_page.html';
            return;
        }

        // Get DOM elements
        loadingState = document.getElementById('loadingState');
        emptyState = document.getElementById('emptyState');
        ordersGrid = document.getElementById('ordersGrid');

        // Setup event listeners
        setupTabListeners();

        // Load orders
        await loadOrders();
    });
}

/**
 * Setup tab click listeners
 */
function setupTabListeners() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Update active state
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Filter orders
            currentFilter = tab.dataset.status;
            filterOrders();
        });
    });
}

/**
 * Load orders from API
 */
async function loadOrders() {
    try {
        showLoading();

        const token = await getIdToken();
        const response = await fetch(`${API_BASE}/api/orders/seller/my-sales`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load orders');
        }

        const data = await response.json();
        allOrders = data.orders || [];

        // Update tab badges
        updateTabBadges();

        // Render filtered orders
        filterOrders();

    } catch (error) {
        console.error('Error loading orders:', error);
        showToast('Failed to load orders. Please try again.', 'error');
        showEmpty();
    }
}

/**
 * Update tab badge counts
 */
function updateTabBadges() {
    const counts = {
        all: allOrders.length,
        paid: allOrders.filter(o => o.orderStatus === 'paid').length,
        processing: allOrders.filter(o => o.orderStatus === 'processing').length,
        delivered: allOrders.filter(o => o.orderStatus === 'delivered').length,
        completed: allOrders.filter(o => o.orderStatus === 'completed').length,
        cancelled: allOrders.filter(o => o.orderStatus === 'cancelled').length
    };

    Object.keys(counts).forEach(status => {
        const badge = document.getElementById(`count${status.charAt(0).toUpperCase() + status.slice(1)}`);
        if (badge) badge.textContent = counts[status];
    });
}

/**
 * Filter and render orders
 */
function filterOrders() {
    let filtered = allOrders;

    if (currentFilter !== 'all') {
        filtered = allOrders.filter(order => order.orderStatus === currentFilter);
    }

    if (filtered.length === 0) {
        showEmpty();
    } else {
        renderOrders(filtered);
    }
}

/**
 * Render orders
 */
function renderOrders(orders) {
    hideLoading();
    emptyState.style.display = 'none';
    ordersGrid.style.display = 'grid';

    ordersGrid.innerHTML = orders.map(order => createOrderCard(order)).join('');
}

/**
 * Create order card HTML
 */
function createOrderCard(order) {
    const statusClass = order.orderStatus || 'pending';
    const statusText = formatStatus(order.orderStatus);
    const date = formatDate(order.createdAt);
    const price = formatPrice(order.totalAmount);

    // Determine available actions based on status
    let actions = '';
    if (order.orderStatus === 'paid') {
        actions = `
            <button class="btn btn-primary" onclick="acceptOrder('${order.id}')">Accept Order</button>
            <button class="btn btn-outline" onclick="openOrderDetail('${order.id}')">View Details</button>
            <button class="btn btn-secondary btn-small" onclick="openCancelModal('${order.id}')">Cancel</button>
        `;
    } else if (order.orderStatus === 'processing') {
        actions = `
            <button class="btn btn-primary" onclick="openDeliverModal('${order.id}')">Mark Delivered</button>
            <button class="btn btn-outline" onclick="openOrderDetail('${order.id}')">View Details</button>
            <button class="btn btn-secondary btn-small" onclick="openCancelModal('${order.id}')">Cancel</button>
        `;
    } else {
        actions = `
            <button class="btn btn-outline" onclick="openOrderDetail('${order.id}')">View Details</button>
        `;
    }

    return `
        <div class="order-card">
            <div class="order-card-header">
                <div class="order-id">
                    <strong>Order #</strong>${order.id.substring(0, 8)}...
                </div>
                <span class="status-badge ${statusClass}">${statusText}</span>
            </div>
            
            <div class="order-card-body">
                <div class="order-product">
                    <img src="${order.productImageUrl || '/img/placeholder.svg'}" 
                         alt="${order.productName}" 
                         class="order-product-image"
                         onerror="this.src='/img/placeholder.svg'">
                    <div class="order-product-info">
                        <h3>${order.productName}</h3>
                        <div class="order-product-meta">Qty: ${order.quantity}</div>
                        <div class="order-product-price">${price}</div>
                    </div>
                </div>
                
                <div class="order-info-row">
                    <span class="order-info-label">Buyer:</span>
                    <span class="order-info-value">${order.shippingAddress?.fullName || 'N/A'}</span>
                </div>
                <div class="order-info-row">
                    <span class="order-info-label">Order Date:</span>
                    <span class="order-info-value">${date}</span>
                </div>
            </div>
            
            <div class="order-card-footer">
                ${actions}
            </div>
        </div>
    `;
}

/**
 * Accept order
 */
window.acceptOrder = async function(orderId) {
    try {
        const btn = event.target;
        btn.disabled = true;
        btn.textContent = 'Processing...';

        const token = await getIdToken();
        const response = await fetch(`${API_BASE}/api/orders/${orderId}/seller/accept`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to accept order');
        }

        showToast('Order accepted successfully!', 'success');
        await loadOrders();

    } catch (error) {
        console.error('Error accepting order:', error);
        showToast(error.message || 'Failed to accept order', 'error');
        event.target.disabled = false;
        event.target.textContent = 'Accept Order';
    }
};

/**
 * Open deliver modal
 */
window.openDeliverModal = function(orderId) {
    currentOrderId = orderId;
    document.getElementById('deliveryNotes').value = '';
    document.getElementById('deliverModal').classList.add('show');
};

/**
 * Close deliver modal
 */
window.closeDeliverModal = function() {
    document.getElementById('deliverModal').classList.remove('show');
    currentOrderId = null;
};

/**
 * Confirm deliver
 */
window.confirmDeliver = async function() {
    try {
        const btn = document.getElementById('confirmDeliverBtn');
        btn.disabled = true;
        btn.textContent = 'Processing...';

        const notes = document.getElementById('deliveryNotes').value.trim();
        const token = await getIdToken();

        const response = await fetch(`${API_BASE}/api/orders/${currentOrderId}/seller/deliver`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ notes })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to mark as delivered');
        }

        closeDeliverModal();
        showToast('Order marked as delivered!', 'success');
        await loadOrders();

    } catch (error) {
        console.error('Error marking delivered:', error);
        showToast(error.message || 'Failed to mark as delivered', 'error');
        document.getElementById('confirmDeliverBtn').disabled = false;
        document.getElementById('confirmDeliverBtn').textContent = 'Mark as Delivered';
    }
};

/**
 * Open cancel modal
 */
window.openCancelModal = function(orderId) {
    currentOrderId = orderId;
    document.getElementById('cancellationReason').value = '';
    document.getElementById('cancelModal').classList.add('show');
};

/**
 * Close cancel modal
 */
window.closeCancelModal = function() {
    document.getElementById('cancelModal').classList.remove('show');
    currentOrderId = null;
};

/**
 * Confirm cancel
 */
window.confirmCancel = async function() {
    try {
        const reason = document.getElementById('cancellationReason').value.trim();
        if (!reason) {
            showToast('Please provide a cancellation reason', 'error');
            return;
        }

        const btn = document.getElementById('confirmCancelBtn');
        btn.disabled = true;
        btn.textContent = 'Cancelling...';

        const token = await getIdToken();
        const response = await fetch(`${API_BASE}/api/orders/${currentOrderId}/seller/cancel`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to cancel order');
        }

        closeCancelModal();
        showToast('Order cancelled successfully', 'success');
        await loadOrders();

    } catch (error) {
        console.error('Error cancelling order:', error);
        showToast(error.message || 'Failed to cancel order', 'error');
        document.getElementById('confirmCancelBtn').disabled = false;
        document.getElementById('confirmCancelBtn').textContent = 'Cancel Order';
    }
};

/**
 * Open order detail modal
 */
window.openOrderDetail = function(orderId) {
    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;

    const modalBody = document.getElementById('orderDetailBody');
    modalBody.innerHTML = createOrderDetailHTML(order);
    document.getElementById('orderDetailModal').classList.add('show');
};

/**
 * Close order detail modal
 */
window.closeOrderDetailModal = function() {
    document.getElementById('orderDetailModal').classList.remove('show');
};

/**
 * Create order detail HTML
 */
function createOrderDetailHTML(order) {
    const statusHistory = order.statusHistory || [];
    const timelineHTML = statusHistory.map((item, index) => {
        const isCompleted = index < statusHistory.length - 1 || order.orderStatus === 'completed';
        return `
            <div class="timeline-item ${isCompleted ? 'completed' : ''}">
                <div class="timeline-dot">${isCompleted ? '✓' : '○'}</div>
                <div class="timeline-content">
                    <div class="timeline-title">${formatStatus(item.status)}</div>
                    <div class="timeline-meta">${formatDate(item.changedAt)}</div>
                    ${item.notes ? `<div class="timeline-notes">${item.notes}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="detail-section">
            <h3>Product Information</h3>
            <div class="detail-grid">
                <div class="detail-item">
                    <span class="detail-label">Product Name</span>
                    <span class="detail-value">${order.productName}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Quantity</span>
                    <span class="detail-value">${order.quantity}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Unit Price</span>
                    <span class="detail-value">${formatPrice(order.productPrice)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Total Amount</span>
                    <span class="detail-value">${formatPrice(order.totalAmount)}</span>
                </div>
            </div>
        </div>

        <div class="detail-divider"></div>

        <div class="detail-section">
            <h3>Buyer Information</h3>
            <div class="detail-grid">
                <div class="detail-item">
                    <span class="detail-label">Full Name</span>
                    <span class="detail-value">${order.shippingAddress?.fullName || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Phone</span>
                    <span class="detail-value">${order.shippingAddress?.phone || 'N/A'}</span>
                </div>
            </div>
            <div class="detail-item" style="margin-top: 12px;">
                <span class="detail-label">Shipping Address</span>
                <span class="detail-value">${order.shippingAddress?.address || 'N/A'}</span>
            </div>
        </div>

        <div class="detail-divider"></div>

        <div class="detail-section">
            <h3>Order Timeline</h3>
            <div class="status-timeline">
                ${timelineHTML}
            </div>
        </div>
    `;
}

/**
 * Show loading state
 */
function showLoading() {
    loadingState.style.display = 'flex';
    emptyState.style.display = 'none';
    ordersGrid.style.display = 'none';
}

/**
 * Hide loading state
 */
function hideLoading() {
    loadingState.style.display = 'none';
}

/**
 * Show empty state
 */
function showEmpty() {
    hideLoading();
    emptyState.style.display = 'flex';
    ordersGrid.style.display = 'none';
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

/**
 * Format price
 */
function formatPrice(price) {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(price);
}

/**
 * Format date
 */
function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    
    let date;
    if (timestamp.seconds) {
        date = new Date(timestamp.seconds * 1000);
    } else if (timestamp._seconds) {
        date = new Date(timestamp._seconds * 1000);
    } else {
        date = new Date(timestamp);
    }
    
    return date.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Format status
 */
function formatStatus(status) {
    const statusMap = {
        'pending': 'Pending Payment',
        'paid': 'Paid',
        'processing': 'Processing',
        'delivered': 'Delivered',
        'completed': 'Completed',
        'cancelled': 'Cancelled'
    };
    return statusMap[status] || status;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);

