const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Khởi động Firebase trước
try {
  require('./config/firebase');
  console.log('✅ Firebase đã được khởi động');
} catch (error) {
  console.error('❌ Lỗi khởi động Firebase:', error.message);
  process.exit(1);
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import routes với error handling
let categoryRoutes;
try {
  categoryRoutes = require('./modules/categories/category_routes');
  console.log('✅ Category routes đã load thành công');
} catch (error) {
  console.error('❌ Lỗi loading category routes:', error.message);
  process.exit(1);
}

// Mount routes
app.use('/api/categories', categoryRoutes);

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'SmartShop API đang chạy!',
    timestamp: new Date().toISOString(),
    endpoints: {
      categories: '/api/categories',
      health: '/'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Endpoint không tồn tại' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err);
  res.status(500).json({ 
    message: 'Lỗi server',
    error: err.message 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Server đang chạy tại http://localhost:${PORT}`);
  console.log(`📝 API Categories: http://localhost:${PORT}/api/categories`);
  console.log(`❤️  Health Check: http://localhost:${PORT}/\n`);
});

module.exports = app;