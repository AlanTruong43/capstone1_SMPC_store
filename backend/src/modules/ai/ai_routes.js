// backend/src/modules/ai/ai_routes.js
const express = require('express');
const router = express.Router();
const { searchProductsByIntent } = require('./ai_service');

router.post('/query', async (req, res) => {
  try {
    const { query, limit } = req.body || {};
    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'query is required' });
    }

    const result = await searchProductsByIntent({ query, limit: Number(limit) || 8 });

    // 🔹 Dựng phần trả lời thân thiện
    const reply = [];
    if (result.intent.categorySlug)
      reply.push(`Bạn đang tìm ${result.intent.categorySlug.replace('-', ' ')}.`);
    if (result.intent.condition)
      reply.push(`Loại hàng ${result.intent.condition === 'new' ? 'mới' : 'đã qua sử dụng'}.`);
    if (result.intent.maxPrice)
      reply.push(`Giá dưới ${result.intent.maxPrice.toLocaleString('vi-VN')} VND.`);

    const summary = reply.length
      ? `OK, tôi đã tìm được một số sản phẩm phù hợp:\n${reply.join(' ')}`
      : `Đây là những sản phẩm bạn có thể quan tâm.`;

    res.json({
      reply: summary,
      items: result.products,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
