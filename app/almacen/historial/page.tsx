"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { History, ArrowUpRight, ArrowDownRight, Package, User, Search, ArrowLeft, Truck } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

import { useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type Transaction = {
    id: string
    product_id: string
    type: 'IN' | 'OUT' | 'ADJUST'
    quantity: number
    previous_stock: number
    new_stock: number
    reason: string
    created_at: string
    assigned_to?: string
    inventory_products: {
        name: string
        sku: string
    }
    receiver?: {
        first_name: string
        last_name: string
        department: string
        job_title: string
    }
    received_by?: string
    receiver_id?: string
}



export default function HistoryPage() {
    const searchParams = useSearchParams()
    const dateParam = searchParams.get("date")

    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [loading, setLoading] = useState(true)

    // Filter States
    const [dateFilter, setDateFilter] = useState(dateParam === "today" ? new Date().toISOString().split('T')[0] : "")
    const [productFilter, setProductFilter] = useState("")
    const [typeFilter, setTypeFilter] = useState("ALL")

    useEffect(() => {
        if (dateParam === "today") {
            const today = new Date().toISOString().split('T')[0]
            setDateFilter(today)
        }
    }, [dateParam])

    const supabase = createClient()

    useEffect(() => {
        loadTransactions()
    }, [])

    const loadTransactions = async () => {
        setLoading(true)
        try {
            let query = supabase
                .from("inventory_transactions")
                .select("*, inventory_products(name, sku)")
                .order("created_at", { ascending: false })
                .limit(500)

            // Apply Server-Side Filters
            if (dateFilter) {
                // Assuming dateFilter is YYYY-MM-DD
                const start = `${dateFilter}T00:00:00`
                const end = `${dateFilter}T23:59:59`
                query = query.gte("created_at", start).lte("created_at", end)
            }

            if (typeFilter && typeFilter !== "ALL") {
                query = query.eq("type", typeFilter)
            }

            const { data: txData, error: txError } = await query

            if (txError) throw txError

            if (!txData || txData.length === 0) {
                setTransactions([])
                return
            }

            // 2. Fetch Profiles for 'assigned_to'
            const assignedIds = Array.from(new Set(txData.map(t => t.assigned_to).filter(Boolean)))

            let profilesMap: Record<string, any> = {}
            if (assignedIds.length > 0) {
                const { data: profilesData } = await supabase
                    .from("profiles")
                    .select("id, first_name, last_name, department, job_title")
                    .in("id", assignedIds)

                if (profilesData) {
                    profilesData.forEach(p => {
                        profilesMap[p.id] = p
                    })
                }
            }

            // 3. Merge Data
            const mergedTransactions = txData.map(tx => ({
                ...tx,
                receiver: tx.assigned_to ? profilesMap[tx.assigned_to] : undefined
            }))

            setTransactions(mergedTransactions)
            toast.success("Datos actualizados")
        } catch (error) {
            console.error("Error loading transactions:", error)
            toast.error("Error al cargar historial")
        } finally {
            setLoading(false)
        }
    }

    // Client-side filtering only for Text Search (Product Name)
    // Date and Type are handled by Server Query now, but keeping them here 
    // acts as a "double check" which is harmless, or we can remove them.
    // Removing them from here allows the user to see ALL results returned by the server query.
    // Actually, if I filter by date on server, the client filter matchesDate will be true anyway.
    // So distinct separation: SERVER does heavy lifting (Date, Type), CLIENT does fine tuning (Text).
    const filteredTransactions = transactions.filter(tx => {
        const matchesProduct = productFilter
            ? (tx.inventory_products?.name.toLowerCase().includes(productFilter.toLowerCase()) ||
                tx.inventory_products?.sku.toLowerCase().includes(productFilter.toLowerCase()))
            : true

        // We still keep these checks just in case the state and query drift, but primarily this powers the text search.
        return matchesProduct
    })

    const getTypeConfig = (type: string) => {
        switch (type) {
            case 'IN': return { color: "text-green-700 bg-green-50", icon: <ArrowDownRight size={16} />, label: "Entrada" }
            case 'OUT': return { color: "text-red-700 bg-red-50", icon: <ArrowUpRight size={16} />, label: "Salida" }
            default: return { color: "text-blue-700 bg-blue-50", icon: <History size={16} />, label: "Ajuste" }
        }
    }

    return (
        <div className="p-8 space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
                <div className="flex items-center gap-3">
                    <Link href="/almacen">
                        <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl mr-2 bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50">
                            <ArrowLeft size={20} />
                        </Button>
                    </Link>
                    <div className="p-3 bg-zinc-900 rounded-xl shadow-lg shadow-zinc-900/10">
                        <History className="text-white" size={24} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Historial de Movimientos</h1>
                        <p className="text-zinc-500">Registro detallado de entradas y salidas</p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                    <Input
                        type="date"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="w-[160px] bg-white"
                    />
                    <Input
                        placeholder="Buscar producto..."
                        value={productFilter}
                        onChange={(e) => setProductFilter(e.target.value)}
                        className="w-[200px] bg-white"
                    />
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger className="w-[130px] bg-white">
                            <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Todos</SelectItem>
                            <SelectItem value="IN">Entradas</SelectItem>
                            <SelectItem value="OUT">Salidas</SelectItem>
                            <SelectItem value="ADJUST">Ajustes</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button onClick={() => loadTransactions()} variant="default" size="icon" className="bg-zinc-900 text-white hover:bg-zinc-800">
                        <Search size={16} />
                    </Button>
                    {(dateFilter || productFilter || typeFilter !== "ALL") && (
                        <Button variant="ghost" onClick={() => {
                            setDateFilter("")
                            setProductFilter("")
                            setTypeFilter("ALL")
                        }}>
                            Limpiar
                        </Button>
                    )}
                </div>
            </div>

            <Card className="border-zinc-200 shadow-sm overflow-hidden rounded-[24px]">
                <CardHeader className="bg-zinc-50/50 border-b border-zinc-100">
                    <CardTitle>Últimos Movimientos</CardTitle>
                    <CardDescription>Mostrando los últimos 100 registros</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-zinc-50">
                            <TableRow>
                                <TableHead className="pl-6">Fecha</TableHead>
                                <TableHead>Producto</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Detalle</TableHead>
                                <TableHead className="text-right pr-6">Stock Resultante</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-32 text-zinc-500">
                                        Cargando historial...
                                    </TableCell>
                                </TableRow>
                            ) : transactions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-32 text-zinc-500">
                                        No hay movimientos registrados.
                                    </TableCell>
                                </TableRow>
                            ) : transactions.map((tx) => {
                                const config = getTypeConfig(tx.type)
                                return (
                                    <TableRow key={tx.id} className="hover:bg-zinc-50/50 transition-colors">
                                        <TableCell className="pl-6 text-zinc-500 text-sm">
                                            {new Date(tx.created_at).toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-zinc-900">
                                                    {tx.inventory_products?.name || "Producto Eliminado"}
                                                </span>
                                                <span className="text-xs text-zinc-500">
                                                    SKU: {tx.inventory_products?.sku || "?"}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={`${config.color} border-0 flex w-fit items-center gap-1`}>
                                                {config.icon}
                                                {config.label}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col text-sm">
                                                <span className="font-medium text-zinc-700">
                                                    {tx.type === 'IN' ? '+' : tx.type === 'OUT' ? '-' : ''}{tx.quantity} unidades
                                                </span>
                                                <span className="text-zinc-500 text-xs italic">
                                                    {tx.reason}
                                                </span>
                                                {tx.receiver ? (
                                                    <div className="mt-1 pt-1 border-t border-zinc-100 flex flex-col gap-0.5">
                                                        <span className="text-xs font-medium text-zinc-600">
                                                            Entregado a: {tx.receiver.first_name} {tx.receiver.last_name}
                                                        </span>
                                                        <span className="text-[10px] text-zinc-400">
                                                            {tx.receiver.department} • {tx.receiver.job_title}
                                                        </span>
                                                    </div>
                                                ) : tx.received_by ? (
                                                    <div className="mt-1 pt-1 border-t border-zinc-100 flex flex-col gap-0.5">
                                                        <span className="text-xs font-medium text-zinc-600 flex items-center gap-1">
                                                            <Truck size={12} className="text-orange-500" />
                                                            Entregado a: {tx.received_by}
                                                        </span>
                                                        {tx.receiver_id && (
                                                            <span className="text-[10px] text-zinc-400 bg-zinc-100 px-1 rounded w-fit">
                                                                ID: {tx.receiver_id}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : null}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right pr-6 font-mono text-zinc-700">
                                            {tx.new_stock}
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
