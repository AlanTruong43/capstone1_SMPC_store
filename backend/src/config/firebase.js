const admin = require('firebase-admin');
const path = require('path');


// Cách B: dùng file JSON trong backend/ (đơn giản cho dev)
// => đảm bảo backend/.gitignore có 'serviceAccountKey.json'
const serviceAccount = require(path.join(__dirname, '../../serviceAccountKey.json'));


if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

module.exports = { admin, db };
