//viết logic CRUD, kết nối Firestore.
// CommonJS
const admin = require("../../config/firebase.js");
const db = admin.firestore();
const productCol = db.collection("products");
const categoryCol = db.collection("categories");

/** Tìm categoryId theo slug */
async function resolveCategoryId(payload) {
  if (payload.categoryId) return payload.categoryId; // fallback nếu client gửi sẵn id

  const snap = await categoryCol.where("slug", "==", payload.categorySlug).limit(1).get();
  if (snap.empty) throw new Error("Category (slug) không tồn tại");
  return snap.docs[0].id;
}

async function createProduct(uid, payload) {
  const categoryId = await resolveCategoryId(payload);

  const newDoc = {
    name: payload.name,
    description: payload.description,
    price: payload.price,
    quantity: payload.quantity,
    imageUrl: payload.imageUrl,
    location: payload.location,
    condition: payload.condition,     // "new" | "used"
    status: payload.status || "available",
    categoryId,
    sellerId: uid,
    postDate: admin.firestore.FieldValue.serverTimestamp(), // đặt đúng field theo schema của bạn
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const ref = await productCol.add(newDoc);
  return { id: ref.id, ...newDoc };
}

async function getAllProducts() {
  const qs = await productCol.where("status", "==", "available").get();
  return qs.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getUserProducts(uid) {
  const qs = await productCol.where("sellerId", "==", uid).get();
  return qs.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function updateProduct(uid, productId, updates) {
  const ref = productCol.doc(productId);
  const doc = await ref.get();
  if (!doc.exists) throw new Error("Product not found");
  if (doc.data().sellerId !== uid) throw new Error("Permission denied");

  const data = {};
  // Cho phép sửa các field cơ bản
  ["name","description","price","quantity","imageUrl","location","condition","status"].forEach(k=>{
    if (updates[k] !== undefined) data[k] = updates[k];
  });

  // Cho phép đổi category bằng slug hoặc id
  if (updates.categorySlug || updates.categoryId) {
    data.categoryId = await resolveCategoryId(updates);
  }

  data.updatedAt = admin.firestore.FieldValue.serverTimestamp();
  await ref.update(data);
  return { id: productId, ...doc.data(), ...data };
}

async function deleteProduct(uid, productId) {
  const ref = productCol.doc(productId);
  const doc = await ref.get();
  if (!doc.exists) throw new Error("Product not found");
  if (doc.data().sellerId !== uid) throw new Error("Permission denied");
  await ref.delete();
  return { success: true };
}

module.exports = {
  createProduct,
  getAllProducts,
  getUserProducts,
  updateProduct,
  deleteProduct,
};
