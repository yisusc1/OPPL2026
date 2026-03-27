"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { User } from "@supabase/supabase-js"

type UserRole = "admin" | "transporte" | "taller" | "tecnico" | "invitado" | "almacen" | "chofer" | "supervisor" | "auditoria" | "combustible" | "dashboard" | "mapa" | "procesador" | "gerencia"

interface UserProfile {
    id: string
    email: string
    roles: string[]
    first_name?: string
    last_name?: string
    national_id?: string
    department?: string
    job_title?: string
    no_emojis?: boolean
}

interface UserContextType {
    user: User | null
    profile: UserProfile | null
    isLoading: boolean
    hasRole: (role: UserRole) => boolean
    isAdmin: boolean
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({
    children,
    initialUser = null,
    initialProfile = null
}: {
    children: React.ReactNode
    initialUser?: User | null
    initialProfile?: UserProfile | null
}) {
    const [user, setUser] = useState<User | null>(initialUser)
    const [profile, setProfile] = useState<UserProfile | null>(initialProfile)
    const [isLoading, setIsLoading] = useState(!initialUser)

    const supabase = createClient()

    useEffect(() => {
        // If we already have user/profile from server, we don't need to fetch immediately
        // But we still set up the subscription

        const fetchUser = async () => {
            if (initialUser && initialProfile) {
                // Already have data, just ensure loading is false
                setIsLoading(false)
                return
            }

            try {
                const { data: { user } } = await supabase.auth.getUser()
                setUser(user)

                if (user) {
                    const { data, error } = await supabase
                        .from("profiles")
                        .select("*")
                        .eq("id", user.id)
                        .single()

                    if (error) console.error("UserProvider: error fetching profile", error)

                    if (data) setProfile(data)
                }
            } catch (error) {
                console.error("Error fetching user data:", error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchUser()

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                // If the session matches what we have, do nothing (avoids flicker)
                if (session?.user?.id === user?.id) return

                setUser(session?.user ?? null)
                if (session?.user) {
                    const { data } = await supabase
                        .from("profiles")
                        .select("*")
                        .eq("id", session.user.id)
                        .single()
                    if (data) setProfile(data)
                } else {
                    setProfile(null)
                }
                setIsLoading(false)
            }
        )

        return () => {
            subscription.unsubscribe()
        }
    }, [initialUser, initialProfile, user?.id]) // Added dependencies

    const hasRole = (role: UserRole) => {
        if (!profile?.roles) return false
        const currentRoles = profile.roles.map(r => r.toLowerCase())
        if (currentRoles.includes("admin")) return true
        return currentRoles.includes(role.toLowerCase())
    }

    const value = {
        user,
        profile,
        isLoading,
        hasRole,
        isAdmin: profile?.roles?.some(r => r.toLowerCase() === "admin") ?? false
    }

    return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

export const useUser = () => {
    const context = useContext(UserContext)
    if (context === undefined) {
        throw new Error("useUser must be used within a UserProvider")
    }
    return context
}
