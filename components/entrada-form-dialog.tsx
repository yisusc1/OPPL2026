"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CheckCircle, Send } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { VehicleSelector, Vehicle } from "@/components/vehicle-selector"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { revalidateGerencia } from "@/app/transporte/actions"

type Reporte = {
    id: string
    vehiculo_id: string
    km_salida: number
    conductor: string
    departamento: string
    created_at: string
    vehiculos: {
        modelo: string
        placa: string
        codigo: string
        tipo: string
    }
}

type EntradaFormDialogProps = {
    isOpen: boolean
    onClose: () => void
    initialVehicleId?: string
    onSuccess?: () => void
}

export function EntradaFormDialog({ isOpen, onClose, initialVehicleId, onSuccess }: EntradaFormDialogProps) {
    const [loading, setLoading] = useState(false)
    const [reportes, setReportes] = useState<Reporte[]>([])
    const [reporteId, setReporteId] = useState("")
    const [kmEntrada, setKmEntrada] = useState("")
    const [selectedReport, setSelectedReport] = useState<Reporte | null>(null)
    const [gasolina, setGasolina] = useState("Full")
    const [observaciones, setObservaciones] = useState("")
    const [step, setStep] = useState<'form' | 'success'>('form')
    const [whatsappText, setWhatsappText] = useState("")
    const router = useRouter()

    // Checks
    const [checks, setChecks] = useState({
        aceite: false,
        agua: false,
        gato: false,
        cruz: false,
        triangulo: false,
        caucho: false,
        carpeta: false,
        onu: false,
        ups: false,
        escalera: false,
        // Moto specific
        casco: false,
        luces: false,
        herramientas: false
    })

    useEffect(() => {
        if (isOpen) {
            setStep('form') // Reset step
            loadPendingReports().then((data) => {
                if (initialVehicleId && data) {
                    const matchingReport = data.find((r: any) => r.vehiculo_id === initialVehicleId)
                    if (matchingReport) {
                        // [FIX] Set state directly from fetched data to avoid race condition with setReportes
                        setReporteId(matchingReport.id)
                        setSelectedReport(matchingReport as unknown as Reporte)

                        // Reset checks on change
                        setChecks({
                            aceite: false, agua: false, gato: false, cruz: false,
                            triangulo: false, caucho: false, carpeta: false,
                            onu: false, ups: false, escalera: false,
                            casco: false, luces: false, herramientas: false
                        })
                    }
                }
            })
        }
    }, [isOpen, initialVehicleId])

    async function loadPendingReports() {
        const supabase = createClient()
        const { data } = await supabase
            .from('reportes')
            .select(`
                id, 
                vehiculo_id,
                km_salida, 
                conductor,
                departamento,
                created_at,
                vehiculos ( modelo, placa, codigo, tipo, department )
            `)
            .is('km_entrada', null)
            .order('created_at', { ascending: false })

        // @ts-ignore
        if (data) setReportes(data)
        return data
    }

    function handleReportChange(value: string) {
        setReporteId(value)
        const report = reportes.find(r => r.id === value) || null
        setSelectedReport(report)
        // Reset checks on change
        setChecks({
            aceite: false, agua: false, gato: false, cruz: false,
            triangulo: false, caucho: false, carpeta: false,
            onu: false, ups: false, escalera: false,
            casco: false, luces: false, herramientas: false
        })
    }

    const toggleCheck = (key: keyof typeof checks) => {
        setChecks(prev => ({ ...prev, [key]: !prev[key] }))
    }

    async function handleSubmit() {
        if (!reporteId || !kmEntrada) {
            toast.error("Complete todos los campos obligatorios")
            return
        }

        const km = parseInt(kmEntrada)
        if (selectedReport && km < selectedReport.km_salida) {
            toast.error(`Error: El KM de entrada (${km}) es menor al de salida (${selectedReport.km_salida})`)
            return
        }

        setLoading(true)
        try {
            const supabase = createClient()
            const { error } = await supabase
                .from('reportes')
                .update({
                    km_entrada: km,
                    gasolina_entrada: gasolina,
                    observaciones_entrada: observaciones,

                    aceite_entrada: checks.aceite,
                    agua_entrada: checks.agua,

                    // Car specific
                    gato_entrada: checks.gato,
                    cruz_entrada: checks.cruz,
                    triangulo_entrada: checks.triangulo,
                    caucho_entrada: checks.caucho,
                    carpeta_entrada: checks.carpeta,

                    // Moto specific
                    casco_entrada: checks.casco,
                    luces_entrada: checks.luces,
                    herramientas_entrada: checks.herramientas,

                    onu_entrada: checks.onu ? 1 : 0,
                    ups_entrada: checks.ups ? 1 : 0,
                    escalera_entrada: checks.escalera,
                })
                .eq('id', reporteId)

            if (error) throw error

            // [NEW] Update Vehicle Fuel Level
            const fuelMap: Record<string, number> = {
                "Full": 100,
                "3/4": 75,
                "1/2": 50,
                "1/4": 25,
                "Reserva": 10
            }
            const fuelLevel = fuelMap[gasolina] || 0

            // We update the vehicle directly
            if (selectedReport?.vehiculo_id) {
                await supabase.from('vehiculos').update({
                    current_fuel_level: fuelLevel,
                    kilometraje: km,
                    last_fuel_update: new Date().toISOString()
                }).eq('id', selectedReport.vehiculo_id)
            }

            // Force Dashboard Refresh
            await revalidateGerencia()

            toast.success("Entrada registrada correctamente")

            // --- WhatsApp Integration ---
            if (selectedReport) {
                const text = formatEntradaText({
                    km_entrada: km,
                    gasolina_entrada: gasolina,
                    observaciones_entrada: observaciones,
                    aceite_entrada: checks.aceite,
                    agua_entrada: checks.agua,
                    gato_entrada: checks.gato,
                    cruz_entrada: checks.cruz,
                    triangulo_entrada: checks.triangulo,
                    caucho_entrada: checks.caucho,
                    carpeta_entrada: checks.carpeta,
                    // Moto
                    casco_entrada: checks.casco,
                    luces_entrada: checks.luces,
                    herramientas_entrada: checks.herramientas,

                    onu_entrada: checks.onu ? 1 : 0,
                    ups_entrada: checks.ups ? 1 : 0,
                    escalera_entrada: checks.escalera
                }, selectedReport)

                setWhatsappText(text)
                setStep('success')
            }
            // ----------------------------

            router.refresh()
            // onClose()
            if (onSuccess) onSuccess() // [NEW] Trigger refresh in parent

            // Reset form
            setReporteId("")
            setKmEntrada("")
            setSelectedReport(null)
            setGasolina("Full")
            setObservaciones("")
            setChecks({
                aceite: false, agua: false, gato: false, cruz: false,
                triangulo: false, caucho: false, carpeta: false,
                onu: false, ups: false, escalera: false,
                casco: false, luces: false, herramientas: false
            })

        } catch (error) {
            console.error(error)
            toast.error("Error al registrar entrada")
        } finally {
            setLoading(false)
        }
    }

    // Helpers
    const formatEntradaText = (entradaData: any, reporteOriginal: Reporte) => {
        const check = (val: boolean | number) => val ? '✅' : '❌'

        // Calcular fechas y horas
        const fechaSalidaObj = new Date(reporteOriginal.created_at)
        const fechaEntradaObj = new Date()

        const fechaEntrada = fechaEntradaObj.toLocaleDateString()
        const horaSalida = fechaSalidaObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        const horaEntrada = fechaEntradaObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

        // vehiculos is an object in Reporte type based on our interface, but Supabase may return an array if not 1:1 strictly enforced in types
        // @ts-ignore
        const vData = reporteOriginal.vehiculos
        const vehiculo = Array.isArray(vData) ? vData[0] : vData

        const vehiculoNombre = vehiculo ? vehiculo.modelo : 'Desconocido'
        const kmRecorrido = Number(entradaData.km_entrada) - Number(reporteOriginal.km_salida)

        const isMoto = vehiculo?.codigo?.startsWith('M-') || vehiculo?.tipo === 'Moto' || vehiculo?.modelo?.toLowerCase().includes('moto') || false
        // [FIX] Update check here too for whatsapp text
        const isInstalacion = reporteOriginal.departamento === 'Instalación' || vehiculo?.department === 'Instalación'

        let msg = `*Reporte de Entrada*\n\n`

        msg += `Fecha (Entrada): ${fechaEntrada}\n`
        msg += `Hora (Salida): ${horaSalida}\n`
        msg += `Hora (Entrada): ${horaEntrada}\n\n`

        msg += `Conductor: ${reporteOriginal.conductor}\n`
        msg += `Departamento: ${reporteOriginal.departamento}\n\n`

        msg += `Vehículo: ${vehiculoNombre}\n`
        if (vehiculo?.placa) msg += `Placa: ${vehiculo.placa}\n`
        msg += `Kilometraje (Salida): ${reporteOriginal.km_salida}\n`
        msg += `Kilometraje (Entrada): ${entradaData.km_entrada}\n`
        msg += `Kilometraje Recorrido: ${kmRecorrido}\n`
        msg += `Nivel de Gasolina: ${entradaData.gasolina_entrada}\n\n`

        msg += `*Chequeo Técnico:*\n`
        msg += `Chequeo de Aceite: ${check(entradaData.aceite_entrada)}\n`

        if (!isMoto) msg += `Chequeo de Agua/Refrigerante: ${check(entradaData.agua_entrada)}\n`

        msg += `\n`

        if (!isMoto) {
            msg += `*Herramientas:*\n`
            msg += `Gato: ${check(entradaData.gato_entrada)}\n`
            msg += `Llave Cruz: ${check(entradaData.cruz_entrada)}\n`
            msg += `Triángulo: ${check(entradaData.triangulo_entrada)}\n`
            msg += `Caucho: ${check(entradaData.caucho_entrada)}\n`
            msg += `Carpeta de Permisos: ${check(entradaData.carpeta_entrada)}\n`
        } else {
            msg += `*Seguridad (Moto):*\n`
            msg += `Casco: ${check(entradaData.casco_entrada)}\n`
            msg += `Luces: ${check(entradaData.luces_entrada)}\n`
            msg += `Herramientas: ${check(entradaData.herramientas_entrada)}\n`
        }

        if (isInstalacion && !isMoto) {
            msg += `\n*Equipos Asignados:*\n`
            msg += `ONU/Router: ${check(entradaData.onu_entrada)}\n`
            msg += `Mini-UPS: ${check(entradaData.ups_entrada)}\n`
            msg += `Escalera: ${check(entradaData.escalera_entrada)}\n`
        }

        msg += `\nObservaciones: ${entradaData.observaciones_entrada || 'Ninguna'}`
        return msg
    }

    // Helpers conditions
    // Note: In Entrada, we use selectedReport.vehiculos which is an object
    const v = selectedReport?.vehiculos
    const isMoto = v?.codigo?.startsWith('M-') || v?.tipo === 'Moto' || v?.modelo?.toLowerCase().includes('moto')
    // [FIX] Updated condition to include vehicle department
    // @ts-ignore
    const isInstalacion = selectedReport?.departamento === 'Instalación' || v?.department === 'Instalación'


    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            if (!open && step === 'success') return
            onClose()
        }}>
            <DialogContent
                onInteractOutside={(e) => {
                    if (step === 'success') e.preventDefault()
                }}
                onEscapeKeyDown={(e) => {
                    if (step === 'success') e.preventDefault()
                }}
                className="sm:max-w-xl rounded-[32px] border-none shadow-2xl max-h-[90vh] flex flex-col p-0 focus:outline-none bg-zinc-50 dark:bg-zinc-950 overflow-hidden text-foreground"
            >

                {step === 'success' ? (
                    <div className="p-8 flex flex-col items-center justify-center text-center space-y-6 bg-white dark:bg-zinc-900 h-full min-h-[400px]">
                        <div className="h-20 w-20 bg-green-100 dark:bg-green-500/20 rounded-full flex items-center justify-center text-green-600 dark:text-green-500 animate-in zoom-in spin-in-3">
                            <CheckCircle size={40} />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">¡Entrada Registrada!</h2>
                            <p className="text-slate-500 dark:text-slate-400 text-sm">El vehículo ha sido recibido correctamente.</p>
                        </div>

                        <div className="w-full space-y-3 pt-4">
                            <Button
                                onClick={() => window.location.href = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`}
                                className="w-full h-14 bg-[#25D366] hover:bg-[#128C7E] text-white rounded-2xl font-bold text-lg shadow-lg shadow-green-500/20 active:scale-95 transition-all"
                            >
                                <Send size={24} className="mr-2" />
                                <span className="text-white">Reportar en WhatsApp</span>
                            </Button>
                            <Button onClick={onClose} variant="ghost" className="w-full text-slate-400 dark:text-slate-500 hover:bg-zinc-100 dark:hover:bg-white/5">
                                Cerrar y Volver
                            </Button>
                        </div>
                    </div>
                ) : (
                    <>
                        <DialogHeader className="bg-white dark:bg-zinc-900 p-6 pb-4 border-b border-zinc-100 dark:border-white/5">
                            <DialogTitle className="text-2xl font-bold text-center text-zinc-900 dark:text-white">Registrar Entrada</DialogTitle>
                            <DialogDescription className="text-center text-zinc-500 dark:text-zinc-400">Cierre de ruta y novedades</DialogDescription>
                        </DialogHeader>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                            {/* Basic Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2 col-span-2">
                                    <VehicleSelector
                                        vehicles={reportes.map(r => ({
                                            id: r.vehiculo_id,
                                            placa: r.vehiculos.placa,
                                            modelo: r.vehiculos.modelo,
                                            codigo: r.vehiculos.codigo,
                                            tipo: r.vehiculos.tipo,
                                        }))}
                                        selectedVehicleId={selectedReport?.vehiculo_id}
                                        onSelect={(v) => {
                                            if (v) {
                                                const r = reportes.find(rep => rep.vehiculo_id === v.id)
                                                if (r) handleReportChange(r.id)
                                            } else {
                                                setReporteId("")
                                                setSelectedReport(null)
                                            }
                                        }}
                                        label="Vehículo en Ruta"
                                    />
                                    {selectedReport && (
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400 text-right">
                                            Conductor: {selectedReport.conductor} • Salida: {selectedReport.km_salida.toLocaleString()} km
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-zinc-500 dark:text-zinc-400">Kilometraje Llegada</Label>
                                    <Input
                                        type="number"
                                        value={kmEntrada}
                                        onChange={e => setKmEntrada(e.target.value)}
                                        className="h-12 rounded-xl bg-white dark:bg-white/5 border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white"
                                        placeholder={selectedReport ? `> ${selectedReport.km_salida}` : "0"}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-zinc-500 dark:text-zinc-400">Nivel de Gasolina</Label>
                                    <Select value={gasolina} onValueChange={setGasolina}>
                                        <SelectTrigger className="h-12 rounded-xl bg-white dark:bg-white/5 border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Full">Full</SelectItem>
                                            <SelectItem value="3/4">3/4</SelectItem>
                                            <SelectItem value="1/2">1/2</SelectItem>
                                            <SelectItem value="1/4">1/4</SelectItem>
                                            <SelectItem value="Reserva">Reserva</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Checks section */}
                            <div className="bg-white dark:bg-zinc-900 p-5 rounded-[24px] border border-zinc-100 dark:border-white/5 shadow-sm space-y-6">

                                {/* TÉCNICO */}
                                <div>
                                    <h4 className="text-sm font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        Chequeo Técnico (Llegada)
                                    </h4>
                                    <div className="grid grid-cols-1 gap-3">
                                        <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-transparent hover:border-zinc-200 dark:hover:border-white/10 transition-all">
                                            <Label htmlFor="aceite" className="text-sm font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">Nivel de Aceite</Label>
                                            <Switch id="aceite" checked={checks.aceite} onCheckedChange={() => toggleCheck('aceite')} />
                                        </div>
                                        {!isMoto && (
                                            <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-transparent hover:border-zinc-200 dark:hover:border-white/10 transition-all">
                                                <Label htmlFor="agua" className="text-sm font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">Agua / Refrigerante</Label>
                                                <Switch id="agua" checked={checks.agua} onCheckedChange={() => toggleCheck('agua')} />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* SEGURIDAD - CARROS */}
                                {!isMoto && selectedReport && (
                                    <div>
                                        <h4 className="text-sm font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2 border-t border-zinc-100 dark:border-white/5 pt-4">
                                            Herramientas (Verificar devolución)
                                        </h4>
                                        <div className="grid grid-cols-1 gap-3">
                                            <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-transparent hover:border-zinc-200 dark:hover:border-white/10 transition-all">
                                                <Label htmlFor="gato" className="text-sm font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">Gato Hidráulico</Label>
                                                <Switch id="gato" checked={checks.gato} onCheckedChange={() => toggleCheck('gato')} />
                                            </div>
                                            <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-transparent hover:border-zinc-200 dark:hover:border-white/10 transition-all">
                                                <Label htmlFor="cruz" className="text-sm font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">Llave Cruz</Label>
                                                <Switch id="cruz" checked={checks.cruz} onCheckedChange={() => toggleCheck('cruz')} />
                                            </div>
                                            <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-transparent hover:border-zinc-200 dark:hover:border-white/10 transition-all">
                                                <Label htmlFor="triangulo" className="text-sm font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">Triángulo</Label>
                                                <Switch id="triangulo" checked={checks.triangulo} onCheckedChange={() => toggleCheck('triangulo')} />
                                            </div>
                                            <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-transparent hover:border-zinc-200 dark:hover:border-white/10 transition-all">
                                                <Label htmlFor="caucho" className="text-sm font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">Caucho Repuesto</Label>
                                                <Switch id="caucho" checked={checks.caucho} onCheckedChange={() => toggleCheck('caucho')} />
                                            </div>
                                            <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-transparent hover:border-zinc-200 dark:hover:border-white/10 transition-all">
                                                <Label htmlFor="carpeta" className="text-sm font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">Carpeta / Permisos</Label>
                                                <Switch id="carpeta" checked={checks.carpeta} onCheckedChange={() => toggleCheck('carpeta')} />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* SEGURIDAD - MOTO */}
                                {isMoto && selectedReport && (
                                    <div>
                                        <h4 className="text-sm font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2 border-t border-zinc-100 dark:border-white/5 pt-4">
                                            Seguridad Moto (Verificar devolución)
                                        </h4>
                                        <div className="grid grid-cols-1 gap-3">
                                            <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-transparent hover:border-zinc-200 dark:hover:border-white/10 transition-all">
                                                <Label htmlFor="casco" className="text-sm font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">Casco</Label>
                                                <Switch id="casco" checked={checks.casco} onCheckedChange={() => toggleCheck('casco')} />
                                            </div>
                                            <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-transparent hover:border-zinc-200 dark:hover:border-white/10 transition-all">
                                                <Label htmlFor="luces" className="text-sm font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">Luces</Label>
                                                <Switch id="luces" checked={checks.luces} onCheckedChange={() => toggleCheck('luces')} />
                                            </div>
                                            <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-transparent hover:border-zinc-200 dark:hover:border-white/10 transition-all">
                                                <Label htmlFor="herramientas" className="text-sm font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">Herramientas Básicas</Label>
                                                <Switch id="herramientas" checked={checks.herramientas} onCheckedChange={() => toggleCheck('herramientas')} />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* EQUIPOS - SOLO INSTALACION Y NO MOTO */}
                                {isInstalacion && !isMoto && (
                                    <div>
                                        <h4 className="text-sm font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2 border-t border-zinc-100 dark:border-white/5 pt-4">
                                            Equipos Asignados
                                        </h4>
                                        <div className="grid grid-cols-1 gap-3">
                                            <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-transparent hover:border-zinc-200 dark:hover:border-white/10 transition-all">
                                                <Label htmlFor="onu" className="text-sm font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">ONU / Router</Label>
                                                <Switch id="onu" checked={checks.onu} onCheckedChange={() => toggleCheck('onu')} />
                                            </div>
                                            <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-transparent hover:border-zinc-200 dark:hover:border-white/10 transition-all">
                                                <Label htmlFor="ups" className="text-sm font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">Mini-UPS</Label>
                                                <Switch id="ups" checked={checks.ups} onCheckedChange={() => toggleCheck('ups')} />
                                            </div>
                                            <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-transparent hover:border-zinc-200 dark:hover:border-white/10 transition-all">
                                                <Label htmlFor="escalera" className="text-sm font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">Escalera</Label>
                                                <Switch id="escalera" checked={checks.escalera} onCheckedChange={() => toggleCheck('escalera')} />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label className="text-zinc-500 dark:text-zinc-400">Observaciones / Novedades</Label>
                                <Textarea
                                    value={observaciones}
                                    onChange={e => setObservaciones(e.target.value)}
                                    className="bg-white dark:bg-white/5 py-3 min-h-[80px] border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white placeholder:text-zinc-400"
                                    placeholder="Detalle cualquier novedad encontrada..."
                                />
                            </div>
                        </div>

                        <DialogFooter className="bg-white dark:bg-zinc-900 p-4 border-t border-zinc-100 dark:border-white/5 flex-col sm:flex-col gap-2">
                            <Button onClick={handleSubmit} disabled={loading} className="w-full h-12 rounded-xl bg-black dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 text-lg shadow-lg shadow-black/10">
                                {loading ? "Registrando..." : "Confirmar Entrada"}
                            </Button>
                            <Button variant="ghost" onClick={onClose} className="w-full rounded-xl text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5">
                                Cancelar
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}
