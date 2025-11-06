const express = require('express');
const router = express.Router();
const { db, admin } = require('../../config/firebase');
const { requireAuth, requireAdmin } = require('../../middlewares/auth_middleware');
const { createPaymentRequest, queryTransactionStatus } = require('../momo/momo_service');
const { getCart } = require('../cart/cart_service');
const { 
  createOrder, 
  getOrderById, 
  getOrdersByBuyer, 
  getOrdersBySeller,
  ensureUserDocument,
  getAllOrdersAdmin,
  getOrderByIdWithUsers,
  updateOrderStatusAdmin,
  cancelOrderAdmin,
  updateShippingAddressAdmin
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

    // Step 3: Calculate subtotal and total with shipping
    const subtotal = product.price * quantity;
    const shippingFee = 5000; // Fixed shipping fee
    const finalTotal = subtotal + shippingFee;
    console.log('💰 [Orders] Subtotal:', subtotal, 'VND');
    console.log('🚚 [Orders] Shipping fee:', shippingFee, 'VND');
    console.log('💰 [Orders] Total amount:', finalTotal, 'VND');

    // Step 4: Create order in Firestore with status 'pending'
    const orderData = {
      productId: productId,
      productName: product.name,
      productPrice: product.price,
      sellerId: product.sellerId,
      buyerId: buyerId,
      quantity: quantity,
      totalAmount: subtotal, // Store subtotal in order (shipping handled separately)
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
        amount: finalTotal, // Use final total including shipping
        orderInfo: `Payment for ${product.name}`,
        redirectUrl: `${returnUrl}?orderId=${orderId}`,
        ipnUrl: ipnUrl
      });

      console.log('✅ [Orders] Payment URL generated:', paymentResult.payUrl);

      // Return success response
      return res.status(200).json({
        success: true,
        orderId: orderId,
        subtotal: subtotal,
        shippingFee: shippingFee,
        totalAmount: finalTotal,
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
 * POST /api/orders/create-from-cart
 * Creates multiple orders from cart and initiates payment
 * 
 * Request body:
 * {
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
 *   transactionId: string,
 *   orderIds: [string],
 *   totalAmount: number,
 *   payUrl: string
 * }
 */
router.post('/create-from-cart', requireAuth, async (req, res) => {
  try {
    console.log('🛒 [Orders] Create from cart request received');
    console.log('👤 [Orders] User:', req.user.uid, req.user.email);

    const { shippingAddress } = req.body;
    const buyerId = req.user.uid;
    const buyerEmail = req.user.email;

    // Validate input
    if (!shippingAddress || !shippingAddress.fullName || !shippingAddress.address || !shippingAddress.phone) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'shippingAddress with fullName, address, and phone are required'
      });
    }

    // Ensure user document exists
    await ensureUserDocument(buyerId, buyerEmail);

    // Get user's cart
    console.log('🛒 [Orders] Fetching cart for user:', buyerId);
    const cart = await getCart(buyerId);

    if (!cart.items || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cart is empty',
        message: 'Cannot checkout with an empty cart'
      });
    }

    // Generate transaction ID to group all orders
    const transactionId = `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('🆔 [Orders] Transaction ID:', transactionId);

    // Create orders for each cart item
    const orders = [];
    const orderIds = [];
    let totalAmount = 0;
    const productNames = [];

    for (const item of cart.items) {
      const product = item.product;
      
      // Validate product still exists and is available
      if (product.status !== 'available') {
        console.warn(`⚠️ [Orders] Product ${item.productId} is not available, skipping`);
        continue; // Skip unavailable products
      }

      const itemTotal = product.price * item.quantity;
      totalAmount += itemTotal;
      productNames.push(`${product.name} (x${item.quantity})`);

      // Create order data
      const orderData = {
        productId: item.productId,
        productName: product.name,
        productPrice: product.price,
        sellerId: product.sellerId, // sellerId is now included in cart product data
        buyerId: buyerId,
        quantity: item.quantity,
        totalAmount: itemTotal,
        shippingAddress: shippingAddress,
        transactionId: transactionId // Link orders together
      };

      try {
        const order = await createOrder(orderData);
        orders.push(order);
        orderIds.push(order.id);
        console.log(`✅ [Orders] Order created: ${order.id} for product ${product.name}`);
      } catch (orderError) {
        console.error(`❌ [Orders] Failed to create order for product ${item.productId}:`, orderError);
        // Continue with other products, but log the error
      }
    }

    if (orders.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid orders created',
        message: 'All products in cart are unavailable or failed to create orders'
      });
    }

    // Add shipping fee
    const shippingFee = 5000;
    const finalTotal = totalAmount + shippingFee;

    console.log(`💰 [Orders] Total amount: ${finalTotal} VND (${orders.length} orders)`);

    // Update all orders with transactionId (payment method will be set when payment is initiated)
    const batch = db.batch();
    orders.forEach(order => {
      const orderRef = db.collection('orders').doc(order.id);
      batch.update(orderRef, {
        transactionId: transactionId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });
    await batch.commit();

    // Return success response (frontend will handle payment method selection)
    return res.status(200).json({
      success: true,
      transactionId: transactionId,
      orderIds: orderIds,
      subtotal: totalAmount,
      shippingFee: shippingFee,
      totalAmount: finalTotal,
      orderCount: orders.length
    });

  } catch (error) {
    console.error('❌ [Orders] Create from cart failed:', error.message);
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

    console.log('🔍 [Orders] Verifying payment for order/transaction:', orderId);

    // Step 1: Try to get order by document ID first (single product checkout)
    let order = await getOrderById(orderId);
    let orders = [];
    let isTransactionId = false;
    let transactionId = null;

    if (!order) {
      // Step 1b: Try to find orders by transactionId field (cart checkout)
      console.log('📦 [Orders] Document not found, querying by transactionId field');
      const ordersSnapshot = await db.collection('orders')
        .where('transactionId', '==', orderId)
        .get();

      if (ordersSnapshot.empty) {
        return res.status(404).json({
          success: false,
          error: 'Order not found',
          message: 'The requested order or transaction does not exist'
        });
      }

      // Multiple orders case
      isTransactionId = true;
      transactionId = orderId;
      ordersSnapshot.forEach(doc => {
        orders.push({ id: doc.id, ...doc.data() });
      });
      
      // Use first order for payment method check
      order = orders[0];
      console.log(`📦 [Orders] Found ${orders.length} orders by transactionId`);
    } else {
      // Single order case
      orders = [order];
      console.log('📦 [Orders] Found single order by document ID');
    }

    // Step 2: Check if all orders are already paid
    const allPaid = orders.every(o => o.orderStatus === 'paid' || o.paymentStatus === 'paid');
    if (allPaid) {
      if (isTransactionId) {
        return res.json({
          success: true,
          transactionId: transactionId,
          orderIds: orders.map(o => o.id),
          status: 'paid',
          orders: orders,
          isMultipleOrders: true,
          message: 'Payment already confirmed'
        });
      } else {
        return res.json({
          success: true,
          orderId: orderId,
          status: 'paid',
          order: order,
          message: 'Payment already confirmed'
        });
      }
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
          
          // Update all orders
          const batch = db.batch();
          const updatedOrders = [];
          
          for (const o of orders) {
            const statusHistory = o.statusHistory || [];
            statusHistory.push({
              status: 'paid',
              changedBy: 'system',
              changedAt: admin.firestore.Timestamp.now(),
              notes: 'Payment verified via PayOS query'
            });
            
            const orderRef = db.collection('orders').doc(o.id);
            batch.update(orderRef, {
              paymentStatus: 'paid',
              orderStatus: 'paid',
              paidAt: admin.firestore.FieldValue.serverTimestamp(),
              paymentDetails: {
                ...o.paymentDetails,
                transactionId: paymentInfo.id,
                paidAmount: paymentInfo.amountPaid,
                paymentMethod: 'payos',
                completedAt: admin.firestore.FieldValue.serverTimestamp()
              },
              statusHistory: statusHistory,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            // Update product quantities
            const productRef = db.collection('products').doc(o.productId);
            const productSnap = await productRef.get();
            if (productSnap.exists) {
              const productData = productSnap.data();
              const newQuantity = (productData.quantity || 1) - (o.quantity || 1);
              batch.update(productRef, {
                quantity: Math.max(0, newQuantity),
                status: newQuantity <= 0 ? 'sold' : productData.status
              });
            }
            
            updatedOrders.push({ id: o.id, ...o, orderStatus: 'paid', paymentStatus: 'paid' });
          }
          
          await batch.commit();
          
          // Fetch updated orders
          const finalOrders = await Promise.all(orders.map(o => getOrderById(o.id)));
          
          if (isTransactionId) {
            return res.json({
              success: true,
              transactionId: transactionId,
              orderIds: orders.map(o => o.id),
              status: 'paid',
              orders: finalOrders,
              isMultipleOrders: true,
              message: 'Payment verified and confirmed'
            });
          } else {
            return res.json({
              success: true,
              orderId: orderId,
              status: 'paid',
              order: finalOrders[0],
              message: 'Payment verified and confirmed'
            });
          }
        } else {
          // Payment still pending or cancelled
          if (isTransactionId) {
            return res.json({
              success: true,
              transactionId: transactionId,
              orderIds: orders.map(o => o.id),
              status: paymentInfo.status === 'CANCELLED' ? 'failed' : 'pending',
              orders: orders,
              isMultipleOrders: true,
              message: paymentInfo.status === 'CANCELLED' ? 'Payment cancelled' : 'Payment is still processing'
            });
          } else {
            return res.json({
              success: true,
              orderId: orderId,
              status: paymentInfo.status === 'CANCELLED' ? 'failed' : 'pending',
              order: order,
              message: paymentInfo.status === 'CANCELLED' ? 'Payment cancelled' : 'Payment is still processing'
            });
          }
        }
      } catch (payosError) {
        console.error('❌ [Orders] PayOS query failed:', payosError.message);
        
        // Return current order status if query fails
        if (isTransactionId) {
          return res.json({
            success: true,
            transactionId: transactionId,
            orderIds: orders.map(o => o.id),
            status: orders[0].paymentStatus || orders[0].status,
            orders: orders,
            isMultipleOrders: true,
            message: 'Could not verify with PayOS, showing cached status'
          });
        } else {
          return res.json({
            success: true,
            orderId: orderId,
            status: order.paymentStatus || order.status,
            order: order,
            message: 'Could not verify with PayOS, showing cached status'
          });
        }
      }
    }

    // Step 4: Query MoMo for transaction status (only for MoMo payments)
    try {
      console.log('🔍 [Orders] Querying MoMo transaction status...');
      
      // Note: We need the original requestId from payment creation
      // For now, we'll use orderId as requestId (same value in our implementation)
      const momoResult = await queryTransactionStatus(orderId, orderId);

      console.log('📥 [Orders] MoMo query result:', momoResult);

      // Step 4: Update order(s) based on MoMo response
      if (momoResult.resultCode === 0) {
        // Payment successful
        console.log('✅ [Orders] Payment confirmed by MoMo');

        // Update all orders
        const batch = db.batch();
        const totalAmount = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        
        for (const o of orders) {
          const statusHistory = o.statusHistory || [];
          statusHistory.push({
            status: 'paid',
            changedBy: 'system',
            changedAt: admin.firestore.Timestamp.now(),
            notes: 'Payment verified via MoMo query'
          });

          const orderRef = db.collection('orders').doc(o.id);
          batch.update(orderRef, {
            orderStatus: 'paid',
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
            statusHistory: statusHistory,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          // Update product quantity
          const productRef = db.collection('products').doc(o.productId);
          const productSnap = await productRef.get();
          if (productSnap.exists) {
            const productData = productSnap.data();
            const newQuantity = (productData.quantity || 1) - (o.quantity || 1);
            batch.update(productRef, {
              quantity: Math.max(0, newQuantity),
              status: newQuantity <= 0 ? 'sold' : productData.status
            });
          }

          // Create transaction record for each order
          batch.set(db.collection('transactions').doc(), {
            orderId: o.id,
            amount: Number(momoResult.amount) / orders.length, // Split amount evenly
            currency: 'VND',
            paymentMethod: 'VNPAY',
            payeeId: o.sellerId,
            payerId: o.buyerId,
            status: 'pending',
            externalTransactionId: `GW-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
            txnDate: new Date(),
            address: o.shippingAddress || null
          });
        }

        await batch.commit();

        // Get updated orders
        const finalOrders = await Promise.all(orders.map(o => getOrderById(o.id)));

        if (isTransactionId) {
          return res.json({
            success: true,
            transactionId: transactionId,
            orderIds: orders.map(o => o.id),
            status: 'paid',
            orders: finalOrders,
            isMultipleOrders: true,
            message: 'Payment verified and confirmed'
          });
        } else {
          return res.json({
            success: true,
            orderId: orderId,
            status: 'paid',
            order: finalOrders[0],
            message: 'Payment verified and confirmed'
          });
        }

      } else if (momoResult.resultCode === 1006) {
        // Transaction not found or still pending
        if (isTransactionId) {
          return res.json({
            success: true,
            transactionId: transactionId,
            orderIds: orders.map(o => o.id),
            status: 'pending',
            orders: orders,
            isMultipleOrders: true,
            message: 'Payment is still processing'
          });
        } else {
          return res.json({
            success: true,
            orderId: orderId,
            status: 'pending',
            order: order,
            message: 'Payment is still processing'
          });
        }

      } else {
        // Payment failed
        console.warn('⚠️ [Orders] Payment failed:', momoResult.message);
        
        // Update all orders to failed status
        const batch = db.batch();
        
        for (const o of orders) {
          const statusHistory = o.statusHistory || [];
          statusHistory.push({
            status: 'cancelled',
            changedBy: 'system',
            changedAt: admin.firestore.Timestamp.now(),
            notes: `Payment failed: ${momoResult.message || 'Unknown error'}`
          });
          
          const orderRef = db.collection('orders').doc(o.id);
          batch.update(orderRef, {
            orderStatus: 'cancelled',
            paymentStatus: 'failed',
            cancelledBy: 'system',
            cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
            cancellationReason: momoResult.message || 'Payment failed',
            paymentFailureReason: momoResult.message,
            paymentResultCode: momoResult.resultCode,
            statusHistory: statusHistory,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
        
        await batch.commit();
        
        const updatedOrders = await Promise.all(orders.map(o => getOrderById(o.id)));

        if (isTransactionId) {
          return res.json({
            success: true,
            transactionId: transactionId,
            orderIds: orders.map(o => o.id),
            status: 'failed',
            orders: updatedOrders,
            isMultipleOrders: true,
            message: momoResult.message || 'Payment failed'
          });
        } else {
          return res.json({
            success: true,
            orderId: orderId,
            status: 'failed',
            order: updatedOrders[0],
            message: momoResult.message || 'Payment failed'
          });
        }
      }

    } catch (queryError) {
      console.error('❌ [Orders] MoMo query failed:', queryError.message);
      
      // If MoMo query fails, return current order status
      if (isTransactionId) {
        return res.json({
          success: true,
          transactionId: transactionId,
          orderIds: orders.map(o => o.id),
          status: orders[0].status,
          orders: orders,
          isMultipleOrders: true,
          message: 'Could not verify with payment gateway, showing cached status'
        });
      } else {
        return res.json({
          success: true,
          orderId: orderId,
          status: order.status,
          order: order,
          message: 'Could not verify with payment gateway, showing cached status'
        });
      }
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

/**
 * ============================================
 * ADMIN ROUTES - Order Management
 * ============================================
 */

/**
 * GET /api/orders/admin/all
 * Get all orders with filters, pagination, and user data (Admin only)
 * Query params: orderStatus, paymentStatus, search, page, limit
 */
router.get('/admin/all', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { orderStatus, paymentStatus, search, page, limit } = req.query;

    const filters = {
      orderStatus: orderStatus || null,
      paymentStatus: paymentStatus || null,
      search: search || null,
      page: page || 1,
      limit: limit || 5
    };

    console.log('📊 [Admin Orders] Fetching orders with filters:', filters);

    const result = await getAllOrdersAdmin(filters);

    return res.json({
      success: true,
      orders: result.orders,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages
    });

  } catch (error) {
    console.error('❌ [Admin Orders] Get all orders failed:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/orders/admin/:orderId
 * Get order details with user information (Admin only)
 */
router.get('/admin/:orderId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;

    console.log('📦 [Admin Orders] Fetching order:', orderId);

    const order = await getOrderByIdWithUsers(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    return res.json({
      success: true,
      order: order
    });

  } catch (error) {
    console.error('❌ [Admin Orders] Get order failed:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/orders/admin/:orderId/status
 * Update order status (Admin only)
 * Body: { orderStatus, notes? }
 */
router.put('/admin/:orderId/status', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { orderStatus, notes } = req.body;
    const adminId = req.user.uid;

    if (!orderStatus) {
      return res.status(400).json({
        success: false,
        error: 'orderStatus is required'
      });
    }

    // Validate status
    const validStatuses = ['pending', 'paid', 'processing', 'delivered', 'completed', 'cancelled'];
    if (!validStatuses.includes(orderStatus)) {
      return res.status(400).json({
        success: false,
        error: `Invalid orderStatus. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    console.log('📝 [Admin Orders] Updating order status:', { orderId, orderStatus, adminId });

    const updatedOrder = await updateOrderStatusAdmin(orderId, orderStatus, adminId, notes);

    return res.json({
      success: true,
      message: 'Order status updated successfully',
      order: updatedOrder
    });

  } catch (error) {
    console.error('❌ [Admin Orders] Update status failed:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/orders/admin/:orderId/cancel
 * Cancel order (Admin only, only when status is 'processing')
 * Body: { cancellationReason }
 */
router.put('/admin/:orderId/cancel', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { cancellationReason } = req.body;
    const adminId = req.user.uid;

    if (!cancellationReason || cancellationReason.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'cancellationReason is required'
      });
    }

    console.log('❌ [Admin Orders] Cancelling order:', { orderId, adminId });

    const updatedOrder = await cancelOrderAdmin(orderId, adminId, cancellationReason);

    return res.json({
      success: true,
      message: 'Order cancelled successfully',
      order: updatedOrder
    });

  } catch (error) {
    console.error('❌ [Admin Orders] Cancel order failed:', error.message);
    
    // Check if it's a validation error
    if (error.message.includes('Cannot cancel order')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/orders/admin/:orderId/shipping-address
 * Update shipping address (Admin only, only when status is 'processing')
 * Body: { shippingAddress: { fullName, address, phone, city?, postalCode? } }
 */
router.put('/admin/:orderId/shipping-address', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { shippingAddress } = req.body;
    const adminId = req.user.uid;

    if (!shippingAddress) {
      return res.status(400).json({
        success: false,
        error: 'shippingAddress is required'
      });
    }

    console.log('📮 [Admin Orders] Updating shipping address:', { orderId, adminId });

    const updatedOrder = await updateShippingAddressAdmin(orderId, shippingAddress, adminId);

    return res.json({
      success: true,
      message: 'Shipping address updated successfully',
      order: updatedOrder
    });

  } catch (error) {
    console.error('❌ [Admin Orders] Update shipping address failed:', error.message);
    
    // Check if it's a validation error
    if (error.message.includes('Cannot update shipping address') || 
        error.message.includes('must include')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

