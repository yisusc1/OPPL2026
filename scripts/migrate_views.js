const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING;

if (!DATABASE_URL) {
    console.error("❌ Error: Missing DATABASE_URL or POSTGRES_URL in environment.");
    process.exit(1);
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Required for most cloud DBs (Supabase/Neon)
});

const sql = `
-- 1. Create View for Real-Time Spool Status
CREATE OR REPLACE VIEW view_spool_status AS
WITH latest_audits AS (
    SELECT DISTINCT ON (product_sku)
        product_sku AS serial,
        physical_quantity,
        updated_at as audit_date
    FROM inventory_audit_items
    JOIN inventory_audits ON inventory_audits.id = inventory_audit_items.audit_id
    WHERE inventory_audits.status = 'COMPLETED'
    ORDER BY product_sku, inventory_audits.updated_at DESC
),
spool_usage AS (
    SELECT
        c.codigo_carrete as serial,
        SUM(
             COALESCE(CAST(NULLIF(regexp_replace(c.metraje_usado, '[^0-9.]', '', 'g'), '') AS NUMERIC), 0) +
             COALESCE(CAST(NULLIF(regexp_replace(c.metraje_desechado, '[^0-9.]', '', 'g'), '') AS NUMERIC), 0)
        ) as total_usage
    FROM cierres c
    LEFT JOIN latest_audits la ON c.codigo_carrete = la.serial
    LEFT JOIN inventory_serials s ON c.codigo_carrete = s.serial_number
    -- Usage is counted if it happened AFTER the Audit Date (or Initial Date if no audit)
    -- We add a 1-second buffer to strict inequality to avoid counting the usage itself if timestamps align perfectly? 
    -- Actually strictly > is standard for "After".
    WHERE c.created_at > COALESCE(la.audit_date, s.created_at, '1970-01-01'::timestamp)
    GROUP BY c.codigo_carrete
)
SELECT
    s.serial_number,
    s.initial_quantity,
    s.status,
    COALESCE(la.physical_quantity, s.initial_quantity) as base_quantity,
    COALESCE(la.audit_date, s.created_at) as base_date,
    COALESCE(u.total_usage, 0) as usage_since_base,
    (COALESCE(la.physical_quantity, s.initial_quantity) - COALESCE(u.total_usage, 0)) as current_quantity
FROM inventory_serials s
LEFT JOIN latest_audits la ON s.serial_number = la.serial
LEFT JOIN spool_usage u ON s.serial_number = u.serial;
`;

async function run() {
    try {
        console.log("🚀 Starting Migration: Creating view_spool_status...");
        await pool.query(sql);
        console.log("✅ Migration Successful: view_spool_status created.");
    } catch (err) {
        console.error("❌ Migration Failed:", err);
    } finally {
        await pool.end();
    }
}

run();
