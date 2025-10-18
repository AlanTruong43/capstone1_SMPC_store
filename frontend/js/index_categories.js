// Load dynamic categories for index.html Popular Categories section
(function() {
  const API_BASE = "http://localhost:4000";
  
  // Mapping static images to categories (keep existing images)
  // Only map categories that exist in Firestore
  const categoryImages = {
    'books': '/img/categories banner/book_banner.avif',
    'clothes': '/img/body/fashion&clothing.png',
    'instruments': '/img/categories banner/instrument_banner.avif',
    'smartphones': '/img/body/ip13.png',
    'laptops': '/img/body/macbook.png',
    'accessories': '/img/categories banner/accessories_banner.jpg'
  };
  
  // Mapping icons to categories
  const categoryIcons = {
    'books': '/img/icon/icons8-document-50.png',
    'clothes': '/img/icon/icons8-home-50.png',
    'instruments': '/img/icon/icons8-light-64.png',
    'smartphones': '/img/icon/icons8-document-50.png',
    'laptops': '/img/icon/icons8-document-50.png',
    'accessories': '/img/icon/white heart.png'
  };
  
  async function loadCategories() {
    try {
      // Fetch categories from API
      const response = await fetch(`${API_BASE}/metadata/categories`);
      if (!response.ok) throw new Error('Failed to load categories');
      
      const categories = await response.json();
      
      // Fetch products to count items per category
      const productsResponse = await fetch(`${API_BASE}/products`);
      const products = productsResponse.ok ? await productsResponse.json() : [];
      
      // Count products per category
      const productCounts = {};
      products.forEach(product => {
        const catId = product.categoryId;
        productCounts[catId] = (productCounts[catId] || 0) + 1;
      });
      
      renderCategories(categories, productCounts);
    } catch (error) {
      console.error('Error loading categories:', error);
      // Keep static content if API fails
    }
  }
  
  function renderCategories(categories, productCounts) {
    const container = document.querySelector('.categories-grid');
    if (!container) return;
    
    // Limit to 6 categories for display
    const displayCategories = categories.slice(0, 6);
    
    container.innerHTML = displayCategories.map(category => {
      const slug = (category.slug || '').toLowerCase();
      const image = categoryImages[slug] || '/img/body/ip13.png'; // fallback
      const icon = categoryIcons[slug] || '/img/icon/icons8-document-50.png';
      const count = productCounts[category.id] || 0;
      
      return `
        <a class="category-card" href="product_list.html?category=${encodeURIComponent(category.slug || '')}">
          <div class="card-media" style="background-image:url('${image}');background-size:cover;background-position:center"></div>
          <div class="card-overlay">
            <img src="${icon}" alt="icon">
            <div class="card-title">${category.name || 'Unknown'}</div>
            <div class="card-count">${count.toLocaleString()} items</div>
          </div>
        </a>
      `;
    }).join('');
  }
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadCategories);
  } else {
    loadCategories();
  }
})();

