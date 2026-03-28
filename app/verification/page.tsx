"use client"

import { useState } from "react"
import { SupportReportDialog } from "@/components/support-report-dialog"
import { Button } from "@/components/ui/button"

export default function VerificationPage() {
    const [open, setOpen] = useState(true)

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-100 p-4">
            <h1 className="text-2xl font-bold mb-4">Modo de Verificación UI</h1>
            <p className="mb-8 text-zinc-500">Esta página es temporal para probar el formulario sin iniciar sesión.</p>

            <Button onClick={() => setOpen(true)} size="lg">
                Abrir Formulario de Soporte
            </Button>

            <SupportReportDialog
                open={open}
                onOpenChange={setOpen}
            />
        </div>
    )
}
