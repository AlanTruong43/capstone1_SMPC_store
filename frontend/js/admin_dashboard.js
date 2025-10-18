// Dữ liệu mẫu cho biểu đồ
const dates = ['Jan 1', 'Jan 2', 'Jan 3', 'Jan 4', 'Jan 5', 'Jan 6', 'Jan 7'];

// Dữ liệu cho biểu đồ Revenue & Commission
const revenueData = [45000, 52000, 48000, 61000, 58000, 67000, 56000];
const commissionData = revenueData.map(value => value * 0.05); // 5% commission

// Dữ liệu cho biểu đồ Orders
const ordersData = [28, 32, 30, 41, 36, 45, 34];

// Vẽ biểu đồ Revenue & Commission
const revenueCtx = document.getElementById('revenueChart').getContext('2d');
const revenueChart = new Chart(revenueCtx, {
    type: 'line',
    data: {
        labels: dates,
        datasets: [
            {
                label: 'Revenue',
                data: revenueData,
                borderColor: '#2a85ff',
                backgroundColor: 'rgba(42, 133, 255, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4
            },
            {
                label: 'Commission',
                data: commissionData,
                borderColor: '#83bf6e',
                backgroundColor: 'rgba(131, 191, 110, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                mode: 'index',
                intersect: false,
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null) {
                            label += new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: 'USD'
                            }).format(context.parsed.y);
                        }
                        return label;
                    }
                }
            }
        },
        scales: {
            x: {
                grid: {
                    display: false
                }
            },
            y: {
                beginAtZero: true,
                grid: {
                    color: 'rgba(0, 0, 0, 0.05)'
                },
                ticks: {
                    callback: function(value) {
                        return '$' + value.toLocaleString();
                    }
                }
            }
        }
    }
});

// Vẽ biểu đồ Orders
const ordersCtx = document.getElementById('ordersChart').getContext('2d');
const ordersChart = new Chart(ordersCtx, {
    type: 'bar',
    data: {
        labels: dates,
        datasets: [{
            label: 'Orders',
            data: ordersData,
            backgroundColor: '#83bf6e',
            borderColor: '#83bf6e',
            borderWidth: 0,
            borderRadius: 6,
            barPercentage: 0.6
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            }
        },
        scales: {
            x: {
                grid: {
                    display: false
                }
            },
            y: {
                beginAtZero: true,
                grid: {
                    color: 'rgba(0, 0, 0, 0.05)'
                },
                ticks: {
                    stepSize: 10
                }
            }
        }
    }
});