"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Search, Eye, Calendar, User, Plus, ArrowLeft } from "lucide-react"
import Link from "next/link"

import { DispatchDialog } from "@/components/almacen/dispatch-dialog"

interface AssignmentItem {
    id: string
    product_name: string
    quantity: number
    serials: string[] // JSON as string[]
}

interface Assignment {
    id: string
    code: string
    assigned_to_name: string
    assigned_to_dept: string
    status: string
    created_at: string
    items: AssignmentItem[]
    returns?: any[]
}

export default function AssignmentHistoryPage() {
    const [assignments, setAssignments] = useState<Assignment[]>([])
    const [searchTerm, setSearchTerm] = useState("")
    const [loading, setLoading] = useState(true)
    const [openCombo, setOpenCombo] = useState(false)
    const supabase = createClient()

    useEffect(() => {
        loadassignments()
    }, [])

    const loadassignments = async (searchQuery?: string) => {
        setLoading(true)
        try {
            // Build Query
            let query = supabase
                .from("inventory_assignments")
                .select(`
                    id,
                    code,
                    status,
                    created_at,
                    assigned_to,
                    inventory_assignment_items (
                        id,
                        quantity,
                        serials,
                        inventory_products (name)
                    ),
                    inventory_returns (
                        id,
                        created_at,
                        notes,
                        inventory_return_items (
                            product_id,
                            quantity,
                            condition,
                            serials,
                            inventory_products (name)
                        )
                    )
                `)
                .order("created_at", { ascending: false })

            // Apply Server Search
            if (searchQuery) {
                // Search by Code (Case insensitive)
                query = query.ilike('code', `%${searchQuery}%`)
            } else {
                // Default limit if no search
                query = query.limit(100)
            }

            // Exclude Supervisor Spool Assignments (ASG-)
            query = query.not('code', 'ilike', 'ASG-%')

            const { data, error } = await query

            if (error) throw error

            // Fetch profiles
            const userIds = Array.from(new Set(data.map(a => a.assigned_to))).filter(Boolean)
            let profilesMap: Record<string, any> = {}

            if (userIds.length > 0) {
                const { data: profData } = await supabase
                    .from("profiles")
                    .select("id, first_name, last_name, department")
                    .in("id", userIds)

                if (profData) {
                    profData.forEach(p => {
                        profilesMap[p.id] = p
                    })
                }
            }

            const formatted: Assignment[] = data.map((item: any) => ({
                id: item.id,
                code: item.code,
                status: item.status,
                created_at: item.created_at,
                assigned_to_name: profilesMap[item.assigned_to]
                    ? `${profilesMap[item.assigned_to].first_name} ${profilesMap[item.assigned_to].last_name}`
                    : "Usuario Desconocido",
                assigned_to_dept: profilesMap[item.assigned_to]?.department || "N/A",
                items: item.inventory_assignment_items.map((i: any) => ({
                    id: i.id,
                    product_name: i.inventory_products?.name || "Producto Eliminado",
                    quantity: i.quantity,
                    serials: typeof i.serials === 'string' ? JSON.parse(i.serials) : i.serials
                })),
                returns: item.inventory_returns?.map((r: any) => ({
                    id: r.id,
                    created_at: r.created_at,
                    notes: r.notes,
                    items: r.inventory_return_items.map((ri: any) => ({
                        product_name: ri.inventory_products?.name,
                        quantity: ri.quantity,
                        condition: ri.condition,
                        serials: typeof ri.serials === 'string' ? JSON.parse(ri.serials) : ri.serials
                    }))
                })) || []
            }))

            setAssignments(formatted)
        } catch (error) {
            console.error("Error loading assignments:", error)
        } finally {
            setLoading(false)
        }
    }

    const filteredAssignments = assignments.filter(a =>
        a.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.assigned_to_name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="p-8 space-y-8 max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link href="/almacen">
                        <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50">
                            <ArrowLeft size={20} />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Seguimiento de Activos</h1>
                        <p className="text-zinc-500">Control de despachos y devoluciones</p>
                    </div>
                </div>
                <Button onClick={() => setOpenCombo(true)} className="bg-blue-600 hover:bg-blue-700 gap-2">
                    <Plus size={16} />
                    Asignar Combo
                </Button>
            </div>

            <DispatchDialog
                open={openCombo}
                onOpenChange={setOpenCombo}
                onSave={loadassignments}
                title="Asignar Combo / Equipo"
                codePrefix="CMB"
            />

            <Card className="border-zinc-200 shadow-sm">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Despachos Realizados</CardTitle>
                        <div className="relative w-64">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
                            <Input
                                placeholder="Buscar por código (Server) o Técnico (Local)..."
                                className="pl-9 pr-12"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        loadassignments(searchTerm)
                                    }
                                }}
                            />
                            <Button
                                size="icon"
                                className="absolute right-0 top-0 h-9 w-9 bg-zinc-900 text-white rounded-l-none hover:bg-zinc-800"
                                onClick={() => loadassignments(searchTerm)}
                            >
                                <Search size={14} />
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Código</TableHead>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Asignado A</TableHead>
                                <TableHead>Items</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Detalles</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8">Cargando historial...</TableCell>
                                </TableRow>
                            ) : filteredAssignments.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No se encontraron asignaciones.</TableCell>
                                </TableRow>
                            ) : (
                                filteredAssignments.map((assignment) => (
                                    <TableRow key={assignment.id}>
                                        <TableCell className="font-medium font-mono text-zinc-700">{assignment.code}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="text-sm text-zinc-900">{new Date(assignment.created_at).toLocaleDateString()}</span>
                                                <span className="text-xs text-muted-foreground">{new Date(assignment.created_at).toLocaleTimeString()}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-sm">{assignment.assigned_to_name}</span>
                                                <span className="text-xs text-muted-foreground">{assignment.assigned_to_dept}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>{assignment.items.length} items</TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className={
                                                    assignment.status === 'ACTIVE' ? "bg-blue-50 text-blue-700 border-blue-200" :
                                                        assignment.status === 'RETURNED' ? "bg-green-50 text-green-700 border-green-200" :
                                                            "bg-orange-50 text-orange-700 border-orange-200"
                                                }
                                            >
                                                {assignment.status === 'ACTIVE' ? 'En Uso' : assignment.status === 'RETURNED' ? 'Devuelto' : 'Parcial'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                                                    <DialogHeader>
                                                        <DialogTitle>Detalle de Despacho: {assignment.code}</DialogTitle>
                                                        <DialogDescription>
                                                            Historial completo de asignación y retornos.
                                                        </DialogDescription>
                                                    </DialogHeader>

                                                    <div className="mt-4 space-y-6">
                                                        {/* Despacho Original */}
                                                        <div>
                                                            <h4 className="text-sm font-medium border-b pb-2 mb-3 flex items-center justify-between">
                                                                <span>Materiales Entregados</span>
                                                                <span className="text-xs text-muted-foreground">{new Date(assignment.created_at).toLocaleDateString()}</span>
                                                            </h4>
                                                            <div className="grid gap-3">
                                                                {assignment.items.map((item) => (
                                                                    <div key={item.id} className="flex items-start justify-between p-3 bg-zinc-50 rounded-lg border border-zinc-100">
                                                                        <div>
                                                                            <p className="font-medium text-sm">{item.product_name}</p>
                                                                            {item.serials && item.serials.length > 0 && (
                                                                                <div className="mt-1 flex flex-wrap gap-1">
                                                                                    {item.serials.map((serial, idx) => (
                                                                                        <Badge key={idx} variant="secondary" className="text-[10px]">
                                                                                            {serial}
                                                                                        </Badge>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <span className="font-bold text-zinc-900">x{item.quantity}</span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Devoluciones */}
                                                        {(assignment.returns && assignment.returns.length > 0) && (
                                                            <div>
                                                                <h4 className="text-sm font-medium border-b pb-2 mb-3 text-blue-700">Devoluciones Registradas</h4>
                                                                <div className="space-y-4">
                                                                    {assignment.returns.map((ret: any) => (
                                                                        <div key={ret.id} className="relative pl-4 border-l-2 border-blue-200">
                                                                            <div className="mb-2 flex justify-between items-start">
                                                                                <div>
                                                                                    <p className="text-xs font-semibold text-blue-600">Devolución del {new Date(ret.created_at).toLocaleDateString()}</p>
                                                                                    {ret.notes && <p className="text-xs text-zinc-500 italic">"{ret.notes}"</p>}
                                                                                </div>
                                                                            </div>
                                                                            <div className="grid gap-2">
                                                                                {ret.items.map((ritem: any, idx: number) => (
                                                                                    <div key={idx} className="flex flex-col gap-1 text-sm bg-blue-50/50 p-2 rounded">
                                                                                        <div className="flex justify-between items-center w-full">
                                                                                            <span>{ritem.product_name}</span>
                                                                                            <div className="flex items-center gap-3">
                                                                                                <Badge variant="outline" className="text-[10px] bg-white text-zinc-600">
                                                                                                    {ritem.condition === 'GOOD' ? 'Buen Estado' : 'Dañado'}
                                                                                                </Badge>
                                                                                                <span className="font-bold">x{ritem.quantity}</span>
                                                                                            </div>
                                                                                        </div>
                                                                                        {ritem.serials && ritem.serials.length > 0 && (
                                                                                            <div className="mt-1 flex flex-wrap gap-1">
                                                                                                {ritem.serials.map((serial: string, sIdx: number) => (
                                                                                                    <Badge key={sIdx} variant="secondary" className="text-[10px] bg-blue-100 text-blue-700 hover:bg-blue-200">
                                                                                                        {serial}
                                                                                                    </Badge>
                                                                                                ))}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </DialogContent>
                                            </Dialog>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}



// ...


