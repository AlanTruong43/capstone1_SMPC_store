const router = require('express').Router();
const { create_user, verify_id_token, sign_in_with_password } = require('./auth_service');
const requireAuth = require('../../middlewares/auth_middleware');

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

module.exports = router;
