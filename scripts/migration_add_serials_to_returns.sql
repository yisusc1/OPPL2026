-- Add serials column to inventory_return_items
ALTER TABLE inventory_return_items
ADD COLUMN IF NOT EXISTS serials JSONB DEFAULT '[]'::jsonb;

-- Index for searching serials in returns
CREATE INDEX IF NOT EXISTS idx_inventory_return_items_serials ON inventory_return_items USING gin (serials);

-- Also ensure assignments have index if not already (good practice for tracking)
CREATE INDEX IF NOT EXISTS idx_inventory_assignment_items_serials ON inventory_assignment_items USING gin (serials);
