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

export async function saveOferta(oferta: {
  operador_id: number;
  estado: string;
  municipio: string;
  parroquia: string;
  tipo_novedad: string;
  velocidad_mb: number;
  precio_mensual: number;
  costo_instalacion?: number;
  modalidad_instalacion?: string;
  incluye_tv?: boolean;
  detalle_tv?: string;
  notas?: string;
  asesor_nombre: string;
}) {
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

/**
 * Obtiene la ÚLTIMA oferta registrada de cada operador para una zona específica.
 */
export async function getOfertasRecientes(estado: string, municipio: string, parroquia: string) {
  const supabase = await createClient();
  
  // Como PostgREST no soporta DISTINCT ON directamente de forma sencilla sin RPC,
  // consultamos las últimas ofertas de la zona ordenadas por fecha descendente
  // y agrupamos en memoria (asumiendo que los filtros limitan la cantidad de datos).
  const { data, error } = await supabase
    .from("ofertas_competencia")
    .select(`
      *,
      operadores_competencia (
        nombre,
        color_hex
      )
    `)
    .eq("estado", estado)
    .eq("municipio", municipio)
    .eq("parroquia", parroquia)
    .order("created_at", { ascending: false })
    .limit(300); // Límite seguro para no saturar memoria

  if (error) {
    console.error("Error fetching ofertas recientes:", error);
    return [];
  }

  // Agrupar por operador_id y quedarnos con la primera (que es la más reciente por el order by)
  const ultimasOfertasMap = new Map<number, any>();
  
  if (data) {
    for (const oferta of data) {
      if (!ultimasOfertasMap.has(oferta.operador_id)) {
        ultimasOfertasMap.set(oferta.operador_id, oferta);
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
