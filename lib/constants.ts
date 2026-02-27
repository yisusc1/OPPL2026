export const DEPARTMENTS = [
    "Altos Mandos",
    "Instalación",
    "Soporte Técnico",
    "Planificación",
    "Distribución",
    "Afectaciones",
    "Transporte",
    "Administración",
    "Tecnológico",
    "Recursos Humanos",
    "Comercialización"
] as const

export const JOB_TITLES_BY_DEPARTMENT: Record<string, string[]> = {
    "Altos Mandos": [
        "Presidente",
        "Gerente General",
        "Gerente de Operaciones"
    ],
    "Instalación": [
        "Gerente",
        "Encargado",
        "Coordinador",
        "Supervisor",
        "Técnico",
        "Chofer"
    ],
    "Soporte Técnico": [
        "Gerente",
        "Encargado",
        "Supervisor",
        "Coordinador",
        "Técnico Operacional",
        "Técnico de Campo"
    ],
    "Planificación": [
        "Coordinador",
        "Analista",
        "Cobrador",
        "Atención al Cliente"
    ],
    "Distribución": [
        "Gerente",
        "Encargado",
        "Supervisor",
        "Empalmador",
        "Liniero",
        "Ayudante",
        "Chofer"
    ],
    "Afectaciones": [
        "Encargado",
        "Empalmador",
        "Liniero",
        "Chofer"
    ],
    "Transporte": [
        "Encomendador",
        "Chofer",
        "Mecánico"
    ],
    "Administración": [
        "Encargado",
        "Supervisor",
        "Atención al Cliente",
        "Cobranzas",
        "Taquillero",
        "Call Center",
        "Almacén"
    ],
    "Tecnológico": [
        "Integraciones"
    ],
    "Recursos Humanos": [
        "Encargado",
        "Asistente"
    ],
    "Comercialización": [
        "Gerente",
        "Coordinador",
        "Asesor Comercial",
        "Promotor"
    ]
}

// Helper to get flat list if needed, though we should prefer hierarchical
export const ALL_JOB_TITLES = Array.from(new Set(
    Object.values(JOB_TITLES_BY_DEPARTMENT).flat()
)).sort()

// Module Feature Flags (Initial State)
export const INITIAL_MODULES_CONFIG = [
    { key: "module_tecnicos", label: "Técnicos (Instalaciones)", path: "/tecnicos", default: true },
    { key: "module_map", label: "Mapa de Red", path: "/map", default: true },
    { key: "module_dashboard", label: "Dashboard Interactivo", path: "/dashboard", default: true },
    { key: "module_transporte", label: "Transporte / Chofer", path: "/transporte", default: true },
    { key: "module_taller", label: "Taller Mecánico", path: "/taller", default: false },
    { key: "module_almacen", label: "Almacén", path: "/almacen", default: false },
    { key: "module_control", label: "Auditoría / Control", path: "/control", default: true },
    { key: "module_combustible", label: "Combustible", path: "/control/combustible", default: true },
] as const
