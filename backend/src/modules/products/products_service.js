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

// ============================================
// ADMIN FUNCTIONS - Product Management
// ============================================

/**
 * Admin function to get all products with pagination and filters
 * No sellerId restriction - admin can see all products
 */
async function getAllProductsAdmin(filters = {}) {
  const { page = 1, limit = 50, search, category, status } = filters;
  
  let query = productCol;
  
  // Apply filters
  if (category) {
    query = query.where("categoryId", "==", category);
  }
  
  if (status) {
    query = query.where("status", "==", status);
  }
  
  const snapshot = await query.get();
  let products = snapshot.docs.map(doc => {
    const data = doc.data();
    // Serialize timestamps
    if (data?.postDate?.toDate) data.postDate = data.postDate.toDate().toISOString();
    if (data?.createdAt?.toDate) data.createdAt = data.createdAt.toDate().toISOString();
    if (data?.updatedAt?.toDate) data.updatedAt = data.updatedAt.toDate().toISOString();
    return { id: doc.id, ...data };
  });
  
  // Client-side search (Firestore doesn't support full-text search)
  if (search) {
    const searchLower = search.toLowerCase();
    products = products.filter(p => 
      p.name?.toLowerCase().includes(searchLower) ||
      p.description?.toLowerCase().includes(searchLower)
    );
  }
  
  // Sort by creation date (newest first)
  products.sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
    const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
    return dateB - dateA;
  });
  
  // Pagination
  const total = products.length;
  const startIndex = (page - 1) * limit;
  const paginatedProducts = products.slice(startIndex, startIndex + parseInt(limit));
  
  // Fetch seller and category info for each product
  const enrichedProducts = await Promise.all(
    paginatedProducts.map(async (product) => {
      // Get seller info
      if (product.sellerId) {
        try {
          const userRecord = await admin.auth().getUser(product.sellerId);
          product.sellerName = userRecord.displayName || userRecord.email;
          product.sellerEmail = userRecord.email;
        } catch (e) {
          product.sellerName = "Unknown";
          product.sellerEmail = "N/A";
        }
      }
      
      // Get category info
      if (product.categoryId) {
        try {
          const catSnap = await categoryCol.doc(product.categoryId).get();
          if (catSnap.exists) {
            const cat = catSnap.data();
            product.categoryName = cat.name;
            product.categorySlug = cat.slug;
          }
        } catch (e) {
          product.categoryName = "Unknown";
        }
      }
      
      return product;
    })
  );
  
  return {
    products: enrichedProducts,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Admin create product - requires sellerId in payload
 */
async function createProductAdmin(payload) {
  if (!payload.sellerId) {
    throw new Error("sellerId is required for admin product creation");
  }
  
  const categoryId = await resolveCategoryId(payload);

  const newDoc = {
    name: payload.name,
    description: payload.description,
    price: payload.price,
    quantity: payload.quantity,
    imageUrl: payload.imageUrl,
    location: payload.location,
    condition: payload.condition,
    status: payload.status || "available",
    categoryId,
    sellerId: payload.sellerId,
    postDate: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const ref = await productCol.add(newDoc);
  return { id: ref.id, ...newDoc };
}

/**
 * Admin update product - no sellerId check
 */
async function updateProductAdmin(productId, updates) {
  const ref = productCol.doc(productId);
  const doc = await ref.get();
  if (!doc.exists) throw new Error("Product not found");

  const data = {};
  // Allow updating basic fields
  ["name","description","price","quantity","imageUrl","location","condition","status"].forEach(k=>{
    if (updates[k] !== undefined) data[k] = updates[k];
  });

  // Allow changing category by slug or id
  if (updates.categorySlug || updates.categoryId) {
    data.categoryId = await resolveCategoryId(updates);
  }

  data.updatedAt = admin.firestore.FieldValue.serverTimestamp();
  await ref.update(data);
  
  const updatedDoc = await ref.get();
  return serializeDoc(updatedDoc);
}

/**
 * Admin delete product - no sellerId check
 */
async function deleteProductAdmin(productId) {
  const ref = productCol.doc(productId);
  const doc = await ref.get();
  if (!doc.exists) throw new Error("Product not found");
  
  await ref.delete();
  return { success: true, message: "Product deleted successfully" };
}


module.exports = {
  createProduct,
  getAllProducts,
  getUserProducts,
  updateProduct,
  deleteProduct,
  getProductById,
  // Admin functions
  getAllProductsAdmin,
  createProductAdmin,
  updateProductAdmin,
  deleteProductAdmin,
};
