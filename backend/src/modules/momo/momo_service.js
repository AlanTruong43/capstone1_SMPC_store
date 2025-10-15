const crypto = require('crypto');
const axios = require('axios');

/**
 * MoMo Payment Service
 * Handles payment request creation and signature verification
 * Based on MoMo API v2 specifications
 */

/**
 * Creates a payment request to MoMo API
 * @param {Object} params - Payment parameters
 * @param {string} params.orderId - Unique order ID
 * @param {number} params.amount - Payment amount in VND
 * @param {string} params.orderInfo - Order description
 * @param {string} params.redirectUrl - URL to redirect after payment
 * @param {string} params.ipnUrl - IPN callback URL
 * @returns {Promise<Object>} Payment response with payUrl
 */
async function createPaymentRequest({ orderId, amount, orderInfo, redirectUrl, ipnUrl }) {
  try {
    // Get MoMo credentials from environment variables
    const partnerCode = process.env.MOMO_PARTNER_CODE || 'MOMO';
    const accessKey = process.env.MOMO_ACCESS_KEY || 'F8BBA842ECF85';
    const secretKey = process.env.MOMO_SECRET_KEY || 'K951B6PE1waDMi640xX08PD3vg6EkVlz';
    const endpoint = process.env.MOMO_API_ENDPOINT || 'https://test-payment.momo.vn/v2/gateway/api/create';

    // Generate unique requestId
    const requestId = partnerCode + new Date().getTime();
    const requestType = 'captureWallet'; // Payment method type
    const extraData = ''; // Empty for standard payments

    // Build raw signature string (MUST follow exact order per MoMo spec)
    // Format: accessKey=$accessKey&amount=$amount&extraData=$extraData&ipnUrl=$ipnUrl
    //         &orderId=$orderId&orderInfo=$orderInfo&partnerCode=$partnerCode
    //         &redirectUrl=$redirectUrl&requestId=$requestId&requestType=$requestType
    const rawSignature = 
      'accessKey=' + accessKey +
      '&amount=' + amount +
      '&extraData=' + extraData +
      '&ipnUrl=' + ipnUrl +
      '&orderId=' + orderId +
      '&orderInfo=' + orderInfo +
      '&partnerCode=' + partnerCode +
      '&redirectUrl=' + redirectUrl +
      '&requestId=' + requestId +
      '&requestType=' + requestType;

    // Generate HMAC SHA256 signature
    const signature = crypto
      .createHmac('sha256', secretKey)
      .update(rawSignature)
      .digest('hex');

    console.log('🔐 [MoMo Service] Creating payment request for order:', orderId);
    console.log('📝 [MoMo Service] Raw signature:', rawSignature);
    console.log('🔑 [MoMo Service] Generated signature:', signature);

    // Prepare request body
    const requestBody = {
      partnerCode: partnerCode,
      accessKey: accessKey,
      requestId: requestId,
      amount: String(amount), // MoMo expects string
      orderId: orderId,
      orderInfo: orderInfo,
      redirectUrl: redirectUrl,
      ipnUrl: ipnUrl,
      extraData: extraData,
      requestType: requestType,
      signature: signature,
      lang: 'en'
    };

    // Call MoMo API
    console.log('📤 [MoMo Service] Sending request to:', endpoint);
    const response = await axios.post(endpoint, requestBody, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });

    console.log('📥 [MoMo Service] Response status:', response.status);
    console.log('📥 [MoMo Service] Response data:', response.data);

    // Check if MoMo returned success
    if (response.data.resultCode !== 0) {
      throw new Error(`MoMo API Error: ${response.data.message || 'Unknown error'} (Code: ${response.data.resultCode})`);
    }

    // Return payment URL and request details
    return {
      payUrl: response.data.payUrl,
      deeplink: response.data.deeplink,
      qrCodeUrl: response.data.qrCodeUrl,
      requestId: requestId,
      message: response.data.message
    };

  } catch (error) {
    console.error('❌ [MoMo Service] Payment request failed:', error.message);
    
    // Handle different error types
    if (error.response) {
      // MoMo API returned an error response
      const errorData = error.response.data || {};
      throw new Error(`MoMo API Error: ${errorData.message || error.message} (Code: ${errorData.resultCode || 'N/A'})`);
    } else if (error.request) {
      // Request was made but no response received
      throw new Error('MoMo API timeout or network error. Please try again.');
    } else {
      // Something else happened
      throw new Error(`Payment request failed: ${error.message}`);
    }
  }
}

/**
 * Verifies the signature from MoMo IPN callback
 * @param {Object} ipnData - IPN request body from MoMo
 * @returns {boolean} True if signature is valid, false otherwise
 */
function verifyIpnSignature(ipnData) {
  try {
    const secretKey = process.env.MOMO_SECRET_KEY || 'K951B6PE1waDMi640xX08PD3vg6EkVlz';

    // Extract signature from IPN data
    const receivedSignature = ipnData.signature;
    
    if (!receivedSignature) {
      console.error('❌ [MoMo Service] No signature in IPN data');
      return false;
    }

    // Build raw signature string from IPN parameters
    // Format must match MoMo's IPN signature format:
    // accessKey=$accessKey&amount=$amount&extraData=$extraData&message=$message
    // &orderId=$orderId&orderInfo=$orderInfo&orderType=$orderType
    // &partnerCode=$partnerCode&payType=$payType&requestId=$requestId
    // &responseTime=$responseTime&resultCode=$resultCode&transId=$transId
    const rawSignature =
      'accessKey=' + ipnData.accessKey +
      '&amount=' + ipnData.amount +
      '&extraData=' + ipnData.extraData +
      '&message=' + ipnData.message +
      '&orderId=' + ipnData.orderId +
      '&orderInfo=' + ipnData.orderInfo +
      '&orderType=' + ipnData.orderType +
      '&partnerCode=' + ipnData.partnerCode +
      '&payType=' + ipnData.payType +
      '&requestId=' + ipnData.requestId +
      '&responseTime=' + ipnData.responseTime +
      '&resultCode=' + ipnData.resultCode +
      '&transId=' + ipnData.transId;

    // Generate expected signature
    const expectedSignature = crypto
      .createHmac('sha256', secretKey)
      .update(rawSignature)
      .digest('hex');

    console.log('🔐 [MoMo Service] Verifying IPN signature');
    console.log('📝 [MoMo Service] Raw signature:', rawSignature);
    console.log('🔑 [MoMo Service] Expected signature:', expectedSignature);
    console.log('🔑 [MoMo Service] Received signature:', receivedSignature);

    // Timing-safe comparison to prevent timing attacks
    const isValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(receivedSignature)
    );

    if (isValid) {
      console.log('✅ [MoMo Service] Signature verified successfully');
    } else {
      console.error('❌ [MoMo Service] Signature verification failed');
    }

    return isValid;

  } catch (error) {
    console.error('❌ [MoMo Service] Signature verification error:', error.message);
    return false;
  }
}

/**
 * Queries MoMo transaction status (for payment verification without IPN)
 * @param {string} orderId - Order ID to check
 * @param {string} requestId - Original request ID
 * @returns {Promise<Object>} Transaction status
 */
async function queryTransactionStatus(orderId, requestId) {
  try {
    const partnerCode = process.env.MOMO_PARTNER_CODE || 'MOMO';
    const accessKey = process.env.MOMO_ACCESS_KEY || 'F8BBA842ECF85';
    const secretKey = process.env.MOMO_SECRET_KEY || 'K951B6PE1waDMi640xX08PD3vg6EkVlz';
    const endpoint = 'https://test-payment.momo.vn/v2/gateway/api/query';

    // Build raw signature for query request
    const rawSignature =
      'accessKey=' + accessKey +
      '&orderId=' + orderId +
      '&partnerCode=' + partnerCode +
      '&requestId=' + requestId;

    const signature = crypto
      .createHmac('sha256', secretKey)
      .update(rawSignature)
      .digest('hex');

    const requestBody = {
      partnerCode: partnerCode,
      accessKey: accessKey,
      requestId: requestId,
      orderId: orderId,
      signature: signature,
      lang: 'en'
    };

    console.log('🔍 [MoMo Service] Querying transaction status for order:', orderId);

    const response = await axios.post(endpoint, requestBody, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log('📥 [MoMo Service] Query response:', response.data);

    return response.data;

  } catch (error) {
    console.error('❌ [MoMo Service] Query transaction failed:', error.message);
    throw new Error('Failed to query transaction status');
  }
}

module.exports = {
  createPaymentRequest,
  verifyIpnSignature,
  queryTransactionStatus
};

