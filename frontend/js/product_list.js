document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.product_like').forEach(button => {
        button.addEventListener('click', function() {
            const img = this.querySelector('img');
            const currentSrc = img.getAttribute('src'); // Dùng getAttribute để chính xác
            
            console.log('Current src:', currentSrc); // Debug
            
            if (currentSrc.includes('white%20heart') || currentSrc.includes('white heart')) {
                img.src = '/img/icon/red%20hearth.png'; // URL encoded cho khoảng trắng
            } else {
                img.src = '/img/icon/white%20heart.png';
            }
        });
    });
});