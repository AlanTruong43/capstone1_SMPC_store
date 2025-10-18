# 🚀 MoMo Payment Gateway Integration Guide

## 📋 Table of Contents
1. [Overview](#overview)
2. [Features Implemented](#features-implemented)
3. [File Structure](#file-structure)
4. [Setup Instructions](#setup-instructions)
5. [Testing Guide](#testing-guide)
6. [API Endpoints](#api-endpoints)
7. [Payment Flow](#payment-flow)
8. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

This guide covers the complete MoMo Payment Gateway integration for the SmartShopAI second-hand marketplace. The implementation includes a **hybrid approach** that works both with and without ngrok for local development.

### Key Features:
- ✅ Secure payment processing via MoMo
- ✅ Real-time payment verification
- ✅ IPN webhook support (for production)
- ✅ Hybrid verification (works without IPN for local testing)
- ✅ Automatic order and transaction management
- ✅ Product quantity updates after successful payment
- ✅ User-friendly checkout flow

---

## 🎨 Features Implemented

### Backend Features:
1. **MoMo Service Module** (`backend/src/modules/momo/`)
   - Payment request creation with HMAC SHA256 signature
   - IPN signature verification
   - Transaction status querying

2. **Orders Module** (`backend/src/modules/orders/`)
   - Order creation with Firestore
   - Payment verification endpoint
   - Order status management
   - User document auto-creation

3. **Payment Webhook** (`backend/src/modules/momo/momo_routes.js`)
   - IPN endpoint for production
   - Test IPN endpoint for local development
   - Automatic order updates on payment success

### Frontend Features:
1. **Checkout Page** (`frontend/pages/checkout.html`)
   - Product summary display
   - Shipping address form
   - Form validation
   - Error handling

2. **Success Page** (`frontend/pages/order-success.html`)
   - Payment verification
   - Order details display
   - Auto-retry mechanism
   - Failed payment handling

3. **Product Details Enhancement**
   - Buy Now button integration
   - Quantity selection
   - Direct checkout flow

---

## 📁 File Structure

```
capstone1_SMPC_store/
├── backend/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── momo/
│   │   │   │   ├── momo_service.js      ✨ NEW - MoMo API integration
│   │   │   │   ├── momo_routes.js       ✨ NEW - IPN webhook
│   │   │   │   └── MoMo.js              📖 Reference file
│   │   │   └── orders/
│   │   │       ├── orders_service.js     ✨ NEW - Order management
│   │   │       └── orders_routes.js      ✨ NEW - Order endpoints
│   │   └── index.js                      🔧 MODIFIED - Added routes
│   └── env.example.txt                   ✨ NEW - Environment template
├── frontend/
│   ├── pages/
│   │   ├── checkout.html                 ✨ NEW - Checkout page
│   │   ├── order-success.html            ✨ NEW - Success page
│   │   └── product_details.html          🔧 MODIFIED - Buy Now button
│   ├── css/
│   │   └── checkout.css                  ✨ NEW - Checkout styles
│   └── js/
│       ├── checkout.js                   ✨ NEW - Checkout logic
│       └── product_detail.js             🔧 MODIFIED - Buy Now handler
└── MOMO_INTEGRATION_GUIDE.md            ✨ NEW - This guide
```

---

## ⚙️ Setup Instructions

### 1. Install Dependencies

The required packages should already be installed. If not:

```bash
cd backend
npm install axios dotenv
```

### 2. Configure Environment Variables

Copy the example environment configuration:

```bash
# Windows PowerShell
copy env.example.txt .env

# Or manually create .env file
```

Edit `.env` file with your configuration:

```env
PORT=4000
BASE_URL=http://localhost:4000

# Firebase
FIREBASE_WEB_API_KEY=your_actual_firebase_api_key

# MoMo Test Credentials (already provided)
MOMO_PARTNER_CODE=MOMO
MOMO_ACCESS_KEY=F8BBA842ECF85
MOMO_SECRET_KEY=K951B6PE1waDMi640xX08PD3vg6EkVlz
MOMO_API_ENDPOINT=https://test-payment.momo.vn/v2/gateway/api/create

# Callback URLs (localhost for now)
MOMO_RETURN_URL=http://localhost:4000/pages/order-success.html
MOMO_IPN_URL=http://localhost:4000/api/payment/momo_ipn
```

### 3. Setup ngrok (Optional - for IPN testing)

If you want to test the IPN webhook with real MoMo callbacks:

```bash
# Install ngrok globally (if not already installed)
npm install -g ngrok

# Start ngrok in a separate terminal
ngrok http 4000
```

You'll see output like:
```
Forwarding: https://abc123.ngrok-free.app -> http://localhost:4000
```

Update your `.env`:
```env
MOMO_RETURN_URL=https://abc123.ngrok-free.app/pages/order-success.html
MOMO_IPN_URL=https://abc123.ngrok-free.app/api/payment/momo_ipn
```

**Note:** ngrok URL changes each time you restart. Update `.env` accordingly.

### 4. Start the Server

```bash
cd backend
npm run dev
```

The server should start on `http://localhost:4000`

---

## 🧪 Testing Guide

### Test Scenario 1: Complete Purchase Flow (Without ngrok)

1. **Browse Products**
   - Go to `http://localhost:4000/pages/product_list.html`
   - Click on any product

2. **Buy Now**
   - On product details page, select quantity
   - Click "Buy Now" button
   - Should redirect to checkout page

3. **Checkout**
   - Fill in shipping address:
     - Full Name: Test User
     - Phone: 0912345678
     - Address: 123 Test Street
     - City: Ho Chi Minh City
     - Postal Code: 700000
   - Click "Proceed to Payment"

4. **MoMo Payment**
   - You'll be redirected to MoMo test payment page
   - Use MoMo test credentials to complete payment
   - After payment, redirected to success page

5. **Payment Verification**
   - Success page will automatically verify payment
   - Shows "Verifying payment..." for 2-5 seconds
   - Displays order details once verified

### Test Scenario 2: With ngrok (Full IPN Flow)

1. Start ngrok: `ngrok http 4000`
2. Update `.env` with ngrok URL
3. Restart backend server
4. Follow steps from Scenario 1
5. Check ngrok dashboard (`http://127.0.0.1:4040`) to see IPN requests

### Test Scenario 3: Using Test IPN Endpoint

For manual testing without actual MoMo payment:

```bash
# Using PowerShell or curl

# Create an order first (use actual order ID from database)
curl -X POST http://localhost:4000/api/payment/momo_ipn_test `
  -H "Content-Type: application/json" `
  -d '{"orderId": "YOUR_ORDER_ID_HERE"}'
```

This simulates a successful payment and updates the order.

### Test Cards (MoMo Sandbox)

MoMo provides test credentials for sandbox testing. Check their developer portal for current test cards.

---

## 🔌 API Endpoints

### Order Endpoints

#### Create Order and Checkout
```http
POST /api/orders/create-and-checkout
Authorization: Bearer {firebase_id_token}
Content-Type: application/json

{
  "productId": "product_id_here",
  "quantity": 1,
  "shippingAddress": {
    "fullName": "John Doe",
    "phone": "0912345678",
    "address": "123 Test St",
    "city": "HCMC",
    "postalCode": "700000"
  }
}

Response:
{
  "success": true,
  "orderId": "generated_order_id",
  "payUrl": "https://test-payment.momo.vn/..."
}
```

#### Verify Payment
```http
GET /api/orders/{orderId}/verify-payment

Response:
{
  "success": true,
  "orderId": "order_id",
  "status": "paid",
  "order": { ... }
}
```

#### Get Order Details
```http
GET /api/orders/{orderId}
Authorization: Bearer {firebase_id_token}

Response:
{
  "success": true,
  "order": { ... }
}
```

### Payment Endpoints

#### MoMo IPN Webhook
```http
POST /api/payment/momo_ipn
Content-Type: application/json

(Automatically called by MoMo servers)
```

#### Test IPN (Development Only)
```http
POST /api/payment/momo_ipn_test
Content-Type: application/json

{
  "orderId": "order_id_here"
}
```

---

## 🔄 Payment Flow

### User Flow:
```
1. User clicks "Buy Now" on product page
   ↓
2. Redirected to checkout.html with productId
   ↓
3. Frontend fetches product details
   ↓
4. User fills shipping form
   ↓
5. Frontend calls POST /api/orders/create-and-checkout
   ↓
6. Backend creates order (status: pending)
   ↓
7. Backend calls MoMo API → gets payUrl
   ↓
8. Frontend redirects user to MoMo payUrl
   ↓
9. User completes payment on MoMo
   ↓
10. MoMo redirects to order-success.html
    ↓
11. Success page calls GET /api/orders/{orderId}/verify-payment
    ↓
12. Backend queries MoMo transaction status
    ↓
13. Backend updates order status to "paid"
    ↓
14. Backend updates product quantity
    ↓
15. Backend creates transaction record
    ↓
16. Success page displays order details
```

### IPN Flow (When ngrok is used):
```
9. User completes payment on MoMo
   ↓
10a. MoMo sends IPN to /api/payment/momo_ipn
    ↓
11a. Backend verifies signature
    ↓
12a. Backend updates order status
    ↓
13a. Backend creates transaction
    ↓
(Meanwhile, user is redirected to success page)
```

---

## 🔧 Troubleshooting

### Issue: Payment URL not generated

**Symptoms:**
- Error: "Payment initiation failed"
- Console shows MoMo API error

**Solutions:**
1. Check `.env` file has correct MoMo credentials
2. Verify MoMo API endpoint is correct
3. Check network connectivity
4. Review backend logs for detailed error

### Issue: Payment verified but order not updating

**Symptoms:**
- Success page shows "pending" status
- Payment completed on MoMo but order status doesn't change

**Solutions:**
1. **Without ngrok:** This is normal! Use the verify-payment endpoint (automatic)
2. **With ngrok:** Check ngrok is running and `.env` has correct ngrok URL
3. Check Firestore permissions
4. Review backend console for errors

### Issue: IPN signature verification fails

**Symptoms:**
- Backend logs: "Invalid signature"
- Order not updating after payment

**Solutions:**
1. Verify `MOMO_SECRET_KEY` in `.env` is correct
2. Ensure no extra spaces in `.env` values
3. Check MoMo IPN is sending correct data
4. Review ngrok dashboard for IPN request details

### Issue: User not authenticated

**Symptoms:**
- "Please log in to continue" message
- Redirect to login page

**Solutions:**
1. Ensure user is logged in via Firebase Auth
2. Check Firebase configuration in checkout.html
3. Verify auth token is being sent to backend
4. Check auth middleware is working

### Issue: Product not found

**Symptoms:**
- Checkout page shows error state
- "Product not found" message

**Solutions:**
1. Verify product ID in URL is correct
2. Check product exists in Firestore
3. Ensure products API endpoint is working
4. Check product status is "available"

### Issue: ngrok URL keeps changing

**Solution:**
- Free ngrok URLs change on restart
- Sign up for free ngrok account to get longer-lasting URLs
- Or use paid ngrok for static domains
- For production, deploy to a real server

---

## 📊 Database Schema

### Orders Collection
```javascript
{
  id: "auto-generated",
  productId: "string",
  productName: "string",
  productPrice: number,
  sellerId: "string",
  buyerId: "string",
  quantity: number,
  totalAmount: number,
  shippingAddress: {
    fullName: "string",
    address: "string",
    phone: "string",
    city: "string",
    postalCode: "string"
  },
  status: "pending" | "paid" | "failed",
  paymentDetails: {
    transId: "string",
    payType: "string",
    paidAt: timestamp,
    resultCode: number,
    amount: number
  },
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### Transactions Collection
```javascript
{
  id: "auto-generated",
  orderId: "string",
  amount: number,
  currency: "VND",
  paymentMethod: "VNPAY",
  payeeId: "seller_uid",
  payerId: "buyer_uid",
  status: "pending",
  externalTransactionId: "string",
  txnDate: timestamp,
  address: {
    fullName: "string",
    address: "string",
    phone: "string"
  }
}
```

---

## 🚀 Production Deployment Checklist

Before deploying to production:

- [ ] Obtain real MoMo merchant credentials
- [ ] Update `MOMO_PARTNER_CODE`, `MOMO_ACCESS_KEY`, `MOMO_SECRET_KEY`
- [ ] Change `MOMO_API_ENDPOINT` to production endpoint
- [ ] Deploy backend to cloud service (Heroku, Railway, etc.)
- [ ] Update `MOMO_RETURN_URL` and `MOMO_IPN_URL` with production domain
- [ ] Ensure IPN URL uses HTTPS (required by MoMo)
- [ ] Test payment flow on staging environment
- [ ] Setup monitoring and error logging
- [ ] Configure proper Firestore security rules
- [ ] Enable Firebase Authentication production settings
- [ ] Test with small amounts first

---

## 📞 Support & Resources

- **MoMo Developer Portal:** https://developers.momo.vn/
- **MoMo API Documentation:** https://developers.momo.vn/#/docs/en/aiov2/
- **ngrok Documentation:** https://ngrok.com/docs
- **Firebase Documentation:** https://firebase.google.com/docs

---

## 🎉 Success!

Your MoMo payment integration is now complete! You can:
- ✅ Process payments securely
- ✅ Track orders in real-time
- ✅ Manage transactions
- ✅ Test locally with or without ngrok

Happy selling! 🛍️

