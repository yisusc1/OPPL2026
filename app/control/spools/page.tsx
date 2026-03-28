"use client"

import { useState, useEffect } from "react"
import { getActiveSpools, getTeams, assignSpoolToTeam, returnSpool, getSpoolHistory } from "./actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Disc, Plus, History, Package, ArrowLeft, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { SpoolHistoryDialog } from "@/components/spool-history-dialog"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { PremiumPageLayout } from "@/components/ui/premium-page-layout"
import { PremiumCard } from "@/components/ui/premium-card"
import { PremiumContent } from "@/components/ui/premium-content"

export default function SpoolManagementPage() {
    const router = useRouter()
    const [spools, setSpools] = useState<any[]>([])
    const [teams, setTeams] = useState<any[]>([])
    const [history, setHistory] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isAssignOpen, setIsAssignOpen] = useState(false)
    const [isHistoryOpen, setIsHistoryOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Alert Dialog State
    const [spoolReleaseId, setSpoolReleaseId] = useState<string | null>(null)
    const [actionLoading, setActionLoading] = useState(false)

    // Form
    const [selectedTeam, setSelectedTeam] = useState("")
    const [serial, setSerial] = useState("")
    const [meters, setMeters] = useState("1000")

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        setLoading(true)
        const [s, t, h] = await Promise.all([getActiveSpools(), getTeams(), getSpoolHistory()])
        setSpools(s)
        setTeams(t)
        setHistory(h)
        setLoading(false)
    }

    async function handleAssign() {
        if (!selectedTeam || !serial || !meters) return toast.error("Complete todos los campos")

        setIsSubmitting(true)
        const res = await assignSpoolToTeam(selectedTeam, serial, Number(meters))
        setIsSubmitting(false)
        if (res.success) {
            toast.success("Bobina asignada correctamente")
            setIsAssignOpen(false)
            setSerial("")
            loadData()
        } else {
            toast.error("Error: " + res.error)
        }
    }

    function handleReturn(id: string) {
        setSpoolReleaseId(id)
    }

    async function executeReturn() {
        if (!spoolReleaseId) return
        setActionLoading(true)
        const res = await returnSpool(spoolReleaseId, 0)
        setActionLoading(false)

        if (res.success) {
            toast.success("Bobina liberada correctamente")
            setSpoolReleaseId(null)
            loadData()
        } else {
            toast.error("Error: " + res.error)
        }
    }

    return (
        <PremiumPageLayout title="Gestión de Bobinas" description="Asigne y monitoree el consumo de fibra por equipo.">
            <div className="space-y-8">
                {/* HEADER ACTIONS */}
                <PremiumContent className="p-4 md:p-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <Button
                            onClick={() => router.push("/control")}
                            variant="ghost"
                            className="pl-0 hover:bg-transparent hover:text-primary"
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" /> Volver al Panel
                        </Button>

                        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                            <Button variant="outline" onClick={() => setIsHistoryOpen(true)} className="gap-2 w-full sm:w-auto justify-center h-12 rounded-xl">
                                <History size={16} />
                                Historial
                            </Button>
                            <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
                                <DialogTrigger asChild>
                                    <Button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-500/20 rounded-xl px-6 h-12">
                                        <Plus className="mr-2 h-4 w-4" />
                                        Nueva Asignación
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-md rounded-2xl w-[95vw] bg-background border-border">
                                    <DialogHeader>
                                        <DialogTitle>Asignar Bobina a Grupo</DialogTitle>
                                        <DialogDescription>
                                            Seleccione el equipo y el serial de la bobina para confirmar la asignación.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-foreground">Seleccionar Grupo</label>
                                            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                                                <SelectTrigger className="rounded-xl border-input h-11 bg-background">
                                                    <SelectValue placeholder="Seleccione un equipo..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {teams.map(t => (
                                                        <SelectItem
                                                            key={t.id}
                                                            value={t.id}
                                                            disabled={t.memberCount === 0}
                                                        >
                                                            {t.name} {t.memberCount === 0 ? "(Sin Técnico)" : ""}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-foreground">Serial de Bobina</label>
                                            <Input
                                                placeholder="Ej. BOB-2023-001"
                                                value={serial}
                                                onChange={e => setSerial(e.target.value)}
                                                className="rounded-xl border-input h-11 bg-background"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-foreground">Metraje Inicial (m)</label>
                                            <Input
                                                type="number"
                                                placeholder="1000"
                                                value={meters}
                                                onChange={e => setMeters(e.target.value)}
                                                className="rounded-xl border-input h-11 bg-background"
                                            />
                                        </div>
                                        <Button className="w-full bg-blue-600 text-white font-bold rounded-xl h-12 mt-4" onClick={handleAssign} disabled={isSubmitting}>
                                            {isSubmitting ? "Asignando..." : "Confirmar Asignación"}
                                        </Button>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>
                </PremiumContent>

                {/* SPOOLS GRID */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading ? (
                        <div className="col-span-full flex justify-center py-20">
                            <Loader2 className="animate-spin text-primary" size={40} />
                        </div>
                    ) : (
                        spools.map((spool) => (
                            <PremiumCard key={spool.id} className="relative overflow-hidden group hover:border-primary/30 transition-all p-0">
                                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                                    <Disc size={120} className="text-foreground -mr-8 -mt-8" />
                                </div>
                                <div className="p-6 pb-2">
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                                            <Package size={24} />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-foreground">{spool.team?.name}</h3>
                                            <p className="text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded inline-block mt-1">{spool.serial_number}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-6 pt-2 space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-muted-foreground">Inicial</span>
                                            <span className="font-bold text-foreground">{spool.initial_quantity}m</span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-muted-foreground">Actual (Est.)</span>
                                            <span className={`font-bold ${spool.current_quantity < 300 ? 'text-red-500' : 'text-emerald-500'}`}>
                                                {spool.current_quantity}m
                                            </span>
                                        </div>
                                        <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${spool.current_quantity < 300 ? 'bg-red-500' : 'bg-emerald-500'}`}
                                                style={{ width: `${Math.min(100, (spool.current_quantity / spool.initial_quantity) * 100)}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-2 border-t border-border/50">
                                        <p className="text-[10px] text-muted-foreground">
                                            Asignado: {new Date(spool.created_at).toLocaleDateString()}
                                        </p>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-red-500 hover:text-red-600 hover:bg-red-500/10 h-8 px-3 rounded-lg text-xs font-bold"
                                            onClick={() => handleReturn(spool.id)}
                                        >
                                            Liberar
                                        </Button>
                                    </div>
                                </div>
                            </PremiumCard>
                        ))
                    )}

                    {spools.length === 0 && !loading && (
                        <div className="col-span-full py-20 text-center border-2 border-dashed border-muted rounded-3xl bg-muted/5">
                            <Disc size={48} className="mx-auto text-muted-foreground mb-4 opacity-50" />
                            <h3 className="text-lg font-medium text-foreground">No hay bobinas asignadas</h3>
                            <p className="text-muted-foreground text-sm mt-1">Asigne una nueva bobina a un grupo para comenzar.</p>
                        </div>
                    )}
                </div>

                <AlertDialog open={!!spoolReleaseId} onOpenChange={(open) => !open && setSpoolReleaseId(null)}>
                    <AlertDialogContent className="rounded-2xl bg-background border-border">
                        <AlertDialogHeader>
                            <AlertDialogTitle>¿Liberar bobina del equipo?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta acción desvinculará la bobina del equipo actual. Podrá ser asignada nuevamente más tarde.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel className="rounded-xl border-input bg-background text-foreground hover:bg-muted" disabled={actionLoading}>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                                className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold"
                                onClick={(e) => {
                                    e.preventDefault()
                                    executeReturn()
                                }}
                                disabled={actionLoading}
                            >
                                {actionLoading ? "Procesando..." : "Sí, Liberar Bobina"}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
            <SpoolHistoryDialog
                isOpen={isHistoryOpen}
                onClose={() => setIsHistoryOpen(false)}
                history={history}
            />
        </PremiumPageLayout>
    )
}
