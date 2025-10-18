// backend/src/modules/ai/ai_history.js
const express = require('express');
const router = express.Router();
const { db, admin } = require('../../config/firebase');

// lấy lịch sử hội thoại của user
router.get('/history', async (req, res) => {
  try {
    const userId = req.user?.uid || null; // nếu có auth middleware
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const snap = await db.collection('chat_logs')
      .where('userId', '==', userId)
      .orderBy('ts', 'desc')
      .limit(20)
      .get();

    const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ logs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server khi tải lịch sử chat' });
  }
});

module.exports = router;
