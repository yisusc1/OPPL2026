-- Pick a serialized product and mark a serial as DAMAGED
UPDATE inventory_serials
SET status = 'DAMAGED'
WHERE serial_number IN (
    SELECT serial_number 
    FROM inventory_serials 
    LIMIT 1
);

-- Pick a non-serialized product and set damaged_stock
-- Fixed: Postgres UPDATE does not support LIMIT directly, using subquery
UPDATE inventory_products
SET damaged_stock = 5
WHERE id IN (
    SELECT id
    FROM inventory_products
    WHERE requires_serial = false
    LIMIT 1
);
