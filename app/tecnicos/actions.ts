"use server"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// --- EXISTING FUNCTIONS ABOVE ---

export async function getMySpools() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        console.log("getMySpools: No user")
        return []
    }

    // 1. Get Team
    const { data: profile } = await supabase.from("profiles").select("team_id, team:teams(id)").eq("id", user.id).single()
    console.log("getMySpools Profile/Team:", profile)

    // 2. Get Active Spool Assignments for this Team OR the User directly
    let query = supabase
        .from("inventory_assignments")
        .select(`
            id,
            items:inventory_assignment_items(quantity, serials, product:inventory_products(sku, name))
        `)
        .in("status", ["ACTIVE", "PARTIAL_RETURN"])
        .order("created_at", { ascending: false })

    if (profile?.team_id) {
        query = query.or(`team_id.eq.${profile.team_id},assigned_to.eq.${user.id}`)
    } else {
        query = query.eq("assigned_to", user.id)
    }

    const { data: assignments } = await query

    console.log("getMySpools Assignments:", assignments)

    // 3. Extract Serials and Calculate Remaining via View (Source of Truth)
    const spools: { serial: string, label: string, remaining: number }[] = []
    const serialsToFetch: string[] = []

    for (const a of assignments || []) {
        if (!a.items) continue
        for (const item of a.items) {
            const prod = Array.isArray(item.product) ? item.product[0] : item.product // Handle array/obj

            // Filter Logic: SKU 'I002', 'CARRETE' inside SKU, or 'Bobina'/'Carrete' in Name
            const sku = prod?.sku?.toUpperCase() || ""
            const name = prod?.name?.toUpperCase() || ""

            const isSpool = sku === "I002" || sku === "I001" || sku.includes("CARRETE") || name.includes("BOBINA") || name.includes("CARRETE")

            if (isSpool) {
                if (Array.isArray(item.serials)) {
                    for (const s of item.serials) {
                        const val = typeof s === 'string' ? s : s.serial
                        serialsToFetch.push(val)
                    }
                }
            }
        }
    }

    if (serialsToFetch.length > 0) {
        // Query the "Armored" View
        // Use base_quantity and usage_since_base to be consistent with Dashboard logic
        const { data: spoolStatus } = await supabase
            .from("view_spool_status")
            .select("serial_number, base_quantity, usage_since_base")
            .in("serial_number", serialsToFetch)

        // [PATCH REMOVED] Usage is already covered by view_spool_status
        // const { data: supportUsage } = await supabase...

        serialsToFetch.forEach(serial => {
            const status = spoolStatus?.find((s: any) => s.serial_number === serial)

            // Fallback if status is missing (brand new spool or sync issue)
            let remaining = 0
            let labelDetails = ""

            if (status) {
                const base = status.base_quantity || 0
                const usageInstallations = status.usage_since_base || 0
                // const usageSupports = supportUsageMap[serial] || 0  <-- REMOVED
                remaining = base - usageInstallations // - usageSupports
                labelDetails = `${remaining}m disp.`
            } else {
                // If not found in status view, assume it's available but unknown length (or 1000m default)
                // We mark it so it appears in the dropdown.
                remaining = 1000
                labelDetails = "Disp."
            }

            // ALWAYS add it, even if 0, so tech can see it
            spools.push({
                serial,
                label: `${serial} (${labelDetails})`,
                remaining
            })
        })
    }



    console.log("getMySpools Result:", spools)
    return spools
}

// [New] Modified Support Report to support Cedula
export async function createSupportReport(data: any) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { success: false, error: "Usuario no autenticado" }

    // Validation: Require either cedula OR cliente_id, and Cause
    if ((!data.cliente_id && !data.cedula) || !data.causa) {
        return { success: false, error: "Cédula y Causa son obligatorios" }
    }

    try {
        let finalClientId = data.cliente_id

        // Silent Lookup
        if (!finalClientId && data.cedula) {
            const { data: clientFound } = await supabase
                .from("clientes")
                .select("id")
                .eq("cedula", data.cedula)
                .maybeSingle() // Use maybeSingle to avoid 406 error if not found

            if (clientFound) finalClientId = clientFound.id
        }

        // --- SCHEMA ADAPTER ---
        // Verify columns before inserting to avoid "Could not find column" error.
        // Specifically for 'hasEvidence', 'potencia_nap', 'potencia_cliente'.
        // Since we can't easily auto-migrate, we will stick new fields into 'observacion' as text for now. (Or a jsonb column if available)

        // 1. Merge Potencias back to 'potencia' field if needed for legacy support
        const potCombined = `NAP: ${data.potencia_nap || 'N/A'} | Cliente: ${data.potencia_cliente || 'N/A'}`

        // 2. Append Speedtest/Evidence info to Observacion (to ensure it is saved even if columns missing)
        let appendObs = ""
        if (data.hasEvidence) appendObs += `\n[Evidencia Adjunta: SI]`
        if (data.potencia_nap || data.potencia_cliente) appendObs += `\n[Potencias] ${potCombined}`

        // --- SCHEMA MAPPING ---
        // Map frontend CamelCase to DB snake_case
        const dbInsert = {
            cliente_id: finalClientId || null,
            tecnico_id: user.id,
            cedula: data.cedula,
            causa: data.causa,
            precinto: data.precinto,
            caja_nap: data.caja_nap,
            puerto: data.puerto,
            coordenadas: data.coordenadas,
            observacion: data.observacion,
            codigo_carrete: data.codigo_carrete,
            metraje_usado: data.metraje_usado,
            metraje_desechado: data.metraje_desechado,
            conectores: data.conectores,
            tensores: data.tensores,
            patchcord: data.patchcord,
            rosetas: data.rosetas,
            onu_anterior: data.onu_anterior,
            onu_nueva: data.onu_nueva,
            fecha: data.fecha,
            hora: data.hora,
            realizado_por: user.email,
            estatus: "Realizado",

            // New 2.0 Columns
            potencia_nap: data.potencia_nap,
            potencia_cliente: data.potencia_cliente,
            has_evidence: data.hasEvidence,
            download_speed: data.download_speed,
            upload_speed: data.upload_speed,
            ping_latency: data.ping_latency
        }

        const { error } = await supabase.from("soportes").insert(dbInsert)

        if (error) {
            console.error("Error creating support report:", error)
            return { success: false, error: "Error al guardar (DB): " + error.message }
        }

        revalidatePath("/tecnicos/reportes")
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

// [New] Save Technician Daily Report
export async function saveTechnicianReport(data: any) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { success: false, error: "Usuario no autenticado" }

    try {
        // Get team
        const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", user.id).single()
        const date = new Date().toLocaleDateString("es-ES")

        // Use UPSERT on user_id + date
        // Note: If 'date' format changes, adjust constraint. We use standard formatted string to keep it daily.
        // Actually, date formats can be tricky in DB key. 
        // Let's rely on valid ISO string YYYY-MM-DD for uniqueness if possible, but user UI uses DD/MM/YYYY.
        // I'll stick to a canonical YYYY-MM-DD for database uniqueness to be safe.
        const canonicalDate = new Date().toISOString().split('T')[0] // 2024-01-01

        const payload = {
            user_id: user.id,
            team_id: profile?.team_id,
            date: canonicalDate,
            vehicle_id: data.vehicle_id,
            onu_serials: data.onu_serials,
            router_serials: data.router_serials,
            materials: data.materials,
            spools: data.spools,
            clients_snapshot: data.clients_snapshot || [],
            updated_at: new Date().toISOString(),

            // Normalized Columns
            conectores_used: data.materials?.conectores_used || 0,
            conectores_remaining: data.materials?.conectores_remaining || 0,
            conectores_defective: data.materials?.conectores_defective || 0,
            tensores_used: data.materials?.tensores_used || 0,
            tensores_remaining: data.materials?.tensores_remaining || 0,
            patchcords_used: data.materials?.patchcords_used || 0,
            patchcords_remaining: data.materials?.patchcords_remaining || 0,
            rosetas_used: data.materials?.rosetas_used || 0
        }

        const { error } = await supabase
            .from("technician_daily_reports")
            .upsert(payload, { onConflict: 'user_id, date' })

        if (error) throw error
        return { success: true }

    } catch (error: any) {
        console.error("Error saving report:", error)
        return { success: false, error: error.message }
    }
}

// [New] Get Today's Report
export async function getTechnicianReport() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const canonicalDate = new Date().toISOString().split('T')[0]

    const { data } = await supabase
        .from("technician_daily_reports")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", canonicalDate)
        .single()

    return data
}


export async function purgeTestData() {
    try {
        const cookieStore = await cookies()
        const userClient = await createClient()
        const { data: { user } } = await userClient.auth.getUser()

        if (!user) return { success: false, error: "No se identificó el usuario." }

        const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        // Select client: Admin (Full Access) or Standard (Restricted)
        const supabase = adminKey
            ? createServerClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                adminKey,
                { cookies: { getAll: () => [], setAll: () => { } } }
            )
            : userClient

        const todayStr = new Date().toISOString().split('T')[0]

        // 1. Delete Audits
        await supabase
            .from("inventory_audits")
            .delete()
            .or(`technician_id.eq.${user.id},team_id.eq.${user.id}`)
            .gte("created_at", todayStr)

        // 2. Delete Closures
        await supabase
            .from("cierres")
            .delete()
            .or(`tecnico_id.eq.${user.id},user_id.eq.${user.id}`)
            .gte("created_at", todayStr)

        // 3. Delete Reports (Optional, but good for reset)
        await supabase
            .from("technician_daily_reports")
            .delete()
            .eq("user_id", user.id)
            .eq("date", todayStr)

        revalidatePath("/tecnicos")
        return { success: true, message: "Datos de hoy eliminados." }

    } catch (err: any) {
        console.error("Purge Exception:", err)
        return { success: false, error: err.message }
    }
}


export async function finalizeDayAction() {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error("No autenticado")

        const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

        // 2. Fetch Active Assignments (Snapshot of what tech has)
        const { data: assignments } = await supabase
            .from("inventory_assignments")
            .select("*, items:inventory_assignment_items(*, product:inventory_products(id, sku, name))")
            .eq("assigned_to", user.id)
            .eq("status", "ACTIVE")

        // 2.5 Fetch Standard Products for Audit Template (Consumables)
        const KPI_SKUS = ["CARRETE", "CONV", "PREC", "ROSETA", "TENS", "PATCH1", "ONU"]
        const { data: stdProducts } = await supabase
            .from("inventory_products")
            .select("id, sku, name")
            .in("sku", KPI_SKUS)

        // 2.6 Calculate Reported Usage (Incremental if previous audit exists)
        const todayStr = new Date().toISOString().split('T')[0]

        // 3. Find ANY audit for today (Pending or Completed) - SINGLE AUDIT PER DAY POLICY
        const { data: todaysAudit } = await supabase
            .from("inventory_audits")
            .select("id, created_at, updated_at, status, notes")
            .eq("technician_id", user.id)
            .gte("created_at", todayStr)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()

        // 4. Calculate Incremental Usage
        // If audit exists, we only want usage AFTER the last update
        const cutoffTime = todaysAudit ? (todaysAudit.updated_at || todaysAudit.created_at) : todayStr

        let closureQuery = supabase
            .from("cierres")
            .select("metraje_usado, metraje_desechado, conectores, precinto, rosetas, tensores, patchcord, onu, codigo_carrete, created_at")
            .eq("tecnico_id", user.id)

        if (todaysAudit) {
            closureQuery = closureQuery.gt("created_at", cutoffTime)
        } else {
            closureQuery = closureQuery.gte("created_at", todayStr)
        }

        const { data: closes } = await closureQuery

        // [Fix] Include Soportes in Audit
        let supportQuery = supabase
            .from("soportes")
            .select("metraje_usado, metraje_desechado, conectores, tensores, patchcord, rosetas, onu_nueva, codigo_carrete, created_at")
            .eq("tecnico_id", user.id)

        if (todaysAudit) {
            supportQuery = supportQuery.gt("created_at", cutoffTime)
        } else {
            supportQuery = supportQuery.gte("created_at", todayStr)
        }

        const { data: supports } = await supportQuery

        // Setup Helpers (Moved here for scope clarity)
        const cleanMeters = (val: any) => {
            if (!val) return 0
            const num = parseInt(String(val).replace(/[^0-9]/g, ""), 10)
            return isNaN(num) ? 0 : num
        }

        const countItem = (val: any, isSerialLike: boolean) => {
            if (!val) return 0
            const str = String(val).trim()
            if (str.length === 0) return 0
            if (isSerialLike) return 1
            const num = parseInt(str.replace(/[^0-9]/g, ""), 10)
            return isNaN(num) ? 0 : num
        }

        const usageMap: Record<string, number> = {}
        const spoolUsageMap: Record<string, number> = {}

        closes?.forEach((c: any) => {
            if (c.codigo_carrete) {
                const used = cleanMeters(c.metraje_usado) + cleanMeters(c.metraje_desechado)
                spoolUsageMap[c.codigo_carrete] = (spoolUsageMap[c.codigo_carrete] || 0) + used
            }
            usageMap["CONV"] = (usageMap["CONV"] || 0) + countItem(c.conectores, false)
            usageMap["PREC"] = (usageMap["PREC"] || 0) + countItem(c.precinto, true)
            usageMap["ROSETA"] = (usageMap["ROSETA"] || 0) + countItem(c.rosetas, true)
            usageMap["TENS"] = (usageMap["TENS"] || 0) + countItem(c.tensores, false)
            usageMap["PATCH1"] = (usageMap["PATCH1"] || 0) + countItem(c.patchcord, true)
            usageMap["ONU"] = (usageMap["ONU"] || 0) + countItem(c.onu, true)
            usageMap["CARRETE"] = (usageMap["CARRETE"] || 0) + cleanMeters(c.metraje_usado) + cleanMeters(c.metraje_desechado)
        })

        // Process Soportes (Supports)
        supports?.forEach((s: any) => {
            if (s.codigo_carrete) {
                const used = cleanMeters(s.metraje_usado) + cleanMeters(s.metraje_desechado)
                spoolUsageMap[s.codigo_carrete] = (spoolUsageMap[s.codigo_carrete] || 0) + used
            }
            usageMap["CONV"] = (usageMap["CONV"] || 0) + (s.conectores || 0)
            // Supports don't usually have precintos? If they do, add here if column exists. Assuming no precinto col in soportes based on previous schema check.
            usageMap["ROSETA"] = (usageMap["ROSETA"] || 0) + (s.rosetas || 0)
            usageMap["TENS"] = (usageMap["TENS"] || 0) + (s.tensores || 0)
            usageMap["PATCH1"] = (usageMap["PATCH1"] || 0) + (s.patchcord || 0)
            usageMap["ONU"] = (usageMap["ONU"] || 0) + countItem(s.onu_nueva, true)
            usageMap["CARRETE"] = (usageMap["CARRETE"] || 0) + cleanMeters(s.metraje_usado) + cleanMeters(s.metraje_desechado)
        })

        // 5. Audit Upsert (Append Mode Logic)
        let auditId: string
        const currentTimestamp = new Date().toISOString()
        const batchLabel = `Anexo ${new Date().toLocaleTimeString('es-VE')}`

        if (todaysAudit) {
            auditId = todaysAudit.id
            // Re-open audit and update timestamp
            // Also append note to indicate batch
            await supabase.from("inventory_audits").update({
                status: "PENDING",
                updated_at: currentTimestamp,
                notes: (todaysAudit.notes || "Cierre de Jornada") + ` | ${batchLabel}`
            }).eq("id", auditId)
            // DO NOT DELETE existing items. We are appending.
        } else {
            const { data: newAudit, error: auditError } = await supabase.from("inventory_audits").insert({
                technician_id: user.id,
                team_id: profile?.team_id || null,
                notes: "Cierre de Jornada (Inicial)",
                status: "PENDING",
                updated_at: currentTimestamp
            }).select().single()
            if (auditError) throw new Error("Error iniciando auditoría: " + auditError.message)
            auditId = newAudit.id
        }

        // 6. Create Audit Items
        const auditItems: any[] = []
        const addedProductIds = new Set()

        if (assignments && assignments.length > 0) {
            assignments.forEach((a: any) => {
                a.items?.forEach((i: any) => {
                    const pid = i.product?.id || i.product_id
                    const sku = i.product?.sku || "UNKNOWN"
                    const name = i.product?.name || "Unknown Product"

                    let reported = 0
                    if (sku.includes("CARRETE")) {
                        if (Array.isArray(i.serials)) {
                            i.serials.forEach((s: any) => {
                                const serial = typeof s === 'string' ? s : s.serial
                                reported += (spoolUsageMap[serial] || 0)
                            })
                        } else {
                            reported = usageMap["CARRETE"] || 0
                        }
                    } else {
                        const key = KPI_SKUS.find(k => sku.includes(k))
                        if (key) reported = usageMap[key] || 0
                    }

                    // On Append (todaysAudit exists), ONLY add items with usage > 0 to avoid duplicates of "0"
                    const shouldAdd = !todaysAudit || reported > 0

                    if (shouldAdd) {
                        auditItems.push({
                            audit_id: auditId,
                            product_id: pid,
                            product_sku: sku,
                            product_name: name,
                            theoretical_quantity: i.quantity,
                            physical_quantity: i.quantity,
                            reported_quantity: reported,
                            notes: todaysAudit ? batchLabel : undefined
                        })
                    }
                    addedProductIds.add(pid)
                })
            })
        }

        if (stdProducts && stdProducts.length > 0) {
            stdProducts.forEach((p: any) => {
                if (!addedProductIds.has(p.id)) {
                    const key = KPI_SKUS.find(k => p.sku.includes(k))
                    const reported = key ? (usageMap[key] || 0) : 0

                    const shouldAdd = !todaysAudit || reported > 0

                    if (shouldAdd) {
                        auditItems.push({
                            audit_id: auditId,
                            product_id: p.id,
                            product_sku: p.sku,
                            product_name: p.name,
                            theoretical_quantity: 0,
                            physical_quantity: 0,
                            reported_quantity: reported,
                            notes: todaysAudit ? batchLabel : undefined
                        })
                    }
                }
            })
        }

        if (auditItems.length > 0) {
            const { error: itemsError } = await supabase.from("inventory_audit_items").insert(auditItems)
            if (itemsError) throw new Error("Error guardando items: " + itemsError.message)
        }

        revalidatePath("/tecnicos")
        return { success: true, message: "Jornada finalizada." }

    } catch (error: any) {
        console.error("Finalize Day Error:", error)
        return { success: false, error: error.message }
    }
}
