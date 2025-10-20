const Stripe = require('stripe');

/**
 * Stripe Payment Service
 * Handles payment intent creation and webhook verification
 * Following the same pattern as MoMo service
 */

// Initialize Stripe with secret key from environment
let stripe = null;

function initializeStripe() {
  if (!stripe) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('Missing STRIPE_SECRET_KEY in environment variables');
    }
    stripe = new Stripe(secretKey, {
      apiVersion: '2024-12-18.acacia', // Latest stable version
    });
    console.log('✅ [Stripe Service] Initialized successfully');
  }
  return stripe;
}

/**
 * Creates a Stripe Payment Intent
 * @param {Object} params - Payment parameters
 * @param {number} params.amount - Payment amount in smallest currency unit (cents for USD, etc.)
 * @param {string} params.currency - Currency code (e.g., 'usd', 'vnd')
 * @param {string} params.orderId - Unique order ID
 * @param {string} params.description - Payment description
 * @param {Object} params.metadata - Additional metadata to store with the payment
 * @returns {Promise<Object>} Payment intent with client secret
 */
async function createPaymentIntent({ amount, currency = 'VND', orderId, description, metadata = {} }) {
  try {
    const stripeClient = initializeStripe();

    // Validate amount
    if (!amount || amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    // Validate orderId
    if (!orderId) {
      throw new Error('Order ID is required');
    }

    console.log('💳 [Stripe Service] Creating Payment Intent for order:', orderId);
    console.log('💰 [Stripe Service] Amount:', amount, currency.toUpperCase());

    // Create payment intent
    const paymentIntent = await stripeClient.paymentIntents.create({
      amount: Math.round(amount), // Ensure integer
      currency: currency.toLowerCase(),
      description: description || `Payment for order ${orderId}`,
      metadata: {
        orderId,
        ...metadata,
      },
      // Automatically capture payment when authorized
      capture_method: 'automatic',
      // Payment confirmation method
      confirmation_method: 'automatic',
    });

    console.log('✅ [Stripe Service] Payment Intent created:', paymentIntent.id);

    return {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
    };

  } catch (error) {
    console.error('❌ [Stripe Service] Payment Intent creation failed:', error.message);
    
    // Handle Stripe-specific errors
    if (error.type === 'StripeCardError') {
      throw new Error(`Card error: ${error.message}`);
    } else if (error.type === 'StripeInvalidRequestError') {
      throw new Error(`Invalid request: ${error.message}`);
    } else if (error.type === 'StripeAPIError') {
      throw new Error('Stripe API error. Please try again.');
    } else if (error.type === 'StripeConnectionError') {
      throw new Error('Network error. Please check your connection.');
    } else {
      throw new Error(`Payment creation failed: ${error.message}`);
    }
  }
}

/**
 * Verifies Stripe webhook signature
 * @param {string} rawBody - Raw request body (must be raw, not parsed JSON)
 * @param {string} signature - Stripe signature from request headers
 * @returns {Object} Verified event object
 * @throws {Error} If signature verification fails
 */
function verifyWebhookSignature(rawBody, signature) {
  try {
    const stripeClient = initializeStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      throw new Error('Missing STRIPE_WEBHOOK_SECRET in environment variables');
    }

    if (!signature) {
      console.error('❌ [Stripe Service] No signature in webhook request');
      throw new Error('Missing Stripe signature');
    }

    console.log('🔐 [Stripe Service] Verifying webhook signature');

    // Construct and verify the event
    const event = stripeClient.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret
    );

    console.log('✅ [Stripe Service] Webhook signature verified');
    console.log('📨 [Stripe Service] Event type:', event.type);

    return event;

  } catch (error) {
    console.error('❌ [Stripe Service] Webhook signature verification failed:', error.message);
    throw new Error(`Webhook verification failed: ${error.message}`);
  }
}

/**
 * Retrieves a Payment Intent by ID
 * @param {string} paymentIntentId - Payment Intent ID
 * @returns {Promise<Object>} Payment Intent details
 */
async function getPaymentIntent(paymentIntentId) {
  try {
    const stripeClient = initializeStripe();

    console.log('🔍 [Stripe Service] Retrieving Payment Intent:', paymentIntentId);

    const paymentIntent = await stripeClient.paymentIntents.retrieve(paymentIntentId);

    return {
      id: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
      metadata: paymentIntent.metadata,
      created: paymentIntent.created,
    };

  } catch (error) {
    console.error('❌ [Stripe Service] Failed to retrieve Payment Intent:', error.message);
    throw new Error(`Failed to retrieve payment: ${error.message}`);
  }
}

/**
 * Creates a refund for a payment
 * @param {string} paymentIntentId - Payment Intent ID to refund
 * @param {number} amount - Amount to refund (optional, defaults to full amount)
 * @param {string} reason - Reason for refund (optional)
 * @returns {Promise<Object>} Refund details
 */
async function createRefund(paymentIntentId, amount = null, reason = 'requested_by_customer') {
  try {
    const stripeClient = initializeStripe();

    console.log('💸 [Stripe Service] Creating refund for Payment Intent:', paymentIntentId);

    const refundData = {
      payment_intent: paymentIntentId,
      reason: reason,
    };

    // If amount is specified, do partial refund
    if (amount) {
      refundData.amount = Math.round(amount);
    }

    const refund = await stripeClient.refunds.create(refundData);

    console.log('✅ [Stripe Service] Refund created:', refund.id);

    return {
      refundId: refund.id,
      amount: refund.amount,
      currency: refund.currency,
      status: refund.status,
      reason: refund.reason,
    };

  } catch (error) {
    console.error('❌ [Stripe Service] Refund creation failed:', error.message);
    throw new Error(`Refund failed: ${error.message}`);
  }
}

module.exports = {
  createPaymentIntent,
  verifyWebhookSignature,
  getPaymentIntent,
  createRefund,
};
