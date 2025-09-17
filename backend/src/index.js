require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');           // ✅ thêm path

require('./config/firebase');           // init Firebase Admin

const app = express();
app.use(cors());
app.use(express.json());

// ✅ trỏ đúng tới thư mục frontend (src -> .. -> .. -> frontend)
const FRONTEND_DIR = path.resolve(__dirname, '../../frontend');

// ✅ phục vụ file tĩnh (css/js/img) trong frontend/
app.use(express.static(FRONTEND_DIR));

// ✅ route gốc: trả về login_page.html
app.get('/', (_req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'register_page.html'));
});

// ✅ route /register: trả về register_page.html
app.get('/login', (_req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'login_page.html'));
});

// (tuỳ chọn) route health
app.get('/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// routes auth
const authRouter = require('./modules/auth/auth_routes');
app.use('/auth', authRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, async () => {
  console.log(`API listening on http://localhost:${PORT}`);

  try {
    const { default: open } = await import('open'); // ✅ import ESM ở runtime
    await open(`http://localhost:${PORT}/`);
  } catch (e) {
    console.warn('Auto-open browser failed:', e.message);
  }
});
