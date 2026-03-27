-- 1. Ensure Column Exists
ALTER TABLE inventory_products 
ADD COLUMN IF NOT EXISTS damaged_stock INTEGER DEFAULT 0;

-- 2. Drop Function explicitly
DROP FUNCTION IF EXISTS get_damaged_products();

-- 3. Notify Schema Reload (Pre-Creation)
NOTIFY pgrst, 'reload schema';

-- 4. Re-Create Function (Clean definition)
CREATE OR REPLACE FUNCTION get_damaged_products()
RETURNS TABLE (
    product_id uuid,
    product_name text,
    product_sku text,
    image_url text,
    requires_serial boolean,
    damaged_count bigint,
    lost_count bigint,
    details jsonb
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH serialized_counts AS (
        SELECT 
            s.product_id,
            COUNT(*) FILTER (WHERE s.status = 'DAMAGED') as damaged_qty,
            COUNT(*) FILTER (WHERE s.status = 'LOST') as lost_qty,
            jsonb_agg(jsonb_build_object(
                'serial', s.serial_number,
                'status', s.status
            )) as serial_details
        FROM inventory_serials s
        WHERE s.status IN ('DAMAGED', 'LOST')
        GROUP BY s.product_id
    )
    SELECT 
        p.id as product_id,
        p.name as product_name,
        p.sku as product_sku,
        NULL::text as image_url, -- RETURN NULL explicitly
        p.requires_serial,
        CASE 
            WHEN p.requires_serial THEN COALESCE(sc.damaged_qty, 0)
            ELSE p.damaged_stock
        END as damaged_count,
        CASE 
            WHEN p.requires_serial THEN COALESCE(sc.lost_qty, 0)
            ELSE 0 
        END as lost_count,
        COALESCE(sc.serial_details, '[]'::jsonb) as details
    FROM inventory_products p
    LEFT JOIN serialized_counts sc ON p.id = sc.product_id
    WHERE 
        (p.requires_serial AND (sc.damaged_qty > 0 OR sc.lost_qty > 0))
        OR 
        ((NOT p.requires_serial) AND p.damaged_stock > 0);
END;
$$;

-- 5. Grant Permissions
ALTER FUNCTION get_damaged_products() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION get_damaged_products() TO authenticated;
GRANT EXECUTE ON FUNCTION get_damaged_products() TO service_role;
GRANT EXECUTE ON FUNCTION get_damaged_products() TO anon;

-- 6. Ensure Mock Data Exists (Updating again to be sure)
-- Update a non-serial product
UPDATE inventory_products
SET damaged_stock = 5
WHERE id IN (SELECT id FROM inventory_products WHERE requires_serial = false LIMIT 1);

-- Update a serial
UPDATE inventory_serials
SET status = 'DAMAGED'
WHERE serial_number IN (SELECT serial_number FROM inventory_serials LIMIT 1);

-- 7. Final Schema Reload
NOTIFY pgrst, 'reload schema';
