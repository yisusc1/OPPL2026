"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function updateUserRoles(userId: string, newRoles: string[]) {
    // ... existing logic if needed or reimplemented
}

export async function updateProfileDetails(userId: string, department: string, jobTitle: string) {
    const supabase = await createClient()

    // Verify if requester is admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "No autorizado" }

    const { data: requesterProfile } = await supabase
        .from("profiles")
        .select("roles")
        .eq("id", user.id)
        .single()

    const roles = requesterProfile?.roles || []
    if (!roles.includes("admin")) return { error: "No tienes permisos de administrador" }

    try {
        const { error } = await supabase
            .from("profiles")
            .update({
                department: department,
                job_title: jobTitle
            })
            .eq("id", userId)

        if (error) throw error

        revalidatePath("/admin/usuarios")
        return { success: true }
    } catch (error) {
        console.error("Error updating profile details:", error)
        return { error: "Error al actualizar datos" }
    }
}

import { createClient as createSupabaseAdmin } from "@supabase/supabase-js"

export async function impersonateUserAction(email: string) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    // Check if key is available (it might be undefined in client bundle but this is server action)
    if (!serviceRoleKey) {
        return { error: "Falta SUPABASE_SERVICE_ROLE_KEY. Configurala en .env.local" }
    }

    try {
        const adminClient = createSupabaseAdmin(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            serviceRoleKey,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        )

        const { data, error } = await adminClient.auth.admin.generateLink({
            type: 'magiclink',
            email: email
        })

        if (error) throw error

        return { success: true, url: data.properties?.action_link }
    } catch (error: any) {
        console.error("Impersonation Error:", error)
        return { error: error.message || "Error al generar enlace" }
    }
}

export async function createUserAction(data: {
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    role: string
}) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) return { error: "Falta Service Role Key" }

    const supabase = await createClient()

    // Check Admin Permissions
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "No autorizado" }

    // Double check admin role in DB
    const { data: requester } = await supabase.from("profiles").select("roles").eq("id", user.id).single()
    if (!requester?.roles?.includes("admin")) return { error: "No tienes permisos de administrador" }

    try {
        const adminClient = createSupabaseAdmin(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            serviceRoleKey,
            { auth: { autoRefreshToken: false, persistSession: false } }
        )

        const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
            email: data.email,
            password: data.password,
            email_confirm: true,
            user_metadata: {
                first_name: data.firstName,
                last_name: data.lastName,
            }
        })

        if (createError) throw createError
        if (!newUser.user) throw new Error("No se pudo crear el usuario")

        // Set Initial Role if provided (defaulting to basic if not)
        const initialRole = data.role || "tecnico"

        // Update roles
        const { error: profileError } = await adminClient
            .from("profiles")
            .update({ roles: [initialRole] })
            .eq("id", newUser.user.id)

        revalidatePath("/admin/usuarios")
        return { success: true, userId: newUser.user.id }

    } catch (error: any) {
        console.error("Create User Error:", error)
        return { error: error.message || "Error al crear usuario" }
    }
}
