-- Add 'cerrada' column to actividades table for day-close archival
ALTER TABLE actividades ADD COLUMN IF NOT EXISTS cerrada BOOLEAN DEFAULT false;

-- Index for fast filtering by cerrada status + asesor + fecha
CREATE INDEX IF NOT EXISTS idx_actividades_cerrada ON actividades (asesor, fecha, cerrada);
