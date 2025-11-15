// Ratings Validator - Input validation for ratings module
const { param, body } = require('express-validator');

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim() !== "";
}

function validateAndNormalizeRating(input = {}) {
  const errors = {};
  const out = {};

  // productId
  if (!isNonEmptyString(input.productId)) {
    errors.productId = "productId is required";
  } else {
    out.productId = input.productId.trim();
  }

  // orderId (required for verification)
  if (!isNonEmptyString(input.orderId)) {
    errors.orderId = "orderId is required for verified purchase";
  } else {
    out.orderId = input.orderId.trim();
  }

  // star (rating 1-5)
  const starNum = Number(input.star);
  if (!Number.isInteger(starNum) || starNum < 1 || starNum > 5) {
    errors.star = "star must be an integer between 1 and 5";
  } else {
    out.star = starNum;
  }

  // comment (optional but recommended)
  if (input.comment !== undefined && input.comment !== null) {
    const comment = String(input.comment).trim();
    if (comment.length > 1000) {
      errors.comment = "comment must be 1000 characters or less";
    } else {
      out.comment = comment;
    }
  } else {
    out.comment = "";
  }

  if (Object.keys(errors).length) return { valid: false, errors };
  return { valid: true, data: out };
}

function validateSellerReply(input = {}) {
  const errors = {};
  const out = {};

  // comment
  if (!isNonEmptyString(input.comment)) {
    errors.comment = "comment is required";
  } else {
    const comment = input.comment.trim();
    if (comment.length > 500) {
      errors.comment = "comment must be 500 characters or less";
    } else {
      out.comment = comment;
    }
  }

  if (Object.keys(errors).length) return { valid: false, errors };
  return { valid: true, data: out };
}

function validateReport(input = {}) {
  const errors = {};
  const out = {};

  // reason
  if (!isNonEmptyString(input.reason)) {
    errors.reason = "reason is required";
  } else {
    const reason = input.reason.trim();
    if (reason.length > 200) {
      errors.reason = "reason must be 200 characters or less";
    } else {
      out.reason = reason;
    }
  }

  if (Object.keys(errors).length) return { valid: false, errors };
  return { valid: true, data: out };
}

// Express validators
const validateRatingIdParam = [
  param('ratingId').isString().trim().notEmpty().withMessage('ratingId is required'),
];

const validateProductIdParam = [
  param('productId').isString().trim().notEmpty().withMessage('productId is required'),
];

module.exports = {
  validateAndNormalizeRating,
  validateSellerReply,
  validateReport,
  validateRatingIdParam,
  validateProductIdParam
};

