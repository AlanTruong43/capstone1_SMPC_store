/**
 * Ratings and Reviews Management
 * Handles all rating and review functionality
 */

import { getIdToken, getCurrentUser, onAuthReady } from './auth_manager.js';

const API_BASE = 'http://localhost:4000';

// State
let currentProductId = null;
let currentUserId = null;
let currentPage = 1;
let currentSort = 'newest';
let currentFilter = null;
let ratingStats = null;
let ratingEligibility = null;

// DOM Elements (will be initialized)
let ratingsSection = null;
let ratingSummary = null;
let ratingsList = null;
let writeReviewBtn = null;
let sortSelect = null;
let filterSelect = null;
let paginationContainer = null;
let reviewModal = null;
let reportModal = null;

/**
 * Initialize ratings module
 * @param {string} productId - Product ID
 */
async function initRatings(productId) {
    currentProductId = productId;
    
    // Get DOM elements from window (set by product_details.html)
    ratingsSection = window.ratingsSection || document.getElementById('ratingsSection');
    ratingSummary = window.ratingSummary || document.getElementById('ratingSummary');
    ratingsList = window.ratingsList || document.getElementById('ratingsList');
    writeReviewBtn = window.writeReviewBtn || document.getElementById('writeReviewBtn');
    sortSelect = window.sortSelect || document.getElementById('sortSelect');
    filterSelect = window.filterSelect || document.getElementById('filterSelect');
    paginationContainer = window.paginationContainer || document.getElementById('paginationContainer');
    reviewModal = window.reviewModal || document.getElementById('reviewModal');
    reportModal = window.reportModal || document.getElementById('reportModal');
    
    // Wait for auth to be ready
    onAuthReady(async (user) => {
        currentUserId = user ? user.uid : null;
        await loadRatingEligibility();
    });
    
    await loadRatingStats();
    await loadRatings();
}

/**
 * Load rating statistics for product
 */
async function loadRatingStats() {
    try {
        const response = await fetch(`${API_BASE}/api/ratings/product/${currentProductId}/stats`);
        const data = await response.json();
        
        if (data.success) {
            ratingStats = data.stats;
            renderRatingSummary();
        }
    } catch (error) {
        console.error('Error loading rating stats:', error);
    }
}

/**
 * Load rating eligibility for current user
 */
async function loadRatingEligibility() {
    if (!currentUserId) {
        ratingEligibility = { eligible: false, hasPurchase: false, hasRated: false };
        updateWriteReviewButton();
        return;
    }
    
    try {
        const token = await getIdToken();
        const response = await fetch(`${API_BASE}/api/ratings/product/${currentProductId}/check-eligible`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await response.json();
        
        if (data.success) {
            ratingEligibility = data;
            updateWriteReviewButton();
        }
    } catch (error) {
        console.error('Error loading rating eligibility:', error);
    }
}

/**
 * Load ratings for product
 */
async function loadRatings() {
    if (!ratingsList) return;
    
    try {
        ratingsList.innerHTML = '<div class="ratings-loading">Loading reviews...</div>';
        
        const params = new URLSearchParams({
            page: currentPage,
            limit: 10,
            sort: currentSort
        });
        
        if (currentFilter) {
            params.append('filter', currentFilter);
        }
        
        const response = await fetch(`${API_BASE}/api/ratings/product/${currentProductId}?${params}`);
        const data = await response.json();
        
        if (data.success) {
            renderRatings(data.ratings);
            renderPagination(data.pagination);
        } else {
            ratingsList.innerHTML = '<div class="empty-ratings"><div class="empty-ratings-text">Failed to load reviews</div></div>';
        }
    } catch (error) {
        console.error('Error loading ratings:', error);
        ratingsList.innerHTML = '<div class="empty-ratings"><div class="empty-ratings-text">Error loading reviews</div></div>';
    }
}

/**
 * Render rating summary
 */
function renderRatingSummary() {
    if (!ratingSummary || !ratingStats) return;
    
    const { averageRating, ratingCount, ratingDistribution } = ratingStats;
    
    const starsHTML = renderStars(averageRating, true);
    const distributionHTML = Object.keys(ratingDistribution)
        .sort((a, b) => parseInt(b) - parseInt(a))
        .map(star => {
            const count = ratingDistribution[star];
            const percentage = ratingCount > 0 ? (count / ratingCount) * 100 : 0;
            return `
                <div class="rating-distribution-item">
                    <div class="rating-distribution-label">
                        ${star} <span>★</span>
                    </div>
                    <div class="rating-distribution-bar">
                        <div class="rating-distribution-fill" style="width: ${percentage}%"></div>
                    </div>
                    <div class="rating-distribution-count">${count}</div>
                </div>
            `;
        }).join('');
    
    ratingSummary.innerHTML = `
        <div class="rating-average">
            <div class="rating-average-value">${averageRating.toFixed(1)}</div>
            <div class="rating-average-stars">${starsHTML}</div>
            <div class="rating-average-count">${ratingCount} ${ratingCount === 1 ? 'review' : 'reviews'}</div>
        </div>
        <div class="rating-distribution">
            ${distributionHTML}
        </div>
    `;
}

/**
 * Render ratings list
 */
function renderRatings(ratings) {
    if (!ratingsList) return;
    
    if (ratings.length === 0) {
        ratingsList.innerHTML = `
            <div class="empty-ratings">
                <div class="empty-ratings-icon">⭐</div>
                <div class="empty-ratings-text">No reviews yet</div>
                <div class="empty-ratings-subtext">Be the first to review this product!</div>
            </div>
        `;
        return;
    }
    
    ratingsList.innerHTML = ratings.map(rating => renderRatingItem(rating)).join('');
    
    // Attach event listeners
    attachRatingEventListeners();
}

/**
 * Render single rating item
 */
function renderRatingItem(rating) {
    const starsHTML = renderStars(rating.star, false);
    const date = formatDate(rating.createdAt);
    const isOwnRating = currentUserId && rating.userId === currentUserId;
    
    let actionsHTML = '';
    if (isOwnRating) {
        actionsHTML = `
            <button class="rating-action-btn" onclick="editRating('${rating.id}')">Edit</button>
            <button class="rating-action-btn" onclick="deleteRating('${rating.id}')">Delete</button>
        `;
    } else if (currentUserId) {
        actionsHTML = `
            <button class="rating-action-btn report" onclick="openReportModal('${rating.id}')">Report</button>
        `;
    }
    
    const sellerReplyHTML = rating.sellerReply ? `
        <div class="seller-reply">
            <div class="seller-reply-header">
                <div class="seller-reply-label">Seller Response</div>
                <div class="seller-reply-date">${formatDate(rating.sellerReply.repliedAt)}</div>
            </div>
            <div class="seller-reply-comment">${escapeHtml(rating.sellerReply.comment)}</div>
        </div>
    ` : '';
    
    // Get user name - use userName if available, otherwise fallback to userId
    const displayName = rating.userName || rating.displayName || `User ${rating.userId.substring(0, 8)}`;
    
    return `
        <div class="rating-item" data-rating-id="${rating.id}">
            <div class="rating-item-header">
                <div class="rating-user-info">
                    <div class="rating-user-avatar">${getInitials(displayName)}</div>
                    <div class="rating-user-details">
                        <div class="rating-user-name">${escapeHtml(displayName)}</div>
                        <div class="rating-verified-badge">
                            <span>✓</span> Verified Purchase
                        </div>
                    </div>
                </div>
                <div class="rating-stars-display">${starsHTML}</div>
            </div>
            <div class="rating-date">${date}</div>
            ${rating.comment ? `<div class="rating-comment">${escapeHtml(rating.comment)}</div>` : ''}
            ${sellerReplyHTML}
            ${actionsHTML ? `<div class="rating-actions">${actionsHTML}</div>` : ''}
        </div>
    `;
}

/**
 * Render stars
 */
function renderStars(rating, large = false) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    const size = large ? 24 : 16;
    
    let starsHTML = '';
    for (let i = 0; i < fullStars; i++) {
        starsHTML += `<svg class="star-icon" width="${size}" height="${size}" viewBox="0 0 24 24"><path class="star-filled" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
    }
    if (hasHalfStar) {
        starsHTML += `<svg class="star-icon" width="${size}" height="${size}" viewBox="0 0 24 24"><path class="star-filled" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
    }
    for (let i = 0; i < emptyStars; i++) {
        starsHTML += `<svg class="star-icon" width="${size}" height="${size}" viewBox="0 0 24 24"><path class="star-empty" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
    }
    
    return starsHTML;
}

/**
 * Render pagination
 */
function renderPagination(pagination) {
    if (!paginationContainer) return;
    
    const { page, totalPages, total } = pagination;
    
    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }
    
    paginationContainer.innerHTML = `
        <button class="pagination-btn" onclick="changePage(${page - 1})" ${page === 1 ? 'disabled' : ''}>
            Previous
        </button>
        <div class="pagination-info">
            Page ${page} of ${totalPages} (${total} reviews)
        </div>
        <button class="pagination-btn" onclick="changePage(${page + 1})" ${page === totalPages ? 'disabled' : ''}>
            Next
        </button>
    `;
}

/**
 * Update write review button state
 */
function updateWriteReviewButton() {
    if (!writeReviewBtn) return;
    
    if (!currentUserId) {
        writeReviewBtn.style.display = 'none';
        return;
    }
    
    if (ratingEligibility?.eligible) {
        writeReviewBtn.style.display = 'block';
        writeReviewBtn.disabled = false;
        writeReviewBtn.onclick = () => openReviewModal();
    } else if (ratingEligibility?.hasRated) {
        writeReviewBtn.style.display = 'none';
    } else {
        writeReviewBtn.style.display = 'none';
    }
}

/**
 * Change page
 */
function changePage(page) {
    currentPage = page;
    loadRatings();
    // Scroll to ratings section
    if (ratingsSection) {
        ratingsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

/**
 * Change sort
 */
function changeSort(sort) {
    currentSort = sort;
    currentPage = 1;
    loadRatings();
}

/**
 * Change filter
 */
function changeFilter(filter) {
    currentFilter = filter === 'all' ? null : filter;
    currentPage = 1;
    loadRatings();
}

/**
 * Open review modal
 */
async function openReviewModal() {
    if (!reviewModal) return;
    
    // Get order ID from eligibility
    if (!ratingEligibility?.orderId) {
        alert('Unable to verify purchase. Please try again.');
        return;
    }
    
    reviewModal.classList.add('active');
    
    // Reset form
    const form = reviewModal.querySelector('.review-form');
    if (form) {
        form.reset();
        // Reset star rating - make all gray
        const starInputs = form.querySelectorAll('.star-input-btn');
        starInputs.forEach(btn => {
            btn.classList.remove('selected');
            const starIcon = btn.querySelector('.star-input-icon');
            if (starIcon) {
                starIcon.style.fill = '#d1d5db';
                starIcon.style.stroke = '#9ca3af';
            }
        });
    }
}

/**
 * Close review modal
 */
function closeReviewModal() {
    if (reviewModal) {
        reviewModal.classList.remove('active');
    }
}

/**
 * Submit review
 */
async function submitReview() {
    const form = document.getElementById('reviewForm');
    if (!form) return;
    
    const formData = new FormData(form);
    const star = parseInt(formData.get('star'));
    const comment = formData.get('comment') || '';
    
    if (!star || star < 1 || star > 5) {
        alert('Please select a star rating');
        return;
    }
    
    if (!ratingEligibility?.orderId) {
        alert('Unable to verify purchase');
        return;
    }
    
    try {
        const token = await getIdToken();
        const response = await fetch(`${API_BASE}/api/ratings`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                productId: currentProductId,
                orderId: ratingEligibility.orderId,
                star: star,
                comment: comment
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeReviewModal();
            // Reload ratings and stats
            await loadRatingStats();
            await loadRatingEligibility();
            await loadRatings();
            alert('Review submitted successfully!');
        } else {
            alert(data.error || 'Failed to submit review');
        }
    } catch (error) {
        console.error('Error submitting review:', error);
        alert('Error submitting review. Please try again.');
    }
}

/**
 * Set star rating in form
 */
function setStarRating(rating) {
    const form = document.getElementById('reviewForm');
    if (!form) return;
    
    const starInput = form.querySelector('input[name="star"]');
    if (starInput) {
        starInput.value = rating;
    }
    
    // Update visual stars - make selected and all previous stars yellow
    const starInputs = form.querySelectorAll('.star-input-btn');
    starInputs.forEach((btn, index) => {
        const starIcon = btn.querySelector('.star-input-icon');
        if (index < rating) {
            btn.classList.add('selected');
            if (starIcon) {
                starIcon.style.fill = '#fbbf24';
                starIcon.style.stroke = '#f59e0b';
            }
        } else {
            btn.classList.remove('selected');
            if (starIcon) {
                starIcon.style.fill = '#d1d5db';
                starIcon.style.stroke = '#9ca3af';
            }
        }
    });
}

/**
 * Handle star hover for preview
 */
function handleStarHover(rating) {
    const form = document.getElementById('reviewForm');
    if (!form) return;
    
    const starInputs = form.querySelectorAll('.star-input-btn');
    const currentRating = parseInt(form.querySelector('input[name="star"]')?.value || '0');
    
    // If no rating is selected, show preview on hover
    if (currentRating === 0) {
        starInputs.forEach((btn, index) => {
            const starIcon = btn.querySelector('.star-input-icon');
            if (starIcon) {
                if (index < rating) {
                    // Make all stars up to hovered one yellow
                    starIcon.style.fill = '#fbbf24';
                    starIcon.style.stroke = '#f59e0b';
                } else {
                    // Keep remaining stars gray
                    starIcon.style.fill = '#d1d5db';
                    starIcon.style.stroke = '#9ca3af';
                }
            }
        });
    }
}

/**
 * Handle star mouse leave - restore selected rating
 */
function handleStarLeave() {
    const form = document.getElementById('reviewForm');
    if (!form) return;
    
    const currentRating = parseInt(form.querySelector('input[name="star"]')?.value || '0');
    if (currentRating > 0) {
        setStarRating(currentRating);
    } else {
        // Reset all to gray if no rating selected
        const starInputs = form.querySelectorAll('.star-input-btn');
        starInputs.forEach((btn) => {
            const starIcon = btn.querySelector('.star-input-icon');
            if (starIcon) {
                starIcon.style.fill = '#d1d5db';
                starIcon.style.stroke = '#9ca3af';
            }
        });
    }
}

/**
 * Edit rating
 */
async function editRating(ratingId) {
    // Load rating data
    try {
        const response = await fetch(`${API_BASE}/api/ratings/${ratingId}`);
        const data = await response.json();
        
        if (data.success) {
            const rating = data.rating;
            openReviewModal();
            
            // Pre-fill form
            setTimeout(() => {
                setStarRating(rating.star);
                const commentField = document.getElementById('reviewComment');
                if (commentField) {
                    commentField.value = rating.comment || '';
                }
                
                // Change submit handler to update instead of create
                const submitBtn = document.querySelector('.review-form-btn.submit');
                if (submitBtn) {
                    submitBtn.onclick = () => updateRating(ratingId);
                    submitBtn.textContent = 'Update Review';
                }
            }, 100);
        }
    } catch (error) {
        console.error('Error loading rating:', error);
        alert('Error loading rating');
    }
}

/**
 * Update rating
 */
async function updateRating(ratingId) {
    const form = document.getElementById('reviewForm');
    if (!form) return;
    
    const formData = new FormData(form);
    const star = parseInt(formData.get('star'));
    const comment = formData.get('comment') || '';
    
    if (!star || star < 1 || star > 5) {
        alert('Please select a star rating');
        return;
    }
    
    try {
        const token = await getIdToken();
        const response = await fetch(`${API_BASE}/api/ratings/${ratingId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                star: star,
                comment: comment
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeReviewModal();
            await loadRatingStats();
            await loadRatings();
            alert('Review updated successfully!');
        } else {
            alert(data.error || 'Failed to update review');
        }
    } catch (error) {
        console.error('Error updating review:', error);
        alert('Error updating review. Please try again.');
    }
}

/**
 * Delete rating
 */
async function deleteRating(ratingId) {
    if (!confirm('Are you sure you want to delete your review?')) {
        return;
    }
    
    try {
        const token = await getIdToken();
        const response = await fetch(`${API_BASE}/api/ratings/${ratingId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            await loadRatingStats();
            await loadRatingEligibility();
            await loadRatings();
            alert('Review deleted successfully!');
        } else {
            alert(data.error || 'Failed to delete review');
        }
    } catch (error) {
        console.error('Error deleting review:', error);
        alert('Error deleting review. Please try again.');
    }
}

/**
 * Open report modal
 */
function openReportModal(ratingId) {
    if (!reportModal) return;
    
    reportModal.dataset.ratingId = ratingId;
    reportModal.classList.add('active');
}

/**
 * Close report modal
 */
function closeReportModal() {
    if (reportModal) {
        reportModal.classList.remove('active');
        reportModal.dataset.ratingId = '';
    }
}

/**
 * Submit report
 */
async function submitReport() {
    const form = document.getElementById('reportForm');
    if (!form || !reportModal) return;
    
    const ratingId = reportModal.dataset.ratingId;
    if (!ratingId) return;
    
    const formData = new FormData(form);
    const reason = formData.get('reason');
    
    if (!reason) {
        alert('Please select a reason');
        return;
    }
    
    try {
        const token = await getIdToken();
        const response = await fetch(`${API_BASE}/api/ratings/${ratingId}/report`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                reason: reason
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeReportModal();
            alert('Review reported. Thank you for your feedback.');
        } else {
            alert(data.error || 'Failed to report review');
        }
    } catch (error) {
        console.error('Error reporting review:', error);
        alert('Error reporting review. Please try again.');
    }
}

/**
 * Attach event listeners to rating items
 */
function attachRatingEventListeners() {
    // Event listeners are attached via onclick handlers in HTML
}

/**
 * Utility functions
 */
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getInitials(nameOrId) {
    // If it's a name, get initials from words
    if (nameOrId && nameOrId.length > 2 && !nameOrId.includes('User ')) {
        const words = nameOrId.trim().split(/\s+/);
        if (words.length >= 2) {
            // Get first letter of first two words
            return (words[0][0] + words[1][0]).toUpperCase();
        } else {
            // Get first two letters of single word
            return nameOrId.substring(0, 2).toUpperCase();
        }
    }
    // Fallback: use first 2 characters
    return nameOrId.substring(0, 2).toUpperCase();
}

// Export functions for global access
window.changePage = changePage;
window.changeSort = changeSort;
window.changeFilter = changeFilter;
window.openReviewModal = openReviewModal;
window.closeReviewModal = closeReviewModal;
window.submitReview = submitReview;
window.setStarRating = setStarRating;
window.handleStarHover = handleStarHover;
window.handleStarLeave = handleStarLeave;
window.editRating = editRating;
window.deleteRating = deleteRating;
window.openReportModal = openReportModal;
window.closeReportModal = closeReportModal;
window.submitReport = submitReport;

// Export init function
export { initRatings };

