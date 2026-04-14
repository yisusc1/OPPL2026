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

export async function getEquipos(): Promise<{ success: boolean; data?: Equipo[]; error?: string }> {
    try {
        const supabase = await createClient();
        
        const { data: equiposData, error: eqError } = await supabase
            .from("equipos")
            .select("*")
            .or("activo.eq.true,activo.is.null")
            .order("nombre");

        if (eqError) throw eqError;
        if (!equiposData || equiposData.length === 0) return { success: true, data: [] };

        const equipoIds = equiposData.map(e => e.id);
        const { data: miembrosData, error: miembrosError } = await supabase
            .from("equipo_miembros")
            .select("*, profile:profiles(id, first_name, last_name, department, job_title)")
            .in("equipo_id", equipoIds);

        const dataToReturn = equiposData.map(eq => ({
            ...eq,
            miembros: miembrosError ? [] : (miembrosData ? miembrosData.filter((m: any) => m.equipo_id === eq.id) : [])
        }));
        
        // Force JSON copy to strip out Supabase proxy prototypes that might cause serialization 500s
        return { success: true, data: JSON.parse(JSON.stringify(dataToReturn)) };
    } catch (e: any) {
        return { success: false, error: e.message || String(e) };
    }
}

export async function crearEquipo(nombre: string, zona?: string, miembroIds?: string[]): Promise<{ success: boolean; data?: Equipo; error?: string }> {
    try {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from("equipos")
            .insert([{ nombre, zona_asignada: zona || null, activo: true }])
            .select()
            .single();

        if (error) throw error;

        if (miembroIds && miembroIds.length > 0 && data) {
            // First remove these members from any other teams they might be in
            await supabase.from("equipo_miembros").delete().in("user_id", miembroIds);
            
            const miembrosInsert = miembroIds.map(uid => ({ equipo_id: data.id, user_id: uid }));
            const { error: errorMiembros } = await supabase.from("equipo_miembros").insert(miembrosInsert);
            if (errorMiembros) throw errorMiembros;
        }

        revalidatePath("/planificacion");
        return { success: true, data: JSON.parse(JSON.stringify(data)) };
    } catch (e: any) {
        return { success: false, error: e.message || String(e) };
    }
}

export async function actualizarEquipo(
    id: number,
    updates: { nombre?: string; zona_asignada?: string | null },
    miembroIds?: string[]
): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createClient();
        const { error } = await supabase.from("equipos").update(updates).eq("id", id);
        if (error) throw error;

        if (miembroIds !== undefined) {
            // Remove existing members of this team
            await supabase.from("equipo_miembros").delete().eq("equipo_id", id);

            if (miembroIds.length > 0) {
                // Ensure the new members are removed from any other teams
                await supabase.from("equipo_miembros").delete().in("user_id", miembroIds);

                const miembrosInsert = miembroIds.map(uid => ({ equipo_id: id, user_id: uid }));
                const { error: errorMiembros } = await supabase.from("equipo_miembros").insert(miembrosInsert);
                if (errorMiembros) throw errorMiembros;
            }
        }
        revalidatePath("/planificacion");
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message || String(e) };
    }
}

export async function transferirTecnico(
    userId: string,
    nuevoEquipoId: number
): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createClient();
        
        // Check if user is a leader with active materials
        const { data: leaderOf } = await supabase
            .from("equipos")
            .select("id, nombre")
            .eq("leader_id", userId)
            .single();

        if (leaderOf) {
            // Check for active inventory assignments for this user
            const { count } = await supabase
                .from("inventory_assignments")
                .select("*", { count: "exact", head: true })
                .eq("assigned_to", userId)
                .in("status", ["ACTIVE", "PARTIAL_RETURN", "EN_REVISION"]);

            if (count && count > 0) {
                return { 
                    success: false, 
                    error: `No se puede transferir a este técnico porque es Líder del "${leaderOf.nombre}" y tiene ${count} despacho(s) de material activo(s). Primero cierre o devuelva los materiales.` 
                };
            }

            // Clear leader_id from old team
            await supabase.from("equipos").update({ leader_id: null }).eq("id", leaderOf.id);
        }

        // Remove from existing team
        await supabase.from("equipo_miembros").delete().eq("user_id", userId);

        // Add to new team
        const { error: insertErr } = await supabase.from("equipo_miembros").insert([{
            equipo_id: nuevoEquipoId,
            user_id: userId
        }]);

        if (insertErr) throw insertErr;

        revalidatePath("/planificacion");
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message || String(e) };
    }
}

export async function designarLider(
    equipoId: number,
    userId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createClient();

        // Verify user belongs to the team
        const { data: membership } = await supabase
            .from("equipo_miembros")
            .select("id")
            .eq("equipo_id", equipoId)
            .eq("user_id", userId)
            .maybeSingle();

        if (!membership) {
            return { success: false, error: "El técnico no pertenece a este equipo." };
        }

        // Check if the current leader has active materials (prevent changing leader)
        const { data: currentTeam } = await supabase
            .from("equipos")
            .select("leader_id")
            .eq("id", equipoId)
            .single();

        if (currentTeam?.leader_id && currentTeam.leader_id !== userId) {
            const { count } = await supabase
                .from("inventory_assignments")
                .select("*", { count: "exact", head: true })
                .eq("assigned_to", currentTeam.leader_id)
                .in("status", ["ACTIVE", "PARTIAL_RETURN", "EN_REVISION"]);

            if (count && count > 0) {
                return { 
                    success: false, 
                    error: `El líder actual tiene ${count} despacho(s) de material activo(s). No se puede cambiar el líder hasta que se cierren o devuelvan los materiales.` 
                };
            }
        }

        // Set new leader
        const { error } = await supabase
            .from("equipos")
            .update({ leader_id: userId })
            .eq("id", equipoId);

        if (error) throw error;

        revalidatePath("/planificacion");
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message || String(e) };
    }
}

export async function eliminarEquipo(id: number): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createClient();
        
        const { error: errorMove } = await supabase
            .from("solicitudes")
            .update({ equipo_id: null, estatus_planificacion: "pendiente" })
            .eq("equipo_id", id);
        if (errorMove) throw errorMove;

        const { error: errorDel } = await supabase.from("equipos").delete().eq("id", id);
        if (errorDel) throw errorDel;

        revalidatePath("/planificacion");
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message || String(e) };
    }
}

// ── Solicitudes - Lectura ───────────────────────────────────────

/** Solicitudes que aún no han sido agendadas (sin equipo ni fecha) */
export async function getSolicitudesPendientes(fecha: string): Promise<{ success: boolean; data?: SolicitudPlanificacion[]; error?: string }> {
    try {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from("solicitudes")
            .select("*")
            .eq("estatus_planificacion", "pendiente")
            .is("equipo_id", null)
            .eq("fecha_disponibilidad", fecha)
            .order("fecha_solicitud", { ascending: false })
            .limit(200);

        if (error) throw error;
        return { success: true, data: JSON.parse(JSON.stringify(data || [])) };
    } catch (e: any) {
        return { success: false, error: e.message || String(e) };
    }
}

/** Solicitudes agendadas para una fecha específica (todas las que tienen esa fecha, de cualquier equipo) */
export async function getSolicitudesPlanificadas(fecha: string): Promise<{ success: boolean; data?: SolicitudPlanificacion[]; error?: string }> {
    try {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from("solicitudes")
            .select("*, equipo:equipos(*)")
            .eq("fecha_instalacion", fecha)
            .not("equipo_id", "is", null)
            .order("fecha_solicitud", { ascending: true });

        if (error) throw error;
        return { success: true, data: JSON.parse(JSON.stringify(data || [])) };
    } catch (e: any) {
        return { success: false, error: e.message || String(e) };
    }
}

// ── Solicitudes - Acciones de Planificación ─────────────────────

/** Agendar una solicitud: asignarle equipo + fecha + cambiar estatus */
export async function agendarSolicitud(
    id: string,
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
export async function moverSolicitud(id: string, nuevoEquipoId: number): Promise<void> {
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
    id: string,
    estatus: EstatusPlanificacion,
    motivo?: string,
    notas?: string,
    nuevaFechaDisponibilidad?: string
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

    // Flujo de Clonación para Reagendamiento
    if (estatus === "reprogramado" && nuevaFechaDisponibilidad) {
        const { data: originalReq, error: fetchErr } = await supabase
            .from("solicitudes")
            .select("*")
            .eq("id", id)
            .single();
            
        if (!fetchErr && originalReq) {
            const clone = { ...originalReq };
            delete clone.id; // Dejar que DB genere nuevo UUID
            delete clone.created_at; // (si existiera en DB localmente)
            clone.estatus_planificacion = "pendiente";
            clone.equipo_id = null;
            clone.fecha_instalacion = null;
            clone.motivo_reprogramacion = null;
            clone.notas_planificacion = null;
            clone.fecha_disponibilidad = nuevaFechaDisponibilidad;

            const { error: insertErr } = await supabase.from("solicitudes").insert([clone]);
            if (insertErr) throw new Error(insertErr.message);
        }
    }

    revalidatePath("/planificacion");
}

/** Desagendar: devolver solicitud a pendiente */
export async function desagendarSolicitud(id: string): Promise<void> {
    return actualizarEstatus(id, "pendiente");
}
