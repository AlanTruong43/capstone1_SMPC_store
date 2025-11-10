/**
 * Rate Limiting Middleware
 * Simple in-memory rate limiter for password reset requests
 * Max 2 requests per hour per email
 */

const rateLimitStore = new Map();

// Clean up old entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (now - data.firstRequest > 3600000) { // 1 hour
      rateLimitStore.delete(key);
    }
  }
}, 600000); // 10 minutes

function rateLimitPasswordReset(maxRequests = 2, windowMs = 3600000) {
  return (req, res, next) => {
    const email = req.body?.email?.toLowerCase();
    
    if (!email) {
      return next(); // Let validation handle missing email
    }

    const now = Date.now();
    const key = `password_reset:${email}`;
    const record = rateLimitStore.get(key);

    if (!record) {
      // First request
      rateLimitStore.set(key, {
        count: 1,
        firstRequest: now,
        lastRequest: now
      });
      return next();
    }

    // Check if window has expired
    if (now - record.firstRequest > windowMs) {
      // Reset counter
      rateLimitStore.set(key, {
        count: 1,
        firstRequest: now,
        lastRequest: now
      });
      return next();
    }

    // Check if limit exceeded
    if (record.count >= maxRequests) {
      const remainingTime = Math.ceil((windowMs - (now - record.firstRequest)) / 1000 / 60);
      return res.status(429).json({
        error: 'Too many password reset requests',
        message: `Please wait ${remainingTime} minute(s) before requesting another password reset`,
        retryAfter: remainingTime
      });
    }

    // Increment counter
    record.count++;
    record.lastRequest = now;
    rateLimitStore.set(key, record);
    
    next();
  };
}

module.exports = { rateLimitPasswordReset };

