import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import Link from "next/link"
import { PremiumPageLayout } from "@/components/ui/premium-page-layout"
import { PremiumCard } from "@/components/ui/premium-card"
import { PremiumContent } from "@/components/ui/premium-content"
import { Button } from "@/components/ui/button"
import { getPendingAudits } from "./actions"

import { Users, User, ShieldCheck, ChevronRight, ArrowLeft, AlertCircle, Disc, Fuel } from "lucide-react"
import { DesktopModeToggle } from "@/components/desktop-mode-toggle"
import { DailyReportDialog } from "@/components/daily-report-dialog"

export default async function ControlPage() {
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

    // 1. Fetch Teams
    const { data: teams } = await supabase
        .from("teams")
        .select("id, name, profiles(id, first_name, last_name)")
        .order("name")

    // 2. Fetch Technicians
    const { data: technicians } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, team_id")
        .contains("roles", ["tecnico"])

    // 3. Fetch Pending Audits
    const pendingAudits = await getPendingAudits()
    const pendingSet = new Set(pendingAudits.map((a: any) => a.team_id || a.technician_id))

    // Filter techs without team
    const soloTechs = technicians?.filter(t => !t.team_id) || []

    return (
        <PremiumPageLayout title="Fiscalización" description="Panel de control de inventario y auditoría en tiempo real.">
            <div className="space-y-8">
                {/* HEADER ACTIONS */}
                <PremiumContent className="p-4 md:p-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-4 w-full md:w-auto">
                            <Link href="/admin/equipos" className="w-full md:w-auto">
                                <Button variant="outline" className="w-full h-12 rounded-xl border-dashed border-2 hover:border-primary hover:bg-primary/5 hover:text-primary transition-all">
                                    <Users className="mr-2 h-4 w-4" />
                                    Gestión de Equipos
                                </Button>
                            </Link>
                            <Link href="/control/spools" className="w-full md:w-auto">
                                <Button className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 font-bold">
                                    <Disc className="mr-2 h-5 w-5" />
                                    Gestión de Bobinas
                                </Button>
                            </Link>
                        </div>
                        <div className="w-full md:w-auto flex items-center justify-end gap-3">
                            <DesktopModeToggle />
                            <DailyReportDialog teams={teams || []} />
                        </div>
                    </div>
                </PremiumContent>

                {/* SECCION EQUIPOS */}
                <section>
                    <div className="flex items-center gap-3 mb-6 px-2">
                        <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                            <Users size={20} />
                        </div>
                        <h2 className="text-xl font-bold text-foreground">Equipos (Parejas)</h2>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {teams?.map((team) => (
                            <Link key={team.id} href={`/control/history/${team.id}`}>
                                <PremiumCard className="group h-full flex flex-col justify-between hover:border-blue-500/30 transition-all p-6">
                                    <div>
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-12 w-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center text-lg font-bold">
                                                    {team.name.replace("Equipo ", "")}
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-lg text-foreground group-hover:text-blue-500 transition-colors">{team.name}</h3>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-xs font-medium bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded">
                                                            Activo
                                                        </span>
                                                        {pendingSet.has(team.id) && (
                                                            <span className="flex items-center gap-1 text-[10px] font-bold bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded border border-amber-500/20 animate-pulse">
                                                                <AlertCircle size={10} />
                                                                AUDITAR
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="h-8 w-8 rounded-full bg-muted text-muted-foreground group-hover:bg-blue-500 group-hover:text-white flex items-center justify-center transition-colors">
                                                <ChevronRight size={18} />
                                            </div>
                                        </div>

                                        {/* Members Preview List */}
                                        <div className="space-y-3 border-t border-border/50 pt-4">
                                            {team.profiles && team.profiles.length > 0 ? (
                                                <div className="flex flex-col gap-2">
                                                    {/* @ts-ignore */}
                                                    {team.profiles.map((p: any) => (
                                                        <div key={p.id} className="flex items-center gap-3">
                                                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                                                                <User size={14} />
                                                            </div>
                                                            <span className="text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                                                                {p.first_name} {p.last_name}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="italic text-xs text-muted-foreground">Sin asignar</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-6 flex items-center gap-2 text-xs font-bold text-blue-500 opacity-60 group-hover:opacity-100 transition-opacity uppercase tracking-wider">
                                        <ShieldCheck size={14} />
                                        <span>Auditar Inventario</span>
                                    </div>
                                </PremiumCard>
                            </Link>
                        ))}
                        {teams?.length === 0 && (
                            <div className="col-span-full py-12 text-center border-2 border-dashed border-muted rounded-2xl">
                                <p className="text-muted-foreground">No hay equipos creados.</p>
                                <Link href="/admin/equipos">
                                    <Button variant="link" className="text-primary mt-2">Crear Equipo</Button>
                                </Link>
                            </div>
                        )}
                    </div>
                </section>

                {/* SECCION TECNICOS INDIVIDUALES */}
                <section>
                    <div className="flex items-center gap-3 mb-6 px-2">
                        <div className="h-10 w-10 rounded-xl bg-slate-500/10 text-slate-500 flex items-center justify-center">
                            <User size={20} />
                        </div>
                        <h2 className="text-xl font-bold text-foreground">Técnicos Individuales <span className="text-sm font-normal text-muted-foreground ml-2">(Sin Grupo)</span></h2>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {soloTechs.map((tech) => (
                            <Link key={tech.id} href={`/control/history/${tech.id}`}>
                                <PremiumCard className="group hover:border-slate-500/30 transition-all p-6">
                                    <div className="flex items-center gap-4">
                                        <div className="h-14 w-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center text-lg font-bold uppercase">
                                            {(tech.first_name || "T")[0]}{(tech.last_name || "")[0]}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">{tech.first_name} {tech.last_name}</h3>
                                            <p className="text-xs text-muted-foreground font-mono">{tech.email}</p>
                                            {pendingSet.has(tech.id) && (
                                                <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded border border-amber-500/20 animate-pulse">
                                                    <AlertCircle size={10} />
                                                    PENDIENTE
                                                </div>
                                            )}
                                        </div>
                                        <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-primary">
                                            <ChevronRight size={18} />
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-border/50 flex items-center gap-2 text-xs font-bold text-muted-foreground group-hover:text-primary transition-colors uppercase tracking-wider">
                                        <ShieldCheck size={14} />
                                        <span>Auditar Inventario</span>
                                    </div>
                                </PremiumCard>
                            </Link>
                        ))}
                        {soloTechs.length === 0 && (
                            <div className="col-span-full py-8 text-center">
                                <p className="text-muted-foreground text-sm">Todos los técnicos están asignados a un equipo.</p>
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </PremiumPageLayout>
    )
}
