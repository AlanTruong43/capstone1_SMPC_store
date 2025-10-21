const { db, admin } = require('../../config/firebase');
const stripeService = require('./stripe.service');
const { getOrderById, updateOrderStatus } = require('../orders/orders_service');

/**
 * Stripe Controller
 * Handles business logic for Stripe payment operations
 */

/**
 * Creates a Stripe Payment Intent for an order
 * @route POST /api/payments/stripe/create
 */
async function createPayment(req, res) {
  try {
    const { orderId, amount, currency = 'vnd', description } = req.body;
    const userId = req.user.uid; // From requireAuth middleware

    // Validate required fields
    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    console.log('💳 [Stripe Controller] Creating payment for order:', orderId);
    console.log('👤 [Stripe Controller] User:', userId);

    // Verify order exists and belongs to user
    const order = await getOrderById(orderId);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Verify user is the buyer
    if (order.buyerId !== userId) {
      return res.status(403).json({ error: 'You are not authorized to pay for this order' });
    }

    // Check if order is already paid
    if (order.status === 'paid' || order.status === 'completed') {
      return res.status(400).json({ 
        error: 'Order is already paid',
        status: order.status 
      });
    }

    // Validate amount matches order
    // For VND currency, Stripe requires minimum 10,000 (100.00 VND)
    const expectedAmount = currency.toLowerCase() === 'vnd' 
      ? Math.round(order.totalAmount) // VND doesn't use decimal places
      : Math.round(order.totalAmount * 100); // Convert to cents for USD, EUR, etc.

    if (Math.abs(amount - expectedAmount) > 1) { // Allow 1 unit tolerance for rounding
      console.warn('⚠️ [Stripe Controller] Amount mismatch:', { provided: amount, expected: expectedAmount });
      return res.status(400).json({ 
        error: 'Payment amount does not match order total',
        expected: expectedAmount,
        provided: amount
      });
    }

    // Create Payment Intent via Stripe service
    const paymentIntent = await stripeService.createPaymentIntent({
      amount: expectedAmount,
      currency,
      orderId,
      description: description || `Payment for order ${orderId} - ${order.productName}`,
      metadata: {
        orderId,
        buyerId: userId,
        sellerId: order.sellerId,
        productId: order.productId,
        productName: order.productName,
      }
    });

    // Store payment metadata in Firestore
    const paymentData = {
      paymentIntentId: paymentIntent.paymentIntentId,
      provider: 'stripe',
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
      orderId: orderId,
      buyerId: userId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Store in subcollection: orders/{orderId}/payments/{paymentId}
    await db.collection('orders')
      .doc(orderId)
      .collection('payments')
      .doc(paymentIntent.paymentIntentId)
      .set(paymentData);

    // Also update order with payment provider info
    await db.collection('orders').doc(orderId).update({
      paymentProvider: 'stripe',
      paymentIntentId: paymentIntent.paymentIntentId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('✅ [Stripe Controller] Payment Intent created successfully');

    // Return client secret for frontend
    res.json({
      success: true,
      clientSecret: paymentIntent.clientSecret,
      paymentIntentId: paymentIntent.paymentIntentId,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
    });

  } catch (error) {
    console.error('❌ [Stripe Controller] Payment creation failed:', error.message);
    res.status(500).json({ 
      error: 'Failed to create payment',
      detail: error.message 
    });
  }
}

/**
 * Handles Stripe webhook events
 * @route POST /api/payments/stripe/webhook
 */
async function handleWebhook(req, res) {
  try {
    const signature = req.headers['stripe-signature'];
    const rawBody = req.rawBody; // Must be raw body, not parsed JSON

    if (!rawBody) {
      console.error('❌ [Stripe Controller] Missing raw body for webhook');
      return res.status(400).json({ error: 'Missing request body' });
    }

    // Verify webhook signature
    const event = stripeService.verifyWebhookSignature(rawBody, signature);

    console.log('📨 [Stripe Controller] Webhook received:', event.type);

    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(event.data.object);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentFailure(event.data.object);
        break;

      case 'payment_intent.canceled':
        await handlePaymentCanceled(event.data.object);
        break;

      case 'charge.refunded':
        await handleRefund(event.data.object);
        break;

      default:
        console.log('⚠️ [Stripe Controller] Unhandled event type:', event.type);
    }

    // Return 200 to acknowledge receipt
    res.json({ received: true });

  } catch (error) {
    console.error('❌ [Stripe Controller] Webhook handling failed:', error.message);
    res.status(400).json({ 
      error: 'Webhook processing failed',
      detail: error.message 
    });
  }
}

/**
 * Handles successful payment
 */
async function handlePaymentSuccess(paymentIntent) {
  try {
    const orderId = paymentIntent.metadata.orderId;

    if (!orderId) {
      console.error('❌ [Stripe Controller] No orderId in payment metadata');
      return;
    }

    console.log('✅ [Stripe Controller] Payment succeeded for order:', orderId);

    // Update payment record in Firestore
    await db.collection('orders')
      .doc(orderId)
      .collection('payments')
      .doc(paymentIntent.id)
      .update({
        status: 'succeeded',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    // Update order status to 'paid'
    await updateOrderStatus(orderId, 'paid');

    // Store payment details in order
    await db.collection('orders').doc(orderId).update({
      paymentDetails: {
        provider: 'stripe',
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: 'succeeded',
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('✅ [Stripe Controller] Order marked as paid:', orderId);

  } catch (error) {
    console.error('❌ [Stripe Controller] Failed to handle payment success:', error.message);
  }
}

/**
 * Handles failed payment
 */
async function handlePaymentFailure(paymentIntent) {
  try {
    const orderId = paymentIntent.metadata.orderId;

    if (!orderId) {
      console.error('❌ [Stripe Controller] No orderId in payment metadata');
      return;
    }

    console.log('❌ [Stripe Controller] Payment failed for order:', orderId);

    // Update payment record
    await db.collection('orders')
      .doc(orderId)
      .collection('payments')
      .doc(paymentIntent.id)
      .update({
        status: 'failed',
        failureReason: paymentIntent.last_payment_error?.message || 'Unknown error',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    // Optionally update order status
    // await updateOrderStatus(orderId, 'payment_failed');

    console.log('📝 [Stripe Controller] Payment failure logged for order:', orderId);

  } catch (error) {
    console.error('❌ [Stripe Controller] Failed to handle payment failure:', error.message);
  }
}

/**
 * Handles canceled payment
 */
async function handlePaymentCanceled(paymentIntent) {
  try {
    const orderId = paymentIntent.metadata.orderId;

    if (!orderId) {
      console.error('❌ [Stripe Controller] No orderId in payment metadata');
      return;
    }

    console.log('🚫 [Stripe Controller] Payment canceled for order:', orderId);

    // Update payment record
    await db.collection('orders')
      .doc(orderId)
      .collection('payments')
      .doc(paymentIntent.id)
      .update({
        status: 'canceled',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

  } catch (error) {
    console.error('❌ [Stripe Controller] Failed to handle payment cancellation:', error.message);
  }
}

/**
 * Handles refund
 */
async function handleRefund(charge) {
  try {
    const paymentIntentId = charge.payment_intent;

    if (!paymentIntentId) {
      console.error('❌ [Stripe Controller] No payment intent ID in refund');
      return;
    }

    console.log('💸 [Stripe Controller] Refund processed for payment:', paymentIntentId);

    // Find order by payment intent ID
    const ordersSnapshot = await db.collection('orders')
      .where('paymentIntentId', '==', paymentIntentId)
      .limit(1)
      .get();

    if (ordersSnapshot.empty) {
      console.warn('⚠️ [Stripe Controller] No order found for refunded payment:', paymentIntentId);
      return;
    }

    const orderDoc = ordersSnapshot.docs[0];
    const orderId = orderDoc.id;

    // Update order status to refunded
    await db.collection('orders').doc(orderId).update({
      status: 'refunded',
      refundDetails: {
        refundId: charge.refunds.data[0]?.id,
        amount: charge.amount_refunded,
        refundedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('✅ [Stripe Controller] Order marked as refunded:', orderId);

  } catch (error) {
    console.error('❌ [Stripe Controller] Failed to handle refund:', error.message);
  }
}

/**
 * Admin endpoint to create a refund
 * @route POST /api/payments/stripe/refund
 */
async function createRefund(req, res) {
  try {
    const { orderId, amount, reason } = req.body;

    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    console.log('💸 [Stripe Controller] Creating refund for order:', orderId);

    // Get order and verify payment
    const orderDoc = await db.collection('orders').doc(orderId).get();
    
    if (!orderDoc.exists) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderDoc.data();

    if (!order.paymentIntentId || order.paymentProvider !== 'stripe') {
      return res.status(400).json({ error: 'Order was not paid with Stripe' });
    }

    if (order.status === 'refunded') {
      return res.status(400).json({ error: 'Order is already refunded' });
    }

    // Create refund via Stripe service
    const refund = await stripeService.createRefund(
      order.paymentIntentId,
      amount, // null = full refund
      reason || 'requested_by_customer'
    );

    console.log('✅ [Stripe Controller] Refund created:', refund.refundId);

    res.json({
      success: true,
      refund: refund,
      message: 'Refund processed successfully'
    });

  } catch (error) {
    console.error('❌ [Stripe Controller] Refund creation failed:', error.message);
    res.status(500).json({ 
      error: 'Failed to create refund',
      detail: error.message 
    });
  }
}

/**
 * Gets payment status for an order
 * @route GET /api/payments/stripe/status/:orderId
 */
async function getPaymentStatus(req, res) {
  try {
    const { orderId } = req.params;
    const userId = req.user.uid;

    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    // Get order
    const order = await getOrderById(orderId);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Verify user is buyer or seller
    if (order.buyerId !== userId && order.sellerId !== userId) {
      return res.status(403).json({ error: 'Not authorized to view this payment' });
    }

    // Get payment details
    const paymentsSnapshot = await db.collection('orders')
      .doc(orderId)
      .collection('payments')
      .where('provider', '==', 'stripe')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (paymentsSnapshot.empty) {
      return res.status(404).json({ error: 'No Stripe payment found for this order' });
    }

    const paymentDoc = paymentsSnapshot.docs[0];
    const payment = paymentDoc.data();

    res.json({
      orderId,
      payment: {
        paymentIntentId: payment.paymentIntentId,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        createdAt: payment.createdAt,
        completedAt: payment.completedAt || null,
      },
      orderStatus: order.status,
    });

  } catch (error) {
    console.error('❌ [Stripe Controller] Failed to get payment status:', error.message);
    res.status(500).json({ 
      error: 'Failed to get payment status',
      detail: error.message 
    });
  }
}

module.exports = {
  createPayment,
  handleWebhook,
  createRefund,
  getPaymentStatus,
};
