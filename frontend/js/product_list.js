// === CONFIG ===========================================================
const API_BASE = "http://localhost:4000";

// === STATE ============================================================
const state = {
  categories: [],
  categoryMapBySlug: {},   // slug -> id
  categoryNameById: {},    // id -> name
  options: { locations: [], conditions: [], statuses: [] },

  allProducts: [],
  filteredProducts: [],
  filters: { categorySlug: "", condition: "", location: "", keyword: "" }
};

// === HELPERS ==========================================================
const $ = (sel) => document.querySelector(sel);

function fmtPriceVND(n) {
  try { return Number(n).toLocaleString("vi-VN") + " VND"; }
  catch { return n + " VND"; }
}
function fmtDate(ts) {
  // Firestore Timestamp -> {seconds,nanoseconds} hoặc ISO string
  try {
    if (!ts) return "";
    if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleDateString("vi-VN");
    const d = new Date(ts);
    return isNaN(d) ? "" : d.toLocaleDateString("vi-VN");
  } catch { return ""; }
}
function debounce(fn, ms) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// === FETCHERS =========================================================
async function fetchMetadata() {
  const [catsRes, optRes] = await Promise.all([
    fetch(`${API_BASE}/metadata/categories`),
    fetch(`${API_BASE}/metadata/options`)
  ]);
  if (!catsRes.ok) throw new Error("Cannot load categories");
  if (!optRes.ok) throw new Error("Cannot load options");
  const categories = await catsRes.json();
  const options = await optRes.json();
  return { categories, options };
}

async function fetchProducts() {
  const res = await fetch(`${API_BASE}/products`);
  if (!res.ok) throw new Error("Cannot load products");
  return res.json();
}

// === RENDER FILTERS ===================================================
function populateFilters() {
  const catSel = $("#filterCategory");
  const conSel = $("#filterCondition");
  const locSel = $("#filterLocation");

  // Category
  catSel.innerHTML = `<option value="">All Categories</option>` +
    state.categories.map(c => `<option value="${c.slug}">${c.name}</option>`).join("");

  // Condition
  conSel.innerHTML = `<option value="">All Conditions</option>` +
    state.options.conditions.map(v => `<option value="${v}">${v}</option>`).join("");

  // Location
  locSel.innerHTML = `<option value="">All Locations</option>` +
    state.options.locations.map(v => `<option value="${v}">${v}</option>`).join("");
}

function bindFilterEvents() {
  $("#filterCategory")?.addEventListener("change", e => {
    state.filters.categorySlug = e.target.value;
    applyFilters();
  });
  $("#filterCondition")?.addEventListener("change", e => {
    state.filters.condition = e.target.value; // new|used
    applyFilters();
  });
  $("#filterLocation")?.addEventListener("change", e => {
    state.filters.location = e.target.value; // HCMC|Hanoi|Danang
    applyFilters();
  });
  $("#searchInput")?.addEventListener("input", debounce(e => {
    state.filters.keyword = e.target.value.trim().toLowerCase();
    applyFilters();
  }, 300));
}

// === FILTER + RENDER ==================================================
function applyFilters() {
  const { categorySlug, condition, location, keyword } = state.filters;
  let list = state.allProducts.slice();

  if (categorySlug) {
    const id = state.categoryMapBySlug[categorySlug];
    list = list.filter(p => p.categoryId === id);
  }
  if (condition) {
    list = list.filter(p => (p.condition || "").toLowerCase() === condition);
  }
  if (location) {
    list = list.filter(p => (p.location || "") === location);
  }
  if (keyword) {
    list = list.filter(p => (p.name || "").toLowerCase().includes(keyword));
  }

  // sort theo postDate (mới nhất trước)
  list.sort((a, b) => {
    const sa = a.postDate?.seconds || 0;
    const sb = b.postDate?.seconds || 0;
    return sb - sa;
  });

  state.filteredProducts = list;
  renderProducts(list);

  const counter = $("#resultCounter");
  if (counter) {
    counter.textContent = `Showing ${list.length} of ${state.allProducts.length} products`;
  }
}

function renderProducts(products) {
    const container = $("#product-list");
    if (!container) return;
  
    if (!products.length) {
      container.innerHTML = `<div style="padding:24px;color:#6B7280;">Không tìm thấy sản phẩm phù hợp.</div>`;
      return;
    }
  
    container.innerHTML = products.map(p => {
      const catName = state.categoryNameById[p.categoryId] || "Unknown";
      return `
        <div class="product_item_card" data-id="${p.id}">
          <div class="product-thumb">
            <img
              src="${p.imageUrl}"
              alt="${p.name}"
              class="product-img"
              loading="lazy"
              onerror="this.src='../img/placeholder.png'"
            />
          </div>
          <div class="product_item_body">
            <h3 class="product_item_title">${p.name}</h3>
            <div class="product_item_price">${fmtPriceVND(p.price)}</div>
            <div class="product_item_meta">
              <span class="meta_tag">${catName}</span>
              <span class="meta_tag">${(p.condition||'').toUpperCase()}</span>
              <span class="meta_tag">${p.location||''}</span>
              <span class="meta_tag">${fmtDate(p.postDate)}</span>
            </div>
            <div class="product_item_actions">
              <a class="btn_view" href="product_details.html?id=${p.id}">View Details</a>
              <button class="product_like" aria-label="like" data-liked="false">
                <img src="../img/icon/white%20heart.png" alt="like"/>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    // Click handling: navigate when clicking card OR like button; let anchor work normally
    container.addEventListener("click", (e) => {
      try {
        const card = e.target.closest('.product_item_card');
        if (!card) return;
        const id = card.getAttribute('data-id');
        if (!id) {
          console.error('[NAV] Missing product id on card', { card });
          return;
        }

        const isLike = !!e.target.closest('.product_like');
        const isAnchor = !!e.target.closest('.btn_view');
        const url = `product_details.html?id=${encodeURIComponent(id)}`;

        if (isLike) {
          e.preventDefault();
          e.stopPropagation();
          window.location.href = url;
          return;
        }

        // If click is not on the anchor itself, navigate programmatically
        if (!isAnchor) {
          window.location.href = url;
        }
      } catch (err) {
        console.error('[NAV] Failed to handle product card click', err);
      }
    });
  }
  
  

// === INIT =============================================================
async function init() {
  const listEl = $("#product-list");
  if (listEl) listEl.innerHTML = `<div style="padding:24px;">Loading…</div>`;

  try {
    // 1) metadata
    const { categories, options } = await fetchMetadata();
    state.categories = categories;
    state.options = options;
    state.categoryMapBySlug = Object.fromEntries(categories.map(c => [String(c.slug).toLowerCase(), c.id]));
    state.categoryNameById = Object.fromEntries(categories.map(c => [c.id, c.name]));
    populateFilters();

    // 2) products
    const products = await fetchProducts();
    state.allProducts = Array.isArray(products) ? products : [];
    applyFilters(); // sẽ render bên trong
  } catch (err) {
    console.error(err);
    if (listEl) listEl.innerHTML = `<div style="padding:24px;color:#EF4444;">Không tải được dữ liệu. Vui lòng thử lại.</div>`;
  }

  bindFilterEvents();
}

window.addEventListener("DOMContentLoaded", init);
