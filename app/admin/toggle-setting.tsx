"use client"

import { Switch } from "@/components/ui/switch"
import { useState, useTransition } from "react"
import { toast } from "sonner"

export function ToggleSetting({ initialState, action }: { initialState: boolean, action: () => Promise<any> }) {
    const [checked, setChecked] = useState(initialState)
    const [isPending, startTransition] = useTransition()

    const handleToggle = () => {
        // Optimistic UI
        const newValue = !checked
        setChecked(newValue)

        startTransition(async () => {
            try {
                const result = await action()
                if (result.value !== newValue) {
                    // Revert if server response differs (unlikely)
                    setChecked(result.value)
                }
                toast.success(newValue ? "Restricción Activada" : "Restricción Desactivada")
            } catch (error) {
                // Revert on error
                setChecked(!newValue)
                toast.error("Error al actualizar la configuración")
                console.error(error)
            }
        })
    }

    return (
        <Switch
            checked={checked}
            onCheckedChange={handleToggle}
            disabled={isPending}
            className="data-[state=checked]:bg-emerald-600"
        />
    )
}
