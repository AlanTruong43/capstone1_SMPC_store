const { admin } = require('../config/firebase');

// Middleware: Verify user is authenticated
async function requireAuth(req, res, next) {
  try {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : '';

    if (!token) {
      return res.status(401).json({ error: 'Missing Bearer token' });
    }

    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded; // { uid, email, ... }
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid token', detail: e.message });
  }
}

// Middleware: Verify user is admin (has admin custom claim)
async function requireAdmin(req, res, next) {
  try {
    // req.user should already be set by requireAuth middleware
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if user has admin claim
    if (req.user.admin !== true) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (e) {
    res.status(403).json({ error: 'Admin verification failed', detail: e.message });
  }
}

module.exports = { requireAuth, requireAdmin };
