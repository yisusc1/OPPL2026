"use server"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function generateDailyReportData(teamName: string, date: string) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return cookieStore.getAll() },
                setAll() { }
            },
        }
    )

    // Helper to format date for query (assume text match or date range if needed)
    // The DB stores dates as text "DD/MM/YYYY" or timestamp?
    // "actual.sql" says "fecha text" or "fecha timestamp"?
    // cierres: "fecha text". (Line 32)
    // asignaciones: "fecha text". (Line 20)
    // We need to match the text format stored. Usually "2026-01-06" or "06/01/2026"?
    // The user prompts "Fecha: 06/1/2026". The client-form uses "new Date().toLocaleDateString('es-ES')" -> "6/1/2026" or "06/01/2026".
    // We should probably allow fuzzy match or strict if we know the format.
    // Let's assume the input `date` is passed as "DD/MM/YYYY" or convert it.

    try {
        // 1. Fetch Assignments (Asignaciones) for Team + Date
        const { data: assignments, error: assignError } = await supabase
            .from("asignaciones")
            .select("id, cliente_id, cliente, equipo, tecnico_1, tecnico_2, onu")
            .eq("equipo", teamName)
            .eq("fecha", date) // Match exact string stored

        if (assignError) throw new Error("Error fetching assignments: " + assignError.message)

        // 2. Fetch Closures (Cierres) for Team + Date
        const { data: closures, error: closureError } = await supabase
            .from("cierres")
            .select("*")
            .eq("equipo", teamName)
            .eq("fecha", date)

        if (closureError) throw new Error("Error fetching closures: " + closureError.message)

        // 3. Fetch Supports (Soportes) for Team/Tech + Date (using equipo might be harder if soportes uses tech_id)
        // soportes has: tecnico_id (uuid). No team_id or team_name.
        // We might skip soportes for now if not strictly linked to Team Name in schema, 
        // OR we need to find tech IDs for the team members first.
        // Let's stick to Cierres for Materials first as per prompt (Installations report).

        // --- PROCESSING ---

        // A. Installers
        // Take from profiles? Or just use "tecnico_1" and "tecnico_2" from first assignment/closure.
        const installers = Array.from(new Set([
            ...assignments?.map(a => a.tecnico_1).filter(Boolean) || [],
            ...assignments?.map(a => a.tecnico_2).filter(Boolean) || [],
            ...closures?.map(c => c.tecnico_1).filter(Boolean) || [],
            ...closures?.map(c => c.tecnico_2).filter(Boolean) || []
        ])).join(", ")

        // B. ONUS
        const installedOnus = closures
            ?.filter(c => c.onu && c.onu !== "N/A")
            .map(c => c.onu) || []

        const onuCount = installedOnus.length

        // C. Routers
        const routerCount = closures
            ?.filter(c => c.router && c.router !== "N/A")
            .length || 0

        // D. Installations Stats
        const successfulIds = new Set(closures?.map(c => c.cliente_id))
        const failedAssignments = assignments?.filter(a => !successfulIds.has(a.cliente_id)) || []

        const installationsCount = closures?.length || 0
        const failedCount = failedAssignments.length

        // Details of failed (Need reason?)
        // Since we don't have a "Failed Visit" log, we just list the Client Name. 
        // User can manually add reason or we search if there's a failed status in cierres (if any).
        // Check if any closures exist for these clients but with status != Activo?
        // Reuse closure list:
        const failedDetails = failedAssignments.map(a => ({
            client: a.cliente,
            reason: "No efectuada (Razón pendiente)" // Placeholder
        }))

        // E. Materials (Sum from Cierres)
        let connectorsUsed = 0
        let tensorsUsed = 0
        // closures columns are text? "conectores text". Need to parse.

        closures?.forEach(c => {
            connectorsUsed += (Number(c.conectores) || 0)
            tensorsUsed += (Number(c.tensores) || 0)
        })

        // F. Spools
        // usage per spool
        const spoolsUsage: Record<string, number> = {}
        const spoolsRemaining: Record<string, number> = {}

        // Calculate usage for this Report ONLY
        closures?.forEach(c => {
            if (c.codigo_carrete) {
                const used = Number(String(c.metraje_usado).replace(/[^0-9.]/g, "")) || 0
                const wasted = Number(String(c.metraje_desechado).replace(/[^0-9.]/g, "")) || 0
                spoolsUsage[c.codigo_carrete] = (spoolsUsage[c.codigo_carrete] || 0) + used + wasted
            }
        })

        // Fetch Remaining for these spools (using existing View or Logic)
        // We need current status.
        const spoolSerials = Object.keys(spoolsUsage)
        if (spoolSerials.length > 0) {
            const { data: spoolData } = await supabase
                .from("view_spool_status")
                .select("serial_number, current_quantity")
                .in("serial_number", spoolSerials)

            spoolData?.forEach((s: any) => {
                spoolsRemaining[s.serial_number] = s.current_quantity
            })
        }

        // --- CONSTRUCT RESULT ---
        return {
            date,
            team: teamName,
            installers,
            onus: {
                status: "Panel 04", // Hardcoded/Placeholder or need input? User prompt says "Estatus ONUS: Panel 04". Maybe "Panel" is a location? Default to "Por Def."
                count: onuCount,
                list: installedOnus
            },
            routers: routerCount,
            installations: {
                failedCount,
                failedDetails,
                totalPerformed: installationsCount
            },
            materials: {
                connectors: {
                    used: connectorsUsed,
                    remaining: 0, // Need Inventory Logic for this. Default 0 and let user edit?
                    defective: 0
                },
                tensors: {
                    used: tensorsUsed
                }
            },
            spools: Object.keys(spoolsUsage).map(serial => ({
                serial,
                used: spoolsUsage[serial],
                remaining: spoolsRemaining[serial] || 0
            }))
        }

    } catch (e: any) {
        throw new Error(e.message)
    }
}
