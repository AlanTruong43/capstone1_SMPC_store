# Order Management System Implementation

## Overview
Complete implementation of order lifecycle management for SmartShopAI marketplace, supporting both buyers and sellers with full order tracking from payment to delivery confirmation.

## Order Lifecycle Flow

```
┌─────────┐    ┌────────────┐    ┌───────────┐    ┌───────────┐    ┌───────────┐
│ pending │ -> │    paid    │ -> │processing │ -> │ delivered │ -> │ completed │
└─────────┘    └────────────┘    └───────────┘    └───────────┘    └───────────┘
                     │                  │
                     ↓                  ↓
                [cancelled]        [cancelled]
```

### Status Definitions:
- **pending**: Order created, awaiting payment
- **paid**: Payment confirmed, waiting for seller to accept
- **processing**: Seller accepted and preparing order
- **delivered**: Seller marked as delivered, awaiting buyer confirmation
- **completed**: Buyer confirmed receipt, order finalized
- **cancelled**: Order cancelled by buyer, seller, or system (payment failed)

## Database Schema Changes

### New Fields in Orders Collection:

```javascript
{
  // Lifecycle status (NEW)
  orderStatus: 'pending|paid|processing|delivered|completed|cancelled',
  paymentStatus: 'pending|paid|failed',
  shippingStatus: 'not_shipped|delivered',
  
  // Timestamps (NEW)
  paidAt: timestamp,
  sellerConfirmedAt: timestamp,
  deliveredAt: timestamp,
  completedAt: timestamp,
  
  // Cancellation (NEW)
  cancelledBy: 'buyer|seller|system|null',
  cancelledAt: timestamp,
  cancellationReason: string,
  
  // Notes (NEW)
  sellerNotes: string,
  buyerNotes: string,
  
  // Status history for audit trail (NEW)
  statusHistory: [{
    status: string,
    changedBy: string, // userId or 'system'
    changedAt: timestamp,
    notes: string
  }]
}
```

## Backend Implementation

### New API Endpoints:

#### Seller Endpoints:
1. **PUT /api/orders/:orderId/seller/accept**
   - Accepts paid order (paid → processing)
   - Sets `sellerConfirmedAt` timestamp

2. **PUT /api/orders/:orderId/seller/deliver**
   - Marks order as delivered (processing → delivered)
   - Body: `{ notes?: string }`
   - Sets `deliveredAt` timestamp

3. **PUT /api/orders/:orderId/seller/cancel**
   - Cancels order (paid|processing → cancelled)
   - Body: `{ reason: string }` (required)
   - Only allowed before delivery

#### Buyer Endpoints:
1. **PUT /api/orders/:orderId/buyer/confirm-delivery**
   - Confirms receipt (delivered → completed)
   - Sets `completedAt` timestamp

2. **PUT /api/orders/:orderId/buyer/cancel**
   - Cancels order (paid → cancelled)
   - Body: `{ reason: string }` (required)
   - Only allowed when status is 'paid'

#### Enhanced Endpoints:
- **GET /api/orders/buyer/my-orders?status=paid** - Filter by status
- **GET /api/orders/seller/my-sales?status=processing** - Filter by status

### Updated Webhook Logic:

**PayOS Webhook** (`payos_routes.js`):
- Changed from setting `status: 'confirmed'` to `orderStatus: 'paid'`
- Now tracks status changes in `statusHistory`
- Payment success: `orderStatus: 'paid'`
- Payment failed: `orderStatus: 'cancelled'`

**MoMo Verify Payment** (`orders_routes.js`):
- Updated to use new `orderStatus` field
- Tracks all status changes with history

## Frontend Implementation

### New Pages:

#### 1. **seller_orders.html** - Seller Dashboard
- **Location**: `frontend/pages/seller_orders.html`
- **Purpose**: Sellers manage their sales and order fulfillment
- **Features**:
  - Tab-based filtering (All, Paid, Processing, Delivered, Completed, Cancelled)
  - Accept paid orders
  - Mark orders as delivered
  - Cancel orders with reason
  - View full order details and timeline
  - Real-time badge counts per status

#### 2. **buyer_orders.html** - Buyer Dashboard
- **Location**: `frontend/pages/buyer_orders.html`
- **Purpose**: Buyers track purchases and delivery
- **Features**:
  - Tab-based filtering (All, Paid, Processing, Delivered, Completed, Cancelled)
  - Confirm delivery receipt
  - Cancel paid orders with reason
  - View order timeline and shipping info
  - Payment details display

### New JavaScript Files:

#### 1. **seller_orders.js**
- **Location**: `frontend/js/seller_orders.js`
- **Functions**:
  - `loadOrders()` - Fetches seller's sales from API
  - `acceptOrder(orderId)` - Accepts paid order
  - `confirmDeliver()` - Marks order as delivered
  - `confirmCancel()` - Cancels order with reason
  - Real-time tab badge updates
  - Order detail modal with status timeline

#### 2. **buyer_orders.js**
- **Location**: `frontend/js/buyer_orders.js`
- **Functions**:
  - `loadOrders()` - Fetches buyer's orders from API
  - `confirmReceipt()` - Confirms delivery receipt
  - `confirmCancel()` - Cancels order with reason
  - Status-specific messaging (e.g., "Waiting for seller to process")
  - Order detail modal with payment and shipping info

### New CSS File:

**order_demo_manage.css**
- **Location**: `frontend/css/order_demo_manage.css`
- **Shared by**: Both seller_orders.html and buyer_orders.html
- **Features**:
  - Status tabs with badge counters
  - Order cards with status badges
  - Color-coded status indicators
  - Responsive grid layout
  - Modal dialogs (order details, confirm actions)
  - Status timeline visualization
  - Toast notifications
  - Mobile-responsive design

## Migration

### Migration Script:
**Location**: `backend/scripts/migrate_orders.js`

**Purpose**: One-time migration of existing orders to new schema

**What it does**:
1. Converts old `status` field to new `orderStatus` field
2. Maps `'confirmed'` → `'paid'`
3. Adds new lifecycle fields with defaults
4. Initializes `statusHistory` array
5. Removes old `status` field

**How to run**:
```bash
node backend/scripts/migrate_orders.js
```

**Safety**: 
- Skips already-migrated orders (idempotent)
- Provides detailed summary of migration
- No data loss - only adds/updates fields

## State Transition Rules

### Seller Allowed Transitions:
```javascript
paid → processing    // Accept order
paid → cancelled     // Cancel before processing
processing → delivered   // Mark as delivered
processing → cancelled   // Cancel before delivery
```

### Buyer Allowed Transitions:
```javascript
paid → cancelled     // Cancel paid order
delivered → completed    // Confirm receipt
```

### System Transitions:
```javascript
pending → paid       // Payment webhook
pending → cancelled  // Payment failed
```

## Testing Checklist

### Before Running Migration:
- [ ] Backup Firestore database
- [ ] Test migration script on development environment

### After Migration:
- [ ] Verify old orders display correctly
- [ ] Test new order creation
- [ ] Test PayOS payment webhook
- [ ] Test all seller actions (accept, deliver, cancel)
- [ ] Test all buyer actions (confirm delivery, cancel)
- [ ] Verify status history tracking
- [ ] Test filter tabs on both pages
- [ ] Test modal interactions
- [ ] Test responsive design on mobile

### Payment Gateway Testing:
- [ ] Complete PayOS payment flow
- [ ] Verify webhook updates orderStatus to 'paid'
- [ ] Confirm no breaking changes to existing payment

## Deployment Steps

1. **Backend Deployment:**
   ```bash
   # Deploy new backend code
   # Ensure new endpoints are accessible
   ```

2. **Run Migration:**
   ```bash
   node backend/scripts/migrate_orders.js
   ```

3. **Frontend Deployment:**
   ```bash
   # Deploy new HTML, CSS, and JS files
   # Update navigation links if needed
   ```

4. **Verification:**
   - Create test order and complete full lifecycle
   - Verify both seller and buyer dashboards work
   - Check existing orders still display correctly

## Key Features

### For Sellers:
✅ Accept paid orders
✅ Mark orders as delivered with optional notes
✅ Cancel orders before delivery with reason
✅ View buyer contact information
✅ Track order timeline and history
✅ Filter orders by status
✅ Real-time order counts

### For Buyers:
✅ Track order progress in real-time
✅ Confirm delivery receipt
✅ Cancel paid orders with reason
✅ View shipping address and payment details
✅ See order status timeline
✅ Filter orders by status
✅ Status-specific messaging

### System Features:
✅ Complete audit trail via statusHistory
✅ Status transition validation
✅ Authorization checks (buyer/seller verification)
✅ Toast notifications for all actions
✅ Modal confirmations for destructive actions
✅ Responsive design for mobile
✅ Integration with existing auth system

## Files Changed/Created

### Backend:
- ✏️ Modified: `backend/src/modules/orders/orders_service.js`
- ✏️ Modified: `backend/src/modules/orders/orders_routes.js`
- ✏️ Modified: `backend/src/modules/payos/payos_routes.js`
- ➕ Created: `backend/scripts/migrate_orders.js`

### Frontend:
- ➕ Created: `frontend/pages/seller_orders.html`
- ➕ Created: `frontend/pages/buyer_orders.html`
- ➕ Created: `frontend/css/order_demo_manage.css`
- ➕ Created: `frontend/js/seller_orders.js`
- ➕ Created: `frontend/js/buyer_orders.js`

## Notes

- **No breaking changes** to existing payment flow
- **Backward compatible** with old orders after migration
- **Refund system** intentionally skipped for this phase
- **Tracking numbers** not implemented (simplified flow)
- **Auto-delivery confirmation** not implemented (manual only)
- **Email notifications** not implemented yet

## Future Enhancements

Consider adding later:
- Email/SMS notifications on status changes
- Tracking number support
- Auto-delivery confirmation after X days
- Refund request and processing workflow
- Order dispute resolution
- Bulk order management for sellers
- Order export functionality
- Advanced filtering and search

---

**Implementation Date**: October 30, 2025
**Version**: 1.0
**Status**: ✅ Complete and Ready for Testing

