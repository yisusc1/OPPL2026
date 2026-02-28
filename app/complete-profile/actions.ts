"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function updateProfile(formData: FormData) {
    const supabase = await createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        redirect("/login")
    }

    const first_name = formData.get("first_name") as string
    const last_name = formData.get("last_name") as string
    const national_id = formData.get("national_id") as string
    const phone = formData.get("phone") as string

    if (!first_name || !last_name || !national_id || !phone) {
        return { error: "Todos los campos son obligatorios" }
    }

    // Upsert profile to ensure it exists
    const { error } = await supabase
        .from("profiles")
        .upsert({
            id: user.id,
            first_name: first_name,
            last_name: last_name,
            cedula: national_id, // Map national_id from form to cedula in DB
            national_id: national_id, // Keep national_id for backward compatibility if needed
            phone: phone,
            email: user.email, // Ensure email is synchronized
            updated_at: new Date().toISOString()
        })

    if (error) {
        console.error("Error updating profile:", error)
        return { error: `Error: ${error.message} (Code: ${error.code})` }
    }

    revalidatePath("/", "layout")
    redirect("/")
}
