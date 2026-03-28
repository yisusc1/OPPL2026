"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { finalizeDayAction } from "../actions"
import { toast } from "sonner"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export function FinalizeDayButton() {
    const [loading, setLoading] = useState(false)

    const handleFinalize = async () => {
        setLoading(true)
        try {
            const res = await finalizeDayAction()
            if (res.success) {
                toast.success("Jornada finalizada correctamente")
            } else {
                toast.error("Error al finalizar: " + res.error)
            }
        } catch (e) {
            toast.error("Error inesperado")
        } finally {
            setLoading(false)
        }
    }

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button
                    className="bg-white text-slate-900 hover:bg-slate-100 font-bold px-8 py-6 rounded-xl shadow-lg shadow-white/10 w-full md:w-auto"
                    disabled={loading}
                >
                    {loading ? "Finalizando..." : "Finalizar Jornada"}
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-3xl border-none shadow-2xl bg-white">
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-xl font-bold text-slate-900">¿Finalizar Jornada?</AlertDialogTitle>
                    <AlertDialogDescription className="text-slate-500 text-base">
                        Si finaliza la jornada, todo su progreso del día se cerrará y no podrá realizar más cambios hoy.
                        Se generará automáticamente su reporte de auditoría.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl h-12 border-slate-200 text-slate-900 font-medium">Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleFinalize}
                        className="rounded-xl h-12 bg-slate-900 hover:bg-slate-800 text-white font-medium"
                    >
                        Confirmar Finalización
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
