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

  // Extraer datos de contexto del primer registro ANTES de modificar (para saber qué zona local estamos guardando)
  const zonaLocal = {
    operador_id: ofertas[0].operador_id,
    estado: ofertas[0].estado,
    municipio: ofertas[0].municipio,
    parroquia: ofertas[0].parroquia
  };

  // Limpieza de seguridad: asegurar que no haya valores NaN o undefined que rompan Supabase
  const cleanOfertas = ofertas.map(o => {
    const clean = { ...o };
    // Inyectar fecha_reporte explícitamente
    if (!clean.fecha_reporte) clean.fecha_reporte = fechaReporte;
    
    // Forzar zona Nacional para planes estándar
    if (!clean.es_promocion) {
      clean.estado = "Nacional";
      clean.municipio = "Todos";
      clean.parroquia = "Todas";
    }

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
  
  // 1. Borrar promociones anteriores de la zona local para esa fecha
  const { error: deletePromosError } = await supabase
    .from("ofertas_competencia")
    .delete()
    .eq("operador_id", zonaLocal.operador_id)
    .eq("estado", zonaLocal.estado)
    .eq("municipio", zonaLocal.municipio)
    .eq("parroquia", zonaLocal.parroquia)
    .eq("es_promocion", true)
    .eq("fecha_reporte", fechaReporte);

  if (deletePromosError) {
    console.warn("[competencia] Error borrando promociones anteriores:", deletePromosError.message);
  }

  // 2. Borrar planes estándar nacionales para esa fecha
  const { error: deletePlanesError } = await supabase
    .from("ofertas_competencia")
    .delete()
    .eq("operador_id", zonaLocal.operador_id)
    .eq("estado", "Nacional")
    .eq("municipio", "Todos")
    .eq("parroquia", "Todas")
    .eq("es_promocion", false)
    .eq("fecha_reporte", fechaReporte);

  if (deletePlanesError) {
    console.warn("[competencia] Error borrando planes estándar anteriores:", deletePlanesError.message);
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
 * Obtiene la ÚLTIMA oferta registrada de cada operador, con filtros geográficos opcionales.
 */
export async function getOfertasRecientes(estado?: string, municipio?: string, parroquia?: string) {
  const supabase = await createClient();
  
  const { data: ops } = await supabase.from("operadores_competencia").select("*");
  const operadores = ops || [];

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
    .limit(1000);

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching ofertas recientes:", error);
    return [];
  }

  // Filtrar por zona si se especificó
  const hasGeoFilter = !!(estado || municipio || parroquia);
  let filteredData = data || [];

  if (hasGeoFilter) {
    // Encontrar qué operadores tienen presencia LOCAL real en la zona filtrada
    // (excluimos registros Nacionales de la detección de presencia)
    const opsInZone = new Set<number>();
    for (const row of filteredData) {
      if (row.estado === 'Nacional') continue; // No cuenta como presencia local
      const matchEstado = !estado || row.estado === estado;
      const matchMunicipio = !municipio || row.municipio === municipio;
      const matchParroquia = !parroquia || row.parroquia === parroquia;
      if (matchEstado && matchMunicipio && matchParroquia) {
        opsInZone.add(row.operador_id);
      }
    }
    // Solo mantener registros de operadores con presencia local + sus datos nacionales
    filteredData = filteredData.filter(row => {
      if (!opsInZone.has(row.operador_id)) return false;
      const isNacional = row.estado === 'Nacional';
      if (isNacional) return true;
      const matchEstado = !estado || row.estado === estado;
      const matchMunicipio = !municipio || row.municipio === municipio;
      const matchParroquia = !parroquia || row.parroquia === parroquia;
      return matchEstado && matchMunicipio && matchParroquia;
    });
  }

  // Agrupar por operador_id y agregar resumen global
  const ultimasOfertasMap = new Map<number, any>();
  
  for (const oferta of filteredData) {
    if (!ultimasOfertasMap.has(oferta.operador_id)) {
      ultimasOfertasMap.set(oferta.operador_id, {
        ...oferta,
        min_precio: typeof oferta.precio_mensual === 'number' ? oferta.precio_mensual : Infinity,
        max_velocidad: typeof oferta.velocidad_mb === 'number' ? oferta.velocidad_mb : 0,
        todas_inst: (oferta.costo_instalacion !== null && typeof oferta.costo_instalacion !== 'undefined') ? [oferta.costo_instalacion] : []
      });
    } else {
      const ag = ultimasOfertasMap.get(oferta.operador_id);
      if (typeof oferta.precio_mensual === 'number' && oferta.precio_mensual < ag.min_precio) ag.min_precio = oferta.precio_mensual;
      if (typeof oferta.velocidad_mb === 'number' && oferta.velocidad_mb > ag.max_velocidad) ag.max_velocidad = oferta.velocidad_mb;
      if (oferta.costo_instalacion !== null && typeof oferta.costo_instalacion !== 'undefined') {
         if (!ag.todas_inst.includes(oferta.costo_instalacion)) {
            ag.todas_inst.push(oferta.costo_instalacion);
         }
      }
    }
  }
  
  for (const [, ag] of ultimasOfertasMap.entries()) {
    if (ag.min_precio === Infinity) ag.min_precio = 0;
  }

  // Rellenar operadores sin ofertas (solo si NO hay filtro geo activo)
  if (!hasGeoFilter) {
    for (const op of operadores) {
      if (!ultimasOfertasMap.has(op.id)) {
        ultimasOfertasMap.set(op.id, {
          id: `empty-${op.id}`,
          operador_id: op.id,
          operadores_competencia: { nombre: op.nombre, color_hex: op.color_hex, logo_url: op.logo_url },
          isEmpty: true
        });
      }
    }
  }

  return Array.from(ultimasOfertasMap.values());
}

/**
 * Obtiene nombres únicos de servicios adicionales para autocompletado.
 */
export async function getUniqueServiceNames() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ofertas_competencia")
    .select("servicios_adicionales")
    .not("servicios_adicionales", "is", null);

  if (error) {
    console.error("Error fetching service names:", error);
    return [];
  }

  const namesSet = new Set<string>();
  for (const row of (data || [])) {
    if (Array.isArray(row.servicios_adicionales)) {
      for (const srv of row.servicios_adicionales) {
        if (srv.nombre && srv.nombre.trim()) {
          namesSet.add(srv.nombre.trim());
        }
      }
    }
  }
  return Array.from(namesSet).sort();
}

/**
 * Elimina toda la presencia de un operador en una zona geográfica específica.
 */
export async function deleteOfertaZona(
  operador_id: number,
  estado: string,
  municipio: string,
  parroquia: string
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("ofertas_competencia")
    .delete()
    .eq("operador_id", operador_id)
    .eq("estado", estado)
    .eq("municipio", municipio)
    .eq("parroquia", parroquia);

  if (error) {
    console.error("Error eliminando zona:", error);
    throw new Error(error.message);
  }

  revalidatePath("/ventas/competencia");
  revalidatePath("/ventas/competencia/nuevo");
  return { success: true };
}

/**
 * Obtiene data agregada de competencia por municipio para el mapa de calor.
 * Devuelve un array con { estado, municipio, num_operadores, min_precio, max_velocidad }.
 */
export async function getCompetenciaHeatmapData() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ofertas_competencia")
    .select(`
      estado,
      municipio,
      parroquia,
      operador_id,
      precio_mensual,
      velocidad_mb,
      es_promocion,
      operadores_competencia (
        nombre,
        color_hex
      )
    `)
    .neq("estado", "Nacional")
    .order("created_at", { ascending: false })
    .limit(2000);

  if (error) {
    console.error("Error fetching heatmap data:", error);
    return [];
  }

  // Agrupar por estado-municipio
  const zoneMap = new Map<string, {
    estado: string;
    municipio: string;
    operadores: Set<number>;
    operadoresInfo: Map<number, { nombre: string; color_hex: string }>;
    min_precio: number;
    max_velocidad: number;
    total_ofertas: number;
  }>();

  for (const row of (data || [])) {
    const key = `${row.estado}|${row.municipio}`;
    if (!zoneMap.has(key)) {
      zoneMap.set(key, {
        estado: row.estado,
        municipio: row.municipio,
        operadores: new Set(),
        operadoresInfo: new Map(),
        min_precio: Infinity,
        max_velocidad: 0,
        total_ofertas: 0
      });
    }
    const zone = zoneMap.get(key)!;
    zone.operadores.add(row.operador_id);
    if (row.operadores_competencia) {
      zone.operadoresInfo.set(row.operador_id, {
        nombre: (row.operadores_competencia as any).nombre,
        color_hex: (row.operadores_competencia as any).color_hex
      });
    }
    if (typeof row.precio_mensual === 'number' && row.precio_mensual < zone.min_precio) zone.min_precio = row.precio_mensual;
    if (typeof row.velocidad_mb === 'number' && row.velocidad_mb > zone.max_velocidad) zone.max_velocidad = row.velocidad_mb;
    zone.total_ofertas++;
  }

  return Array.from(zoneMap.values()).map(z => ({
    estado: z.estado,
    municipio: z.municipio,
    num_operadores: z.operadores.size,
    operadores: Array.from(z.operadoresInfo.entries()).map(([id, info]) => ({ id, ...info })),
    min_precio: z.min_precio === Infinity ? 0 : z.min_precio,
    max_velocidad: z.max_velocidad,
    total_ofertas: z.total_ofertas
  }));
}

/**
 * Obtiene el historial completo de un operador.
 */
export async function getHistorialOperador(
  operador_id: number,
  estado?: string,
  municipio?: string,
  parroquia?: string
) {
  const supabase = await createClient();
  
  let query = supabase
    .from("ofertas_competencia")
    .select("*")
    .eq("operador_id", operador_id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (estado) query = query.eq("estado", estado);
  if (municipio) query = query.eq("municipio", municipio);
  if (parroquia) query = query.eq("parroquia", parroquia);

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching historial operador:", error);
    return [];
  }

  return data || [];
}

/**
 * Obtiene el último "Snapshot" completo de un operador (todas sus zonas, o filtrado).
 */
export async function getSnapshotOperador(
  operador_id: number,
  estado?: string,
  municipio?: string,
  parroquia?: string
) {
  let historial = await getHistorialOperador(operador_id, estado, municipio, parroquia);
  
  // Si estamos consultando una zona local, agregamos los planes Nacionales
  if (estado && estado !== "Nacional") {
    const historialNacional = await getHistorialOperador(operador_id, "Nacional", "Todos", "Todas");
    if (historialNacional && historialNacional.length > 0) {
      historial = [...(historial || []), ...historialNacional];
    }
  }

  if (!historial || historial.length === 0) return null;

  // Encontrar la fecha más reciente PARA CADA zona (estado, municipio, parroquia)
  const zoneDates = new Map<string, string>();
  for (const h of historial) {
    const key = `${h.estado}|${h.municipio}|${h.parroquia}`;
    if (!zoneDates.has(key) || new Date(h.fecha_reporte) > new Date(zoneDates.get(key)!)) {
      zoneDates.set(key, h.fecha_reporte);
    }
  }

  // Filtrar los registros para quedarse solo con la última actualización de cada zona
  const snapshotPlans = historial.filter(h => {
    const key = `${h.estado}|${h.municipio}|${h.parroquia}`;
    return h.fecha_reporte === zoneDates.get(key);
  });

  const planesEstandar = snapshotPlans.filter(p => !p.es_promocion);
  const promociones = snapshotPlans.filter(p => p.es_promocion);

  // Devolvemos el snapshot consolidado
  return {
    planes_estandar: planesEstandar.map(p => ({
      nombre_plan: p.nombre_plan || "",
      velocidad: String(p.velocidad_mb),
      velocidad_subida: p.velocidad_subida ? String(p.velocidad_subida) : "",
      tecnologia: p.tecnologia || "FTTH",
      es_simetrico: p.es_simetrico,
      incluye_iptv: p.incluye_iptv,
      precio: String(p.precio_mensual),
      servicios: p.servicios_adicionales || [],
      estado: p.estado,
      municipio: p.municipio,
      parroquia: p.parroquia,
      instalacion: {
        costo_base: p.costo_instalacion ? String(p.costo_instalacion) : "",
        modalidad: p.modalidad_instalacion || "",
        metraje: p.instalacion_metraje ? String(p.instalacion_metraje) : "",
        opciones: p.instalacion_opciones || []
      },
      notas_anteriores: p.notas || ""
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
      servicios: p.servicios_adicionales || [],
      estado: p.estado,
      municipio: p.municipio,
      parroquia: p.parroquia,
      instalacion: {
        costo_base: p.costo_instalacion ? String(p.costo_instalacion) : "",
        modalidad: p.modalidad_instalacion || "",
        metraje: p.instalacion_metraje ? String(p.instalacion_metraje) : "",
        opciones: p.instalacion_opciones || []
      },
      notas_anteriores: p.notas || ""
    })),
    // Tomamos la información de instalación general del primer registro disponible
    instalacion: {
      costo_base: snapshotPlans.length > 0 && snapshotPlans[0].costo_instalacion ? String(snapshotPlans[0].costo_instalacion) : "",
      modalidad: snapshotPlans.length > 0 ? snapshotPlans[0].modalidad_instalacion || "" : "",
      metraje: snapshotPlans.length > 0 && snapshotPlans[0].instalacion_metraje ? String(snapshotPlans[0].instalacion_metraje) : "",
      opciones: snapshotPlans.length > 0 ? snapshotPlans[0].instalacion_opciones || [] : []
    },
    notas_anteriores: snapshotPlans.length > 0 ? snapshotPlans[0].notas || "" : ""
  };
}
