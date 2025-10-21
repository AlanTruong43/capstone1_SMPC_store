const express = require('express');
const router = express.Router();
const stripeController = require('./stripe.controller');
const { requireAuth, requireAdmin } = require('../../middlewares/auth_middleware');

/**
 * Stripe Payment Routes
 * Following the same pattern as MoMo routes
 */

/**
 * POST /api/payments/stripe/create
 * Create a Stripe Payment Intent for an order
 * Requires authentication
 * 
 * Body:
 * {
 *   orderId: string,
 *   amount: number (in smallest currency unit: cents for USD, no decimals for VND),
 *   currency: string (e.g., 'usd', 'vnd'),
 *   description: string (optional)
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   clientSecret: string,
 *   paymentIntentId: string,
 *   amount: number,
 *   currency: string
 * }
 */
router.post('/create', requireAuth, stripeController.createPayment);

/**
 * POST /api/payments/stripe/webhook
 * Stripe webhook endpoint to receive payment events
 * Public endpoint (no auth) - verified by Stripe signature
 * 
 * IMPORTANT: This endpoint requires raw body, not parsed JSON
 * The signature verification needs the raw request body
 * 
 * Headers:
 * stripe-signature: <signature from Stripe>
 */
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }), // Preserve raw body for signature verification
  (req, res, next) => {
    // Store raw body for webhook verification
    req.rawBody = req.body;
    next();
  },
  stripeController.handleWebhook
);

/**
 * GET /api/payments/stripe/status/:orderId
 * Get payment status for a specific order
 * Requires authentication (buyer or seller)
 * 
 * Response:
 * {
 *   orderId: string,
 *   payment: {
 *     paymentIntentId: string,
 *     status: string,
 *     amount: number,
 *     currency: string,
 *     createdAt: timestamp,
 *     completedAt: timestamp | null
 *   },
 *   orderStatus: string
 * }
 */
router.get('/status/:orderId', requireAuth, stripeController.getPaymentStatus);

/**
 * POST /api/payments/stripe/refund
 * Create a refund for a Stripe payment
 * Admin only
 * 
 * Body:
 * {
 *   orderId: string,
 *   amount: number (optional - null for full refund),
 *   reason: string (optional - default: 'requested_by_customer')
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   refund: {
 *     refundId: string,
 *     amount: number,
 *     currency: string,
 *     status: string,
 *     reason: string
 *   },
 *   message: string
 * }
 */
router.post('/refund', requireAuth, requireAdmin, stripeController.createRefund);

module.exports = router;
