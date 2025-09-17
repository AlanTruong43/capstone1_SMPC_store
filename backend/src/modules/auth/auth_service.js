const admin = require('../../config/firebase');
const axios = require('axios');

async function create_user({ email, password, display_name }) {
  return admin.auth().createUser({ email, password, displayName: display_name });
}

async function verify_id_token(id_token) {
  return admin.auth().verifyIdToken(id_token);
}

// 🔹 Đăng nhập qua REST Auth để nhận idToken (dùng cho Postman/test)
async function sign_in_with_password({ email, password }) {
  const key = process.env.FIREBASE_WEB_API_KEY;
  if (!key) throw new Error('Missing FIREBASE_WEB_API_KEY in .env');

  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${key}`;
  const { data } = await axios.post(url, {
    email,
    password,
    returnSecureToken: true
  });

  // data: { idToken, refreshToken, expiresIn, localId, email, ... }
  return {
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    expiresIn: data.expiresIn,
    uid: data.localId,
    email: data.email,
  };
}

module.exports = { create_user, verify_id_token, sign_in_with_password };
