"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ── Operadores ─────────────────────────────────────────────────────

export async function getOperadores() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("operadores_competencia")
    .select("*")
    .order("nombre", { ascending: true });

  if (error) {
    console.error("Error fetching operadores:", error);
  }
  return data || [];
}

export async function saveOperador(nombre: string, color_hex: string, logo_url?: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("operadores_competencia")
    .insert([{ nombre, color_hex, logo_url }])
    .select()
    .single();

  if (error) throw new Error(error.message);
  
  // Revalidate to ensure the form gets the new operator instantly
  revalidatePath("/ventas/competencia/nuevo");
  return data;
}

// ── Ofertas ────────────────────────────────────────────────────────

export async function saveOferta(oferta: any) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ofertas_competencia")
    .insert([oferta])
    .select()
    .single();

  if (error) throw new Error(error.message);
  
  revalidatePath("/ventas/competencia");
  return data;
}

export async function saveOfertasBatch(ofertas: any[]) {
  if (!ofertas || ofertas.length === 0) return { success: false, error: "No hay datos para guardar" };
  
  const supabase = await createClient();
  
  // Log para debug
  console.log("[competencia] Insertando ofertas:", JSON.stringify(ofertas, null, 2));
  
  const { data, error } = await supabase
    .from("ofertas_competencia")
    .insert(ofertas)
    .select();

  if (error) {
    console.error("[competencia] Error Supabase:", error.message, error.details, error.hint, error.code);
    return { success: false, error: `${error.message}${error.details ? ` — ${error.details}` : ""}${error.hint ? ` (${error.hint})` : ""}` };
  }
  
  revalidatePath("/ventas/competencia");
  return { success: true, data };
}

/**
 * Obtiene la ÚLTIMA oferta registrada de cada operador para una zona específica.
 */
export async function getOfertasRecientes(estado?: string, municipio?: string, parroquia?: string) {
  const supabase = await createClient();
  
  // 1. Obtener todos los operadores para rellenar si no hay filtros
  const { data: ops } = await supabase.from("operadores_competencia").select("*");
  const operadores = ops || [];

  // 2. Construir query dinámica
  let query = supabase
    .from("ofertas_competencia")
    .select(`
      *,
      operadores_competencia (
        nombre,
        color_hex,
        logo_url
      )
    `)
    .order("created_at", { ascending: false })
    .limit(500);

  if (estado) query = query.eq("estado", estado);
  if (municipio) query = query.eq("municipio", municipio);
  if (parroquia) query = query.eq("parroquia", parroquia);

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching ofertas recientes:", error);
    return [];
  }

  // Agrupar por operador_id y quedarnos con la primera (la más reciente)
  const ultimasOfertasMap = new Map<number, any>();
  
  if (data) {
    for (const oferta of data) {
      if (!ultimasOfertasMap.has(oferta.operador_id)) {
        ultimasOfertasMap.set(oferta.operador_id, oferta);
      }
    }
  }

  // Si no hay filtros de zona aplicados, mostramos todos los operadores,
  // incluso los que no tienen NINGUNA oferta en el sistema
  const isFilterActive = estado || municipio || parroquia;
  
  if (!isFilterActive) {
    for (const op of operadores) {
      if (!ultimasOfertasMap.has(op.id)) {
        ultimasOfertasMap.set(op.id, {
          id: `empty-${op.id}`,
          operador_id: op.id,
          operadores_competencia: { nombre: op.nombre, color_hex: op.color_hex, logo_url: op.logo_url },
          isEmpty: true // Marcador para la UI
        });
      }
    }
  }

  return Array.from(ultimasOfertasMap.values());
}

/**
 * Obtiene el historial completo de un operador en una zona.
 */
export async function getHistorialOperador(operador_id: number, estado: string, municipio: string, parroquia: string) {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("ofertas_competencia")
    .select("*")
    .eq("operador_id", operador_id)
    .eq("estado", estado)
    .eq("municipio", municipio)
    .eq("parroquia", parroquia)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Error fetching historial operador:", error);
    return [];
  }

  return data || [];
}

/**
 * Obtiene el último "Snapshot" completo de un operador en una zona.
 */
export async function getSnapshotOperador(operador_id: number, estado: string, municipio: string, parroquia: string) {
  const historial = await getHistorialOperador(operador_id, estado, municipio, parroquia);
  if (!historial || historial.length === 0) return null;

  // Filtrar todos los registros que coincidan con la fecha_reporte más reciente
  const latestDate = historial[0].fecha_reporte;
  const snapshotPlans = historial.filter(h => h.fecha_reporte === latestDate);

  const planesEstandar = snapshotPlans.filter(p => !p.es_promocion);
  const promociones = snapshotPlans.filter(p => p.es_promocion);

  // Devolvemos el snapshot completo basado en el último reporte
  return {
    planes_estandar: planesEstandar.map(p => ({
      velocidad: String(p.velocidad_mb),
      precio: String(p.precio_mensual),
      servicios: p.servicios_adicionales || []
    })),
    promociones: promociones.map(p => ({
      velocidad: String(p.velocidad_mb),
      precio_promo: String(p.precio_mensual),
      precio_regular: p.precio_regular ? String(p.precio_regular) : "",
      duracion_meses: p.duracion_promo_meses ? String(p.duracion_promo_meses) : "",
      fecha_fin: p.fecha_fin_promo || "",
      servicios: p.servicios_adicionales || []
    })),
    instalacion: {
      costo_base: snapshotPlans[0].costo_instalacion ? String(snapshotPlans[0].costo_instalacion) : "",
      modalidad: snapshotPlans[0].modalidad_instalacion || "",
      metraje: snapshotPlans[0].instalacion_metraje ? String(snapshotPlans[0].instalacion_metraje) : "",
      opciones: snapshotPlans[0].instalacion_opciones || []
    },
    notas_anteriores: snapshotPlans[0].notas || ""
  };
}
