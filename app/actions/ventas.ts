"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { google } from "googleapis";

// ── Helpers ─────────────────────────────────────────────────────

/** Get today's date string (YYYY-MM-DD) in Venezuela time (UTC-4) */
function getVenezuelaToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" });
}

// ── Config Loaders ──────────────────────────────────────────────

export async function getVentasConfig() {
  const supabase = await createClient();

  const [geodataRes, planesRes] = await Promise.all([
    supabase
      .from("geodata_config")
      .select("*")
      .order("estado")
      .order("municipio")
      .order("parroquia")
      .order("sector"),
    supabase.from("planes_config").select("*").order("nombre"),
  ]);

  // Build geo hierarchy: { Estado: { Municipio: { Parroquia: [Sector] } } }
  const geoHierarchy: Record<string, Record<string, Record<string, string[]>>> = {};
  if (geodataRes.data) {
    geodataRes.data.forEach((row: any) => {
      const e = row.estado || "N/A";
      const m = row.municipio || "N/A";
      const p = row.parroquia || "N/A";
      const s = row.sector || "N/A";
      if (!geoHierarchy[e]) geoHierarchy[e] = {};
      if (!geoHierarchy[e][m]) geoHierarchy[e][m] = {};
      if (!geoHierarchy[e][m][p]) geoHierarchy[e][m][p] = [];
      if (!geoHierarchy[e][m][p].includes(s)) {
        geoHierarchy[e][m][p].push(s);
      }
    });
  }

  return {
    geoHierarchy,
    planes: planesRes.data || [],
  };
}

// ── Geodata CRUD (Admin) ──────────────────────────────────────────

export async function addGeodata(row: { estado: string, municipio: string, parroquia: string, sector?: string }) {
  const supabase = await createClient();
  const { error } = await supabase.from("geodata_config").insert([row]);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/geodata");
  revalidatePath("/ventas");
}

export async function deleteGeodata(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("geodata_config").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/geodata");
  revalidatePath("/ventas");
}

// ── Planes CRUD (Admin) ───────────────────────────────────────────

export async function getPlanes() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planes_config")
    .select("*")
    .order("tipo")
    .order("nombre");
  if (error) throw new Error(error.message);
  return data || [];
}

export async function addPlan(plan: { nombre: string; tipo: string; activo: boolean; has_tv: boolean }) {
  const supabase = await createClient();
  const { error } = await supabase.from("planes_config").insert([plan]);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/planes");
  revalidatePath("/ventas");
}

export async function updatePlan(id: number, plan: { nombre?: string; tipo?: string; activo?: boolean; has_tv?: boolean }) {
  const supabase = await createClient();
  const { error } = await supabase.from("planes_config").update(plan).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/planes");
  revalidatePath("/ventas");
}

export async function deletePlan(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("planes_config").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/planes");
  revalidatePath("/ventas");
}

// ── Actividades ──────────────────────────────────────────────────

export async function getActividades(asesor?: string, fecha?: string, cerrada?: boolean) {
  const supabase = await createClient();
  let query = supabase
    .from("actividades")
    .select("*, solicitudes_vinculadas:solicitudes(count)")
    .order("created_at", { ascending: false });

  if (asesor) query = query.eq("asesor", asesor);
  if (fecha) query = query.eq("fecha", fecha);
  if (cerrada !== undefined) query = query.eq("cerrada", cerrada);

  const { data, error } = await query.limit(100);
  if (error) {
    // Fallback if the join doesn't work (table not migrated yet)
    let fallback = supabase
      .from("actividades")
      .select("*")
      .order("created_at", { ascending: false });
    if (asesor) fallback = fallback.eq("asesor", asesor);
    if (fecha) fallback = fallback.eq("fecha", fecha);
    if (cerrada !== undefined) fallback = fallback.eq("cerrada", cerrada);
    const { data: fbData } = await fallback.limit(100);
    return (fbData || []).map((a: any) => ({ ...a, solicitudes_count: 0 }));
  }

  return (data || []).map((a: any) => ({
    ...a,
    solicitudes_count: a.solicitudes_vinculadas?.[0]?.count || 0,
  }));
}

export async function saveActividad(activity: {
  fecha: string;
  hora: string;
  asesor: string;
  tipo: string;
  clientes_captados?: number;
  volantes?: number;
  llamadas_info?: number;
  llamadas_agenda?: number;
  estado: string;
  municipio: string;
  parroquia: string;
  sector?: string;
  condominio?: string;
  notas?: string;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("actividades")
    .insert([activity])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ── Helpers de formato ─────────────────────────────────────────

function formatFechaSheets(fecha: string): string {
  if (fecha.includes("-")) {
    const [yyyy, mm, dd] = fecha.split("-");
    return `${parseInt(dd)}/${parseInt(mm)}/${yyyy}`;
  }
  return fecha;
}

function formatHoraSheets(hora: string): string {
  if (hora && hora.includes(":")) {
    try {
      const [h, m] = hora.split(":");
      const hour = parseInt(h);
      const min = m.split(" ")[0];
      const period = hour >= 12 ? "p. m." : "a. m.";
      const h12 = hour % 12 || 12;
      return `${h12.toString().padStart(2, "0")}:${min} ${period}`;
    } catch (e) {
      return hora;
    }
  }
  return hora;
}

// ── Sincronización con Google Sheets (al cierre de jornada) ───

export async function sincronizarConSheets(
  actividades: any[],
  solicitudesPorActividad: Record<number, number>,
  llamadasPorActividad: Record<number, number>,
  solicitudesHuerfanas?: any[]
) {
  try {
    const serviceAccountEmail = process.env.GOOGLE_CLIENT_EMAIL;
    let rawKey = process.env.GOOGLE_PRIVATE_KEY || "";
    if (rawKey.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(rawKey);
        if (parsed.private_key) rawKey = parsed.private_key;
      } catch (e) {
        console.warn("No se pudo parsear GOOGLE_PRIVATE_KEY como JSON");
      }
    }
    const privateKey = rawKey.replace(/\\n/g, '\n');
    const sheetId = process.env.GOOGLE_SHEETS_ACTIVIDADES_ID;

    if (!serviceAccountEmail || !privateKey || !sheetId) {
      console.warn("Faltan variables de entorno para Google Sheets");
      return;
    }

    const auth = new google.auth.JWT({
      email: serviceAccountEmail,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    // Filas de actividades con datos FINALES
    const rows = actividades.map((act: any) => [
      formatFechaSheets(act.fecha || ""),
      formatHoraSheets(act.hora || ""),
      act.asesor || "",
      act.estado || "",
      act.municipio || "",
      act.parroquia || "",
      act.sector || "",
      act.tipo || "",
      solicitudesPorActividad[act.id] || 0,
      act.clientes_captados || 0,
      act.volantes || 0,
      act.llamadas_info || 0,
      llamadasPorActividad[act.id] || 0,
      act.condominio || "",
      act.notas || "",
      act.id || "",
    ]);

    // Filas de solicitudes huérfanas (sin actividad vinculada)
    if (solicitudesHuerfanas && solicitudesHuerfanas.length > 0) {
      solicitudesHuerfanas.forEach((sol: any) => {
        const fechaSol = sol.fecha_solicitud ? sol.fecha_solicitud.split("T")[0] : "";
        // Extraer hora de created_at (Venezuela = UTC-4)
        let horaSol = "";
        if (sol.created_at) {
          const d = new Date(sol.created_at);
          d.setHours(d.getHours() - 4); // UTC -> Venezuela
          const hh = d.getUTCHours().toString().padStart(2, "0");
          const mm = d.getUTCMinutes().toString().padStart(2, "0");
          horaSol = `${hh}:${mm}`;
        }
        rows.push([
          formatFechaSheets(fechaSol),
          horaSol,
          sol.promotor || "",
          sol.estado || "",
          sol.municipio || "",
          sol.parroquia || "",
          sol.sector || "",
          "Fuera de Actividad",  // tipo
          1,  // solicitudes = 1
          0,  // clientes captados
          0,  // volantes
          0,  // llamadas info
          sol.fuente === "Llamada" ? 1 : 0,  // llamadas agenda
          "",  // condominio
          `${sol.fuente || ""} - ${sol.nombres || ""} ${sol.apellidos || ""}`,  // notas: fuente + nombre
          sol.id || "",
        ]);
      });
    }

    if (rows.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: "REPORTES DE ASESORES!A:P",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: rows },
      });
    }
  } catch (err) {
    console.error("Error sincronizando con Google Sheets:", err);
  }
}

export async function deleteActividad(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("actividades").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Solicitudes ──────────────────────────────────────────────────

export async function getSolicitudes(filters?: {
  promotor?: string;
  desde?: string;
  hasta?: string;
  search?: string;
}) {
  const supabase = await createClient();
  let query = supabase
    .from("solicitudes")
    .select("*")
    .order("fecha_solicitud", { ascending: false });

  if (filters?.promotor) query = query.eq("promotor", filters.promotor);
  if (filters?.desde) query = query.gte("fecha_solicitud", filters.desde);
  if (filters?.hasta) query = query.lte("fecha_solicitud", filters.hasta + "T23:59:59");
  if (filters?.search) {
    query = query.or(
      `nombres.ilike.%${filters.search}%,apellidos.ilike.%${filters.search}%,cedula.ilike.%${filters.search}%`
    );
  }

  const { data, error } = await query.limit(200);
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getSolicitudesDelDia(promotor: string, fecha: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("solicitudes")
    .select("*")
    .eq("promotor", promotor)
    .gte("fecha_solicitud", fecha + "T00:00:00")
    .lte("fecha_solicitud", fecha + "T23:59:59")
    .order("fecha_solicitud", { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getSolicitudesPorActividades(actividadesIds: number[]) {
  if (!actividadesIds || actividadesIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("solicitudes")
    .select("*")
    .in("actividad_id", actividadesIds)
    .order("fecha_solicitud", { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

/** Obtener solicitudes del día que NO están vinculadas a ninguna actividad */
export async function getSolicitudesDelDiaSinActividad(promotor: string, fecha: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("solicitudes")
    .select("*")
    .eq("promotor", promotor)
    .gte("fecha_solicitud", fecha + "T00:00:00")
    .lte("fecha_solicitud", fecha + "T23:59:59")
    .is("actividad_id", null)
    .order("fecha_solicitud", { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getActividadesDelDia(asesor: string) {
  const supabase = await createClient();
  const todayStr = getVenezuelaToday();
  const { data, error } = await supabase
    .from("actividades")
    .select("id, tipo, hora, parroquia, sector")
    .eq("asesor", asesor)
    .eq("fecha", todayStr)
    .eq("cerrada", false)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

// ── Cierre de Jornada ───────────────────────────────────────────

/** Mark all of today's activities as cerrada for an asesor */
export async function cerrarJornada(asesor: string, fecha: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("actividades")
    .update({ cerrada: true })
    .eq("asesor", asesor)
    .eq("fecha", fecha)
    .eq("cerrada", false)
    .select("id");

  if (error) throw new Error(error.message);
  return { cerradas: data?.length || 0 };
}

/** Auto-close activities from days before today (Venezuela time) and sync to Sheets */
export async function autoCerrarActividadesAntiguas(asesor: string) {
  const supabase = await createClient();
  const todayStr = getVenezuelaToday();

  // Obtener las actividades abiertas de días anteriores ANTES de cerrarlas
  const { data: actividadesAbiertas } = await supabase
    .from("actividades")
    .select("*")
    .eq("asesor", asesor)
    .eq("cerrada", false)
    .lt("fecha", todayStr);

  // Cerrar las actividades
  const { data, error } = await supabase
    .from("actividades")
    .update({ cerrada: true })
    .eq("asesor", asesor)
    .eq("cerrada", false)
    .lt("fecha", todayStr)
    .select("id");

  if (error) throw new Error(error.message);

  // Sincronizar con Sheets las actividades que se auto-cerraron
  if (actividadesAbiertas && actividadesAbiertas.length > 0) {
    try {
      const ids = actividadesAbiertas.map((a: any) => a.id);
      const solicitudes = await getSolicitudesPorActividades(ids);

      const solicitudesPorActividad: Record<number, number> = {};
      const llamadasPorActividad: Record<number, number> = {};
      ids.forEach((id: number) => {
        solicitudesPorActividad[id] = solicitudes.filter((s: any) => s.actividad_id === id).length;
        llamadasPorActividad[id] = solicitudes.filter((s: any) => s.actividad_id === id && s.fuente === "Llamada").length;
      });

      // Buscar solicitudes huérfanas de esos días
      const fechas = [...new Set(actividadesAbiertas.map((a: any) => a.fecha))];
      let huerfanas: any[] = [];
      for (const fecha of fechas) {
        const h = await getSolicitudesDelDiaSinActividad(asesor, fecha as string);
        huerfanas = huerfanas.concat(h);
      }

      await sincronizarConSheets(actividadesAbiertas, solicitudesPorActividad, llamadasPorActividad, huerfanas);
    } catch (e) {
      console.error("Error sincronizando actividades auto-cerradas con Sheets:", e);
    }
  }

  return { cerradas: data?.length || 0 };
}

/** Get closed activities for the historial view */
export async function getHistorialActividades(asesor?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("actividades")
    .select("*, solicitudes_vinculadas:solicitudes(count)")
    .eq("cerrada", true)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });

  if (asesor) query = query.eq("asesor", asesor);

  const { data, error } = await query.limit(200);
  if (error) {
    let fallback = supabase
      .from("actividades")
      .select("*")
      .eq("cerrada", true)
      .order("fecha", { ascending: false });
    if (asesor) fallback = fallback.eq("asesor", asesor);
    const { data: fbData } = await fallback.limit(200);
    return (fbData || []).map((a: any) => ({ ...a, solicitudes_count: 0 }));
  }

  return (data || []).map((a: any) => ({
    ...a,
    solicitudes_count: a.solicitudes_vinculadas?.[0]?.count || 0,
  }));
}

export async function saveSolicitud(solicitud: {
  fecha_disponibilidad?: string;
  nombres: string;
  apellidos: string;
  cedula: string;
  genero: string;
  estado: string;
  municipio: string;
  parroquia: string;
  sector?: string;
  direccion: string;
  tipo_servicio: string;
  plan: string;
  promotor: string;
  telefono_principal: string;
  telefono_secundario?: string;
  correo?: string;
  power_go?: boolean;
  fecha_nacimiento?: string;
  fuente: string;
  actividad_id?: number;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("solicitudes")
    .insert([solicitud])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}
