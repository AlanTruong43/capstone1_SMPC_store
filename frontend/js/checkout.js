let currentProduct = null;
let productQuantity = 1;
let selectedPaymentMethod = 'zalopay';
const API_BASE = 'http://localhost:4000';

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

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('productId');
  const quantity = parseInt(urlParams.get('quantity')) || 1;
  if (!productId) return showError('No product selected');
  productQuantity = quantity;
  await loadProductDetails(productId);
  setupFormValidation();
  setupPaymentMethodSelection();
  checkoutForm.addEventListener('submit', handleCheckoutSubmit);
});

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

function displayProduct(p) {
  const subtotal = p.price * productQuantity;
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
  totalEl.textContent = formatPrice(subtotal);
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
  const auth = window.firebaseAuth;
  const user = auth.currentUser;
  if (!user) {
    showErrorContainer('Please log in to continue');
    setTimeout(() => window.location.href = '/pages/login_page.html', 2000);
    return;
  }
  const data = {
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
  setLoadingState(true);
  try {
    const token = await user.getIdToken();
    const res = await fetch(`${API_BASE}/api/orders/create-and-checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(data)
    });
    const d = await res.json();
    if (!res.ok || !d.success) throw new Error(d.message || 'Failed to create order');
    const { orderId, totalAmount } = d;
    if (selectedPaymentMethod === 'momo') await handleMoMoPayment(orderId, totalAmount, token);
    else if (selectedPaymentMethod === 'zalopay') await handleZaloPayment(orderId, token);
    else if (selectedPaymentMethod === 'stripe') await handleStripePayment(orderId, totalAmount, token);
    else if (selectedPaymentMethod === 'payos') await handlePayOSPayment(orderId, totalAmount, token);
    else throw new Error('Invalid payment method');
  } catch (err) {
    showErrorContainer(err.message || 'Payment failed');
    setLoadingState(false);
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
}

window.addEventListener('load', () => {
  const auth = window.firebaseAuth;
  if (auth) auth.onAuthStateChanged(u => console.log(u ? 'User authenticated' : 'User not authenticated'));
});
