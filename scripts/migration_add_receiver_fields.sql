-- Add columns for third-party receiver tracking
ALTER TABLE inventory_assignments
ADD COLUMN IF NOT EXISTS received_by TEXT,
ADD COLUMN IF NOT EXISTS receiver_id TEXT;

-- Comment on columns
COMMENT ON COLUMN inventory_assignments.received_by IS 'Name of the person who physically received the dispatch if different from assigned_to';
COMMENT ON COLUMN inventory_assignments.receiver_id IS 'ID/Document of the person who physically received the dispatch';
