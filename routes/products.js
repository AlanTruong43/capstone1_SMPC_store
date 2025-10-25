const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// CREATE - Tạo sản phẩm mới
router.post('/', productController.createProduct);

// READ - Lấy tất cả sản phẩm của seller
router.get('/seller/:sellerId', productController.getProductsBySeller);

// READ - Lấy chi tiết 1 sản phẩm
router.get('/:productId', productController.getProductById);

// UPDATE - Cập nhật sản phẩm
router.put('/:productId', productController.updateProduct);

// DELETE - Xóa sản phẩm
router.delete('/:productId', productController.deleteProduct);

// BONUS: Đánh dấu sản phẩm là "sold"
router.patch('/:productId/mark-sold', productController.markAsSold);

// BONUS: Đặt sản phẩm làm featured
router.patch('/:productId/toggle-feature', productController.toggleFeature);

// BONUS: Lấy sản phẩm theo category
router.get('/category/:categoryId', productController.getProductsByCategory);

// BONUS: Lấy sản phẩm featured
router.get('/featured', productController.getFeaturedProducts);

module.exports = router;