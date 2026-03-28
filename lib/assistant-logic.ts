export type AssistantAction =
    | { type: 'NAVIGATE'; path: string }
    | { type: 'SPEAK'; text: string }
    | { type: 'NONE' }

interface KnowledgeItem {
    topics: string[]
    keywords: string[]
    description: string
    action: AssistantAction
    response: string
}

// The "Brain" of the project
const KNOWLEDGE_BASE: KnowledgeItem[] = [
    // --- NAVIGATION ---
    {
        topics: ["taller", "mantenimiento", "mecánica", "reparación", "falla"],
        keywords: ["ir", "abrir", "mostrar", "ver", "registrar", "reportar"],
        description: "Módulo de Taller y Mantenimiento",
        action: { type: 'NAVIGATE', path: '/taller' },
        response: "Abriendo el módulo de Taller. Aquí puedes gestionar mantenimientos y fallas."
    },
    {
        topics: ["vehículos", "flota", "carros", "coches", "unidades", "transporte"],
        keywords: ["ir", "abrir", "mostrar", "ver", "lista"],
        description: "Administración de Flota",
        action: { type: 'NAVIGATE', path: '/admin/vehiculos' },
        response: "Accediendo a la flota de vehículos."
    },
    {
        topics: ["combustible", "gasolina", "diesel", "tanqueo", "consumo"],
        keywords: ["ir", "control", "abrir", "ver", "registro"],
        description: "Control de Combustible",
        action: { type: 'NAVIGATE', path: '/control/combustible' },
        response: "Abriendo el control de combustible."
    },
    {
        topics: ["almacén", "inventario", "materiales", "stock", "herramientas", "bobinas"],
        keywords: ["ir", "abrir", "ver", "consultar"],
        description: "Almacén e Inventario",
        action: { type: 'NAVIGATE', path: '/almacen' },
        response: "Yendo al almacén de materiales."
    },
    {
        topics: ["inicio", "home", "casa", "principal", "dashboard", "portal"],
        keywords: ["volver", "ir", "regresar"],
        description: "Página Principal",
        action: { type: 'NAVIGATE', path: '/' },
        response: "Volviendo a la página principal."
    },
    {
        topics: ["perfil", "usuario", "cuenta", "mis datos", "cargo"],
        keywords: ["ver", "ir", "mi"],
        description: "Perfil de Usuario",
        action: { type: 'NAVIGATE', path: '/perfil' },
        response: "Mostrando tu perfil de usuario."
    },

    // --- ACTIONS & UTILS ---
    {
        topics: ["escanear", "qr", "cámara", "leer código"],
        keywords: ["abrir", "iniciar", "activar"],
        description: "Escáner QR",
        action: { type: 'NAVIGATE', path: '/control/combustible/scan' },
        response: "Activando la cámara para escanear QR."
    },

    // --- Q&A / CONCEPTS (Local Knowledge) ---
    {
        topics: ["proyecto", "sistema", "app", "aplicación"],
        keywords: ["qué es", "información", "sobre"],
        description: "Info del sistema",
        action: { type: 'SPEAK', text: "" }, // Dynamic text below
        response: "Este es el Sistema de Gestión Integral de Operaciones. Permite administrar vehículos, almacén, personal técnico y mantenimientos."
    },
    {
        topics: ["ayuda", "comandos", "qué puedes hacer"],
        keywords: ["dime", "lista", "instrucciones"],
        description: "Ayuda del asistente",
        action: { type: 'SPEAK', text: "" },
        response: "Puedes pedirme que vaya a cualquier módulo como Taller, Almacén o Vehículos. También puedo iniciar el escáner QR o responder preguntas básicas sobre el sistema."
    }
]

export function processVoiceCommand(transcript: string): { response: string; action: AssistantAction } {
    const normalizedText = transcript.trim().toLowerCase()

    if (!normalizedText) {
        return { response: "No te escuché bien.", action: { type: 'NONE' } }
    }

    // 1. Direct Back Navigation
    if (normalizedText.includes("volver") || normalizedText.includes("atrás") || normalizedText.includes("regresar")) {
        // Special case relying on router.back() needing to be handled by component
        // We will return a specific action type or handle it in the generic navigation if acceptable.
        // For now, let's treat it as a generic "SPEAK" command telling the user we are going back, 
        // but the component needs to implement 'BACK'. 
        // Let's assume standard navigation for now, or add a 'BACK' type.
        // To keep types simple, we'll let the component handle a special path or we add a type.
        // Let's add 'BACK' to types conceptually, but for now strict typing above.
        // Let's assume the component keeps the old simple logic for "backward" or we map it here.
        // Hack: path 'BACK'
        return { response: "Volviendo...", action: { type: 'NAVIGATE', path: 'BACK' } }
    }

    // 2. Score Matching
    let bestMatch: KnowledgeItem | null = null
    let maxScore = 0

    for (const item of KNOWLEDGE_BASE) {
        let score = 0

        // Topic match (Heavy weight)
        for (const topic of item.topics) {
            if (normalizedText.includes(topic)) score += 10
        }

        // Keyword match (Medium weight, ONLY if topic matches or is very specific)
        for (const keyword of item.keywords) {
            if (normalizedText.includes(keyword)) score += 2
        }

        // Bonus for exact phrases? (Simplistic for now)

        if (score > maxScore) {
            maxScore = score
            bestMatch = item
        }
    }

    // Threshold
    if (bestMatch && maxScore >= 5) {
        return { response: bestMatch.response, action: bestMatch.action }
    }

    return {
        response: "No estoy seguro de qué hacer con eso. Intenta decir 'Ir a taller' o 'Ayuda'.",
        action: { type: 'NONE' }
    }
}
