const express = require('express');
const router = express.Router();
const { db } = require('../../config/firebase');
const requireAuth = require('../../middlewares/auth_middleware');
const { createPaymentRequest, queryTransactionStatus } = require('../momo/momo_service');
const { 
  createOrder, 
  getOrderById, 
  getOrdersByBuyer, 
  getOrdersBySeller,
  ensureUserDocument 
} = require('./orders_service');

/**
 * POST /api/orders/create-and-checkout
 * Creates an order and initiates MoMo payment
 * 
 * Request body:
 * {
 *   productId: string,
 *   quantity: number,
 *   shippingAddress: {
 *     fullName: string,
 *     address: string,
 *     phone: string,
 *     city: string (optional),
 *     postalCode: string (optional)
 *   }
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   orderId: string,
 *   payUrl: string
 * }
 */
router.post('/create-and-checkout', requireAuth, async (req, res) => {
  try {
    console.log('🛒 [Orders] Create and checkout request received');
    console.log('👤 [Orders] User:', req.user.uid, req.user.email);

    const { productId, quantity, shippingAddress } = req.body;
    const buyerId = req.user.uid;
    const buyerEmail = req.user.email;

    // Validate input
    if (!productId || !quantity || !shippingAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'productId, quantity, and shippingAddress are required'
      });
    }

    // Ensure user document exists in Firestore
    await ensureUserDocument(buyerId, buyerEmail);

    // Step 1: Get product details from Firestore
    console.log('📦 [Orders] Fetching product:', productId);
    const productRef = db.collection('products').doc(productId);
    const productSnap = await productRef.get();

    if (!productSnap.exists) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
        message: 'The requested product does not exist'
      });
    }

    const product = productSnap.data();
    console.log('📦 [Orders] Product found:', product.name);

    // Step 2: Check product availability
    if (product.status !== 'available') {
      return res.status(400).json({
        success: false,
        error: 'Product unavailable',
        message: `This product is currently ${product.status}`
      });
    }

    if (product.quantity < quantity) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient quantity',
        message: `Only ${product.quantity} item(s) available`
      });
    }

    // Step 3: Calculate total amount
    const totalAmount = product.price * quantity;
    console.log('💰 [Orders] Total amount:', totalAmount, 'VND');

    // Step 4: Create order in Firestore with status 'pending'
    const orderData = {
      productId: productId,
      productName: product.name,
      productPrice: product.price,
      sellerId: product.sellerId,
      buyerId: buyerId,
      quantity: quantity,
      totalAmount: totalAmount,
      shippingAddress: shippingAddress
    };

    const order = await createOrder(orderData);
    const orderId = order.id;

    console.log('✅ [Orders] Order created with ID:', orderId);

    // Step 5: Generate MoMo payment URL
    try {
      // Get URLs from environment or use defaults
      const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
      const returnUrl = process.env.MOMO_RETURN_URL || `${baseUrl}/pages/order-success.html`;
      const ipnUrl = process.env.MOMO_IPN_URL || `${baseUrl}/api/payment/momo_ipn`;

      console.log('💳 [Orders] Requesting payment URL from MoMo');
      console.log('🔗 [Orders] Return URL:', returnUrl);
      console.log('🔗 [Orders] IPN URL:', ipnUrl);

      const paymentResult = await createPaymentRequest({
        orderId: orderId,
        amount: totalAmount,
        orderInfo: `Payment for ${product.name}`,
        redirectUrl: `${returnUrl}?orderId=${orderId}`,
        ipnUrl: ipnUrl
      });

      console.log('✅ [Orders] Payment URL generated:', paymentResult.payUrl);

      // Return success response
      return res.status(200).json({
        success: true,
        orderId: orderId,
        payUrl: paymentResult.payUrl,
        deeplink: paymentResult.deeplink,
        qrCodeUrl: paymentResult.qrCodeUrl
      });

    } catch (momoError) {
      // MoMo payment request failed
      console.error('❌ [Orders] MoMo payment request failed:', momoError.message);

      // Order is created but payment initiation failed
      // Keep order in 'pending' state for manual reconciliation
      return res.status(500).json({
        success: false,
        error: 'Payment initiation failed',
        message: momoError.message,
        orderId: orderId // Return orderId for reference
      });
    }

  } catch (error) {
    console.error('❌ [Orders] Create and checkout failed:', error.message);
    console.error(error.stack);

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/orders/:orderId/verify-payment
 * Verifies payment status by querying MoMo API
 * This is the HYBRID approach - works without IPN for local testing
 * 
 * Response:
 * {
 *   success: true,
 *   orderId: string,
 *   status: 'pending' | 'paid' | 'failed',
 *   order: {...}
 * }
 */
router.get('/:orderId/verify-payment', async (req, res) => {
  try {
    const { orderId } = req.params;

    console.log('🔍 [Orders] Verifying payment for order:', orderId);

    // Step 1: Get order from Firestore
    const order = await getOrderById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
        message: 'The requested order does not exist'
      });
    }

    console.log('📦 [Orders] Order found, current status:', order.status);

    // Step 2: If already paid, return immediately
    if (order.status === 'paid') {
      return res.json({
        success: true,
        orderId: orderId,
        status: 'paid',
        order: order,
        message: 'Payment already confirmed'
      });
    }

    // Step 3: Query MoMo for transaction status
    try {
      console.log('🔍 [Orders] Querying MoMo transaction status...');
      
      // Note: We need the original requestId from payment creation
      // For now, we'll use orderId as requestId (same value in our implementation)
      const momoResult = await queryTransactionStatus(orderId, orderId);

      console.log('📥 [Orders] MoMo query result:', momoResult);

      // Step 4: Update order based on MoMo response
      if (momoResult.resultCode === 0) {
        // Payment successful
        console.log('✅ [Orders] Payment confirmed by MoMo');

        const orderRef = db.collection('orders').doc(orderId);
        await orderRef.update({
          status: 'paid',
          paymentDetails: {
            transId: momoResult.transId,
            payType: momoResult.payType,
            paidAt: new Date(),
            resultCode: momoResult.resultCode,
            amount: momoResult.amount
          },
          updatedAt: new Date()
        });

        // Update product quantity
        const productRef = db.collection('products').doc(order.productId);
        const productSnap = await productRef.get();
        if (productSnap.exists) {
          const productData = productSnap.data();
          const newQuantity = (productData.quantity || 1) - (order.quantity || 1);
          await productRef.update({
            quantity: Math.max(0, newQuantity),
            status: newQuantity <= 0 ? 'sold' : productData.status
          });
        }

        // Create transaction record
        await db.collection('transactions').add({
          orderId: orderId,
          amount: Number(momoResult.amount),
          currency: 'VND',
          paymentMethod: 'VNPAY',
          payeeId: order.sellerId,
          payerId: order.buyerId,
          status: 'pending',
          externalTransactionId: `GW-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
          txnDate: new Date(),
          address: order.shippingAddress || null
        });

        // Get updated order
        const updatedOrder = await getOrderById(orderId);

        return res.json({
          success: true,
          orderId: orderId,
          status: 'paid',
          order: updatedOrder,
          message: 'Payment verified and confirmed'
        });

      } else if (momoResult.resultCode === 1006) {
        // Transaction not found or still pending
        return res.json({
          success: true,
          orderId: orderId,
          status: 'pending',
          order: order,
          message: 'Payment is still processing'
        });

      } else {
        // Payment failed
        console.warn('⚠️ [Orders] Payment failed:', momoResult.message);
        
        const orderRef = db.collection('orders').doc(orderId);
        await orderRef.update({
          status: 'failed',
          paymentFailureReason: momoResult.message,
          paymentResultCode: momoResult.resultCode,
          updatedAt: new Date()
        });

        const updatedOrder = await getOrderById(orderId);

        return res.json({
          success: true,
          orderId: orderId,
          status: 'failed',
          order: updatedOrder,
          message: momoResult.message || 'Payment failed'
        });
      }

    } catch (queryError) {
      console.error('❌ [Orders] MoMo query failed:', queryError.message);
      
      // If MoMo query fails, return current order status
      return res.json({
        success: true,
        orderId: orderId,
        status: order.status,
        order: order,
        message: 'Could not verify with payment gateway, showing cached status'
      });
    }

  } catch (error) {
    console.error('❌ [Orders] Verify payment failed:', error.message);
    console.error(error.stack);

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/orders/:orderId
 * Get order details by ID
 */
router.get('/:orderId', requireAuth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.uid;

    const order = await getOrderById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Check if user is buyer or seller
    if (order.buyerId !== userId && order.sellerId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized',
        message: 'You do not have access to this order'
      });
    }

    return res.json({
      success: true,
      order: order
    });

  } catch (error) {
    console.error('❌ [Orders] Get order failed:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/orders/buyer/my-orders
 * Get all orders for the authenticated buyer
 */
router.get('/buyer/my-orders', requireAuth, async (req, res) => {
  try {
    const userId = req.user.uid;
    const orders = await getOrdersByBuyer(userId);

    return res.json({
      success: true,
      orders: orders,
      count: orders.length
    });

  } catch (error) {
    console.error('❌ [Orders] Get buyer orders failed:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/orders/seller/my-sales
 * Get all orders for the authenticated seller
 */
router.get('/seller/my-sales', requireAuth, async (req, res) => {
  try {
    const userId = req.user.uid;
    const orders = await getOrdersBySeller(userId);

    return res.json({
      success: true,
      orders: orders,
      count: orders.length
    });

  } catch (error) {
    console.error('❌ [Orders] Get seller orders failed:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

