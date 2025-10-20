//viết logic CRUD, kết nối Firestore.
// CommonJS
const { admin, db } = require('../../config/firebase');
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


//hàm này giúp chuyển từ 1 document trong firestore thành 1 object để dễ dàng trả về cho frontend sau này
function serializeDoc(doc) {
  const data = doc.data();
  // normalize Firestore Timestamp -> ISO string for frontend
  if (data?.postDate?.toDate) data.postDate = data.postDate.toDate().toISOString();
  return { id: doc.id, ...data };
}

//hàm này giúp lấy 1 sản phẩm theo id
async function getProductById(id) {
  const snap = await db.collection('products').doc(id).get();
  if (!snap.exists) {
    const err = new Error('Product not found');
    err.status = 404;
    throw err;
  }

  const product = serializeDoc(snap);

  // Lấy thêm thông tin category
  if (product.categoryId) {
    const catSnap = await db.collection('categories').doc(product.categoryId).get();
    if (catSnap.exists) {
      const cat = catSnap.data();
      product.category = {
        id: catSnap.id,
        name: cat.name,
        description: cat.description,
        slug: cat.slug || null
      };
    }
  }

  return product;
}

async function searchProducts(params) {
  let query = productCol;

  if (params.category) {
    const snap = await categoryCol.where("slug", "==", params.category).limit(1).get();
    if (!snap.empty) {
      const categoryId = snap.docs[0].id;
      query = query.where("categoryId", "==", categoryId);
    }
  }

  if (params.minPrice) query = query.where("price", ">=", Number(params.minPrice));
  if (params.maxPrice) query = query.where("price", "<=", Number(params.maxPrice));
  if (params.condition) query = query.where("condition", "==", params.condition);
  if (params.status) query = query.where("status", "==", params.status);

  const snapshot = await query.get();
  let results = snapshot.docs.map(serializeDoc);

  // Lọc client-side theo tên
  if (params.q) {
    const qLower = params.q.toLowerCase();
    results = results.filter(p => p.name.toLowerCase().includes(qLower));
  }

  return results;
}


// Gợi ý sản phẩm trong cùng category
async function recommendProducts(categorySlug, excludeId) {
  const snap = await categoryCol.where("slug", "==", categorySlug).limit(1).get();
  if (snap.empty) throw new Error("Category not found");

  const categoryId = snap.docs[0].id;
  const qs = await productCol
    .where("categoryId", "==", categoryId)
    .where("status", "==", "available")
    .limit(10)
    .get();

  return qs.docs
    .filter(d => d.id !== excludeId)
    .map(serializeDoc);
}

// Sản phẩm mới đăng
async function getLatestProducts(limit = 10) {
  const qs = await productCol
    .where("status", "==", "available")
    .orderBy("postDate", "desc")
    .limit(limit)
    .get();
  return qs.docs.map(serializeDoc);
}

// Đánh dấu sản phẩm đã bán
async function markProductAsSold(uid, productId) {
  const ref = productCol.doc(productId);
  const doc = await ref.get();
  if (!doc.exists) throw new Error("Product not found");
  if (doc.data().sellerId !== uid) throw new Error("Permission denied");

  await ref.update({
    status: "sold",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { id: productId, status: "sold" };
}

// Thống kê sản phẩm của người dùng
async function getUserProductStats(uid) {
  const qs = await productCol.where("sellerId", "==", uid).get();
  const products = qs.docs.map(doc => doc.data());

  const total = products.length;
  const sold = products.filter(p => p.status === "sold").length;
  const available = products.filter(p => p.status === "available").length;

  const totalRevenue = products
    .filter(p => p.status === "sold")
    .reduce((sum, p) => sum + (p.price * (p.quantity || 1)), 0);

  return { total, sold, available, totalRevenue };
}

module.exports = {
  createProduct,
  getAllProducts,
  getUserProducts,
  updateProduct,
  deleteProduct,
  getProductById,

  searchProducts,
  recommendProducts,
  getLatestProducts,
  markProductAsSold,
  getUserProductStats,
};
