-- ==========================================================
-- Cloudflare D1 Database Schema for "ผมขอทอด" P&L
-- Database Name: pnl-pkt-db
-- ==========================================================

-- 1. ตารางธุรกรรม รายรับ-รายจ่าย (Transactions Table)
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    branch_id TEXT NOT NULL,
    date TEXT NOT NULL,
    type TEXT NOT NULL,              -- 'income' or 'expense'
    channel TEXT,                    -- 'storefront', 'lineman', 'grab', 'shopee', 'dotdash'
    category TEXT,                   -- 'raw_material', 'salary', 'rent', 'utilities', 'marketing', 'packaging', 'gp', 'others'
    amount REAL NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tx_branch_date ON transactions(branch_id, date);
CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_tx_type ON transactions(type);

-- 2. ตารางการตั้งค่างบประมาณรายเดือน (% of Revenue)
CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,             -- เช่น 'ladprao_2026-07_raw_material'
    branch_id TEXT NOT NULL,
    month TEXT NOT NULL,             -- 'YYYY-MM'
    category TEXT NOT NULL,
    percentage REAL NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_budgets_branch_month ON budgets(branch_id, month);

-- 3. ตารางข้อมูลผู้ใช้และสิทธิ์การเข้าถึง (Users Table)
CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    permitted_branches TEXT NOT NULL  -- JSON Array: '["ladprao","thepharak","muangthong","pinklao"]'
);

-- 4. ตารางข้อมูลสาขาและสัดส่วนหุ้น (Branches Table)
CREATE TABLE IF NOT EXISTS branches (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL,            -- 'active', 'opening', 'closed'
    shareholders TEXT NOT NULL       -- JSON Object: '{"pie":25,"pat":25,"bank":25,"krit":15,"pon":5.1,"aom":4.9}'
);
