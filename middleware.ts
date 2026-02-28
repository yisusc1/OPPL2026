import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    // Create Supabase client
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return request.cookies.get(name)?.value
                },
                set(name: string, value: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value,
                        ...options,
                    })
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    response.cookies.set({
                        name,
                        value,
                        ...options,
                    })
                },
                remove(name: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value: "",
                        ...options,
                    })
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    response.cookies.set({
                        name,
                        value: "",
                        ...options,
                    })
                },
            },
        }
    )

    // Get user session
    const {
        data: { user },
    } = await supabase.auth.getUser()

    const path = request.nextUrl.pathname

    // Public paths
    if (path.startsWith("/login") || path.startsWith("/auth") || path.startsWith("/verification")) {
        // If logged in, redirect to home (except verification)
        if (user && !path.startsWith("/verification")) {
            return NextResponse.redirect(new URL("/", request.url))
        }
        return response
    }

    // Protected paths: If no user, redirect to login
    if (!user) {
        return NextResponse.redirect(new URL("/login", request.url))
    }

    // RBAC Checks
    // We need to fetch the user profile to check roles
    // Note: Middleware should be fast. Querying DB might be slow.
    // Ideally, role is in metadata. For now, we query DB as volumes are low.
    // RBAC Checks
    // We need to fetch the user profile to check roles
    const { data: profile } = await supabase
        .from("profiles")
        .select("roles, national_id, phone, first_name, last_name")
        .eq("id", user.id)
        .single()

    const roles = (profile?.roles || []).map((r: string) => r.toLowerCase())
    const hasRole = (role: string) => roles.includes("admin") || roles.includes(role)

    // 0. Profile Completion Check
    // Allow access to /complete-profile to avoid loop
    if (!path.startsWith("/complete-profile")) {
        // If profile is missing vital info, redirect
        if (!profile?.national_id || !profile?.phone || !profile?.first_name || !profile?.last_name) {
            return NextResponse.redirect(new URL("/complete-profile", request.url))
        }
    }

    // 1. Admin Paths
    if (path.startsWith("/admin") && !roles.includes("admin")) {
        return NextResponse.redirect(new URL("/unauthorized", request.url))
    }

    // 2. Transporte
    if (path.startsWith("/transporte") && !hasRole("transporte")) {
        return NextResponse.redirect(new URL("/unauthorized", request.url))
    }

    // 2.1 Almacen
    if (path.startsWith("/almacen") && !hasRole("almacen")) {
        return NextResponse.redirect(new URL("/unauthorized", request.url))
    }

    // 3. Taller
    if (path.startsWith("/taller") && !hasRole("taller")) {
        return NextResponse.redirect(new URL("/unauthorized", request.url))
    }

    // 4. Tecnicos
    if (path.startsWith("/tecnicos") && !hasRole("tecnico")) {
        return NextResponse.redirect(new URL("/unauthorized", request.url))
    }

    // 5. Control / Supervisor
    if (path.startsWith("/control") && !hasRole("supervisor")) {
        return NextResponse.redirect(new URL("/unauthorized", request.url))
    }

    return response
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
         * Feel free to modify this pattern to include more paths.
         */
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
}
