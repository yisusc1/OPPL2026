'use client';

import { useState, useEffect } from 'react';
import { X, CheckCircle2, User, MapPin, Phone, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SolicitudPlanificacion, EstatusPlanificacion, Equipo } from '@/lib/types/planificacion';

interface EditarSolicitudModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (id: string, updates: { estatus: EstatusPlanificacion; equipo_id?: number; motivo?: string; notas?: string; nueva_fecha_disponibilidad?: string }) => void;
    solicitud?: SolicitudPlanificacion;
    equipos: Equipo[];
    initialMode?: 'edit' | 'move' | 'status';
}

export function EditarSolicitudModal({
    isOpen, onClose, onSave, solicitud, equipos, initialMode = 'edit'
}: EditarSolicitudModalProps) {
    const [status, setStatus] = useState<EstatusPlanificacion>('pendiente');
    const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
    const [motivo, setMotivo] = useState('');
    const [notas, setNotas] = useState('');
    const [nuevaFecha, setNuevaFecha] = useState('');
    const [currentMode, setCurrentMode] = useState(initialMode);

    useEffect(() => {
        if (isOpen && solicitud) {
            setStatus(solicitud.estatus_planificacion);
            setSelectedTeamId(solicitud.equipo_id || null);
            setMotivo(solicitud.motivo_reprogramacion || '');
            setNotas(solicitud.notas_planificacion || '');
            setCurrentMode(initialMode);
        }
    }, [isOpen, solicitud, initialMode]);

    if (!isOpen || !solicitud) return null;

    const clientName = `${solicitud.nombres} ${solicitud.apellidos}`.trim();
    const locationParts = [solicitud.parroquia, solicitud.sector, solicitud.direccion].filter(Boolean);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (status === 'reprogramado' && !motivo.trim()) return;
        onSave(solicitud.id, {
            estatus: status,
            equipo_id: selectedTeamId || undefined,
            motivo: motivo || undefined,
            notas: notas || undefined,
            nueva_fecha_disponibilidad: (status === 'reprogramado' && nuevaFecha) ? nuevaFecha : undefined,
        });
        onClose();
    };

    const getTitle = () => {
        if (currentMode === 'status') return 'Actualizar Estado';
        if (currentMode === 'move') return 'Reasignar Equipo';
        return 'Detalle de Solicitud';
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-[500px] bg-white/95 dark:bg-[#18181b]/95 backdrop-blur-md rounded-2xl shadow-2xl overflow-hidden border border-white/20 ring-1 ring-black/5">
                {/* Header */}
                <div className="flex items-center justify-between p-6 pb-2">
                    <div>
                        <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">{getTitle()}</h2>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{clientName}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full text-zinc-500 dark:text-zinc-400 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-2 max-h-[70vh] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                    <form onSubmit={handleSubmit} className="space-y-5">

                        {/* Read-only client info */}
                        {currentMode === 'edit' && (
                            <div className="space-y-3 p-4 bg-zinc-50 dark:bg-white/5 rounded-xl border border-zinc-100 dark:border-white/5">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <span className="text-[9px] font-bold uppercase text-zinc-400 tracking-wider">Cédula</span>
                                        <p className="text-sm font-mono text-zinc-800 dark:text-zinc-200">{solicitud.cedula}</p>
                                    </div>
                                    <div>
                                        <span className="text-[9px] font-bold uppercase text-zinc-400 tracking-wider">Plan</span>
                                        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{solicitud.plan}</p>
                                    </div>
                                </div>

                                {locationParts.length > 0 && (
                                    <div>
                                        <span className="text-[9px] font-bold uppercase text-zinc-400 tracking-wider">Ubicación</span>
                                        <p className="text-sm text-zinc-700 dark:text-zinc-300 flex items-start gap-1.5 mt-0.5">
                                            <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-50" />
                                            {locationParts.join(', ')}
                                        </p>
                                    </div>
                                )}

                                <div className="flex items-center gap-4 text-sm">
                                    {solicitud.telefono_principal && (
                                        <span className="flex items-center gap-1 text-zinc-500 font-mono text-xs">
                                            <Phone className="w-3 h-3" /> {solicitud.telefono_principal}
                                        </span>
                                    )}
                                    {solicitud.promotor && (
                                        <span className="flex items-center gap-1 text-zinc-500 text-xs">
                                            <User className="w-3 h-3" /> {solicitud.promotor}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Team Selector */}
                        {(currentMode === 'edit' || currentMode === 'move') && (
                            <div className="space-y-3">
                                <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide pl-1">Asignar a Equipo</label>
                                <div className="rounded-xl border border-white/10 bg-black/5 dark:bg-white/5 overflow-hidden backdrop-blur-sm">
                                    <div className="flex flex-col max-h-[250px] overflow-y-auto divide-y divide-zinc-100/10 dark:divide-white/5" style={{ scrollbarWidth: 'none' }}>
                                        {equipos.length === 0 ? (
                                            <div className="text-sm text-zinc-500 italic p-4 text-center">No hay equipos registrados</div>
                                        ) : (
                                            equipos.map((t) => {
                                                const isSelected = selectedTeamId === t.id;
                                                return (
                                                    <button
                                                        key={t.id}
                                                        type="button"
                                                        onClick={() => setSelectedTeamId(t.id)}
                                                        className={cn(
                                                            "flex items-center justify-between p-4 text-left transition-all",
                                                            isSelected
                                                                ? "bg-blue-600/90 text-white backdrop-blur-md"
                                                                : "hover:bg-black/5 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-300"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className={cn(
                                                                "text-lg font-black tracking-tighter shrink-0",
                                                                isSelected ? "text-white/40" : "text-zinc-300 dark:text-zinc-600"
                                                            )}>
                                                                {t.nombre.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className={cn("text-sm font-bold leading-snug", isSelected ? "text-white" : "text-zinc-800 dark:text-zinc-200")}>
                                                                    {t.nombre}
                                                                </span>
                                                                {t.zona_asignada && (
                                                                    <span className={cn("text-[10px] uppercase tracking-wider font-semibold", isSelected ? "text-blue-100" : "text-zinc-400 dark:text-zinc-500")}>
                                                                        {t.zona_asignada}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {isSelected && <CheckCircle2 className="w-5 h-5 text-white" />}
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Status Section */}
                        {(currentMode === 'edit' || currentMode === 'status') && (
                            <>
                                {!(currentMode === 'status' && (status === 'reprogramado' || status === 'error')) && (
                                    <div className="space-y-2 pt-2">
                                        <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">Estado Actual</label>
                                        <div className="grid grid-cols-2 grid-rows-2 w-full h-24 divide-x divide-zinc-200 dark:divide-white/10 border border-zinc-200 dark:border-white/10 rounded-xl overflow-hidden">
                                            <div className="contents">
                                                <button type="button" onClick={() => setStatus('pendiente')} className={cn("flex items-center justify-center text-[10px] font-bold tracking-widest transition-colors border-b border-zinc-200 dark:border-white/10 uppercase", status === 'pendiente' ? "bg-zinc-600 text-white" : "bg-white dark:bg-[#18181b] text-zinc-500 dark:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white")}>PENDIENTE</button>
                                                <button type="button" onClick={() => setStatus('completado')} className={cn("flex items-center justify-center text-[10px] font-bold tracking-widest transition-colors border-b border-zinc-200 dark:border-white/10 uppercase", status === 'completado' ? "bg-emerald-600 text-white" : "bg-white dark:bg-[#18181b] text-zinc-500 dark:text-zinc-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 hover:text-emerald-700 dark:hover:text-emerald-400")}>INSTALADO</button>
                                            </div>
                                            <div className="contents">
                                                <button type="button" onClick={() => setStatus('reprogramado')} className={cn("flex items-center justify-center text-[10px] font-bold tracking-widest transition-colors uppercase", status === 'reprogramado' ? "bg-orange-600 text-white" : "bg-white dark:bg-[#18181b] text-zinc-500 dark:text-zinc-600 hover:bg-orange-100 dark:hover:bg-orange-900/40 hover:text-orange-700 dark:hover:text-orange-400")}>REAGENDAR</button>
                                                <button type="button" onClick={() => setStatus('error')} className={cn("flex items-center justify-center text-[10px] font-bold tracking-widest transition-colors uppercase", status === 'error' ? "bg-blue-600 text-white" : "bg-white dark:bg-[#18181b] text-zinc-500 dark:text-zinc-600 hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:text-blue-700 dark:hover:text-blue-400")}>ERROR</button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {status === 'reprogramado' && (
                                    <div className="space-y-4 pt-2">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wide">Motivo del Reagendamiento</label>
                                            <textarea
                                                className="w-full px-4 py-3 bg-orange-50 dark:bg-zinc-800 border border-orange-200 dark:border-orange-900/40 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-zinc-900 dark:text-white resize-none"
                                                rows={2}
                                                placeholder="Ej: Cliente no se encontraba en el domicilio..."
                                                value={motivo}
                                                onChange={e => setMotivo(e.target.value)}
                                                autoFocus
                                                required
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wide">Nueva Fecha Solicitada</label>
                                            <input
                                                type="date"
                                                className="w-full px-4 py-3 bg-orange-50 dark:bg-zinc-800 border border-orange-200 dark:border-orange-900/40 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-zinc-900 dark:text-white"
                                                value={nuevaFecha}
                                                onChange={e => setNuevaFecha(e.target.value)}
                                                required
                                            />
                                        </div>
                                    </div>
                                )}

                                {status === 'error' && (
                                    <div className="space-y-1.5 pt-2">
                                        <label className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide">Detalle del Error</label>
                                        <textarea
                                            className="w-full px-4 py-3 bg-blue-50 dark:bg-zinc-800 border border-blue-200 dark:border-blue-900/40 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-zinc-900 dark:text-white resize-none"
                                            rows={3}
                                            placeholder="Ej: Fibra rota, caja saturada..."
                                            value={notas}
                                            onChange={e => setNotas(e.target.value)}
                                            autoFocus
                                        />
                                    </div>
                                )}
                            </>
                        )}

                        {/* Footer */}
                        <div className="pt-4 flex justify-end gap-3 p-2">
                            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition-colors">Cancelar</button>
                            <button type="submit" className="px-6 py-2.5 text-sm font-bold text-white bg-zinc-900 dark:bg-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-xl shadow-lg transition-transform active:scale-95">
                                Guardar
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
