/**
 * app.js - ไฟล์หลักควบคุมระบบตรรกะและปฏิสัมพันธ์กับผู้ใช้ (State Management & UI Handlers)
 */

// 1. แอปพลิเคชัน State
const state = {
    currentUser: null,
    selectedBranch: '', // 'all' หรือไอดีสาขา เช่น 'ladprao'
    selectedMonth: '2026-08',
    currentPage: 'dashboard',
    transactions: [],
    budgets: [],
    
    // pagination สำหรับธุรกรรม
    txPage: 1,
    txLimit: 10
};

// 2. แผนการคัดกรองวันที่ย้อนหลัง
function getPreviousMonth(dateStr) {
    const [year, month] = dateStr.split('-').map(Number);
    if (month === 1) {
        return `${year - 1}-12`;
    }
    return `${year}-${(month - 1).toString().padStart(2, '0')}`;
}

function getPreviousYearMonth(dateStr) {
    const [year, month] = dateStr.split('-');
    return `${parseInt(year) - 1}-${month}`;
}

/**
 * โหลดข้อมูลหลักของแอป
 */
function loadData() {
    state.transactions = Database.getTransactions();
    state.budgets = Database.getBudgets();
}

/**
 * เริ่มทำงานแอปพลิเคชัน (เมื่อยืนยันสิทธิ์แล้ว)
 */
function bootApp() {
    try {
        // 1. ซ่อนหน้าล็อกอิน แสดงหน้าแดชบอร์ดหลัก
        const loginScreen = document.getElementById('login-screen');
        const mainApp = document.getElementById('main-app');
        if (loginScreen) loginScreen.classList.remove('active');
        if (mainApp) mainApp.classList.add('active');
        
        // 2. เติมข้อมูลโปรไฟล์ผู้ถือหุ้นที่แถบด้านข้าง
        const headerName = document.getElementById('header-user-name');
        const headerAvatar = document.getElementById('header-user-avatar');
        if (headerName) headerName.innerText = state.currentUser.name;
        if (headerAvatar) {
            headerAvatar.innerHTML = `<img src="${window.STORE_LOGO_BASE64 || 'logo.png'}" alt="โลโก้ร้าน" class="profile-logo-img">`;
        }
        applyStoreLogos();
        
        // ปรับบทบาทตามสิทธิ์
        let roleText = 'ผู้ถือหุ้น';
        if (state.currentUser.permittedBranches.length === 4) {
            roleText = 'หุ้นส่วนใหญ่ / แอดมิน';
        }
        const userRoleEl = document.querySelector('.sidebar-footer .user-role');
        if (userRoleEl) userRoleEl.innerText = roleText;
        
        // 3. กำหนดสาขาเริ่มต้นที่มีสิทธิ์
        const branchSelector = document.getElementById('filter-branch');
        if (branchSelector) {
            branchSelector.innerHTML = '';
            const allowedBranches = state.currentUser.permittedBranches;
            
            if (allowedBranches.length > 1) {
                const option = document.createElement('option');
                option.value = 'all';
                option.innerText = 'ทุกสาขาที่มีสิทธิ์เข้าถึง';
                branchSelector.appendChild(option);
                state.selectedBranch = 'all';
            } else {
                state.selectedBranch = allowedBranches[0];
            }
            
            allowedBranches.forEach(branchId => {
                const branch = BRANCHES[branchId];
                if (branch) {
                    const option = document.createElement('option');
                    option.value = branchId;
                    option.innerText = branch.name;
                    branchSelector.appendChild(option);
                }
            });
        }
        
        // อัปเดตตัวกรองหน้าจอเพิ่มรายการธุรกรรมให้กรองสาขาตามสิทธิ์ด้วย
        const modalBranchSelector = document.getElementById('tx-branch');
        if (modalBranchSelector) {
            modalBranchSelector.innerHTML = '';
            state.currentUser.permittedBranches.forEach(branchId => {
                const branch = BRANCHES[branchId];
                if (branch) {
                    const option = document.createElement('option');
                    option.value = branchId;
                    option.innerText = branch.name;
                    modalBranchSelector.appendChild(option);
                }
            });
        }

        // กำหนดวันที่ปัจจุบันเป็นค่าตั้งต้นในฟอร์ม Modal
        const today = new Date().toISOString().split('T')[0];
        const txDateEl = document.getElementById('tx-date');
        if (txDateEl) txDateEl.value = today;
        
        // 3.5 ซ่อน/แสดง ปุ่มบันทึกตามสิทธิ์ (พน, ออม)
        const canEdit = state.currentUser.username === 'aom' || state.currentUser.username === 'pon';
        const addBtn = document.getElementById('btn-open-add-modal');
        if (addBtn) {
            addBtn.style.display = canEdit ? '' : 'none';
        }
        
        // 4. โหลดข้อมูล
        loadData();
        
        // 5. สลับหน้าแรกไปยังแดชบอร์ด
        switchView('dashboard');
        if (window.lucide) {
            lucide.createIcons();
        }
    } catch (err) {
        console.error("bootApp Error:", err);
        alert("เกิดข้อผิดพลาดในการโหลดแดชบอร์ด: " + (err.message || err));
    }
}

/**
 * สลับแท็บ / หน้าจอการแสดงผล
 */
function switchView(viewId) {
    state.currentPage = viewId;
    
    // อัปเดตสถานะเมนูใน Sidebar
    document.querySelectorAll('.nav-item').forEach(item => {
        if (item.getAttribute('data-view') === viewId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    // ซ่อน/แสดง หน้าจอ
    document.querySelectorAll('.app-view').forEach(view => {
        view.classList.remove('active');
    });
    document.getElementById(`${viewId}-view`).classList.add('active');
    
    // อัปเดตหัวข้อและรายละเอียดหน้าจอ
    const viewTitle = document.getElementById('view-title');
    const viewSubtitle = document.getElementById('view-subtitle');
    
    if (viewId === 'dashboard') {
        viewTitle.innerText = 'แดชบอร์ดสรุปรายรับรายจ่าย';
        viewSubtitle.innerText = 'วิเคราะห์ประสิทธิภาพ P&L, สัดส่วนรายรับ, และการเปรียบเทียบงบประมาณ';
        renderDashboard();
    } else if (viewId === 'budget') {
        viewTitle.innerText = 'ปรับแต่งเป้าหมายงบประมาณ';
        viewSubtitle.innerText = 'กำหนดเพดานงบประมาณค่าใช้จ่ายประจำเดือน และทดลองแบบจำลองกำไร';
        renderBudgetEditor();
        runWhatIfSimulation();
    } else if (viewId === 'transactions') {
        viewTitle.innerText = 'ระบบบันทึกและประวัติธุรกรรม';
        viewSubtitle.innerText = 'แสดงรายละเอียดธุรกรรมทั้งหมด สามารถเพิ่ม ลบ คัดกรอง และดาวน์โหลด CSV ได้';
        renderTransactionsTable();
        // เติม dropdown หมวดหมู่สำหรับค้นหา
        populateFilterCategories();
    } else if (viewId === 'shareholders') {
        viewTitle.innerText = 'โครงสร้างผู้ถือหุ้นและเงินปันผล';
        viewSubtitle.innerText = 'ตรวจสอบสัดส่วนหุ้นและส่วนแบ่งผลตอบแทนกำไรแยกรายบุคคล';
        renderShareholdersInfo();
    }
    
    if (window.lucide) {
        lucide.createIcons();
    }
}

/**
 * ดึงรายการธุรกรรมที่กรองตามสาขา (อิงสิทธิ์) และเดือนที่เลือก
 */
function getFilteredTransactions(month, branchId) {
    let list = [...state.transactions];
    
    // กรองตามสาขา
    if (branchId === 'all') {
        list = list.filter(tx => state.currentUser.permittedBranches.includes(tx.branchId));
    } else {
        list = list.filter(tx => tx.branchId === branchId);
    }
    
    // กรองตามเดือน (YYYY-MM)
    if (month) {
        list = list.filter(tx => tx.date.startsWith(month));
    }
    
    return list;
}

/**
 * คำนวณสรุปทางการเงิน (Revenue, Expense, Profit, Margin)
 */
function calculateFinancials(txList) {
    let revenue = 0;
    let expense = 0;
    
    txList.forEach(tx => {
        if (tx.type === 'income') {
            revenue += tx.amount;
        } else if (tx.type === 'expense') {
            expense += tx.amount;
        }
    });
    
    const profit = revenue - expense;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    
    return { revenue, expense, profit, margin };
}

/**
 * วิเคราะห์หาค่าเฉลี่ยสัดส่วนและ Dividend ของผู้ใช้ปัจจุบัน
 */
function calculateUserShare(branchId, profit, revenue, expense) {
    if (!state.currentUser) {
        return {
            percentage: 0,
            revenue: 0,
            expense: 0,
            profit: 0
        };
    }

    let userSharePercentage = 0;
    
    if (branchId === 'all') {
        // กรณีดูทุกสาขา ให้ถัวเฉลี่ยหุ้นตามแต่ละสาขา
        let totalUserProfitShare = 0;
        let totalUserRevenueShare = 0;
        let totalUserExpenseShare = 0;
        
        state.currentUser.permittedBranches.forEach(bId => {
            const branch = BRANCHES[bId];
            const pct = branch.shareholders[state.currentUser.username] || 0;
            
            // คำนวณยอดเฉพาะสาขานี้ในเดือนที่เลือก
            const branchTxs = getFilteredTransactions(state.selectedMonth, bId);
            const branchFin = calculateFinancials(branchTxs);
            
            totalUserProfitShare += branchFin.profit * (pct / 100);
            totalUserRevenueShare += branchFin.revenue * (pct / 100);
            totalUserExpenseShare += branchFin.expense * (pct / 100);
        });
        
        return {
            percentage: null, // หลายสาขาถือครองไม่เท่ากัน
            revenue: totalUserRevenueShare,
            expense: totalUserExpenseShare,
            profit: totalUserProfitShare
        };
    } else {
        const branch = BRANCHES[branchId];
        userSharePercentage = branch.shareholders[state.currentUser.username] || 0;
        
        return {
            percentage: userSharePercentage,
            revenue: revenue * (userSharePercentage / 100),
            expense: expense * (userSharePercentage / 100),
            profit: profit * (userSharePercentage / 100)
        };
    }
}

/**
 * 1. ฟังก์ชันหน้า แดชบอร์ด (Dashboard View Rendering)
 */
function renderDashboard() {
    if (!state.currentUser) return;

    const currentTxs = getFilteredTransactions(state.selectedMonth, state.selectedBranch);
    const currentFin = calculateFinancials(currentTxs);
    
    // 1.1 ดึงข้อมูลเปรียบเทียบ MoM และ YoY
    const prevMonth = getPreviousMonth(state.selectedMonth);
    const prevMonthTxs = getFilteredTransactions(prevMonth, state.selectedBranch);
    const prevMonthFin = calculateFinancials(prevMonthTxs);
    
    const prevYearMonth = getPreviousYearMonth(state.selectedMonth);
    const prevYearTxs = getFilteredTransactions(prevYearMonth, state.selectedBranch);
    const prevYearFin = calculateFinancials(prevYearTxs);
    
    // 1.2 คำนวณเงินสะสมย้อนหลัง 12 เดือนล่าสุด
    let cumulativeRevenue = 0;
    let cumulativeProfit = 0;
    // วนลูปหาก่อนหน้า 12 เดือน
    let tempMonth = state.selectedMonth;
    for (let i = 0; i < 12; i++) {
        const tempTxs = getFilteredTransactions(tempMonth, state.selectedBranch);
        const tempFin = calculateFinancials(tempTxs);
        cumulativeRevenue += tempFin.revenue;
        cumulativeProfit += tempFin.profit;
        tempMonth = getPreviousMonth(tempMonth);
    }
    
    // 1.3 อัปเดต KPI Cards ในแดชบอร์ด
    document.getElementById('kpi-revenue').innerText = `฿${currentFin.revenue.toLocaleString()}`;
    document.getElementById('kpi-expense').innerText = `฿${currentFin.expense.toLocaleString()}`;
    
    const profitEl = document.getElementById('kpi-profit');
    profitEl.innerText = `฿${currentFin.profit.toLocaleString()}`;
    if (currentFin.profit < 0) {
        profitEl.className = 'kpi-value text-danger';
    } else {
        profitEl.className = 'kpi-value text-gold';
    }
    
    document.getElementById('kpi-margin').innerText = `${currentFin.margin.toFixed(1)}%`;
    
    // 1.4 แนวโน้มการเติบโตเทียบ MoM และ YoY
    updateTrendIndicator('kpi-revenue-trend', currentFin.revenue, prevMonthFin.revenue);
    updateTrendIndicator('kpi-expense-trend', currentFin.expense, prevMonthFin.expense, true); // รายจ่ายลดลงเป็นสิ่งดี
    updateTrendIndicator('kpi-profit-trend', currentFin.profit, prevMonthFin.profit);
    updateTrendIndicator('kpi-margin-trend', currentFin.margin, prevMonthFin.margin);
    
    // 1.5 เปรียบเทียบ MoM และ YoY
    updateGrowthLabel('mom-revenue-change', currentFin.revenue, prevMonthFin.revenue);
    updateGrowthLabel('mom-profit-change', currentFin.profit, prevMonthFin.profit);
    updateGrowthLabel('yoy-revenue-change', currentFin.revenue, prevYearFin.revenue);
    updateGrowthLabel('yoy-profit-change', currentFin.profit, prevYearFin.profit);
    
    document.getElementById('cumulative-revenue-12m').innerText = `฿${cumulativeRevenue.toLocaleString()}`;
    document.getElementById('cumulative-profit-12m').innerText = `฿${cumulativeProfit.toLocaleString()}`;
    
    // 1.6 แสดงสัดส่วนเงินแบ่งของผู้ถือหุ้น
    const userShare = calculateUserShare(state.selectedBranch, currentFin.profit, currentFin.revenue, currentFin.expense);
    
    if (userShare.percentage !== null) {
        document.getElementById('kpi-revenue-dividend').innerHTML = `ส่วนแบ่งรายได้ตามสิทธิ์ (${userShare.percentage}%): <span class="gold-text">฿${Math.round(userShare.revenue).toLocaleString()}</span>`;
        document.getElementById('kpi-expense-dividend').innerHTML = `ภาระรายจ่ายตามสิทธิ์ (${userShare.percentage}%): <span class="gold-text">฿${Math.round(userShare.expense).toLocaleString()}</span>`;
        document.getElementById('kpi-profit-dividend').innerHTML = `ส่วนแบ่งกำไรสุทธิของคุณ (${userShare.percentage}%): <span class="gold-text font-bold">฿${Math.round(userShare.profit).toLocaleString()}</span>`;
    } else {
        document.getElementById('kpi-revenue-dividend').innerHTML = `รวมส่วนแบ่งรายได้ตามสิทธิ์: <span class="gold-text">฿${Math.round(userShare.revenue).toLocaleString()}</span>`;
        document.getElementById('kpi-expense-dividend').innerHTML = `รวมภาระรายจ่ายตามสิทธิ์: <span class="gold-text">฿${Math.round(userShare.expense).toLocaleString()}</span>`;
        document.getElementById('kpi-profit-dividend').innerHTML = `รวมส่วนแบ่งกำไรสุทธิของคุณ: <span class="gold-text font-bold">฿${Math.round(userShare.profit).toLocaleString()}</span>`;
    }
    
    // 1.7 คำนวณกราฟพายรายได้ (Sales Channel Pie Chart)
    const channelSums = {};
    Object.keys(SALE_CHANNELS).forEach(ch => channelSums[ch] = 0);
    
    currentTxs.forEach(tx => {
        if (tx.type === 'income') {
            channelSums[tx.channel] = (channelSums[tx.channel] || 0) + tx.amount;
        }
    });
    
    const pieData = Object.entries(channelSums).map(([channel, val]) => ({
        name: SALE_CHANNELS[channel],
        value: val
    }));
    
    renderRevenuePieChart(pieData);
    
    // 1.8 คำนวณสรุปรายจ่ายและงบประมาณ (Expense Analysis Table & Bar Chart)
    const categorySums = {};
    Object.keys(EXPENSE_CATEGORIES).forEach(cat => categorySums[cat] = 0);
    
    currentTxs.forEach(tx => {
        if (tx.type === 'expense') {
            categorySums[tx.category] = (categorySums[tx.category] || 0) + tx.amount;
        }
    });
    
    // ดึงค่า % Budget ของแต่ละสาขา
    // ในกรณีที่เลือก "ทุกสาขาที่มีสิทธิ์" งบประมาณจะเป็นค่าเฉลี่ยหรือคำนวณถ่วงน้ำหนักตามสิทธิ์สาขา
    const budgetsMap = {};
    
    if (state.selectedBranch === 'all') {
        // รวมเป้าหมายงบประมาณเฉลี่ยถ่วงน้ำหนักตามสัดส่วนรายได้จริงของแต่ละสาขา
        Object.keys(EXPENSE_CATEGORIES).forEach(cat => {
            let totalBudgetVal = 0;
            state.currentUser.permittedBranches.forEach(bId => {
                const branchTxs = getFilteredTransactions(state.selectedMonth, bId);
                const branchFin = calculateFinancials(branchTxs);
                const pct = Database.getBudgetFor(bId, state.selectedMonth)[cat] || 0;
                totalBudgetVal += branchFin.revenue * (pct / 100);
            });
            budgetsMap[cat] = currentFin.revenue > 0 ? (totalBudgetVal / currentFin.revenue) * 100 : 0;
        });
    } else {
        const branchBudget = Database.getBudgetFor(state.selectedBranch, state.selectedMonth);
        Object.keys(EXPENSE_CATEGORIES).forEach(cat => {
            budgetsMap[cat] = branchBudget[cat] || 0;
        });
    }
    
    // สร้าง Array ข้อมูลรายจ่าย
    const expenseDataList = Object.entries(categorySums).map(([category, actualVal]) => {
        const budgetPct = budgetsMap[category];
        const targetVal = Math.round(currentFin.revenue * (budgetPct / 100));
        const variance = actualVal - targetVal;
        
        return {
            category: category,
            categoryName: EXPENSE_CATEGORIES[category],
            actualVal: actualVal,
            budgetPct: budgetPct,
            targetVal: targetVal,
            variance: variance
        };
    });
    
    // เรียงจาก **มากไปน้อย** ตามที่ผู้ใช้ต้องการ
    expenseDataList.sort((a, b) => b.actualVal - a.actualVal);
    
    // เติมข้อมูลลงตารางวิเคราะห์รายจ่าย
    const tableBody = document.getElementById('expense-table-body');
    tableBody.innerHTML = '';
    
    expenseDataList.forEach(item => {
        const tr = document.createElement('tr');
        
        const isOverBudget = item.actualVal > item.targetVal;
        const statusBadge = isOverBudget 
            ? `<span class="badge badge-danger">เกินงบ (Over)</span>` 
            : `<span class="badge badge-success">ปกติ (Normal)</span>`;
            
        const varianceClass = isOverBudget ? 'text-danger font-semibold' : 'text-success';
        const varianceSign = item.variance > 0 ? `+฿${item.variance.toLocaleString()}` : `-฿${Math.abs(item.variance).toLocaleString()}`;
        
        tr.innerHTML = `
            <td class="font-semibold">${item.categoryName}</td>
            <td class="text-right font-bold">฿${item.actualVal.toLocaleString()}</td>
            <td class="text-right">${item.budgetPct.toFixed(1)}%</td>
            <td class="text-right text-secondary">฿${item.targetVal.toLocaleString()}</td>
            <td class="text-right ${varianceClass}">${item.variance === 0 ? '฿0' : varianceSign}</td>
            <td class="text-center">${statusBadge}</td>
        `;
        tableBody.appendChild(tr);
    });
    
    // 1.9 เรนเดอร์กราฟแท่งค่าใช้จ่าย (Expense Bar Chart - เรียงมากไปน้อย)
    const barCategories = expenseDataList.map(item => item.categoryName);
    const barActuals = expenseDataList.map(item => item.actualVal);
    const barBudgets = expenseDataList.map(item => item.targetVal);
    
    renderExpenseBarChart(barCategories, barActuals, barBudgets);
}

/**
 * ผู้ช่วยเหลือการอัปเดตแนวโน้ม Trend (KPI Cards)
 */
function updateTrendIndicator(elementId, current, prev, isExpense = false) {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    if (prev === 0) {
        el.className = 'trend-indicator';
        el.innerHTML = `<span class="text-secondary">-</span>`;
        return;
    }
    
    const pctChange = ((current - prev) / Math.abs(prev)) * 100;
    const absPct = Math.abs(pctChange).toFixed(1);
    
    let isPositiveGood = true;
    if (isExpense) isPositiveGood = false; // ถ้าเป็นรายจ่าย ยิ่งเพิ่มยิ่งไม่ดี
    
    if (pctChange > 0) {
        el.className = `trend-indicator ${isPositiveGood ? 'positive' : 'negative'}`;
        el.innerHTML = `<i data-lucide="arrow-up"></i> ${absPct}%`;
    } else if (pctChange < 0) {
        el.className = `trend-indicator ${isPositiveGood ? 'negative' : 'positive'}`;
        el.innerHTML = `<i data-lucide="arrow-down"></i> ${absPct}%`;
    } else {
        el.className = 'trend-indicator';
        el.innerHTML = `<i data-lucide="minus"></i> 0%`;
    }
}

/**
 * ผู้ช่วยเหลือการอัปเดตแนวโน้มเติบโต (Growth Label Text)
 */
function updateGrowthLabel(elementId, current, prev) {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    if (prev === 0) {
        el.innerText = 'ไม่มีข้อมูล';
        el.className = 'value text-secondary';
        return;
    }
    
    const pct = ((current - prev) / Math.abs(prev)) * 100;
    const sign = pct > 0 ? '+' : '';
    el.innerText = `${sign}${pct.toFixed(1)}%`;
    
    if (pct > 0) {
        el.className = 'value text-success';
    } else if (pct < 0) {
        el.className = 'value text-danger';
    } else {
        el.className = 'value text-secondary';
    }
}

/**
 * 2. ฟังก์ชันหน้า ปรับเป้าหมายงบประมาณ (Budget Management)
 */
function renderBudgetEditor() {
    if (!state.currentUser) return;
    
    const slidersContainer = document.getElementById('budget-sliders-container');
    slidersContainer.innerHTML = '';
    
    if (state.selectedBranch === 'all') {
        slidersContainer.innerHTML = `<div class="glass-panel text-center text-secondary" style="padding:40px 20px;">
            <i data-lucide="alert-circle" style="width:36px; height:36px; margin: 0 auto 12px auto; display:block; color:var(--color-gold);"></i>
            กรุณาเลือกสาขาที่เจาะจงเพื่อจัดการงบประมาณเป้าหมายรายสาขา
        </div>`;
        document.getElementById('btn-save-budget').disabled = true;
        document.getElementById('btn-save-budget').style.opacity = '0.5';
        return;
    }
    
    document.getElementById('btn-save-budget').disabled = false;
    document.getElementById('btn-save-budget').style.opacity = '1';
    
    const currentTxs = getFilteredTransactions(state.selectedMonth, state.selectedBranch);
    const currentFin = calculateFinancials(currentTxs);
    
    // ผลรวมค่าใช้จ่ายจริงในแต่ละหมวด
    const categorySums = {};
    currentTxs.forEach(tx => {
        if (tx.type === 'expense') {
            categorySums[tx.category] = (categorySums[tx.category] || 0) + tx.amount;
        }
    });
    
    // ดึงงบประมาณปัจจุบัน
    const currentBudget = Database.getBudgetFor(state.selectedBranch, state.selectedMonth);
    
    Object.entries(EXPENSE_CATEGORIES).forEach(([category, name]) => {
        const budgetPct = currentBudget[category] || 0;
        const actualVal = categorySums[category] || 0;
        const targetVal = Math.round(currentFin.revenue * (budgetPct / 100));
        const variance = actualVal - targetVal;
        
        const div = document.createElement('div');
        div.className = 'slider-group';
        div.innerHTML = `
            <div class="slider-label-row">
                <span class="cat-name">${name}</span>
                <div class="pct-input-wrapper">
                    <input type="number" id="budget-num-${category}" min="0" max="100" step="0.5" value="${budgetPct}">
                    <span class="text-secondary">% ของรายได้</span>
                </div>
            </div>
            <div class="slider-control-row">
                <input type="range" id="budget-range-${category}" min="0" max="80" step="0.5" value="${budgetPct}">
            </div>
            <div class="slider-info-row">
                <span>จ่ายจริงเดือนนี้: ฿${actualVal.toLocaleString()}</span>
                <span>เป้างบประมาณคำนวณ: ฿${targetVal.toLocaleString()}</span>
                <span class="var-indicator ${variance > 0 ? 'over' : 'under'}">
                    ${variance > 0 ? `เกินงบ ฿${variance.toLocaleString()}` : `เหลืองบ ฿${Math.abs(variance).toLocaleString()}`}
                </span>
            </div>
        `;
        slidersContainer.appendChild(div);
        
        // ผูกสไลเดอร์กับตัวเลขให้สัมพันธ์กันแบบ Dynamic
        const rangeInput = div.querySelector(`#budget-range-${category}`);
        const numInput = div.querySelector(`#budget-num-${category}`);
        
        rangeInput.addEventListener('input', (e) => {
            numInput.value = e.target.value;
            calculateTotalBudgetGoal();
        });
        
        numInput.addEventListener('input', (e) => {
            let val = parseFloat(e.target.value) || 0;
            if (val < 0) val = 0;
            if (val > 100) val = 100;
            rangeInput.value = val;
            calculateTotalBudgetGoal();
        });
    });
    
    calculateTotalBudgetGoal();
}

/**
 * คำนวณสรุปเป้าหมายงบประมาณและกำไรที่คาดหวังในฟอร์ม Budget Editor
 */
function calculateTotalBudgetGoal() {
    let totalPct = 0;
    
    Object.keys(EXPENSE_CATEGORIES).forEach(category => {
        const input = document.getElementById(`budget-num-${category}`);
        if (input) {
            totalPct += parseFloat(input.value) || 0;
        }
    });
    
    document.getElementById('total-budget-percentage').innerText = `${totalPct.toFixed(1)}%`;
    
    // กำไรที่คาดหวัง = 100% - งบประมาณรายจ่าย
    const expectedMargin = Math.max(0, 100 - totalPct);
    const expectedEl = document.getElementById('expected-margin-percentage');
    expectedEl.innerText = `${expectedMargin.toFixed(1)}%`;
    
    if (expectedMargin < 20) {
        expectedEl.className = 'value text-danger font-bold';
    } else {
        expectedEl.className = 'value text-gold font-bold';
    }
}

/**
 * บันทึกค่าตั้งงบประมาณรายจ่าย
 */
function saveBudgetSettings() {
    if (state.selectedBranch === 'all') return;
    
    const newCategoryBudgets = {};
    Object.keys(EXPENSE_CATEGORIES).forEach(category => {
        const input = document.getElementById(`budget-num-${category}`);
        if (input) {
            newCategoryBudgets[category] = parseFloat(input.value) || 0;
        }
    });
    
    Database.updateBudget(state.selectedBranch, state.selectedMonth, newCategoryBudgets);
    
    // โหลดดาต้าใหม่แล้วแจ้งเตือน
    loadData();
    
    // อัปเดตและแจ้งความสำเร็จ
    alert(`บันทึกเป้าหมายงบประมาณของ ${BRANCHES[state.selectedBranch].name} ประจำเดือน ${state.selectedMonth} สำเร็จ!`);
    renderDashboard();
}

/**
 * แบบจำลองการปรับแต่งงบประมาณจำลอง (What-If Simulation)
 */
function runWhatIfSimulation() {
    // ดึงรายรับและข้อมูลรายจ่ายอ้างอิงจากเดือนที่เลือก
    const currentTxs = getFilteredTransactions(state.selectedMonth, state.selectedBranch);
    const currentFin = calculateFinancials(currentTxs);
    
    const categorySums = {};
    currentTxs.forEach(tx => {
        if (tx.type === 'expense') {
            categorySums[tx.category] = (categorySums[tx.category] || 0) + tx.amount;
        }
    });
    
    const originalRaw = categorySums['raw_material'] || 0;
    const originalPkg = categorySums['packaging'] || 0;
    const originalUtils = categorySums['utilities'] || 0;
    const originalMkt = categorySums['marketing'] || 0;
    
    document.getElementById('sim-ref-revenue').innerText = `฿${currentFin.revenue.toLocaleString()}`;
    document.getElementById('sim-original-profit').innerText = `฿${currentFin.profit.toLocaleString()}`;
    
    // ตัวตรวจจับกิจกรรมการลากสไลเดอร์
    const updateSim = () => {
        const rawReductionPct = parseFloat(document.getElementById('sim-slider-raw').value) || 0;
        const pkgReductionPct = parseFloat(document.getElementById('sim-slider-pkg').value) || 0;
        const utilsReductionPct = parseFloat(document.getElementById('sim-slider-utils').value) || 0;
        const mktReductionPct = parseFloat(document.getElementById('sim-slider-mkt').value) || 0;
        
        // แสดงเปอร์เซ็นต์ที่ปรับลง
        document.getElementById('sim-raw-material-pct').innerText = `-${rawReductionPct.toFixed(1)}%`;
        document.getElementById('sim-packaging-pct').innerText = `-${pkgReductionPct.toFixed(0)}%`;
        document.getElementById('sim-utilities-pct').innerText = `-${utilsReductionPct.toFixed(1)}%`;
        document.getElementById('sim-marketing-pct').innerText = `-${mktReductionPct.toFixed(0)}%`;
        
        // คำนวณส่วนลด
        const rawSavings = originalRaw * (rawReductionPct / 100);
        const pkgSavings = originalPkg * (pkgReductionPct / 100);
        const utilsSavings = originalUtils * (utilsReductionPct / 100);
        const mktSavings = originalMkt * (mktReductionPct / 100);
        
        const totalSavings = rawSavings + pkgSavings + utilsSavings + mktSavings;
        const simulatedProfit = currentFin.profit + totalSavings;
        
        document.getElementById('sim-new-profit').innerText = `฿${Math.round(simulatedProfit).toLocaleString()}`;
        document.getElementById('sim-profit-gain').innerText = `+฿${Math.round(totalSavings).toLocaleString()}`;
    };
    
    // ผูก Event Listeners
    document.getElementById('sim-slider-raw').addEventListener('input', updateSim);
    document.getElementById('sim-slider-pkg').addEventListener('input', updateSim);
    document.getElementById('sim-slider-utils').addEventListener('input', updateSim);
    document.getElementById('sim-slider-mkt').addEventListener('input', updateSim);
    
    // รีเซ็ตค่าสไลเดอร์
    document.getElementById('sim-slider-raw').value = 0;
    document.getElementById('sim-slider-pkg').value = 0;
    document.getElementById('sim-slider-utils').value = 0;
    document.getElementById('sim-slider-mkt').value = 0;
    
    updateSim();
}

/**
 * 3. ฟังก์ชันหน้า จัดการธุรกรรม (Transaction Manager View)
 */
function populateFilterCategories() {
    const select = document.getElementById('tx-filter-category');
    select.innerHTML = '<option value="all">ทุกหมวดหมู่ธุรกรรม</option>';
    
    // ใส่ช่องทางรายรับ
    const optGroupIncome = document.createElement('optgroup');
    optGroupIncome.label = 'ช่องทางรายรับ';
    Object.entries(SALE_CHANNELS).forEach(([val, name]) => {
        const option = document.createElement('option');
        option.value = `income_${val}`;
        option.innerText = name;
        optGroupIncome.appendChild(option);
    });
    select.appendChild(optGroupIncome);
    
    // ใส่หมวดหมู่รายจ่าย
    const optGroupExpense = document.createElement('optgroup');
    optGroupExpense.label = 'หมวดหมู่รายจ่าย';
    Object.entries(EXPENSE_CATEGORIES).forEach(([val, name]) => {
        const option = document.createElement('option');
        option.value = `expense_${val}`;
        option.innerText = name;
        optGroupExpense.appendChild(option);
    });
    select.appendChild(optGroupExpense);
}

function renderTransactionsTable() {
    if (!state.currentUser) return;
    
    const tableBody = document.getElementById('transactions-table-body');
    tableBody.innerHTML = '';
    
    // 1. ดึงรายการธุรกรรมที่กรองตามเดือนและสาขาที่เลือกหลัก
    let filteredTxs = getFilteredTransactions(state.selectedMonth, state.selectedBranch);
    
    // 2. นำฟิลเตอร์ในหน้าจอตารางมาคัดกรองเพิ่ม
    const searchQuery = document.getElementById('tx-search-input').value.toLowerCase().trim();
    const typeFilter = document.getElementById('tx-filter-type').value;
    const catFilter = document.getElementById('tx-filter-category').value;
    
    if (typeFilter !== 'all') {
        filteredTxs = filteredTxs.filter(tx => tx.type === typeFilter);
    }
    
    if (catFilter !== 'all') {
        if (catFilter.startsWith('income_')) {
            const ch = catFilter.replace('income_', '');
            filteredTxs = filteredTxs.filter(tx => tx.type === 'income' && tx.channel === ch);
        } else if (catFilter.startsWith('expense_')) {
            const cat = catFilter.replace('expense_', '');
            filteredTxs = filteredTxs.filter(tx => tx.type === 'expense' && tx.category === cat);
        }
    }
    
    if (searchQuery !== '') {
        filteredTxs = filteredTxs.filter(tx => {
            const desc = tx.description.toLowerCase();
            const id = tx.id.toLowerCase();
            const amount = tx.amount.toString();
            return desc.includes(searchQuery) || id.includes(searchQuery) || amount.includes(searchQuery);
        });
    }
    
    // จัดเรียงรายการธุรกรรมตามวันที่ ยอดล่าสุดขึ้นก่อน
    filteredTxs.sort((a, b) => b.date.localeCompare(a.date));
    
    // 3. ทำระบบแบ่งหน้า (Pagination)
    const totalItems = filteredTxs.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / state.txLimit));
    
    if (state.txPage > totalPages) {
        state.txPage = totalPages;
    }
    
    const startIndex = (state.txPage - 1) * state.txLimit;
    const endIndex = Math.min(startIndex + state.txLimit, totalItems);
    const paginatedTxs = filteredTxs.slice(startIndex, endIndex);
    
    const canEdit = state.currentUser.username === 'aom' || state.currentUser.username === 'pon';
    const manageHeader = document.querySelector('#transactions-table th:last-child');
    if (manageHeader) {
        if (canEdit) {
            manageHeader.style.display = '';
        } else {
            manageHeader.style.display = 'none';
        }
    }

    if (paginatedTxs.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="${canEdit ? 8 : 7}" class="text-center text-secondary" style="padding: 40px 0;">ไม่พบข้อมูลธุรกรรมตามเงื่อนไขที่กำหนด</td></tr>`;
        renderPaginationControls(totalItems, totalPages);
        return;
    }
    
    paginatedTxs.forEach(tx => {
        const tr = document.createElement('tr');
        
        let typeBadge = '';
        let categoryName = '';
        
        if (tx.type === 'income') {
            typeBadge = `<span class="badge badge-success">รายรับ</span>`;
            categoryName = SALE_CHANNELS[tx.channel] || tx.channel;
        } else {
            typeBadge = `<span class="badge badge-danger">รายจ่าย</span>`;
            categoryName = EXPENSE_CATEGORIES[tx.category] || tx.category;
        }
        
        const branchName = BRANCHES[tx.branchId] ? BRANCHES[tx.branchId].name : tx.branchId;
        
        let actionCell = '';
        if (canEdit) {
            actionCell = `
                <td class="text-center">
                    <button class="btn-delete-tx" onclick="handleDeleteTransaction('${tx.id}')">
                        <i data-lucide="trash-2"></i>
                    </button>
                </td>
            `;
        }
        
        tr.innerHTML = `
            <td class="font-semibold text-secondary">${tx.id}</td>
            <td>${tx.date}</td>
            <td>${branchName}</td>
            <td>${typeBadge}</td>
            <td class="font-semibold">${categoryName}</td>
            <td class="text-right font-bold ${tx.type === 'income' ? 'text-success' : 'text-gold'}">
                ${tx.type === 'income' ? '+' : '-'}฿${tx.amount.toLocaleString()}
            </td>
            <td class="text-secondary" style="max-width:250px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${tx.description}">
                ${tx.description}
            </td>
            ${actionCell}
        `;
        tableBody.appendChild(tr);
    });
    
    renderPaginationControls(totalItems, totalPages);
    if (window.lucide) {
        lucide.createIcons();
    }
}

function renderPaginationControls(totalItems, totalPages) {
    const container = document.getElementById('tx-pagination-container');
    container.innerHTML = '';
    
    if (totalItems === 0) return;
    
    const startIndex = (state.txPage - 1) * state.txLimit + 1;
    const endIndex = Math.min(startIndex + state.txLimit - 1, totalItems);
    
    container.innerHTML = `
        <div class="pagination-info">
            แสดงรายการที่ ${startIndex}-${endIndex} จากทั้งหมด ${totalItems} รายการ
        </div>
        <div class="pagination-buttons">
            <button class="btn-page" id="btn-prev-page" ${state.txPage === 1 ? 'disabled' : ''}>
                <i data-lucide="chevron-left" class="inline-icon"></i> ก่อนหน้า
            </button>
            <span style="align-self:center; font-size:0.9rem; color:var(--color-secondary);">หน้า ${state.txPage} / ${totalPages}</span>
            <button class="btn-page" id="btn-next-page" ${state.txPage === totalPages ? 'disabled' : ''}>
                ถัดไป <i data-lucide="chevron-right" class="inline-icon"></i>
            </button>
        </div>
    `;
    
    // ผูก Event
    const prevBtn = document.getElementById('btn-prev-page');
    const nextBtn = document.getElementById('btn-next-page');
    
    if (prevBtn) {
        prevBtn.onclick = () => {
            state.txPage--;
            renderTransactionsTable();
        };
    }
    if (nextBtn) {
        nextBtn.onclick = () => {
            state.txPage++;
            renderTransactionsTable();
        };
    }
    if (window.lucide) {
        lucide.createIcons();
    }
}

/**
 * ลบธุรกรรม
 */
function handleDeleteTransaction(txId) {
    const canEdit = state.currentUser.username === 'aom' || state.currentUser.username === 'pon';
    if (!canEdit) {
        alert('คุณไม่มีสิทธิ์ในการลบรายการธุรกรรม!');
        return;
    }
    if (confirm(`คุณต้องการลบรายการธุรกรรม ${txId} ใช่หรือไม่?`)) {
        Database.deleteTransaction(txId);
        loadData();
        renderTransactionsTable();
        
        // หากลบจากหน้าอื่น ก็มีผลกับ Dashboard ทันที
        if (state.currentPage === 'dashboard') {
            renderDashboard();
        }
    }
}

/**
 * 4. หน้าโครงสร้างผู้ถือหุ้นและผลปันผล (Shareholder view)
 */
function renderShareholdersInfo() {
    if (!state.currentUser) return;
    
    const tableBody = document.getElementById('shareholders-table-body');
    tableBody.innerHTML = '';
    
    const branchTitle = document.getElementById('sh-branch-title');
    const branchDesc = document.getElementById('sh-branch-desc');
    
    if (state.selectedBranch === 'all') {
        branchTitle.innerText = 'ผลตอบแทนผู้ถือหุ้น (ภาพรวมทุกสาขา)';
        branchDesc.innerText = 'แสดงส่วนแบ่งกำไรสุทธิเฉลี่ยของคุณและหุ้นส่วนจากทุกสาขาที่ได้รับอนุญาตเข้าถึง';
        
        // คำนวณรายชื่อผู้ถือหุ้นทั้งหมดที่มีสิทธิ์ในสาขาต่างๆ
        const allShareholders = new Set();
        state.currentUser.permittedBranches.forEach(bId => {
            Object.keys(BRANCHES[bId].shareholders).forEach(u => allShareholders.add(u));
        });
        
        // วนลูปคำนวณยอดเงินแต่ละคน
        Array.from(allShareholders).forEach(username => {
            const userObj = USERS[username];
            let totalProfitAccumulated = 0;
            let currentMonthDividend = 0;
            
            state.currentUser.permittedBranches.forEach(bId => {
                const branch = BRANCHES[bId];
                const pct = branch.shareholders[username] || 0;
                if (pct === 0) return;
                
                // คำนวณกำไรสะสมทั้งหมดตั้งแต่ ม.ค. 2025
                const allTxs = state.transactions.filter(t => t.branchId === bId);
                const allFin = calculateFinancials(allTxs);
                totalProfitAccumulated += allFin.profit * (pct / 100);
                
                // ปันผลเดือนปัจจุบัน
                const curTxs = getFilteredTransactions(state.selectedMonth, bId);
                const curFin = calculateFinancials(curTxs);
                currentMonthDividend += curFin.profit * (pct / 100);
            });
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div class="mock-account-btn no-bg no-padding" style="border:none;">
                        <div class="avatar">${userObj.name.charAt(0)}</div>
                        <div class="account-info">
                            <span class="name">${userObj.name}</span>
                            <span class="role">สิทธิ์เข้าถึง: ${userObj.permittedBranches.length} สาขา</span>
                        </div>
                    </div>
                </td>
                <td class="text-center text-secondary">- (หลายสาขา)</td>
                <td class="text-right font-semibold">฿${Math.round(totalProfitAccumulated).toLocaleString()}</td>
                <td class="text-right font-bold text-gold">฿${Math.round(currentMonthDividend).toLocaleString()}</td>
            `;
            tableBody.appendChild(tr);
        });
        
        // อัปเดตข้อมูลส่วนตัวขวา
        const myCombinedFin = calculateUserShare('all', 0, 0, 0); // โหลดสะสมปันผลทุกสาขา
        document.getElementById('sh-personal-branch').innerText = 'รวมทุกสาขาที่มีสิทธิ์';
        document.getElementById('sh-personal-pct').innerText = 'หลากหลาย %';
        
        // ค้นหาของตัวเอง
        let totalMyRevenue = 0;
        let totalMyExpense = 0;
        state.currentUser.permittedBranches.forEach(bId => {
            const bTxs = getFilteredTransactions(state.selectedMonth, bId);
            const bFin = calculateFinancials(bTxs);
            const myPct = BRANCHES[bId].shareholders[state.currentUser.username] || 0;
            totalMyRevenue += bFin.revenue * (myPct / 100);
            totalMyExpense += bFin.expense * (myPct / 100);
        });
        
        document.getElementById('sh-personal-revenue').innerText = `฿${Math.round(totalMyRevenue).toLocaleString()}`;
        document.getElementById('sh-personal-expense').innerText = `฿${Math.round(totalMyExpense).toLocaleString()}`;
        document.getElementById('sh-personal-profit').innerText = `฿${Math.round(myCombinedFin.profit).toLocaleString()}`;
        
    } else {
        const branch = BRANCHES[state.selectedBranch];
        branchTitle.innerText = `โครงสร้างหุ้นและผลตอบแทน - ${branch.name}`;
        branchDesc.innerText = `แสดงสัดส่วนผู้ถือหุ้นและปันผลสุทธิของ ${branch.name} ในช่วงเวลาที่วิเคราะห์`;
        
        // คำนวณปันผลเฉพาะสาขานี้
        Object.entries(branch.shareholders).forEach(([username, pct]) => {
            const userObj = USERS[username];
            
            // คำนวณสะสม
            const allTxs = state.transactions.filter(t => t.branchId === state.selectedBranch);
            const allFin = calculateFinancials(allTxs);
            const accumulatedShare = allFin.profit * (pct / 100);
            
            // เดือนปัจจุบัน
            const curTxs = getFilteredTransactions(state.selectedMonth, state.selectedBranch);
            const curFin = calculateFinancials(curTxs);
            const monthDividend = curFin.profit * (pct / 100);
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div class="mock-account-btn no-bg no-padding" style="border:none;">
                        <div class="avatar">${userObj.name.charAt(0)}</div>
                        <div class="account-info">
                            <span class="name">${userObj.name}</span>
                            <span class="role">สิทธิ์: ${userObj.permittedBranches.includes(state.selectedBranch) ? 'เข้าดูได้' : 'จำกัดสิทธิ์'}</span>
                        </div>
                    </div>
                </td>
                <td class="text-center font-semibold text-white">${pct}%</td>
                <td class="text-right font-semibold">฿${Math.round(accumulatedShare).toLocaleString()}</td>
                <td class="text-right font-bold text-gold">฿${Math.round(monthDividend).toLocaleString()}</td>
            `;
            tableBody.appendChild(tr);
        });
        
        // อัปเดตการ์ดส่วนตัวทางขวา
        const curTxs = getFilteredTransactions(state.selectedMonth, state.selectedBranch);
        const curFin = calculateFinancials(curTxs);
        const myPct = branch.shareholders[state.currentUser.username] || 0;
        
        document.getElementById('sh-personal-branch').innerText = branch.name;
        document.getElementById('sh-personal-pct').innerText = `${myPct}%`;
        document.getElementById('sh-personal-revenue').innerText = `฿${Math.round(curFin.revenue * (myPct / 100)).toLocaleString()}`;
        document.getElementById('sh-personal-expense').innerText = `฿${Math.round(curFin.expense * (myPct / 100)).toLocaleString()}`;
        document.getElementById('sh-personal-profit').innerText = `฿${Math.round(curFin.profit * (myPct / 100)).toLocaleString()}`;
    }
}

/**
 * 5. ฟังก์ชันการดาวน์โหลดตารางข้อมูลเป็น CSV (Export CSV)
 */
function downloadCSV() {
    let list = getFilteredTransactions(state.selectedMonth, state.selectedBranch);
    
    // เรียงวันที่เก่าไปใหม่สำหรับการทำบัญชี
    list.sort((a, b) => a.date.localeCompare(b.date));
    
    // สร้างหัวตาราง CSV (เพิ่ม BOM เพื่อไม่ให้ภาษาไทยแสดงผลเพี้ยนใน Excel)
    let csvContent = "\uFEFF";
    csvContent += "ID,วันที่,สาขา,ประเภทธุรกรรม,หมวดหมู่/ช่องทาง,จำนวนเงิน (บาท),คำอธิบายเพิ่มเติม\n";
    
    list.forEach(tx => {
        const branchName = BRANCHES[tx.branchId] ? BRANCHES[tx.branchId].name : tx.branchId;
        const typeName = tx.type === 'income' ? 'รายรับ' : 'รายจ่าย';
        const categoryName = tx.type === 'income' ? SALE_CHANNELS[tx.channel] : EXPENSE_CATEGORIES[tx.category];
        const descClean = tx.description.replace(/"/g, '""'); // ป้องกันเบรกฟิลด์
        
        csvContent += `"${tx.id}","${tx.date}","${branchName}","${typeName}","${categoryName}",${tx.amount},"${descClean}"\n`;
    });
    
    // สร้างดาวน์โหลดผ่าน Browser
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    const branchSuffix = state.selectedBranch === 'all' ? 'all-branches' : state.selectedBranch;
    
    link.setAttribute("href", url);
    link.setAttribute("download", `pom_khor_thod_pnl_${branchSuffix}_${state.selectedMonth}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * 6. ระบบยืนยันตัวตน Login & Logout Handlers
 */
function quickLogin(username) {
    try {
        const user = USERS[username];
        if (user) {
            state.currentUser = user;
            localStorage.setItem('pkt_logged_in_user', username);
            bootApp();
        }
    } catch (err) {
        console.error("quickLogin Error:", err);
        alert("เกิดข้อผิดพลาดในการเข้าสู่ระบบ: " + (err.message || err));
    }
}



// ผูกฟังก์ชันสำหรับการใช้ในปุ่มลบในตารางแบบ Inline
window.handleDeleteTransaction = handleDeleteTransaction;
window.quickLogin = quickLogin;

// ตัวแปรส่วนประสานงาน Modal (จะถูกอ้างอิงหลังจาก DOM โหลดเสร็จ)
let modal, btnOpenModal, btnCloseModal, btnCancelModal, radioIncome, radioExpense, txChannelContainer, txCategoryContainer;

function openModal() {
    modal = modal || document.getElementById('add-tx-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('active');
    }
    
    // ตรวจสอบและเติมรายชื่อสาขาให้พร้อมเสมอ
    const branchSelect = document.getElementById('tx-branch');
    if (branchSelect && (branchSelect.options.length === 0 || !branchSelect.value)) {
        branchSelect.innerHTML = '';
        const allowed = (state.currentUser && state.currentUser.permittedBranches) ? state.currentUser.permittedBranches : ['ladprao', 'thepharak', 'muangthong', 'pinklao'];
        allowed.forEach(branchId => {
            const branch = BRANCHES[branchId];
            if (branch) {
                const opt = document.createElement('option');
                opt.value = branchId;
                opt.innerText = branch.name;
                branchSelect.appendChild(opt);
            }
        });
        if (state.selectedBranch && state.selectedBranch !== 'all') {
            branchSelect.value = state.selectedBranch;
        }
    }
    
    // ตั้งค่าวันที่ปัจจุบันเสมอถ้ายังไม่มีค่า
    const dateInput = document.getElementById('tx-date');
    if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }
}

function closeModal() {
    modal = modal || document.getElementById('add-tx-modal');
    if (modal) {
        modal.classList.remove('active');
    }
    const form = document.getElementById('add-tx-form');
    if (form) form.reset();
    
    // รีเซ็ต dropdown ซ่อน/แสดง
    txChannelContainer = txChannelContainer || document.getElementById('tx-channel-container');
    txCategoryContainer = txCategoryContainer || document.getElementById('tx-category-container');
    if (txChannelContainer) txChannelContainer.classList.remove('hidden');
    if (txCategoryContainer) txCategoryContainer.classList.add('hidden');
    
    // เติมวันปัจจุบันกลับคืน
    const today = new Date().toISOString().split('T')[0];
    const txDateEl = document.getElementById('tx-date');
    if (txDateEl) txDateEl.value = today;
}

function handleTxTypeChange() {
    const radioIncomeEl = document.getElementById('radio-income');
    const txChannelContainer = document.getElementById('tx-channel-container');
    const txCategoryContainer = document.getElementById('tx-category-container');
    
    const isIncome = radioIncomeEl ? radioIncomeEl.checked : true;
    if (txChannelContainer) {
        if (isIncome) txChannelContainer.classList.remove('hidden');
        else txChannelContainer.classList.add('hidden');
    }
    if (txCategoryContainer) {
        if (!isIncome) txCategoryContainer.classList.remove('hidden');
        else txCategoryContainer.classList.add('hidden');
    }
}

// ==========================================
// BULK IMPORT LOGIC (Google Sheets / CSV)
// ==========================================
let pendingImportTransactions = [];

function openImportModal() {
    const importModal = document.getElementById('import-tx-modal');
    if (importModal) {
        importModal.classList.remove('hidden');
        importModal.classList.add('active');
    }
    // รีเซ็ตค่า
    pendingImportTransactions = [];
    const pasteArea = document.getElementById('import-paste-area');
    if (pasteArea) pasteArea.value = '';
    const previewBox = document.getElementById('import-preview-box');
    if (previewBox) previewBox.classList.add('hidden');
    const countBadge = document.getElementById('import-count-badge');
    if (countBadge) countBadge.classList.add('hidden');
    const confirmBtn = document.getElementById('btn-confirm-import');
    if (confirmBtn) confirmBtn.disabled = true;
    switchImportTab('paste');
    if (window.lucide) lucide.createIcons();
}

function closeImportModal() {
    const importModal = document.getElementById('import-tx-modal');
    if (importModal) {
        importModal.classList.remove('active');
    }
}

function switchImportTab(tab) {
    const pasteTab = document.getElementById('import-tab-paste');
    const fileTab = document.getElementById('import-tab-file');
    const btnPaste = document.getElementById('tab-btn-paste');
    const btnFile = document.getElementById('tab-btn-file');
    
    if (tab === 'paste') {
        if (pasteTab) pasteTab.classList.remove('hidden');
        if (fileTab) fileTab.classList.add('hidden');
        if (btnPaste) btnPaste.classList.add('active');
        if (btnFile) btnFile.classList.remove('active');
    } else {
        if (pasteTab) pasteTab.classList.add('hidden');
        if (fileTab) fileTab.classList.remove('hidden');
        if (btnPaste) btnPaste.classList.remove('active');
        if (btnFile) btnFile.classList.add('active');
    }
    if (window.lucide) lucide.createIcons();
}

// ตัวช่วยแปลงวันที่
function parseDateString(rawDate) {
    if (!rawDate) return '';
    rawDate = rawDate.trim().replace(/\s+/g, '');
    
    // รูปแบบ YYYY-MM-DD
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(rawDate)) {
        const parts = rawDate.split('-');
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    // รูปแบบ YYYY/MM/DD
    if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(rawDate)) {
        const parts = rawDate.split('/');
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    // รูปแบบ DD/MM/YY หรือ DD/MM/YYYY
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(rawDate)) {
        const parts = rawDate.split('/');
        let day = parts[0].padStart(2, '0');
        let month = parts[1].padStart(2, '0');
        let year = parts[2];
        if (year.length === 2) {
            year = `20${year}`;
        }
        return `${year}-${month}-${day}`;
    }
    return rawDate;
}

// ตัวช่วยจับคู่รหัสสาขา
function parseBranchId(rawBranch) {
    if (!rawBranch) return 'ladprao';
    const b = rawBranch.trim().toLowerCase();
    if (b.includes('lad') || b.includes('ลาดพร้าว') || b.includes('b1')) return 'ladprao';
    if (b.includes('thep') || b.includes('เทพรักษ์') || b.includes('b2')) return 'thepharak';
    if (b.includes('muang') || b.includes('เมืองทอง') || b.includes('b3')) return 'muangthong';
    if (b.includes('pink') || b.includes('ปิ่นเกล้า') || b.includes('b4')) return 'pinklao';
    return 'ladprao';
}

// ตัวช่วยจับคู่ช่องทางหรือหมวดหมู่
function parseChannelOrCategory(rawStr, type) {
    if (!rawStr) return type === 'income' ? 'storefront' : 'others';
    const s = rawStr.trim().toLowerCase();
    
    if (type === 'income') {
        if (s.includes('หน้าร้าน') || s.includes('store')) return 'storefront';
        if (s.includes('line') || s.includes('ไลน์')) return 'lineman';
        if (s.includes('grab') || s.includes('แกร็บ')) return 'grab';
        if (s.includes('shopee') || s.includes('ช้อป')) return 'shopee';
        if (s.includes('dot') || s.includes('ดอท')) return 'dotdash';
        return 'storefront';
    } else {
        if (s.includes('วัตถุดิบ') || s.includes('raw')) return 'raw_material';
        if (s.includes('เงินเดือน') || s.includes('จ้าง') || s.includes('salary')) return 'salary';
        if (s.includes('เช่า') || s.includes('rent')) return 'rent';
        if (s.includes('น้ำ') || s.includes('ไฟ') || s.includes('util')) return 'utilities';
        if (s.includes('ตลาด') || s.includes('market') || s.includes('โฆษณา')) return 'marketing';
        if (s.includes('บรรจุ') || s.includes('pack')) return 'packaging';
        if (s.includes('gp') || s.includes('คอมมิชชั่น') || s.includes('commission') || s.includes('จีพี')) return 'gp';
        return 'others';
    }
}

// Smart Parser ฟังก์ชันแปลงข้อมูลข้อความ
function parseImportText(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return [];
    
    const parsedTxs = [];
    
    // ตรวจสอบว่าบรรทัดแรกเป็นหัวตารางหรือไม่
    let startIdx = 0;
    const firstLine = lines[0];
    const isHeader = /date|วันที่|branch|สาขา|หน้าร้าน|lineman|grab|shopee|รายรับ|รายจ่าย/i.test(firstLine);
    
    // ตรวจสอบว่าเป็นแบบ Multi-channel Matrix (ตารางยอดขาย) หรือ Ledger (ตารางรายรับรายจ่ายปกติ)
    const isChannelMatrix = /หน้าร้าน|lineman|grab|shopee|dotdash/i.test(firstLine);
    
    if (isHeader) {
        startIdx = 1;
    }
    
    // หา Delimiter (Tab หรือ Comma)
    const delimiter = firstLine.includes('\t') ? '\t' : ',';
    
    if (isChannelMatrix) {
        // ตารางสรุปยอดขายแยกช่องทาง
        // เช่น Date, Branch, หน้าร้าน, Lineman, Grab, Shopee, Dotdash
        const headerCols = firstLine.split(delimiter).map(c => c.trim().toLowerCase());
        
        for (let i = startIdx; i < lines.length; i++) {
            const cols = lines[i].split(delimiter).map(c => c.trim());
            if (cols.length < 3) continue;
            
            const date = parseDateString(cols[0]);
            const branchId = parseBranchId(cols[1]);
            
            for (let c = 2; c < cols.length; c++) {
                const colName = headerCols[c] || `col${c}`;
                const rawAmount = cols[c].replace(/[,\s฿]/g, '');
                const amount = parseFloat(rawAmount);
                
                if (!isNaN(amount) && amount > 0) {
                    const channel = parseChannelOrCategory(colName, 'income');
                    parsedTxs.push({
                        branchId: branchId,
                        date: date,
                        type: 'income',
                        category: 'income',
                        channel: channel,
                        amount: amount,
                        description: `ยอดขายประจำวัน ช่องทาง ${SALE_CHANNELS[channel] || channel} (นำเข้าจาก Google Sheets)`
                    });
                }
            }
        }
    } else {
        // ตารางบันทึกทั่วไป (Ledger format)
        // เช่น วันที่, สาขา, ประเภท, หมวดหมู่/ช่องทาง, จำนวนเงิน, รายละเอียด
        for (let i = startIdx; i < lines.length; i++) {
            const cols = lines[i].split(delimiter).map(c => c.trim());
            if (cols.length < 4) continue;
            
            const date = parseDateString(cols[0]);
            const branchId = parseBranchId(cols[1]);
            const rawType = cols[2].toLowerCase();
            const type = (rawType.includes('จ่าย') || rawType.includes('exp')) ? 'expense' : 'income';
            const catOrChannelRaw = cols[3];
            const rawAmount = (cols[4] || '').replace(/[,\s฿]/g, '');
            const amount = parseFloat(rawAmount);
            const desc = cols[5] || (type === 'income' ? 'รายรับนำเข้า' : 'รายจ่ายนำเข้า');
            
            if (!isNaN(amount) && amount > 0) {
                if (type === 'income') {
                    const channel = parseChannelOrCategory(catOrChannelRaw, 'income');
                    parsedTxs.push({
                        branchId: branchId,
                        date: date,
                        type: 'income',
                        category: 'income',
                        channel: channel,
                        amount: amount,
                        description: desc
                    });
                } else {
                    const category = parseChannelOrCategory(catOrChannelRaw, 'expense');
                    parsedTxs.push({
                        branchId: branchId,
                        date: date,
                        type: 'expense',
                        category: category,
                        channel: null,
                        amount: amount,
                        description: desc
                    });
                }
            }
        }
    }
    
    return parsedTxs;
}

function parseAndPreviewImport() {
    const pasteArea = document.getElementById('import-paste-area');
    const rawText = pasteArea ? pasteArea.value : '';
    
    if (!rawText.trim()) {
        alert('กรุณาวางข้อมูลจาก Google Sheets หรือ CSV ก่อนกดตรวจสอบ');
        return;
    }
    
    pendingImportTransactions = parseImportText(rawText);
    
    const previewBox = document.getElementById('import-preview-box');
    const previewBody = document.getElementById('import-preview-body');
    const countBadge = document.getElementById('import-count-badge');
    const confirmBtn = document.getElementById('btn-confirm-import');
    
    if (pendingImportTransactions.length === 0) {
        alert('ไม่พบรายการที่ถูกต้อง กรุณาตรวจสอบรูปแบบตารางข้อมูล');
        if (previewBox) previewBox.classList.add('hidden');
        if (countBadge) countBadge.classList.add('hidden');
        if (confirmBtn) confirmBtn.disabled = true;
        return;
    }
    
    // เติมข้อมูลลงตารางพรีวิว
    if (previewBody) {
        previewBody.innerHTML = '';
        // แสดงสูงสุด 50 รายการแรกเพื่อความเร็ว
        const showList = pendingImportTransactions.slice(0, 50);
        showList.forEach((tx, idx) => {
            const tr = document.createElement('tr');
            const branchName = BRANCHES[tx.branchId] ? BRANCHES[tx.branchId].name : tx.branchId;
            const typeText = tx.type === 'income' ? '<span class="badge badge-success">รายรับ</span>' : '<span class="badge badge-warning">รายจ่าย</span>';
            const catText = tx.type === 'income' ? (SALE_CHANNELS[tx.channel] || tx.channel) : (EXPENSE_CATEGORIES[tx.category] || tx.category);
            
            tr.innerHTML = `
                <td class="text-secondary">${idx + 1}</td>
                <td>${tx.date}</td>
                <td>${branchName}</td>
                <td>${typeText}</td>
                <td>${catText}</td>
                <td class="text-right font-bold ${tx.type === 'income' ? 'text-success' : 'text-gold'}">฿${tx.amount.toLocaleString()}</td>
                <td class="text-secondary" style="max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${tx.description}</td>
            `;
            previewBody.appendChild(tr);
        });
        
        if (pendingImportTransactions.length > 50) {
            const trMore = document.createElement('tr');
            trMore.innerHTML = `<td colspan="7" class="text-center text-secondary" style="padding:10px;">...และอีก ${pendingImportTransactions.length - 50} รายการ...</td>`;
            previewBody.appendChild(trMore);
        }
    }
    
    if (previewBox) previewBox.classList.remove('hidden');
    if (countBadge) {
        countBadge.innerText = `ตรวจพบ ${pendingImportTransactions.length} รายการ`;
        countBadge.classList.remove('hidden');
    }
    if (confirmBtn) confirmBtn.disabled = false;
}

function confirmBulkImport() {
    const canEdit = state.currentUser.username === 'aom' || state.currentUser.username === 'pon';
    if (!canEdit) {
        alert('คุณไม่มีสิทธิ์ในการบันทึกหรือนำเข้าข้อมูลธุรกรรม!');
        closeImportModal();
        return;
    }
    
    if (pendingImportTransactions.length === 0) {
        alert('ไม่มีรายการข้อมูลที่จะนำเข้า');
        return;
    }
    
    const count = pendingImportTransactions.length;
    Database.addBulkTransactions(pendingImportTransactions);
    
    // โหลดข้อมูลใหม่และรีเฟรชหน้าจอ
    loadData();
    if (state.currentPage === 'dashboard') {
        renderDashboard();
    } else if (state.currentPage === 'transactions') {
        renderTransactionsTable();
    }
    
    closeImportModal();
    alert(`🎉 นำเข้าข้อมูลธุรกรรมสำเร็จเรียบร้อยแล้วทั้งหมด ${count} รายการ!`);
}

// ==========================================
// THEME LOGIC (Exclusive Premium Dark Theme)
// ==========================================
function applyTheme(theme = 'dark') {
    document.body.classList.remove('light-theme');
    document.body.classList.add('dark-theme');
    localStorage.setItem('pkt_theme', 'dark');
}

function toggleTheme() {
    applyTheme('dark');
}

function updateThemeUI(theme) {
    // โหมด Dark Theme ตัวเดียว
}

// ==========================================
// CLOUDFLARE D1 DATABASE INTEGRATION
// ==========================================
async function initCloudflareStatus() {
    const statusDot = document.getElementById('db-status-dot');
    const statusText = document.getElementById('db-status-text');
    if (!statusDot || !statusText) return;

    try {
        const { connected, info } = await CloudflareAdapter.checkConnection();
        if (connected) {
            statusDot.className = 'status-dot online';
            statusText.innerText = `⚡ Cloudflare D1: เชื่อมต่อแล้ว (${info.transactionsCount || 0} รายการ)`;
            
            // ดึงข้อมูลล่าสุดจาก Cloudflare D1 หากมีข้อมูล
            const remoteTxs = await CloudflareAdapter.fetchTransactions();
            if (remoteTxs && remoteTxs.length > 0) {
                state.transactions = remoteTxs;
                Database.saveTransactions(remoteTxs);
            }
            
            const remoteBudgets = await CloudflareAdapter.fetchBudgets();
            if (remoteBudgets && remoteBudgets.length > 0) {
                state.budgets = remoteBudgets;
                Database.saveBudgets(remoteBudgets);
            }
            
            if (state.currentUser && state.currentPage === 'dashboard') {
                renderDashboard();
            }
        } else {
            statusDot.className = 'status-dot offline';
            statusText.innerText = '💾 LocalStorage (Offline Mode)';
        }
    } catch (e) {
        statusDot.className = 'status-dot offline';
        statusText.innerText = '💾 LocalStorage (Offline Mode)';
    }
}

async function syncDataToCloudflare() {
    const btn = document.getElementById('btn-sync-cloudflare');
    const originalText = btn ? btn.innerHTML : '';
    
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = 'กำลัง Sync ข้อมูล...';
    }

    try {
        const txs = Database.getTransactions();
        const budgets = Database.getBudgets();
        const res = await CloudflareAdapter.syncAllToCloudflare(txs, budgets);
        alert(`🎉 สำเร็จ! ${res.message || 'Sync ข้อมูลขึ้น Cloudflare D1 เรียบร้อยแล้ว'}`);
        await initCloudflareStatus();
    } catch (err) {
        alert(`ℹ️ สรุปสถานะการเชื่อมต่อ:\nปัจจุบันรันบนเครื่อง Local (Offline Mode) ซึ่งใช้ LocalStorage อย่างสมบูรณ์\n\nเมื่อนำโปรเจกต์นี้ Deploy ขึ้นสู่ Cloudflare Pages และ Bind ฐานข้อมูล D1 แล้ว ปุ่มนี้จะทำการอัปโหลดข้อมูลเข้าสู่ Edge SQL Database ของ Cloudflare ทันทีครับ!`);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
            if (window.lucide) lucide.createIcons();
        }
    }
}

function applyStoreLogos() {
    const logoSrc = window.STORE_LOGO_BASE64 || 'logo.png';
    document.querySelectorAll('.brand-logo-img, .brand-logo-img-sidebar, .profile-logo-img').forEach(img => {
        if (img) {
            img.src = logoSrc;
            img.onerror = function() {
                if (window.STORE_LOGO_BASE64) {
                    this.src = window.STORE_LOGO_BASE64;
                }
            };
        }
    });
}

window.openModal = openModal;
window.closeModal = closeModal;
window.handleTxTypeChange = handleTxTypeChange;
window.openImportModal = openImportModal;
window.closeImportModal = closeImportModal;
window.switchImportTab = switchImportTab;
window.parseAndPreviewImport = parseAndPreviewImport;
window.confirmBulkImport = confirmBulkImport;
window.toggleTheme = toggleTheme;
window.applyTheme = applyTheme;
window.syncDataToCloudflare = syncDataToCloudflare;
window.initCloudflareStatus = initCloudflareStatus;
window.applyStoreLogos = applyStoreLogos;
window.submitAddTransaction = submitAddTransaction;

function submitAddTransaction(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    const username = (state.currentUser && state.currentUser.username ? state.currentUser.username : '').toLowerCase();
    const canEdit = !state.currentUser || username === 'aom' || username === 'pon' || (state.currentUser.permittedBranches && state.currentUser.permittedBranches.length === 4);
    
    if (!canEdit) {
        alert('⚠️ คุณไม่มีสิทธิ์ในการบันทึกธุรกรรมใหม่ (สงวนสิทธิ์สำหรับ Aom และ Pon)');
        closeModal();
        return;
    }
    
    const branchEl = document.getElementById('tx-branch');
    const dateEl = document.getElementById('tx-date');
    const amountEl = document.getElementById('tx-amount');
    const descEl = document.getElementById('tx-desc');
    const radioExpenseEl = document.getElementById('radio-expense');
    
    const branchId = branchEl && branchEl.value ? branchEl.value : (state.currentUser ? state.currentUser.permittedBranches[0] : 'ladprao');
    const date = dateEl && dateEl.value ? dateEl.value : new Date().toISOString().split('T')[0];
    const type = (radioExpenseEl && radioExpenseEl.checked) ? 'expense' : 'income';
    const amountVal = amountEl ? parseFloat(amountEl.value) : 0;
    
    if (isNaN(amountVal) || amountVal <= 0) {
        alert('⚠️ กรุณาระบุจำนวนเงินที่ถูกต้อง (มากกว่า 0 บาท)');
        if (amountEl) amountEl.focus();
        return;
    }
    
    let description = descEl ? descEl.value.trim() : '';
    
    const txData = {
        branchId,
        date,
        type,
        amount: amountVal
    };
    
    if (type === 'income') {
        const channelEl = document.getElementById('tx-channel');
        const channel = channelEl ? channelEl.value : 'storefront';
        const channelName = (typeof SALE_CHANNELS !== 'undefined' && SALE_CHANNELS[channel]) ? SALE_CHANNELS[channel] : channel;
        txData.category = 'income';
        txData.channel = channel;
        txData.description = description || `ยอดขาย (${channelName})`;
    } else {
        const categoryEl = document.getElementById('tx-category');
        const category = categoryEl ? categoryEl.value : 'raw_material';
        const categoryName = (typeof EXPENSE_CATEGORIES !== 'undefined' && EXPENSE_CATEGORIES[category]) ? EXPENSE_CATEGORIES[category] : category;
        txData.category = category;
        txData.channel = '';
        txData.description = description || `ค่าใช้จ่าย (${categoryName})`;
    }
    
    try {
        Database.addTransaction(txData);
        loadData();
        closeModal();
        
        if (state.currentPage === 'dashboard') {
            renderDashboard();
        } else if (state.currentPage === 'transactions') {
            renderTransactionsTable();
        } else if (state.currentPage === 'shareholders') {
            renderShareholdersInfo();
        }
        
        alert('🎉 บันทึกรายการรายรับ/รายจ่ายสำเร็จเรียบร้อยแล้ว!');
    } catch (err) {
        console.error('Error saving transaction:', err);
        alert(`⚠️ เกิดข้อผิดพลาดขณะบันทึก: ${err.message}`);
    }
}

// ฟังก์ชันผูก Event Listeners ปลอดภัยหลังหน้าจอโหลดเสร็จ
function setupEventListeners() {
    // 1. ดึงค่า element สำหรับจัดการ Modal
    modal = document.getElementById('add-tx-modal');
    btnOpenModal = document.getElementById('btn-open-add-modal');
    btnCloseModal = document.getElementById('btn-close-modal');
    btnCancelModal = document.getElementById('btn-cancel-modal');
    radioIncome = document.getElementById('radio-income');
    radioExpense = document.getElementById('radio-expense');
    txChannelContainer = document.getElementById('tx-channel-container');
    txCategoryContainer = document.getElementById('tx-category-container');

    // 2. ผูกอีเวนต์จัดการ Modal
    if (btnOpenModal) btnOpenModal.addEventListener('click', openModal);
    if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
    if (btnCancelModal) btnCancelModal.addEventListener('click', closeModal);

    // 3. ปรับฟิลด์ Modal ตามประเภทธุรกรรม
    if (radioIncome) {
        radioIncome.addEventListener('change', handleTxTypeChange);
    }

    if (radioExpense) {
        radioExpense.addEventListener('change', handleTxTypeChange);
    }

    // 4. บันทึกรายการผ่าน Modal
    const addTxForm = document.getElementById('add-tx-form');
    if (addTxForm) {
        addTxForm.addEventListener('submit', submitAddTransaction);
    }

    // 5. ตัวกรองสาขาและเดือน
    const filterBranch = document.getElementById('filter-branch');
    if (filterBranch) {
        filterBranch.addEventListener('change', (e) => {
            state.selectedBranch = e.target.value;
            switchView(state.currentPage);
        });
    }

    const filterMonth = document.getElementById('filter-month');
    if (filterMonth) {
        filterMonth.addEventListener('change', (e) => {
            state.selectedMonth = e.target.value;
            state.txPage = 1;
            switchView(state.currentPage);
        });
    }

    // 6. เมนูนำทางใน Sidebar
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const viewId = item.getAttribute('data-view');
            switchView(viewId);
        });
    });

    // 7. ปุ่มเซฟเป้าหมายงบประมาณ
    const btnSaveBudget = document.getElementById('btn-save-budget');
    if (btnSaveBudget) {
        btnSaveBudget.addEventListener('click', saveBudgetSettings);
    }

    // 8. ดาวน์โหลดธุรกรรมและพิมพ์ PDF
    const btnExportCSV = document.getElementById('btn-export-csv');
    if (btnExportCSV) btnExportCSV.addEventListener('click', downloadCSV);

    const btnExportPDF = document.getElementById('btn-export-pdf');
    if (btnExportPDF) {
        btnExportPDF.addEventListener('click', () => {
            window.print();
        });
    }

    // 8.1 อัปโหลดไฟล์ CSV และลากวาง
    const fileInput = document.getElementById('import-file-input');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const text = event.target.result;
                    const pasteArea = document.getElementById('import-paste-area');
                    if (pasteArea) pasteArea.value = text;
                    switchImportTab('paste');
                    parseAndPreviewImport();
                };
                reader.readAsText(file);
            }
        });
    }

    const dropzone = document.getElementById('import-dropzone');
    if (dropzone) {
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });
        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('dragover');
        });
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                const reader = new FileReader();
                reader.onload = (event) => {
                    const text = event.target.result;
                    const pasteArea = document.getElementById('import-paste-area');
                    if (pasteArea) pasteArea.value = text;
                    switchImportTab('paste');
                    parseAndPreviewImport();
                };
                reader.readAsText(file);
            }
        });
    }

    // 9. ตัวควบคุมหน้าธุรกรรม
    const txSearchInput = document.getElementById('tx-search-input');
    if (txSearchInput) {
        txSearchInput.addEventListener('input', () => {
            state.txPage = 1;
            renderTransactionsTable();
        });
    }

    const txFilterType = document.getElementById('tx-filter-type');
    if (txFilterType) {
        txFilterType.addEventListener('change', () => {
            state.txPage = 1;
            renderTransactionsTable();
        });
    }

    const txFilterCategory = document.getElementById('tx-filter-category');
    if (txFilterCategory) {
        txFilterCategory.addEventListener('change', () => {
            state.txPage = 1;
            renderTransactionsTable();
        });
    }

    // 10. ระบบยืนยันตัวตนล็อกอิน
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const usernameEl = document.getElementById('username');
            const passwordEl = document.getElementById('password');
            const loginErrorMsg = document.getElementById('login-error-msg');
            
            if (usernameEl && passwordEl) {
                const userVal = usernameEl.value.trim().toLowerCase();
                const passVal = passwordEl.value;
                const user = USERS[userVal];
                
                if (user && passVal === user.password) {
                    if (loginErrorMsg) loginErrorMsg.classList.add('hidden');
                    state.currentUser = user;
                    localStorage.setItem('pkt_logged_in_user', userVal);
                    bootApp();
                } else {
                    if (loginErrorMsg) loginErrorMsg.classList.remove('hidden');
                }
            }
        });
    }

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            if (confirm('คุณต้องการออกจากระบบใช่หรือไม่?')) {
                localStorage.removeItem('pkt_logged_in_user');
                state.currentUser = null;
                destroyCharts();
                
                const mainAppEl = document.getElementById('main-app');
                const loginScreenEl = document.getElementById('login-screen');
                const loginFormEl = document.getElementById('login-form');
                const loginErrorMsgEl = document.getElementById('login-error-msg');
                
                if (mainAppEl) mainAppEl.classList.remove('active');
                if (loginScreenEl) loginScreenEl.classList.add('active');
                if (loginFormEl) loginFormEl.reset();
                if (loginErrorMsgEl) loginErrorMsgEl.classList.add('hidden');
            }
        });
    }
}

// 8. ตรวจสอบการล็อกอินคงค้างเมื่อเปิดเบราว์เซอร์
window.addEventListener('load', () => {
    try {
        // ผูก Event Listeners ต่างๆ ก่อน
        setupEventListeners();

        Database.init(); // ตรวจสอบความถูกต้องของการเซ็ตค่า LocalStorage
        
        // กำหนดค่าธีมเริ่มต้น (Dark Theme อย่างเดียวตามคำขอ)
        applyTheme('dark');

        // ตรวจสอบการเชื่อมต่อฐานข้อมูล Cloudflare D1
        initCloudflareStatus();

        // โหลดโลโก้ร้านแบบฝังตัว (Base64) ให้แสดงผลแน่นอน 100%
        applyStoreLogos();
        
        const savedUser = localStorage.getItem('pkt_logged_in_user');
        if (savedUser && USERS[savedUser]) {
            state.currentUser = USERS[savedUser];
            bootApp();
        } else {
            // เคลียร์ state แสดงหน้าล็อกอิน
            const loginScreenEl = document.getElementById('login-screen');
            const mainAppEl = document.getElementById('main-app');
            if (loginScreenEl) loginScreenEl.classList.add('active');
            if (mainAppEl) mainAppEl.classList.remove('active');
            if (window.lucide) {
                lucide.createIcons();
            }
        }
    } catch (err) {
        console.error("Startup Error:", err);
        const errDiv = document.createElement('div');
        errDiv.style.position = 'fixed';
        errDiv.style.top = '0';
        errDiv.style.left = '0';
        errDiv.style.width = '100vw';
        errDiv.style.height = '100vh';
        errDiv.style.backgroundColor = 'rgba(10, 12, 16, 0.95)';
        errDiv.style.color = '#ff5555';
        errDiv.style.padding = '40px';
        errDiv.style.fontFamily = 'monospace';
        errDiv.style.fontSize = '16px';
        errDiv.style.zIndex = '99999';
        errDiv.style.overflow = 'auto';
        errDiv.innerHTML = `
            <div style="max-width: 800px; margin: 40px auto; background: #161b22; border: 1px solid #ff5555; padding: 30px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                <h2 style="margin-top: 0; color: #ff5555; border-bottom: 1px solid #ff5555; padding-bottom: 10px;">พบข้อผิดพลาดขณะโหลดระบบ (Startup Error)</h2>
                <p style="color: #8b949e; margin-bottom: 20px;">มีข้อผิดพลาด JavaScript เกิดขึ้นขณะเริ่มการทำงานของแดชบอร์ด:</p>
                <pre style="background: #0d1117; padding: 20px; border-radius: 8px; border: 1px solid #30363d; color: #ff7b72; font-family: monospace; font-size: 14px; overflow-x: auto; white-space: pre-wrap; word-break: break-all;">${err.stack || err.message || err}</pre>
                <button onclick="localStorage.clear(); location.reload();" style="margin-top: 20px; background: #ff5555; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; cursor: pointer;">ล้าง Cache ข้อมูลและรีโหลดหน้าจอใหม่</button>
            </div>
        `;
        document.body.appendChild(errDiv);
    }
});
