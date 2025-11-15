// Ratings Routes - API endpoints for ratings module
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middlewares/auth_middleware');
const {
  validateAndNormalizeRating,
  validateSellerReply,
  validateReport,
  validateRatingIdParam,
  validateProductIdParam
} = require('./ratings_validator');
const {
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
} = require('./ratings_service');

/**
 * POST /api/ratings
 * Create a new rating (requires auth + verified purchase)
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { valid, errors, data } = validateAndNormalizeRating(req.body);
    
    if (!valid) {
      return res.status(400).json({
        success: false,
        errors
      });
    }
    
    const rating = await createRating(userId, data);
    
    return res.status(201).json({
      success: true,
      rating
    });
    
  } catch (error) {
    console.error('❌ [Ratings] Create rating error:', error.message);
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/ratings/product/:productId
 * Get all ratings for a product (public, with pagination)
 * Query params: page, limit, sort (newest|oldest|highest|lowest), filter (1-5)
 */
router.get('/product/:productId', validateProductIdParam, async (req, res) => {
  try {
    const { productId } = req.params;
    const { page, limit, sort, filter } = req.query;
    
    const options = {
      page: page || 1,
      limit: limit || 10,
      sort: sort || 'newest',
      filter: filter ? parseInt(filter) : null
    };
    
    const result = await getProductRatings(productId, options);
    
    return res.json({
      success: true,
      ...result
    });
    
  } catch (error) {
    console.error('❌ [Ratings] Get product ratings error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/ratings/product/:productId/stats
 * Get aggregated rating statistics for a product (public)
 */
router.get('/product/:productId/stats', validateProductIdParam, async (req, res) => {
  try {
    const { productId } = req.params;
    const { calculateRatingStats } = require('./ratings_service');
    
    const stats = await calculateRatingStats(productId);
    
    return res.json({
      success: true,
      stats
    });
    
  } catch (error) {
    console.error('❌ [Ratings] Get rating stats error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/ratings/product/:productId/check-eligible
 * Check if user can review this product (requires auth)
 */
router.get('/product/:productId/check-eligible', requireAuth, validateProductIdParam, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { productId } = req.params;
    
    const eligibility = await checkRatingEligibility(userId, productId);
    
    return res.json({
      success: true,
      ...eligibility
    });
    
  } catch (error) {
    console.error('❌ [Ratings] Check eligibility error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/ratings/:ratingId
 * Get a single rating by ID (public)
 */
router.get('/:ratingId', validateRatingIdParam, async (req, res) => {
  try {
    const { ratingId } = req.params;
    const rating = await getRatingById(ratingId);
    
    return res.json({
      success: true,
      rating
    });
    
  } catch (error) {
    console.error('❌ [Ratings] Get rating error:', error.message);
    const status = error.message === 'Rating not found' ? 404 : 500;
    return res.status(status).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/ratings/:ratingId
 * Update own rating (requires auth, ownership check)
 */
router.put('/:ratingId', requireAuth, validateRatingIdParam, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { ratingId } = req.params;
    const updates = req.body;
    
    // Validate star if provided
    if (updates.star !== undefined) {
      const star = Number(updates.star);
      if (!Number.isInteger(star) || star < 1 || star > 5) {
        return res.status(400).json({
          success: false,
          error: 'star must be between 1 and 5'
        });
      }
    }
    
    // Validate comment if provided
    if (updates.comment !== undefined) {
      const comment = String(updates.comment).trim();
      if (comment.length > 1000) {
        return res.status(400).json({
          success: false,
          error: 'comment must be 1000 characters or less'
        });
      }
    }
    
    const rating = await updateRating(ratingId, userId, updates);
    
    return res.json({
      success: true,
      rating
    });
    
  } catch (error) {
    console.error('❌ [Ratings] Update rating error:', error.message);
    const status = error.message.includes('Permission denied') ? 403 : 
                   error.message === 'Rating not found' ? 404 : 400;
    return res.status(status).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/ratings/:ratingId
 * Delete own rating (requires auth, ownership check)
 */
router.delete('/:ratingId', requireAuth, validateRatingIdParam, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { ratingId } = req.params;
    
    const result = await deleteRating(ratingId, userId);
    
    return res.json({
      success: true,
      ...result
    });
    
  } catch (error) {
    console.error('❌ [Ratings] Delete rating error:', error.message);
    const status = error.message.includes('Permission denied') ? 403 : 
                   error.message === 'Rating not found' ? 404 : 400;
    return res.status(status).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ratings/:ratingId/reply
 * Seller reply to a review (requires auth, seller ownership)
 */
router.post('/:ratingId/reply', requireAuth, validateRatingIdParam, async (req, res) => {
  try {
    const sellerId = req.user.uid;
    const { ratingId } = req.params;
    const { valid, errors, data } = validateSellerReply(req.body);
    
    if (!valid) {
      return res.status(400).json({
        success: false,
        errors
      });
    }
    
    const rating = await addSellerReply(ratingId, sellerId, data.comment);
    
    return res.json({
      success: true,
      rating
    });
    
  } catch (error) {
    console.error('❌ [Ratings] Add seller reply error:', error.message);
    const status = error.message.includes('Permission denied') ? 403 : 
                   error.message === 'Rating not found' ? 404 : 400;
    return res.status(status).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/ratings/:ratingId/reply
 * Update seller reply (requires auth, seller ownership)
 */
router.put('/:ratingId/reply', requireAuth, validateRatingIdParam, async (req, res) => {
  try {
    const sellerId = req.user.uid;
    const { ratingId } = req.params;
    const { valid, errors, data } = validateSellerReply(req.body);
    
    if (!valid) {
      return res.status(400).json({
        success: false,
        errors
      });
    }
    
    const rating = await updateSellerReply(ratingId, sellerId, data.comment);
    
    return res.json({
      success: true,
      rating
    });
    
  } catch (error) {
    console.error('❌ [Ratings] Update seller reply error:', error.message);
    const status = error.message.includes('Permission denied') ? 403 : 
                   error.message === 'Rating not found' ? 404 : 400;
    return res.status(status).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/ratings/:ratingId/reply
 * Delete seller reply (requires auth, seller ownership)
 */
router.delete('/:ratingId/reply', requireAuth, validateRatingIdParam, async (req, res) => {
  try {
    const sellerId = req.user.uid;
    const { ratingId } = req.params;
    
    const rating = await deleteSellerReply(ratingId, sellerId);
    
    return res.json({
      success: true,
      rating
    });
    
  } catch (error) {
    console.error('❌ [Ratings] Delete seller reply error:', error.message);
    const status = error.message.includes('Permission denied') ? 403 : 
                   error.message === 'Rating not found' ? 404 : 400;
    return res.status(status).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ratings/:ratingId/report
 * Report inappropriate review (requires auth)
 */
router.post('/:ratingId/report', requireAuth, validateRatingIdParam, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { ratingId } = req.params;
    const { valid, errors, data } = validateReport(req.body);
    
    if (!valid) {
      return res.status(400).json({
        success: false,
        errors
      });
    }
    
    const result = await reportRating(ratingId, userId, data.reason);
    
    return res.json({
      success: true,
      ...result
    });
    
  } catch (error) {
    console.error('❌ [Ratings] Report rating error:', error.message);
    const status = error.message === 'Rating not found' ? 404 : 400;
    return res.status(status).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

