-- =============================================
-- SEED: Operadoras de la Competencia + Ofertas
-- Generado por scraping web - Mayo 2026
-- =============================================

-- 1. Nuevas columnas para enriquecer el modelo
ALTER TABLE operadores_competencia ADD COLUMN IF NOT EXISTS sitio_web TEXT;
ALTER TABLE operadores_competencia ADD COLUMN IF NOT EXISTS telefono TEXT;
ALTER TABLE operadores_competencia ADD COLUMN IF NOT EXISTS rif TEXT;
ALTER TABLE operadores_competencia ADD COLUMN IF NOT EXISTS instagram TEXT;
ALTER TABLE operadores_competencia ADD COLUMN IF NOT EXISTS tecnologia TEXT DEFAULT 'Fibra Óptica';
ALTER TABLE operadores_competencia ADD COLUMN IF NOT EXISTS cobertura_estados TEXT[];

ALTER TABLE ofertas_competencia ADD COLUMN IF NOT EXISTS velocidad_subida INTEGER;
ALTER TABLE ofertas_competencia ADD COLUMN IF NOT EXISTS tecnologia TEXT DEFAULT 'FTTH';
ALTER TABLE ofertas_competencia ADD COLUMN IF NOT EXISTS incluye_iptv BOOLEAN DEFAULT FALSE;
ALTER TABLE ofertas_competencia ADD COLUMN IF NOT EXISTS nombre_plan TEXT;
ALTER TABLE ofertas_competencia ADD COLUMN IF NOT EXISTS es_simetrico BOOLEAN DEFAULT TRUE;
ALTER TABLE ofertas_competencia ADD COLUMN IF NOT EXISTS fuente TEXT DEFAULT 'scraping_web';

-- 2. Insertar Operadoras (ON CONFLICT para no duplicar)
INSERT INTO operadores_competencia (nombre, color_hex, sitio_web, telefono, rif, instagram, tecnologia, cobertura_estados, logo_url) VALUES
('NetUno',           '#e63946', 'https://www.netuno.net.ve',       NULL,                  'J-30108335-0',  '@netuno_ve',          'Fibra Óptica / HFC', ARRAY['Distrito Capital','Miranda','Carabobo','Aragua','Lara','Zulia','Anzoátegui'], 'https://www.google.com/s2/favicons?sz=128&domain=netuno.net.ve'),
('Compu Futuro',     '#2196f3', 'https://www.compufuturo.net',     '+58 414-9043253',     NULL,            NULL,                  'Fibra Óptica',       NULL, 'https://www.google.com/s2/favicons?sz=128&domain=compufuturo.net'),
('Cable Norte',      '#ff9800', 'https://norteconecta.net',        NULL,                  NULL,            NULL,                  'Fibra Óptica',       NULL, 'https://www.google.com/s2/favicons?sz=128&domain=norteconecta.net'),
('Inter',            '#1565c0', 'https://inter.com.ve',            NULL,                  'J-30240664-1',  '@TuMundoInter',       'Fibra / HFC / Sat',  ARRAY['Distrito Capital','Miranda','Carabobo','Aragua','Zulia','Lara','Anzoátegui','Táchira','Mérida','Barinas','Bolívar'], 'https://www.google.com/s2/favicons?sz=128&domain=inter.com.ve'),
('ABA Ultra',        '#4caf50', NULL,                              NULL,                  NULL,            NULL,                  'ADSL / VDSL / FTTH', ARRAY['Nacional'], 'https://www.google.com/s2/favicons?sz=128&domain=cantv.com.ve'),
('Fibex Telecom',    '#ff5722', 'https://fibextelecom.net',        NULL,                  NULL,            NULL,                  'Fibra Óptica',       ARRAY['Carabobo','Aragua','Lara','Portuguesa','Cojedes','Yaracuy','Barinas'], 'https://www.google.com/s2/favicons?sz=128&domain=fibextelecom.net'),
('2 Net',            '#467ed1', 'https://2netvzla.com',            '+58 212-7504514',     'J-30339068-4',  '@2net_vzla',          'FTTH GPON',          ARRAY['Distrito Capital'], 'https://www.google.com/s2/favicons?sz=128&domain=2netvzla.com'),
('V-NET',            '#8e24aa', 'https://vnet.com.ve',             '0800-VNET-000',       'J-29705917-2',  '@vnet_ve',            'Fibra Óptica',       ARRAY['Distrito Capital','Miranda','Carabobo','Aragua','Lara','Zulia'], 'https://www.google.com/s2/favicons?sz=128&domain=vnet.com.ve'),
('WOW / MDS',        '#e91e63', 'https://wow.com.ve',              NULL,                  NULL,            NULL,                  'Fibra Óptica',       NULL, 'https://www.google.com/s2/favicons?sz=128&domain=wow.com.ve'),
('ProNet',           '#009688', NULL,                              NULL,                  NULL,            '@pronet.ftth.vzla',   'FTTH',               NULL, NULL),
('Thundernet',       '#ffc107', 'https://thundernet.com.ve',       NULL,                  NULL,            '@thundernetvzla',     'XGS-PON',            ARRAY['Barinas','Apure','Guárico','Portuguesa','Cojedes','Yaracuy','Lara','Falcón','Distrito Capital'], 'https://www.google.com/s2/favicons?sz=128&domain=thundernet.com.ve'),
('Servitel',         '#795548', NULL,                              NULL,                  NULL,            NULL,                  'Fibra Óptica',       NULL, NULL),
('SmartByte',        '#00bcd4', 'https://www.smartbyte.com.ve',    '+58 424-1342630',     'J-410737131',   '@smartbytevzla',      'Fibra Óptica',       ARRAY['Distrito Capital','Miranda'], 'https://www.google.com/s2/favicons?sz=128&domain=smartbyte.com.ve'),
('Simple Fibra',     '#f44336', 'https://fibra.simple.com.ve',     '0212-9175656',        'J-302597005',   NULL,                  'Fibra Óptica',       ARRAY['Distrito Capital','Miranda','Carabobo','Lara','Zulia'], 'https://www.google.com/s2/favicons?sz=128&domain=simple.com.ve'),
('Tu Red 18',        '#3f51b5', 'https://tured18.com',             NULL,                  NULL,            NULL,                  'Fibra Óptica',       NULL, 'https://www.google.com/s2/favicons?sz=128&domain=tured18.com'),
('SolucionTV 555',   '#ff6f00', 'https://soluciontv555.com.ve',    NULL,                  NULL,            NULL,                  'Cable / Fibra',      NULL, 'https://www.google.com/s2/favicons?sz=128&domain=soluciontv555.com.ve'),
('WellComm',         '#607d8b', 'https://wct.com.ve',              '+58 412-9936432',     NULL,            NULL,                  'Microondas / Fibra', NULL, 'https://www.google.com/s2/favicons?sz=128&domain=wct.com.ve'),
('Tech Pre',         '#9c27b0', NULL,                              NULL,                  NULL,            '@techpre',            'Fibra Óptica',       NULL, NULL),
('G-Network',        '#4caf50', 'https://gnetworkve.com',          '+58 212-7714341',     NULL,            NULL,                  'Fibra Óptica',       ARRAY['Distrito Capital','Miranda'], 'https://www.google.com/s2/favicons?sz=128&domain=gnetworkve.com'),
('Latin American Cable', '#1e88e5', 'https://latinamericancable.com', NULL,               NULL,            NULL,                  'Cable / Fibra',      NULL, 'https://www.google.com/s2/favicons?sz=128&domain=latinamericancable.com'),
('Full Data',        '#212121', 'https://www.fulldata.com.ve',     '+58 412-2853855',     'J-40958264-7',  NULL,                  'Fibra Óptica',       ARRAY['Zulia','Distrito Capital'], 'https://www.google.com/s2/favicons?sz=128&domain=fulldata.com.ve')
ON CONFLICT (nombre) DO UPDATE SET
  sitio_web = EXCLUDED.sitio_web,
  telefono = EXCLUDED.telefono,
  rif = EXCLUDED.rif,
  instagram = EXCLUDED.instagram,
  tecnologia = EXCLUDED.tecnologia,
  cobertura_estados = EXCLUDED.cobertura_estados,
  logo_url = EXCLUDED.logo_url;

-- 3. Insertar Ofertas (con asesor_nombre = 'Sistema (Scraping)')

-- ============ NETUNO ============
INSERT INTO ofertas_competencia (operador_id, estado, municipio, parroquia, tipo_novedad, velocidad_mb, precio_mensual, es_promocion, nombre_plan, es_simetrico, tecnologia, servicios_adicionales, fuente, fecha_reporte, asesor_nombre) VALUES
((SELECT id FROM operadores_competencia WHERE nombre='NetUno'), 'Nacional', 'General', 'General', 'Actualización General', 400, 27.00, false, 'NetUno Hogar 400', true, 'FTTH', '[{"nombre":"Telefonía","precio":"1","condicion":"Incluido"},{"nombre":"NetUno Go","precio":"7","condicion":"Incluido"},{"nombre":"Telemedicina","precio":"0","condicion":"Incluido"}]'::jsonb, 'scraping_web', CURRENT_DATE, 'Sistema (Scraping)'),
((SELECT id FROM operadores_competencia WHERE nombre='NetUno'), 'Nacional', 'General', 'General', 'Actualización General', 600, 41.00, false, 'NetUno Hogar 600', true, 'FTTH', '[{"nombre":"Telefonía","precio":"1","condicion":"Incluido"},{"nombre":"NetUno Go","precio":"0","condicion":"Incluido"},{"nombre":"Salud Integral","precio":"0","condicion":"Incluido"}]'::jsonb, 'scraping_web', CURRENT_DATE, 'Sistema (Scraping)'),
((SELECT id FROM operadores_competencia WHERE nombre='NetUno'), 'Nacional', 'General', 'General', 'Actualización General', 800, 57.00, false, 'NetUno Hogar 800', true, 'FTTH', '[{"nombre":"Telefonía","precio":"1","condicion":"Incluido"},{"nombre":"NetUno Go","precio":"0","condicion":"Incluido"},{"nombre":"Salud Integral","precio":"0","condicion":"Incluido"}]'::jsonb, 'scraping_web', CURRENT_DATE, 'Sistema (Scraping)');

-- ============ COMPU FUTURO ============
INSERT INTO ofertas_competencia (operador_id, estado, municipio, parroquia, tipo_novedad, velocidad_mb, precio_mensual, es_promocion, nombre_plan, es_simetrico, tecnologia, servicios_adicionales, modalidad_instalacion, fuente, fecha_reporte, asesor_nombre) VALUES
((SELECT id FROM operadores_competencia WHERE nombre='Compu Futuro'), 'Nacional', 'General', 'General', 'Actualización General', 50,  15.00, false, '50 Mbps',  true, 'FTTH', '[{"nombre":"Alquiler ONU","precio":"2","condicion":"Mensual"}]'::jsonb, 'Alquiler de Equipo', 'scraping_web', CURRENT_DATE, 'Sistema (Scraping)'),
((SELECT id FROM operadores_competencia WHERE nombre='Compu Futuro'), 'Nacional', 'General', 'General', 'Actualización General', 200, 25.00, false, '200 Mbps', true, 'FTTH', '[{"nombre":"Alquiler ONU","precio":"2","condicion":"Mensual"}]'::jsonb, 'Alquiler de Equipo', 'scraping_web', CURRENT_DATE, 'Sistema (Scraping)'),
((SELECT id FROM operadores_competencia WHERE nombre='Compu Futuro'), 'Nacional', 'General', 'General', 'Actualización General', 280, 35.00, false, '280 Mbps', true, 'FTTH', '[{"nombre":"Alquiler ONU","precio":"2","condicion":"Mensual"}]'::jsonb, 'Alquiler de Equipo', 'scraping_web', CURRENT_DATE, 'Sistema (Scraping)'),
((SELECT id FROM operadores_competencia WHERE nombre='Compu Futuro'), 'Nacional', 'General', 'General', 'Actualización General', 400, 50.00, false, '400 Mbps', true, 'FTTH', '[{"nombre":"Alquiler ONU","precio":"2","condicion":"Mensual"}]'::jsonb, 'Alquiler de Equipo', 'scraping_web', CURRENT_DATE, 'Sistema (Scraping)');

-- ============ 2 NET ============
INSERT INTO ofertas_competencia (operador_id, estado, municipio, parroquia, tipo_novedad, velocidad_mb, precio_mensual, es_promocion, nombre_plan, es_simetrico, tecnologia, servicios_adicionales, fuente, fecha_reporte, asesor_nombre) VALUES
((SELECT id FROM operadores_competencia WHERE nombre='2 Net'), 'Distrito Capital', 'Libertador', 'General', 'Actualización General', 400, 0, false, '400 Mbps', true, 'FTTH GPON', '[{"nombre":"IPTV +80 canales","precio":"0","condicion":"Incluido"}]'::jsonb, 'scraping_web', CURRENT_DATE, 'Sistema (Scraping)');

-- ============ THUNDERNET ============
INSERT INTO ofertas_competencia (operador_id, estado, municipio, parroquia, tipo_novedad, velocidad_mb, precio_mensual, es_promocion, nombre_plan, es_simetrico, tecnologia, servicios_adicionales, incluye_iptv, fuente, fecha_reporte, asesor_nombre) VALUES
((SELECT id FROM operadores_competencia WHERE nombre='Thundernet'), 'Nacional', 'General', 'General', 'Actualización General', 400,  0, false, 'ThunderLIFE',  true, 'XGS-PON', '[{"nombre":"Thundernet TV GO","precio":"0","condicion":"Incluido"}]'::jsonb, true, 'scraping_web', CURRENT_DATE, 'Sistema (Scraping)'),
((SELECT id FROM operadores_competencia WHERE nombre='Thundernet'), 'Nacional', 'General', 'General', 'Actualización General', 750,  0, false, 'ThunderVOLT',  true, 'XGS-PON', '[{"nombre":"Home Office Pro","precio":"0","condicion":"Incluido"},{"nombre":"Gaming sin Cortes","precio":"0","condicion":"Incluido"}]'::jsonb, false, 'scraping_web', CURRENT_DATE, 'Sistema (Scraping)'),
((SELECT id FROM operadores_competencia WHERE nombre='Thundernet'), 'Nacional', 'General', 'General', 'Actualización General', 1000, 0, false, 'ThunderPRO',   true, 'XGS-PON', '[{"nombre":"Latencia Ultra-Baja","precio":"0","condicion":"Incluido"},{"nombre":"Descargas Masivas","precio":"0","condicion":"Incluido"}]'::jsonb, false, 'scraping_web', CURRENT_DATE, 'Sistema (Scraping)'),
((SELECT id FROM operadores_competencia WHERE nombre='Thundernet'), 'Nacional', 'General', 'General', 'Actualización General', 2500, 0, false, 'ThunderSTORM', true, 'XGS-PON', '[]'::jsonb, false, 'scraping_web', CURRENT_DATE, 'Sistema (Scraping)'),
((SELECT id FROM operadores_competencia WHERE nombre='Thundernet'), 'Nacional', 'General', 'General', 'Actualización General', 10000, 0, false, 'ThunderX',   true, 'XGS-PON', '[]'::jsonb, false, 'scraping_web', CURRENT_DATE, 'Sistema (Scraping)');

-- ============ SIMPLE FIBRA ============
INSERT INTO ofertas_competencia (operador_id, estado, municipio, parroquia, tipo_novedad, velocidad_mb, precio_mensual, es_promocion, nombre_plan, es_simetrico, tecnologia, fuente, fecha_reporte, asesor_nombre) VALUES
((SELECT id FROM operadores_competencia WHERE nombre='Simple Fibra'), 'Nacional', 'General', 'General', 'Actualización General', 100,  10.00, false, '100 Mbps', true, 'FTTH', 'scraping_web', CURRENT_DATE, 'Sistema (Scraping)'),
((SELECT id FROM operadores_competencia WHERE nombre='Simple Fibra'), 'Nacional', 'General', 'General', 'Actualización General', 200,  11.00, false, '200 Mbps', true, 'FTTH', 'scraping_web', CURRENT_DATE, 'Sistema (Scraping)'),
((SELECT id FROM operadores_competencia WHERE nombre='Simple Fibra'), 'Nacional', 'General', 'General', 'Actualización General', 300,  12.00, false, '300 Mbps', true, 'FTTH', 'scraping_web', CURRENT_DATE, 'Sistema (Scraping)'),
((SELECT id FROM operadores_competencia WHERE nombre='Simple Fibra'), 'Nacional', 'General', 'General', 'Actualización General', 400,  13.00, false, '400 Mbps', true, 'FTTH', 'scraping_web', CURRENT_DATE, 'Sistema (Scraping)'),
((SELECT id FROM operadores_competencia WHERE nombre='Simple Fibra'), 'Nacional', 'General', 'General', 'Actualización General', 500,  15.00, false, '500 Mbps', true, 'FTTH', 'scraping_web', CURRENT_DATE, 'Sistema (Scraping)'),
((SELECT id FROM operadores_competencia WHERE nombre='Simple Fibra'), 'Nacional', 'General', 'General', 'Actualización General', 600,  17.00, false, '600 Mbps', true, 'FTTH', 'scraping_web', CURRENT_DATE, 'Sistema (Scraping)'),
((SELECT id FROM operadores_competencia WHERE nombre='Simple Fibra'), 'Nacional', 'General', 'General', 'Actualización General', 800,  25.00, false, '800 Mbps', true, 'FTTH', 'scraping_web', CURRENT_DATE, 'Sistema (Scraping)'),
((SELECT id FROM operadores_competencia WHERE nombre='Simple Fibra'), 'Nacional', 'General', 'General', 'Actualización General', 1000, 30.00, false, '1 Gbps',   true, 'FTTH', 'scraping_web', CURRENT_DATE, 'Sistema (Scraping)');

-- ============ G-NETWORK ============
INSERT INTO ofertas_competencia (operador_id, estado, municipio, parroquia, tipo_novedad, velocidad_mb, precio_mensual, es_promocion, nombre_plan, es_simetrico, tecnologia, incluye_iptv, fuente, fecha_reporte, asesor_nombre) VALUES
((SELECT id FROM operadores_competencia WHERE nombre='G-Network'), 'Distrito Capital', 'General', 'General', 'Actualización General', 400,  0, false, 'Bronce',   true, 'FTTH', true, 'scraping_web', CURRENT_DATE, 'Sistema (Scraping)'),
((SELECT id FROM operadores_competencia WHERE nombre='G-Network'), 'Distrito Capital', 'General', 'General', 'Actualización General', 500,  0, false, 'Plata',    true, 'FTTH', true, 'scraping_web', CURRENT_DATE, 'Sistema (Scraping)'),
((SELECT id FROM operadores_competencia WHERE nombre='G-Network'), 'Distrito Capital', 'General', 'General', 'Actualización General', 600,  0, false, 'Oro',      true, 'FTTH', true, 'scraping_web', CURRENT_DATE, 'Sistema (Scraping)'),
((SELECT id FROM operadores_competencia WHERE nombre='G-Network'), 'Distrito Capital', 'General', 'General', 'Actualización General', 1000, 0, false, 'Diamante', true, 'FTTH', true, 'scraping_web', CURRENT_DATE, 'Sistema (Scraping)');

-- ============ WELLCOMM ============
INSERT INTO ofertas_competencia (operador_id, estado, municipio, parroquia, tipo_novedad, velocidad_mb, precio_mensual, es_promocion, nombre_plan, es_simetrico, tecnologia, fuente, fecha_reporte, asesor_nombre) VALUES
((SELECT id FROM operadores_competencia WHERE nombre='WellComm'), 'Nacional', 'General', 'General', 'Actualización General', 20, 0, false, '20 Mbps', true, 'Microondas', 'scraping_web', CURRENT_DATE, 'Sistema (Scraping)'),
((SELECT id FROM operadores_competencia WHERE nombre='WellComm'), 'Nacional', 'General', 'General', 'Actualización General', 30, 0, false, '30 Mbps', true, 'Microondas', 'scraping_web', CURRENT_DATE, 'Sistema (Scraping)'),
((SELECT id FROM operadores_competencia WHERE nombre='WellComm'), 'Nacional', 'General', 'General', 'Actualización General', 40, 0, false, '40 Mbps', true, 'Microondas', 'scraping_web', CURRENT_DATE, 'Sistema (Scraping)'),
((SELECT id FROM operadores_competencia WHERE nombre='WellComm'), 'Nacional', 'General', 'General', 'Actualización General', 50, 0, false, '50 Mbps', true, 'Microondas', 'scraping_web', CURRENT_DATE, 'Sistema (Scraping)'),
((SELECT id FROM operadores_competencia WHERE nombre='WellComm'), 'Nacional', 'General', 'General', 'Actualización General', 60, 0, false, '60 Mbps', true, 'Microondas', 'scraping_web', CURRENT_DATE, 'Sistema (Scraping)');

-- ============ LATIN AMERICAN CABLE ============
INSERT INTO ofertas_competencia (operador_id, estado, municipio, parroquia, tipo_novedad, velocidad_mb, precio_mensual, es_promocion, nombre_plan, es_simetrico, tecnologia, servicios_adicionales, fuente, fecha_reporte, asesor_nombre) VALUES
((SELECT id FROM operadores_competencia WHERE nombre='Latin American Cable'), 'Nacional', 'General', 'General', 'Actualización General', 10, 0, false, 'Residencial 10MB', false, 'Fibra', '[{"nombre":"TV Cable +100 canales","precio":"0","condicion":"Opcional"}]'::jsonb, 'scraping_web', CURRENT_DATE, 'Sistema (Scraping)'),
((SELECT id FROM operadores_competencia WHERE nombre='Latin American Cable'), 'Nacional', 'General', 'General', 'Actualización General', 20, 0, false, 'Residencial 20MB', false, 'Fibra', '[{"nombre":"TV Cable +100 canales","precio":"0","condicion":"Opcional"}]'::jsonb, 'scraping_web', CURRENT_DATE, 'Sistema (Scraping)'),
((SELECT id FROM operadores_competencia WHERE nombre='Latin American Cable'), 'Nacional', 'General', 'General', 'Actualización General', 50, 0, false, 'Residencial 50MB', false, 'Fibra', '[{"nombre":"TV Cable +100 canales","precio":"0","condicion":"Opcional"}]'::jsonb, 'scraping_web', CURRENT_DATE, 'Sistema (Scraping)');

-- ============ FULL DATA ============
INSERT INTO ofertas_competencia (operador_id, estado, municipio, parroquia, tipo_novedad, velocidad_mb, precio_mensual, es_promocion, nombre_plan, es_simetrico, tecnologia, costo_instalacion, fuente, fecha_reporte, asesor_nombre) VALUES
((SELECT id FROM operadores_competencia WHERE nombre='Full Data'), 'Nacional', 'General', 'General', 'Actualización General', 600,  0, false, 'Plan Mini',  true, 'FTTH', 0, 'scraping_web', CURRENT_DATE, 'Sistema (Scraping)'),
((SELECT id FROM operadores_competencia WHERE nombre='Full Data'), 'Nacional', 'General', 'General', 'Actualización General', 1000, 0, false, 'Plan Lite',  true, 'FTTH', 0, 'scraping_web', CURRENT_DATE, 'Sistema (Scraping)'),
((SELECT id FROM operadores_competencia WHERE nombre='Full Data'), 'Nacional', 'General', 'General', 'Actualización General', 1500, 0, false, 'Plan Ultra', true, 'FTTH', 0, 'scraping_web', CURRENT_DATE, 'Sistema (Scraping)'),
((SELECT id FROM operadores_competencia WHERE nombre='Full Data'), 'Nacional', 'General', 'General', 'Actualización General', 2500, 0, false, 'Plan Meta',  true, 'FTTH', 0, 'scraping_web', CURRENT_DATE, 'Sistema (Scraping)');
