// backend/src/modules/metadata/metadata_routes.js
const express = require("express");
const admin = require("../../config/firebase"); // đã export admin từ firebase.js
const router = express.Router();

// GET categories từ Firestore
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

module.exports = router;
