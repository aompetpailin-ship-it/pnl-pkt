/**
 * Cloudflare Pages Function: /api/budgets
 * จัดการข้อมูลงบประมาณเป้าหมาย (% Budget of Revenue) บน Cloudflare D1
 */

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json;charset=UTF-8'
};

export async function onRequestOptions() {
    return new Response(null, { headers: corsHeaders });
}

// 1. GET: ดึงข้อมูลงบประมาณ
export async function onRequestGet(context) {
    const { env, request } = context;
    if (!env.DB) {
        return new Response(JSON.stringify({ error: 'D1 Database not configured' }), { status: 503, headers: corsHeaders });
    }

    try {
        const url = new URL(request.url);
        const branch = url.searchParams.get('branch');
        const month = url.searchParams.get('month');

        let query = 'SELECT * FROM budgets WHERE 1=1';
        const params = [];

        if (branch && branch !== 'all') {
            query += ' AND branch_id = ?';
            params.push(branch);
        }

        if (month) {
            query += ' AND month = ?';
            params.push(month);
        }

        const stmt = env.DB.prepare(query).bind(...params);
        const { results } = await stmt.all();

        // จัดกลุ่มข้อมูลให้อยู่ในรูปแบบ Object ตาม branch และ month
        const budgetsMap = {};
        for (const row of results) {
            const key = `${row.branch_id}_${row.month}`;
            if (!budgetsMap[key]) {
                budgetsMap[key] = {
                    branchId: row.branch_id,
                    month: row.month,
                    categoryBudgets: {}
                };
            }
            budgetsMap[key].categoryBudgets[row.category] = Number(row.percentage);
        }

        const formatted = Object.values(budgetsMap);

        return new Response(JSON.stringify({ success: true, data: formatted }), {
            status: 200,
            headers: corsHeaders
        });
    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500,
            headers: corsHeaders
        });
    }
}

// 2. POST: บันทึก/อัปเดต % งบประมาณ
export async function onRequestPost(context) {
    const { env, request } = context;
    if (!env.DB) {
        return new Response(JSON.stringify({ error: 'D1 Database not configured' }), { status: 503, headers: corsHeaders });
    }

    try {
        const body = await request.json();
        const { branchId, month, categoryBudgets } = body;

        if (!branchId || !categoryBudgets) {
            return new Response(JSON.stringify({ error: 'branchId and categoryBudgets are required' }), { status: 400, headers: corsHeaders });
        }

        const targetMonth = month || 'default';
        const statements = [];

        for (const [category, percentage] of Object.entries(categoryBudgets)) {
            const id = `${branchId}_${targetMonth}_${category}`;
            statements.push(
                env.DB.prepare(
                    `INSERT OR REPLACE INTO budgets (id, branch_id, month, category, percentage, updated_at) 
                     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
                ).bind(id, branchId, targetMonth, category, Number(percentage))
            );
        }

        await env.DB.batch(statements);

        return new Response(JSON.stringify({
            success: true,
            message: `Updated budgets for branch ${branchId}`,
            data: { branchId, month: targetMonth, categoryBudgets }
        }), {
            status: 200,
            headers: corsHeaders
        });
    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500,
            headers: corsHeaders
        });
    }
}
