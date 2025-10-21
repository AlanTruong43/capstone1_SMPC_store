/**
 * Checkout Page Logic
 * Handles product display, form validation, and payment initiation
 */

// Global state
let currentProduct = null;
let productQuantity = 1;
let selectedPaymentMethod = 'momo'; // Default to MoMo
const API_BASE = 'http://localhost:4000';

// DOM elements
const loadingEl = document.getElementById('loading');
const mainContentEl = document.getElementById('mainContent');
const errorStateEl = document.getElementById('errorState');
const productSummaryEl = document.getElementById('productSummary');
const subtotalEl = document.getElementById('subtotal');
const totalEl = document.getElementById('total');
const checkoutForm = document.getElementById('checkoutForm');
const submitBtn = document.getElementById('submitBtn');
const errorContainer = document.getElementById('errorContainer');
const errorText = document.getElementById('errorText');

/**
 * Initialize page on load
 */
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Checkout page loaded');

    // Get product ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('productId');
    const quantity = parseInt(urlParams.get('quantity')) || 1;

    if (!productId) {
        showError('No product selected');
        return;
    }

    productQuantity = quantity;

    // Load product details
    await loadProductDetails(productId);

    // Setup form validation
    setupFormValidation();

    // Setup payment method selection
    setupPaymentMethodSelection();

    // Setup form submission
    checkoutForm.addEventListener('submit', handleCheckoutSubmit);
});

/**
 * Load product details from API
 */
async function loadProductDetails(productId) {
    try {
        console.log('📦 Loading product:', productId);

        const response = await fetch(`${API_BASE}/products/${productId}`);
        
        if (!response.ok) {
            throw new Error('Product not found');
        }

        const data = await response.json();
        currentProduct = data;

        console.log('✅ Product loaded:', currentProduct);

        // Display product
        displayProduct(currentProduct);

        // Show main content
        loadingEl.style.display = 'none';
        mainContentEl.style.display = 'block';

    } catch (error) {
        console.error('❌ Failed to load product:', error);
        showError('Failed to load product details');
    }
}

/**
 * Display product in order summary
 */
function displayProduct(product) {
    const subtotal = product.price * productQuantity;

    productSummaryEl.innerHTML = `
        <div class="product-card">
            <img 
                src="${product.imageUrl || '/img/placeholder.svg'}" 
                alt="${product.name}"
                class="product-image"
                onerror="this.src='/img/placeholder.svg'"
            >
            <div class="product-details">
                <div class="product-name">${product.name}</div>
                <div class="product-condition">${product.condition || 'New'}</div>
                <div class="product-price">${formatPrice(product.price)}</div>
                <div class="product-quantity">Quantity: ${productQuantity}</div>
            </div>
        </div>
    `;

    subtotalEl.textContent = formatPrice(subtotal);
    totalEl.textContent = formatPrice(subtotal);
}

/**
 * Format price to VND currency
 */
function formatPrice(price) {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(price);
}

/**
 * Setup payment method selection
 */
function setupPaymentMethodSelection() {
    const paymentOptions = document.querySelectorAll('input[name="paymentMethod"]');
    const securityNote = document.getElementById('securityNote');

    paymentOptions.forEach(option => {
        option.addEventListener('change', (e) => {
            selectedPaymentMethod = e.target.value;
            
            // Update security note based on selected method
            if (selectedPaymentMethod === 'momo') {
                securityNote.textContent = '🔒 Secure payment powered by MoMo';
            } else if (selectedPaymentMethod === 'stripe') {
                securityNote.textContent = '🔒 Secure payment powered by Stripe';
            }

            console.log('💳 Payment method selected:', selectedPaymentMethod);
        });
    });
}

/**
 * Setup form validation
 */
function setupFormValidation() {
    const phoneInput = document.getElementById('phone');
    const fullNameInput = document.getElementById('fullName');
    const addressInput = document.getElementById('address');

    // Phone validation
    phoneInput.addEventListener('blur', () => {
        validatePhone(phoneInput.value);
    });

    // Clear errors on input
    [fullNameInput, phoneInput, addressInput].forEach(input => {
        input.addEventListener('input', () => {
            clearFieldError(input.id);
            hideErrorContainer();
        });
    });
}

/**
 * Validate phone number
 */
function validatePhone(phone) {
    const phoneRegex = /^[0-9]{10,11}$/;
    const phoneError = document.getElementById('phoneError');
    const phoneInput = document.getElementById('phone');

    if (!phone) {
        return true; // Will be caught by required validation
    }

    if (!phoneRegex.test(phone)) {
        phoneError.textContent = 'Phone number must be 10-11 digits';
        phoneInput.classList.add('error');
        return false;
    }

    phoneError.textContent = '';
    phoneInput.classList.remove('error');
    return true;
}

/**
 * Validate all form fields
 */
function validateForm() {
    const fullName = document.getElementById('fullName').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const address = document.getElementById('address').value.trim();

    let isValid = true;

    // Validate full name
    if (!fullName) {
        setFieldError('fullName', 'Full name is required');
        isValid = false;
    }

    // Validate phone
    if (!phone) {
        setFieldError('phone', 'Phone number is required');
        isValid = false;
    } else if (!validatePhone(phone)) {
        isValid = false;
    }

    // Validate address
    if (!address) {
        setFieldError('address', 'Address is required');
        isValid = false;
    }

    return isValid;
}

/**
 * Set field error
 */
function setFieldError(fieldId, message) {
    const errorEl = document.getElementById(`${fieldId}Error`);
    const inputEl = document.getElementById(fieldId);

    if (errorEl && inputEl) {
        errorEl.textContent = message;
        inputEl.classList.add('error');
    }
}

/**
 * Clear field error
 */
function clearFieldError(fieldId) {
    const errorEl = document.getElementById(`${fieldId}Error`);
    const inputEl = document.getElementById(fieldId);

    if (errorEl && inputEl) {
        errorEl.textContent = '';
        inputEl.classList.remove('error');
    }
}

/**
 * Show error container
 */
function showErrorContainer(message) {
    errorText.textContent = message;
    errorContainer.style.display = 'flex';
    
    // Scroll to error
    errorContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/**
 * Hide error container
 */
function hideErrorContainer() {
    errorContainer.style.display = 'none';
}

/**
 * Handle checkout form submission
 */
async function handleCheckoutSubmit(e) {
    e.preventDefault();

    console.log('📝 Form submitted');

    // Validate form
    if (!validateForm()) {
        console.log('❌ Form validation failed');
        showErrorContainer('Please fill in all required fields correctly');
        return;
    }

    // Check if user is logged in
    const auth = window.firebaseAuth;
    const user = auth.currentUser;

    if (!user) {
        console.log('❌ User not logged in');
        showErrorContainer('Please log in to continue');
        setTimeout(() => {
            window.location.href = '/pages/login_page.html';
        }, 2000);
        return;
    }

    // Get form data
    const formData = {
        productId: currentProduct.id,
        quantity: productQuantity,
        shippingAddress: {
            fullName: document.getElementById('fullName').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            address: document.getElementById('address').value.trim(),
            city: document.getElementById('city').value.trim(),
            postalCode: document.getElementById('postalCode').value.trim()
        }
    };

    console.log('📦 Order data:', formData);
    console.log('💳 Selected payment method:', selectedPaymentMethod);

    // Show loading state
    setLoadingState(true);

    try {
        // Get user ID token
        const idToken = await user.getIdToken();

        if (selectedPaymentMethod === 'momo') {
            // MoMo Payment Flow
            await handleMoMoPayment(formData, idToken);
        } else if (selectedPaymentMethod === 'stripe') {
            // Stripe Payment Flow
            await handleStripePayment(formData, idToken);
        }

    } catch (error) {
        console.error('❌ Checkout failed:', error);
        
        setLoadingState(false);
        
        // Show error message
        let errorMessage = 'Sorry, we could not initiate the payment. Please check your details and try again.';
        
        if (error.message.includes('Product unavailable')) {
            errorMessage = 'This product is no longer available.';
        } else if (error.message.includes('Insufficient quantity')) {
            errorMessage = 'Not enough items in stock.';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
            errorMessage = 'Network error. Please check your connection and try again.';
        }

        showErrorContainer(errorMessage);
    }
}

/**
 * Handle MoMo payment flow
 */
async function handleMoMoPayment(formData, idToken) {
    console.log('💳 Processing MoMo payment...');

    // Call backend to create order and get payment URL
    const response = await fetch(`${API_BASE}/api/orders/create-and-checkout`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(formData)
    });

    const result = await response.json();
    console.log('📥 MoMo response:', result);

    if (!response.ok || !result.success) {
        throw new Error(result.message || result.error || 'Failed to create order');
    }

    // Success! Redirect to MoMo payment
    console.log('✅ Payment URL received:', result.payUrl);
    console.log('📦 Order ID:', result.orderId);

    // Save order ID to localStorage for success page
    localStorage.setItem('pendingOrderId', result.orderId);

    // Redirect to MoMo payment page
    console.log('🚀 Redirecting to MoMo payment page...');
    window.location.href = result.payUrl;
}

/**
 * Handle Stripe payment flow
 */
async function handleStripePayment(formData, idToken) {
    console.log('💳 Processing Stripe payment...');

    try {
        // Step 1: Create order first
        const orderResponse = await fetch(`${API_BASE}/api/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify(formData)
        });

        const orderResult = await orderResponse.json();
        console.log('📥 Order created:', orderResult);

        if (!orderResponse.ok || !orderResult.success) {
            throw new Error(orderResult.message || 'Failed to create order');
        }

        const orderId = orderResult.orderId;
        const orderTotal = orderResult.order.totalAmount;

        // Step 2: Create Stripe Payment Intent
        const paymentResponse = await fetch(`${API_BASE}/api/payments/stripe/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
                orderId: orderId,
                amount: Math.round(orderTotal), // VND doesn't use decimals
                currency: 'vnd',
                description: `Payment for ${currentProduct.name}`
            })
        });

        const paymentResult = await paymentResponse.json();
        console.log('📥 Stripe payment intent created:', paymentResult);

        if (!paymentResponse.ok || !paymentResult.success) {
            throw new Error(paymentResult.error || 'Failed to create payment intent');
        }

        // Step 3: Save order ID and show message
        localStorage.setItem('pendingOrderId', orderId);

        // For now, show alert since Stripe UI is not implemented yet
        setLoadingState(false);
        alert('⚠️ Stripe payment UI is not yet implemented.\n\nYour order has been created (Order ID: ' + orderId + ').\n\nPlease contact support to complete payment via Stripe.\n\nClient Secret: ' + paymentResult.clientSecret);

        // TODO: Implement Stripe.js UI here
        // - Load Stripe.js library
        // - Create card element
        // - Confirm payment with clientSecret
        // - Handle result and redirect to success page

        console.log('⚠️ Stripe UI not implemented. Order created but payment pending.');
        console.log('Client Secret:', paymentResult.clientSecret);

    } catch (error) {
        console.error('❌ Stripe payment failed:', error);
        setLoadingState(false);
        throw error;
    }
}

/**
 * Set loading state for submit button
 */
function setLoadingState(isLoading) {
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoader = submitBtn.querySelector('.btn-loader');

    if (isLoading) {
        btnText.style.display = 'none';
        btnLoader.style.display = 'flex';
        submitBtn.disabled = true;
    } else {
        btnText.style.display = 'block';
        btnLoader.style.display = 'none';
        submitBtn.disabled = false;
    }
}

/**
 * Show error state (product not found)
 */
function showError(message) {
    console.error('❌ Error:', message);
    loadingEl.style.display = 'none';
    mainContentEl.style.display = 'none';
    errorStateEl.style.display = 'block';
}

/**
 * Monitor auth state
 */
window.addEventListener('load', () => {
    const auth = window.firebaseAuth;
    
    if (auth) {
        auth.onAuthStateChanged((user) => {
            if (!user) {
                console.log('⚠️ User not authenticated');
                // Don't redirect immediately, let user fill form
                // Will be caught on submit
            } else {
                console.log('✅ User authenticated:', user.email);
            }
        });
    }
});

