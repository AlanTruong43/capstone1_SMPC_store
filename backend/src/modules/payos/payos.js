const { PayOS } = require('@payos/node');

/**
 * PayOS Payment Service
 * Handles payment link creation and webhook verification
 * Based on PayOS API specifications
 */

// Initialize PayOS with environment variables
const payos = new PayOS(
  process.env.PAYOS_CLIENT_ID,
  process.env.PAYOS_API_KEY,
  process.env.PAYOS_CHECKSUM_KEY
);

/**
 * Creates a payment link for an order
 * @param {Object} params - Payment parameters
 * @param {string} params.orderId - Unique order ID from database
 * @param {number} params.amount - Payment amount in VND
 * @param {string} params.description - Order description
 * @param {string} params.buyerName - Customer name
 * @param {string} params.returnUrl - URL to redirect after payment
 * @param {string} params.cancelUrl - URL to redirect if payment cancelled
 * @returns {Promise<Object>} Payment link response with checkoutUrl
 */
async function createPaymentLink({ orderId, amount, description, buyerName, returnUrl, cancelUrl }) {
  try {
    // Generate unique PayOS order code (must be unique per transaction)
    const payosOrderCode = Number(Date.now().toString().slice(-9)); // Last 9 digits of timestamp

    // Prepare payment data for PayOS
    // PayOS requires description to be max 25 characters
    const maxDescLength = 25;
    const fallbackDescription = `Order ${orderId}`.substring(0, maxDescLength);
    const finalDescription = (description || fallbackDescription).substring(0, maxDescLength);
    
    const paymentData = {
      orderCode: payosOrderCode,
      amount: Math.round(amount), // Ensure integer
      description: finalDescription,
      buyerName: buyerName || 'Customer',
      buyerEmail: '', // Optional
      buyerPhone: '', // Optional
      buyerAddress: '', // Optional
      items: [
        {
          name: finalDescription,
          quantity: 1,
          price: Math.round(amount)
        }
      ],
      returnUrl: returnUrl || `${process.env.FRONTEND_URL || 'http://localhost:4000'}/pages/order-success.html`,
      cancelUrl: cancelUrl || `${process.env.FRONTEND_URL || 'http://localhost:4000'}/pages/checkout.html`
    };

    console.log('🔐 [PayOS Service] Creating payment link for order:', orderId);
    console.log('📝 [PayOS Service] PayOS order code:', payosOrderCode);
    console.log('💰 [PayOS Service] Amount:', amount, 'VND');

    // Call PayOS API to create payment link
    const response = await payos.paymentRequests.create(paymentData);

    console.log('✅ [PayOS Service] Payment link created successfully');
    console.log('🔗 [PayOS Service] Checkout URL:', response.checkoutUrl);

    return {
      checkoutUrl: response.checkoutUrl,
      payosOrderCode: payosOrderCode,
      accountNumber: response.accountNumber,
      accountName: response.accountName,
      amount: response.amount,
      description: response.description,
      qrCode: response.qrCode
    };

  } catch (error) {
    console.error('❌ [PayOS Service] Payment link creation failed:', error.message);
    throw new Error(`PayOS payment creation failed: ${error.message}`);
  }
}

/**
 * Verifies webhook signature from PayOS
 * @param {Object} webhookData - Webhook payload from PayOS
 * @returns {Object} Verification result with status
 */
async function verifyWebhookSignature(webhookData) {
  try {
    console.log('🔐 [PayOS Service] Verifying webhook signature');
    
    // PayOS SDK handles signature verification internally
    const verification = await payos.webhooks.verify(webhookData);
    
    console.log('✅ [PayOS Service] Webhook signature verified');
    return verification;

  } catch (error) {
    console.error('❌ [PayOS Service] Webhook signature verification failed:', error.message);
    throw new Error('Invalid webhook signature');
  }
}

/**
 * Gets payment link information
 * @param {number} orderCode - PayOS order code
 * @returns {Promise<Object>} Payment link details
 */
async function getPaymentLinkInfo(orderCode) {
  try {
    console.log('🔍 [PayOS Service] Getting payment link info for order code:', orderCode);
    
    const response = await payos.paymentRequests.get(orderCode);
    
    console.log('📥 [PayOS Service] Payment link info retrieved');
    return response;

  } catch (error) {
    console.error('❌ [PayOS Service] Failed to get payment link info:', error.message);
    throw new Error(`Failed to get payment info: ${error.message}`);
  }
}

/**
 * Cancels a payment link
 * @param {number} orderCode - PayOS order code
 * @param {string} cancellationReason - Reason for cancellation
 * @returns {Promise<Object>} Cancellation result
 */
async function cancelPaymentLink(orderCode, cancellationReason) {
  try {
    console.log('❌ [PayOS Service] Cancelling payment link:', orderCode);
    
    const response = await payos.paymentRequests.cancel(orderCode, cancellationReason);
    
    console.log('✅ [PayOS Service] Payment link cancelled');
    return response;

  } catch (error) {
    console.error('❌ [PayOS Service] Failed to cancel payment link:', error.message);
    throw new Error(`Failed to cancel payment: ${error.message}`);
  }
}

module.exports = {
  createPaymentLink,
  verifyWebhookSignature,
  getPaymentLinkInfo,
  cancelPaymentLink
};