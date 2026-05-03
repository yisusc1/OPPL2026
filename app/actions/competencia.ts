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
    console.error("Error fetching operadores:", error.message);
    return [];
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

export async function updateOperador(id: number, nombre: string, color_hex: string, logo_url?: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("operadores_competencia")
    .update({ nombre, color_hex, logo_url })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  
  revalidatePath("/ventas/competencia/nuevo");
  revalidatePath("/ventas/competencia");
  return data;
}

export async function deleteOperador(id: number) {
  const supabase = await createClient();
  
  // First, delete related ofertas to avoid FK constraint error
  await supabase
    .from("ofertas_competencia")
    .delete()
    .eq("operador_id", id);
    
  // Then delete the operator itself
  const { error } = await supabase
    .from("operadores_competencia")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
  
  revalidatePath("/ventas/competencia/nuevo");
  revalidatePath("/ventas/competencia");
  return true;
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
  if (!ofertas || ofertas.length === 0) {
    console.warn("[competencia] Intento de guardado con array vacío");
    return { success: false, error: "No hay datos válidos para guardar" };
  }
  
  const supabase = await createClient();
  
  // Fecha de reporte en zona Venezuela (UTC-4)
  const fechaReporte = new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" });

  // Limpieza de seguridad: asegurar que no haya valores NaN o undefined que rompan Supabase
  const cleanOfertas = ofertas.map(o => {
    const clean = { ...o };
    // Inyectar fecha_reporte explícitamente
    if (!clean.fecha_reporte) clean.fecha_reporte = fechaReporte;
    // Asegurar que los números sean números o null, nunca NaN
    if (typeof clean.velocidad_mb !== 'number' || isNaN(clean.velocidad_mb)) clean.velocidad_mb = 0;
    if (typeof clean.precio_mensual !== 'number' || isNaN(clean.precio_mensual)) clean.precio_mensual = 0;
    
    if (clean.precio_regular !== undefined && clean.precio_regular !== null && isNaN(clean.precio_regular)) {
      clean.precio_regular = null;
    }
    if (clean.duracion_promo_meses !== undefined && clean.duracion_promo_meses !== null && isNaN(clean.duracion_promo_meses)) {
      clean.duracion_promo_meses = null;
    }
    if (clean.costo_instalacion !== undefined && clean.costo_instalacion !== null && isNaN(clean.costo_instalacion)) {
      clean.costo_instalacion = 0;
    }
    return clean;
  });

  console.log(`[competencia] Intentando insertar ${cleanOfertas.length} registros...`);
  
  // Extraer datos de contexto del primer registro para el delete
  const { operador_id, estado, municipio, parroquia } = cleanOfertas[0];
  
  // Borrar registros anteriores del mismo operador/zona/fecha para evitar duplicados
  // Esto convierte cada guardado en un "reemplazo del snapshot del día"
  const { error: deleteError } = await supabase
    .from("ofertas_competencia")
    .delete()
    .eq("operador_id", operador_id)
    .eq("estado", estado)
    .eq("municipio", municipio)
    .eq("parroquia", parroquia)
    .eq("fecha_reporte", fechaReporte);

  if (deleteError) {
    console.warn("[competencia] Error borrando snapshot anterior (no crítico):", deleteError.message);
  }

  const { data, error } = await supabase
    .from("ofertas_competencia")
    .insert(cleanOfertas)
    .select();

  if (error) {
    console.error("[competencia] Error Crítico Supabase:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code
    });
    return { 
      success: false, 
      error: `Error de base de datos: ${error.message}${error.details ? ` — ${error.details}` : ""}` 
    };
  }
  
  console.log("[competencia] Guardado exitoso. Revalidando rutas...");
  revalidatePath("/ventas/competencia");
  revalidatePath("/ventas/competencia/nuevo");
  
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
        id,
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
      nombre_plan: p.nombre_plan || "",
      velocidad: String(p.velocidad_mb),
      velocidad_subida: p.velocidad_subida ? String(p.velocidad_subida) : "",
      tecnologia: p.tecnologia || "FTTH",
      es_simetrico: p.es_simetrico,
      incluye_iptv: p.incluye_iptv,
      precio: String(p.precio_mensual),
      servicios: p.servicios_adicionales || []
    })),
    promociones: promociones.map(p => ({
      nombre_plan: p.nombre_plan || "",
      velocidad: String(p.velocidad_mb),
      velocidad_subida: p.velocidad_subida ? String(p.velocidad_subida) : "",
      tecnologia: p.tecnologia || "FTTH",
      es_simetrico: p.es_simetrico,
      incluye_iptv: p.incluye_iptv,
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
