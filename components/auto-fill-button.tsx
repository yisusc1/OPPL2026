"use client"

import { Button } from "@/components/ui/button"
import { Wand2 } from "lucide-react"
import { toast } from "sonner"

type Phase = "assignment" | "review" | "closure"

interface AutoFillButtonProps {
    phase: Phase
    onFill: (data: any) => void
    existingData?: any
}

export function AutoFillButton({ phase, onFill, existingData }: AutoFillButtonProps) {

    const generateRandomSerial = (prefix: string, length: number) => {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
        let result = prefix
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        return result
    }

    const generateRandomMac = () => {
        return "XX:XX:" + Array.from({ length: 4 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase()).join(":")
    }

    const generateRandomCoords = () => {
        // Approx Venezuela coords
        const lat = (8 + Math.random() * 2).toFixed(6)
        const lon = (-66 + Math.random() * 2).toFixed(6)
        return `${lat}, ${lon}`
    }

    const handleAutoFill = () => {
        const baseData: any = {}

        if (phase === "assignment") {
            // Usually pre-filled, but can fill gaps
            baseData.onu = generateRandomSerial("ZTEGC", 8)
        }

        if (phase === "review") {
            baseData.ubicacion = "Zona " + Math.floor(Math.random() * 100)
            baseData.precinto = Math.floor(10000000 + Math.random() * 90000000).toString()
            baseData.mac_onu = generateRandomMac()
            baseData.caja_nap = "NAP-" + Math.floor(Math.random() * 50)
            baseData.cant_puertos = "16"
            baseData.puerto_conectado = Math.floor(1 + Math.random() * 16).toString()
            baseData.coordenadas = generateRandomCoords()
            baseData.potencia_nap = "-" + (15 + Math.random() * 10).toFixed(2)
            baseData.potencia_cliente = "-" + (18 + Math.random() * 5).toFixed(2)
            baseData.observacion = "Prueba automática: Todo ok."
        }

        if (phase === "closure") {
            // Requires Spool Code! We assume specific existing data or pick first? 
            // We can't easily valid spool code without access to props list. 
            // We will leave spool blank or try to pick one if passed?
            // The user will have to select Spool manually if logic complex.
            // But let's fill numeric fields.
            baseData.v_descarga = "300"
            baseData.v_subida = "300"
            baseData.metraje_usado = Math.floor(50 + Math.random() * 150).toString()
            baseData.metraje_desechado = Math.floor(Math.random() * 10).toString()
            baseData.conectores = "2"
            baseData.tensores = "2"
            baseData.power_go = "Activo"
            baseData.estatus = "Activo"
            baseData.observacion_final = "Instalación completada (Auto-fill)."
            // Boolean toggles
            baseData.patchcord = Math.random() > 0.5
            baseData.rosetas = Math.random() > 0.5
            baseData.venta_router = false
        }

        onFill(baseData)
        toast.success("Formulario rellenado con datos de prueba 🪄")
    }

    return (
        <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleAutoFill}
            title="Auto-rellenar (Test)"
            className="fixed bottom-24 right-6 z-50 h-14 w-14 rounded-full bg-purple-600 text-white shadow-lg hover:bg-purple-700 border-none"
        >
            <Wand2 size={24} />
        </Button>
    )
}
