"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Equipo, SolicitudPlanificacion, EstatusPlanificacion, TecnicoDisponible } from "@/lib/types/planificacion";

// ── Técnicos Disponibles ────────────────────────────────────────

/** Obtener todos los técnicos del departamento de Instalación */
export async function getTecnicos(): Promise<TecnicoDisponible[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, department, job_title")
        .eq("department", "Instalación")
        .in("job_title", ["Técnico", "Chofer", "Supervisor", "Coordinador", "Encargado"])
        .order("first_name");

    if (error) throw new Error(error.message);
    return (data || []).map(d => ({
        id: d.id,
        first_name: d.first_name || "",
        last_name: d.last_name || "",
        job_title: d.job_title || undefined,
        department: d.department || undefined,
    }));
}

// ── Equipos CRUD ────────────────────────────────────────────────

export async function getEquipos(): Promise<Equipo[]> {
    const supabase = await createClient();
    
    // 1. Fetch teams first (no joins that might fail due to schema cache staleness)
    const { data: equiposData, error: eqError } = await supabase
        .from("equipos")
        .select("*")
        .eq("activo", true)
        .order("nombre");

    if (eqError) {
        console.error("Error getEquipos (equipos):", eqError);
        throw new Error(eqError.message);
    }

    if (!equiposData || equiposData.length === 0) return [];

    // 2. Try to fetch members
    try {
        const equipoIds = equiposData.map(e => e.id);
        const { data: miembrosData, error: miembrosError } = await supabase
            .from("equipo_miembros")
            .select("*, profile:profiles(id, first_name, last_name, department, job_title)")
            .in("equipo_id", equipoIds);

        if (miembrosError) {
            console.error("Error getEquipos (miembros relation):", miembrosError);
            // Don't throw. Just return teams without members if schema cache is stale
            return equiposData;
        }

        // Map members to their teams
        return equiposData.map(eq => ({
            ...eq,
            miembros: miembrosData ? miembrosData.filter((m: any) => m.equipo_id === eq.id) : []
        }));

    } catch (e) {
        console.error("Exception fetching members:", e);
        return equiposData; // Fallback
    }
}

export async function crearEquipo(nombre: string, zona?: string, miembroIds?: string[]): Promise<Equipo> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("equipos")
        .insert([{ nombre, zona_asignada: zona || null }])
        .select()
        .single();

    if (error) {
        console.error("Error creating team:", error);
        throw new Error(error.message);
    }

    // Add members
    if (miembroIds && miembroIds.length > 0 && data) {
        const miembrosInsert = miembroIds.map(uid => ({ equipo_id: data.id, user_id: uid }));
        const { error: errorMiembros } = await supabase.from("equipo_miembros").insert(miembrosInsert);
        if (errorMiembros) {
            console.error("Error adding team members:", errorMiembros);
            throw new Error(errorMiembros.message);
        }
    }

    revalidatePath("/planificacion");
    return data;
}

export async function actualizarEquipo(
    id: number,
    updates: { nombre?: string; zona_asignada?: string | null },
    miembroIds?: string[]
): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
        .from("equipos")
        .update(updates)
        .eq("id", id);

    if (error) throw new Error(error.message);

    // Sync members: delete old, insert new
    if (miembroIds !== undefined) {
        await supabase.from("equipo_miembros").delete().eq("equipo_id", id);
        if (miembroIds.length > 0) {
            const miembrosInsert = miembroIds.map(uid => ({ equipo_id: id, user_id: uid }));
            const { error: errorMiembros } = await supabase.from("equipo_miembros").insert(miembrosInsert);
            if (errorMiembros) {
                console.error("Error updating team members:", errorMiembros);
                throw new Error(errorMiembros.message);
            }
        }
    }

    revalidatePath("/planificacion");
}

export async function eliminarEquipo(id: number): Promise<void> {
    const supabase = await createClient();

    // First unassign any solicitudes from this team
    await supabase
        .from("solicitudes")
        .update({ equipo_id: null, estatus_planificacion: "pendiente", fecha_instalacion: null })
        .eq("equipo_id", id);

    // Members cascade-delete automatically
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

    // If back to pending, remove from team/date
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
