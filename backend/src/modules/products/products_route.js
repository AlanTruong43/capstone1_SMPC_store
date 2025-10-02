//định nghĩa API endpoints.
// file này dùng để khai báo REST API cũng như là làm cầu nối giữa validate và service.
const express = require("express");
const { validateAndNormalizeProduct } = require("./products_validator.js");
const { createProduct, getAllProducts, getUserProducts, updateProduct, deleteProduct } =
  require("./products_service.js");
const requireAuth = require("../../middlewares/auth_middleware.js"); // nếu export default thì đổi cho đúng

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

module.exports = router;
