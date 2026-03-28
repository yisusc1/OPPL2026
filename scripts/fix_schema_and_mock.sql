-- Force add column if not exists
ALTER TABLE inventory_products 
ADD COLUMN IF NOT EXISTS damaged_stock INTEGER DEFAULT 0;

-- Retry setting mock data
UPDATE inventory_products
SET damaged_stock = 5
WHERE id IN (
    SELECT id
    FROM inventory_products
    WHERE requires_serial = false
    LIMIT 1
);

-- Ensure Serials are set too
UPDATE inventory_serials
SET status = 'DAMAGED'
WHERE serial_number IN (
    SELECT serial_number 
    FROM inventory_serials 
    LIMIT 1
);
