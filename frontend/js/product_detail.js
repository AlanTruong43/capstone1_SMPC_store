// thay đổi img main
const thumbnails = document.querySelectorAll('.product_contain1_img_flex img');
const mainImage = document.getElementById('mainImage');

thumbnails.forEach(thumbnail => {
    thumbnail.addEventListener('click', function() {
        const newSrc = this.getAttribute('src');
        mainImage.setAttribute('src', newSrc);
    });
});

// Helpers
function fmtVND(n){
    try { return Number(n).toLocaleString('vi-VN') + ' VND'; } catch { return String(n || 'N/A'); }
}
function qs(sel){ return document.querySelector(sel); }

async function fetchJson(url){
    const res = await fetch(url);
    if(!res.ok){
        console.error('[DETAIL] HTTP error', { url, status: res.status });
        throw new Error('Failed: ' + res.status);
    }
    return res.json();
}

function mapCondition(v){
    const x = String(v || '').toLowerCase();
    if(x === 'new') return 'New';
    if(x === 'used') return 'Used';
    return '';
}

function getQueryId(){
    const u = new URL(window.location.href);
    return u.searchParams.get('id');
}

function setImageOrError(url){
    if(!url){
        mainImage.alt = 'This image is not available now';
        return;
    }
    mainImage.src = url;
    mainImage.onerror = function(){
        mainImage.removeAttribute('src');
        mainImage.alt = 'This image is not available now';
    };
}

function renderProduct(p){
    // breadcrumbs
    const catName = p.category?.name || p.category?.slug || 'Category';
    const title = p.name || 'Product';
    const bcCat = qs('#breadcrumbCategory');
    const bcProd = qs('#breadcrumbProduct');
    const detailCat = qs('#detailCategory');
    const detailSub = qs('#detailSubCategory');
    if(bcCat) bcCat.textContent = catName;
    if(bcProd) bcProd.textContent = title;
    if(detailCat) detailCat.textContent = catName;
    if(detailSub) detailSub.textContent = catName;

    // title
    const titleEl = qs('#productTitle');
    if(titleEl) titleEl.textContent = title;

    // image
    setImageOrError(p.imageUrl);

    // condition/location/shipping
    const condEl = qs('#productCondition');
    const locEl = qs('#productLocation');
    const shipEl = qs('#productShipping');
    if(condEl){
        const m = mapCondition(p.condition);
        condEl.textContent = m;
        condEl.style.display = m ? '' : 'none';
    }
    if(locEl){
        locEl.textContent = p.location || '';
        locEl.style.display = p.location ? '' : 'none';
    }
    if(shipEl){ shipEl.style.display = 'none'; }

    // price
    const priceEl = qs('#productPrice');
    const oldEl = qs('#productOldPrice');
    const saveEl = qs('#productSave');
    if(priceEl){ priceEl.textContent = Number.isFinite(p.price) ? fmtVND(p.price) : 'N/A'; }
    if(oldEl){ oldEl.style.display = 'none'; }
    if(saveEl){ saveEl.style.display = 'none'; }

    // description
    const descEl = qs('#productDescription');
    if(descEl){ descEl.textContent = p.description || 'No description'; }

    // seller name (requires backend /users/:id; fallback to sellerId)
    const sellerEl = qs('#sellerName');
    if(sellerEl){ sellerEl.textContent = p.seller?.displayName || p.sellerId || 'Unknown seller'; }
    
    // Update rating display in seller info section
    const ratingValueEl = qs('#productRatingValue');
    const ratingCountEl = qs('#productRatingCount');
    if(ratingValueEl && p.averageRating !== undefined){
        ratingValueEl.textContent = p.averageRating.toFixed(1);
    } else if(ratingValueEl) {
        ratingValueEl.textContent = '-';
    }
    if(ratingCountEl && p.ratingCount !== undefined){
        ratingCountEl.textContent = `(${p.ratingCount} ${p.ratingCount === 1 ? 'review' : 'reviews'})`;
    } else if(ratingCountEl) {
        ratingCountEl.textContent = '(0 reviews)';
    }
}

function renderRelated(list, currentId){
    const wrap = qs('#relatedProducts');
    if(!wrap) return;
    const items = (list || []).filter(x => x.id !== currentId).slice(0,4);
    if(!items.length){
        wrap.innerHTML = '';
        return;
    }
    wrap.innerHTML = items.map(p => `
      <div class="product_info_short" data-product-id="${p.id}">
        <div class="product_info_short_head">
          <img src="${p.imageUrl || ''}" alt="" class="product_id related-product-image" onerror="this.remove(); this.insertAdjacentText('afterend','This image is not available now');">
          <span class="product_status">${mapCondition(p.condition) || ''}</span>
          <span class="product_like"><img src="/img/icon/white heart.png" alt=""></span>
        </div>
        <div class="product_info_long">
          <h3 class="product_title" style="margin: 20px 0;">${p.name || ''}</h3>
          <p class="product_price" style="margin-bottom: 20px;">${Number.isFinite(p.price)?fmtVND(p.price):'N/A'}</p>
        </div>
      </div>
    `).join('');
    
    // Add click event listeners to related product images
    addRelatedProductClickHandlers();
}

function addRelatedProductClickHandlers(){
    const relatedImages = document.querySelectorAll('.related-product-image');
    relatedImages.forEach(img => {
        img.style.cursor = 'pointer';
        img.addEventListener('click', function(){
            const productCard = this.closest('.product_info_short');
            const productId = productCard.getAttribute('data-product-id');
            if(productId){
                window.location.href = `product_details.html?id=${productId}`;
            }
        });
    });
}

async function initDetail(){
    const id = getQueryId();
    if(!id){
        console.error('Missing product id in URL');
        const t = qs('#productTitle'); if(t) t.textContent = 'Product ID is missing';
        return;
    }
    try{
        const product = await fetchJson(`http://localhost:4000/products/${id}`);

        // optional fetch seller info if endpoint exists
        try{
            if(product.sellerId){
                const u = await fetchJson(`http://localhost:4000/users/${product.sellerId}`);
                product.seller = u || null;
            }
        }catch(e){
            // No users endpoint or not found — acceptable per requirement
            console.log('[DETAIL] Users endpoint not available or user missing');
        }

        renderProduct(product);

        // related products by same category
        try{
            const all = await fetchJson(`http://localhost:4000/products`);
            const same = Array.isArray(all) ? all.filter(p => p.categoryId === product.categoryId) : [];
            renderRelated(same, product.id);
        }catch(e){
            console.log('[DETAIL] Failed to load related products', e);
        }
    }catch(err){
        console.log('[DETAIL] Failed to load product detail', err);
        const t = qs('#productTitle'); if(t) t.textContent = 'Failed to load product';
    }
}

//thay đổi number order
document.addEventListener('DOMContentLoaded', function() {
    const quantityShort = document.querySelector('.quantity_short');
    const quantityLong = document.querySelector('.quantity_long');
    const quantityInput = document.querySelector('.quantity_input');
    
    const minQuantity = 1;
    const maxQuantity = 99;

    // Hàm cập nhật giá trị và kiểm tra giới hạn
    function updateQuantity(value) {
        let newValue = parseInt(value);
        
        // Kiểm tra giá trị hợp lệ
        if (isNaN(newValue)) {
            newValue = minQuantity;
        }
        
        // Giới hạn trong khoảng cho phép
        if (newValue < minQuantity) {
            newValue = minQuantity;
        } else if (newValue > maxQuantity) {
            newValue = maxQuantity;
        }
        
        quantityInput.value = newValue;
        updateButtonStates();
    }

    // Hàm cập nhật trạng thái nút
    function updateButtonStates() {
        const currentValue = parseInt(quantityInput.value);
        quantityShort.disabled = currentValue <= minQuantity;
        quantityLong.disabled = currentValue >= maxQuantity;
    }

    // Sự kiện click nút giảm
    quantityShort.addEventListener('click', function() {
        const currentValue = parseInt(quantityInput.value);
        if (currentValue > minQuantity) {
            updateQuantity(currentValue - 1);
        }
    });

    // Sự kiện click nút tăng
    quantityLong.addEventListener('click', function() {
        const currentValue = parseInt(quantityInput.value);
        if (currentValue < maxQuantity) {
            updateQuantity(currentValue + 1);
        }
    });

    // Sự kiện khi người dùng nhập từ bàn phím
    quantityInput.addEventListener('input', function() {
        updateQuantity(this.value);
    });

    // Sự kiện khi input mất focus (đảm bảo giá trị hợp lệ)
    quantityInput.addEventListener('blur', function() {
        if (this.value === '' || isNaN(parseInt(this.value))) {
            updateQuantity(minQuantity);
        }
    });

    updateButtonStates();
    // kick off
    initDetail();

    // 🛒 Buy Now Button Functionality
    const buyNowBtn = document.querySelector('.product_detail_btn_buynow');
    
    if (buyNowBtn) {
        buyNowBtn.addEventListener('click', function() {
            console.log('🛒 Buy Now clicked');
            
            // Get current product ID and quantity
            const productId = getQueryId();
            const quantity = parseInt(quantityInput.value) || 1;
            
            if (!productId) {
                alert('Product not found. Please refresh the page.');
                return;
            }

            console.log('📦 Redirecting to checkout:', { productId, quantity });
            
            // Redirect to checkout page with product ID and quantity
            window.location.href = `/pages/checkout.html?productId=${productId}&quantity=${quantity}`;
        });
    }

    // 🛒 Add to Cart Button
    const addToCartBtn = document.querySelector('.product_detail_btn_addcart');
    
    if (addToCartBtn) {
        addToCartBtn.addEventListener('click', async function() {
            const productId = getQueryId();
            const quantity = parseInt(quantityInput.value) || 1;
            
            if (!productId) {
                alert('Product not found. Please refresh the page.');
                return;
            }

            // Import and call addToCart function
            try {
                const { addToCart } = await import('./cart.js');
                const success = await addToCart(productId, quantity);
                
                if (success) {
                    console.log('✅ Item added to cart successfully');
                }
            } catch (error) {
                console.error('Error adding to cart:', error);
                alert('Failed to add item to cart. Please try again.');
            }
        });
    }
});