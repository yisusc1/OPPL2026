-- DANGEROUS SCRIPT: WIPES ALL INVENTORY HISTORY
-- Preserves Products/Categories but resets stock to 0 and deletes all movements.

BEGIN;

-- 1. Truncate History Tables (Order matters due to foreign keys)
TRUNCATE TABLE inventory_return_items CASCADE;
TRUNCATE TABLE inventory_returns CASCADE;

TRUNCATE TABLE inventory_assignment_items CASCADE;
TRUNCATE TABLE inventory_assignments CASCADE;

TRUNCATE TABLE inventory_transactions CASCADE;

-- 2. Clear Serials
TRUNCATE TABLE inventory_serials CASCADE;

-- 3. Reset Product Stock to 0
UPDATE inventory_products
SET current_stock = 0;

COMMIT;
