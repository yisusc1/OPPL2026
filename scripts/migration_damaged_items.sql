-- Add damaged_stock column for non-serialized items
ALTER TABLE inventory_products
ADD COLUMN IF NOT EXISTS damaged_stock INTEGER DEFAULT 0;

-- RPC to get products with damaged/lost items
-- This combines:
-- 1. Non-serialized items with damaged_stock > 0
-- 2. Serialized items with status 'DAMAGED', 'LOST', 'RETURNED_DEFECTIVE' (if we use that) 
--    (Currently we rely on 'DAMAGED' or 'LOST' status in inventory_serials)

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
        p.image_url,
        p.requires_serial,
        -- Calculate total damaged
        CASE 
            WHEN p.requires_serial THEN COALESCE(sc.damaged_qty, 0)
            ELSE p.damaged_stock
        END as damaged_count,
        -- Calculate total lost (for non-serialized we don't have a separate lost column yet, maybe imply strictly 'damaged' for now or add lost_stock?)
        -- Plan said 'damaged_stock' only. Let's assume non-serialized 'lost' usually is just written off immediately. 
        -- If user marked 'Lost' in return dialog, it vanishes.
        -- So for non-serialized, we only show 'damaged_stock' here as 'damaged'.
        CASE 
            WHEN p.requires_serial THEN COALESCE(sc.lost_qty, 0)
            ELSE 0 -- We don't hold 'lost' stock for non-serialized, it's just gone.
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
