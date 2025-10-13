class LuckyWheel {
    constructor() {
        this.wheel = document.getElementById('wheel');
        this.spinButton = document.getElementById('spinButton');
        this.resultPopup = document.getElementById('resultPopup');
        this.resultMessage = document.getElementById('resultMessage');
        this.prizeName = document.getElementById('prizeName');
        this.closePopup = document.getElementById('closePopup');
        
        this.segments = [
            { id: 1, name: "Giảm 10%", color: "#FF6B6B" },
            { id: 2, name: "Giảm 20%", color: "#4ECDC4" },
            { id: 3, name: "VOUCHER 50K", color: "#45B7D1" }, // Ô số 3 - luôn trúng
            { id: 4, name: "Miễn phí ship", color: "#96CEB4" },
            { id: 5, name: "Giảm 15%", color: "#FFEAA7" },
            { id: 6, name: "Quà tặng", color: "#DDA0DD" },
            { id: 7, name: "Giảm 25%", color: "#98D8C8" },
            { id: 8, name: "VOUCHER 100K", color: "#F7DC6F" }
        ];
        
        this.isSpinning = false;
        
        this.init();
        this.bindEvents();
    }
    
    init() {
        this.createWheelSegments();
    }
    
    createWheelSegments() {
        const segmentAngle = 360 / this.segments.length;
        
        this.segments.forEach((segment, index) => {
            const segmentElement = document.createElement('div');
            segmentElement.className = 'segment';
            segmentElement.innerHTML = `
                <div class="segment-content">${segment.name}</div>
            `;
            
            // Tính toán góc cho mỗi segment
            const startAngle = index * segmentAngle;
            segmentElement.style.transform = `rotate(${startAngle}deg)`;
            
            this.wheel.appendChild(segmentElement);
        });
    }
    
    bindEvents() {
        this.spinButton.addEventListener('click', () => {
            this.spinWheel();
        });
        
        this.closePopup.addEventListener('click', () => {
            this.hideResult();
        });
        
        // Đóng popup khi click ra ngoài
        this.resultPopup.addEventListener('click', (e) => {
            if (e.target === this.resultPopup) {
                this.hideResult();
            }
        });
    }
    
    spinWheel() {
        if (this.isSpinning) return;
        
        this.isSpinning = true;
        this.spinButton.disabled = true;
        
        // Reset wheel position
        this.wheel.style.transition = 'none';
        this.wheel.style.transform = 'rotate(0deg)';
        
        // Force reflow
        this.wheel.offsetHeight;
        
        // Luôn dừng ở ô số 3 (VOUCHER 50K)
        const targetSegmentId = 3;
        this.calculateAndSpin(targetSegmentId);
    }
    
    calculateAndSpin(targetSegmentId) {
        const totalSegments = this.segments.length;
        const segmentAngle = 360 / totalSegments;
        
        // Tìm index của segment có id = 3
        const targetSegmentIndex = this.segments.findIndex(segment => segment.id === targetSegmentId);
        
        if (targetSegmentIndex === -1) {
            console.error('Không tìm thấy segment có id:', targetSegmentId);
            return;
        }
        
        /* 
        Tính toán góc dừng:
        - Mỗi segment chiếm 45° (360/8)
        - Pointer ở vị trí 0° (trên cùng)
        - Để segment dừng đúng ở pointer, cần tính:
          + Segment 0 (id:1) sẽ dừng ở góc: 360 - (0 * 45) - 22.5 = 337.5°
          + Segment 1 (id:2) sẽ dừng ở góc: 360 - (1 * 45) - 22.5 = 292.5°
          + Segment 2 (id:3) sẽ dừng ở góc: 360 - (2 * 45) - 22.5 = 247.5°
        */
        
        const targetPosition = 360 - (targetSegmentIndex * segmentAngle) - (segmentAngle / 2);
        
        // Thêm nhiều vòng quay để tạo hiệu ứng
        const extraRotations = 5;
        const totalRotation = (extraRotations * 360) + targetPosition;
        
        console.log(`Dừng ở segment ${targetSegmentId} (index: ${targetSegmentIndex})`);
        console.log(`Góc dừng: ${targetPosition}°`);
        console.log(`Tổng góc quay: ${totalRotation}°`);
        
        // Thực hiện animation quay
        this.wheel.style.transition = `transform 4s cubic-bezier(0.2, 0.8, 0.3, 1)`;
        this.wheel.style.transform = `rotate(${totalRotation}deg)`;
        
        // Hiển thị kết quả sau khi quay xong
        setTimeout(() => {
            this.showResult(targetSegmentId);
            this.isSpinning = false;
            this.spinButton.disabled = false;
        }, 4200);
        
        // Hiệu ứng quay trong lúc chờ
        setTimeout(() => {
            this.wheel.classList.add('spinning');
        }, 100);
        
        setTimeout(() => {
            this.wheel.classList.remove('spinning');
        }, 4000);
    }
    
    showResult(segmentId) {
        const prize = this.segments.find(segment => segment.id === segmentId);
        if (prize) {
            this.prizeName.textContent = prize.name;
            this.resultPopup.style.display = 'flex';
            
            // Thêm hiệu ứng confetti
            this.createConfetti();
        }
    }
    
    hideResult() {
        this.resultPopup.style.display = 'none';
    }
    
    createConfetti() {
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
        
        for (let i = 0; i < 50; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.cssText = `
                position: fixed;
                width: 10px;
                height: 10px;
                background: ${colors[Math.floor(Math.random() * colors.length)]};
                top: -10px;
                left: ${Math.random() * 100}vw;
                opacity: ${Math.random() * 0.5 + 0.5};
                animation: confettiFall ${Math.random() * 3 + 2}s linear forwards;
                z-index: 1001;
                border-radius: 2px;
            `;
            
            document.body.appendChild(confetti);
            
            // Xóa confetti sau khi animation kết thúc
            setTimeout(() => {
                if (confetti.parentNode) {
                    confetti.remove();
                }
            }, 5000);
        }
        
        // Thêm CSS cho confetti nếu chưa có
        if (!document.querySelector('#confetti-style')) {
            const style = document.createElement('style');
            style.id = 'confetti-style';
            style.textContent = `
                @keyframes confettiFall {
                    0% {
                        transform: translateY(0) rotate(0deg) scale(1);
                    }
                    100% {
                        transform: translateY(100vh) rotate(360deg) scale(0.5);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }
}

// Khởi tạo vòng quay khi trang load
document.addEventListener('DOMContentLoaded', () => {
    new LuckyWheel();
});

// Thêm CSS cho segment content để text hiển thị đúng
const segmentStyle = document.createElement('style');
segmentStyle.textContent = `
    .segment-content {
        transform: rotate(22.5deg);
        text-align: center;
        width: 80px;
        margin-left: -10px;
    }
`;
document.head.appendChild(segmentStyle);