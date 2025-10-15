# 🧪 MoMo Integration Testing Checklist

## Quick Start Testing (5 Minutes)

### Step 1: Start the Server
```bash
cd backend
npm run dev
```
✅ Server should start on http://localhost:4000

### Step 2: Test Buy Now Flow
1. Open browser: `http://localhost:4000/pages/product_list.html`
2. Click any product
3. Click "Buy Now" button
4. ✅ Should redirect to checkout page

### Step 3: Complete Checkout
1. Fill in shipping form:
   - Full Name: **Test User**
   - Phone: **0912345678**
   - Address: **123 Test Street**
   - City: **Ho Chi Minh City** (optional)
   - Postal Code: **700000** (optional)
2. Click "Proceed to Payment"
3. ✅ Should redirect to MoMo payment page

### Step 4: Complete Payment
1. On MoMo test page, complete payment
2. ✅ Should redirect to success page
3. ✅ Success page should show "Verifying payment..."
4. ✅ After 2-5 seconds, should show "Payment Successful!"

---

## Detailed Testing Scenarios

### ✅ Scenario 1: Successful Payment (No ngrok)
**Expected Flow:**
- [x] Product page loads correctly
- [x] Buy Now redirects to checkout
- [x] Product details display on checkout
- [x] Form validation works
- [x] Payment URL generated
- [x] Redirect to MoMo
- [x] Complete payment on MoMo
- [x] Redirect to success page
- [x] Payment verification runs automatically
- [x] Order status updated to "paid"
- [x] Product quantity decreased
- [x] Transaction record created

**How to Verify:**
1. Check Firestore → Orders collection → Find your order
2. Status should be "paid"
3. Check Firestore → Products collection → Quantity should decrease
4. Check Firestore → Transactions collection → New transaction created

---

### ✅ Scenario 2: Form Validation
**Test Cases:**

1. **Empty Fields**
   - Leave Full Name empty → Click submit
   - ✅ Should show "Full name is required"

2. **Invalid Phone**
   - Enter "123" → Click submit
   - ✅ Should show "Phone number must be 10-11 digits"

3. **Empty Address**
   - Leave address empty → Click submit
   - ✅ Should show "Address is required"

4. **Valid Form**
   - Fill all required fields → Click submit
   - ✅ Should proceed to payment

---

### ✅ Scenario 3: Authentication Check
**Test Case: Not Logged In**
1. Open incognito/private window
2. Go to product page → Buy Now → Fill checkout
3. Click "Proceed to Payment"
4. ✅ Should show "Please log in to continue"
5. ✅ Should redirect to login page after 2 seconds

**Test Case: Logged In**
1. Login first
2. Go to product page → Buy Now
3. ✅ Should see user email in console
4. ✅ Payment should proceed normally

---

### ✅ Scenario 4: Product Unavailable
**Test Case:**
1. In Firestore, change a product's status to "sold"
2. Try to buy that product
3. ✅ Should show error: "This product is currently sold"

**Test Case:**
1. Set product quantity to 0
2. Try to buy
3. ✅ Should show error: "Only 0 item(s) available"

---

### ✅ Scenario 5: Payment Failure
**Test Case:**
1. Start checkout process
2. On MoMo page, cancel payment or use invalid card
3. ✅ Should redirect to success page
4. ✅ Should show "Payment Failed" or "Payment Processing"
5. ✅ Order status should be "failed" or "pending"

---

### ✅ Scenario 6: With ngrok (IPN Testing)

**Setup:**
```bash
# Terminal 1: Start backend
cd backend
npm run dev

# Terminal 2: Start ngrok
ngrok http 4000
```

**Update .env:**
```env
MOMO_RETURN_URL=https://YOUR_NGROK_URL.ngrok-free.app/pages/order-success.html
MOMO_IPN_URL=https://YOUR_NGROK_URL.ngrok-free.app/api/payment/momo_ipn
```

**Restart backend** (to load new .env)

**Test:**
1. Complete a purchase
2. Open ngrok dashboard: `http://127.0.0.1:4040`
3. ✅ Should see POST request to `/api/payment/momo_ipn`
4. ✅ Check backend console for IPN logs
5. ✅ Order should update immediately after payment

---

### ✅ Scenario 7: Manual IPN Testing

**Using PowerShell:**
```powershell
$body = @{
    orderId = "YOUR_ORDER_ID_HERE"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:4000/api/payment/momo_ipn_test" `
  -Method Post `
  -ContentType "application/json" `
  -Body $body
```

**Using curl:**
```bash
curl -X POST http://localhost:4000/api/payment/momo_ipn_test \
  -H "Content-Type: application/json" \
  -d '{"orderId": "YOUR_ORDER_ID_HERE"}'
```

✅ Should return success
✅ Order status should change to "paid"
✅ Product quantity should decrease

---

### ✅ Scenario 8: Error Handling

**Test Network Error:**
1. Stop backend server
2. Try to submit checkout form
3. ✅ Should show error message
4. ✅ Should not redirect
5. ✅ Form should remain filled

**Test Invalid Product:**
1. Go to: `http://localhost:4000/pages/checkout.html?productId=invalid123`
2. ✅ Should show "Product not found" error state

**Test Missing Product ID:**
1. Go to: `http://localhost:4000/pages/checkout.html`
2. ✅ Should show error state

---

## 🔍 Verification Checklist

After completing a test purchase, verify:

### Backend Console
- [ ] Order creation log: `✅ [Orders Service] Order created with ID:`
- [ ] MoMo request log: `📤 [MoMo Service] Sending request to:`
- [ ] Payment URL log: `✅ [Orders] Payment URL generated:`
- [ ] (With ngrok) IPN received log: `📬 [MoMo IPN] Received IPN notification`
- [ ] Order update log: `✅ [MoMo IPN] Order updated to 'paid'`

### Firestore Database
- [ ] Orders collection has new document
- [ ] Order status is "paid"
- [ ] Order has paymentDetails filled
- [ ] Product quantity decreased
- [ ] Product status changed to "sold" (if quantity = 0)
- [ ] Transactions collection has new document
- [ ] Transaction has correct orderId, amount, addresses

### Frontend
- [ ] Checkout page displays product correctly
- [ ] Form validation works
- [ ] Loading state shows during submission
- [ ] Redirect to MoMo happens
- [ ] Success page verifies payment
- [ ] Success page shows order details

---

## 🐛 Common Issues & Quick Fixes

### Issue: "Product not found" on checkout
**Fix:** 
- Check product ID in URL
- Verify product exists in Firestore
- Check products API: `http://localhost:4000/products/PRODUCT_ID`

### Issue: Payment URL not generated
**Fix:**
- Check backend console for errors
- Verify .env file exists and has MoMo credentials
- Restart backend server

### Issue: Order stays "pending"
**Without ngrok:** This is normal! Success page will verify payment automatically.
**With ngrok:** 
- Check ngrok is running
- Verify .env has correct ngrok URL
- Check ngrok dashboard for IPN requests

### Issue: "Please log in" even though logged in
**Fix:**
- Check browser console for Firebase errors
- Verify Firebase config in checkout.html
- Try logout and login again
- Clear browser cache

### Issue: ngrok URL keeps changing
**Fix:**
- This is normal for free tier
- Sign up for ngrok account for longer URLs
- Update .env each time ngrok restarts

---

## 📊 Test Data

### Valid Test Data:
```
Full Name: Nguyen Van Test
Phone: 0912345678
Address: 123 Nguyen Hue Street, District 1
City: Ho Chi Minh City
Postal Code: 700000
```

### Invalid Test Data:
```
Phone: 123 (too short)
Phone: abc123 (contains letters)
Phone: 09123456789123 (too long)
```

---

## ✅ Final Checklist Before Production

- [ ] All test scenarios pass
- [ ] Real MoMo credentials configured
- [ ] Production URLs configured in .env
- [ ] HTTPS enabled for IPN URL
- [ ] Firestore security rules updated
- [ ] Error logging configured
- [ ] Test with small amounts first
- [ ] Backup database
- [ ] Document API endpoints
- [ ] Train support staff

---

## 🎯 Quick Debug Commands

### Check if order exists:
```
Firestore Console → Orders → Search by ID
```

### Check backend logs:
```
Look for logs with emojis:
✅ = Success
❌ = Error
📦 = Product operation
💳 = Payment operation
🔍 = Verification
```

### Test API endpoints:
```powershell
# Get all products
Invoke-RestMethod -Uri "http://localhost:4000/products"

# Get specific product
Invoke-RestMethod -Uri "http://localhost:4000/products/PRODUCT_ID"

# Verify payment (replace ORDER_ID)
Invoke-RestMethod -Uri "http://localhost:4000/api/orders/ORDER_ID/verify-payment"
```

---

## 🎉 Success Criteria

Your integration is working correctly if:
1. ✅ User can click Buy Now and reach checkout
2. ✅ Checkout form validates correctly
3. ✅ Payment URL is generated
4. ✅ User is redirected to MoMo
5. ✅ After payment, redirected to success page
6. ✅ Success page verifies and shows "Payment Successful"
7. ✅ Order status changes to "paid" in Firestore
8. ✅ Product quantity decreases
9. ✅ Transaction record is created
10. ✅ No errors in console

---

Happy Testing! 🚀

