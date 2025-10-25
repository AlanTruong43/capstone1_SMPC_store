const { db, admin } = require('../config/firebase');

// Collection name trong Firestore
const COLLECTION_NAME = 'products';

// CREATE - Tạo sản phẩm mới
exports.createProduct = async (req, res) => {
  try {
    const { 
      sellerId, 
      name, 
      description, 
      price, 
      categoryId, 
      status, 
      condition, 
      location 
    } = req.body;

    // Validate dữ liệu bắt buộc
    if (!sellerId || !name || !price || !categoryId) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin bắt buộc: sellerId, name, price, categoryId'
      });
    }

    // Validate status
    const validStatuses = ['available', 'sold'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status phải là "available" hoặc "sold"'
      });
    }

    // Validate condition
    const validConditions = ['new', 'used'];
    if (condition && !validConditions.includes(condition)) {
      return res.status(400).json({
        success: false,
        message: 'Condition phải là "new" hoặc "used"'
      });
    }

    // Dữ liệu sản phẩm theo schema
    const productData = {
      sellerId,
      name,
      description: description || '',
      price: parseFloat(price),
      categoryId,
      status: status || 'available',
      condition: condition || 'new',
      location: location || '',
      viewCount: 0,
      isFeature: false,
      postDate: admin.firestore.FieldValue.serverTimestamp()
    };

    // Thêm document vào Firestore
    const docRef = await db.collection(COLLECTION_NAME).add(productData);

    res.status(201).json({
      success: true,
      message: 'Tạo sản phẩm thành công',
      data: {
        id: docRef.id,
        ...productData
      }
    });

  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo sản phẩm',
      error: error.message
    });
  }
};

// READ - Lấy tất cả sản phẩm của seller
exports.getProductsBySeller = async (req, res) => {
  try {
    const { sellerId } = req.params;

    if (!sellerId) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu sellerId'
      });
    }

    // Query products theo sellerId
    const snapshot = await db.collection(COLLECTION_NAME)
      .where('sellerId', '==', sellerId)
      .orderBy('postDate', 'desc')
      .get();

    if (snapshot.empty) {
      return res.status(200).json({
        success: true,
        message: 'Không tìm thấy sản phẩm',
        data: []
      });
    }

    // Chuyển đổi snapshot thành array
    const products = [];
    snapshot.forEach(doc => {
      products.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });

  } catch (error) {
    console.error('Error getting products:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách sản phẩm',
      error: error.message
    });
  }
};

// READ - Lấy chi tiết 1 sản phẩm và tăng viewCount
exports.getProductById = async (req, res) => {
  try {
    const { productId } = req.params;
    const docRef = db.collection(COLLECTION_NAME).doc(productId);

    // Lấy document
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sản phẩm'
      });
    }

    // Tăng viewCount
    await docRef.update({
      viewCount: admin.firestore.FieldValue.increment(1)
    });

    // Lấy data sau khi update
    const updatedDoc = await docRef.get();

    res.status(200).json({
      success: true,
      data: {
        id: updatedDoc.id,
        ...updatedDoc.data()
      }
    });

  } catch (error) {
    console.error('Error getting product:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy thông tin sản phẩm',
      error: error.message
    });
  }
};

// UPDATE - Cập nhật sản phẩm
exports.updateProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const updateData = req.body;

    // Kiểm tra sản phẩm có tồn tại không
    const docRef = db.collection(COLLECTION_NAME).doc(productId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sản phẩm'
      });
    }

    // Xóa các field không được phép update
    delete updateData.sellerId;      // Không cho đổi seller
    delete updateData.postDate;      // Không cho đổi ngày đăng
    delete updateData.viewCount;     // Không cho đổi view count thủ công

    // Validate status nếu có
    if (updateData.status) {
      const validStatuses = ['available', 'sold'];
      if (!validStatuses.includes(updateData.status)) {
        return res.status(400).json({
          success: false,
          message: 'Status phải là "available" hoặc "sold"'
        });
      }
    }

    // Validate condition nếu có
    if (updateData.condition) {
      const validConditions = ['new', 'used'];
      if (!validConditions.includes(updateData.condition)) {
        return res.status(400).json({
          success: false,
          message: 'Condition phải là "new" hoặc "used"'
        });
      }
    }

    // Update document
    await docRef.update(updateData);

    // Lấy data mới sau khi update
    const updatedDoc = await docRef.get();

    res.status(200).json({
      success: true,
      message: 'Cập nhật sản phẩm thành công',
      data: {
        id: updatedDoc.id,
        ...updatedDoc.data()
      }
    });

  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật sản phẩm',
      error: error.message
    });
  }
};

// DELETE - Xóa sản phẩm
exports.deleteProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    const docRef = db.collection(COLLECTION_NAME).doc(productId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sản phẩm'
      });
    }

    // Xóa document
    await docRef.delete();

    res.status(200).json({
      success: true,
      message: 'Xóa sản phẩm thành công',
      data: {
        id: productId
      }
    });

  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi xóa sản phẩm',
      error: error.message
    });
  }
};

// BONUS: Đánh dấu sản phẩm là "sold"
exports.markAsSold = async (req, res) => {
  try {
    const { productId } = req.params;

    const docRef = db.collection(COLLECTION_NAME).doc(productId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sản phẩm'
      });
    }

    await docRef.update({
      status: 'sold'
    });

    res.status(200).json({
      success: true,
      message: 'Đã đánh dấu sản phẩm là "sold"'
    });

  } catch (error) {
    console.error('Error marking as sold:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật trạng thái',
      error: error.message
    });
  }
};

// BONUS: Đặt sản phẩm làm featured
exports.toggleFeature = async (req, res) => {
  try {
    const { productId } = req.params;
    const { isFeature } = req.body;

    const docRef = db.collection(COLLECTION_NAME).doc(productId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sản phẩm'
      });
    }

    await docRef.update({
      isFeature: !!isFeature
    });

    res.status(200).json({
      success: true,
      message: `Sản phẩm ${isFeature ? 'đã được' : 'không còn'} featured`
    });

  } catch (error) {
    console.error('Error toggling feature:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật featured',
      error: error.message
    });
  }
};

// BONUS: Lấy sản phẩm theo category
exports.getProductsByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;

    const snapshot = await db.collection(COLLECTION_NAME)
      .where('categoryId', '==', categoryId)
      .where('status', '==', 'available')
      .orderBy('postDate', 'desc')
      .get();

    if (snapshot.empty) {
      return res.status(200).json({
        success: true,
        message: 'Không tìm thấy sản phẩm trong danh mục này',
        data: []
      });
    }

    const products = [];
    snapshot.forEach(doc => {
      products.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });

  } catch (error) {
    console.error('Error getting products by category:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy sản phẩm theo danh mục',
      error: error.message
    });
  }
};

// BONUS: Lấy sản phẩm featured
exports.getFeaturedProducts = async (req, res) => {
  try {
    const snapshot = await db.collection(COLLECTION_NAME)
      .where('isFeature', '==', true)
      .where('status', '==', 'available')
      .orderBy('viewCount', 'desc')
      .limit(10)
      .get();

    if (snapshot.empty) {
      return res.status(200).json({
        success: true,
        message: 'Không có sản phẩm featured',
        data: []
      });
    }

    const products = [];
    snapshot.forEach(doc => {
      products.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });

  } catch (error) {
    console.error('Error getting featured products:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy sản phẩm featured',
      error: error.message
    });
  }
};