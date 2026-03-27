import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get("code")
    const next = searchParams.get("next") ?? "/"

    if (code) {
        const supabase = await createClient()
        console.log("Exchanging code for session...")
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
            console.log("Session exchanged successfully. Redirecting to", next)
            return NextResponse.redirect(`${origin}${next}`)
        } else {
            console.error("Error exchanging code:", error)
        }
    }

    // Return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
