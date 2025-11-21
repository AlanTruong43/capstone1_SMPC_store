// Load random featured products for index.html Featured Products section
(function() {
  const API_BASE = "http://localhost:4000";

  // Map condition to badge class
  function getBadgeClass(condition) {
    const cond = (condition || '').toLowerCase();
    if (cond === 'like-new' || cond === 'like new') return '';
    if (cond === 'excellent') return 'badge-blue';
    if (cond === 'good') return 'badge-amber';
    if (cond === 'very good') return 'badge-yellow';
    if (cond === 'fair') return 'badge-amber';
    return '';
  }

  // Format badge text
  function getBadgeText(condition) {
    const cond = (condition || '').toLowerCase();
    if (cond === 'like-new' || cond === 'like new') return 'Like New';
    if (cond === 'excellent') return 'Excellent';
    if (cond === 'good') return 'Good';
    if (cond === 'very good') return 'Very Good';
    if (cond === 'fair') return 'Good';
    return 'Like New';
  }

  // Format price
  function formatPrice(price) {
    try {
      return Number(price).toLocaleString('vi-VN') + ' ₫';
    } catch {
      return price + ' ₫';
    }
  }

  // Get random products
  function getRandomProducts(products, count) {
    // Filter only available products
    const available = products.filter(p => p.status === 'available' || !p.status);

    if (available.length === 0) return [];

    // Shuffle array
    const shuffled = [...available].sort(() => Math.random() - 0.5);

    // Return first count items
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  async function loadFeaturedProducts() {
    try {
      const productsResponse = await fetch(`${API_BASE}/products`);
      if (!productsResponse.ok) throw new Error('Failed to load products');

      const products = await productsResponse.json();

      // Get 6 random products
      const featuredProducts = getRandomProducts(products, 6);

      renderProducts(featuredProducts);
    } catch (error) {
      console.error('Error loading featured products:', error);
      // Keep static content if API fails
    }
  }

  function renderProducts(products) {
    const container = document.querySelector('.products-grid');
    if (!container) return;

    if (products.length === 0) {
      // Show message if no products available
      container.innerHTML = '<div style="grid-column: 1/-1; padding: 40px; text-align: center; color: #6B7280;">No products available at the moment.</div>';
      return;
    }

    container.innerHTML = products.map(product => {
      const badgeClass = getBadgeClass(product.condition);
      const badgeText = getBadgeText(product.condition);
      // Don't escape imageUrl as it's a URL, not HTML content
      const imageUrl = (product.imageUrl || '/img/placeholder.svg').replace(/'/g, "\\'");
      const sellerName = product.sellerName || 'Seller';
      const location = product.location || 'Location';

      // Generate random rating (since we don't have rating data in product object)
      // You can replace this with actual rating fetch if needed
      const rating = (4.4 + Math.random() * 0.5).toFixed(1);
      const reviewCount = Math.floor(Math.random() * 100) + 20;

      return `
        <article class="product-card">
          <div class="product-media" style="background-image:url('${imageUrl}');">
            <div class="card-badge ${badgeClass}">${badgeText}</div>
            <button class="fav-btn">♡</button>
          </div>
          <div class="product-body">
            <h4 class="product-title">${escapeHtml(product.name || 'Product')}</h4>
            <div class="product-price">${formatPrice(product.price || 0)}</div>
            <div class="meta-row">
              <div class="seller">${escapeHtml(sellerName)}</div>
              <div class="rating">★ ${rating} (${reviewCount})</div>
            </div>
            <div class="meta-row small">📍 ${escapeHtml(location)}</div>
          </div>
          <div class="product-footer">
            <button class="btn btn-primary btn-add" data-product-id="${escapeHtml(product.id)}">Add to Cart</button>
          </div>
        </article>
      `;
    }).join('');

    // Attach click handlers for product cards
    attachProductClickHandlers();
  }

  // Escape HTML to prevent XSS
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Attach click handlers for product cards and buttons
  function attachProductClickHandlers() {
    const cards = document.querySelectorAll('.product-card');
    cards.forEach(card => {
      const productId = card.querySelector('.btn-add')?.getAttribute('data-product-id');
      if (!productId) return;

      // Navigate to product details when clicking card (except buttons)
      card.addEventListener('click', (e) => {
        // Don't navigate if clicking buttons or links
        if (e.target.closest('.btn-add') || e.target.closest('.fav-btn')) {
          return;
        }

        window.location.href = `/pages/product_details.html?id=${productId}`;
      });

      // Handle Add to Cart button
      const addBtn = card.querySelector('.btn-add');
      if (addBtn) {
        addBtn.addEventListener('click', async (e) => {
          e.stopPropagation();

          // Check if user is logged in
          try {
            const { getCurrentUser, showLoginRequiredModal } = await import('./auth_manager.js');
            const user = getCurrentUser();

            if (!user) {
              showLoginRequiredModal('Please log in to add items to cart');
              return;
            }

            // Import and use addToCart function
            const { addToCart } = await import('./cart.js');
            await addToCart(productId, 1);
          } catch (error) {
            console.error('Error adding to cart:', error);
          }
        });
      }

      // Handle favorite button
      const favBtn = card.querySelector('.fav-btn');
      if (favBtn) {
        favBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          // Toggle favorite state (placeholder)
          const isFilled = favBtn.textContent === '♥';
          favBtn.textContent = isFilled ? '♡' : '♥';
        });
      }
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadFeaturedProducts);
  } else {
    loadFeaturedProducts();
  }
})();

