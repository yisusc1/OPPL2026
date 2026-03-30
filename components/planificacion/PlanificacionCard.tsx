'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Phone, MapPin, CheckCircle2, Pencil, ArrowRightLeft, X, User, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SolicitudPlanificacion, EstatusPlanificacion } from '@/lib/types/planificacion';

interface PlanificacionCardProps {
    solicitud: SolicitudPlanificacion;
    onAction: (action: 'edit' | 'move' | 'status', sol: SolicitudPlanificacion) => void;
    onStatusUpdate: (status: EstatusPlanificacion, sol: SolicitudPlanificacion) => void;
    compact?: boolean; // For pending sidebar
    isNew?: boolean;
    isLoading?: boolean;
}

const STATUS_MAP: Record<EstatusPlanificacion, { color: string; label: string }> = {
    pendiente: { color: 'text-slate-400 dark:text-slate-500', label: 'Pendiente' },
    agendado: { color: 'text-amber-600 dark:text-amber-400', label: 'Agendado' },
    completado: { color: 'text-emerald-600 dark:text-emerald-400', label: 'Instalado' },
    reprogramado: { color: 'text-orange-600 dark:text-orange-400', label: 'Reagendado' },
    error: { color: 'text-blue-600 dark:text-blue-400', label: 'Error' },
};

export function PlanificacionCard({ solicitud, onAction, onStatusUpdate, compact, isNew, isLoading }: PlanificacionCardProps) {
    const [showOverlay, setShowOverlay] = useState(false);
    const [overlayMode, setOverlayMode] = useState<'menu' | 'status'>('menu');

    const statusInfo = STATUS_MAP[solicitud.estatus_planificacion] || STATUS_MAP.pendiente;
    const clientName = `${solicitud.nombres} ${solicitud.apellidos}`.trim();
    const locationParts = [solicitud.parroquia, solicitud.sector].filter(Boolean);
    const locationStr = locationParts.join(', ');

    const handleCardClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowOverlay(true);
        setOverlayMode('menu');
    };

    const handleBtnClick = (action: 'edit' | 'move' | 'status', e: React.MouseEvent) => {
        e.stopPropagation();
        if (action === 'status') {
            setOverlayMode('status');
        } else {
            setShowOverlay(false);
            onAction(action, solicitud);
        }
    };

    const handleStatusSelect = (statusId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (statusId === 'reprogramado' || statusId === 'error') {
            setShowOverlay(false);
            onAction('status', { ...solicitud, estatus_planificacion: statusId as EstatusPlanificacion });
        } else {
            onStatusUpdate(statusId as EstatusPlanificacion, solicitud);
            setShowOverlay(false);
        }
    };

    const handleClose = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowOverlay(false);
    };

    if (compact) {
        return (
            <div
                className={cn(
                    "relative flex flex-col gap-1.5 rounded-xl p-3 cursor-grab bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 shadow-sm hover:shadow-md transition-all",
                    isLoading && "opacity-50 pointer-events-none"
                )}
            >
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                        <motion.div 
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                            className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full"
                        />
                    </div>
                )}
                <div className="flex justify-between items-start gap-2 pr-1">
                    <h4 className="font-bold text-[13px] text-zinc-900 dark:text-zinc-100 leading-tight truncate relative">
                        {clientName}
                        {isNew && <span className="absolute -top-0.5 -right-2 w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse shadow-[0_0_5px_rgba(59,130,246,0.5)]"></span>}
                    </h4>
                    <span className="text-[8px] font-bold uppercase tracking-wider text-amber-500 shrink-0">
                        {solicitud.plan}
                    </span>
                </div>
                {locationStr && (
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                        <MapPin className="w-3 h-3 shrink-0 opacity-50" />
                        <span className="truncate">{locationStr}</span>
                    </div>
                )}
                <div className="flex items-center justify-between gap-2 pt-1">
                    {solicitud.telefono_principal && (
                        <span className="text-[10px] text-zinc-400 font-mono truncate">{solicitud.telefono_principal}</span>
                    )}
                    <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-medium shrink-0">{solicitud.promotor}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="relative group min-h-[130px]" onClick={handleCardClick}>
            <div
                className={cn(
                    "relative flex flex-col justify-between gap-2.5 rounded-xl p-4 cursor-pointer transition-all duration-300 h-full",
                    "bg-white dark:bg-zinc-900/40 dark:backdrop-blur-md border border-zinc-200 dark:border-white/10",
                    "shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] dark:shadow-none hover:shadow-lg dark:hover:bg-zinc-900/60",
                    isLoading && "opacity-60 pointer-events-none grayscale-[0.5]"
                )}
            >
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center z-20">
                        <div className="bg-white/50 dark:bg-black/20 backdrop-blur-[1px] w-full h-full flex items-center justify-center rounded-xl">
                            <motion.div 
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                                className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full"
                            />
                        </div>
                    </div>
                )}
                {/* Header */}
                <div className="flex justify-between items-start gap-3">
                    <h4 className="font-bold text-[14px] text-zinc-900 dark:text-zinc-100 leading-tight tracking-tight relative max-w-[70%]">
                        {clientName}
                        {isNew && <span className="absolute -top-1 -right-3 w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.6)]"></span>}
                    </h4>
                    <span className={cn("text-[9px] font-bold uppercase tracking-wider shrink-0", statusInfo.color)}>
                        {statusInfo.label}
                    </span>
                </div>

                {/* Data */}
                <div className="space-y-1.5">
                    {(solicitud.direccion || locationStr) && (
                        <div className="flex items-start gap-2 text-[11px] text-zinc-600 dark:text-zinc-400 leading-snug">
                            <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-50" />
                            <span className="line-clamp-2 font-medium">
                                {locationStr}{solicitud.direccion ? ` · ${solicitud.direccion}` : ''}
                            </span>
                        </div>
                    )}
                    {solicitud.promotor && (
                        <div className="flex items-center gap-2 pl-0.5">
                            <User className="w-3 h-3 opacity-40" />
                            <span className="text-[10px] text-zinc-600 dark:text-zinc-300 font-medium">{solicitud.promotor}</span>
                        </div>
                    )}

                    <div className="flex items-center justify-between gap-3 pt-1.5">
                        {solicitud.telefono_principal && (
                            <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-500 font-mono bg-zinc-50 dark:bg-white/5 px-2 py-1 rounded-md border border-zinc-100 dark:border-white/5 max-w-[55%] overflow-hidden">
                                <Phone className="w-3 h-3 opacity-70 shrink-0" />
                                <span className="opacity-90 tracking-wide whitespace-nowrap overflow-hidden text-ellipsis">{solicitud.telefono_principal}</span>
                            </div>
                        )}
                        {solicitud.plan && (
                            <div className="flex items-center gap-1 text-[10px] text-zinc-400 font-mono font-medium shrink-0">
                                <Briefcase className="w-3 h-3 opacity-50" />
                                {solicitud.plan}
                            </div>
                        )}
                    </div>
                </div>

                {solicitud.estatus_planificacion === 'reprogramado' && solicitud.motivo_reprogramacion && (
                    <div className="mt-1 text-[10px] text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/10 px-3 py-2 rounded-lg border border-orange-100 dark:border-orange-500/10 font-mono">
                        <strong className="block text-[9px] uppercase opacity-70 mb-0.5">Motivo:</strong>
                        {solicitud.motivo_reprogramacion}
                    </div>
                )}
            </div>

            {/* Quick Actions Overlay */}
            <AnimatePresence>
                {showOverlay && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute inset-0 z-50 rounded-xl bg-white/95 dark:bg-[#18181b]/95 backdrop-blur-md flex flex-col items-center justify-center overflow-hidden border border-zinc-200 dark:border-white/10"
                        onClick={handleClose}
                    >
                        {overlayMode === 'menu' && (
                            <button onClick={handleClose} className="absolute top-2 right-2 p-1 text-zinc-400 dark:text-white/50 hover:text-zinc-700 dark:hover:text-white transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        )}

                        {overlayMode === 'menu' ? (
                            <div className="flex gap-4">
                                <button onClick={(e) => handleBtnClick('edit', e)} className="flex flex-col items-center gap-2 group/btn">
                                    <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-white/10 border border-zinc-200 dark:border-white/20 flex items-center justify-center text-zinc-600 dark:text-white group-hover/btn:bg-[#FFC82E] group-hover/btn:text-black group-hover/btn:border-[#FFC82E] transition-all">
                                        <Pencil className="w-5 h-5" />
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-white/80">Editar</span>
                                </button>
                                <button onClick={(e) => handleBtnClick('move', e)} className="flex flex-col items-center gap-2 group/btn">
                                    <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-white/10 border border-zinc-200 dark:border-white/20 flex items-center justify-center text-zinc-600 dark:text-white group-hover/btn:bg-blue-500 group-hover/btn:text-white group-hover/btn:border-blue-500 transition-all">
                                        <ArrowRightLeft className="w-5 h-5" />
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-white/80">Mover</span>
                                </button>
                                <button onClick={(e) => handleBtnClick('status', e)} className="flex flex-col items-center gap-2 group/btn">
                                    <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-white/10 border border-zinc-200 dark:border-white/20 flex items-center justify-center text-zinc-600 dark:text-white group-hover/btn:bg-emerald-500 group-hover/btn:text-white group-hover/btn:border-emerald-500 transition-all">
                                        <CheckCircle2 className="w-5 h-5" />
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-white/80">Estado</span>
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 grid-rows-2 w-full h-full divide-x divide-zinc-200 dark:divide-white/10 border-t border-zinc-200 dark:border-white/10">
                                <div className="contents">
                                    <button onClick={(e) => handleStatusSelect('pendiente', e)} className="h-full flex items-center justify-center text-[10px] font-bold tracking-widest text-zinc-500 dark:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-colors border-b border-zinc-200 dark:border-white/10">PENDIENTE</button>
                                    <button onClick={(e) => handleStatusSelect('completado', e)} className="h-full flex items-center justify-center text-[10px] font-bold tracking-widest text-zinc-500 dark:text-zinc-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors border-b border-zinc-200 dark:border-white/10">INSTALADO</button>
                                </div>
                                <div className="contents">
                                    <button onClick={(e) => handleStatusSelect('reprogramado', e)} className="h-full flex items-center justify-center text-[10px] font-bold tracking-widest text-zinc-500 dark:text-zinc-600 hover:bg-orange-100 dark:hover:bg-orange-900/30 hover:text-orange-700 dark:hover:text-orange-400 transition-colors">REAGENDAR</button>
                                    <button onClick={(e) => handleStatusSelect('error', e)} className="h-full flex items-center justify-center text-[10px] font-bold tracking-widest text-zinc-500 dark:text-zinc-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-400 transition-colors">ERROR</button>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
