/**
 * Cloudflare Pages Function: /api/health
 * ตรวจสอบสถานะการเชื่อมต่อและพร้อมใช้งานของ Cloudflare D1 Database
 */
export async function onRequestGet(context) {
    const { env } = context;
    
    // ตั้งค่า CORS Headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json;charset=UTF-8'
    };

    if (!env.DB) {
        return new Response(JSON.stringify({
            status: 'ok',
            database: 'unbound',
            message: 'Cloudflare Pages is running, but D1 database is not bound yet. Using LocalStorage fallback.',
            timestamp: new Date().toISOString()
        }), {
            status: 200,
            headers: corsHeaders
        });
    }

    try {
        const result = await env.DB.prepare('SELECT count(*) as count FROM transactions').first();
        const budgetCount = await env.DB.prepare('SELECT count(*) as count FROM budgets').first();

        return new Response(JSON.stringify({
            status: 'ok',
            database: 'connected',
            provider: 'Cloudflare D1',
            transactionsCount: result ? result.count : 0,
            budgetsCount: budgetCount ? budgetCount.count : 0,
            timestamp: new Date().toISOString()
        }), {
            status: 200,
            headers: corsHeaders
        });
    } catch (err) {
        return new Response(JSON.stringify({
            status: 'error',
            database: 'error',
            message: err.message,
            timestamp: new Date().toISOString()
        }), {
            status: 500,
            headers: corsHeaders
        });
    }
}
