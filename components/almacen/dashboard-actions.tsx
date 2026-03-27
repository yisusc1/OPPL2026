"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Truck, RotateCcw } from "lucide-react"
import { DispatchDialog } from "@/components/almacen/dispatch-dialog"
import { ReturnDialog } from "@/components/almacen/return-dialog"
import { useRouter } from "next/navigation"

export function DashboardActions() {
    const [openDispatch, setOpenDispatch] = useState(false)
    const [openReturn, setOpenReturn] = useState(false)
    const router = useRouter()

    const handleSuccess = () => {
        router.refresh()
    }

    return (
        <div className="flex gap-2">
            <Button
                onClick={() => setOpenDispatch(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
            >
                <Truck size={16} />
                Nueva Salida
            </Button>

            <Button
                onClick={() => setOpenReturn(true)}
                variant="outline"
                className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
            >
                <RotateCcw size={16} />
                Devolución
            </Button>

            <DispatchDialog
                open={openDispatch}
                onOpenChange={setOpenDispatch}
                onSave={handleSuccess}
            />

            <ReturnDialog
                open={openReturn}
                onOpenChange={setOpenReturn}
                onSave={handleSuccess}
            />

            <Button
                variant="ghost"
                onClick={() => router.push('/almacen/bajas')}
                className="text-zinc-500 hover:text-red-600 hover:bg-red-50 gap-2"
            >
                <div className="flex h-5 w-5 items-center justify-center rounded-full border border-current">
                    <span className="text-[10px] font-bold">!</span>
                </div>
                Bajas
            </Button>
        </div>
    )
}
