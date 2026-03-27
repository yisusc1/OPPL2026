"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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

/** Auto-close activities from days before today (Venezuela time) */
export async function autoCerrarActividadesAntiguas(asesor: string) {
  const supabase = await createClient();
  const todayStr = getVenezuelaToday();

  const { data, error } = await supabase
    .from("actividades")
    .update({ cerrada: true })
    .eq("asesor", asesor)
    .eq("cerrada", false)
    .lt("fecha", todayStr)
    .select("id");

  if (error) throw new Error(error.message);
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
