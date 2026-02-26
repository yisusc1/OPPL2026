"use client"

import { useState, useMemo } from "react"
import { Command, Search, Car, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

export interface Vehicle {
    id: string
    placa: string
    modelo: string
    tipo?: string
    kilometraje?: number | null
    codigo?: string // Useful for "Salida" display
}

interface VehicleSelectorProps {
    vehicles: Vehicle[]
    selectedVehicleId?: string
    onSelect: (vehicle: Vehicle | null) => void
    loading?: boolean
    label?: string
}

export function VehicleSelector({
    vehicles,
    selectedVehicleId,
    onSelect,
    loading = false,
    label = "Vehículo"
}: VehicleSelectorProps) {
    const [searchTerm, setSearchTerm] = useState("")

    const selectedVehicle = useMemo(() =>
        vehicles.find(v => v.id === selectedVehicleId),
        [vehicles, selectedVehicleId])

    const filteredVehicles = useMemo(() => {
        if (!searchTerm) return vehicles
        const lower = searchTerm.toLowerCase()
        return vehicles.filter(v =>
            v.placa.toLowerCase().includes(lower) ||
            v.modelo.toLowerCase().includes(lower) ||
            (v.codigo && v.codigo.toLowerCase().includes(lower))
        )
    }, [vehicles, searchTerm])

    if (selectedVehicle) {
        return (
            <div className="space-y-3">
                <Label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{label}</Label>
                <div className="flex items-center justify-between p-3 bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl shadow-sm animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-zinc-100 dark:bg-white/5 rounded-full flex items-center justify-center shrink-0">
                            <Car size={18} className="text-zinc-500 dark:text-muted-foreground" />
                        </div>
                        <div>
                            <div className="font-bold text-sm text-zinc-900 dark:text-foreground">{selectedVehicle.modelo}</div>
                            <div className="text-xs text-zinc-500 dark:text-muted-foreground font-mono flex items-center gap-2">
                                <span>{selectedVehicle.placa}</span>
                                {selectedVehicle.codigo && (
                                    <span className="bg-zinc-100 dark:bg-white/5 px-1.5 rounded text-zinc-600 dark:text-zinc-300">{selectedVehicle.codigo}</span>
                                )}
                            </div>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            onSelect(null)
                            setSearchTerm("")
                        }}
                        className="text-xs h-8 text-zinc-500 hover:text-zinc-900 dark:text-muted-foreground dark:hover:text-foreground"
                    >
                        Cambiar
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            <Label className="text-xs font-bold text-zinc-500 dark:text-muted-foreground uppercase tracking-wider">{label}</Label>
            <div className="relative">
                <div className="relative">
                    <Command className="absolute left-3 top-3 text-zinc-400 dark:text-muted-foreground" size={16} />
                    <Input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar placa, modelo o código..."
                        className="pl-9 h-12 rounded-xl bg-white dark:bg-white/5 border-zinc-200 dark:border-white/10 focus-visible:ring-emerald-500 text-zinc-900 dark:text-foreground placeholder:text-zinc-400 dark:placeholder:text-muted-foreground"
                    />
                </div>

                {/* Dropdown list - Always render if we have vehicles (filtered or all) */}
                {(filteredVehicles.length > 0 || loading) && (
                    <div className="absolute z-50 w-full mt-2 max-h-60 overflow-y-auto border border-zinc-200 dark:border-white/10 rounded-xl bg-white dark:bg-zinc-950/95 backdrop-blur-xl shadow-2xl divide-y divide-zinc-100 dark:divide-white/5 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                        {loading ? (
                            <div className="p-8 text-center text-zinc-400 dark:text-muted-foreground text-sm flex flex-col items-center gap-2">
                                <Loader2 className="animate-spin" size={20} />
                                <span>Cargando vehículos...</span>
                            </div>
                        ) : filteredVehicles.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground text-sm">
                                "No se encontraron resultados"
                            </div>
                        ) : (
                            filteredVehicles.map(v => (
                                <div
                                    key={v.id}
                                    onClick={() => {
                                        onSelect(v)
                                        setSearchTerm("")
                                    }}
                                    className="p-3 hover:bg-zinc-50 dark:hover:bg-white/10 cursor-pointer flex justify-between items-center transition-colors group"
                                >
                                    <div>
                                        <div className="font-bold text-sm text-zinc-900 dark:text-foreground">{v.modelo}</div>
                                        <div className="text-xs text-zinc-500 dark:text-muted-foreground font-mono flex items-center gap-2">
                                            {v.placa}
                                            {v.codigo && <span className="text-zinc-300 dark:text-zinc-600">|</span>}
                                            {v.codigo}
                                        </div>
                                    </div>
                                    {(v.kilometraje !== undefined && v.kilometraje !== null) && (
                                        <div className="text-xs font-bold text-zinc-500 dark:text-muted-foreground bg-zinc-100 dark:bg-white/5 px-2 py-1 rounded-md">
                                            {v.kilometraje.toLocaleString()} km
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}
                {/* Show all when focused behavior might be needed, currently only showing when searchTerm exists or default list logic from before? 
                     Previous logic: 
                      <div className="mt-2 max-h-60 overflow-y-auto border ...">
                     It was NOT absolute before. It was just inline.
                     The screenshot shows it popping over related fields? No, it looks inline in the screenshot but "floating" nature.
                     Wait, standard combobox usually floats.
                     The previous code displayed the list inline below the input (lines 98-131).
                     I will keep it inline for now but style it, unless I should make it absolute. 
                     If I make it inline, it pushes content down. If absolute, it floats.
                     The user's screenshot shows it seemingly floating over nothing (white background), but hard to tell if it pushed content.
                     Let's keep it inline but Styled correctly first.
                     Actually, looking at the code again, I'll stick to the inline structure but with dark styles.
                  */}
            </div>
        </div>
    )
}
// Re-doing the replacement to match the original structure more closely but with styles changed.

