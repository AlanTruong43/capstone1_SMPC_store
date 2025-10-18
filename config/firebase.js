const admin = require('firebase-admin');
const path = require('path');

try {
  // Đọc service account key
  const serviceAccount = require('./serviceAccountKey.json');

  // Kiểm tra xem Firebase đã được khởi tạo chưa
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: 'https://smartshopai-45959-default-rtdb.asia-southeast1.firebasedatabase.app'
    });
    console.log('✅ Firebase initialized successfully!');
  } else {
    console.log('ℹ️  Firebase already initialized');
  }

  const db = admin.firestore();
  const rtdb = admin.database();

  module.exports = { db, rtdb, admin };

} catch (error) {
  console.error('❌ Firebase initialization failed:');
  console.error('Error:', error.message);
  
  if (error.code === 'MODULE_NOT_FOUND') {
    console.error('\n💡 Giải pháp:');
    console.error('1. Đảm bảo file serviceAccountKey.json tồn tại');
    console.error('2. Kiểm tra đường dẫn file');
    console.error('3. Chạy: npm install firebase-admin');
  }
  
  throw error;
}