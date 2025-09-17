const admin = require('firebase-admin');
const path = require('path');

// Cách B: dùng file JSON trong backend/ (đơn giản cho dev)
// => đảm bảo backend/.gitignore có 'serviceAccountKey.json'
const serviceAccount = require(path.join(__dirname, '../../serviceAccountKey.json'));

/* 
// Nếu muốn chuyển sang Cách A (ENV), thay block trên bằng:
// const admin = require('firebase-admin');
// if (!admin.apps.length) {
//   admin.initializeApp({
//     credential: admin.credential.cert({
//       projectId: process.env.FIREBASE_PROJECT_ID,
//       clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
//       privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
//     }),
//   });
//   module.exports = admin;
//   return;
// }
*/

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

module.exports = admin;
