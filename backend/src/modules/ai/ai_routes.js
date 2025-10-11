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

    // 🔹 Dựng phần trả lời thân thiện (linh hoạt hơn với min/max/keywords)
    const reply = [];
    const it = result.intent || {};
    if (it.categorySlug) {
      reply.push(`Bạn đang tìm ${String(it.categorySlug).replace('-', ' ')}.`);
    }
    if (it.condition) {
      reply.push(`Loại hàng ${it.condition === 'new' ? 'mới' : 'đã qua sử dụng'}.`);
    }
    if (it.minPrice && it.maxPrice) {
      reply.push(`Giá từ ${it.minPrice.toLocaleString('vi-VN')} đến ${it.maxPrice.toLocaleString('vi-VN')} VND.`);
    } else if (it.maxPrice) {
      reply.push(`Giá dưới ${it.maxPrice.toLocaleString('vi-VN')} VND.`);
    } else if (it.minPrice) {
      reply.push(`Giá từ ${it.minPrice.toLocaleString('vi-VN')} VND.`);
    }
    if (Array.isArray(it.keywords) && it.keywords.length) {
      const kws = it.keywords.slice(0, 5).join(', ');
      reply.push(`Từ khóa: ${kws}.`);
    }

    const summary = reply.length
      ? `OK, tôi đã tìm được một số sản phẩm phù hợp:\n${reply.join(' ')}`
      : `Đây là những sản phẩm bạn có thể quan tâm.`;

    res.json({
      reply: summary,
      items: result.products,
      debugIntent: result.intent,
      debugCount: {
        total: result.__debugTotal || null,
        afterFilters: Array.isArray(result.products) ? result.products.length : null
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
