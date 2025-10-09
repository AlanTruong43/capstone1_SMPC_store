// thay đổi img main
const thumbnails = document.querySelectorAll('.product_contain1_img_flex img');
const mainImage = document.getElementById('mainImage');

thumbnails.forEach(thumbnail => {
    thumbnail.addEventListener('click', function() {
        const newSrc = this.getAttribute('src');
        mainImage.setAttribute('src', newSrc);
    });
});

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
});