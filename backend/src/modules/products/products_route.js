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

router.get("/search", async (req, res) => {
  try {
    const results = await svc.searchProducts(req.query);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// RECOMMEND
router.get("/recommend", async (req, res) => {
  try {
    const { category, exclude } = req.query;
    const results = await svc.recommendProducts(category, exclude);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// LATEST
router.get("/latest", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || "10");
    const results = await svc.getLatestProducts(limit);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// MARK AS SOLD
router.put("/:id/mark-sold", requireAuth, async (req, res) => {
  try {
    const result = await svc.markProductAsSold(req.user.uid, req.params.id);
    res.json(result);
  } catch (err) {
    res.status(403).json({ error: err.message });
  }
});

// USER PRODUCT STATS
router.get("/my/stats", requireAuth, async (req, res) => {
  try {
    const stats = await svc.getUserProductStats(req.user.uid);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

// ============================================
// ADMIN ROUTES - Product Management
// ============================================
// NOTE: Admin routes must come BEFORE /:id route to avoid conflicts

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

// ============================================
// CUSTOMER ROUTES - Product Management
// ============================================
// NOTE: Customer routes must come BEFORE /:id route to avoid conflicts

// POST /products/customer - Customer create product
router.post("/customer", requireAuth, async (req, res) => {
  try {
    const { valid, errors, data } = validateAndNormalizeProduct(req.body);
    if (!valid) return res.status(400).json({ errors });
    const created = await createProduct(req.user.uid, data);
    res.status(201).json(created);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// GET /products/customer - Get current user's products
router.get("/customer", requireAuth, async (req, res) => {
  try {
    const list = await svc.getUserProducts(req.user.uid);
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /products/customer/:id/can-edit - Check if product can be edited (must be before /customer/:id)
router.get("/customer/:id/can-edit", requireAuth, async (req, res) => {
  try {
    // First verify ownership
    await svc.getCustomerProductById(req.user.uid, req.params.id);
    // Then check edit status
    const result = await svc.canEditProduct(req.params.id);
    res.json(result);
  } catch (e) {
    const status = e.message === "Permission denied" ? 403 : 404;
    res.status(status).json({ error: e.message });
  }
});

// GET /products/customer/:id - Get single product (ownership check)
router.get("/customer/:id", requireAuth, async (req, res) => {
  try {
    const product = await svc.getCustomerProductById(req.user.uid, req.params.id);
    res.json(product);
  } catch (e) {
    const status = e.message === "Permission denied" ? 403 : 404;
    res.status(status).json({ error: e.message });
  }
});

// PUT /products/customer/:id - Update product (with order status check)
router.put("/customer/:id", requireAuth, async (req, res) => {
  try {
    const { valid, errors, data } = validateAndNormalizeProduct(req.body);
    if (!valid) return res.status(400).json({ errors });
    
    const updated = await svc.updateProductCustomer(req.user.uid, req.params.id, data);
    res.json(updated);
  } catch (e) {
    const status = e.message === "Permission denied" ? 403 : 400;
    res.status(status).json({ error: e.message });
  }
});

// DELETE /products/customer/:id - Delete product (ownership check)
router.delete("/customer/:id", requireAuth, async (req, res) => {
  try {
    const result = await svc.deleteProduct(req.user.uid, req.params.id);
    res.json(result);
  } catch (e) {
    const status = e.message === "Permission denied" ? 403 : 400;
    res.status(status).json({ error: e.message });
  }
});

// ============================================
// GENERIC ROUTES - Must be LAST
// ============================================
// NOTE: These dynamic routes (:id) must come AFTER all specific routes

// PUT /products/:id - Update product (legacy)
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const updated = await updateProduct(req.user.uid, req.params.id, req.body);
    res.json(updated);
  } catch (e) {
    res.status(403).json({ error: e.message });
  }
});

// DELETE /products/:id - Delete product (legacy)
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const result = await deleteProduct(req.user.uid, req.params.id);
    res.json(result);
  } catch (e) {
    res.status(403).json({ error: e.message });
  }
});

// GET /products/:id - Get product detail (public)
router.get('/:id', async (req, res, next) => {
  try {
    const product = await svc.getProductById(req.params.id);
    res.json(product);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
