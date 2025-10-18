document.addEventListener('DOMContentLoaded', function() {
    // Khởi tạo giỏ hàng
    initCart();
    
    // Thêm sự kiện cho các nút tăng/giảm số lượng
    document.querySelectorAll('.quantity_short').forEach(button => {
        button.addEventListener('click', function() {
            const input = this.nextElementSibling;
            if (parseInt(input.value) > 1) {
                input.value = parseInt(input.value) - 1;
                updateCart();
            }
        });
    });
    
    document.querySelectorAll('.quantity_long').forEach(button => {
        button.addEventListener('click', function() {
            const input = this.previousElementSibling;
            if (parseInt(input.value) < 99) {
                input.value = parseInt(input.value) + 1;
                updateCart();
            }
        });
    });
    
    // Thêm sự kiện cho input số lượng
    document.querySelectorAll('.quantity_input').forEach(input => {
        input.addEventListener('change', function() {
            if (this.value < 1) this.value = 1;
            if (this.value > 99) this.value = 99;
            updateCart();
        });
    });
    
    // Thêm sự kiện cho nút xóa sản phẩm
    document.querySelectorAll('.product_cart_info_1 img[alt=""]').forEach(button => {
        button.addEventListener('click', function() {
            const productCart = this.closest('.product_cart');
            productCart.remove();
            updateCart();
        });
    });
    
    // Thêm sự kiện cho checkbox "Select All"
    const selectAllCheckbox = document.querySelector('.cart_2_left_1 input[type="checkbox"]');
    selectAllCheckbox.addEventListener('change', function() {
        const checkboxes = document.querySelectorAll('.product_cart input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = this.checked;
        });
        updateCart();
    });
});

function initCart() {
    // Thêm checkbox cho từng sản phẩm
    document.querySelectorAll('.product_cart').forEach(cart => {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = true;
        cart.prepend(checkbox);
    });
    
    // Cập nhật giỏ hàng lần đầu
    updateCart();
}

function updateCart() {
    let totalItems = 0;
    let subtotal = 0;
    let shippingFee = 0;
    let selectedShopCount = 0;
    
    // Lặp qua từng sản phẩm trong giỏ hàng
    document.querySelectorAll('.product_cart').forEach(cart => {
        const checkbox = cart.querySelector('input[type="checkbox"]');
        if (checkbox && checkbox.checked) {
            const quantity = parseInt(cart.querySelector('.quantity_input').value);
            const priceText = cart.querySelector('.product_price').textContent;
            const price = parsePrice(priceText);
            
            totalItems += quantity;
            subtotal += price * quantity;
            
            // Mỗi thẻ product_cart được chọn là 1 shop, tính 50,000 VND
            selectedShopCount++;
        }
    });
    
    // Tính shipping fee: mỗi shop 50,000 VND
    shippingFee = selectedShopCount * 50000;
    
    // Cập nhật UI
    document.querySelector('.cart_1 p').textContent = `${totalItems} item${totalItems !== 1 ? 's' : ''} in your cart`;
    document.querySelector('.cart_2_left_1 span').textContent = totalItems;
    
    // Cập nhật Subtotal
    const subtotalSpans = document.querySelectorAll('.cart_2_right_1 span');
    subtotalSpans[0].textContent = totalItems; // Số lượng items
    subtotalSpans[1].textContent = formatPrice(subtotal); // Tổng tiền sản phẩm
    
    document.querySelector('.cart_2_right_2 span').textContent = formatPrice(shippingFee);
    
    const total = subtotal + shippingFee;
    document.querySelector('.cart_2_right_3 span').textContent = formatPrice(total);
    
    // Cập nhật nút checkout
    const checkoutButton = document.querySelector('.seller_3_btn_1');
    checkoutButton.textContent = `Proceed to Checkout (${totalItems})`;
}

function parsePrice(priceText) {
    // Chuyển đổi chuỗi giá thành số (loại bỏ ký tự không phải số)
    const priceString = priceText.replace(/[^\d]/g, '');
    return parseInt(priceString) || 0;
}

function formatPrice(price) {
    // Định dạng giá thành chuỗi với dấu phân cách
    return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}