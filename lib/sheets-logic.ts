/**
 * sheets-logic.ts
 * 
 * Replica exacta de la lógica de Power Query de PowerBI.
 * Transforma filas crudas de Google Sheets al formato de la tabla `installations`.
 * 
 * Fuente: Editor Avanzado de Power Query (código M) del archivo "Planificacion 2026.pbix"
 */

// ============================================================
// MAPEO DE OFICINAS (extraído de "Columna condicional agregada1")
// ============================================================
export const OFICINA_MAP: Record<string, string> = {
  // COMERCIALIZACION (18 asesores)
  "CINDY INFANTE": "COMERCIALIZACION",
  "YAISEN HERRERA": "COMERCIALIZACION",
  "LORENA ESQUEDA": "COMERCIALIZACION",
  "ROXANA YEPEZ": "COMERCIALIZACION",
  "CARLOS RUIZ": "COMERCIALIZACION",
  "MARIANGEL SOTO": "COMERCIALIZACION",
  "GABRIELA TERMOTTO": "COMERCIALIZACION",
  "MARIA QUINTERO": "COMERCIALIZACION",
  "HAYMAR BARROS": "COMERCIALIZACION",
  "PATRICIA MENDOZA": "COMERCIALIZACION",
  "YAIRLIN ROJAS": "COMERCIALIZACION",
  "GENESIS OCHOA": "COMERCIALIZACION",
  "YESENIA TERAN": "COMERCIALIZACION",
  "YANELY DAVILA": "COMERCIALIZACION",
  "SALEM CALDERA": "COMERCIALIZACION",
  "MICHEL OCHOA": "COMERCIALIZACION",
  "DIEGO RODRIGUEZ": "COMERCIALIZACION",
  "BRAYERLIN RODRIGUEZ": "COMERCIALIZACION",
  // EL VALLE (2)
  "HECTOR MENDOZA": "EL VALLE",
  "NEISBETH PRAZUELA": "EL VALLE",
  // PROPATRIA (1) — Nota: en PowerBI aparece como "PROPRATIA" (typo original)
  "DADIUSKA RINCONES": "PROPATRIA",
  // ALI PRIMERA (2)
  "IVOON VIANA": "ALI PRIMERA",
  "VIVIANA CARREÑO": "ALI PRIMERA",
  // LA COLINA (3)
  "LISBRAY SUAREZ": "LA COLINA",
  "ESMERALDA DELGADO": "LA COLINA",
  "YENIFFER TORRES": "LA COLINA",
  // PLANIFICACION (1)
  "PLANIFICACION": "PLANIFICACION",
  // INDEPENDENCIA (2)
  "RODGER INFANTE": "INDEPENDENCIA",
  "ALEJANDRO SANCHEZ": "INDEPENDENCIA",
};

// ============================================================
// MAPEO DE COLUMNAS (extraído de "Columnas con nombre cambiado")
// ============================================================
// Column1=TECNICO3, Column2=FECHA, Column3=MES, Column4=EQUIPO(removed),
// Column5=TECNICO1, Column6=TECNICO2, Column7=ROUTER, Column8=N°(removed),
// Column9=NOMBRE, Column10=CEDULA, Column11=ZONA, Column12=SECTOR,
// Column13=ASESOR, Column14=ESTATUS, Column15=PLAN, Column16=POWER_GO
const COL = {
  TECNICO_3: 0,   // Column1
  FECHA: 1,       // Column2
  MES: 2,         // Column3
  // EQUIPO: 3,   // Column4 — REMOVIDO en PowerBI
  TECNICO_1: 4,   // Column5
  TECNICO_2: 5,   // Column6
  ROUTER: 6,      // Column7 (renamed to RAUTER in PowerBI)
  // NUMERO: 7,   // Column8 — REMOVIDO en PowerBI
  NOMBRE: 8,      // Column9
  CEDULA: 9,      // Column10
  ZONA: 10,       // Column11
  SECTOR: 11,     // Column12
  ASESOR: 12,     // Column13
  ESTATUS: 13,    // Column14
  PLAN: 14,       // Column15
  POWER_GO: 15,   // Column16
} as const;

// ============================================================
// TIPO DE RETORNO
// ============================================================
export interface ProcessedInstallation {
  fecha: string;           // YYYY-MM-DD
  mes: string;
  tecnico_1: string;
  tecnico_2: string | null;
  router: string;          // vacío → "0" (Valor reemplazado5)
  nombre_cliente: string;
  cedula: string;
  zona: string;
  sector: string;
  asesor: string;
  estatus: string;         // "INSTALACION." → "INSTALACION" (Valor reemplazado4)
  plan: string;            // MBM/MBC/MBE→MB, GBC→GB
  power_go: string;
  servicio: string;        // Calculado: G/J → CORPORATIVO, else RESIDENCIAL
  oficina: string;         // Calculado: OFICINA_MAP[asesor] || "OTROS"
  estado: string | null;   // Calculado: zona → MIRANDA/ARAGUA/D.C./null
}

// ============================================================
// NORMALIZACIÓN DE PLAN
// Pasos: "Valor reemplazado", "Valor reemplazado1", "Valor reemplazado2", "Valor reemplazado3"
// ============================================================
function normalizePlan(raw: string): string {
  return raw
    .replace(/MBM/g, "MB")
    .replace(/MBC/g, "MB")
    .replace(/MBE/g, "MB")
    .replace(/GBC/g, "GB");
}

// ============================================================
// NORMALIZACIÓN DE ESTATUS
// Paso: "Valor reemplazado4"
// ============================================================
function normalizeEstatus(raw: string): string {
  return raw.replace(/INSTALACION\./g, "INSTALACION");
}

// ============================================================
// CÁLCULO DE SERVICIO
// Paso: "Columna condicional agregada"
// ============================================================
function calculateServicio(cedula: string): string {
  if (cedula.startsWith("G") || cedula.startsWith("J")) {
    return "CORPORATIVO";
  }
  return "RESIDENCIAL";
}

// ============================================================
// CÁLCULO DE ESTADO
// Paso: "Columna condicional agregada2" ("Personalizado")
// ============================================================
function calculateEstado(zona: string): string | null {
  const z = zona.toUpperCase();
  if (z.startsWith("LOS TEQUES") || z.startsWith("SAN DIEGO") ||
      z.startsWith("SAN ANTONIO") || z.startsWith("CARRIZAL")) {
    return "MIRANDA";
  }
  if (z.startsWith("TEJERIAS")) {
    return "ARAGUA";
  }
  if (z.startsWith("DISTRITO CAPITAL")) {
    return "DISTRITO CAPITAL";
  }
  return null;
}

// ============================================================
// FORMATEO DE FECHA
// Convierte valores de fecha del Sheets a YYYY-MM-DD
// ============================================================
function parseSheetDate(rawDate: any): string {
  if (!rawDate) return "";
  
  const str = String(rawDate).trim();
  
  // Si ya es YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  
  // Formato con "/" → DD/MM/YYYY o DD/MM o DD/M (formato del Sheet)
  if (str.includes("/")) {
    const parts = str.split("/");
    
    if (parts.length === 2) {
      // "13/1" o "5/12" → DD/M (sin año, asumir 2026)
      const day = parts[0].padStart(2, "0");
      const month = parts[1].padStart(2, "0");
      return `2026-${month}-${day}`;
    }
    
    if (parts.length === 3) {
      // "13/1/2026" o "1/13/2026" 
      const [p1, p2, p3] = parts;
      // Asumimos DD/MM/YYYY (formato latino)
      const day = p1.padStart(2, "0");
      const month = p2.padStart(2, "0");
      const year = p3.length === 2 ? `20${p3}` : p3;
      return `${year}-${month}-${day}`;
    }
  }
  
  // Si viene como serial number de Google Sheets (días desde 1899-12-30)
  const num = Number(str);
  if (!isNaN(num) && num > 40000 && num < 60000) {
    const epoch = new Date(1899, 11, 30); // Dec 30, 1899
    epoch.setDate(epoch.getDate() + num);
    const year = epoch.getFullYear();
    const month = String(epoch.getMonth() + 1).padStart(2, "0");
    const day = String(epoch.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  
  // Fallback: intentar parsear como Date
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  } catch {
    // fallthrough
  }
  
  return str;
}

// ============================================================
// PROCESAMIENTO PRINCIPAL
// Replica el flujo completo de Power Query
// ============================================================
export function processSheetData(rawRows: any[][]): ProcessedInstallation[] {
  const results: ProcessedInstallation[] = [];

  // Paso 1: "Filas superiores quitadas" — Table.Skip(2)
  const dataRows = rawRows.slice(2);

  for (const row of dataRows) {
    // Paso 2: "Filas filtradas" — FECHA no vacía y no es cabecera
    const rawFecha = String(row[COL.FECHA] ?? "").trim();
    if (!rawFecha || rawFecha === "FECHA") continue;

    // Extraer campos
    const asesor = String(row[COL.ASESOR] ?? "").trim().toUpperCase();

    // Paso 3: "Filas filtradas1" — ASESOR no vacío
    if (!asesor) continue;

    const cedula = String(row[COL.CEDULA] ?? "").trim().toUpperCase();
    const zona = String(row[COL.ZONA] ?? "").trim().toUpperCase();
    const rawPlan = String(row[COL.PLAN] ?? "").trim().toUpperCase();
    const rawEstatus = String(row[COL.ESTATUS] ?? "").trim().toUpperCase();
    const rawRouter = String(row[COL.ROUTER] ?? "").trim();

    results.push({
      fecha: parseSheetDate(rawFecha),
      mes: String(row[COL.MES] ?? "").trim().toUpperCase(),
      tecnico_1: String(row[COL.TECNICO_1] ?? "").trim().toUpperCase(),
      tecnico_2: row[COL.TECNICO_2] ? String(row[COL.TECNICO_2]).trim().toUpperCase() : null,
      // Paso "Valor reemplazado5": vacío → "0"
      router: rawRouter === "" ? "0" : rawRouter,
      nombre_cliente: String(row[COL.NOMBRE] ?? "").trim().toUpperCase(),
      cedula,
      zona,
      sector: String(row[COL.SECTOR] ?? "").trim().toUpperCase(),
      asesor,
      // Paso "Valor reemplazado4": "INSTALACION." → "INSTALACION"
      estatus: normalizeEstatus(rawEstatus),
      // Pasos "Valor reemplazado" 0-3: MBM/MBC/MBE→MB, GBC→GB
      plan: normalizePlan(rawPlan),
      power_go: String(row[COL.POWER_GO] ?? "").trim().toUpperCase(),
      // "Columna condicional agregada": SERVICIO
      servicio: calculateServicio(cedula),
      // "Columna condicional agregada1": OFICINA
      oficina: OFICINA_MAP[asesor] || "OTROS",
      // "Columna condicional agregada2": ESTADO (Personalizado)
      estado: calculateEstado(zona),
    });
  }

  return results;
}

// ============================================================
// ESTADÍSTICAS DE SYNC (para la respuesta del API)
// ============================================================
export interface SyncResult {
  total_rows_read: number;
  rows_processed: number;
  rows_inserted: number;
  rows_updated: number;
  rows_skipped: number;
  errors: string[];
  timestamp: string;
}
