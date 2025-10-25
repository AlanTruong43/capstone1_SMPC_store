const { admin } = require('../config/firebase');

// Middleware xác thực Firebase Auth Token
exports.verifyToken = async (req, res, next) => {
  try {
    // Lấy token từ header
    const token = req.headers.authorization?.split('Bearer ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Không tìm thấy token xác thực'
      });
    }

    // Verify token
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({
      success: false,
      message: 'Token không hợp lệ',
      error: error.message
    });
  }
};

// Middleware kiểm tra seller có quyền thao tác không
exports.checkSellerOwnership = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { uid } = req.user;

    const doc = await db.collection('products').doc(productId).get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sản phẩm'
      });
    }

    if (doc.data().sellerId !== uid) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền thao tác sản phẩm này'
      });
    }

    next();
  } catch (error) {
    console.error('Ownership check error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi kiểm tra quyền sở hữu',
      error: error.message
    });
  }
};