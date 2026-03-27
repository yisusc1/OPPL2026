-- 1. Add columns to inventory_transactions for History Visibility
ALTER TABLE inventory_transactions
ADD COLUMN IF NOT EXISTS received_by TEXT,
ADD COLUMN IF NOT EXISTS receiver_id TEXT;

-- 2. Update RPC get_serial_history to include receiver info in Assignments
CREATE OR REPLACE FUNCTION get_serial_history(search_term text)
RETURNS TABLE (
    source_type text,
    id uuid,
    created_at timestamptz,
    details jsonb
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    -- 1. Transactions
    SELECT 
        'TRANSACTION' as source_type,
        t.id,
        t.created_at,
        jsonb_build_object(
            'type', t.type,
            'reason', t.reason,
            'previous_stock', t.previous_stock,
            'new_stock', t.new_stock,
            'user_first_name', p.first_name,
            'user_last_name', p.last_name,
            'product_name', prod.name,
            'received_by', t.received_by, -- Added
            'receiver_id', t.receiver_id  -- Added
        ) as details
    FROM inventory_transactions t
    LEFT JOIN profiles p ON t.user_id = p.id
    LEFT JOIN inventory_products prod ON t.product_id = prod.id
    WHERE t.product_id IN (
        SELECT product_id FROM inventory_serials WHERE serial_number = search_term
    )
    -- Also try to match reason for loose correlation if needed, but strict product ID match is safer for now
    -- Actually, transactions don't link to serials directly unless we parse reason or look up assignment. 
    -- This part of query is 'best effort' for general product transactions, maybe not specific serial.
    -- BUT, the main part we care about is ASSIGNMENTS below.
    
    UNION ALL
    
    -- 2. Assignments (Active/History)
    SELECT 
        'ASSIGNMENT' as source_type,
        ia.id,
        ia.created_at,
        jsonb_build_object(
            'code', ia.code,
            'status', ia.status,
            'assigned_first_name', p.first_name,
            'assigned_last_name', p.last_name,
            'assigned_department', p.department,
            'product_name', prod.name,
            'received_by', ia.received_by, -- Added
            'receiver_id', ia.receiver_id  -- Added
        ) as details
    FROM inventory_assignment_items item
    JOIN inventory_assignments ia ON item.assignment_id = ia.id
    LEFT JOIN profiles p ON ia.assigned_to = p.id
    LEFT JOIN inventory_products prod ON item.product_id = prod.id
    WHERE item.serials @> jsonb_build_array(search_term)
    
    UNION ALL
    
    -- 3. Returns
    SELECT 
        'RETURN' as source_type,
        ir.id,
        ir.created_at,
        jsonb_build_object(
            'notes', ir.notes,
            'condition', item.condition,
            'user_first_name', p.first_name,
            'user_last_name', p.last_name,
            'product_name', prod.name
        ) as details
    FROM inventory_return_items item
    JOIN inventory_returns ir ON item.return_id = ir.id
    LEFT JOIN profiles p ON ir.user_id = p.id
    LEFT JOIN inventory_products prod ON item.product_id = prod.id
    WHERE item.serials @> jsonb_build_array(search_term);
END;
$$;
