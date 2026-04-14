-- Migration: Add leader_id to equipos table
ALTER TABLE equipos ADD COLUMN IF NOT EXISTS leader_id uuid REFERENCES profiles(id);

-- Comment for clarity
COMMENT ON COLUMN equipos.leader_id IS 'The team leader responsible for all assigned materials, regardless of who physically received them.';

NOTIFY pgrst, 'reload schema';
