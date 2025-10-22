require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');     

require('./config/firebase');           // init Firebase Admin

const app = express();
app.use(cors());
app.use(express.json());

// trỏ đúng tới thư mục frontend (src -> .. -> .. -> frontend)
const FRONTEND_DIR = path.resolve(__dirname, '../../frontend');
const IMAGES_DIR = path.resolve(__dirname, '../../img');

// phục vụ file tĩnh (css/js/img) trong frontend/
app.use(express.static(FRONTEND_DIR));
// phục vụ thư mục img gốc (ngoài frontend/)
app.use('/img', express.static(IMAGES_DIR));

//  route gốc: trả về login_page.html
app.get('/', (_req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'pages/register_page.html'));
});

// route /register: trả về register_page.html
app.get('/login', (_req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'pages/login_page.html'));
});

// (tuỳ chọn) route health
app.get('/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// routes auth
const authRouter = require('./modules/auth/auth_routes');
app.use('/auth', authRouter);

// routes products
const productRoutes = require("./modules/products/products_route.js");
app.use("/products", productRoutes);

// routes metadata
const metadataRoutes = require("./modules/metadata/metadata_routes.js");
app.use("/metadata", metadataRoutes);

const aiRoutes = require('./modules/ai/ai_routes'); // <— ROUTER AI
app.use('/ai', aiRoutes);

const usersRoutes = require('./modules/users/users_routes');
app.use('/users', usersRoutes);

// routes orders (MoMo integration)
const ordersRoutes = require('./modules/orders/orders_routes');
app.use('/api/orders', ordersRoutes);

// routes payment (MoMo webhook)
const momoRoutes = require('./modules/momo/momo_routes');
app.use('/api/payment', momoRoutes);

// routes payment (Stripe)
const stripeRoutes = require('./modules/stripe/stripe.routes');
app.use('/api/payments/stripe', stripeRoutes);

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
