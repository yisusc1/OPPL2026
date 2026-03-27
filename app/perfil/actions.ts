"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function updateProfileData(data: {
    first_name: string
    last_name: string
    national_id: string
    phone: string
}) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "No autorizado" }

    const { error } = await supabase
        .from("profiles")
        .update({
            first_name: data.first_name,
            last_name: data.last_name,
            national_id: data.national_id,
            phone: data.phone,
            updated_at: new Date().toISOString()
        })
        .eq("id", user.id)

    if (error) {
        console.error("Error updating profile:", error)
        return { error: "No se pudo actualizar el perfil." }
    }

    revalidatePath("/perfil")
    revalidatePath("/", "layout")
    return { success: true }
}

export async function changePassword(password: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "No autorizado" }

    const { error } = await supabase.auth.updateUser({
        password: password
    })

    if (error) {
        console.error("Error changing password:", error)
        return { error: error.message }
    }

    return { success: true }
}
