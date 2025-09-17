const admin = require('../config/firebase');

module.exports = async function requireAuth(req, res, next) {
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
};
