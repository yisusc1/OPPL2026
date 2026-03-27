"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// 1. Get all teams with their members
export async function getTeams() {
    const supabase = await createClient()

    // Fetch Teams
    const { data: teams, error } = await supabase
        .from("teams")
        .select(`
            id,
            name,
            profiles(
                id,
                first_name,
                last_name,
                email
            )
        `)
        .order("name")

    if (error) throw new Error(error.message)
    return teams
}

// 2. Create a new Team
export async function createTeam(name: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from("teams")
        .insert({ name })

    if (error) throw new Error(error.message)
    revalidatePath("/admin/equipos")
}

// 3. Delete Team
export async function deleteTeam(id: string) {
    const supabase = await createClient()

    // First unassign users? Or let cascade handle if we had cascade. 
    // Profile->Team is Set Null usually or strict. 
    // We should manually unassign to be safe or just delete team if constraints allow.
    // Profiles table FK constraint behavior depends on creation.
    // Let's unassign users first just in case.
    // A. Unassign users
    await supabase.from("profiles").update({ team_id: null }).eq("team_id", id)

    // B. Unlink Audits (Fix FK Violation)
    await supabase.from("inventory_audits").update({ team_id: null }).eq("team_id", id)

    // C. Unlink Inventory Assignments (Fix FK Violation)
    await supabase.from("inventory_assignments").update({ team_id: null }).eq("team_id", id)

    const { error } = await supabase.from("teams").delete().eq("id", id)
    if (error) throw new Error(error.message)
    revalidatePath("/admin/equipos")
}

// 4. Assign User to Team
export async function assignUserToTeam(userId: string, teamId: string | null) {
    const supabase = await createClient()

    const { error } = await supabase
        .from("profiles")
        .update({ team_id: teamId })
        .eq("id", userId)

    if (error) throw new Error(error.message)
    revalidatePath("/admin/equipos")
}

// 5. Get available technicians (technicians not in a team, or all)
export async function getTechnicians() {
    const supabase = await createClient()

    // Fetch users with 'tecnico' role
    // Using string search on array column "roles"
    const { data: techs } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, team_id")
        .contains("roles", ["tecnico"])

    return techs || []
}
// 2.5 Save Team (Create or Update)
export async function saveTeam(letter: string, leaderId: string, auxId: string, teamId?: string | null) {
    const supabase = await createClient()
    const name = `Equipo ${letter}`

    // 1. Check if name is taken by ANOTHER team
    const { data: existing } = await supabase
        .from("teams")
        .select("id")
        .eq("name", name)
        .neq("id", teamId || "00000000-0000-0000-0000-000000000000") // Exclude self if editing
        .single()

    if (existing) throw new Error(`El ${name} ya existe. Elige otra letra.`)

    let currentTeamId = teamId

    // 2. Create or Update Team
    if (currentTeamId) {
        // UPDATE
        const { error: updateError } = await supabase
            .from("teams")
            .update({ name })
            .eq("id", currentTeamId)

        if (updateError) throw new Error(updateError.message)
    } else {
        // CREATE
        const { data: team, error: createError } = await supabase
            .from("teams")
            .insert({ name })
            .select()
            .single()

        if (createError) throw new Error(createError.message)
        currentTeamId = team.id
    }

    if (!currentTeamId) throw new Error("Error obteniendo ID del equipo")

    // 3. Assign Members (Steal them from other teams if needed)

    // First, clear any previous members of THIS team if we want to be clean?
    // Actually, simply assigning the new ones updates their FK.
    // What if we REMOVED someone? (e.g. replaced Juan with Pedro).
    // Juan is still pointing to Team A? 
    // No, if we only assign Leader and Aux, we overwrite THEIR team_id.
    // But what about the OLD Leader/Aux if they were replaced?
    // They will SILL have team_id = currentTeamId unless we unset it.

    // So we should:
    // A. Set team_id = NULL for ALL profiles currently in this team.
    await supabase.from("profiles").update({ team_id: null }).eq("team_id", currentTeamId)

    // B. Assign new members
    const { error: assignError1 } = await supabase.from("profiles").update({ team_id: currentTeamId }).eq("id", leaderId)
    const { error: assignError2 } = await supabase.from("profiles").update({ team_id: currentTeamId }).eq("id", auxId)

    if (assignError1 || assignError2) {
        throw new Error("Equipo guardado pero hubo error asignando miembros.")
    }

    revalidatePath("/admin/equipos")
    return { success: true }
}
