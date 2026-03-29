-- ============================================
-- Módulo de Planificación - Migración
-- ============================================

-- Tabla de equipos de instalación
CREATE TABLE IF NOT EXISTS equipos (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    zona_asignada TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Nuevos campos en solicitudes para planificación
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS
    fecha_instalacion DATE;
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS
    equipo_id INTEGER REFERENCES equipos(id) ON DELETE SET NULL;
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS
    estatus_planificacion TEXT DEFAULT 'pendiente'
    CHECK (estatus_planificacion IN ('pendiente', 'agendado', 'completado', 'reprogramado', 'error'));
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS
    motivo_reprogramacion TEXT;
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS
    notas_planificacion TEXT;

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_solicitudes_planificacion
    ON solicitudes (fecha_instalacion, equipo_id, estatus_planificacion);
CREATE INDEX IF NOT EXISTS idx_solicitudes_pendientes
    ON solicitudes (estatus_planificacion) WHERE estatus_planificacion = 'pendiente';
CREATE INDEX IF NOT EXISTS idx_equipos_activo
    ON equipos (activo);

-- RLS policies
ALTER TABLE equipos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Equipos visible para autenticados" ON equipos;
CREATE POLICY "Equipos visible para autenticados" ON equipos
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Equipos modificable por autenticados" ON equipos;
CREATE POLICY "Equipos modificable por autenticados" ON equipos
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Equipos actualizable por autenticados" ON equipos;
CREATE POLICY "Equipos actualizable por autenticados" ON equipos
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Equipos eliminable por autenticados" ON equipos;
CREATE POLICY "Equipos eliminable por autenticados" ON equipos
    FOR DELETE TO authenticated USING (true);

-- Tabla de miembros de equipo (relación equipo <-> profiles)
CREATE TABLE IF NOT EXISTS equipo_miembros (
    id SERIAL PRIMARY KEY,
    equipo_id INTEGER NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(equipo_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_equipo_miembros_equipo ON equipo_miembros (equipo_id);
CREATE INDEX IF NOT EXISTS idx_equipo_miembros_user ON equipo_miembros (user_id);

ALTER TABLE equipo_miembros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Miembros visible para autenticados" ON equipo_miembros;
CREATE POLICY "Miembros visible para autenticados" ON equipo_miembros
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Miembros modificable por autenticados" ON equipo_miembros;
CREATE POLICY "Miembros modificable por autenticados" ON equipo_miembros
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
