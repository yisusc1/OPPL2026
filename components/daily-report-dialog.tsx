"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { FileText, Loader2, Copy, Send } from "lucide-react"
import { toast } from "sonner"
import { generateDailyReportData } from "@/app/control/report/actions"

export function DailyReportDialog({ teams }: { teams: any[] }) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [selectedTeam, setSelectedTeam] = useState("")
    const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString("es-ES")) // Default "D/M/YYYY"
    const [reportText, setReportText] = useState("")

    // Helper to match DB date format likely "D/M/YYYY" or "DD/MM/YYYY"
    // We'll use a standard date picker later, but for now simple input or formatted string
    // Let's rely on standard "D/M/YYYY" which seems common in this system

    async function handleGenerate() {
        if (!selectedTeam) return toast.error("Seleccione un equipo")

        setLoading(true)
        try {
            // Find Team Name
            const team = teams.find(t => t.id === selectedTeam)
            if (!team) return

            // Format format: The user prompt had "06/1/2026". "toLocaleDateString('es-ES')" often gives "6/1/2026".
            // We should ensure the DB query matches what's stored.
            // Let's assume the user picks "Today" mostly.

            const data = await generateDailyReportData(team.name, selectedDate)

            // Format Text
            let text = `*Reporte De Entrada ${team.name}*\n`
            text += `*Fecha: ${data.date}*\n`
            text += `*Nombre De Instaladores:* ${data.installers}\n\n`

            text += `*Estatus ONUS:* ${data.onus.status}\n`
            text += `*ONUS:* ${String(data.onus.count).padStart(2, '0')}\n\n`

            data.onus.list.forEach(onu => {
                text += `${onu}\n`
            })
            text += `\n`

            text += `*ROUTER:* ${String(data.routers).padStart(2, '0')}\n\n`

            text += `*Instalaciones Asignadas No Efectuadas:* ${String(data.installations.failedCount).padStart(2, '0')}\n\n`

            data.installations.failedDetails.forEach(d => {
                text += `${d.client}: ${d.reason}\n`
            })
            text += `\n`

            text += `*Total De Instalaciones Realizadas:* ${String(data.installations.totalPerformed).padStart(2, '0')}\n\n`

            text += `*Conectores Utilizados:*  ${String(data.materials.connectors.used).padStart(2, '0')}\n`
            text += `*Conectores  Restantes:* ${String(data.materials.connectors.remaining).padStart(2, '0')}\n`
            text += `*Conectores Defectuosos:* ${String(data.materials.connectors.defective).padStart(2, '0')}\n`
            text += `*Tensores Utilizados:* ${String(data.materials.tensors.used).padStart(2, '0')}\n\n`

            data.spools.forEach(spool => {
                text += `Carrete ${spool.serial}\n`
                text += ` Metraje Utilizado:  ${spool.used}Mts\n`
                text += `*Metraje Restante:* ${spool.remaining}Mts\n\n`
            })

            setReportText(text)
        } catch (e: any) {
            toast.error("Error al generar: " + e.message)
        } finally {
            setLoading(false)
        }
    }

    function copyToClipboard() {
        navigator.clipboard.writeText(reportText)
        toast.success("Copiado al portapapeles")
    }

    function sendWhatsApp() {
        const url = `https://wa.me/?text=${encodeURIComponent(reportText)}`
        window.open(url, '_blank')
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="w-full md:w-auto bg-green-600 hover:bg-green-700 text-white shadow-lg rounded-xl h-12 px-6 gap-2">
                    <FileText size={20} />
                    Generar Reporte Diario
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md w-full rounded-2xl">
                <DialogHeader>
                    <DialogTitle>Generar Reporte WhatsApp</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-500">Fecha</label>
                            <Input
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                placeholder="D/M/AAAA"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-500">Equipo</label>
                            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Equipo" />
                                </SelectTrigger>
                                <SelectContent>
                                    {teams.map(t => (
                                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {!reportText ? (
                        <Button
                            onClick={handleGenerate}
                            disabled={loading || !selectedTeam}
                            className="w-full bg-slate-900 text-white"
                        >
                            {loading ? <Loader2 className="animate-spin mr-2" /> : null}
                            Generar Texto
                        </Button>
                    ) : (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                            <Textarea
                                value={reportText}
                                onChange={(e) => setReportText(e.target.value)}
                                className="h-64 font-mono text-sm bg-slate-50"
                            />
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={copyToClipboard} className="flex-1">
                                    <Copy size={16} className="mr-2" /> Copiar
                                </Button>
                                <Button onClick={sendWhatsApp} className="flex-1 bg-green-600 hover:bg-green-700 text-white">
                                    <Send size={16} className="mr-2" /> WhatsApp
                                </Button>
                            </div>
                            <Button variant="ghost" onClick={() => setReportText("")} className="w-full text-xs text-slate-400">
                                Generar Nuevo
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
