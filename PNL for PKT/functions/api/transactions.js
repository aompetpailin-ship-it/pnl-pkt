/**
 * Cloudflare Pages Function: /api/transactions
 * จัดการรายการธุรกรรม (CRUD) บน Cloudflare D1 Database
 */

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json;charset=UTF-8'
};

export async function onRequestOptions() {
    return new Response(null, { headers: corsHeaders });
}

// 1. GET: ดึงข้อมูลรายการธุรกรรม
export async function onRequestGet(context) {
    const { env, request } = context;
    if (!env.DB) {
        return new Response(JSON.stringify({ error: 'D1 Database not configured' }), { status: 503, headers: corsHeaders });
    }

    try {
        const url = new URL(request.url);
        const branch = url.searchParams.get('branch');
        const month = url.searchParams.get('month'); // YYYY-MM
        const type = url.searchParams.get('type');   // income / expense
        const limit = parseInt(url.searchParams.get('limit') || '5000', 10);

        let query = 'SELECT * FROM transactions WHERE 1=1';
        const params = [];

        if (branch && branch !== 'all') {
            query += ' AND branch_id = ?';
            params.push(branch);
        }

        if (month) {
            query += ' AND date LIKE ?';
            params.push(`${month}%`);
        }

        if (type) {
            query += ' AND type = ?';
            params.push(type);
        }

        query += ' ORDER BY date DESC, id DESC LIMIT ?';
        params.push(limit);

        const stmt = env.DB.prepare(query).bind(...params);
        const { results } = await stmt.all();

        // แปลงฟิลด์ให้ตรงกับ Client Format
        const formatted = results.map(row => ({
            id: row.id,
            branchId: row.branch_id,
            date: row.date,
            type: row.type,
            channel: row.channel,
            category: row.category,
            amount: Number(row.amount),
            description: row.description,
            createdAt: row.created_at
        }));

        return new Response(JSON.stringify({ success: true, count: formatted.length, data: formatted }), {
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

// 2. POST: เพิ่มรายการธุรกรรมเดี่ยว หรือเป็นชุด (Bulk Insert)
export async function onRequestPost(context) {
    const { env, request } = context;
    if (!env.DB) {
        return new Response(JSON.stringify({ error: 'D1 Database not configured' }), { status: 503, headers: corsHeaders });
    }

    try {
        const body = await request.json();
        
        // กรณีนำเข้าเป็นชุด (Bulk Import)
        if (Array.isArray(body.transactions) && body.transactions.length > 0) {
            const txs = body.transactions;
            const statements = [];

            for (const tx of txs) {
                const id = tx.id || `TX-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
                const branchId = tx.branchId || tx.branch_id;
                const date = tx.date;
                const type = tx.type;
                const channel = tx.channel || null;
                const category = tx.category || null;
                const amount = Number(tx.amount);
                const description = tx.description || '';

                statements.push(
                    env.DB.prepare(
                        `INSERT OR REPLACE INTO transactions (id, branch_id, date, type, channel, category, amount, description) 
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
                    ).bind(id, branchId, date, type, channel, category, amount, description)
                );
            }

            // Cloudflare D1 batch execution (เป็นกลุ่มละไม่เกิน 100 รายการ)
            const chunkSize = 80;
            for (let i = 0; i < statements.length; i += chunkSize) {
                const chunk = statements.slice(i, i + chunkSize);
                await env.DB.batch(chunk);
            }

            return new Response(JSON.stringify({ success: true, count: txs.length, message: `Inserted ${txs.length} transactions successfully.` }), {
                status: 201,
                headers: corsHeaders
            });
        }

        // กรณีเพิ่มรายการเดี่ยว (Single Transaction)
        const id = body.id || `TX-${Date.now()}`;
        const branchId = body.branchId || body.branch_id;
        const date = body.date;
        const type = body.type;
        const channel = body.channel || null;
        const category = body.category || null;
        const amount = Number(body.amount);
        const description = body.description || '';

        await env.DB.prepare(
            `INSERT OR REPLACE INTO transactions (id, branch_id, date, type, channel, category, amount, description) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(id, branchId, date, type, channel, category, amount, description).run();

        return new Response(JSON.stringify({
            success: true,
            data: { id, branchId, date, type, channel, category, amount, description }
        }), {
            status: 201,
            headers: corsHeaders
        });
    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500,
            headers: corsHeaders
        });
    }
}

// 3. DELETE: ลบรายการธุรกรรม
export async function onRequestDelete(context) {
    const { env, request } = context;
    if (!env.DB) {
        return new Response(JSON.stringify({ error: 'D1 Database not configured' }), { status: 503, headers: corsHeaders });
    }

    try {
        const url = new URL(request.url);
        let id = url.searchParams.get('id');
        
        if (!id) {
            const body = await request.json().catch(() => ({}));
            id = body.id;
        }

        if (!id) {
            return new Response(JSON.stringify({ error: 'Transaction ID is required' }), { status: 400, headers: corsHeaders });
        }

        await env.DB.prepare('DELETE FROM transactions WHERE id = ?').bind(id).run();

        return new Response(JSON.stringify({ success: true, message: `Transaction ${id} deleted` }), {
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
