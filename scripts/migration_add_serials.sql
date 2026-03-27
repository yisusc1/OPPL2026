-- Add serials column to inventory_transactions
-- This allows tracking exact serial numbers for simple IN/OUT/ADJUST movements (like Losses).

ALTER TABLE inventory_transactions
ADD COLUMN IF NOT EXISTS serials JSONB DEFAULT '[]'::jsonb;

-- Optional: Index for searching by serial number in history
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_serials ON inventory_transactions USING gin (serials);
