"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { AlertTriangle } from "lucide-react"

type ReportFaultDialogProps = {
    isOpen: boolean
    onClose: () => void
    vehicleId: string
    onFaultReported: () => void
}

export function ReportFaultDialog({ isOpen, onClose, vehicleId, onFaultReported }: ReportFaultDialogProps) {
    const [loading, setLoading] = useState(false)
    const [descripcion, setDescripcion] = useState("")
    const [tipo, setTipo] = useState("Mecánica")
    const [prioridad, setPrioridad] = useState("Media")

    async function handleSubmit() {
        if (!descripcion.trim()) {
            toast.error("Por favor describe la falla")
            return
        }

        setLoading(true)
        try {
            const supabase = createClient()
            const { error } = await supabase
                .from('fallas')
                .insert({
                    vehiculo_id: vehicleId,
                    descripcion: descripcion,
                    tipo_falla: tipo,
                    prioridad: prioridad,
                    estado: 'Pendiente'
                })

            if (error) throw error

            toast.success("Falla reportada correctamente")
            setDescripcion("")
            setTipo("Mecánica")
            setPrioridad("Media")
            onFaultReported()
            onClose()
        } catch (error) {
            console.error("Error reporting fault:", error)
            toast.error("Error al reportar la falla")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md rounded-2xl border-none shadow-2xl">
                <DialogHeader>
                    <div className="mx-auto bg-amber-100 w-12 h-12 rounded-full flex items-center justify-center mb-4 text-amber-600">
                        <AlertTriangle size={24} />
                    </div>
                    <DialogTitle className="text-center text-xl font-bold text-zinc-900">Reportar Falla</DialogTitle>
                    <DialogDescription className="text-center text-zinc-500">
                        Describe el problema para que el taller pueda revisarlo.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-zinc-700">Tipo de Falla</label>
                        <Select value={tipo} onValueChange={setTipo}>
                            <SelectTrigger className="h-11 rounded-xl">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Mecánica">Mecánica</SelectItem>
                                <SelectItem value="Eléctrica">Eléctrica</SelectItem>
                                <SelectItem value="Cauchos">Cauchos</SelectItem>
                                <SelectItem value="Carrocería">Carrocería</SelectItem>
                                <SelectItem value="Otro">Otro</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-zinc-700">Prioridad</label>
                        <Select value={prioridad} onValueChange={setPrioridad}>
                            <SelectTrigger className="h-11 rounded-xl">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Baja">Baja (Puede esperar)</SelectItem>
                                <SelectItem value="Media">Media (Revisar pronto)</SelectItem>
                                <SelectItem value="Alta">Alta (Urgente)</SelectItem>
                                <SelectItem value="Crítica">Crítica (Vehículo parado)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-zinc-700">Descripción</label>
                        <Textarea
                            placeholder="Ej. Ruido en los frenos traseros al detenerse..."
                            value={descripcion}
                            onChange={(e) => setDescripcion(e.target.value)}
                            className="h-32 rounded-xl resize-none text-base"
                        />
                    </div>
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button variant="outline" onClick={onClose} className="rounded-xl h-11">
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={loading} className="rounded-xl h-11 bg-black text-white hover:bg-zinc-800">
                        {loading ? "Enviando..." : "Reportar Falla"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
