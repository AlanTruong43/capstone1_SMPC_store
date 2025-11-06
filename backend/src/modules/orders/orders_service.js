const { db } = require('../../config/firebase');
const admin = require('../../config/firebase').admin;

/**
 * Orders Service
 * Handles order creation and management
 */

/**
 * Validates order data before creation
 * @param {Object} orderData - Order data to validate
 * @throws {Error} If validation fails
 */
function validateOrderData(orderData) {
  const required = ['productId', 'sellerId', 'buyerId', 'quantity', 'totalAmount', 'shippingAddress'];
  
  for (const field of required) {
    if (!orderData[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Validate shipping address
  const address = orderData.shippingAddress;
  if (!address.fullName || !address.address || !address.phone) {
    throw new Error('Shipping address must include fullName, address, and phone');
  }

  // Validate numeric fields
  if (orderData.quantity <= 0) {
    throw new Error('Quantity must be greater than 0');
  }
  if (orderData.totalAmount <= 0) {
    throw new Error('Total amount must be greater than 0');
  }
}

/**
 * Creates a new order in Firestore
 * @param {Object} orderData - Order details
 * @param {string} orderData.productId - Product ID
 * @param {string} orderData.sellerId - Seller user ID
 * @param {string} orderData.buyerId - Buyer user ID
 * @param {number} orderData.quantity - Quantity to purchase
 * @param {number} orderData.totalAmount - Total amount in VND
 * @param {Object} orderData.shippingAddress - Shipping address details
 * @param {string} orderData.productName - Product name
 * @param {number} orderData.productPrice - Product unit price
 * @returns {Promise<Object>} Created order with ID
 */
async function createOrder(orderData) {
  try {
    // Validate input data
    validateOrderData(orderData);

    // Prepare order document with new schema
    const order = {
      productId: orderData.productId,
      productName: orderData.productName,
      productPrice: orderData.productPrice,
      sellerId: orderData.sellerId,
      buyerId: orderData.buyerId,
      quantity: orderData.quantity,
      totalAmount: orderData.totalAmount,
      shippingAddress: {
        fullName: orderData.shippingAddress.fullName,
        address: orderData.shippingAddress.address,
        phone: orderData.shippingAddress.phone,
        city: orderData.shippingAddress.city || '',
        postalCode: orderData.shippingAddress.postalCode || ''
      },
      // New order lifecycle fields
      orderStatus: 'pending', // pending, paid, processing, delivered, completed, cancelled
      paymentStatus: 'pending', // pending, paid, failed
      shippingStatus: 'not_shipped', // not_shipped, delivered
      
      // Payment details
      paymentMethod: null, // Will be set when payment initiated
      paymentDetails: null, // Will be populated after payment
      transactionId: orderData.transactionId || null, // For grouping multiple orders in cart checkout
      
      // Timestamps
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      paidAt: null,
      sellerConfirmedAt: null,
      deliveredAt: null,
      completedAt: null,
      
      // Cancellation
      cancelledBy: null,
      cancelledAt: null,
      cancellationReason: null,
      
      // Notes
      sellerNotes: null,
      buyerNotes: null,
      
      // Status history
      statusHistory: [{
        status: 'pending',
        changedBy: orderData.buyerId,
        changedAt: admin.firestore.Timestamp.now(),
        notes: 'Order created'
      }]
    };

    console.log('📝 [Orders Service] Creating order:', order);

    // Add order to Firestore (auto-generate ID)
    const orderRef = await db.collection('orders').add(order);
    
    console.log('✅ [Orders Service] Order created with ID:', orderRef.id);

    return {
      id: orderRef.id,
      ...order
    };

  } catch (error) {
    console.error('❌ [Orders Service] Failed to create order:', error.message);
    throw error;
  }
}

/**
 * Gets order by ID
 * @param {string} orderId - Order ID
 * @returns {Promise<Object|null>} Order data or null if not found
 */
async function getOrderById(orderId) {
  try {
    const orderSnap = await db.collection('orders').doc(orderId).get();
    
    if (!orderSnap.exists) {
      return null;
    }

    return {
      id: orderSnap.id,
      ...orderSnap.data()
    };
  } catch (error) {
    console.error('❌ [Orders Service] Failed to get order:', error.message);
    throw error;
  }
}

/**
 * Gets all orders for a specific user (buyer)
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of orders
 */
async function getOrdersByBuyer(userId) {
  try {
    const ordersSnap = await db.collection('orders')
      .where('buyerId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    const orders = [];
    ordersSnap.forEach(doc => {
      orders.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return orders;
  } catch (error) {
    console.error('❌ [Orders Service] Failed to get buyer orders:', error.message);
    throw error;
  }
}

/**
 * Gets all orders for a specific seller
 * @param {string} sellerId - Seller user ID
 * @returns {Promise<Array>} Array of orders
 */
async function getOrdersBySeller(sellerId) {
  try {
    const ordersSnap = await db.collection('orders')
      .where('sellerId', '==', sellerId)
      .orderBy('createdAt', 'desc')
      .get();

    const orders = [];
    ordersSnap.forEach(doc => {
      orders.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return orders;
  } catch (error) {
    console.error('❌ [Orders Service] Failed to get seller orders:', error.message);
    throw error;
  }
}

/**
 * Updates order status
 * @param {string} orderId - Order ID
 * @param {string} status - New status
 * @returns {Promise<void>}
 */
async function updateOrderStatus(orderId, status) {
  try {
    await db.collection('orders').doc(orderId).update({
      status: status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ [Orders Service] Order ${orderId} status updated to '${status}'`);
  } catch (error) {
    console.error('❌ [Orders Service] Failed to update order status:', error.message);
    throw error;
  }
}

/**
 * Ensures user document exists in Firestore
 * If user exists in Firebase Auth but not in Firestore, creates the document
 * @param {string} uid - User ID
 * @param {string} email - User email from auth token
 * @returns {Promise<void>}
 */
async function ensureUserDocument(uid, email) {
  try {
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.log(`📝 [Orders Service] Creating user document for ${uid}`);
      
      // Get display name from Firebase Auth if available
      let displayName = '';
      try {
        const userRecord = await admin.auth().getUser(uid);
        displayName = userRecord.displayName || '';
      } catch (authError) {
        console.warn('⚠️ Could not fetch user from Auth:', authError.message);
      }

      await userRef.set({
        email: email,
        displayName: displayName,
        role: 'customer',
        registrationDate: admin.firestore.FieldValue.serverTimestamp(),
        lastLogin: admin.firestore.FieldValue.serverTimestamp(),
        isActive: true
      });

      console.log('✅ [Orders Service] User document created');
    }
  } catch (error) {
    console.error('❌ [Orders Service] Failed to ensure user document:', error.message);
    // Don't throw - user document is not critical for order creation
  }
}

/**
 * Updates order status with history tracking
 * @param {string} orderId - Order ID
 * @param {string} newStatus - New order status
 * @param {string} changedBy - User ID who made the change
 * @param {string} notes - Optional notes about the change
 * @returns {Promise<void>}
 */
async function updateOrderStatusWithHistory(orderId, newStatus, changedBy, notes = '') {
  try {
    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      throw new Error('Order not found');
    }

    const orderData = orderSnap.data();
    const statusHistory = orderData.statusHistory || [];

    // Add new status to history
    statusHistory.push({
      status: newStatus,
      changedBy: changedBy,
      changedAt: admin.firestore.Timestamp.now(),
      notes: notes
    });

    // Update order
    await orderRef.update({
      orderStatus: newStatus,
      statusHistory: statusHistory,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ [Orders Service] Order ${orderId} status updated to '${newStatus}'`);
  } catch (error) {
    console.error('❌ [Orders Service] Failed to update order status:', error.message);
    throw error;
  }
}

/**
 * Check if user is authorized to perform action on order
 * @param {Object} order - Order data
 * @param {string} userId - User ID attempting action
 * @param {string} role - Required role ('buyer' or 'seller')
 * @returns {boolean}
 */
function isAuthorizedForOrder(order, userId, role) {
  if (role === 'buyer') {
    return order.buyerId === userId;
  } else if (role === 'seller') {
    return order.sellerId === userId;
  }
  return false;
}

/**
 * Validate status transition
 * @param {string} currentStatus - Current order status
 * @param {string} newStatus - Desired new status
 * @param {string} role - Role attempting transition ('buyer' or 'seller')
 * @returns {Object} { valid: boolean, reason: string }
 */
function validateStatusTransition(currentStatus, newStatus, role) {
  // Define allowed transitions
  const transitions = {
    buyer: {
      paid: ['cancelled'], // Buyer can cancel paid orders
      delivered: ['completed'] // Buyer can confirm delivery
    },
    seller: {
      paid: ['processing', 'cancelled'], // Seller can accept or cancel
      processing: ['delivered', 'cancelled'] // Seller can mark delivered or cancel
    }
  };

  const allowedTransitions = transitions[role]?.[currentStatus] || [];

  if (!allowedTransitions.includes(newStatus)) {
    return {
      valid: false,
      reason: `Cannot transition from '${currentStatus}' to '${newStatus}' as ${role}`
    };
  }

  return { valid: true, reason: '' };
}

/**
 * Gets all orders for admin with filters, pagination, and user data
 * @param {Object} filters - Filter options
 * @param {string} filters.orderStatus - Filter by order status
 * @param {string} filters.paymentStatus - Filter by payment status
 * @param {string} filters.search - Search by buyer/seller name or email
 * @param {number} filters.page - Page number (default: 1)
 * @param {number} filters.limit - Items per page (default: 5)
 * @returns {Promise<Object>} { orders, total, page, limit, totalPages }
 */
async function getAllOrdersAdmin(filters = {}) {
  try {
    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 5;

    let query = db.collection('orders');

    // Apply filters
    if (filters.orderStatus) {
      query = query.where('orderStatus', '==', filters.orderStatus);
    }
    if (filters.paymentStatus) {
      query = query.where('paymentStatus', '==', filters.paymentStatus);
    }

    // Order by createdAt desc
    query = query.orderBy('createdAt', 'desc');

    // Get total count (before pagination) - need separate query for count
    const totalSnapshot = await query.get();
    const total = totalSnapshot.size;

    // For pagination, we'll fetch all matching orders and paginate in memory
    // This is acceptable for small datasets. For larger datasets, use cursor-based pagination
    const allOrdersSnapshot = await query.get();

    const userIds = new Set();

    // Collect all user IDs from all matching orders (before pagination)
    allOrdersSnapshot.forEach(doc => {
      const data = doc.data();
      userIds.add(data.buyerId);
      userIds.add(data.sellerId);
    });

    // Fetch all user documents in parallel
    const userPromises = Array.from(userIds).map(uid => 
      db.collection('users').doc(uid).get().catch(() => null)
    );
    const userDocs = await Promise.all(userPromises);

    // Create user map
    const userMap = new Map();
    userDocs.forEach(userDoc => {
      if (userDoc && userDoc.exists) {
        const userData = userDoc.data();
        userMap.set(userDoc.id, {
          displayName: userData.displayName || userData.username || 'Unknown User',
          email: userData.email || ''
        });
      }
    });

    // Process all orders and attach user data, apply search filter
    const allOrdersWithUsers = [];
    allOrdersSnapshot.forEach(doc => {
      const orderData = doc.data();
      const buyer = userMap.get(orderData.buyerId) || { displayName: 'Unknown User', email: '' };
      const seller = userMap.get(orderData.sellerId) || { displayName: 'Unknown User', email: '' };

      // Apply search filter if provided
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const buyerMatch = buyer.displayName.toLowerCase().includes(searchLower) || 
                          buyer.email.toLowerCase().includes(searchLower);
        const sellerMatch = seller.displayName.toLowerCase().includes(searchLower) || 
                           seller.email.toLowerCase().includes(searchLower);
        
        if (!buyerMatch && !sellerMatch) {
          return; // Skip this order if no match
        }
      }

      allOrdersWithUsers.push({
        id: doc.id,
        ...orderData,
        buyer: buyer,
        seller: seller
      });
    });

    // Calculate totals after search filter
    const finalTotal = allOrdersWithUsers.length;
    const totalPages = Math.ceil(finalTotal / limit);

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const orders = allOrdersWithUsers.slice(startIndex, endIndex);

    return {
      orders: orders,
      total: finalTotal,
      page: page,
      limit: limit,
      totalPages: totalPages
    };

  } catch (error) {
    console.error('❌ [Orders Service] Failed to get all orders (admin):', error.message);
    throw error;
  }
}

/**
 * Gets order by ID with buyer and seller user information
 * @param {string} orderId - Order ID
 * @returns {Promise<Object|null>} Order data with user info or null if not found
 */
async function getOrderByIdWithUsers(orderId) {
  try {
    const orderSnap = await db.collection('orders').doc(orderId).get();
    
    if (!orderSnap.exists) {
      return null;
    }

    const orderData = orderSnap.data();

    // Fetch buyer and seller user data
    const [buyerDoc, sellerDoc] = await Promise.all([
      db.collection('users').doc(orderData.buyerId).get().catch(() => null),
      db.collection('users').doc(orderData.sellerId).get().catch(() => null)
    ]);

    const buyer = buyerDoc && buyerDoc.exists ? {
      uid: buyerDoc.id,
      displayName: buyerDoc.data().displayName || buyerDoc.data().username || 'Unknown User',
      email: buyerDoc.data().email || ''
    } : {
      uid: orderData.buyerId,
      displayName: 'Unknown User',
      email: ''
    };

    const seller = sellerDoc && sellerDoc.exists ? {
      uid: sellerDoc.id,
      displayName: sellerDoc.data().displayName || sellerDoc.data().username || 'Unknown User',
      email: sellerDoc.data().email || ''
    } : {
      uid: orderData.sellerId,
      displayName: 'Unknown User',
      email: ''
    };

    return {
      id: orderSnap.id,
      ...orderData,
      buyer: buyer,
      seller: seller
    };
  } catch (error) {
    console.error('❌ [Orders Service] Failed to get order with users:', error.message);
    throw error;
  }
}

/**
 * Updates order status by admin with history tracking
 * Can revert cancelled orders by restoring previous status
 * @param {string} orderId - Order ID
 * @param {string} newStatus - New order status
 * @param {string} adminId - Admin user ID
 * @param {string} notes - Optional notes about the change
 * @returns {Promise<Object>} Updated order
 */
async function updateOrderStatusAdmin(orderId, newStatus, adminId, notes = '') {
  try {
    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      throw new Error('Order not found');
    }

    const orderData = orderSnap.data();
    const statusHistory = orderData.statusHistory || [];

    // If reverting from cancelled, try to restore previous status
    if (orderData.orderStatus === 'cancelled' && newStatus !== 'cancelled') {
      // Find the last status before cancelled
      let previousStatus = 'paid'; // Default fallback
      for (let i = statusHistory.length - 2; i >= 0; i--) {
        if (statusHistory[i].status !== 'cancelled') {
          previousStatus = statusHistory[i].status;
          break;
        }
      }
      
      // If newStatus is not the previous status, use the previous status
      if (newStatus === 'processing' || newStatus === 'paid') {
        newStatus = previousStatus;
      }

      notes = notes || `Reverted from cancelled to ${newStatus}`;
    }

    // Add new status to history
    statusHistory.push({
      status: newStatus,
      changedBy: adminId,
      changedAt: admin.firestore.Timestamp.now(),
      notes: notes || `Status updated by admin`
    });

    // Clear cancellation fields if reverting from cancelled
    const updateData = {
      orderStatus: newStatus,
      statusHistory: statusHistory,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (newStatus !== 'cancelled' && orderData.orderStatus === 'cancelled') {
      updateData.cancelledBy = null;
      updateData.cancelledAt = null;
      updateData.cancellationReason = null;
    }

    await orderRef.update(updateData);

    console.log(`✅ [Orders Service] Admin updated order ${orderId} status to '${newStatus}'`);

    return await getOrderById(orderId);
  } catch (error) {
    console.error('❌ [Orders Service] Failed to update order status (admin):', error.message);
    throw error;
  }
}

/**
 * Cancels an order by admin (only allowed when status is 'processing')
 * @param {string} orderId - Order ID
 * @param {string} adminId - Admin user ID
 * @param {string} reason - Cancellation reason
 * @returns {Promise<Object>} Updated order
 */
async function cancelOrderAdmin(orderId, adminId, reason) {
  try {
    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      throw new Error('Order not found');
    }

    const orderData = orderSnap.data();

    // Validate order is in processing status
    if (orderData.orderStatus !== 'processing') {
      throw new Error(`Cannot cancel order: order status must be 'processing', current status is '${orderData.orderStatus}'`);
    }

    // Get current status history
    const statusHistory = orderData.statusHistory || [];
    statusHistory.push({
      status: 'cancelled',
      changedBy: adminId,
      changedAt: admin.firestore.Timestamp.now(),
      notes: `Cancelled by admin: ${reason}`
    });

    // Update order
    await orderRef.update({
      orderStatus: 'cancelled',
      cancelledBy: 'admin',
      cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
      cancellationReason: reason,
      statusHistory: statusHistory,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ [Orders Service] Admin cancelled order ${orderId}`);

    return await getOrderById(orderId);
  } catch (error) {
    console.error('❌ [Orders Service] Failed to cancel order (admin):', error.message);
    throw error;
  }
}

/**
 * Updates shipping address by admin (only allowed when status is 'processing')
 * @param {string} orderId - Order ID
 * @param {Object} shippingAddress - New shipping address
 * @param {string} adminId - Admin user ID
 * @returns {Promise<Object>} Updated order
 */
async function updateShippingAddressAdmin(orderId, shippingAddress, adminId) {
  try {
    // Validate shipping address
    if (!shippingAddress.fullName || !shippingAddress.address || !shippingAddress.phone) {
      throw new Error('Shipping address must include fullName, address, and phone');
    }

    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      throw new Error('Order not found');
    }

    const orderData = orderSnap.data();

    // Validate order is in processing status
    if (orderData.orderStatus !== 'processing') {
      throw new Error(`Cannot update shipping address: order status must be 'processing', current status is '${orderData.orderStatus}'`);
    }

    // Update shipping address
    await orderRef.update({
      shippingAddress: {
        fullName: shippingAddress.fullName,
        address: shippingAddress.address,
        phone: shippingAddress.phone,
        city: shippingAddress.city || '',
        postalCode: shippingAddress.postalCode || ''
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ [Orders Service] Admin updated shipping address for order ${orderId}`);

    return await getOrderById(orderId);
  } catch (error) {
    console.error('❌ [Orders Service] Failed to update shipping address (admin):', error.message);
    throw error;
  }
}

module.exports = {
  createOrder,
  getOrderById,
  getOrdersByBuyer,
  getOrdersBySeller,
  updateOrderStatus,
  ensureUserDocument,
  updateOrderStatusWithHistory,
  isAuthorizedForOrder,
  validateStatusTransition,
  getAllOrdersAdmin,
  getOrderByIdWithUsers,
  updateOrderStatusAdmin,
  cancelOrderAdmin,
  updateShippingAddressAdmin
};

