const express = require('express');
const router = express.Router();
const categoryService = require('./category_service');

// GET /api/categories/  -> list categories
router.get('/', async (req, res) => {
	try {
		const categories = await categoryService.getAll();
		res.json(categories);
	} catch (err) {
		res.status(500).json({ message: 'Lỗi khi lấy danh sách categories', error: err.message });
	}
});

// GET /api/categories/:id -> get category by id
router.get('/:id', async (req, res) => {
	try {
		const id = req.params.id;
		const category = await categoryService.getById(id);
		if (!category) return res.status(404).json({ message: 'Category không tìm thấy' });
		res.json(category);
	} catch (err) {
		res.status(500).json({ message: 'Lỗi khi lấy category', error: err.message });
	}
});

module.exports = router;
