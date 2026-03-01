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
        <PremiumPageLayout title="INTELIGENCIA OPERACIONAL" description="TALLER MECÁNICO / PANEL GENERAL">
            <div className="max-w-7xl mx-auto space-y-6 font-sans text-white">

                {/* 1. HEADER & SEARCH BAR */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#141414] p-4 border border-[#222222] rounded-[12px]">
                    <div className="relative w-full md:w-96 flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A3A3A3]" size={16} strokeWidth={2.5} />
                        <input
                            type="text"
                            placeholder="Buscar por placa o falla..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-10 pl-11 pr-4 bg-black border border-[#222222] rounded-[8px] text-white font-bold placeholder:text-[#555555] focus:outline-none focus:border-[#FFB000] focus:ring-1 focus:ring-[#FFB000] transition-colors uppercase text-sm"
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
                        className="bg-[#FFB000] text-black hover:bg-[#E59E00] gap-2 h-10 px-6 rounded-[8px] text-xs font-bold uppercase tracking-wider w-full md:w-auto shadow-none transition-none shrink-0"
                    >
                        <Wrench size={16} strokeWidth={2.5} />
                        NUEVO SERVICIO
                    </Button>
                </div>

                {/* 2. UNIFIED SEGMENTED CONTROL (TABS) */}
                <div className="flex justify-center overflow-x-auto pb-2 -mx-4 px-4 sm:overflow-visible sm:pb-0 sm:mx-0 sm:px-0">
                    <div className="inline-flex bg-black border border-[#222222] p-1 rounded-[8px] shrink-0">
                        {[
                            { id: 'board', label: 'TABLERO', icon: LayoutGrid },
                            { id: 'pending', label: `PENDIENTES (${pending.length})`, icon: AlertCircle },
                            { id: 'review', label: `EN TALLER (${inProgress.length})`, icon: Zap },
                            { id: 'history', label: 'HISTORIAL', icon: History }
                        ].map(tab => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setView(tab.id as any)}
                                    className={`flex items-center gap-2 px-4 py-2 text-[11px] sm:text-xs font-bold uppercase tracking-wider rounded-[6px] transition-colors shrink-0 ${view === tab.id
                                        ? 'bg-[#1E1E1E] text-[#FFB000]'
                                        : 'text-[#A3A3A3] hover:text-white hover:bg-[#141414]'
                                        }`}
                                >
                                    <Icon size={14} strokeWidth={2.5} />
                                    {tab.label}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* 3. CONTENT AREA */}
                {view !== 'history' ? (
                    <>
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 text-[#A3A3A3]">
                                <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#FFB000] border-t-transparent mb-4" />
                                <p className="font-bold uppercase tracking-wider text-sm">CARGANDO DATOS...</p>
                            </div>
                        ) : (
                            <div className={view === 'board' ? "grid grid-cols-1 lg:grid-cols-2 gap-6 items-start" : "max-w-3xl mx-auto space-y-4"}>

                                {/* PENDIENTES */}
                                {(view === 'board' || view === 'pending') && (
                                    <div className="space-y-4 bg-[#141414] p-4 rounded-[12px] border border-[#222222]">
                                        <div className="flex items-center justify-between pb-3 border-b border-[#222222]">
                                            <h2 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider">
                                                <div className="w-2 h-2 bg-red-500 animate-pulse"></div>
                                                ESPERANDO ATENCIÓN
                                            </h2>
                                            <span className="text-xs font-mono font-bold text-[#A3A3A3] bg-black px-2 py-0.5 border border-[#222222]">{pending.length}</span>
                                        </div>

                                        <div className="space-y-3">
                                            {pending.length === 0 && (
                                                <div className="p-8 text-center text-[#555555] border border-dashed border-[#222222] font-bold text-xs uppercase tracking-wider">
                                                    NO HAY FALLAS PENDIENTES
                                                </div>
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
                                    <div className="space-y-4 bg-[#141414] p-4 rounded-[12px] border border-[#222222]">
                                        <div className="flex items-center justify-between pb-3 border-b border-[#222222]">
                                            <h2 className="text-sm font-bold text-[#FFB000] flex items-center gap-2 uppercase tracking-wider">
                                                <div className="w-2 h-2 bg-[#FFB000]"></div>
                                                EN TALLER / REVISIÓN
                                            </h2>
                                            <span className="text-xs font-mono font-bold text-[#FFB000] bg-[#FFB000]/10 px-2 py-0.5 border border-[#FFB000]/20">{inProgress.length}</span>
                                        </div>

                                        <div className="space-y-3">
                                            {inProgress.length === 0 && (
                                                <div className="p-8 text-center text-[#555555] border border-dashed border-[#222222] font-bold text-xs uppercase tracking-wider">
                                                    NO HAY VEHÍCULOS EN TALLER
                                                </div>
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
                    <div className="max-w-4xl mx-auto bg-[#141414] p-4 sm:p-6 rounded-[12px] border border-[#222222]">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4 pb-4 border-b border-[#222222]">
                            <h2 className="text-sm font-bold text-white uppercase tracking-wider">HISTORIAL DE OPERACIONES</h2>

                            <div className="w-full sm:w-64">
                                <Select value={historyFilter} onValueChange={setHistoryFilter}>
                                    <SelectTrigger className="bg-black border-[#222222] rounded-[8px] h-10 text-white font-bold text-[11px] sm:text-xs uppercase hover:bg-[#1E1E1E] transition-colors focus:ring-1 focus:ring-[#FFB000] shadow-none">
                                        <div className="flex items-center gap-2">
                                            <Filter size={14} className="text-[#A3A3A3]" />
                                            <SelectValue placeholder="FILTRAR POR..." />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent className="bg-black border-[#222222] text-white">
                                        <SelectItem value="all" className="focus:bg-[#1E1E1E] focus:text-white font-bold text-xs uppercase cursor-pointer">TODOS LOS VEHÍCULOS</SelectItem>
                                        {vehicles.map((v) => (
                                            <SelectItem key={v.id} value={v.placa} className="focus:bg-[#1E1E1E] focus:text-white font-bold text-xs uppercase cursor-pointer">
                                                {v.modelo} <span className="text-[#A3A3A3] font-mono ml-2">[{v.placa}]</span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {loadingHistory ? (
                            <div className="flex flex-col items-center justify-center py-20 text-[#A3A3A3]">
                                <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#FFB000] border-t-transparent mb-4" />
                                <p className="font-bold uppercase tracking-wider text-sm">CARGANDO...</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {historyLogs
                                    .filter(log => historyFilter === "all" || log.placa === historyFilter)
                                    .map((log: any) => (
                                        <div key={log.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-4 bg-[#1E1E1E] border border-[#222222] rounded-[8px]">
                                            <div className="flex items-center gap-4 flex-1">
                                                <div className={`w-10 h-10 flex items-center justify-center shrink-0 border border-[#222222] bg-black rounded-[4px] ${log.type === 'REPAIR' ? 'text-white' : 'text-[#FFB000]'}`}>
                                                    {log.type === 'REPAIR' ? <CheckCircle size={18} strokeWidth={2.5} /> : <Wrench size={18} strokeWidth={2.5} />}
                                                </div>
                                                <div className="font-roboto flex-1">
                                                    <div className="flex items-center flex-wrap gap-2 mb-1">
                                                        <span className="font-bold font-sans tracking-wide text-white uppercase text-sm">{log.vehicle}</span>
                                                        <span className="text-[10px] text-[#A3A3A3] font-mono border border-[#222222] bg-black px-1.5 py-0.5 font-bold uppercase">{log.placa}</span>
                                                    </div>
                                                    <div className="text-xs text-[#A3A3A3] leading-relaxed">
                                                        <span className="font-bold text-white uppercase tracking-wider">
                                                            {log.type === 'MAINTENANCE'
                                                                ? (log.category === 'OIL_CHANGE' ? 'CMB ACEITE' :
                                                                    log.category === 'TIMING_BELT' ? 'CORREA TIEMPO' :
                                                                        log.category === 'CHAIN_KIT' ? 'KIT ARRASTRE' :
                                                                            log.category === 'WASH' ? 'LAVADO' :
                                                                                log.category === 'OTHER' ? (log.description || 'OTRO') :
                                                                                    log.category)
                                                                : `REP: ${log.category}`
                                                            }
                                                        </span>
                                                        {log.type === 'MAINTENANCE' && log.category === 'OTHER' ? null : (
                                                            <>
                                                                <span className="mx-2 text-[#444444]">|</span>
                                                                <span className="uppercase">{log.description}</span>
                                                            </>
                                                        )}
                                                        {log.mileage && <span className="text-[#A3A3A3] ml-2 font-mono bg-black border border-[#222222] px-1 py-0.5">KM: {log.mileage.toLocaleString()}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-left sm:text-right text-[10px] text-[#555555] font-mono font-bold uppercase border-t border-[#222222] sm:border-none pt-3 sm:pt-0 mt-3 sm:mt-0 flex gap-2 sm:block">
                                                <div>{new Date(log.date).toLocaleDateString()}</div>
                                                <div>{new Date(log.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                            </div>
                                        </div>
                                    ))}
                                {historyLogs.length === 0 && (
                                    <div className="p-8 text-center text-[#555555] border border-dashed border-[#222222] font-bold text-xs uppercase tracking-wider">
                                        SIN REGISTROS
                                    </div>
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
        'Crítica': 'text-red-500 border-red-500',
        'Alta': 'text-orange-500 border-orange-500',
        'Media': 'text-yellow-500 border-yellow-500',
        'Baja': 'text-[#FFB000] border-[#FFB000]'
    }[fault.prioridad] || 'text-white border-white/20'

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
        <div className="flex flex-col overflow-hidden bg-[#1E1E1E] border border-[#222222] rounded-[8px] transition-all hover:border-[#444444]">
            <div className="p-4 flex gap-4">
                <div className="relative w-20 h-20 bg-black overflow-hidden shrink-0 border border-[#222222] rounded-[4px]">
                    {fault.foto_url ? (
                        <>
                            <Image src={fault.foto_url} alt={fault.modelo} fill className="object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-black/20" />
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-full text-[#444444]">
                            <Icon size={24} strokeWidth={2} />
                        </div>
                    )}
                </div>

                <div className="flex-1 min-w-0 flex flex-col font-roboto">
                    <div className="mb-1.5 flex justify-between items-start gap-2">
                        <div>
                            <h3 className="font-bold text-white text-base leading-none uppercase font-sans tracking-wide">{fault.modelo}</h3>
                            <div className="text-[10px] font-mono text-[#A3A3A3] mt-1.5 font-bold bg-black border border-[#222222] inline-block px-1.5 py-0.5 uppercase tracking-wider">
                                {fault.placa}
                            </div>
                        </div>
                        <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 border ${priorityColor} bg-black shrink-0 font-mono`}>
                            {fault.prioridad}
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5 mb-2 text-[10px] text-white font-bold uppercase tracking-widest">
                        <div className={`p-0.5 bg-black border border-[#222222] shrink-0 text-[#FFB000] rounded-[2px]`}>
                            <Icon size={10} strokeWidth={3} />
                        </div>
                        {fault.tipo_falla}
                    </div>

                    <p className="text-xs text-[#A3A3A3] line-clamp-2 leading-relaxed uppercase mb-2">
                        {fault.descripcion}
                    </p>

                    <div className="mt-auto flex items-center gap-1 font-mono text-[9px] text-[#555555] font-bold uppercase tracking-wider">
                        <Clock size={10} />
                        {new Date(fault.created_at).toLocaleDateString()}
                    </div>
                </div>
            </div>

            {/* Footer Action Bar */}
            <div className="bg-[#141414] border-t border-[#222222] p-2.5 flex justify-end gap-2">
                {!isReviewing && onMoveToReview && (
                    <Button onClick={onMoveToReview} size="sm" variant="outline" className="h-7 rounded-[4px] text-[10px] sm:text-[11px] font-bold uppercase tracking-wider border-[#444444] text-white hover:bg-white hover:text-black hover:border-white w-full sm:w-auto transition-colors">
                        MANDAR A REVISIÓN
                        <ArrowRight size={12} className="ml-1.5" strokeWidth={3} />
                    </Button>
                )}

                {isReviewing && onDiscard && (
                    <Button onClick={onDiscard} size="sm" variant="ghost" className="h-7 rounded-[4px] text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#A3A3A3] hover:text-white hover:bg-[#222222] transition-colors w-full sm:w-auto">
                        DESCARTAR
                    </Button>
                )}

                <Button onClick={onResolve} size="sm" className={`h-7 rounded-[4px] text-[10px] sm:text-[11px] font-bold uppercase tracking-wider w-full sm:w-auto transition-none shadow-none ${!isReviewing ? 'hidden' : 'bg-[#FFB000] hover:bg-[#E59E00] text-black'}`}>
                    <CheckCircle size={12} strokeWidth={3} className="mr-1.5" />
                    {isReviewing && fault.tipo_falla === 'Mantenimiento' ? 'CERRAR SERVICIO' : 'MARCAR REPARADO'}
                </Button>
            </div>
        </div>
    )
}
