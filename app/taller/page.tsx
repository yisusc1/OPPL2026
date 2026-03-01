"use client"

import { VoiceHint } from "@/components/voice-hint"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useSearchParams, useRouter } from "next/navigation"
import { Search, Wrench, CheckCircle, Clock, AlertTriangle, ArrowRight, Home as HomeIcon, Zap, Filter } from "lucide-react"
import { LogoutButton } from "@/components/ui/logout-button"
import Image from "next/image"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { MaintenanceRegistrationDialog } from "@/components/maintenance-registration-dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { PremiumPageLayout } from "@/components/ui/premium-page-layout"
import { PremiumCard } from "@/components/ui/premium-card"
import { PremiumContent } from "@/components/ui/premium-content"

type Fault = {
    id: string
    vehiculo_id: string
    descripcion: string
    tipo_falla: string
    prioridad: string
    created_at: string
    placa: string
    modelo: string
    foto_url?: string
    estado: 'Pendiente' | 'En Revisión' | 'Reparado' | 'Descartado'
    fecha_solucion?: string
    isMaintenance?: boolean // Flag for synthetic maintenance alerts
}

export default function TallerPage() {
    const [faults, setFaults] = useState<Fault[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")

    const searchParams = useSearchParams()
    const router = useRouter()

    // Dialog State
    const [maintenanceOpen, setMaintenanceOpen] = useState(false)
    const [selectedVehicleId, setSelectedVehicleId] = useState<string | undefined>(undefined)
    const [selectedServiceType, setSelectedServiceType] = useState<string | undefined>(undefined)
    const [pendingResolveId, setPendingResolveId] = useState<string | null>(null)

    // History State
    // [Mod] Expanded View State
    const [view, setView] = useState<'board' | 'pending' | 'review' | 'history'>('pending')
    const [historyLogs, setHistoryLogs] = useState<any[]>([])
    const [loadingHistory, setLoadingHistory] = useState(false)
    const [vehicles, setVehicles] = useState<any[]>([])
    const [historyFilter, setHistoryFilter] = useState("all")

    useEffect(() => {
        loadFaults()
    }, [])

    // Voice/URL Action Handler
    useEffect(() => {
        const action = searchParams.get("action")
        const viewParam = searchParams.get("view")

        if (action === "new") {
            setMaintenanceOpen(true)
        }

        if (viewParam === "board") setView("board")
        if (viewParam === "history") setView("history")

    }, [searchParams])

    useEffect(() => {
        if (view === 'history') {
            loadHistory()
        }
    }, [view])


    async function loadFaults() {
        try {
            const supabase = createClient()

            // 1. Fetch Existing Faults
            const { data: faultsData, error } = await supabase
                .from('fallas')
                .select(`
                    id,
                    vehiculo_id,
                    descripcion,
                    tipo_falla,
                    prioridad,
                    created_at,
                    estado,
                    fecha_solucion,
                    vehiculos (placa, modelo, foto_url)
                `)
                .neq('estado', 'Reparado')
                .neq('estado', 'Descartado')
                .order('created_at', { ascending: false })

            if (error) throw error

            // 2. Fetch Vehicles, Mileage, and Maintenance Configs
            const { data: vehiclesData } = await supabase
                .from('vehiculos')
                .select('*, vehicle_maintenance_configs(*)')
                .order('modelo', { ascending: true })

            setVehicles(vehiclesData || [])
            const vehicles = vehiclesData

            const { data: mileageData } = await supabase.from('vista_ultimos_kilometrajes').select('*')

            // 3. Generate Maintenance Alerts
            const maintenanceAlerts: Fault[] = []

            vehicles?.forEach(v => {
                const km = mileageData?.find(m => m.vehiculo_id === v.id)?.ultimo_kilometraje || 0

                // Check for existing active maintenance to avoid duplicates
                // We check if there is any active fault for this vehicle with 'Mantenimiento' type
                const activeFaults = faultsData?.filter(f =>
                    f.vehiculo_id === v.id &&
                    f.tipo_falla === 'Mantenimiento' &&
                    (f.estado === 'Pendiente' || f.estado === 'En Revisión')
                ) || []

                // Iterate over each maintenance configuration for this vehicle
                const configs = v.vehicle_maintenance_configs || []

                configs.forEach((config: any) => {
                    const isTimeBased = config.is_time_based
                    const interval = config.interval_value
                    if (!interval) return

                    let needsService = false
                    let priority = 'Alta'
                    let usageText = ''
                    let keyword = config.custom_name || 'Mantenimiento'
                    if (config.service_type === 'OIL_CHANGE') keyword = 'Aceite'
                    if (config.service_type === 'TIMING_BELT') keyword = 'Correa'
                    if (config.service_type === 'CHAIN_KIT') keyword = 'Kit de Arrastre'
                    if (config.service_type === 'WASH') keyword = 'Lavado'

                    if (isTimeBased) {
                        const lastService = config.last_service_value ? new Date(Number(config.last_service_value)) : new Date()
                        const today = new Date()
                        const diffDays = Math.max(0, Math.ceil((today.getTime() - lastService.getTime()) / (1000 * 60 * 60 * 24)))

                        if (diffDays >= interval) {
                            needsService = true;
                            priority = 'Crítica'
                            usageText = `${diffDays} días`
                        } else if (diffDays >= interval * 0.9) { // 90% threshold for warning
                            needsService = true;
                            priority = 'Alta'
                            usageText = `${diffDays} días`
                        }
                    } else {
                        // Mileage based
                        const lastServiceKm = Number(config.last_service_value) || 0
                        const diffKm = km - lastServiceKm

                        // Example: warn at 90% of interval
                        const warnThreshold = interval * 0.9

                        if (diffKm >= warnThreshold) {
                            needsService = true
                            priority = diffKm >= interval ? 'Crítica' : 'Alta'
                            usageText = `${diffKm.toLocaleString()} km`
                        }
                    }

                    if (needsService) {
                        // Check if it's already active to avoid duplicates
                        const alreadyExists = activeFaults.some(f => f.descripcion.includes(keyword))
                        if (!alreadyExists) {
                            const descName = config.custom_name && config.service_type === 'CUSTOM' ? config.custom_name : keyword
                            maintenanceAlerts.push({
                                id: `maint-${config.id}`,
                                vehiculo_id: v.id,
                                descripcion: `Mantenimiento Preventivo Requerido: ${descName} (Uso: ${usageText})`,
                                tipo_falla: 'Mantenimiento',
                                prioridad: priority,
                                created_at: new Date().toISOString(),
                                estado: 'Pendiente',
                                placa: v.placa,
                                modelo: v.modelo,
                                foto_url: v.foto_url,
                                isMaintenance: true
                            })
                        }
                    }
                })
            })

            // 4. Merge
            // @ts-ignore
            const mappedFaults: Fault[] = faultsData?.map(f => ({
                id: f.id,
                vehiculo_id: f.vehiculo_id,
                descripcion: f.descripcion,
                tipo_falla: f.tipo_falla,
                prioridad: f.prioridad,
                created_at: f.created_at,
                estado: f.estado,
                fecha_solucion: f.fecha_solucion,
                // @ts-ignore
                placa: f.vehiculos?.placa || 'Desconocido',
                // @ts-ignore
                modelo: f.vehiculos?.modelo || 'Desconocido',
                // @ts-ignore
                foto_url: f.vehiculos?.foto_url
            })) || []

            setFaults([...maintenanceAlerts, ...mappedFaults])

        } catch (error) {
            console.error('Error loading faults:', error)
            toast.error('Error al cargar fallas')
        } finally {
            setLoading(false)
        }
    }

    async function loadHistory() {
        setLoadingHistory(true)
        const supabase = createClient()
        try {
            const { data: faultsData } = await supabase
                .from('fallas')
                .select(`id, descripcion, tipo_falla, fecha_solucion, created_at, vehiculos(placa, modelo)`)
                .eq('estado', 'Reparado')
                .order('fecha_solucion', { ascending: false })
                .limit(50)

            const { data: maintenanceData } = await supabase
                .from('maintenance_logs')
                .select(`id, service_type, mileage, notes, service_date, created_at, vehiculos(placa, modelo)`)
                .order('created_at', { ascending: false })
                .limit(50)

            const combined = [
                ...(faultsData?.map(f => ({
                    type: 'REPAIR',
                    date: f.fecha_solucion || f.created_at,
                    vehicle: (f.vehiculos as any)?.modelo || 'Desconocido',
                    placa: (f.vehiculos as any)?.placa || '',
                    description: f.descripcion,
                    category: f.tipo_falla,
                    id: f.id,
                    mileage: null
                })) || []),
                ...(maintenanceData?.map(m => ({
                    type: 'MAINTENANCE',
                    date: m.service_date || m.created_at,
                    vehicle: (m.vehiculos as any)?.modelo || 'Desconocido',
                    placa: (m.vehiculos as any)?.placa || '',
                    description: m.notes || 'Mantenimiento Preventivo',
                    category: m.service_type,
                    mileage: m.mileage,
                    id: m.id
                })) || [])
            ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

            setHistoryLogs(combined)
        } catch (error) {
            console.error('Error history:', error)
        } finally {
            setLoadingHistory(false)
        }
    }

    // --- ACTIONS ---

    async function promoteMaintenanceAlert(alert: Fault) {
        try {
            const supabase = createClient()

            // Check if already exists in 'En Revisión' to avoid duplicates? 
            // For now, we trust the user clicking once. 
            // Ideally we'd query to see if there's active maintenance for this vehicle type.

            const { error } = await supabase.from('fallas').insert({
                vehiculo_id: alert.vehiculo_id,
                descripcion: alert.descripcion,
                tipo_falla: 'Mantenimiento',
                prioridad: alert.prioridad,
                estado: 'En Revisión',
                created_at: new Date().toISOString()
            })

            if (error) throw error

            toast.success("Mantenimiento iniciado (Pasado a Revisión)")
            loadFaults()
        } catch (error) {
            console.error('Error promoting alert:', error)
            toast.error('Error al iniciar mantenimiento')
        }
    }

    async function handleReview(fault: Fault) {
        if (fault.isMaintenance) {
            await promoteMaintenanceAlert(fault)
        } else {
            await updateStatus(fault.id, 'En Revisión')
        }
    }

    function handleResolve(fault: Fault) {
        if (fault.tipo_falla === 'Mantenimiento') {
            setSelectedVehicleId(fault.vehiculo_id)
            setPendingResolveId(fault.id)

            // Determine Service Type from Alert ID if it's synthetic
            let serviceCode: string | undefined = undefined
            if (fault.id.startsWith('maint-')) {
                serviceCode = fault.id.replace('maint-', '')
            } else {
                const desc = (fault.descripcion || "").toLowerCase()
                if (desc.includes('aceite')) serviceCode = 'OIL_CHANGE'
                else if (desc.includes('correa')) serviceCode = 'TIMING_BELT'
                else if (desc.includes('arrastre') || desc.includes('cadena') || desc.includes('kit')) serviceCode = 'CHAIN_KIT'
                else if (desc.includes('lavado')) serviceCode = 'WASH'
            }

            setSelectedServiceType(serviceCode)
            setMaintenanceOpen(true)
        } else {
            updateStatus(fault.id, 'Reparado')
        }
    }

    function handleMaintenanceSuccess() {
        if (pendingResolveId) {
            updateStatus(pendingResolveId, 'Reparado')
            setPendingResolveId(null)
        } else {
            loadFaults() // Just reload if it was a manual registration
        }
    }

    async function updateStatus(id: string, newStatus: string) {
        try {
            const supabase = createClient()
            const { error } = await supabase
                .from('fallas')
                .update({ estado: newStatus, fecha_solucion: newStatus === 'Reparado' ? new Date() : null })
                .eq('id', id)

            if (error) throw error

            toast.success(`Estado actualizado a: ${newStatus}`)
            loadFaults()
        } catch (error) {
            console.error('Error updating status:', error)
            toast.error('Error al actualizar estado')
        }
    }

    const filteredFaults = faults.filter(f =>
        f.placa.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.modelo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.tipo_falla.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const pending = filteredFaults.filter(f => f.estado === 'Pendiente')
    const inProgress = filteredFaults.filter(f => f.estado === 'En Revisión')

    return (
        <PremiumPageLayout title="Taller Mecánico" description="Gestión de Fallas y Mantenimiento">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* PC CONTROLS (Top Right) */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="hidden md:flex gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
                        <VoiceHint command="Tablero" side="bottom">
                            <Button
                                variant={view === 'board' ? 'secondary' : 'ghost'}
                                onClick={() => setView('board')}
                                className="text-xs h-9 rounded-lg px-4"
                            >
                                Tablero Completo
                            </Button>
                        </VoiceHint>
                        <VoiceHint command="Historial" side="bottom">
                            <Button
                                variant={view === 'history' ? 'secondary' : 'ghost'}
                                onClick={() => setView('history')}
                                className="text-xs h-9 rounded-lg px-4"
                            >
                                Historial
                            </Button>
                        </VoiceHint>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <Button
                            onClick={() => {
                                setSelectedVehicleId(undefined)
                                setSelectedServiceType(undefined)
                                setPendingResolveId(null)
                                setMaintenanceOpen(true)
                            }}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 h-10 px-4 rounded-xl text-sm font-medium w-full md:w-auto"
                        >
                            <Wrench size={16} />
                            Registrar Mantenimiento
                        </Button>
                    </div>
                </div>

                {/* MOBILE CONTROLS (Stacked) */}
                <div className="md:hidden flex flex-col gap-3">
                    {/* 1. Toggle Filter (3-way) */}
                    <div className="bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl flex">
                        <button
                            onClick={() => setView('pending')}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${view === 'pending' || view === 'board' ? 'bg-white dark:bg-zinc-700 shadow-sm text-foreground' : 'text-muted-foreground'}`}
                        >
                            Pendientes
                        </button>
                        <button
                            onClick={() => setView('review')}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${view === 'review' ? 'bg-white dark:bg-zinc-700 shadow-sm text-foreground' : 'text-muted-foreground'}`}
                        >
                            En Revisión
                        </button>
                        <button
                            onClick={() => setView('history')}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${view === 'history' ? 'bg-white dark:bg-zinc-700 shadow-sm text-foreground' : 'text-muted-foreground'}`}
                        >
                            Historial
                        </button>
                    </div>
                </div>

                {view !== 'history' ? (
                    <>
                        {/* CONTROLS (Search) */}
                        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-4 top-3.5 text-muted-foreground" size={20} />
                                <input
                                    type="text"
                                    placeholder="Buscar por placa o falla..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full h-12 pl-12 pr-4 bg-white/5 border border-white/10 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-sm"
                                    suppressHydrationWarning
                                />
                            </div>
                            <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
                                <span className="font-bold text-foreground">{filteredFaults.length}</span> fallas activas
                            </div>
                        </div>

                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4" />
                                <p>Cargando taller...</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                                {/* PENDIENTES */}
                                {(view === 'board' || view === 'pending') && (
                                    <div className={`space-y-4 ${view !== 'board' ? 'lg:col-span-2' : ''}`}>
                                        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
                                            Pendientes ({pending.length})
                                        </h2>

                                        {pending.length === 0 && (
                                            <PremiumContent className="p-8 text-center text-muted-foreground border-dashed">
                                                No hay fallas pendientes por revisar
                                            </PremiumContent>
                                        )}

                                        {pending.map(fault => (
                                            <FaultCard
                                                key={fault.id}
                                                fault={fault}
                                                onMoveToReview={() => handleReview(fault)}
                                                onResolve={() => handleResolve(fault)}
                                            />
                                        ))}
                                    </div>
                                )}

                                {/* EN REVISIÓN */}
                                {(view === 'board' || view === 'review') && (
                                    <div className={`space-y-4 ${view !== 'board' ? 'lg:col-span-2' : ''}`}>
                                        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                            En Revisión ({inProgress.length})
                                        </h2>

                                        {inProgress.length === 0 && (
                                            <PremiumContent className="p-8 text-center text-muted-foreground border-dashed">
                                                No hay vehículos en el taller
                                            </PremiumContent>
                                        )}

                                        {inProgress.map(fault => (
                                            <FaultCard
                                                key={fault.id}
                                                fault={fault}
                                                isReviewing
                                                onResolve={() => handleResolve(fault)}
                                                onDiscard={() => updateStatus(fault.id, 'Pendiente')}
                                            />
                                        ))}
                                    </div>
                                )}

                            </div>
                        )}
                    </>
                ) : (
                    <div className="max-w-4xl mx-auto">
                        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                            <h2 className="text-xl font-bold text-foreground">Historial de Servicios y Reparaciones</h2>

                            <div className="w-full md:w-64">
                                <Select value={historyFilter} onValueChange={setHistoryFilter}>
                                    <SelectTrigger className="bg-white/5 border-white/10 rounded-xl h-11 text-foreground">
                                        <div className="flex items-center gap-2">
                                            <Filter size={14} className="text-muted-foreground" />
                                            <SelectValue placeholder="Filtrar por vehículo" />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos los vehículos</SelectItem>
                                        {vehicles.map((v) => (
                                            <SelectItem key={v.id} value={v.placa}>
                                                {v.modelo} <span className="text-muted-foreground text-xs ml-2">({v.placa})</span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {loadingHistory ? (
                            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4" />
                                <p>Cargando historial...</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {historyLogs
                                    .filter(log => historyFilter === "all" || log.placa === historyFilter)
                                    .map((log: any) => (
                                        <PremiumCard key={log.id} className="p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${log.type === 'REPAIR' ? 'bg-green-500/20 text-green-500' : 'bg-blue-500/20 text-blue-500'
                                                    }`}>
                                                    {log.type === 'REPAIR' ? <CheckCircle size={18} /> : <Wrench size={18} />}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-foreground">{log.vehicle}</span>
                                                        <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">{log.placa}</span>
                                                    </div>
                                                    <div className="text-sm text-foreground/80">
                                                        <span className="font-medium">
                                                            {log.type === 'MAINTENANCE'
                                                                ? (log.category === 'OIL_CHANGE' ? 'Cambio de Aceite' :
                                                                    log.category === 'TIMING_BELT' ? 'Correa de Tiempo' :
                                                                        log.category === 'CHAIN_KIT' ? 'Kit de Arrastre' :
                                                                            log.category === 'WASH' ? 'Lavado' :
                                                                                log.category === 'OTHER' ? (log.description || 'Otro Servicio') :
                                                                                    log.category)
                                                                : `Reparación: ${log.category}`
                                                            }
                                                        </span>
                                                        {log.type === 'MAINTENANCE' && log.category === 'OTHER' ? null : (
                                                            <>
                                                                <span className="mx-2 text-muted-foreground/30">|</span>
                                                                {log.description}
                                                            </>
                                                        )}
                                                        {log.mileage && <span className="text-muted-foreground ml-2">({log.mileage.toLocaleString()} km)</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right text-xs text-muted-foreground">
                                                <div>{new Date(log.date).toLocaleDateString()}</div>
                                                <div>{new Date(log.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                            </div>
                                        </PremiumCard>
                                    ))}
                                {historyLogs.length === 0 && (
                                    <PremiumContent className="p-8 text-center text-muted-foreground border-dashed">
                                        No hay historial registrado
                                    </PremiumContent>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Maintenance Dialog */}
            <MaintenanceRegistrationDialog
                isOpen={maintenanceOpen}
                onClose={() => setMaintenanceOpen(false)}
                initialVehicleId={selectedVehicleId}
                initialServiceType={selectedServiceType}
                lockServiceType={!!selectedServiceType}
                lockVehicle={!!selectedVehicleId}
                onSuccess={handleMaintenanceSuccess}
            />
        </PremiumPageLayout>
    )
}

function FaultCard({ fault, onMoveToReview, onResolve, onDiscard, isReviewing }: {
    fault: Fault,
    onMoveToReview?: () => void,
    onResolve: () => void,
    onDiscard?: () => void,
    isReviewing?: boolean
}) {
    const priorityColor = {
        'Crítica': 'text-red-500 bg-red-500/10 border-red-500/20',
        'Alta': 'text-orange-500 bg-orange-500/10 border-orange-500/20',
        'Media': 'text-yellow-600 bg-yellow-500/10 border-yellow-500/20',
        'Baja': 'text-blue-500 bg-blue-500/10 border-blue-500/20'
    }[fault.prioridad] || 'text-muted-foreground bg-muted border-white/10'

    const getFaultIcon = (type: string) => {
        switch (type) {
            case 'Mecánica': return Wrench
            case 'Eléctrica': return Zap
            case 'Cauchos': return CheckCircle
            case 'Mantenimiento': return Clock
            default: return AlertTriangle
        }
    }

    const Icon = getFaultIcon(fault.tipo_falla)

    return (
        <PremiumCard className="h-fit p-0 group hover:border-primary/50 flex flex-col overflow-hidden">
            <div className="p-5 flex gap-4">
                <div className="relative w-24 h-24 bg-muted/50 rounded-xl overflow-hidden shrink-0 border border-white/5">
                    {fault.foto_url ? (
                        <Image src={fault.foto_url} alt={fault.modelo} fill className="object-cover" />
                    ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground/50">
                            <Icon size={32} />
                        </div>
                    )}
                </div>

                <div className="flex-1 min-w-0 flex flex-col h-full">
                    <div className="mb-2">
                        <div className="flex justify-between items-start gap-2">
                            <h3 className="font-bold text-foreground text-base leading-tight">{fault.modelo}</h3>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${priorityColor} bg-opacity-50 shrink-0`}>
                                {fault.prioridad}
                            </span>
                        </div>
                        {/* [NEW] License Plate Display */}
                        <div className="text-xs font-mono text-muted-foreground mt-0.5 font-semibold bg-white/5 inline-block px-1.5 py-0.5 rounded">
                            {fault.placa}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground font-medium">
                        <div className={`p-1 rounded-full border bg-white/5 border-white/10 shrink-0`}>
                            <Icon size={12} />
                        </div>
                        {fault.tipo_falla}
                    </div>

                    <p className="text-sm text-foreground/70 line-clamp-2 leading-relaxed mb-1">
                        {fault.descripcion}
                    </p>

                    <div className="mt-auto pt-2 flex items-center justify-between text-xs text-muted-foreground/50">
                        <div className="flex items-center gap-1 font-medium">
                            <Clock size={12} />
                            {new Date(fault.created_at).toLocaleDateString()}
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer Action Bar */}
            <div className="bg-white/5 border-t border-white/5 p-3 flex justify-end gap-2">
                {!isReviewing && onMoveToReview && (
                    <Button onClick={onMoveToReview} size="sm" variant="secondary" className="h-8 rounded-lg text-xs w-full sm:w-auto">
                        Revisar
                        <ArrowRight size={14} className="ml-2" />
                    </Button>
                )}

                {isReviewing && onDiscard && (
                    <Button onClick={onDiscard} size="sm" variant="ghost" className="h-8 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-white/5">
                        Devolver
                    </Button>
                )}

                <Button onClick={onResolve} size="sm" className={`h-8 rounded-lg text-xs ${!isReviewing ? 'hidden' : 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/20'}`}>
                    <CheckCircle size={14} className="mr-2" />
                    {isReviewing && fault.tipo_falla === 'Mantenimiento' ? 'Registrar' : 'Reparado'}
                </Button>
            </div>
        </PremiumCard>
    )
}
