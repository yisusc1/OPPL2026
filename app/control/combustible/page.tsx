"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import Link from "next/link"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Filter, Fuel, Calendar, Gauge, CreditCard, DollarSign, Droplet, User, Car, FileText, X } from "lucide-react"
import { PremiumPageLayout } from "@/components/ui/premium-page-layout"
import { PremiumCard } from "@/components/ui/premium-card"
import { PremiumContent } from "@/components/ui/premium-content"
import { getFuelLogs } from "./actions"
import Image from "next/image"

type FuelLog = {
    id: string
    created_at: string
    vehicle_id: string
    driver_name: string
    mileage: number
    liters: number
    cost_usd: number
    payment_method?: string
    station_name?: string
    full_tank?: boolean
    efficiency: number | null
    ticket_url?: string
    notes?: string
    vehicle: {
        placa: string
        modelo: string
        codigo: string
        tipo: string
    }
    supervisor: {
        first_name: string
        last_name: string
    }
}

export default function CombustiblePage() {
    const [logs, setLogs] = useState<FuelLog[]>([])
    const [loading, setLoading] = useState(true)
    const [vehicles, setVehicles] = useState<any[]>([])
    const [selectedVehicle, setSelectedVehicle] = useState<string>("all")

    // Dialog State
    const [selectedLog, setSelectedLog] = useState<FuelLog | null>(null)
    const [isDetailsOpen, setIsDetailsOpen] = useState(false)

    useEffect(() => {
        loadData()
    }, [selectedVehicle])

    async function loadData() {
        setLoading(true)
        const supabase = createClient()

        // Fetch Vehicles for Filter
        const { data: vData } = await supabase.from('vehiculos').select('id, placa, modelo').order('modelo')
        if (vData) setVehicles(vData)

        // Fetch Fuel Logs via Server Action
        try {
            const data = await getFuelLogs({
                vehicleId: selectedVehicle !== "all" ? selectedVehicle : undefined
            })
            setLogs(data as any[])
        } catch (error) {
            console.error('Error loading fuel logs:', error)
        }

        setLoading(false)
    }

    // Calculations for Summary Cards
    // Fallback to calculation if cost_usd is missing (old records)
    // IMPORTANT: Make sure to handle null/undefined correctly
    const totalCost = logs.reduce((acc, log) => {
        const cost = log.cost_usd || (log.liters * 0.5)
        return acc + cost
    }, 0)

    const totalLiters = logs.reduce((acc, log) => acc + (log.liters || 0), 0)

    // Efficiency calculation (simplistic)
    const avgEfficiency = logs.filter(l => l.efficiency).reduce((acc, log) => acc + (log.efficiency || 0), 0) / (logs.filter(l => l.efficiency).length || 1)

    const handleLogClick = (log: FuelLog) => {
        setSelectedLog(log)
        setIsDetailsOpen(true)
    }

    return (
        <PremiumPageLayout title="Control de Combustible" description="Registro y Análisis de Consumo">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* TOOLBAR */}
                <PremiumContent className="p-4 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <Filter className="text-muted-foreground" size={20} />
                        <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                            <SelectTrigger className="w-full md:w-[280px] bg-white/5 border-white/10 rounded-xl h-10">
                                <SelectValue placeholder="Filtrar por vehículo" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los vehículos</SelectItem>
                                {vehicles.map(v => (
                                    <SelectItem key={v.id} value={v.id}>{v.modelo} ({v.placa})</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex w-full md:w-auto gap-2">
                        <Link href="/control/combustible/scan">
                            <Button variant="outline" className="w-full md:w-auto h-10 rounded-xl bg-white/5 border-white/10 hover:bg-white/10">
                                <div className="mr-2 h-4 w-4">
                                    {/* QR Icon */}
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect width="5" height="5" x="3" y="3" rx="1" />
                                        <rect width="5" height="5" x="16" y="3" rx="1" />
                                        <rect width="5" height="5" x="3" y="16" rx="1" />
                                        <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
                                        <path d="M21 21v.01" />
                                        <path d="M12 7v3a2 2 0 0 1-2 2H7" />
                                        <path d="M3 12h.01" />
                                        <path d="M12 3h.01" />
                                        <path d="M12 16v.01" />
                                        <path d="M16 12h1" />
                                        <path d="M21 12v.01" />
                                        <path d="M12 21v-1" />
                                    </svg>
                                </div>
                                Escanear QR
                            </Button>
                        </Link>
                        <Link href="/control/combustible/new">
                            <Button className="w-full md:w-auto h-10 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold shadow-lg shadow-emerald-500/20">
                                <Fuel className="mr-2 h-4 w-4" />
                                Registrar Ticket
                            </Button>
                        </Link>
                    </div>
                </PremiumContent>

                {/* KPI CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <PremiumCard className="p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-green-500/10 rounded-2xl text-green-500"><DollarSign size={24} /></div>
                        </div>
                        <div className="text-3xl font-bold text-foreground tracking-tight">${totalCost.toFixed(2)}</div>
                        <div className="text-sm text-muted-foreground font-medium mt-1">Gasto Total (Periodo)</div>
                    </PremiumCard>

                    <PremiumCard className="p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500"><Droplet size={24} /></div>
                        </div>
                        <div className="text-3xl font-bold text-foreground tracking-tight">{totalLiters.toFixed(1)} L</div>
                        <div className="text-sm text-muted-foreground font-medium mt-1">Consumo Total</div>
                    </PremiumCard>
                </div>

                {/* DESKTOP TABLE */}
                <div className="hidden md:block">
                    <PremiumContent className="p-0 overflow-hidden">
                        <Table>
                            <TableHeader className="bg-white/5">
                                <TableRow className="hover:bg-transparent border-white/5">
                                    <TableHead className="text-muted-foreground font-bold pl-6">Fecha</TableHead>
                                    <TableHead className="text-muted-foreground font-bold">Vehículo</TableHead>
                                    <TableHead className="text-muted-foreground font-bold">Conductor</TableHead>
                                    <TableHead className="text-muted-foreground font-bold">Litros</TableHead>
                                    <TableHead className="text-muted-foreground font-bold">Costo</TableHead>
                                    <TableHead className="text-muted-foreground font-bold pr-6">Km Actual</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">
                                            Cargando registros...
                                        </TableCell>
                                    </TableRow>
                                ) : logs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                            No hay registros encontrados
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    logs.map((log) => (
                                        <TableRow
                                            key={log.id}
                                            className="border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                                            onClick={() => handleLogClick(log)}
                                        >
                                            <TableCell className="pl-6 font-medium">
                                                <div className="flex items-center gap-2">
                                                    <Calendar size={14} className="text-muted-foreground" />
                                                    {new Date(log.created_at).toLocaleDateString()}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-foreground">{log.vehicle?.modelo}</span>
                                                    <span className="text-xs text-muted-foreground font-mono">{log.vehicle?.placa}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm">{log.driver_name || (log.supervisor?.first_name + ' ' + log.supervisor?.last_name)}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                                                    {log.liters} L
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-bold text-green-500">
                                                ${(log.cost_usd || (log.liters * 0.5)).toFixed(2)}
                                            </TableCell>
                                            <TableCell className="pr-6 font-mono text-muted-foreground">
                                                {log.mileage.toLocaleString()} km
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </PremiumContent>
                </div>

                {/* MOBILE LIST */}
                <div className="md:hidden space-y-4">
                    {loading ? (
                        <div className="text-center py-8 text-muted-foreground">Cargando...</div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">No hay registros</div>
                    ) : (
                        logs.map((log) => (
                            <PremiumCard
                                key={log.id}
                                className="p-4 active:scale-[0.98] transition-transform cursor-pointer"
                                onClick={() => handleLogClick(log)}
                            >
                                <div className="flex justify-between items-start mb-4 border-b border-white/5 pb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 bg-muted rounded-full flex items-center justify-center">
                                            <Car size={18} className="opacity-70" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-foreground">{log.vehicle?.modelo}</h4>
                                            <p className="text-xs text-muted-foreground font-mono">{log.vehicle?.placa}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-bold text-green-500">
                                            ${(log.cost_usd || (log.liters * 0.5)).toFixed(2)}
                                        </div>
                                        <div className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleDateString()}</div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div className="flex items-center gap-2">
                                        <Droplet size={14} className="text-blue-500" />
                                        <span>{log.liters} Litros</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Gauge size={14} className="text-purple-500" />
                                        <span>{log.mileage ? `${log.mileage.toLocaleString()} km` : '-'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 col-span-2 text-muted-foreground">
                                        <User size={14} />
                                        <span>{log.driver_name || (log.supervisor?.first_name)}</span>
                                    </div>
                                </div>
                            </PremiumCard>
                        ))
                    )}
                </div>
            </div>

            {/* DETAILS DIALOG */}
            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="sm:max-w-md bg-zinc-950 border-white/10 text-white p-0 overflow-hidden">
                    {selectedLog && (
                        <>
                            <div className="relative h-48 w-full bg-zinc-900 border-b border-white/10">
                                {selectedLog.ticket_url ? (
                                    <div className="relative h-full w-full group">
                                        <Image
                                            src={selectedLog.ticket_url}
                                            alt="Ticket"
                                            fill
                                            className="object-cover"
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <Link href={selectedLog.ticket_url} target="_blank">
                                                <Button variant="secondary" size="sm">Ver tamaño completo</Button>
                                            </Link>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-2">
                                        <FileText size={40} className="opacity-20" />
                                        <span className="text-sm">Sin imagen de ticket</span>
                                    </div>
                                )}
                                <Button
                                    className="absolute top-2 right-2 rounded-full w-8 h-8 p-0 bg-black/50 hover:bg-black/70 text-white backdrop-blur-md"
                                    onClick={() => setIsDetailsOpen(false)}
                                >
                                    <X size={14} />
                                </Button>
                            </div>

                            <div className="p-6">
                                <DialogHeader>
                                    <DialogTitle className="text-xl font-bold flex justify-between items-center">
                                        <span>{selectedLog.vehicle?.modelo}</span>
                                        <Badge variant="outline" className="text-green-500 border-green-500/20 bg-green-500/10">
                                            ${(selectedLog.cost_usd || (selectedLog.liters * 0.5)).toFixed(2)}
                                        </Badge>
                                    </DialogTitle>
                                    <DialogDescription className="text-muted-foreground font-mono">
                                        {selectedLog.vehicle?.placa}
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="grid grid-cols-2 gap-4 mt-6">
                                    <div className="space-y-1">
                                        <span className="text-xs text-muted-foreground uppercase font-bold">Fecha</span>
                                        <div className="font-medium text-sm flex items-center gap-2">
                                            <Calendar size={14} className="text-muted-foreground" />
                                            {new Date(selectedLog.created_at).toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-xs text-muted-foreground uppercase font-bold">Conductor</span>
                                        <div className="font-medium text-sm flex items-center gap-2 truncate">
                                            <User size={14} className="text-muted-foreground" />
                                            {selectedLog.driver_name}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-xs text-muted-foreground uppercase font-bold">Consumo</span>
                                        <div className="font-medium text-sm flex items-center gap-2">
                                            <Droplet size={14} className="text-blue-500" />
                                            {selectedLog.liters} Litros
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-xs text-muted-foreground uppercase font-bold">Kilometraje</span>
                                        <div className="font-medium text-sm flex items-center gap-2">
                                            <Gauge size={14} className="text-purple-500" />
                                            {selectedLog.mileage.toLocaleString()} km
                                        </div>
                                    </div>
                                </div>
                                {selectedLog.notes && (
                                    <div className="mt-6 p-3 bg-white/5 rounded-lg border border-white/10">
                                        <span className="text-xs text-muted-foreground uppercase font-bold block mb-1">Notas</span>
                                        <p className="text-sm text-foreground">{selectedLog.notes}</p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

        </PremiumPageLayout>
    )
}
