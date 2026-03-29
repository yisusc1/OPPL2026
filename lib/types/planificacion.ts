export type EstatusPlanificacion = 'pendiente' | 'agendado' | 'completado' | 'reprogramado' | 'error';

export interface Equipo {
    id: number;
    nombre: string;
    zona_asignada?: string | null;
    activo: boolean;
    created_at?: string;
    miembros?: EquipoMiembro[];
}

export interface EquipoMiembro {
    id: number;
    equipo_id: number;
    user_id: string;
    created_at?: string;
    // Joined from profiles
    profile?: {
        id: string;
        first_name: string;
        last_name: string;
        department?: string;
        job_title?: string;
    };
}

/** A technician available to be assigned to a team */
export interface TecnicoDisponible {
    id: string;          // profile UUID
    first_name: string;
    last_name: string;
    job_title?: string;
    department?: string;
}

/**
 * SolicitudPlanificacion represents a solicitud row 
 * with the extra fields needed by the planning board.
 * Extends the data already captured by the sales team.
 */
export interface SolicitudPlanificacion {
    id: number;
    created_at?: string;

    // --- From Sales Form ---
    nombres: string;
    apellidos: string;
    cedula: string;
    telefono_principal: string;
    telefono_secundario?: string;
    correo?: string;
    estado: string;
    municipio: string;
    parroquia: string;
    sector?: string;
    direccion?: string;
    tipo_servicio: string;
    plan: string;
    promotor: string;
    power_go?: boolean;
    fuente?: string;
    fecha_solicitud?: string;
    fecha_disponibilidad?: string;

    // --- Planning Fields ---
    fecha_instalacion?: string | null;      // YYYY-MM-DD
    equipo_id?: number | null;
    estatus_planificacion: EstatusPlanificacion;
    motivo_reprogramacion?: string | null;
    notas_planificacion?: string | null;

    // --- Joined ---
    equipo?: Equipo | null;
}
