-- Add serials column to inventory_assignment_items
-- This is critical for tracking which specific serials correspond to a dispatch/assignment

ALTER TABLE inventory_assignment_items
ADD COLUMN IF NOT EXISTS serials JSONB DEFAULT '[]'::jsonb;

-- Index for searching serials in assignments
CREATE INDEX IF NOT EXISTS idx_inventory_assignment_items_serials ON inventory_assignment_items USING gin (serials);
