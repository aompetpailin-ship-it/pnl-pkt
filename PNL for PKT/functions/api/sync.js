/**
 * Cloudflare Pages Function: /api/sync
 * Sync ข้อมูลทั้งหมด (Initial Dataset & Real Data) จาก Client ขึ้นสู่ Cloudflare D1
 */

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json;charset=UTF-8'
};

export async function onRequestOptions() {
    return new Response(null, { headers: corsHeaders });
}

export async function onRequestPost(context) {
    const { env, request } = context;
    if (!env.DB) {
        return new Response(JSON.stringify({ error: 'D1 Database not configured' }), { status: 503, headers: corsHeaders });
    }

    try {
        const body = await request.json();
        const { transactions = [], budgets = [], users = [], branches = [] } = body;
        
        let txInserted = 0;
        let budgetInserted = 0;

        // 1. Sync Transactions
        if (transactions.length > 0) {
            const statements = [];
            for (const tx of transactions) {
                const id = tx.id;
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

            const chunkSize = 80;
            for (let i = 0; i < statements.length; i += chunkSize) {
                const chunk = statements.slice(i, i + chunkSize);
                await env.DB.batch(chunk);
            }
            txInserted = transactions.length;
        }

        // 2. Sync Budgets
        if (budgets.length > 0) {
            const statements = [];
            for (const b of budgets) {
                const branchId = b.branchId;
                const month = b.month;
                if (b.categoryBudgets) {
                    for (const [cat, pct] of Object.entries(b.categoryBudgets)) {
                        const id = `${branchId}_${month}_${cat}`;
                        statements.push(
                            env.DB.prepare(
                                `INSERT OR REPLACE INTO budgets (id, branch_id, month, category, percentage, updated_at) 
                                 VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
                            ).bind(id, branchId, month, cat, Number(pct))
                        );
                    }
                }
            }

            const chunkSize = 80;
            for (let i = 0; i < statements.length; i += chunkSize) {
                const chunk = statements.slice(i, i + chunkSize);
                await env.DB.batch(chunk);
            }
            budgetInserted = statements.length;
        }

        return new Response(JSON.stringify({
            success: true,
            message: `Synced ${txInserted} transactions and ${budgetInserted} budget items to Cloudflare D1 successfully.`,
            stats: {
                transactionsCount: txInserted,
                budgetEntriesCount: budgetInserted
            }
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
