'use client';

import { useState, useEffect } from 'react';
import { X, Users, MapPin, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TecnicoDisponible, EquipoMiembro } from '@/lib/types/planificacion';
import { getTecnicos } from '@/app/actions/planificacion';

interface NuevoEquipoModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (nombre: string, zona: string | undefined, miembroIds: string[]) => Promise<void>;
    equipos: import('@/lib/types/planificacion').Equipo[];
    initialData?: {
        id: number;
        nombre: string;
        zona_asignada?: string | null;
        miembros?: EquipoMiembro[];
    };
}

export function NuevoEquipoModal({ isOpen, onClose, onConfirm, equipos, initialData }: NuevoEquipoModalProps) {
    const [nombre, setNombre] = useState('');
    const [zona, setZona] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [tecnicos, setTecnicos] = useState<TecnicoDisponible[]>([]);
    const [loadingTecnicos, setLoadingTecnicos] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [confirmMove, setConfirmMove] = useState<{ id: string, name: string, teamName: string } | null>(null);

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
        const isAdding = !selectedIds.includes(id);

        if (isAdding) {
            const currentTeam = equipos.find(eq => 
                eq.id !== initialData?.id && 
                eq.miembros?.some(m => m.user_id === id)
            );

            if (currentTeam) {
                const tec = tecnicos.find(t => t.id === id);
                setConfirmMove({
                    id,
                    name: `${tec?.first_name} ${tec?.last_name}`.trim(),
                    teamName: currentTeam.nombre
                });
                return; // Wait for user to confirm via UI
            }
        }

        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const confirmTransfer = () => {
        if (!confirmMove) return;
        setSelectedIds(prev => [...prev, confirmMove.id]);
        setConfirmMove(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nombre.trim()) return;
        
        setIsSubmitting(true);
        try {
            await onConfirm(nombre.trim(), zona.trim() || undefined, selectedIds);
            setNombre('');
            setZona('');
            setSelectedIds([]);
            onClose();
        } catch (error) {
            // Error is handled by the parent components (toast)
        } finally {
            setIsSubmitting(false);
        }
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

                {/* Conditional View: Form vs Confirm Move */}
                {confirmMove ? (
                    <div className="p-6 flex flex-col items-center text-center">
                        <div className="w-16 h-16 rounded-3xl bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center mb-5 rotate-12">
                            <Users className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-black text-zinc-900 dark:text-white mb-2 leading-tight">
                            Técnico Ocupado
                        </h3>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-8">
                            El técnico <span className="font-bold text-zinc-900 dark:text-white">{confirmMove.name}</span> ya pertenece al <span className="font-bold text-zinc-900 dark:text-white">"{confirmMove.teamName}"</span>.
                            <br/><br/>
                            ¿Desea transferir a este técnico a tu equipo actual? Se removerá del otro grupo automáticamente al guardar los cambios.
                        </p>

                        <div className="flex gap-3 w-full">
                            <button
                                type="button"
                                onClick={() => setConfirmMove(null)}
                                className="flex-1 px-4 py-3 rounded-xl border border-zinc-200 dark:border-white/10 text-sm font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={confirmTransfer}
                                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold shadow-lg shadow-orange-500/20 transition-all"
                            >
                                <Check className="w-4 h-4" /> Transferir
                            </button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6">
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
                                        
                                        const assignedTeam = equipos.find(eq => 
                                            eq.id !== (initialData?.id || -1) && 
                                            eq.miembros?.some(m => m.user_id === tec.id)
                                        );

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

                                                {assignedTeam && !isSelected && (
                                                    <span className="text-[9px] font-bold uppercase tracking-wider bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400 px-2.5 py-1 rounded-md shrink-0 border border-orange-200 dark:border-orange-800">
                                                        En {assignedTeam.nombre}
                                                    </span>
                                                )}
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
                                disabled={isSubmitting}
                                onClick={onClose}
                                className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 text-sm font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={!nombre.trim() || isSubmitting}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : isEditing ? 'Guardar' : 'Crear Equipo'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
