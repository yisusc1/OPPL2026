"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { getTeams, saveTeam, deleteTeam, assignUserToTeam, getTechnicians } from "./actions"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Trash2, PlusCircle, Pencil, ChevronLeft, Search, Users, User, Loader2 } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { PremiumPageLayout } from "@/components/ui/premium-page-layout"
import { PremiumCard } from "@/components/ui/premium-card"
import { PremiumContent } from "@/components/ui/premium-content"

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")

export default function TeamsPage() {
    const [teams, setTeams] = useState<any[]>([])
    const [techs, setTechs] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)

    // Form State
    const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
    const [selectedLetter, setSelectedLetter] = useState("")
    const [selectedLeader, setSelectedLeader] = useState("")
    const [selectedAux, setSelectedAux] = useState("")
    const [isSaving, setIsSaving] = useState(false)

    const loadData = async () => {
        try {
            const [t, u] = await Promise.all([getTeams(), getTechnicians()])
            setTeams(t)
            setTechs(u)
        } catch (e: any) {
            toast.error("Error: " + e.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadData()
    }, [])

    const openCreateModal = () => {
        setIsDialogOpen(true)
        setSelectedTeamId(null)
        setSelectedLetter("")
        setSelectedLeader("")
        setSelectedAux("")
    }

    const openEditModal = (team: any) => {
        setIsDialogOpen(true)
        setSelectedTeamId(team.id)
        setSelectedLetter(team.name.replace("Equipo ", ""))

        // Find leader and aux
        if (team.profiles && team.profiles.length > 0) {
            setSelectedLeader(team.profiles[0]?.id || "")
            setSelectedAux(team.profiles[1]?.id || "")
        } else {
            setSelectedLeader("")
            setSelectedAux("")
        }
    }

    const handleSaveTeam = async () => {
        if (!selectedLetter) return toast.error("Selecciona una letra para el equipo")
        if (!selectedLeader) return toast.error("Selecciona un Técnico Líder")
        if (!selectedAux) return toast.error("Selecciona un Técnico Auxiliar")
        if (selectedLeader === selectedAux) return toast.error("El líder y auxiliar deben ser diferentes")

        try {
            setIsSaving(true)
            await saveTeam(selectedLetter, selectedLeader, selectedAux, selectedTeamId)
            toast.success(selectedTeamId ? "Equipo actualizado" : "Equipo creado")
            setIsDialogOpen(false)
            loadData()
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("¿Eliminar este equipo y liberar a sus técnicos?")) return
        try {
            await deleteTeam(id)
            toast.success("Equipo eliminado")
            loadData()
        } catch (e: any) {
            toast.error(e.message)
        }
    }

    // Filter Logic for Dropdowns
    const availableOptions = techs

    // Helper to render Name + (Current Team)
    const renderTechLabel = (t: any) => {
        let label = `${t.first_name} ${t.last_name}`
        if (t.team_id && t.team_id !== selectedTeamId) {
            // Find team name
            const team = teams.find(team => team.id === t.team_id)
            if (team) label += ` (${team.name})`
        }
        return label
    }

    if (loading) return (
        <div className="flex h-screen items-center justify-center">
            <Loader2 className="animate-spin text-primary" size={40} />
        </div>
    )

    return (
        <PremiumPageLayout title="Gestión de Equipos" description="Administra las parejas de trabajo. Crea equipos, asigna responsabilidades y mantén el orden operativo.">
            <div className="space-y-8">
                {/* HEADER ACTIONS */}
                <PremiumContent className="p-4 md:p-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <Button
                            onClick={() => window.location.href = "/control"}
                            variant="ghost"
                            className="pl-0 hover:bg-transparent hover:text-primary"
                        >
                            <ChevronLeft className="mr-2 h-4 w-4" /> Volver al Panel
                        </Button>

                        <Button onClick={openCreateModal} className="w-full md:w-auto rounded-xl h-12 px-6 shadow-lg shadow-blue-500/20 bg-blue-600 hover:bg-blue-700 transition-all hover:scale-105 active:scale-95 font-bold">
                            <PlusCircle className="mr-2 h-5 w-5" />
                            Nuevo Equipo
                        </Button>
                    </div>
                </PremiumContent>

                {/* TEAMS GRID */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {teams.map((team) => (
                        <PremiumCard
                            key={team.id}
                            className="group relative hover:border-blue-500/30 transition-all p-6 flex flex-col justify-between"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="h-12 w-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center text-lg font-bold">
                                        {team.name.replace("Equipo ", "")}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg text-foreground">{team.name}</h3>
                                        <span className="text-xs text-muted-foreground font-medium bg-muted px-2 py-0.5 rounded">
                                            {team.profiles?.length || 0} Integrantes
                                        </span>
                                    </div>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={() => openEditModal(team)}>
                                        <Pencil size={14} />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-muted-foreground hover:text-red-600 hover:bg-red-500/10" onClick={() => handleDelete(team.id)}>
                                        <Trash2 size={14} />
                                    </Button>
                                </div>
                            </div>

                            {/* Members List */}
                            <div className="space-y-3">
                                {/* Leader */}
                                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border/50">
                                    <div className="h-8 w-8 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center text-xs font-bold">L</div>
                                    <div className="flex-1 overflow-hidden">
                                        <p className="text-sm font-medium truncate text-foreground">
                                            {team.profiles?.[0]
                                                ? `${team.profiles[0].first_name} ${team.profiles[0].last_name}`
                                                : <span className="text-muted-foreground italic">Sin asignar</span>
                                            }
                                        </p>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Líder</p>
                                    </div>
                                </div>

                                {/* Aux */}
                                <div className="flex items-center gap-3 p-3 rounded-xl bg-background border border-border/50">
                                    <div className="h-8 w-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-bold">A</div>
                                    <div className="flex-1 overflow-hidden">
                                        <p className="text-sm font-medium truncate text-foreground">
                                            {team.profiles?.[1]
                                                ? `${team.profiles[1].first_name} ${team.profiles[1].last_name}`
                                                : <span className="text-muted-foreground italic">Sin asignar</span>
                                            }
                                        </p>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Auxiliar</p>
                                    </div>
                                </div>
                            </div>
                        </PremiumCard>
                    ))}

                    {/* Add New Placeholder */}
                    <div
                        onClick={openCreateModal}
                        className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-muted p-6 min-h-[300px] cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all group"
                    >
                        <div className="h-16 w-16 mb-4 rounded-full bg-muted group-hover:bg-primary/10 transition-colors flex items-center justify-center text-muted-foreground group-hover:text-primary">
                            <PlusCircle size={32} />
                        </div>
                        <h3 className="font-semibold text-muted-foreground group-hover:text-primary">Crear Nuevo Equipo</h3>
                        <p className="text-sm text-muted-foreground/60 text-center px-4 mt-2">Agrega otra pareja de técnicos a la flota.</p>
                    </div>
                </div>

                {/* MODAL */}
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-3xl bg-background border-border shadow-2xl">
                        <div className="p-6 bg-muted/30 border-b border-border">
                            <DialogHeader>
                                <DialogTitle className="text-xl text-foreground">{selectedTeamId ? "Editar Equipo" : "Crear Nuevo Equipo"}</DialogTitle>
                                <DialogDescription className="text-muted-foreground">
                                    {selectedTeamId ? "Modifica los integrantes o el nombre." : "Configura la nueva pareja de trabajo."}
                                </DialogDescription>
                            </DialogHeader>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* LETRA */}
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Identificador</Label>
                                <Select onValueChange={setSelectedLetter} value={selectedLetter}>
                                    <SelectTrigger className="h-12 rounded-xl bg-background border-input">
                                        <SelectValue placeholder="Selecciona Letra (A-Z)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {LETTERS.map(l => {
                                            const isUsed = teams.some(t => t.name === `Equipo ${l}`)
                                            const isCurrent = selectedTeamId && selectedLetter === l

                                            if (isUsed && !isCurrent) return null

                                            return (
                                                <SelectItem key={l} value={l}>Equipo {l}</SelectItem>
                                            )
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-indigo-500 uppercase tracking-wider">Técnico Líder</Label>
                                    <Select onValueChange={setSelectedLeader} value={selectedLeader}>
                                        <SelectTrigger className="h-12 rounded-xl bg-indigo-500/5 border-indigo-500/20 focus:ring-indigo-500/20">
                                            <SelectValue placeholder="Seleccionar..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableOptions.map(t => (
                                                <SelectItem key={t.id} value={t.id}>{renderTechLabel(t)}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Técnico Auxiliar</Label>
                                    <Select onValueChange={setSelectedAux} value={selectedAux}>
                                        <SelectTrigger className="h-12 rounded-xl bg-background border-input">
                                            <SelectValue placeholder="Seleccionar..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableOptions.filter(t => t.id !== selectedLeader).map(t => (
                                                <SelectItem key={t.id} value={t.id}>{renderTechLabel(t)}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {selectedTeamId && (
                                <div className="rounded-lg bg-amber-500/10 p-3 text-xs text-amber-600 border border-amber-500/20">
                                    Nota: Al guardar, los miembros seleccionados serán reasignados a este equipo.
                                </div>
                            )}
                        </div>

                        <DialogFooter className="p-6 bg-muted/30 border-t border-border gap-2">
                            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl h-11 border-input hover:bg-muted text-foreground">
                                Cancelar
                            </Button>
                            <Button onClick={handleSaveTeam} disabled={isSaving} className="rounded-xl h-11 px-8 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20 text-white">
                                {isSaving ? "Guardando..." : "Guardar Cambios"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </PremiumPageLayout>
    )
}
