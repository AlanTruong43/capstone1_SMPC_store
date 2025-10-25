/**
 * Cart Validator Module
 * Validates input data for cart operations
 */

/**
 * Validate add to cart request
 * @param {Object} body - Request body
 * @returns {Object} { valid: boolean, errors: Array, data: Object }
 */
function validateAddToCart(body) {
  const errors = [];
  const data = {};

  // Validate productId
  if (!body.productId || typeof body.productId !== 'string' || body.productId.trim() === '') {
    errors.push('productId is required and must be a non-empty string');
  } else {
    data.productId = body.productId.trim();
  }

  // Validate quantity
  const quantity = parseInt(body.quantity);
  if (isNaN(quantity)) {
    errors.push('quantity must be a valid number');
  } else if (quantity < 1) {
    errors.push('quantity must be at least 1');
  } else if (quantity > 99) {
    errors.push('quantity cannot exceed 99');
  } else {
    data.quantity = quantity;
  }

  return {
    valid: errors.length === 0,
    errors,
    data
  };
}

/**
 * Validate update quantity request
 * @param {Object} body - Request body
 * @returns {Object} { valid: boolean, errors: Array, data: Object }
 */
function validateUpdateQuantity(body) {
  const errors = [];
  const data = {};

  // Validate quantity
  const quantity = parseInt(body.quantity);
  if (isNaN(quantity)) {
    errors.push('quantity must be a valid number');
  } else if (quantity < 1) {
    errors.push('quantity must be at least 1');
  } else if (quantity > 99) {
    errors.push('quantity cannot exceed 99');
  } else {
    data.quantity = quantity;
  }

  return {
    valid: errors.length === 0,
    errors,
    data
  };
}

/**
 * Validate productId parameter
 * @param {Object} params - Request params
 * @returns {Object} { valid: boolean, errors: Array, data: Object }
 */
function validateProductIdParam(params) {
  const errors = [];
  const data = {};

  // Validate productId
  if (!params.productId || typeof params.productId !== 'string' || params.productId.trim() === '') {
    errors.push('productId parameter is required and must be a non-empty string');
  } else {
    data.productId = params.productId.trim();
  }

  return {
    valid: errors.length === 0,
    errors,
    data
  };
}

module.exports = {
  validateAddToCart,
  validateUpdateQuantity,
  validateProductIdParam
};

