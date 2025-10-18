// File test Firebase - chạy riêng để kiểm tra
console.log('🔍 Testing Firebase connection...\n');

try {
  const { db, rtdb } = require('./config/firebase');
  
  console.log('✅ Firebase modules loaded successfully!');
  console.log('✅ Firestore instance:', db ? 'OK' : 'FAIL');
  console.log('✅ Realtime DB instance:', rtdb ? 'OK' : 'FAIL');
  
  console.log('\n🎉 Firebase is ready to use!');
  process.exit(0);
  
} catch (error) {
  console.error('❌ Firebase test failed!');
  console.error('Error:', error.message);
  console.error('\nStack:', error.stack);
  process.exit(1);
}