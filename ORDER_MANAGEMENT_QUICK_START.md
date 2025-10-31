# Order Management System - Quick Start Guide

## 🚀 How to Deploy

### Step 1: Run Migration Script
```bash
cd D:\SMARTSHOPAI\capstone1_SMPC_store\backend
node scripts/migrate_orders.js
```

**What it does**: Converts existing orders from old schema to new schema
**Safe to run**: Yes, it's idempotent (won't duplicate changes)

### Step 2: Restart Backend Server
```bash
cd D:\SMARTSHOPAI\capstone1_SMPC_store\backend
node src/index.js
```

### Step 3: Access New Pages
- **Seller Dashboard**: http://localhost:4000/pages/seller_orders.html
- **Buyer Dashboard**: http://localhost:4000/pages/buyer_orders.html

---

## 📝 Quick Testing Guide

### Test Seller Flow:
1. Make a test purchase (complete PayOS payment)
2. Go to `seller_orders.html`
3. Click "Accept Order" on paid order
4. Click "Mark as Delivered"
5. Verify order shows as "Delivered"

### Test Buyer Flow:
1. After seller delivers, go to `buyer_orders.html`
2. Click "Confirm Receipt"
3. Verify order shows as "Completed"

### Test Cancellation:
1. Make a new test purchase
2. As buyer: Go to buyer_orders.html → Click "Cancel Order"
3. Provide reason and confirm
4. Verify order shows as "Cancelled"

---

## 🔧 Troubleshooting

### Issue: "Order not found"
**Solution**: Make sure migration script ran successfully

### Issue: "Authorization failed"
**Solution**: User must be logged in. Check Firebase auth token.

### Issue: Orders not showing
**Solution**: 
1. Check browser console for errors
2. Verify API endpoint returns data (test in browser network tab)
3. Ensure user has orders in database

### Issue: Can't change status
**Solution**: Check if transition is allowed:
- Buyer can only cancel when status = "paid"
- Seller can only deliver when status = "processing"
- See ORDER_MANAGEMENT_IMPLEMENTATION.md for all rules

---

## 📊 Order Status Flow (Quick Reference)

```
BUYER MAKES PURCHASE
         ↓
    [pending] ← Order created
         ↓
    [paid] ← Payment confirmed (webhook)
         ↓
    [processing] ← Seller clicks "Accept Order"
         ↓
    [delivered] ← Seller clicks "Mark as Delivered"
         ↓
    [completed] ← Buyer clicks "Confirm Receipt"
```

**Cancellation Points:**
- Buyer can cancel at: **paid**
- Seller can cancel at: **paid** or **processing**
- System cancels at: **pending** (if payment fails)

---

## 🎯 New API Endpoints

### Seller Actions:
```javascript
PUT /api/orders/:orderId/seller/accept
PUT /api/orders/:orderId/seller/deliver
  Body: { notes: "Optional notes" }
PUT /api/orders/:orderId/seller/cancel
  Body: { reason: "Required reason" }
```

### Buyer Actions:
```javascript
PUT /api/orders/:orderId/buyer/confirm-delivery
PUT /api/orders/:orderId/buyer/cancel
  Body: { reason: "Required reason" }
```

### Get Orders (with filtering):
```javascript
GET /api/orders/seller/my-sales?status=paid
GET /api/orders/buyer/my-orders?status=delivered
```

---

## 🗂️ Files You Need to Know

### Backend:
- `backend/src/modules/orders/orders_routes.js` - All order endpoints
- `backend/src/modules/orders/orders_service.js` - Order logic
- `backend/scripts/migrate_orders.js` - Migration script

### Frontend:
- `frontend/pages/seller_orders.html` - Seller dashboard
- `frontend/pages/buyer_orders.html` - Buyer dashboard
- `frontend/js/seller_orders.js` - Seller logic
- `frontend/js/buyer_orders.js` - Buyer logic
- `frontend/css/order_demo_manage.css` - Shared styles

---

## ⚠️ Important Notes

1. **Run migration ONCE** before deploying to production
2. **Backup database** before running migration
3. **Test on development** first
4. **PayOS webhook** now sets `orderStatus: 'paid'` (not 'confirmed')
5. **Old orders** will be migrated automatically by script

---

## 💡 Tips

- Use browser DevTools Network tab to debug API calls
- Check backend console for detailed error logs
- Status badges are color-coded for easy identification
- All modals require user confirmation for destructive actions
- Toast notifications appear for 3 seconds after each action

---

## 🎨 Status Colors

- **Pending**: Gray
- **Paid**: Blue
- **Processing**: Yellow/Orange
- **Delivered**: Purple
- **Completed**: Green
- **Cancelled**: Red

---

## 📞 Need Help?

Check these files for detailed information:
- `ORDER_MANAGEMENT_IMPLEMENTATION.md` - Full technical documentation
- Backend console logs - Detailed error messages
- Browser console - Frontend error messages

---

**Ready to go!** 🚀

Just run the migration script and start testing!

