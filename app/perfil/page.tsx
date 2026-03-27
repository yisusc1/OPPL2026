
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { LogOut, User, Mail, Shield, Smartphone, Key, CircleUser, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PremiumPageLayout } from "@/components/ui/premium-page-layout"
import { PremiumCard } from "@/components/ui/premium-card"
import { PremiumContent } from "@/components/ui/premium-content"
import { LogoutButton } from "@/components/ui/logout-button"
import { ProfileDetails } from "./profile-details"
import { ChangePassword } from "./change-password"

export default async function PerfilPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <PremiumPageLayout title="Mi Perfil" description="Gestiona tu información personal y preferencias">

      <div className="max-w-4xl mx-auto space-y-6">

        {/* HEADLINE PROFILE CARD */}
        <PremiumCard className="p-8 relative overflow-hidden flex flex-col items-center text-center">
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white shadow-xl mb-6 ring-4 ring-white/10">
              <span className="text-4xl font-bold">
                {profile?.first_name?.charAt(0) || user.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            <h2 className="text-3xl font-bold text-foreground tracking-tight">
              {profile?.first_name} {profile?.last_name}
            </h2>
            <p className="text-muted-foreground mt-1 text-lg">
              {user.email}
            </p>
            <div className="flex gap-2 mt-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                <Shield size={12} />
                {profile?.role || 'Usuario'}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-green-500/10 text-green-500 border border-green-500/20">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Activo
              </span>
            </div>
          </div>

          {/* Background Decorative Elements */}
          <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
        </PremiumCard>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* INFO PERSONAL EXTRACTED COMPONENT */}
          <ProfileDetails profile={profile} email={user.email || ""} />

          {/* SECURITY & ACTIONS */}
          <PremiumContent className="p-0 overflow-hidden h-full flex flex-col">
            <div className="p-6 border-b border-white/5 bg-white/5">
              <h3 className="font-bold flex items-center gap-2">
                <Lock className="text-primary" size={20} />
                Seguridad y Sesión
              </h3>
            </div>
            <div className="p-6 flex-1 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <ChangePassword />
                {/* Add more security options here later */}
              </div>

              <div className="border-t border-white/5 pt-6 mt-auto">
                <LogoutButton />
              </div>
            </div>
          </PremiumContent>
        </div>

      </div>

    </PremiumPageLayout>
  )
}
