-- Type definition for items passed to the RPC
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dispatch_item_type') THEN
        CREATE TYPE dispatch_item_type AS (
            product_id uuid,
            quantity integer,
            requires_serial boolean,
            serials text[]
        );
    END IF;
END$$;

-- The ATOMIC Transaction RPC
CREATE OR REPLACE FUNCTION create_dispatch_transaction(
    p_assigned_to uuid,
    p_code text,
    p_received_by text,
    p_receiver_id text,
    p_items dispatch_item_type[]
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
    v_assignment_id uuid;
    v_item dispatch_item_type;
    v_current_stock int;
    v_new_stock int;
    v_serial text;
    v_serial_status text;
    v_user_name text;
    v_receiver_name text;
BEGIN
    -- 1. Create Assignment Header
    INSERT INTO inventory_assignments (code, assigned_to, status, received_by, receiver_id)
    VALUES (p_code, p_assigned_to, 'ACTIVE', p_received_by, p_receiver_id)
    RETURNING id INTO v_assignment_id;

    -- Get user name for logs
    SELECT (first_name || ' ' || last_name) INTO v_user_name FROM profiles WHERE id = p_assigned_to;
    v_receiver_name := COALESCE(p_received_by, v_user_name);

    -- 2. Process Items
    FOREACH v_item IN ARRAY p_items
    LOOP
        -- Check Stock
        SELECT current_stock INTO v_current_stock 
        FROM inventory_products 
        WHERE id = v_item.product_id 
        FOR UPDATE; -- Lock this product row

        IF v_current_stock < v_item.quantity THEN
            RAISE EXCEPTION 'Stock insuficiente para el producto % (Stock: %, Solicitado: %)', v_item.product_id, v_current_stock, v_item.quantity;
        END IF;

        -- Insert Assignment Item
        INSERT INTO inventory_assignment_items (assignment_id, product_id, quantity, serials)
        VALUES (v_assignment_id, v_item.product_id, v_item.quantity, v_item.serials);

        -- Process Serials
        IF v_item.requires_serial THEN
            FOREACH v_serial IN ARRAY v_item.serials
            LOOP
                -- Strict Validation & Update
                UPDATE inventory_serials
                SET status = 'ASSIGNED'
                WHERE serial_number = v_serial 
                  AND product_id = v_item.product_id 
                  AND status = 'AVAILABLE' -- Must be available
                RETURNING serial_number INTO v_serial;

                IF v_serial IS NULL THEN
                     RAISE EXCEPTION 'El serial % no está disponible o no existe para este producto.', v_serial;
                END IF;
            END LOOP;
        END IF;

        -- Update Stock
        v_new_stock := v_current_stock - v_item.quantity;
        UPDATE inventory_products
        SET current_stock = v_new_stock
        WHERE id = v_item.product_id;

        -- Log Transaction (OUT)
        INSERT INTO inventory_transactions (
            product_id, 
            type, 
            quantity, 
            previous_stock, 
            new_stock, 
            reason, 
            user_id,
            serials,
            received_by,
            receiver_id
        )
        VALUES (
            v_item.product_id,
            'ASSIGNMENT', -- Using ASSIGNMENT as type or OUT? usually OUT but linked to assignment
            v_item.quantity,
            v_current_stock,
            v_new_stock,
            'Asignación: ' || p_code,
            p_assigned_to,
            CASE WHEN v_item.requires_serial THEN jsonb_build_array(VARIADIC v_item.serials) ELSE '[]'::jsonb END,
            p_received_by,
            p_receiver_id
        );

    END LOOP;

    RETURN v_assignment_id;

EXCEPTION
    WHEN OTHERS THEN
        RAISE; -- Propagate error to rollback transaction
END;
$$;
