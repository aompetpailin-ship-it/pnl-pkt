-- ==========================================================
-- Initial Seed Data for Cloudflare D1 (Users & Branches)
-- ==========================================================

-- Insert Users
INSERT OR REPLACE INTO users (username, password, name, permitted_branches) VALUES
('aom', '12345', 'Aom', '["ladprao","thepharak","muangthong","pinklao"]'),
('pon', '12345', 'Pon', '["ladprao","thepharak","muangthong","pinklao"]'),
('krit', '1234', 'Krit', '["muangthong","pinklao"]'),
('pie', '1234', 'Pie', '["muangthong","pinklao"]'),
('pat', '1234', 'Pat', '["muangthong","pinklao"]'),
('bank', '1234', 'Bank', '["muangthong"]');

-- Insert Branches
INSERT OR REPLACE INTO branches (id, name, status, shareholders) VALUES
('ladprao', 'สาขาลาดพร้าว', 'active', '{"pon":51,"aom":49}'),
('thepharak', 'สาขาเทพรักษ์', 'active', '{"pon":51,"aom":49}'),
('muangthong', 'สาขาเมืองทอง', 'active', '{"pie":25,"pat":25,"bank":25,"krit":15,"pon":5.1,"aom":4.9}'),
('pinklao', 'สาขาปิ่นเกล้า', 'opening', '{"pie":20,"pat":20,"krit":20,"pon":20,"aom":20}');
