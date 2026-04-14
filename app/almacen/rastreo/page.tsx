"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Input } from "@/components/ui/input"
import { PremiumCard } from "@/components/ui/premium-card"
import { PremiumPageLayout } from "@/components/ui/premium-page-layout"
import { CardContent } from "@/components/ui/card"
import { Search, Loader2, Package, User, Truck, AlertTriangle, Calendar, ChevronDown, QrCode } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

type TimelineEvent = {
    date: string
    type: 'IN' | 'OUT' | 'ADJUST' | 'ASSIGNMENT' | 'RETURN'
    description: string
    user?: string
    details?: string
    status?: string
    received_by?: string
    receiver_id?: string
    data?: any
}

type SerialResult = {
    serial_number: string
    product_id: string
    product_name: string
    status: string
    created_at: string
    events: TimelineEvent[]
    activeAssignment?: any
}

export default function SerialTrackingPage() {
    const [serial, setSerial] = useState("")
    const [loading, setLoading] = useState(false)
    const [searched, setSearched] = useState(false)
    const [results, setResults] = useState<SerialResult[]>([])
    const [expandedSerial, setExpandedSerial] = useState<string | null>(null)

    const supabase = createClient()

    const handleSearch = async () => {
        if (!serial.trim()) return
        setLoading(true)
        setSearched(true)
        setResults([])
        setExpandedSerial(null)

        try {
            const searchTerm = serial.trim()

            // 1. Search ALL matching serials in master table (supports partial match)
            const { data: masterRecords } = await supabase
                .from("inventory_serials")
                .select("serial_number, product_id, status, created_at, product:inventory_products(name)")
                .ilike("serial_number", `%${searchTerm}%`)
                .order("created_at", { ascending: false })

            if (!masterRecords || masterRecords.length === 0) {
                toast.info("No se encontraron seriales que coincidan con la búsqueda.")
                setLoading(false)
                return
            }

            // 2. For each unique serial, fetch its specific history
            const serialResults: SerialResult[] = []

            for (const record of masterRecords) {
                const { data: historyData } = await supabase
                    .rpc('get_serial_history', { search_term: record.serial_number })
                    .order('created_at', { ascending: false })

                const events = processTimeline(historyData || [])

                // Find active assignment if ASSIGNED
                let activeAssignment = null
                if (record.status === 'ASSIGNED') {
                    const latestAssign = events.find(e => e.type === 'ASSIGNMENT')
                    if (latestAssign?.data) {
                        activeAssignment = {
                            code: latestAssign.data.code,
                            created_at: latestAssign.date,
                            profiles: {
                                first_name: latestAssign.data.assigned_first_name,
                                last_name: latestAssign.data.assigned_last_name,
                                department: latestAssign.data.assigned_department
                            }
                        }
                    }
                }

                serialResults.push({
                    serial_number: record.serial_number,
                    product_id: record.product_id,
                    product_name: (record.product as any)?.name || "Producto desconocido",
                    status: record.status || 'UNKNOWN',
                    created_at: record.created_at,
                    events,
                    activeAssignment,
                })
            }

            setResults(serialResults)

            // Auto-expand if only one result
            if (serialResults.length === 1) {
                setExpandedSerial(`${serialResults[0].serial_number}-${serialResults[0].product_id}`)
            }

        } catch (error) {
            console.error(error)
            toast.error("Error al buscar el serial")
        } finally {
            setLoading(false)
        }
    }

    const processTimeline = (historyData: any[]): TimelineEvent[] => {
        return historyData.map((item: any) => {
            const det = item.details
            const common = { date: item.created_at, id: item.id }

            if (item.source_type === 'TRANSACTION') {
                return {
                    ...common,
                    type: det.type,
                    description: det.reason || (det.type === 'IN' ? 'Entrada / Compra' : 'Movimiento Stock'),
                    user: (det.user_first_name || det.user_last_name) ? `${det.user_first_name} ${det.user_last_name}` : 'Sistema',
                    details: `Stock: ${det.previous_stock} → ${det.new_stock}`,
                    data: det
                }
            } else if (item.source_type === 'ASSIGNMENT') {
                const assignedName = (det.assigned_first_name || det.assigned_last_name)
                    ? `${det.assigned_first_name} ${det.assigned_last_name}`
                    : 'Sin asignar'
                return {
                    ...common,
                    type: 'ASSIGNMENT',
                    description: `Asignación: ${det.code}`,
                    user: assignedName,
                    details: det.assigned_department || 'Instalación',
                    status: det.status,
                    received_by: det.received_by,
                    receiver_id: det.receiver_id,
                    data: det
                }
            } else {
                const returnUser = (det.user_first_name || det.user_last_name)
                    ? `${det.user_first_name} ${det.user_last_name}`
                    : 'Sistema'
                return {
                    ...common,
                    type: 'RETURN',
                    description: `Devuelto (${det.condition === 'GOOD' ? 'Buen Estado' : det.condition === 'CONSUMED' ? 'Consumido/Instalado' : det.condition === 'MISSING' ? 'Pérdida/Extravío' : 'Dañado'})`,
                    user: returnUser,
                    details: det.notes || 'Devolución',
                    data: det
                }
            }
        }) as TimelineEvent[]
    }

    const getStatusConfig = (status: string, events: TimelineEvent[]) => {
        if (status === 'SOLD') {
            const lastEvent = events[0]
            if (lastEvent) {
                const desc = lastEvent.description.toUpperCase()
                if (desc.includes('PERDIDA') || desc.includes('ROBO')) return { class: 'bg-red-500', text: 'PÉRDIDA', border: 'border-red-500/30', bg: 'bg-red-500/10' }
                if (desc.includes('BAJA') || desc.includes('DESCONTINUADO')) return { class: 'bg-red-500', text: 'BAJA / DESECHO', border: 'border-red-500/30', bg: 'bg-red-500/10' }
                if (desc.includes('CONSUMO') || desc.includes('INSTALADO')) return { class: 'bg-blue-500', text: 'CONSUMIDO', border: 'border-blue-500/30', bg: 'bg-blue-500/10' }
            }
            return { class: 'bg-gray-500', text: 'VENDIDO / SALIDA', border: 'border-border', bg: 'bg-muted/50' }
        }
        if (status === 'AVAILABLE') return { class: 'bg-emerald-500', text: 'EN STOCK', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10' }
        if (status === 'ASSIGNED') return { class: 'bg-blue-500', text: 'EN USO', border: 'border-blue-500/30', bg: 'bg-blue-500/10' }
        if (status === 'RETURNED') return { class: 'bg-purple-500', text: 'DEVUELTO', border: 'border-purple-500/30', bg: 'bg-purple-500/10' }
        if (status === 'LOST') return { class: 'bg-red-500', text: 'PÉRDIDA', border: 'border-red-500/30', bg: 'bg-red-500/10' }
        if (status === 'DAMAGED') return { class: 'bg-orange-500', text: 'DAÑADO', border: 'border-orange-500/30', bg: 'bg-orange-500/10' }
        return { class: 'bg-zinc-500', text: status, border: 'border-border', bg: 'bg-muted/50' }
    }

    const toggleExpand = (key: string) => {
        setExpandedSerial(prev => prev === key ? null : key)
    }

    return (
        <PremiumPageLayout 
            title="Rastreo de Seriales" 
            description="Busca la historia completa de un item específico"
            backUrl="/almacen"
            backLabel="Volver a Almacén"
        >
            <div className="space-y-6">

            {/* Search Bar */}
            <PremiumCard className="p-0 overflow-hidden" wrapperClassName="h-auto">
                <div className="p-1 bg-muted border-b border-border"></div>
                <CardContent className="p-6">
                    <div className="flex gap-2 max-w-xl mx-auto">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                            <Input
                                placeholder="Ingrese Número de Serie..."
                                className="pl-10 h-11 text-lg font-mono bg-background"
                                value={serial}
                                onChange={(e) => setSerial(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            />
                        </div>
                        <Button size="lg" onClick={handleSearch} disabled={loading} className="h-11 px-8 gap-2">
                            {loading ? <Loader2 className="animate-spin" /> : "Rastrear"}
                        </Button>
                    </div>

                    {/* Results Count */}
                    {searched && !loading && (
                        <div className="mt-4 text-center">
                            <span className="text-sm text-muted-foreground">
                                {results.length === 0 
                                    ? "No se encontraron resultados" 
                                    : `${results.length} serial${results.length > 1 ? 'es' : ''} encontrado${results.length > 1 ? 's' : ''}`
                                }
                            </span>
                        </div>
                    )}
                </CardContent>
            </PremiumCard>

            {/* Results: Individual cards per serial */}
            {results.length > 0 && (
                <div className="space-y-4">
                    {results.map((result) => {
                        const key = `${result.serial_number}-${result.product_id}`
                        const isExpanded = expandedSerial === key
                        const statusCfg = getStatusConfig(result.status, result.events)

                        return (
                            <div key={key} className="space-y-0">
                                {/* Serial Header Card */}
                                <PremiumCard className="p-0 overflow-hidden" wrapperClassName="h-auto">
                                    <div 
                                        onClick={() => toggleExpand(key)}
                                        className={`p-5 cursor-pointer hover:bg-muted/30 transition-all border-l-4 ${statusCfg.border}`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className={`h-12 w-12 rounded-xl ${statusCfg.bg} flex items-center justify-center shrink-0`}>
                                                    <QrCode size={24} className={statusCfg.class.replace('bg-', 'text-')} />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-mono font-bold text-lg text-foreground">{result.serial_number}</span>
                                                        <Badge className={`text-xs px-2 py-0 ${statusCfg.class}`}>
                                                            {statusCfg.text}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <Package size={14} className="text-muted-foreground" />
                                                        <span className="text-muted-foreground">{result.product_name}</span>
                                                    </div>

                                                    {/* Active Assignment Summary (inline) */}
                                                    {result.activeAssignment && (
                                                        <div className="flex items-center gap-2 mt-1.5 text-xs text-blue-500">
                                                            <User size={12} />
                                                            <span className="font-medium">
                                                                {result.activeAssignment.profiles?.first_name} {result.activeAssignment.profiles?.last_name}
                                                            </span>
                                                            <span className="text-muted-foreground">•</span>
                                                            <Truck size={12} />
                                                            <span className="font-mono">{result.activeAssignment.code}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <span className="text-xs text-muted-foreground hidden sm:block">
                                                    {result.events.length} evento{result.events.length !== 1 ? 's' : ''}
                                                </span>
                                                <ChevronDown 
                                                    size={20} 
                                                    className={`text-muted-foreground transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} 
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded: Timeline for THIS serial */}
                                    {isExpanded && (
                                        <div className="border-t border-border bg-muted/20 animate-in fade-in slide-in-from-top-2 duration-300">
                                            {result.events.length > 0 ? (
                                                <div className="relative border-l-2 border-border ml-10 my-4 mr-4 space-y-6 pb-2">
                                                    {result.events.map((event, index) => (
                                                        <div key={index} className="relative pl-6">
                                                            {/* Timeline Dot */}
                                                            <div className={`absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-background shadow-sm
                                                                ${event.type === 'IN' ? 'bg-green-500' :
                                                                    event.type === 'OUT' || event.type === 'ASSIGNMENT' ? 'bg-blue-500' :
                                                                        event.type === 'RETURN' ? 'bg-purple-500' : 'bg-muted-foreground'}
                                                            `} />

                                                            <div className="bg-background/80 rounded-lg border border-border p-3">
                                                                <div className="flex justify-between items-start mb-2">
                                                                    <div>
                                                                        <div className="flex items-center gap-2 mb-0.5">
                                                                            <Badge variant="outline" className={`font-mono text-[10px] px-1.5 py-0
                                                                                ${event.type === 'IN' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                                                                                    event.type === 'OUT' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                                                                                        event.type === 'ASSIGNMENT' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                                                                                            event.type === 'RETURN' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' :
                                                                                                'bg-muted text-foreground'}
                                                                            `}>
                                                                                {event.type === 'IN' ? 'ENTRADA' :
                                                                                    event.type === 'OUT' ? 'SALIDA' :
                                                                                        event.type === 'ASSIGNMENT' ? 'DESPACHO' :
                                                                                            event.type === 'RETURN' ? 'DEVOLUCIÓN' :
                                                                                                event.type === 'ADJUST' ? 'AJUSTE' :
                                                                                                    event.type}
                                                                            </Badge>
                                                                            <span className="text-[11px] text-muted-foreground">
                                                                                {new Date(event.date).toLocaleDateString()} {new Date(event.date).toLocaleTimeString()}
                                                                            </span>
                                                                        </div>
                                                                        <h4 className="font-semibold text-sm text-foreground">{event.description}</h4>
                                                                    </div>
                                                                    {event.status && (
                                                                        <Badge variant="secondary" className={`text-[10px] ${event.status === 'ACTIVE' ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'}`}>
                                                                            {event.status === 'ACTIVE' ? 'Activo' : event.status}
                                                                        </Badge>
                                                                    )}
                                                                </div>

                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 bg-muted/40 p-2.5 rounded-md border border-border">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="p-1.5 bg-background rounded-full border border-border text-muted-foreground">
                                                                            <User size={12} />
                                                                        </div>
                                                                        <div className="flex flex-col">
                                                                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Responsable</span>
                                                                            <span className="text-xs font-medium text-foreground">{event.user}</span>
                                                                        </div>
                                                                    </div>

                                                                    {event.details && (
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="p-1.5 bg-background rounded-full border border-border text-muted-foreground">
                                                                                <AlertTriangle size={12} />
                                                                            </div>
                                                                            <div className="flex flex-col">
                                                                                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Detalles</span>
                                                                                <span className="text-xs font-medium text-foreground">{event.details}</span>
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {(event.received_by || event.receiver_id) && (
                                                                        <div className="col-span-1 sm:col-span-2 mt-1 pt-2 border-t border-border flex items-center gap-2">
                                                                            <div className="p-1.5 bg-orange-500/10 rounded-full border border-orange-500/20 text-orange-500">
                                                                                <Truck size={12} />
                                                                            </div>
                                                                            <div className="flex flex-col">
                                                                                <span className="text-[10px] text-orange-500 uppercase font-bold tracking-wider">Recibido por (Tercero)</span>
                                                                                <div className="flex items-baseline gap-2">
                                                                                    <span className="text-xs font-medium text-foreground">{event.received_by || "Desconocido"}</span>
                                                                                    {event.receiver_id && (
                                                                                        <span className="text-[10px] text-muted-foreground bg-muted px-1 py-0.5 rounded">ID: {event.receiver_id}</span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-center py-8 text-muted-foreground">
                                                    <p className="text-sm">Sin historial de movimientos registrado.</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </PremiumCard>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Empty State */}
            {searched && !loading && results.length === 0 && (
                <div className="text-center py-12 bg-muted/50 rounded-2xl border border-dashed border-border">
                    <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium text-foreground">Serial no encontrado</h3>
                    <p className="text-muted-foreground max-w-sm mx-auto mt-2">
                        No hay registros de este número de serie en el sistema. Verifique que esté escrito correctamente.
                    </p>
                </div>
            )}
            </div>
        </PremiumPageLayout>
    )
}
