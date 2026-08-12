/**
 * charts.js - ตัวจัดการกราฟวิเคราะห์รายรับรายจ่ายด้วย ApexCharts.js
 */

// โทนสีธีม Modern Clean (Coral Pink, Mint, Apricot, Sky Blue, Purple)
const CHART_COLORS = {
    coral: '#ff536a',
    mint: '#10b981',
    apricot: '#f97316',
    sky: '#3b82f6',
    purple: '#8b5cf6',
    gold: '#ff536a',
    orange: '#f97316',
    cyan: '#10b981',
    red: '#ff536a',
    muted: '#94a3b8',
    secondary: '#64748b',
    grid: 'rgba(0, 0, 0, 0.05)'
};

// ตัวแปรเก็บ Instance ของกราฟ
let revenuePieChart = null;
let expenseBarChart = null;

/**
 * ล้างข้อมูลกราฟเดิมหากมีอยู่
 */
function destroyCharts() {
    if (revenuePieChart) {
        revenuePieChart.destroy();
        revenuePieChart = null;
    }
    if (expenseBarChart) {
        expenseBarChart.destroy();
        expenseBarChart = null;
    }
}

/**
 * สร้างหรืออัปเดตกราฟวงกลมแสดงรายรับช่องทางการขาย (Revenue Pie Chart)
 * @param {Array} data - ข้อมูลสัดส่วนช่องทาง [{ name, value }]
 */
function renderRevenuePieChart(data) {
    const series = data.map(item => item.value);
    const labels = data.map(item => item.name);
    
    const isLight = document.body.classList.contains('light-theme');
    const themeForeColor = isLight ? '#5a6e78' : '#94a3b8';
    const themeStrokeColor = isLight ? '#ffffff' : '#17242e';

    // ตั้งค่ากราฟ
    const options = {
        series: series,
        labels: labels,
        chart: {
            type: 'donut',
            height: 320,
            background: 'transparent',
            foreColor: themeForeColor,
            fontFamily: 'Inter, Sarabun, sans-serif',
            animations: {
                enabled: true,
                easing: 'easeinout',
                speed: 600
            }
        },
        colors: [
            CHART_COLORS.coral,   // หน้าร้าน
            CHART_COLORS.mint,    // Lineman
            CHART_COLORS.apricot, // Grab
            CHART_COLORS.sky,     // Shopee
            CHART_COLORS.purple   // Dotdash
        ],
        stroke: {
            show: true,
            colors: [themeStrokeColor],
            width: 3
        },
        plotOptions: {
            pie: {
                donut: {
                    size: '72%',
                    background: 'transparent',
                    labels: {
                        show: true,
                        name: {
                            show: true,
                            fontSize: '14px',
                            fontWeight: 500,
                            offsetY: -6
                        },
                        value: {
                            show: true,
                            fontSize: '20px',
                            fontWeight: 700,
                            color: '#ffffff',
                            offsetY: 6,
                            formatter: function (val) {
                                return '฿' + Number(val).toLocaleString();
                            }
                        },
                        total: {
                            show: true,
                            label: 'รายรับรวม',
                            color: CHART_COLORS.secondary,
                            fontSize: '13px',
                            formatter: function (w) {
                                const sum = w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                                return '฿' + sum.toLocaleString();
                            }
                        }
                    }
                }
            }
        },
        dataLabels: {
            enabled: false
        },
        legend: {
            show: true,
            position: 'bottom',
            horizontalAlign: 'center',
            fontSize: '13px',
            markers: {
                radius: 4,
                width: 10,
                height: 10
            },
            itemMargin: {
                horizontal: 10,
                vertical: 5
            }
        },
        tooltip: {
            theme: 'dark',
            y: {
                formatter: function (val) {
                    return '฿' + val.toLocaleString() + ' (บาท)';
                }
            },
            style: {
                fontSize: '12px'
            }
        }
    };

    const container = document.querySelector('#revenue-pie-chart');
    if (!container) return;

    if (typeof ApexCharts === 'undefined') {
        container.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--color-secondary);">กำลังเตรียมการแสดงผลกราฟ...</div>';
        return;
    }

    if (revenuePieChart) {
        // หากมีกราฟอยู่แล้ว ให้อัปเดตข้อมูลแทนการสร้างใหม่เพื่อความสมูท
        revenuePieChart.updateSeries(series);
        revenuePieChart.updateOptions({ labels: labels });
    } else {
        container.innerHTML = '';
        revenuePieChart = new ApexCharts(container, options);
        revenuePieChart.render();
    }
}

/**
 * สร้างหรืออัปเดตกราฟแท่งแนวนอนแสดงค่าใช้จ่าย Actual vs Budget (เรียงมากไปน้อย)
 * @param {Array} categories - รายชื่อหมวดหมู่ที่เรียงจากยอดจ่ายจริงมากไปน้อย
 * @param {Array} actualValues - ยอดจ่ายจริง
 * @param {Array} budgetValues - งบประมาณเป้าหมาย
 */
function renderExpenseBarChart(categories, actualValues, budgetValues) {
    const isLight = document.body.classList.contains('light-theme');
    const themeForeColor = isLight ? '#4a5568' : '#8b949e';

    const options = {
        series: [
            {
                name: 'ค่าใช้จ่ายจริง (Actual)',
                data: actualValues
            },
            {
                name: 'งบประมาณตั้งเป้า (Budget)',
                data: budgetValues
            }
        ],
        chart: {
            type: 'bar',
            height: 320,
            background: 'transparent',
            foreColor: themeForeColor,
            fontFamily: 'Inter, Sarabun, sans-serif',
            toolbar: {
                show: false
            },
            animations: {
                enabled: true,
                easing: 'easeinout',
                speed: 600
            }
        },
        plotOptions: {
            bar: {
                horizontal: true,
                dataLabels: {
                    position: 'top'
                },
                barHeight: '65%',
                borderRadius: 4
            }
        },
        colors: [CHART_COLORS.gold, CHART_COLORS.muted],
        dataLabels: {
            enabled: true,
            offsetX: -6,
            style: {
                fontSize: '10px',
                colors: ['#fff']
            },
            formatter: function (val) {
                if (val >= 1000) {
                    return '฿' + Math.round(val / 1000) + 'k';
                }
                return '฿' + val;
            }
        },
        stroke: {
            show: true,
            width: 1,
            colors: ['transparent']
        },
        grid: {
            borderColor: CHART_COLORS.grid,
            xaxis: {
                lines: {
                    show: true
                }
            },
            padding: {
                top: 0,
                right: 20,
                bottom: 0,
                left: 10
            }
        },
        xaxis: {
            categories: categories,
            labels: {
                formatter: function (val) {
                    if (val >= 1000) {
                        return (val / 1000) + 'k';
                    }
                    return val;
                }
            }
        },
        yaxis: {
            labels: {
                style: {
                    fontSize: '13px',
                    fontWeight: 500
                }
            }
        },
        tooltip: {
            theme: 'dark',
            y: {
                formatter: function (val) {
                    return '฿' + val.toLocaleString() + ' บาท';
                }
            }
        },
        legend: {
            position: 'top',
            horizontalAlign: 'right',
            fontSize: '12px',
            markers: {
                radius: 4
            }
        }
    };

    const container = document.querySelector('#expense-bar-chart');
    if (!container) return;

    if (typeof ApexCharts === 'undefined') {
        container.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--color-secondary);">กำลังเตรียมการแสดงผลกราฟ...</div>';
        return;
    }

    if (expenseBarChart) {
        expenseBarChart.updateSeries([
            { name: 'ค่าใช้จ่ายจริง (Actual)', data: actualValues },
            { name: 'งบประมาณตั้งเป้า (Budget)', data: budgetValues }
        ]);
        expenseBarChart.updateOptions({
            xaxis: { categories: categories }
        });
    } else {
        container.innerHTML = '';
        expenseBarChart = new ApexCharts(container, options);
        expenseBarChart.render();
    }
}

// ผูกเข้ากับ Global
window.renderRevenuePieChart = renderRevenuePieChart;
window.renderExpenseBarChart = renderExpenseBarChart;
window.destroyCharts = destroyCharts;
