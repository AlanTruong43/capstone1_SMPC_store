// backend/src/modules/ai/ai_service.js
const { db } = require('../../config/firebase');
const { getIntentFromGemini } = require('./gemini_client');
const { parseWithRules } = require('./nlp_parser');

// Parser "nhẹ": rút trích category, price, condition từ câu hỏi
function naiveParse(query) {
  const q = (query || '').toLowerCase();

  // 🔧 LƯU Ý: key có dấu cách/tiếng Việt phải có nháy
  const slugMap = {
    smartphone: 'smartphones',
    phone: 'smartphones',
    'điện thoại': 'smartphones',
    laptop: 'laptops',
    lap: 'laptops',
    'may tinh xach tay': 'laptops',
    'máy tính xách tay': 'laptops',
    'may tinh': 'laptops',
    accessory: 'accessories',
    'phụ kiện': 'accessories',
  };

  let categorySlug = null;
  for (const [k, slug] of Object.entries(slugMap)) {
    if (q.includes(k)) { categorySlug = slug; break; }
  }

  let maxPrice = null;
  const m = q.match(/(\d+)\s*(?:k|nghìn|tr|triệu|m)/i);
  if (m) {
    const num = parseInt(m[1], 10);
    if (q.includes('tr') || q.includes('triệu') || q.includes('m')) maxPrice = num * 1_000_000;
    else if (q.includes('k') || q.includes('nghìn')) maxPrice = num * 1_000;
  }

  let condition = null;
  if (q.includes('mới') || q.includes('new')) condition = 'new';
  else if (q.includes('cũ') || q.includes('used') || q.includes('2nd')) condition = 'used';

  return { categorySlug, maxPrice, condition };
}

function normalizeCategorySlug(rawCategory, fallbackQuery) {
  const v = String(rawCategory || '').toLowerCase().trim();
  if (v === 'smartphones' || v === 'laptops' || v === 'accessories') return v;
  // synonyms
  if (v === 'phone' || v === 'smartphone' || v === 'điện thoại' || v === 'dien thoai') return 'smartphones';
  if (v === 'laptop' || v === 'lap' || v === 'may tinh xach tay' || v === 'may tinh') return 'laptops';
  if (v === 'accessory' || v === 'phụ kiện' || v === 'phu kien') return 'accessories';

  // fallback to rule parser category if available
  try {
    const tmp = parseWithRules(fallbackQuery || '');
    if (tmp?.category) return normalizeCategorySlug(tmp.category, '');
  } catch (_) {}
  return null;
}

function normalizeCondition(v) {
  const s = String(v || '').toLowerCase();
  if (s === 'new') return 'new';
  if (s === 'used' || s === 'second' || s === '2nd') return 'used';
  return null;
}

function toNumOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ]);
}

exports.searchProductsByIntent = async ({ query, limit = 8 }) => {
  // Luôn parse bằng luật trước để có kết quả nhanh cho tiếng Việt
  const ruleIntent = parseWithRules(query);

  let intentRaw = null;
  // Chỉ gọi Gemini khi độ tin cậy thấp; đặt timeout để không treo request
  if ((ruleIntent?.confidence || 0) < 0.5) {
    try {
      intentRaw = await withTimeout(getIntentFromGemini(query), 1500);
    } catch (e) {
      // im lặng fallback — ruleIntent sẽ dùng làm chính
      intentRaw = null;
    }
  }

  let categorySlug = normalizeCategorySlug(intentRaw?.category ?? ruleIntent.category, query);
  const minPrice = toNumOrNull(intentRaw?.minPrice ?? ruleIntent.minPrice);
  const maxPrice = toNumOrNull(intentRaw?.maxPrice ?? ruleIntent.maxPrice);
  const condition = normalizeCondition(intentRaw?.condition ?? ruleIntent.condition);
  const keywords = Array.isArray(intentRaw?.keywords) && intentRaw.keywords.length
    ? intentRaw.keywords
    : (Array.isArray(ruleIntent.keywords) ? ruleIntent.keywords : []);

  // Fallback thêm: nếu vẫn chưa xác định được category -> thử naiveParse
  if (!categorySlug) {
    const naive = naiveParse(query);
    if (naive?.categorySlug) categorySlug = naive.categorySlug;
  }

  // Chuẩn hoá ngưỡng giá: bỏ các giá trị 0 hoặc âm (coi như null)
  const normMin = (typeof minPrice === 'number' && minPrice > 0) ? minPrice : null;
  const normMax = (typeof maxPrice === 'number' && maxPrice > 0) ? maxPrice : null;
  const intent = { categorySlug, minPrice: normMin, maxPrice: normMax, condition, keywords };

  // ánh xạ categorySlug -> categoryId trong Firestore
  let categoryId = null;
  if (intent.categorySlug) {
    const snap = await db.collection('categories')
      .where('slug', '==', intent.categorySlug)
      .limit(1).get();
    if (!snap.empty) categoryId = snap.docs[0].id;
  }

  // Truy vấn theo status/category/condition rồi lọc giá ở server
  let ref = db.collection('products').where('status', '==', 'available');
  if (categoryId) ref = ref.where('categoryId', '==', categoryId);
  if (intent.condition) ref = ref.where('condition', '==', intent.condition);

  const fetchSize = Math.max(200, limit * 20);
  const qs = await ref.limit(fetchSize).get();
  let items = qs.docs.map(d => ({ id: d.id, ...d.data() }));
  const beforeLen = items.length;

  // Lọc theo min/max giá (coerce sang number an toàn)
  if (intent.minPrice != null || intent.maxPrice != null) {
    items = items.filter(p => {
      const priceVal = Number(p.price);
      if (!Number.isFinite(priceVal)) return false;
      if (intent.minPrice != null && priceVal < intent.minPrice) return false;
      if (intent.maxPrice != null && priceVal > intent.maxPrice) return false;
      return true;
    });
  }

  // Fallback an toàn: nếu kết quả rỗng trong khi có điều kiện mạnh -> lọc tay từ toàn bộ 'available'
  if (!items.length) {
    const allQs = await db.collection('products').where('status', '==', 'available').limit(500).get();
    let all = allQs.docs.map(d => ({ id: d.id, ...d.data() }));
    if (categoryId) all = all.filter(p => p.categoryId === categoryId);
    if (intent.condition) all = all.filter(p => (p.condition || '') === intent.condition);
    if (intent.minPrice != null || intent.maxPrice != null) {
      all = all.filter(p => {
        const priceVal = Number(p.price);
        if (!Number.isFinite(priceVal)) return false;
        if (intent.minPrice != null && priceVal < intent.minPrice) return false;
        if (intent.maxPrice != null && priceVal > intent.maxPrice) return false;
        return true;
      });
    }
    items = all;
  }

  return { intent, products: items.slice(0, limit), __debugTotal: beforeLen };
};
