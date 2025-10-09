// backend/src/modules/ai/ai_service.js
const { db } = require('../../config/firebase');

// Parser "nhẹ": rút trích category, price, condition từ câu hỏi
function naiveParse(query) {
  const q = (query || '').toLowerCase();

  // 🔧 LƯU Ý: key có dấu cách/tiếng Việt phải có nháy
  const slugMap = {
    smartphone: 'smartphones',
    phone: 'smartphones',
    'điện thoại': 'smartphones',
    laptop: 'laptops',
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

exports.searchProductsByIntent = async ({ query, limit = 8 }) => {
  const intent = naiveParse(query);

  // ánh xạ categorySlug -> categoryId trong Firestore
  let categoryId = null;
  if (intent.categorySlug) {
    const snap = await db.collection('categories')
      .where('slug', '==', intent.categorySlug)
      .limit(1).get();
    if (!snap.empty) categoryId = snap.docs[0].id;
  }

  // dựng query Firestore
  let ref = db.collection('products').where('status', '==', 'available');
  if (categoryId) ref = ref.where('categoryId', '==', categoryId);
  if (intent.condition) ref = ref.where('condition', '==', intent.condition);

  // lấy rộng rồi lọc giá ở client (giới hạn Firestore với bất đẳng thức)
  const qs = await ref.limit(limit * 3).get();
  let items = qs.docs.map(d => ({ id: d.id, ...d.data() }));

  if (intent.maxPrice) {
    items = items.filter(p => typeof p.price === 'number' && p.price <= intent.maxPrice);
  }

  return { intent, products: items.slice(0, limit) };
};
