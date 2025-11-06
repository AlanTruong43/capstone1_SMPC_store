let currentProduct = null;
let currentCart = null;
let isCartMode = false;
let productQuantity = 1;
let selectedPaymentMethod = 'payos';
const API_BASE = 'http://localhost:4000';

const loadingEl = document.getElementById('loading');
const mainContentEl = document.getElementById('mainContent');
const errorStateEl = document.getElementById('errorState');
const productSummaryEl = document.getElementById('productSummary');
const subtotalEl = document.getElementById('subtotal');
const shippingEl = document.getElementById('shipping');
const totalEl = document.getElementById('total');
const checkoutForm = document.getElementById('checkoutForm');
const submitBtn = document.getElementById('submitBtn');
const errorContainer = document.getElementById('errorContainer');
const errorText = document.getElementById('errorText');

// Import auth functions
async function getCurrentUser() {
  const auth = window.firebaseAuth;
  if (!auth) return null;
  return auth.currentUser;
}

async function getIdToken() {
  const user = await getCurrentUser();
  if (!user) return null;
  return await user.getIdToken();
}

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('productId');
  const fromCart = urlParams.get('fromCart') === 'true';
  
  // Wait for Firebase auth to be initialized
  await waitForFirebaseAuth();
  
  // Check if user is authenticated
  const user = await getCurrentUser();
  if (!user) {
    showError('Please log in to continue');
    setTimeout(() => window.location.href = '/pages/login_page.html', 2000);
    return;
  }

  if (fromCart || !productId) {
    // Cart checkout mode
    isCartMode = true;
    await loadCart();
  } else {
    // Single product checkout mode
    isCartMode = false;
    const quantity = parseInt(urlParams.get('quantity')) || 1;
    productQuantity = quantity;
    await loadProductDetails(productId);
  }
  
  setupFormValidation();
  setupPaymentMethodSelection();
  
  // Initialize selectedPaymentMethod from checked radio button
  const checkedRadio = document.querySelector('input[name="paymentMethod"]:checked');
  if (checkedRadio) {
    selectedPaymentMethod = checkedRadio.value;
  }
  
  checkoutForm.addEventListener('submit', handleCheckoutSubmit);
});

// Wait for Firebase auth to be available and ready
function waitForFirebaseAuth() {
  return new Promise((resolve) => {
    // If already available, check if auth state is ready
    if (window.firebaseAuth) {
      // Use onAuthStateChanged to wait for initial auth state
      const unsubscribe = window.firebaseAuth.onAuthStateChanged((user) => {
        unsubscribe(); // Only listen once
        resolve();
      });
      return;
    }
    
    // Otherwise, wait for it to be set (max 5 seconds)
    let attempts = 0;
    const maxAttempts = 50; // 50 * 100ms = 5 seconds
    
    const checkAuth = setInterval(() => {
      attempts++;
      if (window.firebaseAuth) {
        clearInterval(checkAuth);
        // Now wait for auth state
        const unsubscribe = window.firebaseAuth.onAuthStateChanged((user) => {
          unsubscribe();
          resolve();
        });
      } else if (attempts >= maxAttempts) {
        clearInterval(checkAuth);
        console.error('Firebase auth not initialized after 5 seconds');
        resolve(); // Resolve anyway to prevent infinite waiting
      }
    }, 100);
  });
}

async function loadCart() {
  try {
    const token = await getIdToken();
    const res = await fetch(`${API_BASE}/api/cart`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!res.ok) throw new Error('Failed to load cart');
    
    const cart = await res.json();
    currentCart = cart;
    
    if (!cart.items || cart.items.length === 0) {
      showError('Your cart is empty');
      return;
    }
    
    displayCart(cart);
    loadingEl.style.display = 'none';
    mainContentEl.style.display = 'block';
  } catch (err) {
    console.error('Error loading cart:', err);
    showError('Failed to load cart. Please try again.');
  }
}

async function loadProductDetails(productId) {
  try {
    const res = await fetch(`${API_BASE}/products/${productId}`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    currentProduct = data;
    displayProduct(data);
    loadingEl.style.display = 'none';
    mainContentEl.style.display = 'block';
  } catch {
    showError('Failed to load product details');
  }
}

function displayCart(cart) {
  const itemsHTML = cart.items.map(item => {
    const product = item.product;
    return `
      <div class="product-card">
        <img src="${product.imageUrl || '/img/placeholder.svg'}" alt="${product.name}" class="product-image" onerror="this.src='/img/placeholder.svg'">
        <div class="product-details">
          <div class="product-name">${product.name}</div>
          <div class="product-condition">${product.condition || 'New'}</div>
          <div class="product-price">${formatPrice(product.price)}</div>
          <div class="product-quantity">Quantity: ${item.quantity}</div>
          <div class="product-total">Item Total: ${formatPrice(item.itemTotal)}</div>
        </div>
      </div>
    `;
  }).join('');
  
  productSummaryEl.innerHTML = itemsHTML;
  
  subtotalEl.textContent = formatPrice(cart.subtotal);
  shippingEl.textContent = formatPrice(cart.shippingFee);
  totalEl.textContent = formatPrice(cart.total);
}

function displayProduct(p) {
  const subtotal = p.price * productQuantity;
  const shippingFee = 5000; // Fixed shipping fee
  const total = subtotal + shippingFee;
  
  productSummaryEl.innerHTML = `
    <div class="product-card">
      <img src="${p.imageUrl || '/img/placeholder.svg'}" alt="${p.name}" class="product-image" onerror="this.src='/img/placeholder.svg'">
      <div class="product-details">
        <div class="product-name">${p.name}</div>
        <div class="product-condition">${p.condition || 'New'}</div>
        <div class="product-price">${formatPrice(p.price)}</div>
        <div class="product-quantity">Quantity: ${productQuantity}</div>
      </div>
    </div>`;
  subtotalEl.textContent = formatPrice(subtotal);
  shippingEl.textContent = formatPrice(shippingFee);
  totalEl.textContent = formatPrice(total);
}

function formatPrice(price) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
}

function setupPaymentMethodSelection() {
  document.querySelectorAll('input[name="paymentMethod"]').forEach(opt => {
    opt.addEventListener('change', e => selectedPaymentMethod = e.target.value);
  });
}

function setupFormValidation() {
  const phone = document.getElementById('phone');
  const name = document.getElementById('fullName');
  const addr = document.getElementById('address');
  phone.addEventListener('blur', () => validatePhone(phone.value));
  [name, phone, addr].forEach(i => i.addEventListener('input', () => {
    clearFieldError(i.id);
    hideErrorContainer();
  }));
}

function validatePhone(p) {
  const r = /^[0-9]{10,11}$/;
  const e = document.getElementById('phoneError');
  const i = document.getElementById('phone');
  if (!p) return true;
  if (!r.test(p)) {
    e.textContent = 'Phone number must be 10-11 digits';
    i.classList.add('error');
    return false;
  }
  e.textContent = '';
  i.classList.remove('error');
  return true;
}

function validateForm() {
  const f = document.getElementById('fullName').value.trim();
  const p = document.getElementById('phone').value.trim();
  const a = document.getElementById('address').value.trim();
  let v = true;
  if (!f) { setFieldError('fullName', 'Full name is required'); v = false; }
  if (!p) { setFieldError('phone', 'Phone is required'); v = false; }
  else if (!validatePhone(p)) v = false;
  if (!a) { setFieldError('address', 'Address is required'); v = false; }
  return v;
}

function setFieldError(id, msg) {
  const e = document.getElementById(`${id}Error`);
  const i = document.getElementById(id);
  if (e && i) { e.textContent = msg; i.classList.add('error'); }
}

function clearFieldError(id) {
  const e = document.getElementById(`${id}Error`);
  const i = document.getElementById(id);
  if (e && i) { e.textContent = ''; i.classList.remove('error'); }
}

function showErrorContainer(m) {
  errorText.textContent = m;
  errorContainer.style.display = 'flex';
  errorContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function hideErrorContainer() {
  errorContainer.style.display = 'none';
}

async function handleCheckoutSubmit(e) {
  e.preventDefault();
  if (!validateForm()) return showErrorContainer('Please fill in all required fields correctly');
  
  const user = await getCurrentUser();
  if (!user) {
    showErrorContainer('Please log in to continue');
    setTimeout(() => window.location.href = '/pages/login_page.html', 2000);
    return;
  }
  
  setLoadingState(true);
  
  try {
    const token = await getIdToken();
    const shippingAddress = {
      fullName: document.getElementById('fullName').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      address: document.getElementById('address').value.trim(),
      city: document.getElementById('city').value.trim(),
      postalCode: document.getElementById('postalCode').value.trim()
    };
    
    if (isCartMode) {
      // Cart checkout
      await handleCartCheckout(token, shippingAddress);
    } else {
      // Single product checkout
      await handleSingleProductCheckout(token, shippingAddress);
    }
  } catch (err) {
    showErrorContainer(err.message || 'Checkout failed');
    setLoadingState(false);
  }
}

async function handleCartCheckout(token, shippingAddress) {
  try {
    const res = await fetch(`${API_BASE}/api/orders/create-from-cart`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify({ shippingAddress })
    });
    
    const d = await res.json();
    if (!res.ok || !d.success) {
      throw new Error(d.message || 'Failed to create orders from cart');
    }
    
    const { transactionId, totalAmount, orderIds } = d;
    
    // Handle payment based on selected method
    if (selectedPaymentMethod === 'momo') {
      await handleMoMoPaymentForCart(transactionId, orderIds, totalAmount, token);
    } else if (selectedPaymentMethod === 'zalopay') {
      await handleZaloPaymentForCart(transactionId, orderIds, token);
    } else if (selectedPaymentMethod === 'stripe') {
      await handleStripePaymentForCart(transactionId, orderIds, totalAmount, token);
    } else if (selectedPaymentMethod === 'payos') {
      await handlePayOSPaymentForCart(transactionId, orderIds, totalAmount, token);
    } else {
      throw new Error('Invalid payment method');
    }
  } catch (err) {
    throw err;
  }
}

async function handleSingleProductCheckout(token, shippingAddress) {
  const data = {
    productId: currentProduct.id,
    quantity: productQuantity,
    shippingAddress: shippingAddress
  };
  
  try {
    const res = await fetch(`${API_BASE}/api/orders/create-and-checkout`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify(data)
    });
    
    const d = await res.json();
    if (!res.ok || !d.success) {
      throw new Error(d.message || 'Failed to create order');
    }
    
    // Backend now returns: orderId, subtotal, shippingFee, totalAmount (includes shipping)
    const { orderId, totalAmount } = d; // totalAmount already includes shipping fee
    
    if (selectedPaymentMethod === 'momo') {
      await handleMoMoPayment(orderId, totalAmount, token);
    } else if (selectedPaymentMethod === 'zalopay') {
      await handleZaloPayment(orderId, token);
    } else if (selectedPaymentMethod === 'stripe') {
      await handleStripePayment(orderId, totalAmount, token);
    } else if (selectedPaymentMethod === 'payos') {
      await handlePayOSPayment(orderId, totalAmount, token);
    } else {
      throw new Error('Invalid payment method');
    }
  } catch (err) {
    throw err;
  }
}

async function handleMoMoPayment(orderId, amount, token) {
  const res = await fetch(`${API_BASE}/api/payments/momo/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ orderId, amount })
  });
  const d = await res.json();
  if (!res.ok || !d.payUrl) throw new Error(d.message || 'Failed to create MoMo payment');
  localStorage.setItem('pendingOrderId', orderId);
  window.location.href = d.payUrl;
}

async function handleMoMoPaymentForCart(transactionId, orderIds, totalAmount, token) {
  const res = await fetch(`${API_BASE}/api/payments/momo/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ orderId: transactionId, amount: totalAmount })
  });
  const d = await res.json();
  if (!res.ok || !d.payUrl) throw new Error(d.message || 'Failed to create MoMo payment');
  localStorage.setItem('pendingTransactionId', transactionId);
  localStorage.setItem('pendingOrderIds', JSON.stringify(orderIds));
  window.location.href = d.payUrl;
}

async function handleZaloPayment(orderId, token) {
  const res = await fetch(`${API_BASE}/api/payments/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ orderId })
  });
  const d = await res.json();
  if (res.ok && d.zaloPayResponse?.order_url) {
    localStorage.setItem('pendingOrderId', orderId);
    localStorage.setItem('paymentProvider', 'zalopay');
    window.location.href = d.zaloPayResponse.order_url;
  } else throw new Error(d.message || 'Failed to create ZaloPay order');
}

async function handleZaloPaymentForCart(transactionId, orderIds, token) {
  // For cart checkout, use the first order ID for ZaloPay
  // Note: This is a limitation - ZaloPay may need separate payments per order
  await handleZaloPayment(orderIds[0], token);
  localStorage.setItem('pendingTransactionId', transactionId);
  localStorage.setItem('pendingOrderIds', JSON.stringify(orderIds));
}

async function handleStripePayment(orderId, amount, token) {
  const res = await fetch(`${API_BASE}/api/payments/stripe/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      orderId,
      amount: Math.round(amount),
      currency: 'vnd',
      description: `Payment for ${currentProduct.name}`
    })
  });
  const d = await res.json();
  if (!res.ok || !d.clientSecret) throw new Error(d.error || 'Failed to create Stripe payment');
  setLoadingState(false);
  alert(`Stripe Payment Intent created. Order ID: ${orderId}\nClient Secret: ${d.clientSecret}`);
}

async function handleStripePaymentForCart(transactionId, orderIds, totalAmount, token) {
  // For cart checkout, use transaction ID
  const res = await fetch(`${API_BASE}/api/payments/stripe/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      orderId: transactionId,
      amount: Math.round(totalAmount),
      currency: 'vnd',
      description: `Cart checkout: ${orderIds.length} items`
    })
  });
  const d = await res.json();
  if (!res.ok || !d.clientSecret) throw new Error(d.error || 'Failed to create Stripe payment');
  localStorage.setItem('pendingTransactionId', transactionId);
  localStorage.setItem('pendingOrderIds', JSON.stringify(orderIds));
  setLoadingState(false);
  alert(`Stripe Payment Intent created. Transaction ID: ${transactionId}\nClient Secret: ${d.clientSecret}`);
}

async function handlePayOSPayment(orderId, amount, token) {
  const res = await fetch(`${API_BASE}/api/payments/payos/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ orderId, amount })
  });
  const d = await res.json();
  if (!res.ok || !d.checkoutUrl) throw new Error(d.message || 'Failed to create PayOS payment');
  localStorage.setItem('pendingOrderId', orderId);
  localStorage.setItem('paymentProvider', 'payos');
  window.location.href = d.checkoutUrl;
}

async function handlePayOSPaymentForCart(transactionId, orderIds, totalAmount, token) {
  const res = await fetch(`${API_BASE}/api/payments/payos/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ orderId: transactionId, amount: totalAmount })
  });
  const d = await res.json();
  if (!res.ok || !d.checkoutUrl) throw new Error(d.message || 'Failed to create PayOS payment');
  localStorage.setItem('pendingTransactionId', transactionId);
  localStorage.setItem('pendingOrderIds', JSON.stringify(orderIds));
  localStorage.setItem('paymentProvider', 'payos');
  window.location.href = d.checkoutUrl;
}

function setLoadingState(isLoading) {
  const text = submitBtn.querySelector('.btn-text');
  const loader = submitBtn.querySelector('.btn-loader');
  text.style.display = isLoading ? 'none' : 'block';
  loader.style.display = isLoading ? 'flex' : 'none';
  submitBtn.disabled = isLoading;
}

function showError(m) {
  loadingEl.style.display = 'none';
  mainContentEl.style.display = 'none';
  errorStateEl.style.display = 'block';
  
  // Update both heading and paragraph
  const heading = errorStateEl.querySelector('h2');
  const paragraph = errorStateEl.querySelector('p');
  
  if (heading) {
    // Extract main message for heading (first sentence or first 30 chars)
    const headingText = m.length > 30 ? m.substring(0, 30) + '...' : m;
    heading.textContent = headingText;
  }
  
  if (paragraph) {
    paragraph.textContent = m;
  }
}

window.addEventListener('load', () => {
  const auth = window.firebaseAuth;
  if (auth) auth.onAuthStateChanged(u => console.log(u ? 'User authenticated' : 'User not authenticated'));
});
