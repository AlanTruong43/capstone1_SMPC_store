/**
 * Cart Routes Module
 * Defines all cart-related API endpoints
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middlewares/auth_middleware');
const {
  addToCart,
  getCart,
  updateCartItem,
  removeCartItem,
  clearCart
} = require('./cart_service');
const {
  validateAddToCart,
  validateUpdateQuantity,
  validateProductIdParam
} = require('./cart_validator');

/**
 * POST /api/cart/add
 * Add item to cart
 * Protected route - requires authentication
 * 
 * Request body:
 * {
 *   productId: string,
 *   quantity: number (1-99)
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   message: "Item added to cart successfully"
 * }
 */
router.post('/add', requireAuth, async (req, res) => {
  try {
    // Validate input
    const validation = validateAddToCart(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.errors
      });
    }

    const { productId, quantity } = validation.data;
    const userId = req.user.uid;

    // Add to cart
    const result = await addToCart(userId, productId, quantity);

    res.status(200).json(result);

  } catch (error) {
    console.error('Error in POST /api/cart/add:', error);
    
    if (error.message === 'Product not found') {
      return res.status(404).json({ error: error.message });
    }
    
    if (error.message === 'Product is not available for purchase') {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({
      error: 'Failed to add item to cart',
      detail: error.message
    });
  }
});

/**
 * GET /api/cart
 * Get user's cart with full product details
 * Protected route - requires authentication
 * 
 * Response:
 * {
 *   items: [
 *     {
 *       productId: string,
 *       quantity: number,
 *       addedAt: timestamp,
 *       product: { id, name, price, imageUrl, condition, status, location, sellerName },
 *       itemTotal: number
 *     }
 *   ],
 *   subtotal: number,
 *   shippingFee: number,
 *   total: number,
 *   itemCount: number
 * }
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.uid;
    const cart = await getCart(userId);

    res.status(200).json(cart);

  } catch (error) {
    console.error('Error in GET /api/cart:', error);
    res.status(500).json({
      error: 'Failed to get cart',
      detail: error.message
    });
  }
});

/**
 * PUT /api/cart/item/:productId
 * Update item quantity in cart
 * Protected route - requires authentication
 * 
 * Request params:
 * - productId: string
 * 
 * Request body:
 * {
 *   quantity: number (1-99)
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   message: "Cart item updated successfully"
 * }
 */
router.put('/item/:productId', requireAuth, async (req, res) => {
  try {
    // Validate productId param
    const paramValidation = validateProductIdParam(req.params);
    if (!paramValidation.valid) {
      return res.status(400).json({
        error: 'Validation failed',
        details: paramValidation.errors
      });
    }

    // Validate quantity in body
    const bodyValidation = validateUpdateQuantity(req.body);
    if (!bodyValidation.valid) {
      return res.status(400).json({
        error: 'Validation failed',
        details: bodyValidation.errors
      });
    }

    const { productId } = paramValidation.data;
    const { quantity } = bodyValidation.data;
    const userId = req.user.uid;

    // Update cart item
    const result = await updateCartItem(userId, productId, quantity);

    res.status(200).json(result);

  } catch (error) {
    console.error('Error in PUT /api/cart/item/:productId:', error);
    
    if (error.message === 'Cart not found' || error.message === 'Item not found in cart') {
      return res.status(404).json({ error: error.message });
    }

    res.status(500).json({
      error: 'Failed to update cart item',
      detail: error.message
    });
  }
});

/**
 * DELETE /api/cart/item/:productId
 * Remove item from cart
 * Protected route - requires authentication
 * 
 * Request params:
 * - productId: string
 * 
 * Response:
 * {
 *   success: true,
 *   message: "Item removed from cart successfully"
 * }
 */
router.delete('/item/:productId', requireAuth, async (req, res) => {
  try {
    // Validate productId param
    const paramValidation = validateProductIdParam(req.params);
    if (!paramValidation.valid) {
      return res.status(400).json({
        error: 'Validation failed',
        details: paramValidation.errors
      });
    }

    const { productId } = paramValidation.data;
    const userId = req.user.uid;

    // Remove cart item
    const result = await removeCartItem(userId, productId);

    res.status(200).json(result);

  } catch (error) {
    console.error('Error in DELETE /api/cart/item/:productId:', error);
    
    if (error.message === 'Cart not found' || error.message === 'Item not found in cart') {
      return res.status(404).json({ error: error.message });
    }

    res.status(500).json({
      error: 'Failed to remove cart item',
      detail: error.message
    });
  }
});

/**
 * DELETE /api/cart
 * Clear entire cart
 * Protected route - requires authentication
 * 
 * Response:
 * {
 *   success: true,
 *   message: "Cart cleared successfully"
 * }
 */
router.delete('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.uid;
    const result = await clearCart(userId);

    res.status(200).json(result);

  } catch (error) {
    console.error('Error in DELETE /api/cart:', error);
    res.status(500).json({
      error: 'Failed to clear cart',
      detail: error.message
    });
  }
});

module.exports = router;

