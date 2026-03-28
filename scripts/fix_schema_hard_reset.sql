-- HARD RESET of Serials Columns
-- WARNING: This section clears the 'serials' history to fix the "400 Bad Request" Schema error.
-- This is necessary because the previous migrations likely failed to convert an existing column type.

-- 1. Transactions
ALTER TABLE inventory_transactions DROP COLUMN IF EXISTS serials CASCADE;
ALTER TABLE inventory_transactions ADD COLUMN serials JSONB DEFAULT '[]'::jsonb;
CREATE INDEX idx_inventory_transactions_serials ON inventory_transactions USING gin (serials);

-- 2. Assignments (The one currently failing)
ALTER TABLE inventory_assignment_items DROP COLUMN IF EXISTS serials CASCADE;
ALTER TABLE inventory_assignment_items ADD COLUMN serials JSONB DEFAULT '[]'::jsonb;
CREATE INDEX idx_inventory_assignment_items_serials ON inventory_assignment_items USING gin (serials);

-- 3. Returns
ALTER TABLE inventory_return_items DROP COLUMN IF EXISTS serials CASCADE;
ALTER TABLE inventory_return_items ADD COLUMN serials JSONB DEFAULT '[]'::jsonb;
CREATE INDEX idx_inventory_return_items_serials ON inventory_return_items USING gin (serials);

-- 4. Re-grant permissions (just in case RLS is blocking)
GRANT ALL ON inventory_transactions TO authenticated;
GRANT ALL ON inventory_assignment_items TO authenticated;
GRANT ALL ON inventory_return_items TO authenticated;
