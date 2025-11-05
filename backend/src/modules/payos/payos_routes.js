const express = require('express');
const router = express.Router();
const { db } = require('../../config/firebase');
const admin = require('../../config/firebase').admin;
const { requireAuth } = require('../../middlewares/auth_middleware');
const payosService = require('./payos');

/**
 * POST /api/payments/payos/create
 * Creates a PayOS payment link for an order
 * Requires authentication
 */
router.post('/create', requireAuth, async (req, res) => {
  try {
    console.log('📦 [PayOS Routes] Raw request body:', req.body);
    const { orderId, amount } = req.body;
    const userId = req.user.uid;

    console.log('📦 [PayOS Routes] Create payment request:', { orderId, amount, userId });

    // Validate input
    if (!orderId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: orderId, amount'
      });
    }

    // Verify order exists and belongs to user
    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const orderData = orderSnap.data();

    // Verify the user owns this order
    if (orderData.buyerId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Order does not belong to user'
      });
    }

    // Check if order is already paid
    if (orderData.paymentStatus === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Order is already paid'
      });
    }

    // Create payment link with PayOS
    // PayOS requires description to be max 25 characters
    const maxDescLength = 25;
    const productName = orderData.productName || '';
    
    // Build description: prefer product name if short enough, otherwise use order ID
    let description;
    if (productName && productName.length <= 12) {
      description = `Order ${productName}`;
    } else {
      // Use order ID (truncate if needed to fit)
      const orderIdShort = orderId.length > 19 ? orderId.substring(0, 19) : orderId;
      description = `Order ${orderIdShort}`;
    }
    
    // Ensure description never exceeds 25 characters
    description = description.substring(0, maxDescLength);
    
    const paymentResult = await payosService.createPaymentLink({
      orderId: orderId,
      amount: amount,
      description: description,
      buyerName: orderData.shippingAddress?.fullName || 'Customer',
      returnUrl: `${process.env.FRONTEND_URL || 'http://localhost:4000'}/pages/order-success.html?orderId=${orderId}`,
      cancelUrl: `${process.env.FRONTEND_URL || 'http://localhost:4000'}/pages/checkout.html?productId=${orderData.productId}`
    });

    // Update order with PayOS order code and payment details
    await orderRef.update({
      payosOrderCode: paymentResult.payosOrderCode,
      paymentMethod: 'payos',
      paymentStatus: 'pending',
      paymentDetails: {
        provider: 'payos',
        orderCode: paymentResult.payosOrderCode,
        amount: paymentResult.amount,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('✅ [PayOS Routes] Payment link created and order updated');

    // Return payment URL to frontend
    return res.status(200).json({
      success: true,
      checkoutUrl: paymentResult.checkoutUrl,
      payosOrderCode: paymentResult.payosOrderCode,
      qrCode: paymentResult.qrCode,
      message: 'Payment link created successfully'
    });

  } catch (error) {
    console.error('❌ [PayOS Routes] Create payment error:', error.message);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create payment link',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * POST /api/payments/payos/webhook
 * Webhook endpoint to receive payment notifications from PayOS
 * No authentication required (but signature verification is critical)
 */
router.post('/webhook', express.json(), async (req, res) => {
  try {
    console.log('🔔 [PayOS Webhook] Received webhook notification');
    console.log('📥 [PayOS Webhook] Payload:', JSON.stringify(req.body, null, 2));

    const webhookData = req.body;

    // Verify webhook signature to ensure it's from PayOS
    let verifiedData;
    try {
      verifiedData = payosService.verifyWebhookSignature(webhookData);
      console.log('✅ [PayOS Webhook] Signature verified');
    } catch (error) {
      console.error('❌ [PayOS Webhook] Invalid signature');
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook signature'
      });
    }

    // Extract payment information
    const { orderCode, code, desc, data } = verifiedData;
    
    console.log('📝 [PayOS Webhook] Order code:', orderCode);
    console.log('📝 [PayOS Webhook] Status code:', code);
    console.log('📝 [PayOS Webhook] Description:', desc);

    // Find order by PayOS order code
    const ordersSnapshot = await db.collection('orders')
      .where('payosOrderCode', '==', orderCode)
      .limit(1)
      .get();

    if (ordersSnapshot.empty) {
      console.error('❌ [PayOS Webhook] Order not found for order code:', orderCode);
      // Still return success to prevent PayOS from retrying
      return res.status(200).json({
        success: true,
        message: 'Order not found but acknowledged'
      });
    }

    const orderDoc = ordersSnapshot.docs[0];
    const orderId = orderDoc.id;
    const orderData = orderDoc.data();

    console.log('📦 [PayOS Webhook] Found order:', orderId);

    // Check if already processed (idempotency check)
    if (orderData.paymentStatus === 'paid') {
      console.log('⚠️ [PayOS Webhook] Order already marked as paid');
      return res.status(200).json({
        success: true,
        message: 'Order already processed'
      });
    }

    // Process based on payment status
    // code === '00' means success in PayOS
    if (code === '00') {
      console.log('✅ [PayOS Webhook] Payment successful');

      // Get current status history
      const statusHistory = orderData.statusHistory || [];
      statusHistory.push({
        status: 'paid',
        changedBy: 'system',
        changedAt: admin.firestore.Timestamp.now(),
        notes: 'Payment confirmed via PayOS webhook'
      });

      // Update order to paid (NEW SCHEMA)
      await db.collection('orders').doc(orderId).update({
        paymentStatus: 'paid',
        orderStatus: 'paid', // NEW: Changed from 'confirmed' to 'paid'
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
        paymentDetails: {
          ...orderData.paymentDetails,
          transactionId: data?.transactionDateTime || null,
          paidAmount: data?.amount || orderData.totalAmount,
          paymentMethod: 'payos',
          completedAt: admin.firestore.FieldValue.serverTimestamp()
        },
        statusHistory: statusHistory, // NEW: Track status changes
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log('✅ [PayOS Webhook] Order updated to paid status');

      // TODO: Send confirmation email, update inventory, etc.

    } else {
      console.log('❌ [PayOS Webhook] Payment failed or cancelled');

      // Get current status history
      const statusHistory = orderData.statusHistory || [];
      statusHistory.push({
        status: 'cancelled',
        changedBy: 'system',
        changedAt: admin.firestore.Timestamp.now(),
        notes: `Payment failed: ${desc || 'Unknown reason'}`
      });

      // Update order to failed (NEW SCHEMA)
      await db.collection('orders').doc(orderId).update({
        paymentStatus: 'failed',
        orderStatus: 'cancelled', // NEW: Use orderStatus
        cancelledBy: 'system',
        cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        cancellationReason: desc || 'Payment failed',
        paymentDetails: {
          ...orderData.paymentDetails,
          failureReason: desc || 'Payment failed',
          failedAt: admin.firestore.FieldValue.serverTimestamp()
        },
        statusHistory: statusHistory, // NEW: Track status changes
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log('⚠️ [PayOS Webhook] Order marked as failed');
    }

    // Acknowledge webhook receipt
    return res.status(200).json({
      success: true,
      message: 'Webhook processed successfully'
    });

  } catch (error) {
    console.error('❌ [PayOS Webhook] Processing error:', error.message);
    console.error('❌ [PayOS Webhook] Stack:', error.stack);
    
    // Return success to prevent PayOS from retrying infinitely
    // Log the error for manual investigation
    return res.status(200).json({
      success: true,
      message: 'Webhook acknowledged with error'
    });
  }
});

/**
 * GET /api/payments/payos/status/:orderCode
 * Checks payment status for an order code
 * Requires authentication
 */
router.get('/status/:orderCode', requireAuth, async (req, res) => {
  try {
    const { orderCode } = req.params;
    const userId = req.user.uid;

    console.log('🔍 [PayOS Routes] Status check request:', { orderCode, userId });

    // Get payment info from PayOS
    const paymentInfo = await payosService.getPaymentLinkInfo(Number(orderCode));

    // Find order in database
    const ordersSnapshot = await db.collection('orders')
      .where('payosOrderCode', '==', Number(orderCode))
      .limit(1)
      .get();

    if (ordersSnapshot.empty) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const orderDoc = ordersSnapshot.docs[0];
    const orderData = orderDoc.data();

    // Verify user owns the order
    if (orderData.buyerId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    return res.status(200).json({
      success: true,
      paymentInfo: paymentInfo,
      orderStatus: orderData.status,
      paymentStatus: orderData.paymentStatus
    });

  } catch (error) {
    console.error('❌ [PayOS Routes] Status check error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to check payment status'
    });
  }
});

module.exports = router;

