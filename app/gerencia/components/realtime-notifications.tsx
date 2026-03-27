"use client"

import { useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { AlertTriangle, Wrench } from "lucide-react"
import { useRouter } from "next/navigation" // [NEW]

export function RealtimeNotifications() {
    const router = useRouter() // [NEW]

    useEffect(() => {
        const supabase = createClient()

        // Listener for FAULTS (Fallas)
        const faultsChannel = supabase
            .channel('realtime-faults')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'fallas' },
                (payload) => {
                    const newFault = payload.new as any

                    // Custom Toast
                    toast.custom((t) => (
                        <div className="bg-red-50 border border-red-100 p-4 rounded-2xl shadow-lg flex gap-4 w-full max-w-sm">
                            <div className="p-2 bg-red-100 rounded-full h-10 w-10 flex items-center justify-center text-red-600">
                                <AlertTriangle size={20} />
                            </div>
                            <div>
                                <h4 className="font-bold text-red-900">¡Nueva Falla Reportada!</h4>
                                <p className="text-sm text-red-700 mt-1 line-clamp-2">
                                    {newFault.descripcion}
                                </p>
                                <div className="mt-2 text-xs font-mono bg-red-100/50 text-red-800 px-2 py-1 rounded-lg inline-block">
                                    Prioridad: {newFault.prioridad}
                                </div>
                            </div>
                        </div>
                    ), { duration: 5000 })

                    // Audio Alert
                    const audio = new Audio('/notification.mp3') // Assuming we might add one, or browser default beep not possible without interaction. 
                    // Use Speech Synthesis for alert
                    if (window.speechSynthesis) {
                        const u = new SpeechSynthesisUtterance("Alerta gerente. Nueva falla de vehículo reportada.")
                        window.speechSynthesis.speak(u)
                    }

                    // Refresh data
                    router.refresh()
                }
            )
            .subscribe()

        // [NEW] Listener for TRIPS (Reports)
        const tripsChannel = supabase
            .channel('realtime-trips')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'reportes' }, // Listen to everything on reportes
                (payload) => {
                    console.log("Trip update detected, refreshing dashboard...", payload)
                    router.refresh()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(faultsChannel)
            supabase.removeChannel(tripsChannel)
        }
    }, [router])

    return null // Invisible component
}
