
const { Client } = require('pg');

const connectionString = "postgres://postgres.yublqipfcozpcpfdwozc:Supabase2024@aws-0-sa-east-1.pooler.supabase.com:5432/postgres";

const client = new Client({
    connectionString: connectionString,
    ssl: {
        rejectUnauthorized: false
    }
});

async function run() {
    try {
        await client.connect();
        console.log("Connected to database.");

        await client.query('BEGIN');

        // 1. Delete Audit Items
        console.log("Deleting inventory_audit_items...");
        await client.query('DELETE FROM public.inventory_audit_items');

        // 2. Delete Audits
        console.log("Deleting inventory_audits...");
        await client.query('DELETE FROM public.inventory_audits');

        // 3. Delete Closures (Reported Usage)
        console.log("Deleting cierres...");
        await client.query('DELETE FROM public.cierres');

        // 4. Reset 'SOLD' serials to 'AVAILABLE'
        console.log("Resetting SOLD serials...");
        await client.query("UPDATE public.inventory_serials SET status = 'AVAILABLE' WHERE status = 'SOLD'");

        // 5. Delete Adjustment Transactions
        console.log("Deleting adjustment transactions...");
        await client.query("DELETE FROM public.inventory_transactions WHERE reason LIKE 'Ajuste Auditoría%'");

        await client.query('COMMIT');
        console.log("Cleanup completed successfully.");

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error running cleanup:", err);
    } finally {
        await client.end();
    }
}

run();
