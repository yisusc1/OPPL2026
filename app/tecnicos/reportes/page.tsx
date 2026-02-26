"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { ClientCard } from "@/components/client-card"
import { ClientForm } from "@/components/client-form"
import { CreateClientDialog } from "@/components/create-client-dialog"
import { EditClientDialog } from "@/components/edit-client-dialog"
import { SupportReportDialog } from "@/components/support-report-dialog"
import { Plus, Search, AlertCircle, Home as HomeIcon, Wrench, Loader2 } from "lucide-react"
import { LogoutButton } from "@/components/ui/logout-button"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type Client = {
  id: string
  nombre: string
  cedula: string
  direccion: string
  plan: string
  equipo?: string
  onu?: string
  estatus?: string
  cierres?: { id: string }[]
  asignaciones?: { id: string }[]
  revisiones?: { id: string }[]
}

function ReportsContent() {
  const searchParams = useSearchParams()

  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [currentPhase, setCurrentPhase] = useState<"assignment" | "review" | "closure" | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showInitInstructions, setShowInitInstructions] = useState(false)
  const [clientToFinalize, setClientToFinalize] = useState<string | null>(null)
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null)
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null)
  const [supportDialogOpen, setSupportDialogOpen] = useState(false)
  const [teamData, setTeamData] = useState<{ name: string, partner: string, members: string[] } | null>(null)

  const [availableOnus, setAvailableOnus] = useState<string[]>([])
  const [restrictionsEnabled, setRestrictionsEnabled] = useState(true)

  useEffect(() => {
    // Check for query params to auto-open dialogs
    const action = searchParams.get('action')
    if (action === 'new') {
      setDialogOpen(true)
    } else if (action === 'support') {
      setSupportDialogOpen(true)
    }
  }, [searchParams])

  useEffect(() => {
    loadClients()
    loadTeamData()
    loadInventory()
    loadSettings()
  }, [])

  async function loadSettings() {
    const { getSystemSettings } = await import("@/app/admin/settings-actions")
    const maxRetries = 3;
    let retries = 0;
    while (retries < maxRetries) {
      try {
        const settings = await getSystemSettings()
        setRestrictionsEnabled(settings["INSTALLATION_RESTRICTIONS_ENABLED"] !== false)
        break;
      } catch (e) {
        console.error("Failed to load settings", e);
        retries++;
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  async function loadInventory() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from("profiles")
      .select(`
              *,
              team:teams(id, name, profiles(id, first_name, last_name))
          `)
      .eq("id", user.id)
      .single()

    if (!profile) return

    const teamMembersIDs = profile.team?.profiles?.map((p: any) => p.id) || [user.id]

    const { data: assignments } = await supabase
      .from("inventory_transactions")
      .select(`quantity, product:inventory_products(sku, name), type, serials`)
      .in("assigned_to", teamMembersIDs)
      .eq("type", "OUT")

    const assignedSerials: string[] = []
    assignments?.forEach((tx: any) => {
      if (tx.product?.sku?.includes("ONU") && Array.isArray(tx.serials)) {
        assignedSerials.push(...tx.serials)
      }
    })

    const { data: usedClients } = await supabase
      .from("clientes")
      .select("onu")
      .not("onu", "is", null)

    const usedSerials = new Set(usedClients?.map((c: any) => c.onu) || [])

    const { data: returns } = await supabase
      .from("inventory_returns")
      .select(`
              inventory_return_items (
                  serials
              ),
              assignment:inventory_assignments!inner(assigned_to)
          `)
      .in("assignment.assigned_to", teamMembersIDs)

    const returnedSerials = new Set<string>()
    returns?.forEach((ret: any) => {
      ret.inventory_return_items.forEach((item: any) => {
        if (Array.isArray(item.serials)) {
          item.serials.forEach((s: string) => returnedSerials.add(s))
        }
      })
    })

    const available = assignedSerials.filter(s => !usedSerials.has(s) && !returnedSerials.has(s))
    setAvailableOnus(available)
  }

  async function loadTeamData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from("profiles")
      .select(`
              *,
              team:teams(id, name, profiles(id, first_name, last_name))
          `)
      .eq("id", user.id)
      .single()

    if (profile && profile.team) {
      const partner = profile.team.profiles.find((p: any) => p.id !== user.id)
      const members = profile.team.profiles.map((p: any) => `${p.first_name} ${p.last_name}`)
      setTeamData({
        name: profile.team.name,
        partner: partner ? `${partner.first_name} ${partner.last_name}` : "",
        members
      })
    }
  }

  async function loadClients() {
    try {
      setError(null)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select(`*, team:teams(id, name, profiles(id))`)
        .eq("id", user.id)
        .single()

      let query = supabase
        .from("clientes")
        .select("*, cierres(id), asignaciones(id), revisiones(id)")
        .neq('estatus', 'finalizado')
        .order("created_at", { ascending: false })

      if (profile?.team) {
        const memberIds = profile.team.profiles.map((p: any) => p.id)
        query = query.in('user_id', memberIds)
      } else {
        query = query.eq('user_id', user.id)
      }

      const { data, error } = await query

      if (error) {
        if (error.message.includes("Could not find the table")) {
          setError("Base de datos no inicializada")
          setShowInitInstructions(true)
        } else {
          setError(error.message)
        }
        throw error
      }
      setClients(data || [])
    } catch (error) {
      console.error("Error loading clients:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleFinalize = (clientId: string) => {
    setClientToFinalize(clientId)
  }

  const executeFinalize = async () => {
    if (!clientToFinalize) return

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("clientes")
        .update({ estatus: "finalizado" })
        .eq("id", clientToFinalize)

      if (error) throw error

      toast.success("Cliente finalizado correctamente")
      loadClients()
    } catch (error) {
      console.error("Error finalizing client:", error)
      toast.error("Error al finalizar el cliente")
    } finally {
      setClientToFinalize(null)
    }
  }

  const executeDelete = async () => {
    if (!clientToDelete) return

    try {
      const supabase = createClient()
      await supabase.from("cierres").delete().eq("cliente_id", clientToDelete.id)
      await supabase.from("revisiones").delete().eq("cliente_id", clientToDelete.id)
      await supabase.from("asignaciones").delete().eq("cliente_id", clientToDelete.id)

      const { error } = await supabase
        .from("clientes")
        .delete()
        .eq("id", clientToDelete.id)

      if (error) throw error

      toast.success("Cliente eliminado correctamente")
      loadClients()
    } catch (error) {
      console.error("Error deleting client:", error)
      toast.error("Error al eliminar el cliente")
    } finally {
      setClientToDelete(null)
    }
  }

  const filteredClients = clients.filter(
    (client) =>
      client.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.cedula.includes(searchTerm) ||
      client.direccion.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  if (selectedClient && currentPhase) {
    return (
      <ClientForm
        client={selectedClient}
        phase={currentPhase}
        onBack={() => {
          setSelectedClient(null)
          setCurrentPhase(null)
          loadClients()
        }}
        onPhaseComplete={(nextPhase) => {
          if (nextPhase) {
            setCurrentPhase(nextPhase)
          } else {
            setSelectedClient(null)
            setCurrentPhase(null)
            loadClients()
          }
        }}
        teamData={teamData}
      />
    )
  }

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-32 transition-colors duration-300">
      <div className="max-w-xl mx-auto px-6 pt-12 sm:pt-20">

        {/* HEADER */}
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-1">
            <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white leading-tight">
              Instalaciones
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 font-medium text-lg">
              Gestión técnica
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/tecnicos"
              className="w-12 h-12 rounded-full bg-white dark:bg-zinc-900 shadow-lg shadow-zinc-900/5 flex items-center justify-center text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 transition-all hover:scale-110 active:scale-95"
            >
              <HomeIcon size={22} />
            </a>
            <LogoutButton />
          </div>
        </div>

        {/* ACTION CARDS */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <button
            onClick={() => setSupportDialogOpen(true)}
            className="relative group overflow-hidden h-32 rounded-[28px] bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 shadow-xl shadow-zinc-900/5 hover:shadow-2xl hover:shadow-zinc-900/10 transition-all duration-300 active:scale-[0.98] flex flex-col items-center justify-center gap-3"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-900/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="h-10 w-10 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Wrench size={20} />
            </div>
            <span className="font-bold text-zinc-700 dark:text-zinc-300 relative">Reportar Soporte</span>
          </button>
          <button
            onClick={() => setDialogOpen(true)}
            className="relative group overflow-hidden h-32 rounded-[28px] bg-zinc-900 dark:bg-zinc-100 shadow-xl shadow-zinc-900/20 hover:shadow-2xl hover:shadow-zinc-900/30 transition-all duration-300 active:scale-[0.98] flex flex-col items-center justify-center gap-3"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="h-10 w-10 rounded-2xl bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Plus size={20} />
            </div>
            <span className="font-bold text-white dark:text-zinc-900 relative">Nuevo Cliente</span>
          </button>
        </div>

        {/* SEARCH */}
        <div className="relative mb-10 group z-10">
          <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-zinc-400 group-focus-within:text-zinc-900 dark:group-focus-within:text-zinc-100 transition-colors" />
          </div>
          <input
            type="text"
            placeholder="Buscar cliente, cédula o dirección..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-16 pl-14 pr-6 rounded-[24px] bg-white dark:bg-zinc-900 border-0 shadow-xl shadow-zinc-900/5 ring-1 ring-zinc-100 dark:ring-zinc-800 focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 text-lg font-medium placeholder:text-zinc-400 transition-all"
          />
        </div>

        {/* WARNINGS */}
        {showInitInstructions && (
          <div className="mb-8 p-6 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-3xl">
            <div className="flex gap-4 items-start">
              <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-1" size={24} />
              <div className="flex-1">
                <h3 className="font-bold text-lg text-red-900 dark:text-red-300 mb-1">Configuración Necesaria</h3>
                <p className="text-red-700 dark:text-red-400 mb-3 text-sm">
                  La base de datos necesita ser inicializada.
                </p>
                <button
                  onClick={() => setShowInitInstructions(false)}
                  className="text-red-900 dark:text-red-200 text-sm font-bold underline decoration-red-300 underline-offset-4"
                >
                  Cerrar Aviso
                </button>
              </div>
            </div>
          </div>
        )}

        {/* LIST */}
        <div className="space-y-5 animate-in slide-in-from-bottom-4 duration-500">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-zinc-300" />
              <p className="text-zinc-400 font-medium animate-pulse">Cargando clientes...</p>
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="text-center py-24 px-6 bg-white dark:bg-zinc-900/50 rounded-[32px] border border-dashed border-zinc-200 dark:border-zinc-800">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-zinc-50 dark:bg-zinc-800 text-zinc-300 dark:text-zinc-600 mb-4">
                <Search size={32} />
              </div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1">No se encontraron clientes</h3>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm">Intenta con otra búsqueda o crea un nuevo cliente.</p>
            </div>
          ) : (
            filteredClients.map((client) => {
              const isClosureCompleted = client.cierres && client.cierres.length > 0;
              const isAssignmentCompleted = client.asignaciones && client.asignaciones.length > 0;
              const isReviewCompleted = client.revisiones && client.revisiones.length > 0;

              return (
                <ClientCard
                  key={client.id}
                  client={client}
                  onSelectPhase={(phase) => {
                    setSelectedClient(client)
                    setCurrentPhase(phase)
                  }}
                  onFinalize={() => handleFinalize(client.id)}
                  onDelete={isClosureCompleted ? undefined : () => setClientToDelete(client)}
                  onEdit={() => {
                    setClientToEdit(client)
                    setEditDialogOpen(true)
                  }}
                  isClosureCompleted={!!isClosureCompleted}
                  isAssignmentCompleted={!!isAssignmentCompleted}
                  isReviewCompleted={!!isReviewCompleted}
                />
              )
            })
          )}

          {/* Empty Spacer for Bottom Handling */}
          <div className="h-8" />
        </div>

      </div>
      <CreateClientDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onClientCreated={() => {
          loadClients();
          loadInventory();
        }}
        teamName={teamData?.name}
        availableOnus={availableOnus}
        restrictionsEnabled={restrictionsEnabled}
      />

      <EditClientDialog
        isOpen={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false)
          setClientToEdit(null)
        }}
        onClientUpdated={loadClients}
        client={clientToEdit}
      />

      <SupportReportDialog
        open={supportDialogOpen}
        onOpenChange={setSupportDialogOpen}
      />

      <AlertDialog open={!!clientToFinalize} onOpenChange={(open) => !open && setClientToFinalize(null)}>
        <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-zinc-900">¿Finalizar Cliente?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-500 text-base">
              El cliente pasará al archivo histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl h-12 border-zinc-200 text-zinc-900 font-medium">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executeFinalize} className="rounded-xl h-12 bg-black hover:bg-zinc-800 text-white font-medium">
              Finalizar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!clientToDelete} onOpenChange={(open) => !open && setClientToDelete(null)}>
        <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-zinc-900">¿Eliminar Cliente?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-500 text-base">
              Esta acción no se puede deshacer. El cliente será eliminado permanentemente de la base de datos junto con su historial.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl h-12 border-zinc-200 text-zinc-900 font-medium">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executeDelete} className="rounded-xl h-12 bg-red-600 hover:bg-red-700 text-white font-medium">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main >
  )
}

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ReportsContent />
    </Suspense>
  )
}
