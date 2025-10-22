//định nghĩa API endpoints.
// file này dùng để khai báo REST API cũng như là làm cầu nối giữa validate và service.
const express = require("express");
const { validateAndNormalizeProduct } = require("./products_validator.js");
const { createProduct, getAllProducts, getUserProducts, updateProduct, deleteProduct } =
  require("./products_service.js");
const { requireAuth, requireAdmin } = require("../../middlewares/auth_middleware.js");
const svc = require('./products_service');
const { validate, validateProductIdParam } = require('./products_validator'); 
const router = express.Router();

router.post("/", requireAuth, async (req, res) => {
  try {
    const { valid, errors, data } = validateAndNormalizeProduct(req.body);
    if (!valid) return res.status(400).json({ errors });
    const created = await createProduct(req.user.uid, data);
    res.status(201).json(created);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get("/", async (_req, res) => {
  try {
    const list = await getAllProducts();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/my", requireAuth, async (req, res) => {
  try {
    const list = await getUserProducts(req.user.uid);
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/:id", requireAuth, async (req, res) => {
  try {
    const updated = await updateProduct(req.user.uid, req.params.id, req.body);
    res.json(updated);
  } catch (e) {
    res.status(403).json({ error: e.message });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const result = await deleteProduct(req.user.uid, req.params.id);
    res.json(result);
  } catch (e) {
    res.status(403).json({ error: e.message });
  }
});

// GET /products/:id  -> product detail
router.get('/:id', async (req, res, next) => {
  try {
    const product = await svc.getProductById(req.params.id);
    res.json(product);
  } catch (err) {
    next(err);
  }
});

// ============================================
// ADMIN ROUTES - Product Management
// ============================================

// GET /products/admin/all - Get all products with filters (admin only)
router.get("/admin/all", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { page, limit, search, category, status } = req.query;
    const result = await svc.getAllProductsAdmin({ page, limit, search, category, status });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /products/admin - Admin create product
router.post("/admin", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { valid, errors, data } = validateAndNormalizeProduct(req.body);
    if (!valid) return res.status(400).json({ errors });
    
    // Automatically use the authenticated admin's UID as sellerId
    data.sellerId = req.user.uid;
    
    const created = await svc.createProductAdmin(data);
    res.status(201).json(created);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// PUT /products/admin/:id - Admin update any product
router.put("/admin/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const updated = await svc.updateProductAdmin(req.params.id, req.body);
    res.json(updated);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// DELETE /products/admin/:id - Admin delete any product
router.delete("/admin/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await svc.deleteProductAdmin(req.params.id);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
