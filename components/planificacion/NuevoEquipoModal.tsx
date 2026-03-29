'use client';

import { useState, useEffect } from 'react';
import { X, Users, MapPin, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TecnicoDisponible, EquipoMiembro } from '@/lib/types/planificacion';
import { getTecnicos } from '@/app/actions/planificacion';

interface NuevoEquipoModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (nombre: string, zona: string | undefined, miembroIds: string[]) => void;
    initialData?: {
        id: number;
        nombre: string;
        zona_asignada?: string | null;
        miembros?: EquipoMiembro[];
    };
}

export function NuevoEquipoModal({ isOpen, onClose, onConfirm, initialData }: NuevoEquipoModalProps) {
    const [nombre, setNombre] = useState('');
    const [zona, setZona] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [tecnicos, setTecnicos] = useState<TecnicoDisponible[]>([]);
    const [loadingTecnicos, setLoadingTecnicos] = useState(false);

    const isEditing = !!initialData;

    useEffect(() => {
        if (isOpen) {
            setNombre(initialData?.nombre || '');
            setZona(initialData?.zona_asignada || '');
            setSelectedIds(initialData?.miembros?.map(m => m.user_id) || []);

            // Load technicians
            setLoadingTecnicos(true);
            getTecnicos()
                .then(setTecnicos)
                .catch(() => setTecnicos([]))
                .finally(() => setLoadingTecnicos(false));
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const toggleTecnico = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!nombre.trim()) return;
        onConfirm(nombre.trim(), zona.trim() || undefined, selectedIds);
        setNombre('');
        setZona('');
        setSelectedIds([]);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-[#18181b] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-zinc-200 dark:border-white/10">
                {/* Header */}
                <div className="px-6 py-4 border-b border-zinc-100 dark:border-white/5 flex justify-between items-center bg-zinc-50/50 dark:bg-white/5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-500/10 rounded-lg">
                            <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <h3 className="font-bold text-zinc-900 dark:text-white">
                            {isEditing ? 'Editar Equipo' : 'Nuevo Equipo'}
                        </h3>
                    </div>
                    <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-700 dark:text-white/40 dark:hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Team Name */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
                            Nombre del equipo
                        </label>
                        <input
                            autoFocus
                            type="text"
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                            placeholder="Ej: Equipo A"
                            className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all outline-none font-medium text-zinc-900 dark:text-white placeholder:text-zinc-400"
                        />
                    </div>

                    {/* Zone */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
                            <MapPin className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                            Zona asignada <span className="normal-case font-normal">(opcional)</span>
                        </label>
                        <input
                            type="text"
                            value={zona}
                            onChange={(e) => setZona(e.target.value)}
                            placeholder="Ej: Coche, El Valle"
                            className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all outline-none font-medium text-zinc-900 dark:text-white placeholder:text-zinc-400"
                        />
                    </div>

                    {/* Technician Selector */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
                            <Users className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                            Miembros del equipo
                            {selectedIds.length > 0 && (
                                <span className="ml-2 text-indigo-600 dark:text-indigo-400 normal-case">
                                    ({selectedIds.length} seleccionados)
                                </span>
                            )}
                        </label>

                        {loadingTecnicos ? (
                            <div className="flex items-center justify-center py-6">
                                <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                            </div>
                        ) : tecnicos.length === 0 ? (
                            <div className="text-sm text-zinc-400 italic p-4 text-center bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-200 dark:border-white/10">
                                No hay técnicos registrados en el departamento de Instalación
                            </div>
                        ) : (
                            <div className="rounded-xl border border-zinc-200 dark:border-white/10 overflow-hidden max-h-[220px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                                {tecnicos.map((tec) => {
                                    const isSelected = selectedIds.includes(tec.id);
                                    const fullName = `${tec.first_name} ${tec.last_name}`.trim();
                                    return (
                                        <button
                                            key={tec.id}
                                            type="button"
                                            onClick={() => toggleTecnico(tec.id)}
                                            className={cn(
                                                "w-full flex items-center justify-between px-4 py-3 text-left transition-all border-b border-zinc-100 dark:border-white/5 last:border-b-0",
                                                isSelected
                                                    ? "bg-indigo-50 dark:bg-indigo-500/10"
                                                    : "hover:bg-zinc-50 dark:hover:bg-white/5"
                                            )}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 transition-colors",
                                                    isSelected
                                                        ? "bg-indigo-600 text-white"
                                                        : "bg-zinc-100 dark:bg-white/10 text-zinc-400 dark:text-zinc-500"
                                                )}>
                                                    {isSelected
                                                        ? <Check className="w-4 h-4" />
                                                        : fullName.charAt(0).toUpperCase()
                                                    }
                                                </div>
                                                <div>
                                                    <p className={cn(
                                                        "text-sm font-semibold leading-tight",
                                                        isSelected ? "text-indigo-700 dark:text-indigo-300" : "text-zinc-800 dark:text-zinc-200"
                                                    )}>
                                                        {fullName}
                                                    </p>
                                                    {tec.job_title && (
                                                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">
                                                            {tec.job_title}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 text-sm font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={!nombre.trim()}
                            className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {isEditing ? 'Guardar' : 'Crear Equipo'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
