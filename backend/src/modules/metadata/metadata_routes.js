// backend/src/modules/metadata/metadata_routes.js
const express = require("express");
const { admin, db } = require("../../config/firebase"); // đã export admin từ firebase.js
const { requireAuth, requireAdmin } = require("../../middlewares/auth_middleware");
const { validateAndNormalizeCategory } = require("./metadata_validator");
const svc = require("./metadata_service");
const router = express.Router();

// GET categories từ Firestore (public)
router.get("/categories", async (req, res) => {
  try {
    const snapshot = await admin.firestore().collection("categories").get();
    const categories = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    res.json(categories);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi khi lấy categories" });
  }
});

// GET metadata cố định (location, condition, status)
router.get("/options", (req, res) => {
  const metadata = {
    locations: ["HCMC", "Hanoi", "Danang"],
    conditions: ["new", "used"],
    statuses: ["available", "sold"]
  };
  res.json(metadata);
});

// ============================================
// ADMIN ROUTES - Category Management
// ============================================
// NOTE: Admin routes must come AFTER public routes to avoid conflicts

// GET /metadata/admin/categories - Get all categories with filters (admin only)
router.get("/admin/categories", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { page, limit, search } = req.query;
    const result = await svc.getAllCategoriesAdmin({ page, limit, search });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /metadata/admin/categories - Admin create category
router.post("/admin/categories", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { valid, errors, data } = validateAndNormalizeCategory(req.body);
    if (!valid) return res.status(400).json({ errors });
    
    const created = await svc.createCategoryAdmin(data);
    res.status(201).json(created);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// PUT /metadata/admin/categories/:id - Admin update category
router.put("/admin/categories/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    // For update, validate only provided fields
    const updateData = {};
    const errors = {};
    
    if (req.body.name !== undefined) {
      if (!req.body.name || typeof req.body.name !== 'string' || req.body.name.trim() === '') {
        errors.name = 'Category name is required';
      } else {
        updateData.name = req.body.name.trim();
      }
    }
    
    if (req.body.slug !== undefined) {
      const slug = req.body.slug.trim().toLowerCase();
      if (!slug) {
        errors.slug = 'Category slug is required';
      } else if (!/^[a-z0-9_-]+$/.test(slug)) {
        errors.slug = 'Slug must contain only lowercase letters, numbers, hyphens, and underscores';
      } else {
        updateData.slug = slug;
      }
    }
    
    if (req.body.description !== undefined) {
      if (typeof req.body.description !== 'string') {
        errors.description = 'Description must be a string';
      } else {
        updateData.description = req.body.description.trim();
      }
    }
    
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ errors });
    }
    
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    const updated = await svc.updateCategoryAdmin(req.params.id, updateData);
    res.json(updated);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// DELETE /metadata/admin/categories/:id - Admin delete category
router.delete("/admin/categories/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await svc.deleteCategoryAdmin(req.params.id);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// GET /metadata/admin/categories/:id - Get single category (admin)
router.get("/admin/categories/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const category = await svc.getCategoryById(req.params.id);
    res.json(category);
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

module.exports = router;
