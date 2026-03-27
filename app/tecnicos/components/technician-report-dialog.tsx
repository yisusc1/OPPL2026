"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MessageSquare, Send, Plus, Trash2, SlidersHorizontal, ArrowLeft, CheckCircle, ArrowRight } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { saveTechnicianReport, getTechnicianReport } from "@/app/tecnicos/actions"
import { VehicleSelector } from "@/components/vehicle-selector"
import { toast } from "sonner"

type Props = {
    profile: any
    stock: any
    todaysInstallations: any[]
    todaysSupports: any[]
    activeClients: any[]
    vehicles: any[]
}

// Helper: safe number parse
const parseNum = (val: any) => parseFloat(String(val).replace(/[^0-9.]/g, '')) || 0
const parseIntSafe = (val: any) => parseInt(String(val || 0).replace(/\D/g, '')) || 0

// Helper: check stock (pure function)
function activeStockQuantity(stockObj: any, keyMap: string) {
    let q = 0
    if (!stockObj) return 0
    Object.keys(stockObj).forEach(k => {
        if (k.includes(keyMap)) q += stockObj[k].quantity
    })
    return q
}

export function TechnicianReportDialog({ profile, stock, todaysInstallations, todaysSupports, activeClients, vehicles }: Props) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [step, setStep] = useState<'form' | 'preview' | 'success'>('form')

    // Form Fields
    const [selectedVehicle, setSelectedVehicle] = useState("")

    // Dynamic Serials
    const [onuCount, setOnuCount] = useState<number>(0)
    const [onuSerials, setOnuSerials] = useState<string[]>([])

    const [routerCount, setRouterCount] = useState<number>(0)
    const [routerSerials, setRouterSerials] = useState<string[]>([])

    // Materials
    const [materials, setMaterials] = useState({
        conectores_used: 0,
        conectores_remaining: 0,
        conectores_defective: 0,
        tensores_used: 0,
        tensores_remaining: 0,
        patchcords_used: 0,
        patchcords_remaining: 0,
        rosetas_used: 0
    })

    // Spools (Dynamic Array)
    type SpoolEntry = { serial: string, used: number, remaining: number }
    const [spools, setSpools] = useState<SpoolEntry[]>([])

    // Available Spools (from Stock) for Dropdown
    const availableSpools = Object.keys(stock)
        .filter(k => {
            // Robust check using the isSpool flag from server or fallback to name/sku
            const entry = stock[k]
            if (entry?.isSpool) return true
            return k.includes("CARRETE") || k.includes("I002")
        })
        .map(k => {
            const parts = k.split("__")
            return parts[1] || parts[0]
        })

    useEffect(() => {
        if (open) {
            setStep('form')
            loadExistingData()
        }
    }, [open])

    async function loadExistingData() {
        setLoading(true)
        try {
            // 1. Try to get saved report from DB
            const saved = await getTechnicianReport()
            if (saved) {
                // Populate from DB
                setSelectedVehicle(saved.vehicle_id || "")

                // Serials
                const onus = Array.isArray(saved.onu_serials) ? saved.onu_serials : []
                setOnuCount(onus.length)
                setOnuSerials(onus)

                const routers = Array.isArray(saved.router_serials) ? saved.router_serials : []
                setRouterCount(routers.length)
                setRouterSerials(routers)

                // Materials
                // [Fix] Refresh Materials Usage from Latest Calculation
                // While keeping Manual "Defective" or other fields if possible?
                // Let's overwrite Usage columns with Calculated to ensure new supports are counted.
                const calculated = getCalculatedData()

                if (saved.materials) {
                    setMaterials(prev => ({
                        ...prev,
                        ...saved.materials,
                        // Force Update Usage from Live Data
                        conectores_used: calculated.materials.conectores_used,
                        tensores_used: calculated.materials.tensores_used,
                        patchcords_used: calculated.materials.patchcords_used,
                        rosetas_used: calculated.materials.rosetas_used
                    }))
                } else {
                    setMaterials(calculated.materials)
                }

                // Spools
                if (saved.spools) {
                    // MERGE Logic for Spools
                    // We prefer Calculated Usage (Live) but keep Saved Manual Entries?
                    // Strategy: Take Calculated Spools. If Saved has extra serials not in Calculated, add them.
                    // Usage: Always use Calculated Usage for matching serials. Meaning "Live Update".

                    const mergedSpools = [...calculated.spools]
                    saved.spools.forEach((sSpy: any) => {
                        const existing = mergedSpools.find(m => m.serial === sSpy.serial)
                        if (!existing) {
                            // It's a manual entry (or deleted one), keep it
                            mergedSpools.push(sSpy)
                        } else {
                            // It exists in calculated. Use Calculated Usage?
                            // Yes, to update with new supports. 
                            // existing.used is already up to date from 'calculated'.
                        }
                    })
                    setSpools(mergedSpools)
                } else {
                    setSpools(calculated.spools)
                }

            } else {
                // 2. Fallback to Auto-Calculation (First time)
                calculateInitialValues()
            }
        } catch (e) {
            console.error(e)
            calculateInitialValues()
        } finally {
            setLoading(false)
        }
    }

    // Resize Serial Arrays when Count Changes
    useEffect(() => {
        setOnuSerials(prev => {
            const arr = [...prev]
            if (onuCount > arr.length) return [...arr, ...Array(onuCount - arr.length).fill("")]
            return arr.slice(0, onuCount)
        })
    }, [onuCount])

    useEffect(() => {
        setRouterSerials(prev => {
            const arr = [...prev]
            if (routerCount > arr.length) return [...arr, ...Array(routerCount - arr.length).fill("")]
            return arr.slice(0, routerCount)
        })
    }, [routerCount])

    // Extracted Calculation Logic
    function getCalculatedData() {
        // A. Materials
        let c_used = 0, t_used = 0, p_used = 0, r_used = 0

        // Sum Installations
        todaysInstallations.forEach((c: any) => {
            c_used += parseIntSafe(c.conectores)
            t_used += parseIntSafe(c.tensores)
            if (c.patchcord === 'Si' || c.patchcord === true) p_used++
            if (c.rosetas === 'Si' || c.rosetas === true) r_used++
        })

        // Sum Supports 
        todaysSupports.forEach((s: any) => {
            c_used += parseIntSafe(s.conectores)
            t_used += parseIntSafe(s.tensores)
            p_used += parseIntSafe(s.patchcord)
            r_used += parseIntSafe(s.rosetas)
        })

        // Auto-calc remaining from stock
        const c_rem = activeStockQuantity(stock, "CONV")
        const t_rem = activeStockQuantity(stock, "TENS")
        const p_rem = activeStockQuantity(stock, "PATCH1")

        const calculatedMaterials = {
            conectores_used: c_used,
            conectores_remaining: c_rem > 0 ? c_rem : 0,
            conectores_defective: 0,
            tensores_used: t_used,
            tensores_remaining: t_rem > 0 ? t_rem : 0,
            patchcords_used: p_used,
            patchcords_remaining: p_rem > 0 ? p_rem : 0,
            rosetas_used: r_used
        }

        // B. Spools (Auto-detect usage)
        const detectedSpools: Record<string, SpoolEntry> = {}

        const processUsage = (item: any) => {
            const spoolCode = item.codigo_carrete ? String(item.codigo_carrete).trim() : null

            if (spoolCode) {
                // Find matching spool in available list
                const cleanInput = spoolCode.toUpperCase().replace(/CARRETE|BOBINA|[-\s]/g, "")
                const match = availableSpools.find(s => {
                    const cleanSerial = s.toUpperCase().replace(/[-\s]/g, "")
                    return cleanInput === cleanSerial
                })

                const match2 = match || availableSpools.find(s => {
                    return spoolCode.toUpperCase().endsWith(s.toUpperCase()) || s.toUpperCase() === spoolCode.toUpperCase()
                })

                if (match2) {
                    if (!detectedSpools[match2]) {
                        const stockKey = Object.keys(stock).find(k => k.includes(match2))
                        const rem = stockKey ? stock[stockKey].quantity : 0
                        detectedSpools[match2] = {
                            serial: match2,
                            used: 0,
                            remaining: rem
                        }
                    }
                    const u = parseNum(item.metraje_usado)
                    const w = parseNum(item.metraje_desechado)
                    detectedSpools[match2].used += (u + w)
                } else {
                    if (!detectedSpools[spoolCode]) {
                        detectedSpools[spoolCode] = {
                            serial: spoolCode,
                            used: 0,
                            remaining: 0
                        }
                    }
                    const u = parseNum(item.metraje_usado)
                    const w = parseNum(item.metraje_desechado)
                    detectedSpools[spoolCode].used += (u + w)
                }
            }
        }

        todaysInstallations.forEach(processUsage)
        todaysSupports.forEach(processUsage)

        return { materials: calculatedMaterials, spools: Object.values(detectedSpools) }
    }

    function calculateInitialValues() {
        const { materials: m, spools: s } = getCalculatedData()
        setMaterials(m)
        setSpools(s)
    }

    // --- ACTIONS ---
    function addSpool() {
        setSpools([...spools, { serial: "", used: 0, remaining: 0 }])
    }

    function removeSpool(index: number) {
        const n = [...spools]
        n.splice(index, 1)
        setSpools(n)
    }

    function updateSpool(index: number, field: keyof SpoolEntry, val: any) {
        const n = [...spools]
        // @ts-ignore
        n[index][field] = val
        setSpools(n)
    }

    function updateSerial(type: 'ONU' | 'ROUTER', index: number, val: string) {
        if (type === 'ONU') {
            const arr = [...onuSerials]
            arr[index] = val
            setOnuSerials(arr)
        } else {
            const arr = [...routerSerials]
            arr[index] = val
            setRouterSerials(arr)
        }
    }

    // --- WHATSAPP GENERATOR ---
    function getWhatsAppText() {
        const teamName = profile.team?.name || "Sin Equipo"
        const dateStr = new Date().toLocaleDateString("es-VE", { timeZone: "America/Caracas" })
        const timeStr = new Date().toLocaleTimeString("es-VE", { timeZone: "America/Caracas", hour: '2-digit', minute: '2-digit', hour12: true })

        const vObj = vehicles.find(v => v.id === selectedVehicle)
        const vehicleStr = vObj ? `${vObj.modelo} (${vObj.placa})` : "No asignado"

        let t = `*Reporte De Entrada ${teamName}*\n`
        t += `*Fecha:* ${dateStr}\n`
        t += `*Hora:* ${timeStr}\n`
        t += `*Nombre De Instaladores:* ${profile.first_name} ${profile.last_name}\n`
        t += `*Vehículo Asignado:* ${vehicleStr}\n\n`

        t += `*ONUS:* ${String(onuSerials.length).padStart(2, '0')}\n`
        if (onuSerials.length > 0) {
            onuSerials.forEach(s => t += `${s}\n`)
        }
        t += `\n`

        t += `*ROUTER:* ${String(routerSerials.length).padStart(2, '0')}\n`
        if (routerSerials.length > 0) {
            routerSerials.forEach(s => t += `${s}\n`)
        }
        t += `\n`

        // Total Installations
        t += `*Total De Instalaciones Realizadas:* ${String(todaysInstallations.length).padStart(2, '0')}\n\n`

        todaysInstallations.forEach((c: any) => {
            t += `${c.cliente}\n`
            t += `${c.cedula || 'S/I'}\n\n`
        })

        // Soportes Count & List
        if (todaysSupports.length > 0) {
            t += `*Total De Soportes Realizados:* ${String(todaysSupports.length).padStart(2, '0')}\n\n`
            todaysSupports.forEach((s: any) => {
                t += `${s.cedula || 'S/I'} - ${s.causa || 'Sin Causa'}\n\n`
            })
        }

        // Materials
        t += `*Conectores Utilizados:*  ${String(materials.conectores_used).padStart(2, '0')}\n`
        t += `*Conectores  Restantes:* ${String(materials.conectores_remaining).padStart(2, '0')}\n`
        t += `*Conectores Defectuosos:* ${String(materials.conectores_defective).padStart(2, '0')}\n`
        t += `*Tensores Utilizados:* ${String(materials.tensores_used).padStart(2, '0')}\n`
        t += `*Tensores Restantes:* ${String(materials.tensores_remaining).padStart(2, '0')}\n`
        t += `*Patchcords Utilizados:* ${String(materials.patchcords_used).padStart(2, '0')}\n`
        t += `*Patchcords Restantes:* ${String(materials.patchcords_remaining).padStart(2, '0')}\n`
        t += `*Rosetas Utilizadas:* ${String(materials.rosetas_used).padStart(2, '0')}\n\n`

        spools.forEach(s => {
            t += `Carrete: ${s.serial}\n`
            t += `Metraje Utilizado: ${s.used}\n`
            t += `Metraje Restante: ${s.remaining}\n\n`
        })

        return t
    }

    const openWhatsApp = () => {
        const text = getWhatsAppText()
        const url = `https://wa.me/?text=${encodeURIComponent(text)}`
        window.open(url, '_blank')
    }

    async function handleSave() {
        const payload = {
            vehicle_id: selectedVehicle === "none" ? null : selectedVehicle,
            onu_serials: onuSerials.filter(s => s.trim().length > 0),
            router_serials: routerSerials.filter(s => s.trim().length > 0),
            materials: materials,
            spools: spools,
            clients_snapshot: todaysInstallations.map((c: any) => ({ client: c.cliente, cedula: c.cedula || 'S/I' }))
        }

        const toastId = toast.loading("Guardando reporte...")
        const res = await saveTechnicianReport(payload)

        if (!res?.success) {
            toast.dismiss(toastId)
            toast.error("Error al guardar: " + res?.error)
            return
        }

        toast.dismiss(toastId)
        toast.success("Guardado exitoso")
        setStep('success')
    }

    // --- RENDER ---

    // 1. SUCCESS VIEW
    if (step === 'success') {
        return (
            <Dialog open={open} onOpenChange={(v) => { if (!v) window.location.reload(); setOpen(v); }}>
                <DialogContent className="max-w-md w-full rounded-[32px] p-0 border-0 bg-white dark:bg-zinc-950 outline-none overflow-hidden">
                    <div className="p-10 flex flex-col items-center justify-center text-center space-y-6 animate-in zoom-in-95 fade-in duration-300">
                        <div className="h-24 w-24 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center text-green-600 dark:text-green-400 animate-in zoom-in spin-in-12 duration-500 delay-100">
                            <CheckCircle size={48} strokeWidth={2.5} />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">¡Reporte Enviado!</h2>
                            <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">El reporte diario se ha guardado correctamente.</p>
                        </div>

                        <div className="w-full space-y-3 pt-6">
                            <Button onClick={openWhatsApp} className="w-full h-14 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-bold text-lg shadow-lg shadow-green-600/20 active:scale-95 transition-all">
                                <Send size={24} className="mr-2" />
                                Abrir WhatsApp
                            </Button>
                            <Button onClick={() => window.location.reload()} variant="ghost" className="w-full h-12 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 font-medium">
                                Cerrar y Actualizar
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        )
    }


    // 2. PREVIEW VIEW
    if (step === 'preview') {
        const text = getWhatsAppText().replace(/\*/g, '')
        return (
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-md w-full max-h-[90vh] flex flex-col rounded-[32px] p-0 border-0 bg-zinc-50 dark:bg-zinc-950 outline-none overflow-hidden">
                    <div className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 sticky top-0 flex justify-between items-center z-10">
                        <Button onClick={() => setStep('form')} variant="ghost" size="icon" className="-ml-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full"><ArrowLeft className="text-zinc-900 dark:text-zinc-100" /></Button>
                        <DialogTitle className="text-base font-bold text-zinc-900 dark:text-zinc-100">Previsualización</DialogTitle>
                        <div className="w-8" />
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 animate-in slide-in-from-right-4 duration-300">
                        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800 text-sm font-mono text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap leading-relaxed">
                            {text}
                        </div>
                    </div>

                    <div className="p-6 bg-white dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-800 z-10 shrink-0">
                        <Button onClick={handleSave} className="w-full h-14 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-bold text-lg shadow-lg shadow-green-600/20 active:scale-[0.98] transition-all">
                            <Send size={20} className="mr-2" /> Confirmar y Guardar
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        )
    }

    // 3. FORM VIEW
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl mt-4 h-14 gap-2 shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] text-lg">
                    <MessageSquare size={22} className="text-white/80" />
                    Reporte Final
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] md:max-w-2xl w-full max-h-[92vh] flex flex-col rounded-[32px] bg-white dark:bg-zinc-950 p-0 border-0 outline-none overflow-hidden">

                {/* Header */}
                <div className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-50 border-b border-zinc-100 dark:border-zinc-800 px-8 py-5 flex items-center justify-between shrink-0">
                    <div>
                        <DialogTitle className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Reporte Diario</DialogTitle>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Verifique los datos antes de enviar</p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-6 md:px-8 py-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

                    {/* VEHICLE */}
                    <section className="space-y-3">
                        <Label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider pl-1">Vehículo Asignado</Label>
                        <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl p-2">
                            <VehicleSelector
                                vehicles={vehicles}
                                selectedVehicleId={selectedVehicle === "none" ? undefined : selectedVehicle}
                                onSelect={(v) => setSelectedVehicle(v ? v.id : "none")}
                                label="Seleccionar Vehículo"
                            />
                        </div>
                    </section>

                    {/* SERIALS */}
                    <section className="space-y-6">
                        {/* ONUs */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center px-1">
                                <Label className="font-bold text-zinc-900 dark:text-zinc-100 text-base">ONUs Instaladas</Label>
                                <div className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-900 p-1.5 rounded-xl border border-zinc-100 dark:border-zinc-800">
                                    <span className="text-[10px] font-bold text-zinc-400 uppercase pl-2">Cant.</span>
                                    <Input type="number" className="h-8 w-14 text-center font-bold text-lg border-0 bg-white dark:bg-zinc-800 shadow-sm rounded-lg focus-visible:ring-0"
                                        value={onuCount} onChange={e => setOnuCount(parseInt(e.target.value) || 0)} />
                                </div>
                            </div>
                            {onuCount > 0 && (
                                <div className="space-y-3 pt-1 animate-in fade-in slide-in-from-top-2">
                                    {onuSerials.map((s, i) => (
                                        <Input
                                            key={i}
                                            value={s}
                                            onChange={e => updateSerial('ONU', i, e.target.value)}
                                            placeholder={`Serial ONU ${i + 1}`}
                                            className="bg-zinc-50 dark:bg-zinc-900 border-0 rounded-xl h-12 text-base placeholder:text-zinc-300 dark:placeholder:text-zinc-600 focus-visible:ring-1 focus-visible:ring-blue-500 transition-all font-medium"
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Routers */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center px-1">
                                <Label className="font-bold text-zinc-900 dark:text-zinc-100 text-base">Routers Instalados</Label>
                                <div className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-900 p-1.5 rounded-xl border border-zinc-100 dark:border-zinc-800">
                                    <span className="text-[10px] font-bold text-zinc-400 uppercase pl-2">Cant.</span>
                                    <Input type="number" className="h-8 w-14 text-center font-bold text-lg border-0 bg-white dark:bg-zinc-800 shadow-sm rounded-lg focus-visible:ring-0"
                                        value={routerCount} onChange={e => setRouterCount(parseInt(e.target.value) || 0)} />
                                </div>
                            </div>
                            {routerCount > 0 && (
                                <div className="space-y-3 pt-1 animate-in fade-in slide-in-from-top-2">
                                    {routerSerials.map((s, i) => (
                                        <Input
                                            key={i}
                                            value={s}
                                            onChange={e => updateSerial('ROUTER', i, e.target.value)}
                                            placeholder={`Serial Router ${i + 1}`}
                                            className="bg-zinc-50 dark:bg-zinc-900 border-0 rounded-xl h-12 text-base placeholder:text-zinc-300 dark:placeholder:text-zinc-600 focus-visible:ring-1 focus-visible:ring-blue-500 transition-all font-medium"
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>

                    {/* SPOOLS */}
                    <section className="space-y-4">
                        <div className="flex justify-between items-center px-1">
                            <Label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Carretes / Bobinas</Label>
                            <Button size="sm" variant="ghost" className="text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 h-8 rounded-lg text-xs font-bold" onClick={addSpool}>
                                <Plus size={16} className="mr-1" /> Añadir
                            </Button>
                        </div>

                        <div className="space-y-3">
                            {spools.map((spool, idx) => (
                                <div key={idx} className="bg-zinc-50 dark:bg-zinc-900/50 p-5 rounded-[24px] border border-zinc-100 dark:border-zinc-800/50 space-y-4 relative group animate-in slide-in-from-bottom-2">
                                    <Button variant="ghost" size="icon" className="absolute top-3 right-3 text-zinc-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeSpool(idx)}>
                                        <Trash2 size={18} />
                                    </Button>

                                    <div className="pr-10">
                                        <Label className="text-[10px] uppercase text-zinc-400 font-bold ml-1 mb-1.5 block">Identificador / Serial</Label>
                                        <Select value={spool.serial} onValueChange={v => updateSpool(idx, 'serial', v)}>
                                            <SelectTrigger className="h-12 border-0 bg-white dark:bg-zinc-800 rounded-xl text-base font-medium shadow-sm"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                            <SelectContent>
                                                {availableSpools.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                                <SelectItem value="OTRO">Manual...</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label className="text-[10px] uppercase text-blue-500 font-bold ml-1 mb-1.5 block">Usado (m)</Label>
                                            <Input type="number" className="bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30 text-blue-700 dark:text-blue-400 h-12 rounded-xl text-base font-bold shadow-sm"
                                                value={spool.used} onChange={e => updateSpool(idx, 'used', parseFloat(e.target.value))} />
                                        </div>
                                        <div>
                                            <Label className="text-[10px] uppercase text-zinc-400 font-bold ml-1 mb-1.5 block">Restante (m)</Label>
                                            <Input type="number" className="bg-white dark:bg-zinc-800 border-0 h-12 rounded-xl text-base shadow-sm font-medium"
                                                value={spool.remaining} onChange={e => updateSpool(idx, 'remaining', parseFloat(e.target.value))} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* MATERIALS */}
                    <section className="space-y-3">
                        <Label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider pl-1">Resumen Materiales</Label>
                        <div className="bg-zinc-50 dark:bg-zinc-900/30 rounded-[24px] border border-zinc-100 dark:border-zinc-800 overflow-hidden p-1">

                            {/* Header Row */}
                            <div className="grid grid-cols-4 gap-2 mb-2 px-4 pt-3 opacity-50">
                                <span className="col-span-1 text-[10px] uppercase font-bold text-zinc-500">Item</span>
                                <span className="text-[10px] uppercase font-bold text-center text-zinc-500">Uso</span>
                                <span className="text-[10px] uppercase font-bold text-center text-zinc-500">Stock</span>
                                <span className="text-[10px] uppercase font-bold text-center text-zinc-500">Malo</span>
                            </div>

                            <div className="space-y-1">
                                {/* Conectores */}
                                <div className="grid grid-cols-4 gap-2 items-center bg-white dark:bg-zinc-900 p-3 rounded-xl shadow-sm">
                                    <span className="font-bold text-sm text-zinc-700 dark:text-zinc-300 pl-1">Conectores</span>
                                    <Input type="number" className="h-9 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-bold border-0 text-center rounded-lg" value={materials.conectores_used} onChange={e => setMaterials({ ...materials, conectores_used: parseFloat(e.target.value) })} />
                                    <Input type="number" className="h-9 bg-zinc-50 dark:bg-zinc-800 border-0 text-center rounded-lg" value={materials.conectores_remaining} onChange={e => setMaterials({ ...materials, conectores_remaining: parseFloat(e.target.value) })} />
                                    <Input type="number" className="h-9 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold border-0 text-center rounded-lg" value={materials.conectores_defective} onChange={e => setMaterials({ ...materials, conectores_defective: parseFloat(e.target.value) })} />
                                </div>

                                {/* Tensores */}
                                <div className="grid grid-cols-4 gap-2 items-center bg-white dark:bg-zinc-900 p-3 rounded-xl shadow-sm">
                                    <span className="font-bold text-sm text-zinc-700 dark:text-zinc-300 pl-1">Tensores</span>
                                    <Input type="number" className="h-9 bg-zinc-50 dark:bg-zinc-800 border-0 text-center rounded-lg" value={materials.tensores_used} onChange={e => setMaterials({ ...materials, tensores_used: parseFloat(e.target.value) })} />
                                    <Input type="number" className="col-span-2 h-9 bg-zinc-50 dark:bg-zinc-800 border-0 text-center rounded-lg" value={materials.tensores_remaining} onChange={e => setMaterials({ ...materials, tensores_remaining: parseFloat(e.target.value) })} />
                                </div>

                                {/* Patchcords */}
                                <div className="grid grid-cols-4 gap-2 items-center bg-white dark:bg-zinc-900 p-3 rounded-xl shadow-sm">
                                    <span className="font-bold text-sm text-zinc-700 dark:text-zinc-300 pl-1">Patchcords</span>
                                    <Input type="number" className="h-9 bg-zinc-50 dark:bg-zinc-800 border-0 text-center rounded-lg" value={materials.patchcords_used} onChange={e => setMaterials({ ...materials, patchcords_used: parseFloat(e.target.value) })} />
                                    <Input type="number" className="col-span-2 h-9 bg-zinc-50 dark:bg-zinc-800 border-0 text-center rounded-lg" value={materials.patchcords_remaining} onChange={e => setMaterials({ ...materials, patchcords_remaining: parseFloat(e.target.value) })} />
                                </div>

                                {/* Rosetas */}
                                <div className="grid grid-cols-4 gap-2 items-center bg-white dark:bg-zinc-900 p-3 rounded-xl shadow-sm">
                                    <span className="font-bold text-sm text-zinc-700 dark:text-zinc-300 pl-1">Rosetas</span>
                                    <Input type="number" className="col-span-3 h-9 bg-zinc-50 dark:bg-zinc-800 border-0 text-center rounded-lg" value={materials.rosetas_used} onChange={e => setMaterials({ ...materials, rosetas_used: parseFloat(e.target.value) })} />
                                </div>
                            </div>
                        </div>
                    </section>

                </div>

                <div className="p-4 bg-white dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-800 shrink-0">
                    <Button onClick={() => setStep('preview')} className="w-full h-14 text-lg font-bold rounded-2xl bg-zinc-900 hover:bg-black dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black shadow-xl shadow-black/5 dark:shadow-white/5 active:scale-[0.98] transition-all">
                        Continuar <ArrowRight className="ml-2" />
                    </Button>
                </div>

            </DialogContent>
        </Dialog>
    )
}
