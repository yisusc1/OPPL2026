"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Home as HomeIcon, Truck, LogOut, ArrowRight, AlertTriangle, Car, Fuel, MapPin, QrCode, FileText } from "lucide-react"
import { LogoutButton } from "@/components/ui/logout-button"
import { useSearchParams, useRouter } from "next/navigation"
import { SalidaFormDialog } from "@/components/salida-form-dialog"
import { EntradaFormDialog } from "@/components/entrada-form-dialog"
import { ReportFaultDialog } from "@/components/report-fault-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import QRCode from "react-qr-code"
import Link from "next/link"
import { PremiumPageLayout } from "@/components/ui/premium-page-layout"
import { PremiumCard } from "@/components/ui/premium-card"
import { PremiumContent } from "@/components/ui/premium-content"

type Vehicle = {
    id: string
    modelo: string
    placa: string
    codigo: string
    foto_url?: string // [NEW] Added for image support
    falla_activa?: any
    current_fuel_level?: number
    kilometraje?: number
}

type Profile = {
    id: string
    first_name: string
    last_name: string
    national_id: string
}

export default function TransportePage() {
    const [loading, setLoading] = useState(true)
    const [profile, setProfile] = useState<Profile | null>(null)
    const [assignedVehicle, setAssignedVehicle] = useState<Vehicle | null>(null) // For Driver Mode

    // Pool Mode States
    const [vehicles, setVehicles] = useState<Vehicle[]>([])
    const [selectedVehicleId, setSelectedVehicleId] = useState<string>("")
    const [activeTripReport, setActiveTripReport] = useState<any>(null) // [NEW] Track active trip for user

    // Dialog States
    const [salidaOpen, setSalidaOpen] = useState(false)
    const [entradaOpen, setEntradaOpen] = useState(false)
    const [faultOpen, setFaultOpen] = useState(false)
    const [vehicleSelectOpen, setVehicleSelectOpen] = useState(false) // For manual select in Pool Mode
    const [qrOpen, setQrOpen] = useState(false) // For Driver Mode

    const [initialVehicleId, setInitialVehicleId] = useState<string>("")

    const searchParams = useSearchParams()
    const router = useRouter()
    const supabase = createClient()

    useEffect(() => {
        loadData()
    }, [])

    useEffect(() => {
        const action = searchParams.get('action')
        const vId = searchParams.get('vehicle_id')

        if (vId) setInitialVehicleId(vId)

        if (action === 'salida' && vId) {
            setSalidaOpen(true)
        } else if (action === 'entrada' && vId) {
            setEntradaOpen(true)
        }
    }, [searchParams])

    async function loadData(silent = false) {
        if (!silent) setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/login')
                return
            }

            // 1. Fetch Profile
            const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single()
            setProfile(profileData)

            // 2. Check for Assigned Vehicle (Driver Mode)
            const { data: myVehicle } = await supabase
                .from('vehiculos')
                .select('*') // This already selects all, including foto_url if it exists in schema
                .eq('assigned_driver_id', user.id)
                .limit(1)
                .maybeSingle()

            if (myVehicle) {
                setAssignedVehicle(myVehicle)
            } else {
                // 3. If no assigned vehicle, load Pool (Pool Mode)
                console.log("No assigned vehicle found, loading pool.")
                // [UPDATED] Included foto_url in selection
                const { data: allVehicles } = await supabase.from('vehiculos').select('id, modelo, placa, codigo, foto_url')
                if (allVehicles) setVehicles(allVehicles)
            }

            // 4. [NEW] Check for Active Trip (Improved Logic)
            let activeTrip = null

            if (myVehicle) {
                // Scenario A: Assigned Vehicle (Driver Mode)
                const { data } = await supabase
                    .from('reportes')
                    .select('*')
                    .eq('vehiculo_id', myVehicle.id)
                    .is('km_entrada', null)
                    .limit(1)
                    .maybeSingle()
                activeTrip = data
            } else {
                // Scenario B: Pool Mode
                const { data } = await supabase
                    .from('reportes')
                    .select('*')
                    .eq('user_id', user.id)
                    .is('km_entrada', null)
                    .limit(1)
                    .maybeSingle()
                activeTrip = data
            }

            setActiveTripReport(activeTrip)

        } catch (error: any) {
            console.error("Error loading data:", error)
            toast.error("Error al cargar datos del panel")
        } finally {
            if (!silent) setLoading(false)
        }
    }

    // --- SHARED ACTIONS ---
    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    // --- POOL MODE HANDLERS ---
    const startFaultReportingPool = () => {
        setVehicleSelectOpen(true)
    }

    const confirmVehicleSelectionPool = () => {
        if (!selectedVehicleId) return
        setVehicleSelectOpen(false)
        setFaultOpen(true)
    }

    // --- RENDER HELPERS ---

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    <p className="text-muted-foreground">Cargando panel...</p>
                </div>
            </div>
        )
    }

    return (
        <PremiumPageLayout
            title={`Hola, ${profile?.first_name || 'Usuario'}`}
            description={assignedVehicle ? "Modo Chofer" : "Panel de Operaciones"}
        >
            <div className="mb-8">
                <Link href="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4">
                    <HomeIcon size={20} />
                    <span>Volver al inicio</span>
                </Link>
            </div>

            <div className="max-w-5xl mx-auto space-y-8">

                {/* DRIVER SPECIFIC HEADER */}
                {assignedVehicle && (
                    <PremiumContent className="p-0 border-0 bg-transparent shadow-none">
                        <div className="bg-gradient-to-br from-zinc-900 to-black rounded-[2rem] p-6 text-white border border-zinc-800 shadow-xl relative overflow-hidden">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
                                <div>
                                    <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-2">Vehículo Asignado</h3>
                                    <div className="flex items-center gap-4">
                                        <div className="h-16 w-16 bg-white/10 backdrop-blur rounded-2xl flex items-center justify-center text-white overflow-hidden relative">
                                            {/* [UPDATED] Replaced Icon with Image Logic */}
                                            {assignedVehicle.foto_url ? (
                                                <img
                                                    src={assignedVehicle.foto_url}
                                                    alt={assignedVehicle.modelo}
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        e.currentTarget.style.display = 'none'
                                                        e.currentTarget.nextElementSibling?.classList.remove('hidden')
                                                    }}
                                                />
                                            ) : null}
                                            {/* Fallback Icon / Default Image */}
                                            <div className={`${assignedVehicle.foto_url ? 'hidden' : ''} w-full h-full flex items-center justify-center`}>
                                                {/* Use default mitsubishi image if model matches, else icon */}
                                                {assignedVehicle.modelo.toLowerCase().includes('l300') ? (
                                                    <img src="/vehicles/mitsubishi_l300.png" alt="Mitsubishi L300" className="w-full h-full object-cover" />
                                                ) : (
                                                    <Car size={32} />
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-bold text-white leading-tight">{assignedVehicle.modelo}</h2>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="font-mono text-zinc-300 bg-white/5 px-2 py-0.5 rounded-lg border border-white/10 text-sm">
                                                    {assignedVehicle.placa}
                                                </span>
                                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold border border-blue-500/20">
                                                    <Fuel size={12} />
                                                    {assignedVehicle.current_fuel_level || 0}%
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* QR BUTTON FOR DRIVER */}
                                <Dialog open={qrOpen} onOpenChange={setQrOpen}>
                                    <DialogTrigger asChild>
                                        <Button className="h-14 px-6 rounded-2xl bg-white text-black hover:bg-zinc-200 shadow-lg active:scale-95 transition-all text-sm font-semibold flex items-center gap-2">
                                            <QrCode size={18} />
                                            <span>Código de Combustible</span>
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-md bg-white border-none shadow-2xl rounded-[2.5rem] p-8 flex flex-col items-center">
                                        <DialogHeader>
                                            <DialogTitle className="text-center text-2xl font-bold text-black">Código de Carga</DialogTitle>
                                            <DialogDescription className="text-center text-zinc-400">Autorización Digital</DialogDescription>
                                        </DialogHeader>
                                        <div className="p-6 bg-white border border-zinc-100 shadow-lg rounded-[2rem] mb-4 w-full max-w-[280px]">
                                            <div style={{ height: "auto", margin: "0 auto", width: "100%" }}>
                                                <QRCode
                                                    size={256}
                                                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                                    value={JSON.stringify({
                                                        type: 'FUEL_AUTH',
                                                        driverId: profile?.id,
                                                        vehicleId: assignedVehicle.id,
                                                        placa: assignedVehicle.placa,
                                                        driverName: `${profile?.first_name} ${profile?.last_name}`
                                                    })}
                                                    viewBox={`0 0 256 256`}
                                                />
                                            </div>
                                        </div>
                                        <p className="font-mono text-sm font-bold text-zinc-900 tracking-widest bg-zinc-50 px-4 py-2 rounded-xl border border-zinc-100">
                                            {assignedVehicle.placa}
                                        </p>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </div>
                    </PremiumContent>
                )}

                {/* UNIFIED ACTION GRID (3 CARDS) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* CARD 1: SALIDA */}
                    <button
                        disabled={!!activeTripReport} // [NEW] Disable if in trip
                        onClick={() => {
                            if (activeTripReport) return // Prevent click if disabled check fails
                            if (assignedVehicle) {
                                setInitialVehicleId(assignedVehicle.id)
                                setSalidaOpen(true)
                            } else {
                                setInitialVehicleId("")
                                setSalidaOpen(true)
                            }
                        }}
                        className="text-left w-full h-full"
                    >
                        <PremiumCard
                            className={`h-full flex flex-col justify-between ${activeTripReport ? 'opacity-60 cursor-not-allowed bg-muted/50' : 'hover:border-primary/50'}`}
                        >
                            <div className="flex flex-col h-full justify-between space-y-6">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${activeTripReport ? 'bg-muted text-muted-foreground' : 'bg-indigo-500/10 text-indigo-500'}`}>
                                    <Truck size={24} />
                                </div>
                                <div className="space-y-2">
                                    <h2 className="text-xl font-bold text-foreground">
                                        {activeTripReport ? "En Ruta (Activo)" : "Registrar Salida"}
                                    </h2>
                                    <p className="text-muted-foreground text-sm font-medium">
                                        {activeTripReport ? "Tienes un viaje en curso. Registra la entrada para iniciar otro." : (assignedVehicle ? "Iniciar ruta con tu unidad asignada." : "Seleccionar vehículo del departamento para iniciar ruta.")}
                                    </p>
                                </div>
                                {!activeTripReport && (
                                    <div className="flex items-center text-indigo-500 font-bold text-sm">
                                        Iniciar <ArrowRight size={16} className="ml-2" />
                                    </div>
                                )}
                            </div>
                        </PremiumCard>
                    </button>

                    {/* CARD 2: ENTRADA */}
                    <button
                        disabled={!activeTripReport} // [NEW] Disable if NOT in trip
                        onClick={() => {
                            if (!activeTripReport) return // Prevent click
                            if (activeTripReport) {
                                setInitialVehicleId(activeTripReport.vehiculo_id)
                                setEntradaOpen(true)
                            }
                        }}
                        className="text-left w-full h-full"
                    >
                        <PremiumCard
                            className={`h-full flex flex-col justify-between ${!activeTripReport ? 'opacity-60 cursor-not-allowed bg-muted/50' : 'hover:border-primary/50'}`}
                        >
                            <div className="flex flex-col h-full justify-between space-y-6">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${!activeTripReport ? 'bg-muted text-muted-foreground' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                    <LogOut size={24} className="scale-x-[-1]" />
                                </div>
                                <div className="space-y-2">
                                    <h2 className="text-xl font-bold text-foreground">
                                        {!activeTripReport ? "Sin Viaje Activo" : "Registrar Entrada"}
                                    </h2>
                                    <p className="text-muted-foreground text-sm font-medium">
                                        {!activeTripReport ? "No tienes un vehículo en ruta actualmente. Registra una salida primero." : (assignedVehicle ? "Finalizar ruta y reportar kilometraje." : "Cerrar ruta, registrar kilometraje y liberar vehículo.")}
                                    </p>
                                </div>
                                {activeTripReport && (
                                    <div className="flex items-center text-emerald-500 font-bold text-sm">
                                        Registrar <ArrowRight size={16} className="ml-2" />
                                    </div>
                                )}
                            </div>
                        </PremiumCard>
                    </button>

                    {/* CARD 3: FALLA */}
                    <button
                        onClick={() => {
                            if (assignedVehicle) {
                                setSelectedVehicleId(assignedVehicle.id)
                                setFaultOpen(true)
                            } else {
                                startFaultReportingPool()
                            }
                        }}
                        className="text-left w-full h-full"
                    >
                        <PremiumCard className="h-full flex flex-col justify-between hover:border-red-500/50">
                            <div className="flex flex-col h-full justify-between space-y-6">
                                <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500">
                                    <AlertTriangle size={24} />
                                </div>
                                <div className="space-y-2">
                                    <h2 className="text-xl font-bold text-foreground">Reportar Falla</h2>
                                    <p className="text-muted-foreground text-sm font-medium">
                                        {assignedVehicle ? "Notificar avería en tu unidad asignada." : "Notificar avería en un vehículo de la flota."}
                                    </p>
                                </div>
                                <div className="flex items-center text-red-500 font-bold text-sm">
                                    Reportar <ArrowRight size={16} className="ml-2" />
                                </div>
                            </div>
                        </PremiumCard>
                    </button>
                </div>

                {/* MODALS */}
                <SalidaFormDialog
                    isOpen={salidaOpen}
                    onClose={() => setSalidaOpen(false)}
                    initialVehicleId={initialVehicleId}
                    onSuccess={() => {
                        loadData(true) // [NEW] Silent reload to keep dialog open
                    }}
                />

                <EntradaFormDialog
                    isOpen={entradaOpen}
                    onClose={() => setEntradaOpen(false)}
                    initialVehicleId={initialVehicleId}
                    onSuccess={() => {
                        loadData(true) // [NEW] Silent reload to keep dialog open
                    }}
                />

                {/* POOL SELECTOR DIALOG */}
                <Dialog open={vehicleSelectOpen} onOpenChange={setVehicleSelectOpen}>
                    <DialogContent className="sm:max-w-md rounded-2xl border-none shadow-2xl bg-background border border-border">
                        <DialogHeader>
                            <DialogTitle className="text-center text-xl font-bold text-foreground">Seleccionar Vehículo</DialogTitle>
                        </DialogHeader>
                        <div className="py-4">
                            <label className="text-sm font-semibold text-muted-foreground mb-2 block">Vehículo con Falla</label>
                            <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
                                <SelectTrigger className="h-12 rounded-xl bg-background border-border text-foreground">
                                    <SelectValue placeholder="Seleccione un vehículo..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {vehicles.map(v => (
                                        <SelectItem key={v.id} value={v.id}>
                                            {v.modelo} - {v.placa} ({v.codigo})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setVehicleSelectOpen(false)} className="rounded-xl border-border text-foreground hover:bg-muted">Cancelar</Button>
                            <Button
                                onClick={confirmVehicleSelectionPool}
                                disabled={!selectedVehicleId}
                                className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                            >
                                Continuar
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* FAULT DIALOG */}
                {(selectedVehicleId || (assignedVehicle && faultOpen)) && (
                    <ReportFaultDialog
                        isOpen={faultOpen}
                        onClose={() => {
                            setFaultOpen(false)
                            if (!assignedVehicle) setSelectedVehicleId("") // Reset only if pool
                        }}
                        vehicleId={assignedVehicle ? assignedVehicle.id : selectedVehicleId}
                        onFaultReported={() => { }}
                    />
                )}
            </div>
        </PremiumPageLayout>
    )
}
