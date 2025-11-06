/**
 * Cart Service Module
 * Handles all cart business logic with Firestore transactions
 */

const { db } = require('../../config/firebase');

/**
 * Add item to cart (atomic operation)
 * @param {string} userId - User ID
 * @param {string} productId - Product ID
 * @param {number} quantity - Quantity to add
 * @returns {Promise<Object>} Result object
 */
async function addToCart(userId, productId, quantity) {
  try {
    // Step 1: Validate product exists and is available
    const productRef = db.collection('products').doc(productId);
    const productDoc = await productRef.get();

    if (!productDoc.exists) {
      throw new Error('Product not found');
    }

    const productData = productDoc.data();
    if (productData.status !== 'available') {
      throw new Error('Product is not available for purchase');
    }

    // Step 2: Use transaction to add/update cart atomically
    const cartRef = db.collection('carts').doc(userId);
    
    await db.runTransaction(async (transaction) => {
      const cartDoc = await transaction.get(cartRef);

      if (!cartDoc.exists) {
        // Cart doesn't exist - create new cart with first item
        transaction.set(cartRef, {
          items: [
            {
              productId: productId,
              quantity: quantity
            }
          ]
        });
      } else {
        // Cart exists - update items array
        const items = cartDoc.data().items || [];
        const existingItemIndex = items.findIndex(item => item.productId === productId);

        if (existingItemIndex >= 0) {
          // Item already in cart - increment quantity
          items[existingItemIndex].quantity += quantity;
          
          // Ensure quantity doesn't exceed 99
          if (items[existingItemIndex].quantity > 99) {
            items[existingItemIndex].quantity = 99;
          }
        } else {
          // New item - add to cart
          items.push({
            productId: productId,
            quantity: quantity
          });
        }

        transaction.update(cartRef, { items });
      }
    });

    return {
      success: true,
      message: 'Item added to cart successfully'
    };

  } catch (error) {
    console.error('Error adding to cart:', error);
    throw error;
  }
}

/**
 * Get user's cart with full product details
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Cart with populated product details
 */
async function getCart(userId) {
  try {
    const cartRef = db.collection('carts').doc(userId);
    const cartDoc = await cartRef.get();

    if (!cartDoc.exists) {
      // No cart yet - return empty cart
      return {
        items: [],
        subtotal: 0,
        shippingFee: 5000,
        total: 5000,
        itemCount: 0
      };
    }

    const cartData = cartDoc.data();
    const items = cartData.items || [];

    if (items.length === 0) {
      return {
        items: [],
        subtotal: 0,
        shippingFee: 5000,
        total: 5000,
        itemCount: 0
      };
    }

    // Fetch all product details in parallel
    const itemsWithDetails = await Promise.all(
      items.map(async (item) => {
        try {
          const productDoc = await db.collection('products').doc(item.productId).get();
          
          if (!productDoc.exists) {
            return null; // Product deleted
          }

          const productData = productDoc.data();

          // Fetch seller information
          const sellerId = productData.sellerId || productData.userId; // Support both field names
          let sellerName = 'Unknown Seller';
          if (sellerId) {
            try {
              const sellerDoc = await db.collection('users').doc(sellerId).get();
              if (sellerDoc.exists) {
                const sellerData = sellerDoc.data();
                sellerName = sellerData.displayName || sellerData.email || 'Unknown Seller';
              }
            } catch (err) {
              console.warn('Error fetching seller:', err);
            }
          }

          return {
            productId: item.productId,
            quantity: item.quantity,
            product: {
              id: productDoc.id,
              name: productData.name,
              price: productData.price,
              imageUrl: productData.imageUrl,
              condition: productData.condition,
              status: productData.status,
              location: productData.location,
              sellerId: sellerId, // Include sellerId for order creation
              sellerName: sellerName
            },
            itemTotal: productData.price * item.quantity
          };
        } catch (err) {
          console.error('Error fetching product details:', err);
          return null;
        }
      })
    );

    // Filter out null items (deleted products)
    const validItems = itemsWithDetails.filter(item => item !== null);

    // Calculate totals
    const subtotal = validItems.reduce((sum, item) => sum + item.itemTotal, 0);
    const shippingFee = 5000; // Fixed shipping fee
    const total = subtotal + shippingFee;
    const itemCount = validItems.reduce((sum, item) => sum + item.quantity, 0);

    return {
      items: validItems,
      subtotal,
      shippingFee,
      total,
      itemCount
    };

  } catch (error) {
    console.error('Error getting cart:', error);
    throw error;
  }
}

/**
 * Update item quantity in cart (atomic operation)
 * @param {string} userId - User ID
 * @param {string} productId - Product ID
 * @param {number} newQuantity - New quantity (1-99)
 * @returns {Promise<Object>} Result object
 */
async function updateCartItem(userId, productId, newQuantity) {
  try {
    const cartRef = db.collection('carts').doc(userId);

    await db.runTransaction(async (transaction) => {
      const cartDoc = await transaction.get(cartRef);

      if (!cartDoc.exists) {
        throw new Error('Cart not found');
      }

      const items = cartDoc.data().items || [];
      const itemIndex = items.findIndex(item => item.productId === productId);

      if (itemIndex === -1) {
        throw new Error('Item not found in cart');
      }

      // Update quantity
      items[itemIndex].quantity = newQuantity;

      transaction.update(cartRef, { items });
    });

    return {
      success: true,
      message: 'Cart item updated successfully'
    };

  } catch (error) {
    console.error('Error updating cart item:', error);
    throw error;
  }
}

/**
 * Remove item from cart (atomic operation)
 * @param {string} userId - User ID
 * @param {string} productId - Product ID
 * @returns {Promise<Object>} Result object
 */
async function removeCartItem(userId, productId) {
  try {
    const cartRef = db.collection('carts').doc(userId);

    await db.runTransaction(async (transaction) => {
      const cartDoc = await transaction.get(cartRef);

      if (!cartDoc.exists) {
        throw new Error('Cart not found');
      }

      const items = cartDoc.data().items || [];
      const filteredItems = items.filter(item => item.productId !== productId);

      if (filteredItems.length === items.length) {
        throw new Error('Item not found in cart');
      }

      transaction.update(cartRef, { items: filteredItems });
    });

    return {
      success: true,
      message: 'Item removed from cart successfully'
    };

  } catch (error) {
    console.error('Error removing cart item:', error);
    throw error;
  }
}

/**
 * Clear entire cart
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Result object
 */
async function clearCart(userId) {
  try {
    const cartRef = db.collection('carts').doc(userId);
    
    // Set items to empty array (keep document for future use)
    await cartRef.set({ items: [] }, { merge: true });

    return {
      success: true,
      message: 'Cart cleared successfully'
    };

  } catch (error) {
    console.error('Error clearing cart:', error);
    throw error;
  }
}

module.exports = {
  addToCart,
  getCart,
  updateCartItem,
  removeCartItem,
  clearCart
};

