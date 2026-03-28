"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { getAuditData, saveAudit, getAuditInstallations } from "../../actions"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { toast } from "sonner"
import { CheckCircle2, AlertOctagon, ArrowLeft, Save, AlertTriangle, Box, Wifi, Cloud } from "lucide-react"

export default function AuditPage() {
    const params = useParams()
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<any>(null)
    const [counts, setCounts] = useState<Record<string, number>>({})
    const [reconcile, setReconcile] = useState(false)
    const [notes, setNotes] = useState("")
    const [installations, setInstallations] = useState<any[]>([])

    useEffect(() => {
        async function load() {
            try {
                const res = await getAuditData(params.id as string)
                setData(res)

                // Initialize counts from loaded stock (preserves saved physicals)
                const initialCounts: Record<string, number> = {}
                res.stock.forEach((item: any) => {
                    if (item.physical !== undefined && item.physical !== null) {
                        initialCounts[item.sku] = item.physical
                    }
                })
                setCounts(initialCounts)

                // Fetch Installations if date is available
                if (res.created_at) {
                    const date = new Date(res.created_at)
                    const minDate = new Date(date)
                    minDate.setHours(0, 0, 0, 0)
                    const maxDate = new Date(date)
                    maxDate.setHours(23, 59, 59, 999)

                    // If Team, likely need separate logic, but defaulting to single entity check for now
                    // Or assuming res.technician.id is the Profile ID if Type is User
                    if (res.technician?.type !== 'TEAM') {
                        const installs = await getAuditInstallations(res.technician.id, minDate.toISOString(), maxDate.toISOString())
                        setInstallations(installs || [])
                    } else if (res.technician?.members) {
                        // Parallel fetch for all members
                        const allInstalls = await Promise.all(res.technician.members.map((mId: string) =>
                            getAuditInstallations(mId, minDate.toISOString(), maxDate.toISOString())
                        ))
                        setInstallations(allInstalls.flat())
                    }
                }
            } catch (e: any) {
                toast.error("Error cargando auditoría: " + e.message)
            } finally {
                setLoading(false)
            }
        }
        if (params.id) load()
    }, [params.id])

    const handleSave = async () => {
        try {
            setLoading(true)
            const auditPayload = {
                auditId: data?.auditId,
                entityId: data.technician.id,
                entityType: data.technician.type,
                members: data.technician.members,
                notes,
                reconcileStock: reconcile,
                items: data.stock.map((item: any) => ({
                    sku: item.sku,
                    name: item.name,
                    productId: item.productId,
                    theoretical: (item.assigned - item.reported),
                    physical: counts[item.sku] !== undefined ? counts[item.sku] : 0
                }))
            }
            const res = await saveAudit(auditPayload)

            toast.success(data?.auditId ? "Auditoría actualizada." : "Auditoría creada.")

            router.push("/control")
        } catch (e: any) {
            toast.error("Error guardando: " + e.message)
        } finally {
            setLoading(false)
        }
    }

    const calculateDiff = (theoretical: number, physical: number) => {
        return physical - theoretical
    }

    const handleCountChange = (sku: string, value: string) => {
        if (value === "") {
            setCounts(prev => {
                const newCounts = { ...prev }
                delete newCounts[sku]
                return newCounts
            })
            return
        }
        const num = parseFloat(value)
        setCounts(prev => ({
            ...prev,
            [sku]: isNaN(num) ? 0 : num
        }))
    }

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50/50 text-slate-400">Cargando datos de auditoría...</div>

    return (
        <div className="min-h-screen bg-slate-50/50 p-6 md:p-10 pb-32">
            {/* HEADER */}
            <div className="max-w-5xl mx-auto mb-8">
                {/* ... existing header ... */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <Button onClick={() => router.push("/control")} variant="ghost" size="icon" className="rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/50">
                                <ArrowLeft size={24} />
                            </Button>
                            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Auditoría de Stock</h1>
                        </div>
                        <div className="flex flex-col ml-2">
                            <p className="text-slate-500">
                                Verificando a <span className="font-bold text-slate-800">{data?.technician?.first_name}</span>
                            </p>
                            {data?.technician?.type === 'TEAM' && data?.technician?.members && (
                                <p className="text-xs text-slate-400 mt-1">
                                    Miembros: {data.technician.members.map((m: any) => `${m.first_name} ${m.last_name}`).join(", ")}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto space-y-6">

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

                    {/* LEFT COLUMN: STOCK AUDIT */}
                    <div className="space-y-6">

                        {/* MATERIALS LIST (GROUPED) */}
                        <div className="space-y-8">
                            {(() => {
                                const groups: Record<string, any[]> = {}
                                data?.stock.forEach((item: any) => {
                                    const key = item.notes || "Cierre Inicial"
                                    if (!groups[key]) groups[key] = []
                                    groups[key].push(item)
                                })

                                // Sort groups: "Cierre Inicial" first, then others by name
                                const sortedGroups = Object.entries(groups).sort((a, b) => {
                                    if (a[0] === "Cierre Inicial") return -1
                                    if (b[0] === "Cierre Inicial") return 1
                                    return a[0].localeCompare(b[0])
                                })

                                // Default open: The last group (most recent)
                                const lastGroup = sortedGroups.length > 0 ? sortedGroups[sortedGroups.length - 1][0] : undefined

                                return (
                                    <Accordion type="single" collapsible defaultValue={lastGroup} className="w-full space-y-4">
                                        {sortedGroups.map(([groupName, items]) => (
                                            <AccordionItem key={groupName} value={groupName} className="bg-white dark:bg-slate-900 rounded-3xl border-slate-200 px-6 shadow-sm data-[state=open]:ring-2 data-[state=open]:ring-blue-100 transition-all">
                                                <AccordionTrigger className="hover:no-underline py-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`h-3 w-3 rounded-full ${groupName === 'Cierre Inicial' ? 'bg-blue-500' : 'bg-purple-500'}`}></div>
                                                        <div className="text-left">
                                                            <h2 className="font-bold text-lg text-slate-800">{groupName}</h2>
                                                            <p className="text-xs text-slate-400 font-medium mt-0.5">{items.length} ítems registrados</p>
                                                        </div>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="pb-6 pt-2">
                                                    <div className="grid gap-4">
                                                        {items.map((item: any, idx: number) => {
                                                            const theoretical = item.assigned - item.reported
                                                            const physical = counts[item.sku] ?? 0
                                                            const diff = calculateDiff(theoretical, physical)
                                                            const hasInput = counts[item.sku] !== undefined

                                                            return (
                                                                <div key={`${item.sku}-${idx}`} className="bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-100 flex flex-col md:flex-row items-center gap-6">
                                                                    {/* ICON & INFO */}
                                                                    <div className="flex items-center gap-4 flex-1 w-full">
                                                                        <div className="h-12 w-12 rounded-2xl bg-white text-slate-500 flex items-center justify-center shadow-sm">
                                                                            <Box size={24} />
                                                                        </div>
                                                                        <div>
                                                                            <h3 className="font-bold text-lg text-slate-900">{item.name}</h3>
                                                                            <p className="text-xs text-slate-400 font-mono">{item.sku}</p>

                                                                            {item.serials && item.serials.length > 0 && (
                                                                                <div className="mt-2 flex flex-wrap gap-1">
                                                                                    {item.serials.map((s: string) => (
                                                                                        <span key={s} className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-blue-100 text-blue-700">
                                                                                            {s}
                                                                                        </span>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    {/* STATS */}
                                                                    <div className="flex items-center gap-2 md:gap-8 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                                                                        <div className="text-center min-w-[60px] md:min-w-[80px]">
                                                                            <p className="text-[9px] md:text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Reportado</p>
                                                                            <p className="font-medium text-slate-600 text-sm md:text-base">{item.reported}</p>
                                                                        </div>
                                                                        {/* HIDDEN THEORETICAL AS REQUESTED */}
                                                                        {/* <div className="text-center min-w-[80px] bg-white p-2 rounded-xl border border-blue-100 shadow-sm">
                                                                    <p className="text-[10px] uppercase tracking-wider text-blue-500 font-bold mb-1">Teórico</p>
                                                                    <p className={`font-bold text-xl ${theoretical < 0 ? 'text-red-500' : 'text-blue-700'}`}>{theoretical}</p>
                                                                </div> */}
                                                                    </div>

                                                                    {/* INPUT ACTION */}
                                                                    <div className="flex items-center gap-4 w-full md:w-auto border-t md:border-t-0 pt-4 md:pt-0 mt-2 md:mt-0 md:pl-6 md:border-l border-slate-200">
                                                                        <div className="text-right">
                                                                            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Físico</p>
                                                                            <div className="relative">
                                                                                <Input
                                                                                    type="number"
                                                                                    className="w-24 text-center font-bold text-lg h-12 rounded-xl bg-white border-slate-200 focus:ring-blue-500/20 shadow-sm"
                                                                                    placeholder="0"
                                                                                    value={counts[item.sku] === undefined ? "" : counts[item.sku]}
                                                                                    onFocus={(e) => e.target.select()}
                                                                                    onChange={(e) => handleCountChange(item.sku, e.target.value)}
                                                                                />
                                                                                {item.sku === 'CARRETE' && <span className="absolute -bottom-4 right-0 text-[9px] text-slate-400">metros</span>}
                                                                            </div>
                                                                        </div>

                                                                        {/* STATUS BADGE */}
                                                                        <div className="w-[100px] flex justify-center">
                                                                            {hasInput && diff === 0 && (
                                                                                <div className="flex flex-col items-center text-emerald-500 animate-in fade-in zoom-in duration-300">
                                                                                    <CheckCircle2 size={28} />
                                                                                    <span className="text-[10px] font-bold mt-1">Correcto</span>
                                                                                </div>
                                                                            )}
                                                                            {hasInput && diff !== 0 && (
                                                                                <div className={`flex flex-col items-center animate-in fade-in zoom-in duration-300 ${diff < 0 ? "text-red-500" : "text-amber-500"}`}>
                                                                                    <AlertOctagon size={28} />
                                                                                    <span className="text-[10px] font-bold mt-1">
                                                                                        {diff > 0 ? `Sobra ${diff}` : `Falta ${Math.abs(diff)}`}
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                            {!hasInput && (
                                                                                <div className="h-2 w-2 rounded-full bg-slate-200" />
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                )
                            })()}
                        </div>
                    </div>

                    {/* RIGHT COLUMN: INSTALLATIONS & NOTES */}
                    <div className="space-y-6">

                        {/* INSTALLATIONS CARD */}
                        <Card className="border-slate-200 bg-white dark:bg-slate-900 shadow-sm rounded-2xl overflow-hidden">
                            <CardHeader className="bg-slate-50/50 pb-4 border-b border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center">
                                        <Wifi size={20} />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg font-bold text-slate-900">Instalaciones Realizadas</CardTitle>
                                        <CardDescription className="text-xs">
                                            {installations.length} reportes en este turno
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                {installations.length === 0 ? (
                                    <div className="p-8 text-center">
                                        <Cloud className="mx-auto h-10 w-10 text-slate-200 mb-2" />
                                        <p className="text-sm text-slate-400">Sin instalaciones registradas hoy.</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-100">
                                        {installations.map((inst) => (
                                            <div key={inst.id} className="p-4 hover:bg-slate-50 transition-colors">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div>
                                                        <h4 className="font-bold text-slate-800 text-sm">{inst.cliente?.nombre || "Cliente Desconocido"}</h4>
                                                        <p className="text-xs text-slate-500 font-medium">{inst.cliente?.plan || "Plan N/A"} • {inst.cliente?.onu}</p>
                                                        <p className="text-[10px] text-slate-400 mt-1">{inst.cliente?.direccion}</p>
                                                    </div>
                                                    <span className="text-[10px] font-mono text-slate-300">
                                                        {new Date(inst.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>

                                                {/* Material Usage Grid */}
                                                <div className="grid grid-cols-4 gap-2 mt-3">
                                                    {inst.metraje_usado > 0 && (
                                                        <div className="bg-slate-100 rounded p-1.5 text-center">
                                                            <span className="block text-[8px] uppercase text-slate-500 font-bold tracking-wider">Cable</span>
                                                            <span className="text-xs font-bold text-slate-700">{inst.metraje_usado}m</span>
                                                        </div>
                                                    )}
                                                    {inst.conectores > 0 && (
                                                        <div className="bg-slate-100 rounded p-1.5 text-center">
                                                            <span className="block text-[8px] uppercase text-slate-500 font-bold tracking-wider">Conv</span>
                                                            <span className="text-xs font-bold text-slate-700">{inst.conectores}</span>
                                                        </div>
                                                    )}
                                                    {inst.tensores > 0 && (
                                                        <div className="bg-slate-100 rounded p-1.5 text-center">
                                                            <span className="block text-[8px] uppercase text-slate-500 font-bold tracking-wider">Tens</span>
                                                            <span className="text-xs font-bold text-slate-700">{inst.tensores}</span>
                                                        </div>
                                                    )}
                                                    {inst.rosetas === "Si" && (
                                                        <div className="bg-slate-100 rounded p-1.5 text-center">
                                                            <span className="block text-[8px] uppercase text-slate-500 font-bold tracking-wider">Roseta</span>
                                                            <span className="text-xs font-bold text-emerald-600">SI</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* NOTES CARD (Moved here) */}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <AlertTriangle size={18} className="text-slate-400" />
                                Observaciones
                            </h3>
                            <textarea
                                className="w-full min-h-[100px] p-4 rounded-xl bg-slate-50 border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                                placeholder="Escribe aquí si hubo material dañado, carretes vacíos, o justificaciones..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        </div>

                    </div>

                </div>
            </div>

            {/* FLOATING FOOTER ACTION (Responsive) */}
            <div className="fixed bottom-0 left-0 right-0 py-3 px-4 md:p-6 bg-white/90 backdrop-blur-xl border-t border-slate-200 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 md:gap-0">
                    <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
                        <p className="hidden md:block text-sm font-semibold text-slate-900">Resumen</p>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="reconcile"
                                checked={reconcile}
                                onChange={(e) => setReconcile(e.target.checked)}
                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                            <label htmlFor="reconcile" className="text-xs text-slate-600 cursor-pointer select-none">
                                Ajustar inventario (Reconciliar)
                            </label>
                        </div>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <Button variant="outline" className="flex-1 md:flex-none rounded-xl h-10 md:h-12 px-4 md:px-6 border-slate-200 text-slate-600 hover:bg-slate-100 text-xs md:text-sm" onClick={() => router.push("/control")}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSave} disabled={loading} className="flex-1 md:flex-none rounded-xl h-10 md:h-12 px-6 md:px-8 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20 text-white font-semibold text-xs md:text-sm">
                            {loading ? "Guardando..." : <><Save className="mr-2 h-4 w-4" /> Finalizar</>}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
