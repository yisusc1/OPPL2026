"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Equipo, SolicitudPlanificacion, EstatusPlanificacion } from "@/lib/types/planificacion";

// ── Equipos CRUD ────────────────────────────────────────────────

export async function getEquipos(): Promise<Equipo[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("equipos")
        .select("*")
        .eq("activo", true)
        .order("nombre");

    if (error) throw new Error(error.message);
    return data || [];
}

export async function crearEquipo(nombre: string, zona?: string): Promise<Equipo> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("equipos")
        .insert([{ nombre, zona_asignada: zona || null }])
        .select()
        .single();

    if (error) throw new Error(error.message);
    revalidatePath("/planificacion");
    return data;
}

export async function actualizarEquipo(id: number, updates: { nombre?: string; zona_asignada?: string | null }): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
        .from("equipos")
        .update(updates)
        .eq("id", id);

    if (error) throw new Error(error.message);
    revalidatePath("/planificacion");
}

export async function eliminarEquipo(id: number): Promise<void> {
    const supabase = await createClient();

    // First unassign any solicitudes from this team
    await supabase
        .from("solicitudes")
        .update({ equipo_id: null, estatus_planificacion: "pendiente", fecha_instalacion: null })
        .eq("equipo_id", id);

    const { error } = await supabase
        .from("equipos")
        .delete()
        .eq("id", id);

    if (error) throw new Error(error.message);
    revalidatePath("/planificacion");
}

// ── Solicitudes - Lectura ───────────────────────────────────────

/** Solicitudes que aún no han sido agendadas (sin equipo ni fecha) */
export async function getSolicitudesPendientes(): Promise<SolicitudPlanificacion[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("solicitudes")
        .select("*")
        .eq("estatus_planificacion", "pendiente")
        .is("equipo_id", null)
        .order("created_at", { ascending: false })
        .limit(200);

    if (error) throw new Error(error.message);
    return data || [];
}

/** Solicitudes agendadas para una fecha específica (todas las que tienen esa fecha, de cualquier equipo) */
export async function getSolicitudesPlanificadas(fecha: string): Promise<SolicitudPlanificacion[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("solicitudes")
        .select("*, equipo:equipos(*)")
        .eq("fecha_instalacion", fecha)
        .not("equipo_id", "is", null)
        .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
}

// ── Solicitudes - Acciones de Planificación ─────────────────────

/** Agendar una solicitud: asignarle equipo + fecha + cambiar estatus */
export async function agendarSolicitud(
    id: number,
    equipoId: number,
    fechaInstalacion: string
): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
        .from("solicitudes")
        .update({
            equipo_id: equipoId,
            fecha_instalacion: fechaInstalacion,
            estatus_planificacion: "agendado",
            motivo_reprogramacion: null,
        })
        .eq("id", id);

    if (error) throw new Error(error.message);
    revalidatePath("/planificacion");
}

/** Mover solicitud a otro equipo (manteniendo la fecha) */
export async function moverSolicitud(id: number, nuevoEquipoId: number): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
        .from("solicitudes")
        .update({ equipo_id: nuevoEquipoId })
        .eq("id", id);

    if (error) throw new Error(error.message);
    revalidatePath("/planificacion");
}

/** Actualizar estatus de una solicitud */
export async function actualizarEstatus(
    id: number,
    estatus: EstatusPlanificacion,
    motivo?: string,
    notas?: string
): Promise<void> {
    const supabase = await createClient();
    const updates: Record<string, any> = {
        estatus_planificacion: estatus,
    };

    if (estatus === "reprogramado" && motivo) {
        updates.motivo_reprogramacion = motivo;
    }
    if (estatus === "error" && notas) {
        updates.notas_planificacion = notas;
    }

    // If rescheduled or error, remove from team/date so it goes back to pending pool
    if (estatus === "pendiente") {
        updates.equipo_id = null;
        updates.fecha_instalacion = null;
        updates.motivo_reprogramacion = null;
        updates.notas_planificacion = null;
    }

    const { error } = await supabase
        .from("solicitudes")
        .update(updates)
        .eq("id", id);

    if (error) throw new Error(error.message);
    revalidatePath("/planificacion");
}

/** Desagendar: devolver solicitud a pendiente */
export async function desagendarSolicitud(id: number): Promise<void> {
    return actualizarEstatus(id, "pendiente");
}
