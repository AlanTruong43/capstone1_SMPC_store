const express = require('express');
const router = express.Router();
const { verifyIpnSignature } = require('./momo_service');
const { db } = require('../../config/firebase');
const admin = require('../../config/firebase').admin;

/**
 * MoMo IPN (Instant Payment Notification) Webhook
 * This endpoint receives payment notifications from MoMo servers
 * 
 * POST /api/payment/momo_ipn
 * 
 * IPN Flow:
 * 1. MoMo sends payment result to this endpoint
 * 2. Verify signature to ensure authenticity
 * 3. Update order status in Firestore
 * 4. Create transaction record
 * 5. Respond with 204 No Content
 */
router.post('/momo_ipn', async (req, res) => {
  try {
    console.log('📬 [MoMo IPN] Received IPN notification');
    console.log('📦 [MoMo IPN] Request body:', JSON.stringify(req.body, null, 2));

    const ipnData = req.body;

    // Step 1: Verify signature to ensure this request is from MoMo
    const isValidSignature = verifyIpnSignature(ipnData);
    
    if (!isValidSignature) {
      console.error('❌ [MoMo IPN] Invalid signature - rejecting request');
      return res.status(400).json({ 
        error: 'Invalid signature',
        message: 'IPN signature verification failed' 
      });
    }

    console.log('✅ [MoMo IPN] Signature verified');

    // Step 2: Check payment result code
    // resultCode = 0 means success, anything else is failure
    const { orderId, resultCode, message, transId, amount, payType, responseTime } = ipnData;

    if (resultCode !== 0) {
      // Payment failed or was cancelled
      console.warn(`⚠️ [MoMo IPN] Payment failed for order ${orderId}`);
      console.warn(`⚠️ [MoMo IPN] Reason: ${message} (Code: ${resultCode})`);
      
      // Update order status to 'failed'
      try {
        const orderRef = db.collection('orders').doc(orderId);
        await orderRef.update({
          status: 'failed',
          paymentFailureReason: message,
          paymentResultCode: resultCode,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`📝 [MoMo IPN] Order ${orderId} marked as failed`);
      } catch (updateError) {
        console.error('❌ [MoMo IPN] Failed to update order status:', updateError.message);
      }

      // Acknowledge receipt (204 = success, no content)
      return res.status(204).send();
    }

    // Step 3: Payment successful - find the order
    console.log(`✅ [MoMo IPN] Payment successful for order ${orderId}`);
    
    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      console.warn(`⚠️ [MoMo IPN] Order ${orderId} not found in database`);
      // Still return 204 to prevent MoMo from retrying
      return res.status(204).send();
    }

    const orderData = orderSnap.data();
    console.log('📦 [MoMo IPN] Found order:', orderData);

    // Step 4: Update order status to 'paid'
    try {
      await orderRef.update({
        status: 'paid',
        paymentDetails: {
          transId: String(transId),
          payType: payType,
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
          resultCode: resultCode,
          amount: Number(amount)
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`✅ [MoMo IPN] Order ${orderId} updated to 'paid'`);
    } catch (updateError) {
      console.error('❌ [MoMo IPN] Failed to update order:', updateError.message);
      // Return 500 so MoMo will retry the IPN
      return res.status(500).json({ 
        error: 'Database update failed',
        message: 'Could not update order status' 
      });
    }

    // Step 5: Create transaction record
    try {
      const transactionData = {
        orderId: orderId,
        amount: Number(amount),
        currency: 'VND',
        paymentMethod: 'VNPAY', // MoMo is categorized as VNPAY in your schema
        payeeId: orderData.sellerId,
        payerId: orderData.buyerId,
        status: 'pending', // Will be updated when seller confirms
        externalTransactionId: `GW-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
        txnDate: admin.firestore.FieldValue.serverTimestamp(),
        // Add shipping address from order
        address: orderData.shippingAddress || null
      };

      await db.collection('transactions').add(transactionData);
      console.log('✅ [MoMo IPN] Transaction record created');
    } catch (txnError) {
      console.error('❌ [MoMo IPN] Failed to create transaction:', txnError.message);
      // Don't fail the IPN because of this - order is already paid
    }

    // Step 6: Update product quantity and status
    try {
      const productRef = db.collection('products').doc(orderData.productId);
      const productSnap = await productRef.get();

      if (productSnap.exists) {
        const productData = productSnap.data();
        const newQuantity = (productData.quantity || 1) - (orderData.quantity || 1);

        await productRef.update({
          quantity: Math.max(0, newQuantity),
          status: newQuantity <= 0 ? 'sold' : productData.status
        });

        console.log(`✅ [MoMo IPN] Product ${orderData.productId} quantity updated to ${Math.max(0, newQuantity)}`);
      }
    } catch (productError) {
      console.error('❌ [MoMo IPN] Failed to update product:', productError.message);
      // Don't fail the IPN because of this
    }

    // Step 7: Respond with 204 No Content (success)
    console.log('✅ [MoMo IPN] IPN processed successfully');
    return res.status(204).send();

  } catch (error) {
    console.error('❌ [MoMo IPN] Unexpected error:', error.message);
    console.error(error.stack);
    
    // Return 500 so MoMo will retry
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

/**
 * Test endpoint to simulate MoMo IPN (for local development without ngrok)
 * POST /api/payment/momo_ipn_test
 * 
 * Use this when testing locally without ngrok
 */
router.post('/momo_ipn_test', async (req, res) => {
  try {
    console.log('🧪 [MoMo IPN Test] Simulating IPN for testing');
    
    const { orderId } = req.body;
    
    if (!orderId) {
      return res.status(400).json({ error: 'orderId is required' });
    }

    // Find the order
    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderData = orderSnap.data();

    // Simulate successful payment
    await orderRef.update({
      status: 'paid',
      paymentDetails: {
        transId: 'TEST_' + Date.now(),
        payType: 'test',
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
        resultCode: 0,
        amount: orderData.totalAmount
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Create transaction
    await db.collection('transactions').add({
      orderId: orderId,
      amount: orderData.totalAmount,
      currency: 'VND',
      paymentMethod: 'VNPAY',
      payeeId: orderData.sellerId,
      payerId: orderData.buyerId,
      status: 'pending',
      externalTransactionId: `TEST-${Date.now()}`,
      txnDate: admin.firestore.FieldValue.serverTimestamp(),
      address: orderData.shippingAddress || null
    });

    // Update product
    const productRef = db.collection('products').doc(orderData.productId);
    const productSnap = await productRef.get();
    if (productSnap.exists) {
      const productData = productSnap.data();
      const newQuantity = (productData.quantity || 1) - (orderData.quantity || 1);
      await productRef.update({
        quantity: Math.max(0, newQuantity),
        status: newQuantity <= 0 ? 'sold' : productData.status
      });
    }

    console.log('✅ [MoMo IPN Test] Test payment processed successfully');
    
    res.json({ 
      success: true, 
      message: 'Test payment processed',
      orderId: orderId,
      status: 'paid'
    });

  } catch (error) {
    console.error('❌ [MoMo IPN Test] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

