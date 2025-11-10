const { admin } = require('../../config/firebase');
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

// Send password reset email via Firebase REST API
async function send_password_reset_email(email) {
  const key = process.env.FIREBASE_WEB_API_KEY;
  if (!key) throw new Error('Missing FIREBASE_WEB_API_KEY in .env');

  try {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${key}`;
    const { data } = await axios.post(url, {
      requestType: 'PASSWORD_RESET',
      email: email
    });

    return { success: true, email: data.email };
  } catch (error) {
    const errorMessage = error.response?.data?.error?.message || error.message;
    throw new Error(`Failed to send password reset email: ${errorMessage}`);
  }
}

// Change user password (requires current password verification)
async function change_password(uid, newPassword) {
  try {
    await admin.auth().updateUser(uid, {
      password: newPassword
    });
    return { success: true };
  } catch (error) {
    throw new Error(`Failed to change password: ${error.message}`);
  }
}

// Verify current password by attempting sign-in
async function verify_current_password(email, password) {
  try {
    await sign_in_with_password({ email, password });
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

module.exports = { 
  create_user, 
  verify_id_token, 
  sign_in_with_password,
  send_password_reset_email,
  change_password,
  verify_current_password
};
