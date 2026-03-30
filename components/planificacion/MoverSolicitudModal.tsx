'use client';

import { useState } from 'react';
import { X, ArrowRightLeft } from 'lucide-react';
import type { Equipo, SolicitudPlanificacion } from '@/lib/types/planificacion';
import { cn } from '@/lib/utils';

interface MoverSolicitudModalProps {
    isOpen: boolean;
    onClose: () => void;
    onMove: (solicitudId: string, newTeamId: number) => void;
    equipos: Equipo[];
    solicitud?: SolicitudPlanificacion;
}

export function MoverSolicitudModal({ isOpen, onClose, onMove, equipos, solicitud }: MoverSolicitudModalProps) {
    const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);

    if (!isOpen || !solicitud) return null;

    const availableTeams = equipos.filter(t => t.id !== solicitud.equipo_id);
    const clientName = `${solicitud.nombres} ${solicitud.apellidos}`.trim();

    const handleConfirm = () => {
        if (!selectedTeamId) return;
        onMove(solicitud.id, selectedTeamId);
        onClose();
        setSelectedTeamId(null);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-[#18181b] w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border border-zinc-200 dark:border-white/10">
                {/* Header */}
                <div className="px-6 py-4 border-b border-zinc-100 dark:border-white/5 flex justify-between items-center bg-zinc-50/50 dark:bg-white/5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-500/10 rounded-lg">
                            <ArrowRightLeft className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h3 className="font-bold text-zinc-900 dark:text-white leading-tight">Mover Solicitud</h3>
                            <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{clientName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-700 dark:text-white/40 dark:hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">
                        Selecciona el nuevo equipo
                    </label>

                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                        {availableTeams.map(team => (
                            <button
                                key={team.id}
                                onClick={() => setSelectedTeamId(team.id)}
                                className={cn(
                                    "w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center gap-4 group",
                                    selectedTeamId === team.id
                                        ? "bg-blue-50 dark:bg-blue-500/10 border-blue-500 dark:border-blue-400 shadow-sm"
                                        : "bg-white dark:bg-white/5 border-zinc-200 dark:border-white/5 hover:border-blue-300 dark:hover:border-white/20"
                                )}
                            >
                                <div className={cn(
                                    "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black shrink-0 transition-colors",
                                    selectedTeamId === team.id
                                        ? "bg-blue-500 text-white shadow-md shadow-blue-500/20"
                                        : "bg-zinc-100 dark:bg-white/10 text-zinc-400 dark:text-white/40 group-hover:bg-blue-100 dark:group-hover:bg-blue-500/20 group-hover:text-blue-600 dark:group-hover:text-blue-400"
                                )}>
                                    {team.nombre.charAt(0).toUpperCase()}
                                </div>

                                <div className="flex flex-col min-w-0">
                                    <h4 className={cn(
                                        "text-sm font-bold leading-tight truncate",
                                        selectedTeamId === team.id
                                            ? "text-blue-700 dark:text-blue-300"
                                            : "text-zinc-800 dark:text-white"
                                    )}>
                                        {team.nombre}
                                    </h4>
                                    {team.zona_asignada && (
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-white/30 truncate mt-0.5">
                                            {team.zona_asignada}
                                        </span>
                                    )}
                                </div>
                            </button>
                        ))}

                        {availableTeams.length === 0 && (
                            <div className="text-center py-8 text-zinc-400 text-sm">No hay otros equipos disponibles.</div>
                        )}
                    </div>

                    <div className="mt-6 flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 text-sm font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={!selectedTeamId}
                            className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            Mover
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
