import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";
import { processSheetData, type SyncResult } from "@/lib/sheets-logic";

const SHEET_ID = process.env.GOOGLE_SHEET_ID!;
const SHEET_TAB = "CUADRO DIARIO";
const SHEET_RANGE = `'${SHEET_TAB}'!A:P`; // Columns A through P (16 columns)

/**
 * POST /api/sync
 * 
 * Sincroniza datos de Google Sheets → Supabase.
 * Solo accesible para usuarios con rol "admin".
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Verify admin access
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("roles")
      .eq("id", user.id)
      .single();

    const roles = (profile?.roles || []).map((r: string) => r.toLowerCase());
    if (!roles.includes("admin")) {
      return NextResponse.json({ error: "Acceso denegado. Solo administradores." }, { status: 403 });
    }

    // 2. Connect to Google Sheets API
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_SYNC_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    // 3. Read sheet data
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: SHEET_RANGE,
    });

    const rawRows = response.data.values;

    if (!rawRows || rawRows.length === 0) {
      return NextResponse.json({
        error: "La hoja está vacía o no se pudo leer.",
        total_rows_read: 0,
      }, { status: 400 });
    }

    // 4. Process data using PowerBI logic
    const processed = processSheetData(rawRows);

    // 5. TRUNCATE + INSERT (Sheets es la única fuente de verdad)
    const result: SyncResult = {
      total_rows_read: rawRows.length,
      rows_processed: processed.length,
      rows_inserted: 0,
      rows_updated: 0,
      rows_skipped: 0,
      errors: [],
      timestamp: new Date().toISOString(),
    };

    // Clear existing data — Sheets is the single source of truth
    const { error: truncateError } = await supabase
      .from("installations")
      .delete()
      .gte("id", 0); // Supabase requires a filter, this deletes all rows

    if (truncateError) {
      return NextResponse.json({
        error: "Error al limpiar datos existentes",
        details: truncateError.message,
      }, { status: 500 });
    }

    // Insert all processed data in batches of 500
    const BATCH_SIZE = 500;
    for (let i = 0; i < processed.length; i += BATCH_SIZE) {
      const batch = processed.slice(i, i + BATCH_SIZE);

      const { error } = await supabase
        .from("installations")
        .insert(
          batch.map((row) => ({
            fecha: row.fecha,
            mes: row.mes,
            tecnico_1: row.tecnico_1,
            tecnico_2: row.tecnico_2,
            router: row.router,
            nombre_cliente: row.nombre_cliente,
            cedula: row.cedula,
            zona: row.zona,
            sector: row.sector,
            asesor: row.asesor,
            estatus: row.estatus,
            plan: row.plan,
            power_go: row.power_go,
            servicio: row.servicio,
            oficina: row.oficina,
            estado: row.estado,
          }))
        );

      if (error) {
        result.errors.push(`Batch ${i}-${i + batch.length}: ${error.message}`);
      } else {
        result.rows_inserted += batch.length;
      }
    }

    // 6. Save last sync timestamp
    await supabase.from("system_settings").upsert({
      key: "last_sheets_sync",
      value: {
        timestamp: result.timestamp,
        rows_processed: result.rows_processed,
        rows_inserted: result.rows_inserted,
        errors_count: result.errors.length,
        duration_ms: Date.now() - startTime,
      },
      description: "Última sincronización con Google Sheets",
    });

    return NextResponse.json(result);

  } catch (error: any) {
    console.error("[SYNC ERROR]", error);
    return NextResponse.json(
      {
        error: "Error durante la sincronización",
        details: error.message || String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sync
 * 
 * Retorna el estado de la última sincronización.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "last_sheets_sync")
      .single();

    return NextResponse.json({
      last_sync: data?.value || null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
