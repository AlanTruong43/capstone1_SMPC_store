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
    book: 'books',
    sach: 'books',
    sách: 'books',
    sachkinhdoanh: 'books',
    ao: 'clothes',
    aosomi: 'clothes',
    'áo sơ mi': 'clothes',
    'áo khoác': 'clothes',
    hoodie: 'clothes',
    'quần jean': 'clothes',
    'quần' : 'clothes',
    'nhạc cụ' : 'instruments',
    'trống' : 'instruments',
    trong : 'instruments',
    'pi a nô' : 'instruments',
    guitar : 'instruments',

  };

  let categorySlug = null;
  for (const [k, slug] of Object.entries(slugMap)) {
    if (q.includes(k)) { categorySlug = slug; break; }
  }

  let maxPrice = null;
  // Improved regex to better capture Vietnamese price patterns
  const m = q.match(/(\d+)\s*(?:k|nghìn|tr|triệu|m|ngàn)/i);
  if (m) {
    const num = parseInt(m[1], 10);
    if (q.includes('tr') || q.includes('triệu') || q.includes('m')) maxPrice = num * 1_000_000;
    else if (q.includes('k') || q.includes('nghìn') || q.includes('ngàn')) maxPrice = num * 1_000;
    // If no unit specified and number is small (< 1000), assume it's in thousands
    else if (num < 1000) maxPrice = num * 1_000;
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
  if (v === 'book' || v === 'sach' || v === 'sachkinhdoanh') return 'books';
  if (v === 'ao' || v === 'aosomi' || v === 'aosomimay' || v === 'aosomimaymau') return 'clothes';
  if (v === 'quần jean' || v === 'quần') return 'clothes';
  if (v === 'nhạc cụ' || v === 'trống' || v === 'trong' || v === 'pi a nô' || v === 'guitar') return 'instruments';

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
  // Luôn gọi Gemini API để có kết quả tốt hơn, nhưng với timeout ngắn
  try {
    console.log('[AI_DEBUG] Calling Gemini API for query:', query);
    intentRaw = await withTimeout(getIntentFromGemini(query), 2000);
    console.log('[AI_DEBUG] Gemini API response:', intentRaw);
  } catch (e) {
    console.log('[AI_DEBUG] Gemini API error:', e.message);
    // Fallback to rule-based parsing
    intentRaw = null;
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
  let normMin = (typeof minPrice === 'number' && minPrice > 0) ? minPrice : null;
  let normMax = (typeof maxPrice === 'number' && maxPrice > 0) ? maxPrice : null;
  
  // Safeguard: Nếu maxPrice quá lớn (> 50M VND), có thể là lỗi parsing
  // Thử dùng rule-based parsing thay thế
  if (normMax && normMax > 50_000_000 && ruleIntent?.maxPrice) {
    console.log('[AI_DEBUG] MaxPrice too large, using rule-based fallback:', normMax);
    normMax = ruleIntent.maxPrice;
  }
  
  // Logic mới: Nếu chỉ có maxPrice và < 1 triệu, tạo range ±200k
  // Nếu < 500k, range ±50k
  if (normMax && !normMin) {
    if (normMax <= 500000) {
      // Dưới 500k: range ±50k
      normMin = Math.max(0, normMax - 50000);
      normMax = normMax + 50000;
    } else if (normMax <= 1000000) {
      // Dưới 1 triệu: range ±200k
      normMin = Math.max(0, normMax - 200000);
      normMax = normMax + 200000;
    }
  }
  
  const intent = { categorySlug, minPrice: normMin, maxPrice: normMax, condition, keywords };
  
  // Debug logging to help identify parsing issues
  console.log('[AI_DEBUG] Query:', query);
  console.log('[AI_DEBUG] Rule intent:', ruleIntent);
  console.log('[AI_DEBUG] Gemini intent:', intentRaw);
  console.log('[AI_DEBUG] Final intent:', intent);

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

  // Lọc theo keywords trước (nếu có)
  if (Array.isArray(intent.keywords) && intent.keywords.length > 0) {
    const keywords = intent.keywords.map(k => k.toLowerCase());
    const filteredItems = items.filter(p => {
      const name = (p.name || '').toLowerCase();
      const desc = (p.description || '').toLowerCase();
      // Kiểm tra xem có ít nhất 1 keyword match với tên hoặc mô tả không
      return keywords.some(kw => name.includes(kw) || desc.includes(kw));
    });
    
    console.log('[AI_DEBUG] After keyword filtering:', filteredItems.length, 'items remain');
    console.log('[AI_DEBUG] Keywords:', keywords);
    console.log('[AI_DEBUG] Sample product names:', items.slice(0,3).map(p => p.name));
    
    // Chỉ áp dụng keyword filtering nếu có kết quả, không thì bỏ qua
    if (filteredItems.length > 0) {
      items = filteredItems;
    } else {
      console.log('[AI_DEBUG] No keyword matches, skipping keyword filter');
    }
  }

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
    
    // Nếu vẫn rỗng và có maxPrice, thử mở rộng range cho fallback
    if (!items.length && intent.maxPrice && !intent.minPrice) {
      let fallbackMin = null;
      let fallbackMax = null;
      
      if (intent.maxPrice <= 500000) {
        // Dưới 500k: range ±50k
        fallbackMin = Math.max(0, intent.maxPrice - 50000);
        fallbackMax = intent.maxPrice + 50000;
      } else if (intent.maxPrice <= 1000000) {
        // Dưới 1 triệu: range ±200k
        fallbackMin = Math.max(0, intent.maxPrice - 200000);
        fallbackMax = intent.maxPrice + 200000;
      }
      
      if (fallbackMin !== null && fallbackMax !== null) {
        // Lọc lại từ all với range mới
        const fallbackItems = all.filter(p => {
          const priceVal = Number(p.price);
          if (!Number.isFinite(priceVal)) return false;
          return priceVal >= fallbackMin && priceVal <= fallbackMax;
        });
        items = fallbackItems;
      }
    }
  }

  return { intent, products: items.slice(0, limit), __debugTotal: beforeLen };
};
