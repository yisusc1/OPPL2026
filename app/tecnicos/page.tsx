import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import Link from "next/link"
import { RedirectType, redirect } from "next/navigation"
import { Button } from "@/components/ui/button"

export const dynamic = "force-dynamic"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { User, Shield, Users, Wrench, ArrowRight, Package, AlertTriangle, LogOut, Lock, Trash2, Plus, CheckCircle2 } from "lucide-react"
import { LogoutButton } from "@/components/ui/logout-button"
import { FinalizeDayButton } from "./components/finalize-day-button"
import { TechnicianReportDialog } from "./components/technician-report-dialog"
import { DesktopModeToggle } from "@/components/desktop-mode-toggle"
import { VoiceHint } from "@/components/voice-hint"
import { PremiumPageLayout } from "@/components/ui/premium-page-layout"
import { PremiumCard } from "@/components/ui/premium-card"
import { PremiumContent } from "@/components/ui/premium-content"

export default async function TechnicianDashboard() {
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

  // 1. Get User
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // 2. Get Profile & Team
  const { data: profile } = await supabase
    .from("profiles")
    .select(`
            *,
            team:teams(id, name, profiles(id, first_name, last_name))
        `)
    .eq("id", user.id)
    .single()

  if (!profile) return <div>Error cargando perfil</div>

  // 3. Determine Partner (if in team)
  const partner = profile.team?.profiles?.find((p: any) => p.id !== user.id)
  const teamMembersIDs = profile.team?.profiles?.map((p: any) => p.id) || [user.id]

  // 4. Calculate Inventory (Mi Salida)

  // ROBUST DATE LOGIC
  const veFormatter = new Intl.DateTimeFormat("en-US", { timeZone: "America/Caracas", year: 'numeric', month: 'numeric', day: 'numeric' })
  const todayVE = veFormatter.format(new Date())
  const getVeDate = (d: string) => veFormatter.format(new Date(d))

  // Fetch Items from ACTIVE Assignments
  let query = supabase
    .from("inventory_assignments")
    .select(`
        id,
        status,
        items:inventory_assignment_items (
            quantity,
            serials,
            product:inventory_products(sku, name)
        )
    `)
    .in("status", ["ACTIVE", "PARTIAL_RETURN"]) // Filters out RETURNED/CLOSED

  // Safe OR filter construction
  if (profile.team?.id) {
    query = query.or(`assigned_to.in.(${teamMembersIDs.join(',')}),team_id.eq.${profile.team.id}`)
  } else {
    query = query.eq('assigned_to', user.id)
  }

  const { data: assignments, error: assignError } = await query

  // Fetch Usage (Closures) by Team or Techs
  const { data: closures, error: closuresError } = await supabase
    .from("cierres")
    .select("metraje_usado, metraje_desechado, conectores, precinto, rosetas, tensores, patchcord, tecnico_1, equipo, created_at, id, tecnico_id, codigo_carrete, user_id, cedula, cliente")
    .or(`tecnico_id.in.(${teamMembersIDs.join(',')}),user_id.in.(${teamMembersIDs.join(',')})`)
    .order("created_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50)

  // Fetch Supports (Today)
  const { data: rawSupports } = await supabase
    .from("soportes")
    .select("created_at, tecnico_id, conectores, tensores, patchcord, rosetas, metraje_usado, metraje_desechado, codigo_carrete, onu_nueva, cedula, causa")
    .in("tecnico_id", teamMembersIDs)
    .order("created_at", { ascending: false })
    .limit(20)

  // Filter Supports by TZ
  const supports = rawSupports?.filter((s: any) => getVeDate(s.created_at) === todayVE) || []


  if (closuresError) {
    console.error("DEBUG: Error fetching closures:", closuresError)
  }

  // Fetch Returns (Devoluciones)
  const { data: returns } = await supabase
    .from("inventory_returns")
    .select(`
        created_at,
        inventory_return_items (
            product_id,
            quantity,
            serials,
            condition,
            product:inventory_products(sku)
        ),
        assignment:inventory_assignments!inner(assigned_to)
    `)
    .in("assignment.assigned_to", teamMembersIDs)

  // Filter relevant closures
  const myClosures = closures?.filter(c => {
    // 1. Match Team Name (Legacy)
    if (profile.team?.name && c.equipo === profile.team.name) return true

    // 2. Match Technician ID (New RLS compliant way)
    if (c.tecnico_id && teamMembersIDs.includes(c.tecnico_id)) return true

    // 3. Fallback: Match User ID (Legacy)
    if (c.user_id && teamMembersIDs.includes(c.user_id)) return true

    return false
  }) || []

  // CHECK FINALIZE BUTTON VISIBILITY
  const getVeDateString = (d: string | Date) => {
    return new Date(d).toLocaleDateString("es-VE", { timeZone: "America/Caracas" })
  }
  const todayStr = getVeDateString(new Date())

  const { data: todaysAudits } = await supabase
    .from("inventory_audits")
    .select("created_at, updated_at, status, id")
    .or(`team_id.eq.${profile.team?.id || -1},technician_id.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(10)

  // Filter Today's Installations
  const todaysInstallations = myClosures.filter((c: any) => getVeDate(c.created_at) === todayVE)

  // Get Last Audit (Only if belongs to today)
  const mostRecentAudit = todaysAudits?.[0]
  const lastAuditOfToday = (mostRecentAudit && getVeDate(mostRecentAudit.created_at) === todayVE) ? mostRecentAudit : null

  // Determine latest work time (Installation OR Support)
  const latestClosure = todaysInstallations.length > 0
    ? [...todaysInstallations].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
    : null

  const latestSupport = supports && supports.length > 0 ? supports[0] : null

  let latestWorkTimestamp = 0
  if (latestClosure) latestWorkTimestamp = new Date(latestClosure.created_at).getTime()
  if (latestSupport) {
    const t = new Date(latestSupport.created_at).getTime()
    if (t > latestWorkTimestamp) latestWorkTimestamp = t
  }

  const latestWorkTime = latestWorkTimestamp
  // Use updated_at if available (for appended audits), otherwise created_at
  const lastAuditTime = lastAuditOfToday ? new Date(lastAuditOfToday.updated_at || lastAuditOfToday.created_at).getTime() : 0

  // Fetch ACTIVE CLIENTS (Installations in Progress) for the Team
  const { data: activeClients } = await supabase
    .from("clientes")
    .select("id, nombre, direccion, estatus, user_id, plan, created_at")
    .in("user_id", teamMembersIDs)
    .neq("estatus", "finalizado")
    .order("created_at", { ascending: false })

  const hasOpenJobs = activeClients && activeClients.length > 0

  const hasWork = todaysInstallations.some((c: any) => c.tecnico_id === user.id || c.user_id === user.id) ||
    (supports && supports.some((s: any) => s.tecnico_id === user.id))

  // Determine if day is finalized (Audit exists AND is later than last work)
  const isDayCompleted = !!lastAuditOfToday && (
    !hasWork || lastAuditTime >= latestWorkTime
  )

  // CHECK REPORT STATUS (To hide button if already sent)
  // Fetch today's report metadata
  const { data: dailyReport } = await supabase
    .from("technician_daily_reports")
    .select("updated_at")
    .eq("user_id", user.id)
    .eq("date", new Date().toISOString().split('T')[0])
    .single()

  const reportSentTime = dailyReport ? new Date(dailyReport.updated_at).getTime() : 0

  // Show Report Button IF:
  // 1. Day IS Completed (Audit exists and covers work)
  // 2. AND Report is NOT sent OR Report is OLDER than the Audit (meaning new finalize happened)
  const isReportPending = isDayCompleted && (!dailyReport || lastAuditTime > reportSentTime)

  // Show Finalize Button IF:
  const showFinalizeButton = !hasOpenJobs && hasWork && !isDayCompleted

  const { data: installedSerialsData } = await supabase
    .rpc('get_installed_serials', { p_user_ids: teamMembersIDs })

  const installedOnus = new Set(installedSerialsData?.map((r: any) => r.serial).filter(Boolean) || [])

  // Fetch Vehicles for Report
  const { data: vehicles } = await supabase
    .from("vehiculos")
    .select("id, placa, modelo, codigo")
    .order("modelo", { ascending: true })

  // Calculate Stock and Serials
  const KPI_MAP: Record<string, string> = {
    "CARRETE": "metraje_usado",
    "CONV": "conectores",
    "PREC": "precinto",
    "ROSETA": "rosetas",
    "TENS": "tensores",
    "PATCH1": "patchcord"
  }

  type StockItem = {
    name: string
    quantity: number
    serials: string[]
    waste?: number // Track waste for display
    isSpool?: boolean
  }

  const stock: Record<string, StockItem> = {}

  // 1. Add ASSIGNMENTS
  assignments?.forEach((assignment: any) => {
    assignment.items?.forEach((item: any) => {
      const sku = item.product.sku
      const name = item.product.name
      const isSpool = sku === "I002" || sku.includes("CARRETE") || name.toUpperCase().includes("BOBINA") || name.toUpperCase().includes("CARRETE")

      if (isSpool) {
        if (Array.isArray(item.serials) && item.serials.length > 0) {
          item.serials.forEach((s: any) => {
            const serialStr = typeof s === 'string' ? s : s.serial
            const uniqueKey = `${sku}__${serialStr}`

            if (!stock[uniqueKey]) {
              stock[uniqueKey] = {
                name: `${name} (${serialStr})`,
                quantity: 0,
                serials: [serialStr],
                waste: 0,
                isSpool: true // Flag to help rendering if needed
              }
            }
            stock[uniqueKey].quantity += (item.quantity / item.serials.length)
          })
        }
      } else {
        if (!stock[sku]) {
          stock[sku] = { name, quantity: 0, serials: [], waste: 0 }
        }
        stock[sku].quantity += item.quantity
        if (Array.isArray(item.serials) && item.serials.length > 0) {
          stock[sku].serials.push(...item.serials)
        }
      }
    })
  })

  // 2. Subtract USAGE (Project Armor: Use View)
  const monitoredSpools = Object.values(stock)
    .filter(i => i.isSpool)
    .flatMap(i => i.serials)

  if (monitoredSpools.length > 0) {
    const { data: spoolStatus } = await supabase
      .from("view_spool_status")
      .select("serial_number, base_quantity, usage_since_base")
      .in("serial_number", monitoredSpools)

    Object.keys(stock).forEach(key => {
      const item = stock[key]
      if (item.isSpool && item.serials.length > 0) {
        const serial = item.serials[0]
        const status = spoolStatus?.find(s => s.serial_number === serial)

        if (status) {
          item.quantity = (status.base_quantity || 0) - (status.usage_since_base || 0)
        }
      }
    })
  }


  // 2b. Subtract Standard Usage (Actor Based)
  myClosures.forEach((c: any) => {
    Object.keys(KPI_MAP).forEach(skuKey => {
      if (skuKey === 'CARRETE') return
      const dbField = KPI_MAP[skuKey]
      if (stock[skuKey]) {
        const valStr = c[dbField]
        let val = 0
        if (valStr) {
          val = parseInt(valStr.toString().replace(/[^0-9]/g, ""), 10) || 0
        }
        if (dbField === 'patchcord' || dbField === 'rosetas') {
          val = (valStr === 'Si' || valStr === true) ? 1 : 0 // Boolean usage
        }
        stock[skuKey].quantity -= val
      }
    })
  })

  // 3. Subtract RETURNS (returned to warehouse)
  returns?.forEach((ret: any) => {
    ret.inventory_return_items.forEach((item: any) => {
      const sku = item.product?.sku
      if (sku && stock[sku]) {
        const isCarrete = sku.includes("CARRETE")
        const isConsumed = item.condition === 'CONSUMED'

        if (isCarrete && isConsumed) {
          return
        }
        stock[sku].quantity -= item.quantity
        if (item.serials && Array.isArray(item.serials)) {
          item.serials.forEach((s: string) => {
            stock[sku].serials = stock[sku].serials.filter(existing => existing !== s)
          })
        }
      }
    })
  })

  // 4. SERIAL SUBTRACTION
  Object.keys(stock).forEach(sku => {
    if (stock[sku].serials && stock[sku].serials.length > 0) {
      if (sku.includes("ONU")) {
        stock[sku].serials = stock[sku].serials.filter(s => !installedOnus.has(s))
        stock[sku].quantity = stock[sku].serials.length
      }
    }
  })

  // Check if HAS STOCK to operate (Minimum Kit)
  const MINIMUM_KIT = [
    { key: 'ONU', label: 'ONU', min: 1 },
    { key: 'CARRETE', label: 'Cable Fibra', min: 1 },
    { key: 'CONV', label: 'Conectores', min: 2 },
    { key: 'TENS', label: 'Tensores', min: 2 },
    { key: 'PATCH1', label: 'Patchcord', min: 1 },
    { key: 'ROSETA', label: 'Roseta', min: 1 },
  ]

  const missingItems: string[] = []

  MINIMUM_KIT.forEach(req => {
    const stockItem = Object.entries(stock).find(([sku]) => sku.includes(req.key))
    const quantity = stockItem ? stockItem[1].quantity : 0
    if (quantity < req.min) {
      missingItems.push(req.label)
    }
  })

  const { getSystemSettings } = await import("../admin/settings-actions")
  const settings = await getSystemSettings()
  const restrictionsEnabled = settings["INSTALLATION_RESTRICTIONS_ENABLED"]

  const hasStock = !restrictionsEnabled || missingItems.length === 0

  return (
    <PremiumPageLayout title="Mi Dashboard" description="Técnico de Campo">
      {/* HEADER PROFILE - Minimalist */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* MAIN CONTENT (Cols 1 & 2) */}
        <div className="lg:col-span-2 space-y-8">

          {/* PROFILE CARD - Clean & Minimal */}
          <div className="bg-white dark:bg-zinc-900 rounded-[24px] p-6 border border-zinc-100 dark:border-zinc-800 shadow-sm flex flex-col sm:flex-row items-center sm:items-start gap-6 relative overflow-hidden">
            {/* Subtle background decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-50 dark:bg-zinc-800/50 rounded-bl-[100px] -mr-8 -mt-8 -z-0"></div>

            <div className="relative z-10 h-20 w-20 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-3xl font-bold text-zinc-700 dark:text-zinc-300 shadow-inner">
              {profile.first_name[0]}{profile.last_name[0]}
            </div>

            <div className="relative z-10 text-center sm:text-left flex-1">
              <div className="flex flex-col sm:flex-row items-center sm:items-baseline gap-2 sm:gap-4 mb-2">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                  {profile.first_name} {profile.last_name}
                </h2>
                <div className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border ${hasStock
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/30'
                  : 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-900/30'}`}>
                  {hasStock ? 'Operativo' : 'Sin Stock'}
                </div>
              </div>

              <div className="flex flex-wrap justify-center sm:justify-start gap-x-6 gap-y-2 text-sm text-zinc-500 dark:text-zinc-400">
                <div className="flex items-center gap-1.5">
                  <Users size={14} className="text-zinc-400" />
                  <span>Equipo: <strong className="text-zinc-700 dark:text-zinc-300">{profile.team ? profile.team.name : 'Individual'}</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <User size={14} className="text-zinc-400" />
                  <span>Compañero: <strong className="text-zinc-700 dark:text-zinc-300">{partner ? partner.first_name : 'N/A'}</strong></span>
                </div>
              </div>
            </div>
          </div>


          {/* ACTIVE INSTALLATIONS LIST */}
          {activeClients && activeClients.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-lg">Instalaciones en Curso</h3>
                <VoiceHint command="Ver lista" side="left">
                  <Link href="/tecnicos/reportes" className="text-sm font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors">
                    Ver Todo
                  </Link>
                </VoiceHint>
              </div>

              <div className="space-y-3">
                {activeClients.map((client: any) => (
                  <Link href="/tecnicos/reportes" key={client.id} className="block group">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all duration-300 group-hover:border-zinc-200 dark:group-hover:border-zinc-700 flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-lg group-hover:text-black dark:group-hover:text-white transition-colors">{client.nombre}</h4>
                        <div className="flex items-center text-zinc-500 dark:text-zinc-400 text-sm mt-1 space-x-2">
                          <span className="font-medium bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-xs text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">{client.plan || 'Plan ?'}</span>
                          <span>•</span>
                          <span className="truncate max-w-[200px]">{client.direccion}</span>
                        </div>
                      </div>
                      <div className="h-10 w-10 bg-zinc-50 dark:bg-zinc-800 rounded-full flex items-center justify-center text-zinc-400 group-hover:bg-black group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-black transition-all">
                        <ArrowRight size={18} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-zinc-50/50 dark:bg-zinc-900/50 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 p-8 text-center">
              <div className="w-12 h-12 bg-white dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm text-zinc-400">
                <CheckCircle2 size={20} />
              </div>
              <h3 className="text-zinc-900 dark:text-zinc-100 font-medium mb-1">Todo despejado</h3>
              <p className="text-sm text-zinc-500">No tienes instalaciones activas en este momento.</p>
            </div>
          )}

          {/* MAIN ACTIONS - Sleek & Minimal */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* INSTALLATION CARD */}
            <VoiceHint command="Nueva instalación" side="bottom">
              <Link href="/tecnicos/reportes?action=new" className="group block h-full">
                <div className="h-full bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-900/50 transition-all duration-300 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-10 transition-opacity transform translate-x-2 -translate-y-2 group-hover:translate-x-0 group-hover:translate-y-0 text-blue-600">
                    <Plus size={64} strokeWidth={1} />
                  </div>

                  <div className="flex flex-col h-full justify-between relative z-10">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Plus size={24} />
                    </div>
                    <div>
                      <span className="font-bold text-lg text-zinc-900 dark:text-zinc-100 block">Nueva Instalación</span>
                      <span className="text-sm text-zinc-500 dark:text-zinc-400">Registrar un nuevo cliente</span>
                    </div>
                  </div>
                </div>
              </Link>
            </VoiceHint>

            {/* SUPPORT CARD */}
            <VoiceHint command="Nuevo soporte" side="bottom">
              <Link href="/tecnicos/reportes?action=support" className="group block h-full">
                <div className="h-full bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm hover:shadow-lg hover:border-orange-200 dark:hover:border-orange-900/50 transition-all duration-300 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-10 transition-opacity transform translate-x-2 -translate-y-2 group-hover:translate-x-0 group-hover:translate-y-0 text-orange-600">
                    <Wrench size={64} strokeWidth={1} />
                  </div>

                  <div className="flex flex-col h-full justify-between relative z-10">
                    <div className="w-12 h-12 rounded-xl bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Wrench size={24} />
                    </div>
                    <div>
                      <span className="font-bold text-lg text-zinc-900 dark:text-zinc-100 block">Nuevo Soporte</span>
                      <span className="text-sm text-zinc-500 dark:text-zinc-400">Reportar avería o visita</span>
                    </div>
                  </div>
                </div>
              </Link>
            </VoiceHint>
          </div>
        </div> {/* END MAIN CONTENT */}

        {/* SIDEBAR (Col 3) - Inventory */}
        <div className="space-y-6">

          <div className="flex items-center justify-between px-1">
            <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-lg">Mi Inventario</h3>
            <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-bold px-2 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-700">{Object.values(stock).filter((i: any) => i.quantity > 0).length} Items</span>
          </div>

          {Object.keys(stock).length > 0 ? (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {Object.entries(stock).map(([sku, item]) => (
                  item.quantity > 0 && (
                    <div key={sku} className="p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold
                             ${item.isSpool ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' :
                            sku.includes('ONU') ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400' :
                              'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                          }`}>
                          {item.isSpool ? 'B' : sku.substring(0, 2)}
                        </div>
                        <div>
                          <p className="font-medium text-sm text-zinc-900 dark:text-zinc-100 leading-tight">{item.name}</p>
                          {item.isSpool && item.serials.length > 0 && (
                            <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                              {item.serials[0]} {item.serials.length > 1 && `+${item.serials.length - 1}`}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">{item.quantity}</span>
                        {item.isSpool && (item.waste || 0) > 0 && (
                          <p className="text-[9px] text-red-500 font-medium">-{item.waste}m</p>
                        )}
                      </div>
                    </div>
                  )
                ))}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
              <Package className="w-8 h-8 mx-auto text-zinc-300 dark:text-zinc-700 mb-2" />
              <p className="text-sm text-zinc-500">Inventario vacío</p>
            </div>
          )}
        </div>

        <div className="space-y-4 pt-4 lg:col-span-3"> {/* Full width footer actions */}
          {isReportPending ? (
            <TechnicianReportDialog
              profile={profile}
              stock={stock}
              vehicles={vehicles || []}
              todaysInstallations={todaysInstallations}
              todaysSupports={supports || []}
              activeClients={activeClients || []}
            />
          ) : null}

          {/* FINALIZAR JORNADA BUTTON */}
          {showFinalizeButton && (
            <div className="max-w-md mx-auto pt-4 animate-in fade-in slide-in-from-bottom-4">
              <div className="bg-zinc-900 dark:bg-white rounded-2xl p-6 text-center shadow-xl relative overflow-hidden group hover:scale-[1.01] transition-transform">
                <div className="relative z-10 flex flex-col items-center">
                  <h3 className="text-white dark:text-zinc-900 text-lg font-bold mb-1">Fin de Jornada</h3>
                  <p className="text-zinc-400 dark:text-zinc-500 mb-4 text-xs max-w-xs mx-auto">Has completado tus actividades. Cierra el día para sincronizar tu reporte.</p>
                  <VoiceHint command="Finalizar día" side="bottom">
                    <FinalizeDayButton />
                  </VoiceHint>
                </div>
              </div>
            </div>
          )}
        </div>
      </div> {/* END GRID */}

    </PremiumPageLayout>
  )
}
