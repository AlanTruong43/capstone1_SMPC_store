const router = require('express').Router();
const { 
  create_user, 
  verify_id_token, 
  sign_in_with_password,
  send_password_reset_email,
  change_password,
  verify_current_password
} = require('./auth_service');
const { requireAuth } = require('../../middlewares/auth_middleware');
const { rateLimitPasswordReset } = require('../../middlewares/rate_limit_middleware');

// Đăng ký user (demo tạo từ backend)
router.post('/signup', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email & password required' });
    }
    const user = await create_user({
      email,
      password,
      display_name: displayName || ''
    });

    res.status(201).json({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || null
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Verify idToken (login làm ở frontend; gửi token về đây)
router.post('/verify', async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ error: 'idToken required' });

  try {
    const decoded = await verify_id_token(idToken);
    res.json({ ok: true, uid: decoded.uid, email: decoded.email || null });
  } catch (e) {
    res.status(401).json({ ok: false, error: e.message });
  }
});

// Lấy thông tin user đang đăng nhập (bảo vệ bằng Bearer token)
router.get('/me', requireAuth, (req, res) => {
  res.json({ uid: req.user.uid, email: req.user.email || null });
});

// 🔹 Login để test: nhận email/password → trả về idToken
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email & password required' });
    }
    const result = await sign_in_with_password({ email, password });
    res.json(result); // { idToken, refreshToken, expiresIn, uid, email }
  } catch (e) {
    // Firebase REST sẽ trả lỗi ví dụ: INVALID_PASSWORD / EMAIL_NOT_FOUND...
    res.status(401).json({ error: e.response?.data?.error?.message || e.message });
  }
});

// POST /auth/forgot-password -> Send password reset email (public, rate limited)
router.post('/forgot-password', rateLimitPasswordReset(2, 3600000), async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    await send_password_reset_email(email);
    res.json({ 
      success: true, 
      message: 'Password reset email sent. Please check your inbox.' 
    });
  } catch (e) {
    // Don't reveal if email exists or not (security best practice)
    res.status(200).json({ 
      success: true, 
      message: 'If an account exists, a password reset email has been sent.' 
    });
  }
});

// POST /auth/change-password -> Change password (requires auth)
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const uid = req.user.uid;
    const email = req.user.email;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    // Verify current password
    const passwordCheck = await verify_current_password(email, currentPassword);
    if (!passwordCheck.valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Change password
    await change_password(uid, newPassword);
    res.json({ 
      success: true, 
      message: 'Password changed successfully' 
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
