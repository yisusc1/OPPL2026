"use client"

import { useState, useMemo } from "react"
import { Command, Search, User, Loader2, Phone, IdCard, UserX } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export interface Driver {
    id: string
    first_name?: string
    last_name?: string
    national_id?: string
    phone?: string
    currentVehicle?: {
        id: string
        modelo: string
        placa: string
    } | null
}

interface DriverSelectorProps {
    drivers: Driver[]
    selectedDriverId?: string | null
    onSelect: (driver: Driver | null) => void
    loading?: boolean
    label?: string
}

export function DriverSelector({
    drivers,
    selectedDriverId,
    onSelect,
    loading = false,
    label = "Conductor Asignado"
}: DriverSelectorProps) {
    const [open, setOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")

    const selectedDriver = useMemo(() =>
        selectedDriverId && selectedDriverId !== 'none'
            ? drivers.find(d => d.id === selectedDriverId)
            : null,
        [drivers, selectedDriverId])

    const filteredDrivers = useMemo(() => {
        if (!searchTerm) return drivers
        const lower = searchTerm.toLowerCase()
        return drivers.filter(d =>
            (d.first_name?.toLowerCase().includes(lower) || false) ||
            (d.last_name?.toLowerCase().includes(lower) || false) ||
            (d.national_id?.toLowerCase().includes(lower) || false)
        )
    }, [drivers, searchTerm])

    const handleSelect = (driver: Driver | null) => {
        onSelect(driver)
        setOpen(false)
        setSearchTerm("")
    }

    return (
        <div className="space-y-3">
            {/* Label only rendered here, ensure parent doesn't duplicate or use empty string prop if needed */}
            {label && <Label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{label}</Label>}

            {selectedDriver ? (
                <div className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center shrink-0">
                            <User size={18} className="text-zinc-500 dark:text-zinc-400" />
                        </div>
                        <div>
                            <div className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                                {selectedDriver.first_name} {selectedDriver.last_name}
                            </div>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-3 mt-0.5">
                                {selectedDriver.national_id && (
                                    <span className="flex items-center gap-1">
                                        <IdCard size={12} />
                                        {selectedDriver.national_id}
                                    </span>
                                )}
                                {selectedDriver.phone && (
                                    <span className="flex items-center gap-1">
                                        <Phone size={12} />
                                        {selectedDriver.phone}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setOpen(true)}
                        className="text-xs h-8 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                    >
                        Cambiar
                    </Button>
                </div>
            ) : (
                <Button
                    variant="outline"
                    onClick={() => setOpen(true)}
                    className="w-full justify-start h-12 rounded-xl text-zinc-500 dark:text-zinc-400 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 bg-white dark:bg-zinc-900"
                >
                    <User className="mr-2 h-4 w-4" />
                    Seleccionar Conductor...
                </Button>
            )}

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-md p-0 gap-0 overflow-hidden bg-white dark:bg-zinc-900 border-none rounded-2xl shadow-2xl">
                    <DialogHeader className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                        <DialogTitle className="text-base font-bold text-zinc-900 dark:text-zinc-100">Seleccionar Conductor</DialogTitle>
                    </DialogHeader>

                    <div className="p-4 space-y-4">
                        <div className="relative">
                            <Command className="absolute left-3 top-3 text-zinc-400" size={16} />
                            <Input
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Buscar por nombre o cédula..."
                                className="pl-9 h-11 rounded-xl bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus-visible:ring-black dark:focus-visible:ring-white transition-all"
                                autoFocus
                            />
                        </div>

                        <div className="max-h-[60vh] overflow-y-auto -mx-2 px-2 space-y-1 custom-scrollbar">
                            {/* Unassign Option */}
                            <div
                                onClick={() => handleSelect(null)}
                                className={`p-3 rounded-xl cursor-pointer flex items-center gap-3 transition-all mb-2 border hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-200 dark:hover:border-red-900/30 group
                                    ${!selectedDriverId ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700' : 'bg-transparent border-dashed border-zinc-300 dark:border-zinc-700'}
                                `}
                            >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${!selectedDriverId ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 group-hover:text-red-500 group-hover:bg-red-100 dark:group-hover:bg-red-900/40'}`}>
                                    <UserX size={14} />
                                </div>
                                <div className={`font-bold text-sm ${!selectedDriverId ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400 group-hover:text-red-600 dark:group-hover:text-red-400'}`}>
                                    Sin Conductor (Desasignar)
                                </div>
                                {!selectedDriverId && (
                                    <div className="ml-auto text-[10px] font-bold text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 px-2 py-1 rounded-md shrink-0 shadow-sm">
                                        Seleccionado
                                    </div>
                                )}
                            </div>

                            {loading ? (
                                <div className="py-8 text-center text-zinc-400 text-sm flex flex-col items-center gap-2">
                                    <Loader2 className="animate-spin" size={20} />
                                    <span>Cargando conductores...</span>
                                </div>
                            ) : filteredDrivers.length === 0 ? (
                                <div className="py-8 text-center text-zinc-400 text-sm">
                                    {searchTerm ? "No se encontraron resultados" : "No hay conductores disponibles"}
                                </div>
                            ) : (
                                filteredDrivers.map(d => (
                                    <div
                                        key={d.id}
                                        onClick={() => handleSelect(d)}
                                        className={`p-3 rounded-xl cursor-pointer flex justify-between items-center transition-all group
                                            ${selectedDriverId === d.id ? 'bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 border border-transparent'}
                                        `}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors
                                                ${selectedDriverId === d.id ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300'}
                                            `}>
                                                <User size={14} />
                                            </div>
                                            <div>
                                                <div className="font-bold text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-black dark:group-hover:text-white transition-colors">
                                                    {d.first_name} {d.last_name}
                                                </div>
                                                <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-3">
                                                    {d.national_id && (
                                                        <span className="flex items-center gap-1">
                                                            <IdCard size={12} className="text-zinc-400 dark:text-zinc-500" />
                                                            {d.national_id}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {d.currentVehicle && d.currentVehicle.id !== (selectedDriver?.currentVehicle?.id) && (
                                            <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-md shrink-0">
                                                {d.currentVehicle.modelo}
                                            </div>
                                        )}
                                        {selectedDriverId === d.id && (
                                            <div className="text-[10px] font-bold text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 px-2 py-1 rounded-md shrink-0 shadow-sm ml-2">
                                                Actual
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
