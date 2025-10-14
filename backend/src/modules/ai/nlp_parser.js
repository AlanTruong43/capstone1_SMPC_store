// backend/src/modules/ai/nlp_parser.js

// Bóc tách ý định cơ bản: category, price range, condition, location, keywords
// Không dùng thư viện ngoài để tránh phát sinh phụ thuộc.

function removeDiacritics(str) {
    // Chuẩn hoá: chuyển đ/Đ -> d, loại dấu, lower-case
    return (str || '')
      .replace(/[đĐ]/g, 'd')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }
  
  const CATEGORY_LEXICON = {
    smartphones: ['dien thoai', 'smartphone', 'phone', 'mobile', 'dt', 'iphone', 'samsung', 'xiaomi', 'oppo', 'vivo'],
    laptops: ['laptop', 'lap', 'macbook', 'notebook', 'ultrabook', 'may tinh xach tay', 'may tinh'],
    accessories: ['phu kien', 'tai nghe', 'chuot', 'ban phim', 'sac', 'cap', 'adapter', 'airpods'],
    books: ['sach', 'book', 'truyen', 'tap chi', 'magazine'],
    clothes: ['ao', 'quan', 'quan jean', 'hoodie', 'som mi', 'thoi trang', 'fashion', 'shirt', 'pants'],
    instruments: ['nhac cu', 'guitar', 'piano', 'trong', 'cajon', 'drum', 'instrument']
  };
  
  const LOCATION_MAP = [
    { canon: 'HCMC',   keys: ['hcm', 'ho chi minh', 'sai gon', 'sg'] },
    { canon: 'Hanoi',  keys: ['ha noi', 'hn'] },
    { canon: 'Danang', keys: ['da nang', 'danang', 'dn'] },
  ];
  
  function parseLocation(s) {
    const norm = removeDiacritics(s);
    for (const item of LOCATION_MAP) {
      for (const k of item.keys) {
        if (norm.includes(k)) return item.canon;
      }
    }
    return null;
  }
  
  function parseCategory(s) {
    const norm = removeDiacritics(s);
    for (const [slug, kws] of Object.entries(CATEGORY_LEXICON)) {
      for (const kw of kws) {
        if (norm.includes(kw)) return slug;
      }
    }
    return null;
  }
  
  function parseCondition(s) {
    const norm = removeDiacritics(s);
    if (/\bmoi\b|brand new|new/.test(norm)) return 'new';
    // Tránh nhầm "35 cu" (đơn vị tiền) với "đồ cũ"
    const hasUnitCu = /\b\d+\s*cu\b/.test(norm);
    if ((/\bcu\b/.test(norm) && !hasUnitCu) || /used|second/.test(norm)) return 'used';
    return null;
  }
  
  // Bắt số tiền "dưới 12tr", "từ 10-15 triệu", "khoảng 8 triệu"...
  function parsePriceRange(s) {
    const norm = removeDiacritics(s);
    console.log('[NLP_DEBUG] parsePriceRange input:', s, '→ normalized:', norm);
  
  // helper chuyển "12 tr|trieu|m" → số VND
  const parseNum = (txt) => {
    const m = txt.match(/([\d\.]+)\s*(tr|trieu|m|k|cu|nghin|ngan)?/);
    console.log('[NLP_DEBUG] parseNum input:', txt, 'match:', m);
    if (!m) return null;
    const val = parseFloat(m[1].replace(/\./g, ''));
    const unit = m[2] || '';
    console.log('[NLP_DEBUG] parseNum val:', val, 'unit:', unit);
    if (/k|nghin|ngan/.test(unit))  return Math.round(val * 1_000);
    if (/tr|trieu|m|cu/.test(unit)) return Math.round(val * 1_000_000);
    // không có đơn vị → giả định nghìn nếu < 1000, triệu nếu >= 1000
    const result = val < 1000 ? Math.round(val * 1_000) : Math.round(val * 1_000_000);
    console.log('[NLP_DEBUG] parseNum no unit: val=', val, 'result=', result);
    console.log('[NLP_DEBUG] parseNum result:', result);
    return result;
  };
  
    // dạng "từ X đến Y", "tu 10 den 15 tr" (hỗ trợ "cu", "nghìn", "ngàn")
    let m = norm.match(/tu\s+([\d\.]+\s*(?:tr|trieu|m|k|cu|nghin|ngan)?)\s*(?:den|toi|->|-|—)\s*([\d\.]+\s*(?:tr|trieu|m|k|cu|nghin|ngan)?)/);
    if (m) {
      const min = parseNum(m[1]); const max = parseNum(m[2]);
      if (min && max) return { minPrice: Math.min(min, max), maxPrice: Math.max(min, max) };
    }

    // "duoi 12tr", "<= 15 trieu" (hỗ trợ "cu", "nghìn", "ngàn")
    m = norm.match(/(duoi|<=|<|khong qua|max)\s*([\d\.]+\s*(?:tr|trieu|m|k|cu|nghin|ngan)?)/);
    console.log('[NLP_DEBUG] "Dưới" pattern test:', norm, '→ match:', m);
    if (m) {
      const max = parseNum(m[2]);
      if (max) return { minPrice: null, maxPrice: max };
    }

    // "tren 8tr", ">= 5 trieu" (hỗ trợ "cu", "nghìn", "ngàn")
    m = norm.match(/(tren|>=|>|toi thieu|min)\s*([\d\.]+\s*(?:tr|trieu|m|k|cu|nghin|ngan)?)/);
    if (m) {
      const min = parseNum(m[2]);
      if (min) return { minPrice: min, maxPrice: null };
    }

    // "co 40 trieu" → khoảng ±5,000,000 cố định cho số lớn, ±15% cho số nhỏ
    m = norm.match(/\bco\b\s*([\d\.]+\s*(?:tr|trieu|m|k|cu|nghin|ngan)?)/);
    console.log('[NLP_DEBUG] "Có" pattern test:', norm, '→ match:', m);
    if (m) {
      const mid = parseNum(m[1]);
      if (mid) {
        // Nếu số nhỏ (< 1M), dùng ±15% thay vì ±5M
        if (mid < 1_000_000) {
          const range = { minPrice: Math.round(mid * 0.85), maxPrice: Math.round(mid * 1.15) };
          console.log('[NLP_DEBUG] "Có" pattern (small number):', mid, '→ range:', range);
          return range;
        } else {
          const range = { minPrice: Math.max(0, mid - 5_000_000), maxPrice: mid + 5_000_000 };
          console.log('[NLP_DEBUG] "Có" pattern (large number):', mid, '→ range:', range);
          return range;
        }
      }
    }

    // "khoang 10tr", "tam 12 trieu", "co 400" (hỗ trợ "cu", "nghìn", "ngàn")
    m = norm.match(/(khoang|tam|around|co)\s*([\d\.]+\s*(?:tr|trieu|m|k|cu|nghin|ngan)?)/);
    console.log('[NLP_DEBUG] Around/Cỡ pattern test:', norm, '→ match:', m);
    if (m) {
      const mid = parseNum(m[2]);
      console.log('[NLP_DEBUG] Around/Cỡ number match:', m[2], '→', mid);
      if (mid) return { minPrice: Math.round(mid * 0.85), maxPrice: Math.round(mid * 1.15) };
    }

    // 1 con số đơn lẻ → coi như khoảng ±15% (hỗ trợ "cu", "nghìn", "ngàn")
    m = norm.match(/([\d\.]+\s*(?:tr|trieu|m|k|cu|nghin|ngan))/);
    if (m) {
      const mid = parseNum(m[1]);
      console.log('[NLP_DEBUG] Single number match:', m[1], '→', mid);
      if (mid) return { minPrice: Math.round(mid * 0.85), maxPrice: Math.round(mid * 1.15) };
    }
  
    return { minPrice: null, maxPrice: null };
  }
  
  function extractKeywords(s) {
    // đơn giản: lấy các từ dài ≥ 3 ký tự, loại bỏ stopwords cơ bản
    const norm = removeDiacritics(s).replace(/[^a-z0-9\s]/g, ' ');
    const stop = new Set(['minh','toi','can','mua','ban','o','tai','gia','duoi','tren','tu','den','va','hoac','la','mot','cai','chiec','hang','co','nghin','ngan','trieu','tr']);
    
    // Ưu tiên các từ có ý nghĩa sản phẩm
    const productKeywords = norm.split(/\s+/).filter(w => w.length >= 3 && !stop.has(w));
    
    // Thêm các từ ghép quan trọng (cả có dấu và không dấu)
    const compoundWords = [];
    if (norm.includes('quan jean')) compoundWords.push('quan jean');
    if (norm.includes('ao somi')) compoundWords.push('ao somi');
    if (norm.includes('ao khoac')) compoundWords.push('ao khoac');
    
    // Thêm từ gốc có dấu để match với tên sản phẩm
    if (s.toLowerCase().includes('quần')) compoundWords.push('quần');
    if (s.toLowerCase().includes('áo')) compoundWords.push('áo');
    if (s.toLowerCase().includes('jean')) compoundWords.push('jean');
    
    return [...compoundWords, ...productKeywords];
  }
  
  function parseWithRules(query) {
    const category  = parseCategory(query);
    const loc       = parseLocation(query);
    const condition = parseCondition(query);
    const { minPrice, maxPrice } = parsePriceRange(query);
    const keywords  = extractKeywords(query);

    // Debug logging
    console.log('[NLP_DEBUG] Query:', query);
    console.log('[NLP_DEBUG] Category:', category);
    console.log('[NLP_DEBUG] Price range:', { minPrice, maxPrice });
    console.log('[NLP_DEBUG] Keywords:', keywords);

    // confidence thô: mỗi slot bắt được +0.2
    let confidence = 0.2;
    if (category)  confidence += 0.2;
    if (loc)       confidence += 0.2;
    if (condition) confidence += 0.2;
    if (minPrice || maxPrice) confidence += 0.2;
    if (confidence > 1) confidence = 1;

    return {
      category, minPrice, maxPrice,
      condition, location: loc, keywords,
      confidence
    };
  }
  
  module.exports = { parseWithRules };
  