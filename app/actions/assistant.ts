"use server"

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai"
import { createClient } from "@/lib/supabase/server"
import { PROJECT_CONTEXT, DB_SCHEMA } from "@/lib/ai/knowledge"

export type AIActionResponse = {
    success: boolean
    data?: {
        response: string
        action: {
            type: 'NAVIGATE' | 'SPEAK' | 'NONE'
            path?: string
        }
    }
    error?: string
    errorMessage?: string
}

// --- TOOLS DEFINITION ---
const tools = [
    {
        functionDeclarations: [
            {
                name: "query_database",
                description: "Ejecuta una consulta SELECT segura a la base de datos Supabase para obtener información en tiempo real.",
                parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                        table: {
                            type: SchemaType.STRING,
                            description: "Nombre de la tabla a consultar (ej: 'clientes', 'vehiculos', 'inventory_products')."
                        },
                        columns: {
                            type: SchemaType.STRING,
                            description: "Columnas a seleccionar separadas por coma (ej: 'id, nombre, placa'). Usa '*' solo si es necesario."
                        },
                        limit: {
                            type: SchemaType.INTEGER,
                            description: "Número máximo de registros a traer (Default: 5). usa 1 si buscas algo especifico."
                        },
                        filter_column: { type: SchemaType.STRING, description: "Columna para filtrar (WHERE)" },
                        filter_operator: { type: SchemaType.STRING, description: "Operador: 'eq' (igual), 'ilike' (contiene), 'gt' (mayor), 'lt' (menor)" },
                        filter_value: { type: SchemaType.STRING, description: "Valor para el filtro" }
                    },
                    required: ["table", "columns"]
                }
            }
        ]
    }
]

export async function processWithGemini(transcript: string, pathname: string = "/"): Promise<AIActionResponse> {
    const API_KEY = (process.env.GEMINI_API_KEY || "").trim()

    // 1. Check System Settings (Kill Switch)
    const { getSystemSettings } = await import("../admin/settings-actions")
    const settings = await getSystemSettings()

    // Default to TRUE if key missing (to avoid breaking on first run)
    const isEnabled = settings["GEMINI_ENABLED"] !== false

    if (!isEnabled) {
        return { success: false, error: "DISABLED_BY_ADMIN" }
    }

    if (!API_KEY) {
        return { success: false, error: "MISSING_KEY" }
    }

    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        let userName = "Usuario"
        let userTitle = "Colaborador"

        if (user) {
            // Fetch Name and Roles to determine Title
            const { data: profile } = await supabase.from("profiles").select("first_name, roles").eq("id", user.id).single()

            if (profile) {
                if (profile.first_name) userName = profile.first_name

                // Role Mapping to Titles
                const roles = Array.isArray(profile.roles) ? profile.roles : []

                if (roles.includes("admin")) userTitle = "Director"
                else if (roles.includes("supervisor")) userTitle = "Supervisor"
                else if (roles.includes("tecnico")) userTitle = "Técnico"
                else if (roles.includes("taller")) userTitle = "Jefe de Taller"
                else if (roles.includes("almacen")) userTitle = "Gerente de Almacén"
            }
        }

        // --- PAGE CONTEXT MAP (Visual Awareness) ---
        const PAGE_CONTEXT_MAP: Record<string, string> = {
            "/tecnicos": "Technician Dashboard. Shows active installations, stats, and 'New Installation' / 'Report Support' buttons.",
            "/admin/vehiculos": "Vehicle Fleet Management. Shows grid of vehicles. Filters available.",
            "/control/spools": "Spool Management. Shows list of fiber optic spools.",
            "/taller": "Mechanical Workshop Panel."
        }

        const currentContext = PAGE_CONTEXT_MAP[pathname] || "Unknown Page"

        // --- SINGLE MODEL: GEMINI 2.5 FLASH (STABLE/FAST) ---
        const genAI_Tool = new GoogleGenerativeAI(API_KEY)

        const MODEL_NAME = "gemini-2.0-flash-lite-preview-02-05";
        // Use 'as any' for tools to avoid minor version type mismatches with SDK
        const modelTool = genAI_Tool.getGenerativeModel({
            model: MODEL_NAME,
            tools: tools as any,
        })

        const finalSystemPrompt = `
    IDENTITY:
    Eres Linky, el Asistente de Inteligencia Artificial del SGO.
    
    PERSONALITY:
    - Eres extremadamente amable, servicial y atento.
    - Tu tono debe ser profesional pero cálido.
    - Siempre muestras disposición para ayudar.

    PROTOCOL DE COMUNICACIÓN:
    - IMPORTANTE: Siempre dirígete al usuario como "${userTitle} ${userName}".
    - Ejemplo: "Entendido, ${userTitle} ${userName}", "Buscando eso enseguida, ${userTitle} ${userName}".
    
    CURRENT STATE:
    - User Name: ${userName}
    - User Title: ${userTitle}
    - Current Page: ${pathname}
    - Visual Context: ${currentContext}

    Use valid JSON output.
    If the user says 'Iniciar instalación' and they are on '/tecnicos', map it to action: { type: 'NAVIGATE', path: '/tecnicos/reportes?action=new' }.

    CONTEXT:
    ${PROJECT_CONTEXT}
    
    DB SCHEMA:
    ${DB_SCHEMA}
    
    FINAL OUTPUT FORMAT:
    You MUST output a JSON object at the very end of your final response (after tool use):
    {
      "response": "Natural language response to user.",
      "action": { "type": "NAVIGATE"|"SPEAK"|"NONE", "path": "..." }
    }
    `

        const chatSession = modelTool.startChat({
            history: [
                { role: "user", parts: [{ text: finalSystemPrompt }] },
                { role: "model", parts: [{ text: `Okay, I am ready. I know I am talking to ${userName} on active page ${pathname}.` }] }
            ]
        })

        let result = await chatSession.sendMessage(transcript)
        let response = result.response
        let functionCalls = response.functionCalls()

        // Handle Tool Execution Loop
        if (functionCalls && functionCalls.length > 0) {
            const supabase = await createClient() // Create client here to use inside tool

            const functionResponses = await Promise.all(functionCalls.map(async (call) => {
                const { name, args } = call
                // Safe casting for generic args access
                const safeArgs = args as any
                let toolResult: any = { error: "Unknown tool" }

                if (name === "query_database") {
                    console.log(`[AI DB] Querying ${safeArgs.table}...`)
                    try {
                        let query = supabase.from(safeArgs.table as string).select(safeArgs.columns as string)

                        if (safeArgs.limit) query = query.limit(Number(safeArgs.limit))

                        if (safeArgs.filter_column && safeArgs.filter_value) {
                            const op = (safeArgs.filter_operator as string) || 'eq'
                            const col = safeArgs.filter_column as string
                            const val = safeArgs.filter_value

                            switch (op) {
                                case 'ilike': query = query.ilike(col, val); break;
                                case 'like': query = query.like(col, val); break;
                                case 'gt': query = query.gt(col, val); break;
                                case 'lt': query = query.lt(col, val); break;
                                case 'gte': query = query.gte(col, val); break;
                                case 'lte': query = query.lte(col, val); break;
                                default: query = query.eq(col, val);
                            }
                        }

                        const { data, error } = await query
                        if (error) toolResult = { error: error.message }
                        else toolResult = { data: data }
                    } catch (err: any) {
                        toolResult = { error: err.message }
                    }
                }

                return {
                    functionResponse: {
                        name: name,
                        response: toolResult
                    }
                }
            }))

            // Send tool results back to model
            result = await chatSession.sendMessage(functionResponses)
            response = result.response
        }

        const text = response.text()
        console.log("AI Final Text:", text)

        let data;
        try {
            // Attempt 1: Parse strict JSON
            data = JSON.parse(text)
        } catch (e) {
            // Attempt 2: Extract JSON from Markdown/Text
            try {
                const jsonStart = text.indexOf('{')
                const jsonEnd = text.lastIndexOf('}')
                if (jsonStart !== -1 && jsonEnd !== -1) {
                    const jsonString = text.substring(jsonStart, jsonEnd + 1)
                    data = JSON.parse(jsonString)
                } else {
                    throw new Error("No JSON found")
                }
            } catch (e2) {
                // Fallback: If no JSON or invalid JSON, treat entire text as response
                // BUT filter out potential raw JSON residue if it looks like code
                let cleanText = text.replace(/```json[\s\S]*?```/g, "") // Remove code blocks
                    .replace(/\{[\s\S]*\}/g, "")        // Remove raw objects if loose
                    .trim()

                if (!cleanText) cleanText = text // If we stripped everything, revert to original

                return {
                    success: true,
                    data: {
                        response: cleanText,
                        action: { type: 'NONE' }
                    }
                }
            }
        }

        return { success: true, data }

    } catch (error: any) {
        console.error("Gemini API Error:", error)
        return { success: false, error: "API_ERROR", errorMessage: error.message }
    }
}
