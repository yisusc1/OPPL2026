export type EstatusPlanificacion = 'pendiente' | 'agendado' | 'completado' | 'reprogramado' | 'error';

export interface Equipo {
    id: number;
    nombre: string;
    zona_asignada?: string | null;
    activo: boolean;
    created_at?: string;
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
