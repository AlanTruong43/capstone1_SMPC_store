
// Xử lý thay đổi trạng thái active/nonactive cho các setting
document.addEventListener('DOMContentLoaded', function() {
    // Danh sách các class cần xử lý
    const settingClasses = [
        'setting_1_general',
        'setting_1_notifications',
        'setting_1_localization',
        'setting_1_security',
        'setting_1_integrations',
        'setting_1_marketplace'
    ];

    // Lắng nghe sự kiện click cho tất cả các class
    settingClasses.forEach(function(className) {
        const element = document.querySelector('.' + className);
        if (element) {
            element.addEventListener('click', function() {
                handleSettingClick(this);
            });
        }
    });

    function handleSettingClick(clickedElement) {
        // 1. Xóa tất cả class active_setting
        document.querySelectorAll('.active_setting').forEach(function(activeElement) {
            activeElement.classList.remove('active_setting');
        });
        
        // 2. Đặt lại tất cả ảnh về trạng thái nonactive
        document.querySelectorAll('.setting_1 img').forEach(function(img) {
            if (img.src.includes('/active/')) {
                img.src = img.src.replace('/active/', '/nonactive/');
            }
        });
        
        // 3. Thay đổi ảnh của phần tử được click thành active
        const clickedImg = clickedElement.querySelector('img');
        if (clickedImg) {
            clickedImg.src = clickedImg.src.replace('/nonactive/', '/active/');
        }
        
        // 4. Thêm class active_setting vào phần tử được click
        clickedElement.classList.add('active_setting');
    }
});

// Xử lý hiển thị nội dung tương ứng khi click vào menu
document.addEventListener('DOMContentLoaded', function() {
    // Lấy tất cả các phần tử setting
    const settingElements = document.querySelectorAll('.setting_1_general, .setting_1_marketplace, .setting_1_notifications, .setting_1_localization, .setting_1_security, .setting_1_integrations');
    
    // Lấy tất cả các phần tử content
    const contentElements = document.querySelectorAll('#General, #Marketplace, #Notifications, #Localization, #Security, #Integrations');
    
    // Map các class với id tương ứng
    const classToIdMap = {
        'setting_1_general': 'General',
        'setting_1_marketplace': 'Marketplace',
        'setting_1_notifications': 'Notifications',
        'setting_1_localization': 'Localization',
        'setting_1_security': 'Security',
        'setting_1_integrations': 'Integrations'
    };
    
    // Thêm sự kiện click cho mỗi phần tử setting
    settingElements.forEach(element => {
        element.addEventListener('click', function() {
            // Xóa class active_setting từ tất cả các phần tử setting
            settingElements.forEach(el => {
                el.classList.remove('active_setting');
            });
            
            // Thêm class active_setting cho phần tử được click
            this.classList.add('active_setting');
            
            // Xóa class active_block_content2 từ tất cả các phần tử content
            contentElements.forEach(content => {
                content.classList.remove('active_block_content2');
            });
            
            // Lấy id tương ứng từ class
            const targetId = classToIdMap[this.classList[0]];
            
            // Thêm class active_block_content2 cho phần tử content tương ứng
            const targetContent = document.getElementById(targetId);
            if (targetContent) {
                targetContent.classList.add('active_block_content2');
            }
        });
    });
});