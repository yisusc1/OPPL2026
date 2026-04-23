-- Migración: Preparar tabla installations para sync exclusivo con Google Sheets
-- Fecha: 2026-04-22
-- Descripción: Limpia datos manuales existentes y prepara la tabla para
-- recibir datos únicamente desde Google Sheets (Power Query logic).

-- 1. Limpiar datos manuales existentes
TRUNCATE TABLE installations;

-- 2. Nuevas columnas calculadas (paridad con PowerBI)
ALTER TABLE installations ADD COLUMN IF NOT EXISTS oficina text;
ALTER TABLE installations ADD COLUMN IF NOT EXISTS estado text;

-- 3. Índices para mejorar performance de filtros del Dashboard
CREATE INDEX IF NOT EXISTS idx_installations_oficina ON installations (oficina);
CREATE INDEX IF NOT EXISTS idx_installations_estado ON installations (estado);
CREATE INDEX IF NOT EXISTS idx_installations_mes ON installations (mes);
CREATE INDEX IF NOT EXISTS idx_installations_asesor ON installations (asesor);
