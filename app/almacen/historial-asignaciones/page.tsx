"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { PremiumPageLayout } from "@/components/ui/premium-page-layout"
import { PremiumCard } from "@/components/ui/premium-card"
import { CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
        <PremiumPageLayout 
            title="Seguimiento de Activos" 
            description="Control de despachos y devoluciones"
            backUrl="/almacen"
            backLabel="Volver a Almacén"
        >
            <div className="space-y-8">
                <div className="flex justify-end gap-2 mb-6">
                    <Button onClick={() => setOpenCombo(true)} className="bg-blue-600 text-white hover:bg-blue-700 gap-2">
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

            <PremiumCard className="p-0 overflow-hidden" wrapperClassName="h-auto">
                <CardHeader className="bg-muted/50 border-b border-border py-4 px-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
                        <CardTitle className="text-foreground">Despachos Realizados</CardTitle>
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar código o Técnico..."
                                className="pl-9 pr-12 bg-background"
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
                                className="absolute right-0 top-0 h-9 w-9 bg-primary text-primary-foreground rounded-l-none hover:bg-primary/90"
                                onClick={() => loadassignments(searchTerm)}
                            >
                                <Search size={14} />
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow className="border-border hover:bg-transparent">
                                <TableHead className="pl-6 text-muted-foreground">Código</TableHead>
                                <TableHead className="text-muted-foreground">Fecha</TableHead>
                                <TableHead className="text-muted-foreground">Asignado A</TableHead>
                                <TableHead className="text-muted-foreground">Items</TableHead>
                                <TableHead className="text-muted-foreground">Estado</TableHead>
                                <TableHead className="text-right pr-6 text-muted-foreground">Detalles</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Cargando historial...</TableCell>
                                </TableRow>
                            ) : filteredAssignments.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No se encontraron asignaciones.</TableCell>
                                </TableRow>
                            ) : (
                                filteredAssignments.map((assignment) => (
                                    <TableRow key={assignment.id} className="border-border hover:bg-muted/50 transition-colors">
                                        <TableCell className="pl-6 font-medium font-mono text-foreground">{assignment.code}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="text-sm text-foreground">{new Date(assignment.created_at).toLocaleDateString()}</span>
                                                <span className="text-xs text-muted-foreground">{new Date(assignment.created_at).toLocaleTimeString()}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-sm text-foreground">{assignment.assigned_to_name}</span>
                                                <span className="text-xs text-muted-foreground">{assignment.assigned_to_dept}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">{assignment.items.length} items</TableCell>
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
                                        <TableCell className="text-right pr-6">
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="hover:bg-muted text-muted-foreground">
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
                                                            <h4 className="text-sm font-medium border-b border-border pb-2 mb-3 flex items-center justify-between text-foreground">
                                                                <span>Materiales Entregados</span>
                                                                <span className="text-xs text-muted-foreground">{new Date(assignment.created_at).toLocaleDateString()}</span>
                                                            </h4>
                                                            <div className="grid gap-3">
                                                                {assignment.items.map((item) => (
                                                                    <div key={item.id} className="flex items-start justify-between p-3 bg-muted/50 rounded-lg border border-border">
                                                                        <div>
                                                                            <p className="font-medium text-sm text-foreground">{item.product_name}</p>
                                                                            {item.serials && item.serials.length > 0 && (
                                                                                <div className="mt-1 flex flex-wrap gap-1">
                                                                                    {item.serials.map((serial, idx) => (
                                                                                        <Badge key={idx} variant="secondary" className="text-[10px] bg-background text-muted-foreground border-border">
                                                                                            {serial}
                                                                                        </Badge>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <span className="font-bold text-foreground">x{item.quantity}</span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Devoluciones */}
                                                        {(assignment.returns && assignment.returns.length > 0) && (
                                                            <div>
                                                                <h4 className="text-sm font-medium border-b border-border pb-2 mb-3 text-blue-500">Devoluciones Registradas</h4>
                                                                <div className="space-y-4">
                                                                    {assignment.returns.map((ret: any) => (
                                                                        <div key={ret.id} className="relative pl-4 border-l-2 border-primary/20">
                                                                            <div className="mb-2 flex justify-between items-start">
                                                                                <div>
                                                                                    <p className="text-xs font-semibold text-primary">Devolución del {new Date(ret.created_at).toLocaleDateString()}</p>
                                                                                    {ret.notes && <p className="text-xs text-muted-foreground italic">"{ret.notes}"</p>}
                                                                                </div>
                                                                            </div>
                                                                            <div className="grid gap-2">
                                                                                {ret.items.map((ritem: any, idx: number) => (
                                                                                    <div key={idx} className="flex flex-col gap-1 text-sm bg-primary/5 p-2 rounded">
                                                                                        <div className="flex justify-between items-center w-full">
                                                                                            <span className="text-foreground">{ritem.product_name}</span>
                                                                                            <div className="flex items-center gap-3">
                                                                                                <Badge variant="outline" className="text-[10px] bg-background text-muted-foreground border-border">
                                                                                                    {ritem.condition === 'GOOD' ? 'Buen Estado' : 'Dañado'}
                                                                                                </Badge>
                                                                                                <span className="font-bold text-foreground">x{ritem.quantity}</span>
                                                                                            </div>
                                                                                        </div>
                                                                                        {ritem.serials && ritem.serials.length > 0 && (
                                                                                            <div className="mt-1 flex flex-wrap gap-1">
                                                                                                {ritem.serials.map((serial: string, sIdx: number) => (
                                                                                                    <Badge key={sIdx} variant="secondary" className="text-[10px] bg-primary/10 text-primary hover:bg-primary/20">
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
            </PremiumCard>
            </div>
        </PremiumPageLayout>
    )
}



// ...


