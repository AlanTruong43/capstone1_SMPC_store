# 🚀 MoMo Integration - Quick Reference Card

## ⚡ Quick Start (30 Seconds)

```bash
# 1. Configure environment
copy backend\env.example.txt backend\.env
# Edit .env - add your FIREBASE_WEB_API_KEY

# 2. Start server
cd backend
npm run dev

# 3. Test
# Open: http://localhost:4000/pages/product_list.html
# Click product → Buy Now → Fill form → Pay
```

---

## 🗂️ File Locations

### Backend
```
backend/src/modules/
├── momo/
│   ├── momo_service.js    (Payment API)
│   └── momo_routes.js     (IPN webhook)
└── orders/
    ├── orders_service.js  (Order logic)
    └── orders_routes.js   (Order endpoints)
```

### Frontend
```
frontend/
├── pages/
│   ├── checkout.html         (Checkout page)
│   └── order-success.html    (Success page)
├── css/
│   └── checkout.css          (Styles)
└── js/
    └── checkout.js           (Logic)
```

---

## 🔌 API Endpoints

### Create Order & Checkout
```http
POST /api/orders/create-and-checkout
Auth: Bearer {firebase_token}
Body: { productId, quantity, shippingAddress }
```

### Verify Payment (Hybrid)
```http
GET /api/orders/{orderId}/verify-payment
No auth required
```

### IPN Webhook
```http
POST /api/payment/momo_ipn
(Called by MoMo servers)
```

### Test IPN (Local)
```http
POST /api/payment/momo_ipn_test
Body: { orderId }
```

---

## 🔧 Environment Variables

```env
# Required
PORT=4000
FIREBASE_WEB_API_KEY=your_key_here

# MoMo Test (already provided)
MOMO_PARTNER_CODE=MOMO
MOMO_ACCESS_KEY=F8BBA842ECF85
MOMO_SECRET_KEY=K951B6PE1waDMi640xX08PD3vg6EkVlz
MOMO_API_ENDPOINT=https://test-payment.momo.vn/v2/gateway/api/create

# Callback URLs
MOMO_RETURN_URL=http://localhost:4000/pages/order-success.html
MOMO_IPN_URL=http://localhost:4000/api/payment/momo_ipn
```

---

## 🧪 Testing Commands

### PowerShell
```powershell
# Test IPN manually
$body = '{"orderId": "YOUR_ORDER_ID"}' 
Invoke-RestMethod -Uri "http://localhost:4000/api/payment/momo_ipn_test" -Method Post -ContentType "application/json" -Body $body

# Check product
Invoke-RestMethod -Uri "http://localhost:4000/products/PRODUCT_ID"

# Verify payment
Invoke-RestMethod -Uri "http://localhost:4000/api/orders/ORDER_ID/verify-payment"
```

---

## 🔍 Debug Checklist

### Payment Not Working?
- [ ] `.env` file exists in `backend/` folder
- [ ] `FIREBASE_WEB_API_KEY` is set
- [ ] Backend server is running
- [ ] User is logged in
- [ ] Product exists and is available

### Order Not Updating?
- [ ] Check backend console for errors
- [ ] Verify Firestore permissions
- [ ] For IPN: Check if ngrok is running
- [ ] For local: verify-payment runs automatically

### Quick Debug:
```javascript
// Browser Console (on checkout page)
console.log(window.firebaseAuth.currentUser); // Check if logged in

// Backend Console - Look for:
✅ = Success
❌ = Error  
💳 = Payment
📦 = Product
```

---

## 📊 Database Collections

### orders
- Status: `pending` → `paid` / `failed`
- Created on checkout
- Updated after payment

### transactions  
- Created when payment succeeds
- Links to orderId

### products
- Quantity decremented on payment
- Status → `sold` when quantity = 0

---

## 🚀 Using ngrok (Optional)

```bash
# Terminal 1
cd backend
npm run dev

# Terminal 2
ngrok http 4000
# Copy the https URL

# Update .env
MOMO_RETURN_URL=https://YOUR_NGROK_URL/pages/order-success.html
MOMO_IPN_URL=https://YOUR_NGROK_URL/api/payment/momo_ipn

# Restart backend (Terminal 1)
```

---

## 🎯 Common Scenarios

### Test Purchase
1. Login to app
2. Go to product list
3. Click any product
4. Click "Buy Now"
5. Fill: Name, Phone (10 digits), Address
6. Click "Proceed to Payment"
7. Complete on MoMo test page
8. Wait for success page

### Manual IPN Test
1. Create order via checkout
2. Note the order ID from Firestore
3. Run: `POST /api/payment/momo_ipn_test`
4. Check order status → should be `paid`

### Check Payment Status
1. Get orderId from URL or Firestore
2. Call: `GET /api/orders/{orderId}/verify-payment`
3. Check response.status

---

## 💡 Pro Tips

1. **Logs are your friend**
   - Backend console has emoji indicators
   - Look for ❌ for errors

2. **No ngrok? No problem!**
   - Hybrid approach works locally
   - Success page auto-verifies

3. **Test often**
   - Use test IPN endpoint
   - Check Firestore after each test

4. **Environment changes**
   - Always restart backend after editing `.env`

5. **ngrok URL changes**
   - Update `.env` each restart
   - Free tier URLs expire

---

## 📱 URLs

### Development
- Frontend: `http://localhost:4000/pages/`
- API: `http://localhost:4000/api/`
- ngrok Dashboard: `http://127.0.0.1:4040`

### Key Pages
- Products: `/pages/product_list.html`
- Product Detail: `/pages/product_details.html?id={id}`
- Checkout: `/pages/checkout.html?productId={id}&quantity=1`
- Success: `/pages/order-success.html?orderId={id}`

---

## 🆘 Quick Fixes

### "Payment failed"
→ Check backend logs, verify MoMo credentials

### "Please login"  
→ Login via `/pages/login_page.html`

### "Product not found"
→ Verify product exists: `/products/{id}`

### Order stuck "pending"
→ Use verify-payment endpoint or test IPN

### ngrok not working
→ Check URL in `.env`, restart backend

---

## 📚 Full Documentation

- **MOMO_INTEGRATION_GUIDE.md** - Complete guide
- **TESTING_CHECKLIST.md** - Test scenarios
- **IMPLEMENTATION_SUMMARY.md** - Overview

---

## ✅ Success Indicators

Payment flow is working if you see:
1. ✅ Checkout page loads product
2. ✅ Form validates correctly
3. ✅ Backend logs: "Payment URL generated"
4. ✅ Redirect to MoMo happens
5. ✅ Success page shows after payment
6. ✅ Order status = "paid" in Firestore
7. ✅ Product quantity decreased

---

**Need more details?** Check the full documentation files! 📖

