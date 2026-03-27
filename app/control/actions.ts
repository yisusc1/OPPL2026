"use server"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

// Helper to clean meters from text (local fallback if DB function missing)
function cleanMeters(text: string | null): number {
    if (!text) return 0
    const numbers = text.replace(/[^0-9]/g, "")
    return numbers ? parseInt(numbers, 10) : 0
}

const cleanQuantity = (text: any): number => {
    if (!text) return 0
    if (typeof text === 'number') return text
    const str = String(text).trim()

    // Handle "Si", "Yes" -> 1
    if (["si", "yes", "ok", "true"].includes(str.toLowerCase())) return 1

    // Check for comma separated values (lists of serials)
    if (str.includes(',')) {
        return str.split(',').filter(s => s.trim().length > 0).length
    }

    // Attempt to parse number
    const numeric = parseInt(str.replace(/[^0-9]/g, ""), 10)

    // Logic Heuristic:
    // If input is purely alphanumeric (like a Serial "J2M9C4"), parsing might fail or return junk.
    // If it has letters and numbers, it's likely a Serial -> Count 1.
    // Regex for alphanumeric serial (at least 1 letter, total len > 3):
    if (/[a-zA-Z]/.test(str) && str.length > 3) {
        return 1
    }

    // If number is absurdly large (e.g. > 1000) for a standard item unit like Precinto
    if (!isNaN(numeric) && numeric > 1000) {
        return 1
    }

    // Common case: "2", "2 unds", "1" -> returns 2, 2, 1
    // If strict number (e.g. "3")
    if (!isNaN(numeric)) return numeric

    // Fallback: if there's text content but no clear number, assume 1? Or 0?
    // Safety: 0
    return 0
}

export async function getAuditData(entityId: string) {
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

    // A. DETERMINE IF ENTITY IS USER OR TEAM
    const now = new Date()
    const minDate = new Date(now)
    minDate.setHours(0, 0, 0, 0)
    const maxDate = new Date(now)
    maxDate.setHours(23, 59, 59, 999)

    let teamMembers: string[] = []
    let teamName = ""
    let entityName = ""
    let userTeamId: string | null = null

    // Check if ID is a team
    const { data: team } = await supabase
        .from("teams")
        .select("id, name, profiles(id, first_name, last_name)")
        .eq("id", entityId)
        .single()

    if (team) {
        // IT IS A TEAM
        teamName = team.name
        entityName = "Equipo " + team.name
        // @ts-ignore
        teamMembers = team.profiles?.map((p: any) => p.id) || []
    } else {
        // FALLBACK: INDIVIDUAL TECHNICIAN
        const { data: user } = await supabase.from("profiles").select("*").eq("id", entityId).single()
        if (user) {
            teamMembers = [user.id]
            entityName = `${user.first_name} ${user.last_name}`
            if (user.team_id) {
                userTeamId = user.team_id
                const { data: t } = await supabase.from("teams").select("name").eq("id", user.team_id).single()
                if (t) teamName = t.name
            }
        }
    }

    if (teamMembers.length === 0) throw new Error("Entidad no encontrada (Usuario o Equipo)")

    // 0. Check for EXISTING Pending Audit (Created by Tech or Draft)
    const { data: pendingAudit } = await supabase
        .from("inventory_audits")
        .select(`*, items:inventory_audit_items(*)`)
        .or(`technician_id.eq.${entityId},team_id.eq.${entityId}`)
        .eq("status", "PENDING")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

    if (pendingAudit) {
        // Use existing audit data
        const stock = pendingAudit.items?.map((i: any) => ({
            name: i.product_name || i.item_name,
            assigned: i.theoretical_quantity,
            reported: i.reported_quantity || 0,
            sku: i.product_sku || i.item_sku,
            productId: i.product_id,
            physical: i.physical_quantity, // Load saved physical
            notes: i.notes // Include notes for grouping
        })) || []

        // [Fix] Force Live Spool Logic for Pending Audits too
        // We fetch Active Assignments via team_id OR assigned_to
        let assignQuery = supabase
            .from("inventory_assignments")
            .select(`items:inventory_assignment_items(serials, product:inventory_products(sku))`)
            .eq("status", "ACTIVE")

        // Determine Search Scope
        // If we are auditing a Team (entityId is team), match team_id
        // If we are auditing a User who is in a Team, match team_id OR assigned_to
        // But strict OR in Supabase is tricky with .in(). 
        // Strategy: If teamName exists, assume Team Logic -> Match team_id.
        // If not, match assigned_to.
        // Actually, 'teamMembers' covers everyone.

        let targetTeamId = team ? team.id : (userTeamId || null)

        if (targetTeamId) {
            assignQuery = assignQuery.eq("team_id", targetTeamId)
        } else {
            assignQuery = assignQuery.in("assigned_to", teamMembers)
        }

        const { data: activeAssignments } = await assignQuery

        const activeSpoolSerials = new Set<string>()
        let spoolProductId = ""
        activeAssignments?.forEach((a: any) => {
            a.items?.forEach((item: any) => {
                if (item.product?.sku?.includes("CARRETE") && Array.isArray(item.serials)) {
                    if (item.product?.id) spoolProductId = item.product.id
                    item.serials.forEach((s: any) => activeSpoolSerials.add(typeof s === 'string' ? s : s.serial))
                }
            })
        })

        if (activeSpoolSerials.size > 0) {
            const serials = Array.from(activeSpoolSerials)

            // A. Get Status from View
            const { data: spoolStatus } = await supabase
                .from("view_spool_status")
                .select("serial_number, base_quantity, usage_since_base")
                .in("serial_number", serials)

            let totalBase = 0
            let totalUsage = 0

            spoolStatus?.forEach((s: any) => {
                totalBase += (s.base_quantity || 0)
                totalUsage += (s.usage_since_base || 0)
            })

            // C. Override Stock Map Item
            // We must find the item corresponding to the Spools.
            // Pending items likely have the Serial as SKU (e.g. "A").
            // We search for an item that matches ANY active serial OR "CARRETE"
            const spoolItem = stock.find((i: any) =>
                serials.includes(i.sku) ||
                i.sku === "CARRETE" ||
                i.sku.includes("CARRETE")
            )

            if (spoolItem) {
                // Update existing item with LIVE data from View
                spoolItem.assigned = totalBase
                spoolItem.reported = totalUsage
                // Force name update slightly to indicate live sync?
                // spoolItem.name = `${spoolItem.name} (Sincronizado)` 
            } else {
                stock.push({
                    name: "Bobina de Fibra",
                    assigned: totalBase,
                    reported: totalUsage,
                    sku: "CARRETE",
                    productId: spoolProductId || "found-via-view",
                    physical: undefined,
                    notes: undefined
                })
            }
        }

        return {
            auditId: pendingAudit.id,
            technician: {
                id: entityId,
                type: team ? 'TEAM' : 'USER',
                first_name: entityName,
                last_name: "",
                members: teamMembers // Useful for frontend info
            },
            stock
        }
    }

    // 1. Get Assigned Inventory (For ALL members)
    const { data: assignments, error: assignError } = await supabase
        .from("inventory_transactions")
        .select(`
            quantity,
            type,
            product:inventory_products!inner(sku, name, id)
        `)
        .in("assigned_to", teamMembers)
        .eq("type", "OUT")

    if (assignError) throw new Error("Error fetching assignments: " + assignError.message)

    // 2. Get Usage from Installations (Aggregated)
    // We try to match by Team Name (field 'equipo') OR by technician names.
    // 2. Get Usage from Installations (Aggregated)
    // We try to match by Team Name (field 'equipo') OR by technician names.
    const idsString = `(${teamMembers.join(',')})`
    const { data: closes } = await supabase
        .from("cierres")
        .select("metraje_usado, metraje_desechado, conectores, precinto, rosetas, tensores, patchcord, onu, tecnico_1, equipo, user_id, tecnico_id")
        // Use OR to catch both modern (user_id) and legacy/parallel (tecnico_id) records
        .or(`user_id.in.${idsString},tecnico_id.in.${idsString}`)
        .gte("created_at", minDate.toISOString())
        .lte("created_at", maxDate.toISOString())
        .not("codigo_carrete", "is", null)
        .order("created_at", { ascending: false })

    const teamCloses = (closes || []).filter(c => {
        // Robust ID Matching (Both User ID and Technician ID)
        if (c.user_id && teamMembers.includes(c.user_id)) return true
        if (c.tecnico_id && teamMembers.includes(c.tecnico_id)) return true

        // Match by Team Name
        if (teamName && c.equipo && c.equipo.trim().toLowerCase() === teamName.toLowerCase()) return true

        // Match by Tech Name is hard without precise name list. 
        // For now, if we are auditing a Team, we rely on 'equipo' column mainly.
        // If auditing a User, we rely on 'tecnico_1' partial match (existing logic)

        if (!teamName) {
            // Manual user match fallback
            return (c.tecnico_1 && c.tecnico_1.toLowerCase().includes(entityName.split(" ")[0].toLowerCase()))
        }
        return false
    })

    // 3. Aggregate Data
    const stockMap: Record<string, { name: string, assigned: number, reported: number, sku: string, productId: string }> = {}

    const KPI_MAP: Record<string, string> = {
        "CARRETE": "metraje_usado",
        "CONV": "conectores",
        "PREC": "precinto",
        "ROSETA": "rosetas",
        "TENS": "tensores",
        "PATCH1": "patchcord",
        "ONU": "onu" // Added ONU mapping
    }

    // [New] Pre-fetch product info for all KPI_MAP keys to allow reporting unassigned items
    // We need product IDs and Names for standard items if they appear in usage but not assignments.
    const kpiSkus = Object.keys(KPI_MAP)
    // We can't do exact match because "ONU" is a prefix usually? Text says "ONU"?
    // The SKU in products table is usually just "ONU", "CONV", etc? Or "ONU-ZTE"?
    // Let's assume the KPI keys match the SKUs or distinct parts of them.
    // For simplicity, let's fetch products that match these SKUs.
    const { data: allProducts } = await supabase
        .from("inventory_products")
        .select("id, sku, name")
        .in("sku", kpiSkus)

    // Helper to find product stats
    const findProduct = (skuKey: string) => allProducts?.find(p => p.sku === skuKey)

    // Process Assignments
    assignments?.forEach((tx: any) => {
        const sku = tx.product.sku
        const qty = tx.quantity
        if (!stockMap[sku]) {
            stockMap[sku] = { name: tx.product.name, assigned: 0, reported: 0, sku, productId: tx.product.id }
        }
        stockMap[sku].assigned += qty

        if (sku === "CARRETE" && qty < 50) {
            stockMap[sku].assigned = stockMap[sku].assigned - qty + (qty * 1000)
        }
    })



    // Process Reported Usage
    teamCloses.forEach((cierre: any) => {
        Object.keys(KPI_MAP).forEach(sku => {
            const key = KPI_MAP[sku]

            // Fuzzy SKU Match:
            // 1. Try Exact Match
            // 2. Try 'starts with' (e.g. stock has 'ONU-ZTE', KPI has 'ONU')
            // 3. Try 'includes'
            let targetSku = sku
            if (!stockMap[targetSku]) {
                const fuzzyKey = Object.keys(stockMap).find(k => k.startsWith(sku) || k.includes(sku))
                if (fuzzyKey) targetSku = fuzzyKey
            }

            // Allow adding if not exists (using generic KPI SKU)
            if (!stockMap[targetSku]) {
                const p = findProduct(sku)
                // Only add if we can resolve the product (so we have ID/Name)
                if (p) {
                    stockMap[sku] = { name: p.name, assigned: 0, reported: 0, sku: p.sku, productId: p.id }
                    targetSku = sku
                } else if (sku === 'CARRETE') {
                    stockMap[sku] = { name: "Bobina de Fibra (Genérico)", assigned: 0, reported: 0, sku, productId: "unknown" }
                    targetSku = sku
                }
            }

            if (stockMap[targetSku]) {
                const rawVal = cierre[key]

                if (sku === 'CARRETE') {
                    // Sum used + wasted
                    const used = cleanMeters(cierre['metraje_usado'])
                    const wasted = cleanMeters(cierre['metraje_desechado'])
                    stockMap[targetSku].reported += (used + wasted)
                } else if (sku === 'ONU' || sku === 'PREC') {
                    // [Fix] Forced Count for Serialized/Coded items
                    // If text exists and is long enough, count 1. Bypass heuristic.
                    const valStr = String(rawVal || "").trim()
                    if (valStr.length > 2 && valStr.toLowerCase() !== 'n/a' && valStr.toLowerCase() !== 'no') {
                        stockMap[targetSku].reported += 1
                    }
                } else {
                    // @ts-ignore
                    const val = cleanQuantity(rawVal)
                    stockMap[targetSku].reported += val
                }
            }
        })
    })

    // Return dummy profile wrapper for frontend compatibility
    // [Fix] Override CARRETE data with Active Assignment Real-time Data via View
    // MATCH LOGIC: Check Team ID if available, else assigned_to
    let assignQuery2 = supabase
        .from("inventory_assignments")
        .select(`items:inventory_assignment_items(serials, product:inventory_products(sku))`)
        .eq("status", "ACTIVE")

    let targetTeamId2 = team ? team.id : (userTeamId || null)

    if (targetTeamId2) {
        assignQuery2 = assignQuery2.eq("team_id", targetTeamId2)
    } else {
        assignQuery2 = assignQuery2.in("assigned_to", teamMembers)
    }

    const { data: activeAssignments } = await assignQuery2

    const activeSpoolSerials = new Set<string>()
    let spoolProductId = ""
    activeAssignments?.forEach((a: any) => {
        a.items?.forEach((item: any) => {
            if (item.product?.sku?.includes("CARRETE") && Array.isArray(item.serials)) {
                if (item.product?.id) spoolProductId = item.product.id
                item.serials.forEach((s: any) => activeSpoolSerials.add(typeof s === 'string' ? s : s.serial))
            }
        })
    })

    if (activeSpoolSerials.size > 0) {
        const serials = Array.from(activeSpoolSerials)

        // A. Get Status from View
        const { data: spoolStatus } = await supabase
            .from("view_spool_status")
            .select("serial_number, base_quantity, usage_since_base")
            .in("serial_number", serials)

        let totalBase = 0
        let totalUsage = 0

        spoolStatus?.forEach((s: any) => {
            totalBase += (s.base_quantity || 0)
            totalUsage += (s.usage_since_base || 0)
        })

        // C. Override Stock Map
        // We must find the item corresponding to the Spools.
        // We search for an item that matches ANY active serial OR "CARRETE"
        const spoolItemKey = Object.keys(stockMap).find(key =>
            serials.includes(key) ||
            key === "CARRETE" ||
            key.includes("CARRETE")
        )

        // If found, update. If not found (very likely if map is built from usage only), create it.
        // But if creation added "CARRETE", we overwrite it.
        if (spoolItemKey && stockMap[spoolItemKey]) {
            stockMap[spoolItemKey].assigned = totalBase
            stockMap[spoolItemKey].reported = totalUsage
        } else {
            // Fallback: If not found, ensuring we add one.
            stockMap["CARRETE"] = {
                name: "Bobina de Fibra",
                assigned: totalBase,
                reported: totalUsage,
                sku: "CARRETE",
                productId: spoolProductId || "found-via-active"
            }
        }
    }

    return {
        auditId: pendingAudit?.id,
        created_at: pendingAudit?.created_at,
        notes: pendingAudit?.notes,
        status: pendingAudit?.status,
        technician: {
            id: entityId,
            type: team ? 'TEAM' : 'USER',
            first_name: entityName,
            last_name: "",
            members: teamMembers // Useful for frontend info
        },
        stock: Object.values(stockMap)
    }
}

export async function saveAudit(auditData: any) {
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

    // UPDATE EXISTING FLOW
    if (auditData.auditId) {
        // 1. Update Header
        const { error: headerError } = await supabase
            .from("inventory_audits")
            .update({
                notes: auditData.notes,
                status: 'COMPLETED' // Supervisor Finalize
            })
            .eq("id", auditData.auditId)

        if (headerError) throw new Error(headerError.message)

        // 2. Update Items
        for (const item of auditData.items) {
            // Update Physical Quantity
            // We use audit_id + product_sku to identify item
            await supabase
                .from("inventory_audit_items")
                .update({ physical_quantity: item.physical })
                .eq("audit_id", auditData.auditId)
                .eq("product_sku", item.sku)
        }

        // 3. Reconcile (Transactions)
        if (auditData.reconcileStock) {
            const transactions = []
            const { data: { user } } = await supabase.auth.getUser()

            for (const item of auditData.items) {
                const diff = (item.physical || 0) - (item.theoretical || 0)
                if (diff !== 0) {
                    const type = diff > 0 ? 'IN' : 'OUT'
                    const qty = Math.abs(diff)
                    transactions.push({
                        product_id: item.productId,
                        type: type,
                        quantity: qty,
                        reason: `Ajuste Auditoría: ${diff > 0 ? 'Sobrante' : 'Faltante'}`,
                        assigned_to: auditData.entityId, // Simplification
                        received_by: user?.email || 'Sistema',
                        receiver_id: user?.id,
                        created_at: new Date().toISOString()
                    })
                }
            }
            if (transactions.length > 0) {
                await supabase.from("inventory_transactions").insert(transactions)
            }
        }

        return { success: true, auditId: auditData.auditId }
    }

    // 1. Create Audit Header (NEW AUDIT FLOW)
    const payload: any = {
        notes: auditData.notes
    }

    if (auditData.entityType === 'TEAM') {
        payload.team_id = auditData.entityId
        // ALSO assign to Leader (First Member) so history persists if Team is deleted
        if (auditData.members && auditData.members.length > 0) {
            payload.technician_id = auditData.members[0]
        }
    } else {
        payload.technician_id = auditData.entityId
    }

    const { data: audit, error: headerError } = await supabase
        .from("inventory_audits")
        .insert(payload)
        .select()
        .single()

    if (headerError) throw new Error(headerError.message)

    // 2. Insert Items & Reconcile
    const { data: { user } } = await supabase.auth.getUser()

    const items = []
    const transactions = []

    for (const item of auditData.items) {
        // A. Prepare Audit Item Record
        items.push({
            audit_id: audit.id,
            product_sku: item.sku,
            product_name: item.name,
            theoretical_quantity: item.theoretical,
            physical_quantity: item.physical,
            reported_quantity: item.reported || 0,
            item_name: item.name,
            item_sku: item.sku,
            product_id: item.productId || null,
            unit_type: item.sku.includes('CARRETE') ? 'METERS' : 'UNITS'
        })

        // B. Reconcile Logic
        if (auditData.reconcileStock) {
            const diff = item.physical - item.theoretical

            if (diff !== 0) {
                // If diff > 0: Found MORE than expected. We need to ADD to their stock -> IN
                // If diff < 0: Found LESS than expected. We need to REMOVE from their stock -> OUT
                const type = diff > 0 ? 'IN' : 'OUT'
                const qty = Math.abs(diff)

                transactions.push({
                    product_id: item.productId,
                    type: type,
                    quantity: qty,
                    reason: `Ajuste Auditoría: ${diff > 0 ? 'Sobrante' : 'Faltante'}`,
                    assigned_to: auditData.entityType === 'TEAM'
                        ? auditData.members[0] // Default to first member for team assignment valid FK? Or Team ID? 
                        // Wait, transactions use 'assigned_to' UUID (Profile). Teams don't own stock directly in this schema usually, 
                        // stock is calculated by "assigned_to IN team_members".
                        // So we assign to the first member found, or the entityId if it's a user.
                        : auditData.entityId,
                    received_by: user?.email || 'Sistema',
                    receiver_id: user?.id,
                    created_at: new Date().toISOString()
                })

                // Small correction for TEAM assignments:
                // If entityType is TEAM, we need a valid User UUID. 
                // We'll use the first member's ID as the "Holder" of the adjustment.
                if (auditData.entityType === 'TEAM' && (!auditData.members || auditData.members.length === 0)) {
                    // Fallback: Cannot assign if no members. Skip transaction to avoid FK error.
                    // But we should have members from getAuditData.
                } else if (auditData.entityType === 'TEAM') {
                    // Ensure we use a valid UUID from the members list
                    // transactions[last].assigned_to = auditData.members[0]; 
                    // Logic checked above.
                }
            }
        }
    }

    const { error: itemsError } = await supabase
        .from("inventory_audit_items")
        .insert(items)

    if (itemsError) throw new Error(itemsError.message)

    // Execute Adjustments if any
    if (transactions.length > 0) {
        const { error: txError } = await supabase
            .from("inventory_transactions")
            .insert(transactions)

        if (txError) {
            // Log error but don't fail the whole audit? Or fail hard?
            // Let's fail hard so they know adjustment didn't work.
            throw new Error("Error creando ajustes de inventario: " + txError.message)
        }
    }

    return { success: true, auditId: audit.id }
}

export async function getAuditHistory(entityId: string) {
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

    // Try to match as team_id OR technician_id
    const { data: audits, error } = await supabase
        .from("inventory_audits")
        .select("id, created_at, notes, supervisor_id, team_id, technician_id, status")
        .or(`team_id.eq.${entityId},technician_id.eq.${entityId}`)
        .order("created_at", { ascending: false })

    if (error) throw new Error(error.message)
    return audits
}

export async function getAuditDetails(auditId: string) {
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

    const { data: audit, error } = await supabase
        .from("inventory_audits")
        .select(`
            *,
            items:inventory_audit_items(*)
        `)
        .eq("id", auditId)
        .single()

    if (error) throw new Error(error.message)

    // [New] Fetch Active Spool Info from Assignments
    let spoolData: any[] = []
    let installations: any[] = [] // Store installations/closures found

    // Determine Team ID
    let teamId = audit.team_id
    if (!teamId && audit.technician_id) {
        // Fallback: finding team of the technician
        const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", audit.technician_id).single()
        if (profile) teamId = profile.team_id
    }

    const spools: string[] = []

    // 1. Determine Scope (Team vs Individual)
    let memberIds: string[] = []
    if (teamId) {
        const { data: members } = await supabase.from("profiles").select("id").eq("team_id", teamId)
        memberIds = members?.map(m => m.id) || []
    } else if (audit.technician_id) {
        memberIds = [audit.technician_id]
    }

    // 2. Fetch Active Assignments (Team or User)
    let assignQuery = supabase
        .from("inventory_assignments")
        .select(`
            id,
            items:inventory_assignment_items(serials, product:inventory_products(sku))
        `)
        .eq("status", "ACTIVE")

    if (teamId) {
        assignQuery = assignQuery.eq("team_id", teamId)
    } else {
        // Individual assignments
        assignQuery = assignQuery.in("assigned_to", memberIds)
    }

    const { data: assignments } = await assignQuery

    if (assignments && assignments.length > 0) {
        assignments.forEach((a: any) => {
            a.items?.forEach((item: any) => {
                if (item.product?.sku?.includes("CARRETE") && Array.isArray(item.serials)) {
                    item.serials.forEach((s: any) => spools.push(typeof s === 'string' ? s : s.serial))
                }
            })
        })
    }

    // 2. [New] Get Used Spools (Finalized) from Closures on Audit Date
    // 2. [New] Get used spools from closures on Audit Date
    // If PENDING, use TODAY (Now). If COMPLETED, use Audit Creation Date.
    let refDateStr = audit.created_at
    if (audit.status === 'PENDING') {
        refDateStr = new Date().toISOString()
    }

    if (refDateStr) {
        // [Fix] Use Venezuela Timezone Range
        const auditDate = new Date(refDateStr)

        // Create formatter for Venezuela
        const veFormatter = new Intl.DateTimeFormat("en-US", {
            timeZone: "America/Caracas",
            year: 'numeric', month: '2-digit', day: '2-digit'
        })

        // Get YYYY-MM-DD parts in Venezuela Time
        const parts = veFormatter.formatToParts(auditDate)
        const find = (type: string) => parts.find(p => p.type === type)?.value
        const y = find('year')
        const m = find('month')
        const d = find('day')

        // Construct Start and End ISO strings for that day in UTC
        // Since we want 00:00:00 VET to 23:59:59 VET
        // And VET is UTC-4 fixed (no DST currently)
        // 00:00 VET = 04:00 UTC
        // 23:59 VET = 03:59 UTC (Next Day)

        // Safer approach: string comparison or ISO construction
        const veDayStartISO = `${y}-${m}-${d}T00:00:00.000` // implied VET
        const veDayEndISO = `${y}-${m}-${d}T23:59:59.999`

        // Converting these 'Local VET' strings to UTC Dates implies offset
        // We can manually add offset Z+4? No, simply use format logic
        // Let's rely on simple Date manipulation with Offset

        // Hardcode Offset for VET (-04:00)
        const startTimestamp = new Date(`${y}-${m}-${d}T00:00:00-04:00`).toISOString()
        const endTimestamp = new Date(`${y}-${m}-${d}T23:59:59.999-04:00`).toISOString()

        const minDate = new Date(startTimestamp)
        const maxDate = new Date(endTimestamp)

        // Get Team Members to query their closures
        // We already have 'memberIds' computed above
        // const { data: members } = await supabase.from("profiles").select("id").eq("team_id", teamId)
        // const memberIds = members?.map(m => m.id) || []

        if (memberIds.length > 0) {
            // [Modified] Fetch Closures
            const { data: closures } = await supabase
                .from("cierres")
                .select("id, metraje_usado, metraje_desechado, created_at, tecnico_1, codigo_carrete, equipo, cliente:clientes(nombre, cedula)")
                .in("user_id", memberIds)
                .gte("created_at", minDate.toISOString())
                .lte("created_at", maxDate.toISOString())
                .not("codigo_carrete", "is", null)
                .order("created_at", { ascending: false })

            installations = closures || []

            // [New] Fetch Supports
            // Note: 'soportes' might not have a strict FK to 'clientes' in some schemas, causing join to fail.
            // Removing join to ensure data retrieval.
            const { data: supports } = await supabase
                .from("soportes")
                .select("id, metraje_usado, metraje_desechado, created_at, tecnico_id, codigo_carrete, causa, observacion") // Removed cliente join
                .in("tecnico_id", memberIds)
                .gte("created_at", minDate.toISOString())
                .lte("created_at", maxDate.toISOString())
                .order("created_at", { ascending: false })

            // Merge supports into installations list (polymorphic) or keep separate?
            // Merging allows single timeline, but fields differ.
            // Let's attach them to the return object separately first, OR merge them with a 'type' field.
            // Merging with type is better for timeline.
            if (supports) {
                const supportItems = supports.map((s: any) => ({
                    ...s,
                    type: 'SUPPORT',
                    tecnico_1: s.tecnico_id, // Map for compatibility if needed
                    equipo: 'SOPORTE' // Visual label
                }))
                installations = [...installations, ...supportItems].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            }

            // Add spools from closures AND supports to the list to fetch
            closures?.forEach((c: any) => {
                if (c.codigo_carrete && !spools.includes(c.codigo_carrete)) {
                    spools.push(c.codigo_carrete)
                }
            })
            supports?.forEach((s: any) => {
                if (s.codigo_carrete && !spools.includes(s.codigo_carrete)) {
                    spools.push(s.codigo_carrete)
                }
            })
        }
    } // End if audit.created_at

    // 3. For each Spool, fetch status from VIEW (Project Armor)
    const uniqueSpools = Array.from(new Set(spools)) // Deduplicate

    const { data: viewData } = await supabase
        .from("view_spool_status")
        .select("serial_number, base_quantity, usage_since_base")
        .in("serial_number", uniqueSpools)

    uniqueSpools.forEach(serial => {
        const viewRec = viewData?.find(v => v.serial_number === serial)
        const savedItem = audit.items?.find((i: any) => i.product_sku === serial)
        const isCompleted = audit.status === 'COMPLETED'

        // Determine Values
        // If Completed: Trust the Snapshot (savedItem) absolutely.
        // If Pending: Trust the View (Live Data) -> Override Snapshot.
        // Fallback: If View missing, use SavedItem or Zero.

        let currentQty = 0
        let reportedQty = 0
        let physicalQty = undefined

        if (isCompleted && savedItem) {
            currentQty = savedItem.theoretical_quantity
            reportedQty = savedItem.reported_quantity
            physicalQty = savedItem.physical_quantity
        } else if (viewRec) {
            currentQty = viewRec.base_quantity
            reportedQty = viewRec.usage_since_base
            // If we have a saved physical count (draft), keep it
            if (savedItem) physicalQty = savedItem.physical_quantity
        } else if (savedItem) {
            // Fallback if View has no data (unlikely if active)
            currentQty = savedItem.theoretical_quantity
            reportedQty = savedItem.reported_quantity
            physicalQty = savedItem.physical_quantity
        }

        spoolData.push({
            serial_number: serial,
            current_quantity: currentQty,
            reported_quantity: reportedQty, // This is 'Usage since Base'
            physical_quantity: physicalQty,
            assignment_id: assignments?.find(a => a.items.some((i: any) => i.serials && i.serials.includes(serial)))?.id
        })
    })


    // [New] Filter out items that are actually Spool Records (identified by matching product_sku with spool serials)
    // This prevents them from appearing in the generic items list
    if (audit.items) {
        audit.items = audit.items.filter((i: any) => !spoolData.some(s => s.serial_number === i.product_sku))
    }

    return { ...audit, spoolData, installations }
}

export async function approveAudit(auditId: string) {
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

    const { error } = await supabase
        .from("inventory_audits")
        .update({ status: 'COMPLETED' })
        .eq("id", auditId)

    if (error) throw new Error(error.message)
    revalidatePath("/control")
    return { success: true }
}

export async function getPendingAudits() {
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

    const { data: audits } = await supabase
        .from("inventory_audits")
        .select("id, team_id, technician_id, created_at")
        .eq("status", "PENDING")

    return audits || []
}

export async function updateAndApproveAudit(auditId: string, items: any[], notes?: string, spoolUpdates?: { serial: string, physical: number, theoretical: number, reported: number }[]) {
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

    // 1. Update Items with Physical Counts
    for (const item of items) {
        // We only update physical_quantity. 
        // reported_quantity is what was used (history).
        await supabase
            .from("inventory_audit_items")
            .update({
                physical_quantity: item.physical_quantity
            })
            .eq("id", item.id)
    }

    // [New] 1.5 Update Spools if provided
    if (spoolUpdates && spoolUpdates.length > 0) {
        // Ensure it's an array (handle legacy single object call if any remains, though we fixed the caller)
        const updates = Array.isArray(spoolUpdates) ? spoolUpdates : [spoolUpdates]

        const { data: { user } } = await supabase.auth.getUser()

        for (const update of updates) {
            // A. Update Serial Master Record
            await supabase
                .from("inventory_serials")
                .update({ current_quantity: update.physical })
                .eq("serial_number", update.serial)

            // C. Persist Spool Count to Audit Items (for history)
            // Use product_sku to store SERIAL for reliable lookup
            const { data: existingItem } = await supabase
                .from("inventory_audit_items")
                .select("id")
                .eq("audit_id", auditId)
                .eq("product_sku", update.serial)
                .single()

            if (existingItem) {
                await supabase
                    .from("inventory_audit_items")
                    .update({
                        physical_quantity: update.physical,
                        theoretical_quantity: update.theoretical,
                        reported_quantity: update.reported
                    })
                    .eq("id", existingItem.id)
            } else {
                await supabase
                    .from("inventory_audit_items")
                    .insert({
                        audit_id: auditId,
                        product_sku: update.serial, // Store Serial as SKU
                        item_name: `Bobina ${update.serial}`,
                        physical_quantity: update.physical,
                        reported_quantity: update.reported,
                        theoretical_quantity: update.theoretical
                    })
            }

            // B. Log Adjustment Transaction (Only if diff?)
            // Logic implies this is an override, so we log the adjustment to the Master Record.
            await supabase.from("inventory_transactions").insert({
                type: 'ADJUST',
                quantity: update.physical,
                previous_stock: 0,
                new_stock: update.physical,
                reason: `Auditoría Supervisada: Ajuste de Bobina ${update.serial}`,
                user_id: user?.id,
                serials: [update.serial]
            })
        }
    }

    // 2. Update Audit Status & Notes
    const { error } = await supabase
        .from("inventory_audits")
        .update({
            status: 'COMPLETED',
            notes: notes ? notes : undefined, // Only update if provided
            updated_at: new Date().toISOString() // Crucial for usage cutoff
        })
        .eq("id", auditId)

    if (error) throw new Error(error.message)

    revalidatePath("/control")
    revalidatePath(`/control/history/view/${auditId}`)

    return { success: true }
}

export async function getAuditInstallations(technicianId: string, minDate: string, maxDate: string) {
    const supabase = await createClient()

    // Fetch closures (Installations) within the audit range
    const { data: installations, error } = await supabase
        .from("cierres")
        .select(`
            id,
            created_at,
            cliente:clientes(id, nombre, direccion, plan, onu),
            conectores,
            metraje_usado,
            metraje_desechado,
            tensores,
            precinto,
            patchcord,
            rosetas,
            onu,
            codigo_carrete
        `)
        .eq("tecnico_id", technicianId)
        .gte("created_at", minDate)
        .lte("created_at", maxDate)
        .order("created_at", { ascending: true })

    if (error) {
        console.error("Error fetching installations:", error)
        return []
    }

    return installations
}

