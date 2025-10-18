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

    // Prepare order document
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
      status: 'pending', // Initial status
      paymentDetails: null, // Will be populated after payment
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
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

module.exports = {
  createOrder,
  getOrderById,
  getOrdersByBuyer,
  getOrdersBySeller,
  updateOrderStatus,
  ensureUserDocument
};

