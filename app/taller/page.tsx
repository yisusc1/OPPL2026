"use client"

import { VoiceHint } from "@/components/voice-hint"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useSearchParams, useRouter } from "next/navigation"
import { Search, Wrench, CheckCircle, Clock, AlertTriangle, ArrowRight, Home as HomeIcon, Zap, Filter, LayoutGrid, AlertCircle, History } from "lucide-react"
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
            <div className="max-w-7xl mx-auto space-y-4">

                {/* 1. HEADER & SEARCH BAR */}
                <PremiumCard className="p-3 sm:p-4 flex flex-col sm:flex-row justify-between items-center gap-3 bg-background/60 backdrop-blur-xl border-white/10 dark:border-white/5 w-full sm:w-auto mx-auto sm:mx-0 max-w-md sm:max-w-none">
                    <div className="relative w-full sm:w-96 flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar por placa o falla..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-10 sm:h-11 pl-10 pr-4 bg-white/5 border border-white/10 rounded-lg sm:rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-sm transition-all text-xs sm:text-sm"
                            suppressHydrationWarning
                        />
                    </div>

                    <Button
                        onClick={() => {
                            setSelectedVehicleId(undefined)
                            setSelectedServiceType(undefined)
                            setPendingResolveId(null)
                            setMaintenanceOpen(true)
                        }}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 h-10 sm:h-11 px-4 sm:px-6 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium w-full sm:w-auto shadow-sm"
                    >
                        <Wrench size={14} className="sm:w-4 sm:h-4" />
                        Nuevo Servicio
                    </Button>
                </PremiumCard>

                {/* 2. UNIFIED SEGMENTED CONTROL (TABS) */}
                <div className="flex justify-center w-full">
                    <div className="grid grid-cols-2 sm:flex sm:inline-flex bg-muted/50 backdrop-blur-sm border border-border/50 p-1 sm:p-1.5 rounded-xl sm:rounded-2xl gap-1 sm:gap-0 w-full sm:w-auto shadow-sm">
                        {[
                            { id: 'board', label: 'Tablero', mobileLabel: 'Tablero', icon: LayoutGrid },
                            { id: 'pending', label: `Pendientes (${pending.length})`, mobileLabel: `Pdts (${pending.length})`, icon: AlertCircle },
                            { id: 'review', label: `En Revisión (${inProgress.length})`, mobileLabel: `Taller (${inProgress.length})`, icon: Zap },
                            { id: 'history', label: 'Historial', mobileLabel: 'Historial', icon: History }
                        ].map(tab => {
                            const Icon = tab.icon;
                            const isActive = view === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setView(tab.id as any)}
                                    className={`flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-5 py-2 sm:py-2.5 text-[10px] sm:text-sm font-medium rounded-lg sm:rounded-xl transition-all duration-200 ${isActive
                                        ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                                        }`}
                                >
                                    <Icon size={14} className="sm:w-4 sm:h-4" />
                                    <span className="hidden sm:inline">{tab.label}</span>
                                    <span className="inline sm:hidden">{tab.mobileLabel}</span>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* 3. CONTENT AREA */}
                {view !== 'history' ? (
                    <>
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                                <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent mb-3" />
                                <p className="font-medium text-xs">Cargando datos...</p>
                            </div>
                        ) : (
                            <div className={view === 'board' ? "grid grid-cols-1 lg:grid-cols-2 gap-4 items-start" : "max-w-2xl mx-auto space-y-3"}>

                                {/* PENDIENTES */}
                                {(view === 'board' || view === 'pending') && (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between pb-2 border-b border-border/50 px-2 lg:px-0">
                                            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                                <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse ring-4 ring-red-500/20"></div>
                                                Esperando Atención
                                            </h2>
                                            <span className="text-xs font-mono font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">{pending.length}</span>
                                        </div>

                                        <div className="space-y-4">
                                            {pending.length === 0 && (
                                                <PremiumContent className="p-8 text-center text-muted-foreground border-dashed">
                                                    No hay fallas pendientes
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
                                    </div>
                                )}

                                {/* EN REVISIÓN */}
                                {(view === 'board' || view === 'review') && (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between pb-2 border-b border-border/50 px-2 lg:px-0">
                                            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-blue-500 ring-4 ring-blue-500/20"></div>
                                                En Taller / Revisión
                                            </h2>
                                            <span className="text-xs font-mono font-medium text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full">{inProgress.length}</span>
                                        </div>

                                        <div className="space-y-3">
                                            {inProgress.length === 0 && (
                                                <PremiumContent className="p-8 text-center text-muted-foreground border-dashed">
                                                    No hay vehículos en taller
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
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    <PremiumCard className="max-w-3xl mx-auto p-3 sm:p-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3 pb-3 border-b border-white/5">
                            <h2 className="text-base font-bold text-foreground">Historial de Operaciones</h2>

                            <div className="w-full sm:w-56">
                                <Select value={historyFilter} onValueChange={setHistoryFilter}>
                                    <SelectTrigger className="bg-background/50 backdrop-blur-sm border-white/10 rounded-lg h-9 text-xs text-foreground transition-colors hover:bg-white/5">
                                        <div className="flex items-center gap-2">
                                            <Filter size={14} className="text-muted-foreground" />
                                            <SelectValue placeholder="Filtrar por..." />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent className="bg-background border-white/10 text-foreground text-xs">
                                        <SelectItem value="all" className="focus:bg-white/5">Todos los vehículos</SelectItem>
                                        {vehicles.map((v) => (
                                            <SelectItem key={v.id} value={v.placa} className="focus:bg-white/5">
                                                {v.modelo} <span className="text-muted-foreground font-mono ml-2 text-xs">[{v.placa}]</span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {loadingHistory ? (
                            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4" />
                                <p className="font-medium text-sm">Cargando...</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {historyLogs
                                    .filter(log => historyFilter === "all" || log.placa === historyFilter)
                                    .map((log: any) => (
                                        <PremiumCard key={log.id} className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3 bg-white/5 border-white/5 shadow-none rounded-lg">
                                            <div className="flex items-center gap-3 flex-1">
                                                <div className={`w-10 h-10 flex items-center justify-center shrink-0 rounded-lg border border-white/5 bg-background/50 ${log.type === 'REPAIR' ? 'text-green-500 shadow-[inset_0_0_15px_rgba(34,197,94,0.1)]' : 'text-blue-500 shadow-[inset_0_0_15px_rgba(59,130,246,0.1)]'}`}>
                                                    {log.type === 'REPAIR' ? <CheckCircle size={18} /> : <Wrench size={18} />}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center flex-wrap gap-2 mb-0.5">
                                                        <span className="font-semibold text-sm text-foreground">{log.vehicle}</span>
                                                        <span className="text-[10px] text-muted-foreground font-mono bg-white/5 px-1.5 py-0.5 rounded border border-white/5">{log.placa}</span>
                                                    </div>
                                                    <div className="text-xs text-foreground/80 leading-snug">
                                                        <span className="font-medium text-foreground">
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
                                                                <span className="mx-2 text-white/10">|</span>
                                                                <span className="text-muted-foreground">{log.description}</span>
                                                            </>
                                                        )}
                                                        {log.mileage && <span className="text-muted-foreground ml-2 font-mono bg-white/5 border border-white/5 px-1.5 py-0.5 rounded text-xs">KM: {log.mileage.toLocaleString()}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-left sm:text-right text-xs text-muted-foreground/50 font-mono font-medium border-t border-white/5 sm:border-none pt-3 sm:pt-0 mt-3 sm:mt-0 flex gap-3 sm:block">
                                                <div>{new Date(log.date).toLocaleDateString()}</div>
                                                <div>{new Date(log.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                            </div>
                                        </PremiumCard>
                                    ))}
                                {historyLogs.length === 0 && (
                                    <PremiumContent className="p-8 text-center text-muted-foreground border-dashed text-sm">
                                        No hay registros en el historial
                                    </PremiumContent>
                                )}
                            </div>
                        )}
                    </PremiumCard>
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
        <PremiumCard className="h-full p-0 flex flex-col overflow-hidden bg-background/40 hover:bg-background/60 group">
            <div className="p-3 sm:p-4 flex gap-3 sm:gap-4">
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 bg-muted/30 rounded-lg overflow-hidden shrink-0 border border-white/5">
                    {fault.foto_url ? (
                        <>
                            <Image src={fault.foto_url} alt={fault.modelo} fill className="object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground/30">
                            <Icon size={28} />
                        </div>
                    )}
                </div>

                <div className="flex-1 min-w-0 flex flex-col">
                    <div className="mb-1.5 flex flex-wrap justify-between items-start gap-1 sm:gap-2">
                        <div className="flex items-center flex-wrap gap-1.5 sm:gap-2">
                            <h3 className="font-bold text-foreground text-sm sm:text-base leading-tight truncate max-w-[140px] sm:max-w-none">{fault.modelo}</h3>
                            <span className="text-[9px] sm:text-[10px] font-mono text-muted-foreground font-medium bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                                {fault.placa}
                            </span>
                        </div>
                        <span className={`text-[8px] sm:text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${priorityColor} shrink-0`}>
                            {fault.prioridad}
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5 mb-1.5 text-[10px] sm:text-xs text-muted-foreground font-medium">
                        <div className={`p-1 rounded-full border bg-white/5 border-white/10 shrink-0`}>
                            <Icon size={10} />
                        </div>
                        {fault.tipo_falla}
                    </div>

                    <p className="text-xs sm:text-sm text-foreground/70 line-clamp-2 leading-snug mb-1">
                        {fault.descripcion}
                    </p>

                    <div className="mt-auto pt-1.5 flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground/50">
                        <div className="flex items-center gap-1 font-medium">
                            <Clock size={10} />
                            {new Date(fault.created_at).toLocaleDateString()}
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer Action Bar */}
            <div className="bg-white/5 border-t border-white/5 p-2.5 flex flex-col sm:flex-row justify-end gap-2 mt-auto">
                {!isReviewing && onMoveToReview && (
                    <Button onClick={onMoveToReview} size="sm" variant="secondary" className="h-8 rounded-md text-[10px] sm:text-xs font-medium w-full sm:w-auto">
                        ENVIAR A TALLER
                        <ArrowRight size={12} className="ml-1.5 opacity-70" />
                    </Button>
                )}

                {isReviewing && onDiscard && (
                    <Button onClick={onDiscard} size="sm" variant="ghost" className="h-8 rounded-md text-[10px] sm:text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 w-full sm:w-auto border border-dashed border-white/10 hover:border-transparent">
                        A PENDIENTE
                    </Button>
                )}

                <Button onClick={onResolve} size="sm" className={`h-8 rounded-md text-[10px] sm:text-xs font-medium w-full sm:w-auto ${!isReviewing ? 'hidden' : 'bg-green-500 hover:bg-green-600 text-white shadow-sm shadow-green-500/20'}`}>
                    <CheckCircle size={12} className="mr-1.5 opacity-90" />
                    {isReviewing && fault.tipo_falla === 'Mantenimiento' ? 'FINALIZAR MANT' : 'REPARADO'}
                </Button>
            </div>
        </PremiumCard>
    )
}
