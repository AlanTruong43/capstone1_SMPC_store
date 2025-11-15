// Ratings Service - Business logic for ratings module
const { db, admin } = require('../../config/firebase');

const ratingsCol = db.collection('ratings');
const productsCol = db.collection('products');
const ordersCol = db.collection('orders');
const usersCol = db.collection('users');

/**
 * Verify if user has completed purchase for a product
 * @param {string} userId - User ID
 * @param {string} productId - Product ID
 * @param {string} orderId - Order ID (optional, if provided will verify this specific order)
 * @returns {Promise<Object|null>} Order data if verified, null otherwise
 */
async function verifyPurchase(userId, productId, orderId = null) {
  if (orderId) {
    // Verify specific order
    const orderRef = ordersCol.doc(orderId);
    const orderSnap = await orderRef.get();
    
    if (!orderSnap.exists) {
      return null;
    }
    
    const orderData = orderSnap.data();
    
    // Check if order belongs to user, is for this product, and is completed
    if (
      orderData.buyerId === userId &&
      orderData.productId === productId &&
      orderData.orderStatus === 'completed'
    ) {
      return { id: orderSnap.id, ...orderData };
    }
    
    return null;
  } else {
    // Find any completed order for this user and product
    const ordersSnapshot = await ordersCol
      .where('buyerId', '==', userId)
      .where('productId', '==', productId)
      .where('orderStatus', '==', 'completed')
      .orderBy('completedAt', 'desc')
      .limit(1)
      .get();
    
    if (ordersSnapshot.empty) {
      return null;
    }
    
    const orderDoc = ordersSnapshot.docs[0];
    return { id: orderDoc.id, ...orderDoc.data() };
  }
}

/**
 * Check if user has already rated this product
 * @param {string} userId - User ID
 * @param {string} productId - Product ID
 * @returns {Promise<Object|null>} Existing rating if found, null otherwise
 */
async function getExistingRating(userId, productId) {
  const ratingSnapshot = await ratingsCol
    .where('userId', '==', userId)
    .where('productId', '==', productId)
    .limit(1)
    .get();
  
  if (ratingSnapshot.empty) {
    return null;
  }
  
  const ratingDoc = ratingSnapshot.docs[0];
  return { id: ratingDoc.id, ...ratingDoc.data() };
}

/**
 * Calculate rating statistics for a product
 * @param {string} productId - Product ID
 * @returns {Promise<Object>} Rating statistics
 */
async function calculateRatingStats(productId) {
  const ratingsSnapshot = await ratingsCol
    .where('productId', '==', productId)
    .get();
  
  if (ratingsSnapshot.empty) {
    return {
      averageRating: 0,
      ratingCount: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    };
  }
  
  let totalStars = 0;
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  
  ratingsSnapshot.forEach(doc => {
    const rating = doc.data();
    const star = rating.star || 0;
    totalStars += star;
    if (star >= 1 && star <= 5) {
      distribution[star]++;
    }
  });
  
  const count = ratingsSnapshot.size;
  const averageRating = count > 0 ? totalStars / count : 0;
  
  return {
    averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
    ratingCount: count,
    ratingDistribution: distribution
  };
}

/**
 * Update product rating statistics
 * @param {string} productId - Product ID
 */
async function updateProductRatingStats(productId) {
  const stats = await calculateRatingStats(productId);
  
  await productsCol.doc(productId).update({
    averageRating: stats.averageRating,
    ratingCount: stats.ratingCount,
    ratingDistribution: stats.ratingDistribution,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  return stats;
}

/**
 * Create a new rating
 * @param {string} userId - User ID
 * @param {Object} ratingData - Rating data
 * @returns {Promise<Object>} Created rating
 */
async function createRating(userId, ratingData) {
  // Verify purchase
  const order = await verifyPurchase(userId, ratingData.productId, ratingData.orderId);
  if (!order) {
    throw new Error('Purchase verification failed. You must have completed an order for this product.');
  }
  
  // Check if user already rated this product
  const existingRating = await getExistingRating(userId, ratingData.productId);
  if (existingRating) {
    throw new Error('You have already rated this product. You can update your existing rating instead.');
  }
  
  // Create rating document
  const ratingDoc = {
    userId: userId,
    productId: ratingData.productId,
    orderId: ratingData.orderId,
    star: ratingData.star,
    comment: ratingData.comment || '',
    isVerified: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  
  // Create rating first
  const ratingRef = ratingsCol.doc();
  await ratingRef.set(ratingDoc);
  
  // Then update product stats (calculate after creating rating)
  const stats = await calculateRatingStats(ratingData.productId);
  const productRef = productsCol.doc(ratingData.productId);
  await productRef.update({
    averageRating: stats.averageRating,
    ratingCount: stats.ratingCount,
    ratingDistribution: stats.ratingDistribution,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  return { id: ratingRef.id, ...ratingDoc };
}

/**
 * Get ratings for a product with pagination
 * @param {string} productId - Product ID
 * @param {Object} options - Query options
 * @param {number} options.page - Page number (default: 1)
 * @param {number} options.limit - Items per page (default: 10)
 * @param {string} options.sort - Sort order: 'newest', 'oldest', 'highest', 'lowest' (default: 'newest')
 * @param {number} options.filter - Filter by star rating (1-5, optional)
 * @returns {Promise<Object>} Paginated ratings
 */
async function getProductRatings(productId, options = {}) {
  const {
    page = 1,
    limit = 10,
    sort = 'newest',
    filter = null
  } = options;
  
  let query = ratingsCol.where('productId', '==', productId);
  
  // Apply star filter if provided
  if (filter && filter >= 1 && filter <= 5) {
    query = query.where('star', '==', filter);
  }
  
  // Apply sorting
  if (sort === 'newest') {
    query = query.orderBy('createdAt', 'desc');
  } else if (sort === 'oldest') {
    query = query.orderBy('createdAt', 'asc');
  } else if (sort === 'highest') {
    query = query.orderBy('star', 'desc').orderBy('createdAt', 'desc');
  } else if (sort === 'lowest') {
    query = query.orderBy('star', 'asc').orderBy('createdAt', 'desc');
  }
  
  // Get total count for pagination (before filtering)
  const totalSnapshot = await ratingsCol
    .where('productId', '==', productId)
    .get();
  
  const total = totalSnapshot.size;
  
  // Fetch all matching ratings (Firestore doesn't support offset, so we fetch all and paginate in memory)
  // This is acceptable for reviews as they won't be in millions
  const allRatingsSnapshot = await query.get();
  
  // Paginate in memory
  const offset = (page - 1) * limit;
  const paginatedDocs = allRatingsSnapshot.docs.slice(offset, offset + limit);
  
  // Get unique user IDs from ratings
  const userIds = [...new Set(paginatedDocs.map(doc => doc.data().userId))];
  
  // Fetch user data for all unique user IDs
  const userPromises = userIds.map(userId => 
    usersCol.doc(userId).get().catch(() => null)
  );
  const userDocs = await Promise.all(userPromises);
  
  // Create a map of userId -> user displayName
  const userMap = new Map();
  userDocs.forEach((userDoc, index) => {
    if (userDoc && userDoc.exists) {
      const userData = userDoc.data();
      userMap.set(userIds[index], {
        displayName: userData.displayName || userData.username || userData.email?.split('@')[0] || 'Unknown User',
        email: userData.email || ''
      });
    } else {
      userMap.set(userIds[index], {
        displayName: 'Unknown User',
        email: ''
      });
    }
  });
  
  const ratings = paginatedDocs.map(doc => {
    const data = doc.data();
    const userInfo = userMap.get(data.userId) || { displayName: 'Unknown User', email: '' };
    
    return {
      id: doc.id,
      userId: data.userId,
      userName: userInfo.displayName,
      userEmail: userInfo.email,
      productId: data.productId,
      orderId: data.orderId,
      star: data.star,
      comment: data.comment,
      isVerified: data.isVerified,
      sellerReply: data.sellerReply || null,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt
    };
  });
  
  return {
    ratings,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Get rating by ID
 * @param {string} ratingId - Rating ID
 * @returns {Promise<Object>} Rating data
 */
async function getRatingById(ratingId) {
  const ratingRef = ratingsCol.doc(ratingId);
  const ratingSnap = await ratingRef.get();
  
  if (!ratingSnap.exists) {
    throw new Error('Rating not found');
  }
  
  const data = ratingSnap.data();
  
  // Fetch user data
  let userName = 'Unknown User';
  let userEmail = '';
  try {
    const userDoc = await usersCol.doc(data.userId).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      userName = userData.displayName || userData.username || userData.email?.split('@')[0] || 'Unknown User';
      userEmail = userData.email || '';
    }
  } catch (error) {
    console.error('Error fetching user data:', error);
  }
  
  return {
    id: ratingSnap.id,
    ...data,
    userName: userName,
    userEmail: userEmail,
    createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt
  };
}

/**
 * Update a rating
 * @param {string} ratingId - Rating ID
 * @param {string} userId - User ID (for ownership check)
 * @param {Object} updates - Update data
 * @returns {Promise<Object>} Updated rating
 */
async function updateRating(ratingId, userId, updates) {
  const ratingRef = ratingsCol.doc(ratingId);
  const ratingSnap = await ratingRef.get();
  
  if (!ratingSnap.exists) {
    throw new Error('Rating not found');
  }
  
  const ratingData = ratingSnap.data();
  
  // Check ownership
  if (ratingData.userId !== userId) {
    throw new Error('Permission denied. You can only update your own ratings.');
  }
  
  const updateData = {
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  
  if (updates.star !== undefined) {
    const star = Number(updates.star);
    if (!Number.isInteger(star) || star < 1 || star > 5) {
      throw new Error('star must be between 1 and 5');
    }
    updateData.star = star;
  }
  
  if (updates.comment !== undefined) {
    const comment = String(updates.comment).trim();
    if (comment.length > 1000) {
      throw new Error('comment must be 1000 characters or less');
    }
    updateData.comment = comment;
  }
  
  // Update rating first
  await ratingRef.update(updateData);
  
  // Then update product stats (recalculate after update)
  const stats = await calculateRatingStats(ratingData.productId);
  const productRef = productsCol.doc(ratingData.productId);
  await productRef.update({
    averageRating: stats.averageRating,
    ratingCount: stats.ratingCount,
    ratingDistribution: stats.ratingDistribution,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  return await getRatingById(ratingId);
}

/**
 * Delete a rating
 * @param {string} ratingId - Rating ID
 * @param {string} userId - User ID (for ownership check)
 * @returns {Promise<Object>} Success message
 */
async function deleteRating(ratingId, userId) {
  const ratingRef = ratingsCol.doc(ratingId);
  const ratingSnap = await ratingRef.get();
  
  if (!ratingSnap.exists) {
    throw new Error('Rating not found');
  }
  
  const ratingData = ratingSnap.data();
  
  // Check ownership
  if (ratingData.userId !== userId) {
    throw new Error('Permission denied. You can only delete your own ratings.');
  }
  
  const productId = ratingData.productId;
  
  // Delete rating first
  await ratingRef.delete();
  
  // Then update product stats (recalculate after deletion)
  const stats = await calculateRatingStats(productId);
  const productRef = productsCol.doc(productId);
  await productRef.update({
    averageRating: stats.averageRating,
    ratingCount: stats.ratingCount,
    ratingDistribution: stats.ratingDistribution,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  return { success: true, message: 'Rating deleted successfully' };
}

/**
 * Add seller reply to a rating
 * @param {string} ratingId - Rating ID
 * @param {string} sellerId - Seller user ID (for ownership check)
 * @param {string} comment - Reply comment
 * @returns {Promise<Object>} Updated rating
 */
async function addSellerReply(ratingId, sellerId, comment) {
  const ratingRef = ratingsCol.doc(ratingId);
  const ratingSnap = await ratingRef.get();
  
  if (!ratingSnap.exists) {
    throw new Error('Rating not found');
  }
  
  const ratingData = ratingSnap.data();
  
  // Verify product belongs to seller
  const productRef = productsCol.doc(ratingData.productId);
  const productSnap = await productRef.get();
  
  if (!productSnap.exists) {
    throw new Error('Product not found');
  }
  
  if (productSnap.data().sellerId !== sellerId) {
    throw new Error('Permission denied. You can only reply to reviews on your own products.');
  }
  
  // Check if reply already exists
  if (ratingData.sellerReply) {
    throw new Error('You have already replied to this review. You can update your existing reply.');
  }
  
  const replyData = {
    comment: comment.trim(),
    repliedAt: admin.firestore.FieldValue.serverTimestamp(),
    repliedBy: sellerId
  };
  
  await ratingRef.update({
    sellerReply: replyData,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  return await getRatingById(ratingId);
}

/**
 * Update seller reply
 * @param {string} ratingId - Rating ID
 * @param {string} sellerId - Seller user ID (for ownership check)
 * @param {string} comment - Updated reply comment
 * @returns {Promise<Object>} Updated rating
 */
async function updateSellerReply(ratingId, sellerId, comment) {
  const ratingRef = ratingsCol.doc(ratingId);
  const ratingSnap = await ratingRef.get();
  
  if (!ratingSnap.exists) {
    throw new Error('Rating not found');
  }
  
  const ratingData = ratingSnap.data();
  
  if (!ratingData.sellerReply) {
    throw new Error('No reply found to update');
  }
  
  if (ratingData.sellerReply.repliedBy !== sellerId) {
    throw new Error('Permission denied. You can only update your own replies.');
  }
  
  // Verify product still belongs to seller
  const productRef = productsCol.doc(ratingData.productId);
  const productSnap = await productRef.get();
  
  if (!productSnap.exists || productSnap.data().sellerId !== sellerId) {
    throw new Error('Permission denied. You can only update replies on your own products.');
  }
  
  ratingData.sellerReply.comment = comment.trim();
  ratingData.sellerReply.updatedAt = admin.firestore.FieldValue.serverTimestamp();
  
  await ratingRef.update({
    sellerReply: ratingData.sellerReply,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  return await getRatingById(ratingId);
}

/**
 * Delete seller reply
 * @param {string} ratingId - Rating ID
 * @param {string} sellerId - Seller user ID (for ownership check)
 * @returns {Promise<Object>} Updated rating
 */
async function deleteSellerReply(ratingId, sellerId) {
  const ratingRef = ratingsCol.doc(ratingId);
  const ratingSnap = await ratingRef.get();
  
  if (!ratingSnap.exists) {
    throw new Error('Rating not found');
  }
  
  const ratingData = ratingSnap.data();
  
  if (!ratingData.sellerReply) {
    throw new Error('No reply found to delete');
  }
  
  if (ratingData.sellerReply.repliedBy !== sellerId) {
    throw new Error('Permission denied. You can only delete your own replies.');
  }
  
  await ratingRef.update({
    sellerReply: admin.firestore.FieldValue.delete(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  return await getRatingById(ratingId);
}

/**
 * Report a rating
 * @param {string} ratingId - Rating ID
 * @param {string} userId - User ID reporting
 * @param {string} reason - Report reason
 * @returns {Promise<Object>} Success message
 */
async function reportRating(ratingId, userId, reason) {
  const ratingRef = ratingsCol.doc(ratingId);
  const ratingSnap = await ratingRef.get();
  
  if (!ratingSnap.exists) {
    throw new Error('Rating not found');
  }
  
  await ratingRef.update({
    isReported: true,
    reportedReason: reason.trim(),
    reportedAt: admin.firestore.FieldValue.serverTimestamp(),
    reportedBy: userId,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  return { success: true, message: 'Rating reported successfully' };
}

/**
 * Check if user is eligible to rate a product
 * @param {string} userId - User ID
 * @param {string} productId - Product ID
 * @returns {Promise<Object>} Eligibility status
 */
async function checkRatingEligibility(userId, productId) {
  // Check if user has completed purchase
  const order = await verifyPurchase(userId, productId);
  const hasPurchase = !!order;
  
  // Check if user already rated
  const existingRating = await getExistingRating(userId, productId);
  const hasRated = !!existingRating;
  
  return {
    eligible: hasPurchase && !hasRated,
    hasPurchase,
    hasRated,
    orderId: order?.id || null,
    existingRatingId: existingRating?.id || null
  };
}

module.exports = {
  verifyPurchase,
  getExistingRating,
  calculateRatingStats,
  updateProductRatingStats,
  createRating,
  getProductRatings,
  getRatingById,
  updateRating,
  deleteRating,
  addSellerReply,
  updateSellerReply,
  deleteSellerReply,
  reportRating,
  checkRatingEligibility
};

