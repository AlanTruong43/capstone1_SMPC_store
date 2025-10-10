const express = require('express');
const router = express.Router();
const { db } = require('../../config/firebase');

// GET /users/:id -> minimal public seller info
router.get('/:id', async (req, res) => {
  try {
    const uid = req.params.id;
    if (!uid) return res.status(400).json({ error: 'user id is required' });

    const snap = await db.collection('users').doc(uid).get();
    if (!snap.exists) return res.status(404).json({ error: 'User not found' });

    const data = snap.data() || {};
    // Only expose minimal fields for seller display
    const out = {
      id: snap.id,
      displayName: data.displayName || null,
      email: data.email || null,
      role: data.role || null,
    };
    res.json(out);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;


