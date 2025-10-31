const express = require('express');
const router = express.Router();
const { db, admin } = require('../../config/firebase');
const { requireAuth } = require('../../middlewares/auth_middleware');
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

    // if (product.quantity < quantity) {
    //   return res.status(400).json({
    //     success: false,
    //     error: 'Insufficient quantity',
    //     message: `Only ${product.quantity} item(s) available`
    //   });
    // }

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
        totalAmount: totalAmount,
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
    if (order.orderStatus === 'paid' || order.paymentStatus === 'paid') {
      return res.json({
        success: true,
        orderId: orderId,
        status: 'paid',
        order: order,
        message: 'Payment already confirmed'
      });
    }

    // Step 3: Check payment provider and query appropriate service
    const paymentMethod = order.paymentMethod || 'momo'; // Default to momo for backward compatibility
    
    if (paymentMethod === 'payos') {
      // For PayOS, query PayOS API for payment status
      console.log('💳 [Orders] PayOS payment - querying PayOS API');
      
      try {
        const payosService = require('../payos/payos');
        const paymentInfo = await payosService.getPaymentLinkInfo(order.payosOrderCode);
        
        console.log('📥 [Orders] PayOS payment info:', paymentInfo);
        
        // Check if payment is successful
        if (paymentInfo.status === 'PAID') {
          console.log('✅ [Orders] PayOS payment confirmed');
          
          // Get current status history
          const statusHistory = order.statusHistory || [];
          statusHistory.push({
            status: 'paid',
            changedBy: 'system',
            changedAt: admin.firestore.Timestamp.now(),
            notes: 'Payment verified via PayOS query'
          });
          
          // Update order to paid (NEW SCHEMA)
          const orderRef = db.collection('orders').doc(orderId);
          await orderRef.update({
            paymentStatus: 'paid',
            orderStatus: 'paid', // NEW: Changed from 'confirmed' to 'paid'
            paidAt: admin.firestore.FieldValue.serverTimestamp(),
            paymentDetails: {
              ...order.paymentDetails,
              transactionId: paymentInfo.id,
              paidAmount: paymentInfo.amountPaid,
              paymentMethod: 'payos',
              completedAt: admin.firestore.FieldValue.serverTimestamp()
            },
            statusHistory: statusHistory, // NEW: Track status changes
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          
          const updatedOrder = await getOrderById(orderId);
          
          return res.json({
            success: true,
            orderId: orderId,
            status: 'paid',
            order: updatedOrder,
            message: 'Payment verified and confirmed'
          });
        } else {
          // Payment still pending or cancelled
          return res.json({
            success: true,
            orderId: orderId,
            status: paymentInfo.status === 'CANCELLED' ? 'failed' : 'pending',
            order: order,
            message: paymentInfo.status === 'CANCELLED' ? 'Payment cancelled' : 'Payment is still processing'
          });
        }
      } catch (payosError) {
        console.error('❌ [Orders] PayOS query failed:', payosError.message);
        
        // Return current order status if query fails
        return res.json({
          success: true,
          orderId: orderId,
          status: order.paymentStatus || order.status,
          order: order,
          message: 'Could not verify with PayOS, showing cached status'
        });
      }
    }

    // Step 4: Query MoMo for transaction status (only for MoMo payments)
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

        // Get current status history
        const statusHistory = order.statusHistory || [];
        statusHistory.push({
          status: 'paid',
          changedBy: 'system',
          changedAt: admin.firestore.Timestamp.now(),
          notes: 'Payment verified via MoMo query'
        });

        const orderRef = db.collection('orders').doc(orderId);
        await orderRef.update({
          orderStatus: 'paid', // NEW: Use orderStatus
          paymentStatus: 'paid',
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
          paymentDetails: {
            transId: momoResult.transId,
            payType: momoResult.payType,
            paidAt: new Date(),
            resultCode: momoResult.resultCode,
            amount: momoResult.amount,
            paymentMethod: 'momo'
          },
          statusHistory: statusHistory, // NEW: Track status changes
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
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
        
        // Get current status history
        const statusHistory = order.statusHistory || [];
        statusHistory.push({
          status: 'cancelled',
          changedBy: 'system',
          changedAt: admin.firestore.Timestamp.now(),
          notes: `Payment failed: ${momoResult.message || 'Unknown error'}`
        });
        
        const orderRef = db.collection('orders').doc(orderId);
        await orderRef.update({
          orderStatus: 'cancelled', // NEW: Use orderStatus
          paymentStatus: 'failed',
          cancelledBy: 'system',
          cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
          cancellationReason: momoResult.message || 'Payment failed',
          paymentFailureReason: momoResult.message,
          paymentResultCode: momoResult.resultCode,
          statusHistory: statusHistory, // NEW: Track status changes
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
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
 * Query params: ?status=paid&status=processing (filter by status)
 */
router.get('/buyer/my-orders', requireAuth, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { status } = req.query;
    
    let orders = await getOrdersByBuyer(userId);

    // Filter by status if provided
    if (status) {
      const statusFilters = Array.isArray(status) ? status : [status];
      orders = orders.filter(order => statusFilters.includes(order.orderStatus));
    }

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
 * Query params: ?status=paid&status=processing (filter by status)
 */
router.get('/seller/my-sales', requireAuth, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { status } = req.query;
    
    let orders = await getOrdersBySeller(userId);

    // Filter by status if provided
    if (status) {
      const statusFilters = Array.isArray(status) ? status : [status];
      orders = orders.filter(order => statusFilters.includes(order.orderStatus));
    }

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

/**
 * PUT /api/orders/:orderId/seller/accept
 * Seller accepts a paid order and moves it to processing
 */
router.put('/:orderId/seller/accept', requireAuth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const sellerId = req.user.uid;

    // Get order
    const order = await getOrderById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Verify seller owns this order
    const { isAuthorizedForOrder, validateStatusTransition } = require('./orders_service');
    if (!isAuthorizedForOrder(order, sellerId, 'seller')) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: You do not own this order'
      });
    }

    // Validate status transition
    const validation = validateStatusTransition(order.orderStatus, 'processing', 'seller');
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.reason
      });
    }

    // Update order status
    const { updateOrderStatusWithHistory } = require('./orders_service');
    await updateOrderStatusWithHistory(orderId, 'processing', sellerId, 'Seller accepted order');

    // Update sellerConfirmedAt timestamp
    await db.collection('orders').doc(orderId).update({
      sellerConfirmedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const updatedOrder = await getOrderById(orderId);

    return res.json({
      success: true,
      message: 'Order accepted successfully',
      order: updatedOrder
    });

  } catch (error) {
    console.error('❌ [Orders] Accept order failed:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/orders/:orderId/seller/deliver
 * Seller marks order as delivered
 */
router.put('/:orderId/seller/deliver', requireAuth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const sellerId = req.user.uid;
    const { notes } = req.body;

    // Get order
    const order = await getOrderById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Verify seller owns this order
    const { isAuthorizedForOrder, validateStatusTransition } = require('./orders_service');
    if (!isAuthorizedForOrder(order, sellerId, 'seller')) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: You do not own this order'
      });
    }

    // Validate status transition
    const validation = validateStatusTransition(order.orderStatus, 'delivered', 'seller');
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.reason
      });
    }

    // Update order status
    const { updateOrderStatusWithHistory } = require('./orders_service');
    await updateOrderStatusWithHistory(
      orderId, 
      'delivered', 
      sellerId, 
      notes || 'Seller marked as delivered'
    );

    // Update delivery timestamp and shipping status
    await db.collection('orders').doc(orderId).update({
      deliveredAt: admin.firestore.FieldValue.serverTimestamp(),
      shippingStatus: 'delivered',
      sellerNotes: notes || null
    });

    const updatedOrder = await getOrderById(orderId);

    return res.json({
      success: true,
      message: 'Order marked as delivered',
      order: updatedOrder
    });

  } catch (error) {
    console.error('❌ [Orders] Mark delivered failed:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/orders/:orderId/seller/cancel
 * Seller cancels an order (only if not yet delivered)
 */
router.put('/:orderId/seller/cancel', requireAuth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const sellerId = req.user.uid;
    const { reason } = req.body;

    if (!reason || reason.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Cancellation reason is required'
      });
    }

    // Get order
    const order = await getOrderById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Verify seller owns this order
    const { isAuthorizedForOrder, validateStatusTransition } = require('./orders_service');
    if (!isAuthorizedForOrder(order, sellerId, 'seller')) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: You do not own this order'
      });
    }

    // Validate status transition
    const validation = validateStatusTransition(order.orderStatus, 'cancelled', 'seller');
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.reason
      });
    }

    // Update order status
    const { updateOrderStatusWithHistory } = require('./orders_service');
    await updateOrderStatusWithHistory(
      orderId, 
      'cancelled', 
      sellerId, 
      `Cancelled by seller: ${reason}`
    );

    // Update cancellation fields
    await db.collection('orders').doc(orderId).update({
      cancelledBy: 'seller',
      cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
      cancellationReason: reason
    });

    const updatedOrder = await getOrderById(orderId);

    return res.json({
      success: true,
      message: 'Order cancelled successfully',
      order: updatedOrder
    });

  } catch (error) {
    console.error('❌ [Orders] Cancel order failed:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/orders/:orderId/buyer/confirm-delivery
 * Buyer confirms receipt of product
 */
router.put('/:orderId/buyer/confirm-delivery', requireAuth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const buyerId = req.user.uid;

    // Get order
    const order = await getOrderById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Verify buyer owns this order
    const { isAuthorizedForOrder, validateStatusTransition } = require('./orders_service');
    if (!isAuthorizedForOrder(order, buyerId, 'buyer')) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: This is not your order'
      });
    }

    // Validate status transition
    const validation = validateStatusTransition(order.orderStatus, 'completed', 'buyer');
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.reason
      });
    }

    // Update order status
    const { updateOrderStatusWithHistory } = require('./orders_service');
    await updateOrderStatusWithHistory(
      orderId, 
      'completed', 
      buyerId, 
      'Buyer confirmed receipt'
    );

    // Update completion timestamp
    await db.collection('orders').doc(orderId).update({
      completedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const updatedOrder = await getOrderById(orderId);

    return res.json({
      success: true,
      message: 'Order completed successfully',
      order: updatedOrder
    });

  } catch (error) {
    console.error('❌ [Orders] Confirm delivery failed:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/orders/:orderId/buyer/cancel
 * Buyer cancels an order (only if not yet delivered)
 */
router.put('/:orderId/buyer/cancel', requireAuth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const buyerId = req.user.uid;
    const { reason } = req.body;

    if (!reason || reason.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Cancellation reason is required'
      });
    }

    // Get order
    const order = await getOrderById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Verify buyer owns this order
    const { isAuthorizedForOrder, validateStatusTransition } = require('./orders_service');
    if (!isAuthorizedForOrder(order, buyerId, 'buyer')) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: This is not your order'
      });
    }

    // Validate status transition
    const validation = validateStatusTransition(order.orderStatus, 'cancelled', 'buyer');
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.reason
      });
    }

    // Update order status
    const { updateOrderStatusWithHistory } = require('./orders_service');
    await updateOrderStatusWithHistory(
      orderId, 
      'cancelled', 
      buyerId, 
      `Cancelled by buyer: ${reason}`
    );

    // Update cancellation fields
    await db.collection('orders').doc(orderId).update({
      cancelledBy: 'buyer',
      cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
      cancellationReason: reason
    });

    const updatedOrder = await getOrderById(orderId);

    return res.json({
      success: true,
      message: 'Order cancelled successfully',
      order: updatedOrder
    });

  } catch (error) {
    console.error('❌ [Orders] Cancel order failed:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

