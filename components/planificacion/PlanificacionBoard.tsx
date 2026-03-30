'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { DragDropContext, Draggable, DropResult } from '@hello-pangea/dnd';
import { StrictModeDroppable } from './StrictModeDroppable';
import { PlanificacionCard } from './PlanificacionCard';
import { EditarSolicitudModal } from './EditarSolicitudModal';
import { MoverSolicitudModal } from './MoverSolicitudModal';
import { NuevoEquipoModal } from './NuevoEquipoModal';
import {
    getEquipos, crearEquipo, actualizarEquipo, eliminarEquipo,
    getSolicitudesPendientes, getSolicitudesPlanificadas,
    agendarSolicitud, moverSolicitud, actualizarEstatus
} from '@/app/actions/planificacion';
import type { Equipo, SolicitudPlanificacion, EstatusPlanificacion } from '@/lib/types/planificacion';
import { format, addDays, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Users, Inbox, Loader2, Settings, Trash2, Pencil } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

const PENDING_DROPPABLE = 'pending-pool';

export function PlanificacionBoard() {
    const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [equipos, setEquipos] = useState<Equipo[]>([]);
    const [pendientes, setPendientes] = useState<SolicitudPlanificacion[]>([]);
    const [planificadas, setPlanificadas] = useState<SolicitudPlanificacion[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    // Modals
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editModalData, setEditModalData] = useState<SolicitudPlanificacion | undefined>();
    const [editModalMode, setEditModalMode] = useState<'edit' | 'move' | 'status'>('edit');
    const [moveModalOpen, setMoveModalOpen] = useState(false);
    const [moveModalData, setMoveModalData] = useState<SolicitudPlanificacion | undefined>();
    const [teamModalOpen, setTeamModalOpen] = useState(false);
    const [teamModalData, setTeamModalData] = useState<Equipo | undefined>();

    // Team management menu
    const [activeTeamMenu, setActiveTeamMenu] = useState<number | null>(null);

    // Board scroll ref
    const boardRef = useRef<HTMLDivElement>(null);

    // ── Data Loading ─────────────────────────────────────────
    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [eqRes, pendRes, planRes] = await Promise.all([
                getEquipos(),
                getSolicitudesPendientes(),
                getSolicitudesPlanificadas(selectedDate),
            ]);
            
            if (!eqRes.success) {
                toast({ title: 'Error cargando equipos', description: eqRes.error, variant: 'destructive' });
                setEquipos([]);
            } else {
                setEquipos(eqRes.data || []);
            }
            
            setPendientes(pendRes.success ? (pendRes.data || []) : []);
            setPlanificadas(planRes.success ? (planRes.data || []) : []);
        } catch (e: any) {
            toast({ title: 'Error al cargar datos', description: e.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [selectedDate]);

    useEffect(() => { loadData(); }, [loadData]);

    // ── Date Navigation ──────────────────────────────────────
    const goToDay = (offset: number) => {
        const current = new Date(selectedDate + 'T12:00:00');
        const next = offset > 0 ? addDays(current, offset) : subDays(current, Math.abs(offset));
        setSelectedDate(format(next, 'yyyy-MM-dd'));
    };

    const isToday = selectedDate === format(new Date(), 'yyyy-MM-dd');
    const formattedDate = (() => {
        const d = new Date(selectedDate + 'T12:00:00');
        return format(d, "EEEE d 'de' MMMM", { locale: es });
    })();

    // ── Drag & Drop ──────────────────────────────────────────
    const handleDragEnd = async (result: DropResult) => {
        const { source, destination, draggableId } = result;
        if (!destination) return;
        if (source.droppableId === destination.droppableId && source.index === destination.index) return;

        const solId = parseInt(draggableId);

        // From pending pool → team column
        if (source.droppableId === PENDING_DROPPABLE && destination.droppableId !== PENDING_DROPPABLE) {
            const teamId = parseInt(destination.droppableId);
            // Optimistic update
            const sol = pendientes.find(s => s.id === solId);
            if (sol) {
                setPendientes(prev => prev.filter(s => s.id !== solId));
                setPlanificadas(prev => [...prev, { ...sol, equipo_id: teamId, fecha_instalacion: selectedDate, estatus_planificacion: 'agendado' }]);
            }
            try {
                await agendarSolicitud(solId, teamId, selectedDate);
                toast({ title: 'Solicitud agendada' });
            } catch (e: any) {
                toast({ title: 'Error', description: e.message, variant: 'destructive' });
                loadData();
            }
            return;
        }

        // Between team columns
        if (source.droppableId !== PENDING_DROPPABLE && destination.droppableId !== PENDING_DROPPABLE) {
            const newTeamId = parseInt(destination.droppableId);
            // Optimistic
            setPlanificadas(prev => prev.map(s => s.id === solId ? { ...s, equipo_id: newTeamId } : s));
            try {
                await moverSolicitud(solId, newTeamId);
                toast({ title: 'Solicitud movida' });
            } catch (e: any) {
                toast({ title: 'Error', description: e.message, variant: 'destructive' });
                loadData();
            }
            return;
        }

        // From team → pending (desagendar)
        if (source.droppableId !== PENDING_DROPPABLE && destination.droppableId === PENDING_DROPPABLE) {
            const sol = planificadas.find(s => s.id === solId);
            if (sol) {
                setPlanificadas(prev => prev.filter(s => s.id !== solId));
                setPendientes(prev => [{ ...sol, equipo_id: null, fecha_instalacion: null, estatus_planificacion: 'pendiente' }, ...prev]);
            }
            try {
                await actualizarEstatus(solId, 'pendiente');
                toast({ title: 'Solicitud devuelta a pendientes' });
            } catch (e: any) {
                toast({ title: 'Error', description: e.message, variant: 'destructive' });
                loadData();
            }
        }
    };

    // ── Actions on Cards ─────────────────────────────────────
    const handleCardAction = (action: 'edit' | 'move' | 'status', sol: SolicitudPlanificacion) => {
        if (action === 'move') {
            setMoveModalData(sol);
            setMoveModalOpen(true);
        } else {
            setEditModalData(sol);
            setEditModalMode(action);
            setEditModalOpen(true);
        }
    };

    const handleQuickStatusUpdate = async (status: EstatusPlanificacion, sol: SolicitudPlanificacion) => {
        // Optimistic
        if (status === 'pendiente') {
            setPlanificadas(prev => prev.filter(s => s.id !== sol.id));
            setPendientes(prev => [{ ...sol, equipo_id: null, fecha_instalacion: null, estatus_planificacion: 'pendiente' }, ...prev]);
        } else {
            setPlanificadas(prev => prev.map(s => s.id === sol.id ? { ...s, estatus_planificacion: status } : s));
        }
        try {
            await actualizarEstatus(sol.id, status);
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
            loadData();
        }
    };

    const handleEditSave = async (id: number, updates: { estatus: EstatusPlanificacion; equipo_id?: number; motivo?: string; notas?: string }) => {
        try {
            if (updates.equipo_id && updates.equipo_id !== editModalData?.equipo_id) {
                await moverSolicitud(id, updates.equipo_id);
            }
            await actualizarEstatus(id, updates.estatus, updates.motivo, updates.notas);
            toast({ title: 'Solicitud actualizada' });
            loadData();
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
        }
    };

    const handleMoveConfirm = async (solId: number, newTeamId: number) => {
        try {
            await moverSolicitud(solId, newTeamId);
            toast({ title: 'Solicitud movida' });
            loadData();
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
        }
    };

    // ── Team Management ──────────────────────────────────────
    const handleCreateTeam = async (nombre: string, zona?: string, miembroIds?: string[]) => {
        const res = await crearEquipo(nombre, zona, miembroIds);
        if (!res.success) {
            toast({ title: 'Error de Servidor', description: res.error, variant: 'destructive', duration: 10000 });
            throw new Error(res.error); // throw so modal knows it failed
        }
        toast({ title: 'Equipo creado' });
        loadData();
    };

    const handleEditTeam = async (nombre: string, zona?: string, miembroIds?: string[]) => {
        if (!teamModalData) return;
        const res = await actualizarEquipo(teamModalData.id, { nombre, zona_asignada: zona || null }, miembroIds);
        if (!res.success) {
            toast({ title: 'Error de Servidor', description: res.error, variant: 'destructive', duration: 10000 });
            throw new Error(res.error);
        }
        toast({ title: 'Equipo actualizado' });
        loadData();
    };

    const handleDeleteTeam = async (teamId: number) => {
        if (!confirm('¿Eliminar este equipo? Las solicitudes asignadas volverán a pendiente.')) return;
        const res = await eliminarEquipo(teamId);
        if (!res.success) {
            toast({ title: 'Error', description: res.error, variant: 'destructive' });
            return;
        }
        toast({ title: 'Equipo eliminado' });
        setActiveTeamMenu(null);
        loadData();
    };

    // ── Helpers ───────────────────────────────────────────────
    const getSolicitudesForTeam = (teamId: number) => {
        return planificadas.filter(s => s.equipo_id === teamId);
    };

    // ── Render ────────────────────────────────────────────────
    return (
        <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex flex-col h-[100dvh] bg-zinc-50 dark:bg-zinc-950 overflow-hidden">

                {/* Header Bar */}
                <header className="flex items-center justify-between px-4 sm:px-6 py-3 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-200 dark:border-white/5 shrink-0 z-30">
                    <div className="flex items-center gap-2">
                        <h1 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tracking-tight">Planificación</h1>
                    </div>

                    {/* Date Navigator */}
                    <div className="flex items-center gap-1 bg-zinc-100 dark:bg-white/5 rounded-full px-1 py-1">
                        <button onClick={() => goToDay(-1)} className="p-1.5 rounded-full hover:bg-white dark:hover:bg-white/10 transition-colors">
                            <ChevronLeft className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                        </button>
                        <button
                            onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
                            className={cn(
                                "px-3 py-1 text-xs sm:text-sm font-bold rounded-full transition-all capitalize",
                                isToday
                                    ? "bg-zinc-900 dark:bg-white text-white dark:text-black"
                                    : "text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-white/10"
                            )}
                        >
                            {isToday ? 'Hoy' : formattedDate}
                        </button>
                        <button onClick={() => goToDay(1)} className="p-1.5 rounded-full hover:bg-white dark:hover:bg-white/10 transition-colors">
                            <ChevronRight className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                        </button>
                    </div>

                    {/* New Team */}
                    <button
                        onClick={() => { setTeamModalData(undefined); setTeamModalOpen(true); }}
                        className="flex items-center gap-2 px-3 py-2 bg-zinc-900 dark:bg-white text-white dark:text-black text-xs font-bold rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors shadow-lg"
                    >
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">Nuevo Equipo</span>
                    </button>
                </header>

                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
                    </div>
                ) : (
                    <div className="flex flex-1 overflow-hidden">

                        {/* Pending Sidebar */}
                        <div className="w-[280px] sm:w-[320px] shrink-0 border-r border-zinc-200 dark:border-white/5 bg-white/50 dark:bg-zinc-900/30 flex flex-col">
                            <div className="px-4 py-3 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Inbox className="w-4 h-4 text-zinc-400" />
                                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Pendientes</span>
                                </div>
                                <span className="text-[10px] font-mono font-bold bg-zinc-100 dark:bg-white/10 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded-full">
                                    {pendientes.length}
                                </span>
                            </div>

                            <StrictModeDroppable droppableId={PENDING_DROPPABLE}>
                                {(provided, snapshot) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        className={cn(
                                            "flex-1 overflow-y-auto p-3 space-y-2 transition-colors",
                                            snapshot.isDraggingOver ? "bg-amber-50/50 dark:bg-amber-500/5" : ""
                                        )}
                                        style={{ scrollbarWidth: 'thin' }}
                                    >
                                        {pendientes.length === 0 ? (
                                            <div className="text-center py-12 text-zinc-400 text-xs">
                                                <Inbox className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                                No hay solicitudes pendientes
                                            </div>
                                        ) : (
                                            pendientes.map((sol, index) => (
                                                <Draggable key={String(sol.id)} draggableId={String(sol.id)} index={index}>
                                                    {(provided, snapshot) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            {...provided.dragHandleProps}
                                                            className={cn(snapshot.isDragging && "opacity-80 rotate-[2deg]")}
                                                        >
                                                            <PlanificacionCard
                                                                solicitud={sol}
                                                                onAction={handleCardAction}
                                                                onStatusUpdate={handleQuickStatusUpdate}
                                                                compact
                                                            />
                                                        </div>
                                                    )}
                                                </Draggable>
                                            ))
                                        )}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </StrictModeDroppable>
                        </div>

                        {/* Team Columns Board */}
                        <div
                            ref={boardRef}
                            className="flex-1 overflow-x-auto overflow-y-hidden"
                        >
                            <div className="flex h-full min-w-max">
                                {equipos.length === 0 ? (
                                    <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 gap-4">
                                        <Users className="w-16 h-16 opacity-20" />
                                        <p className="text-sm font-medium">No hay equipos creados</p>
                                        <button
                                            onClick={() => { setTeamModalData(undefined); setTeamModalOpen(true); }}
                                            className="px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-black text-sm font-bold rounded-xl"
                                        >
                                            Crear Primer Equipo
                                        </button>
                                    </div>
                                ) : (
                                    equipos.map((team) => {
                                        const teamSolicitudes = getSolicitudesForTeam(team.id);
                                        return (
                                            <div key={team.id} className="w-[320px] shrink-0 flex flex-col border-r border-zinc-100 dark:border-white/5 last:border-r-0">
                                                {/* Team Header */}
                                                <div className="px-4 py-3 border-b border-zinc-100 dark:border-white/5 bg-white/30 dark:bg-white/[0.02] flex items-center justify-between relative">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="w-7 h-7 rounded-lg bg-zinc-900 dark:bg-white flex items-center justify-center text-white dark:text-black text-xs font-black shrink-0">
                                                            {team.nombre.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <h3 className="text-sm font-bold text-zinc-900 dark:text-white truncate leading-tight">{team.nombre}</h3>
                                                            {team.zona_asignada && (
                                                                <p className="text-[9px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-semibold truncate">{team.zona_asignada}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-[10px] font-mono font-bold bg-zinc-100 dark:bg-white/10 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded-full mr-1">
                                                            {teamSolicitudes.length}
                                                        </span>
                                                        <button
                                                            onClick={() => setActiveTeamMenu(activeTeamMenu === team.id ? null : team.id)}
                                                            className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-400 transition-colors"
                                                        >
                                                            <Settings className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>

                                                    {/* Team Dropdown */}
                                                    {activeTeamMenu === team.id && (
                                                        <div className="absolute top-full right-2 mt-1 z-40 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 rounded-xl shadow-xl overflow-hidden min-w-[140px]">
                                                            <button
                                                                onClick={() => {
                                                                    setActiveTeamMenu(null);
                                                                    setTeamModalData(team);
                                                                    setTeamModalOpen(true);
                                                                }}
                                                                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors"
                                                            >
                                                                <Pencil className="w-3.5 h-3.5" /> Editar
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteTeam(team.id)}
                                                                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" /> Eliminar
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Droppable Column */}
                                                <StrictModeDroppable droppableId={String(team.id)}>
                                                    {(provided, snapshot) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.droppableProps}
                                                            className={cn(
                                                                "flex-1 overflow-y-auto p-3 space-y-2 transition-colors",
                                                                snapshot.isDraggingOver ? "bg-blue-50/50 dark:bg-blue-500/5" : ""
                                                            )}
                                                            style={{ scrollbarWidth: 'thin' }}
                                                        >
                                                            {teamSolicitudes.length === 0 && !snapshot.isDraggingOver && (
                                                                <div className="text-center py-8 text-zinc-300 dark:text-zinc-700 text-[11px] font-medium">
                                                                    Arrastra solicitudes aquí
                                                                </div>
                                                            )}
                                                            {teamSolicitudes.map((sol, index) => (
                                                                <Draggable key={String(sol.id)} draggableId={String(sol.id)} index={index}>
                                                                    {(provided, snapshot) => (
                                                                        <div
                                                                            ref={provided.innerRef}
                                                                            {...provided.draggableProps}
                                                                            {...provided.dragHandleProps}
                                                                            className={cn(snapshot.isDragging && "opacity-80 rotate-[-1deg]")}
                                                                        >
                                                                            <PlanificacionCard
                                                                                solicitud={sol}
                                                                                onAction={handleCardAction}
                                                                                onStatusUpdate={handleQuickStatusUpdate}
                                                                            />
                                                                        </div>
                                                                    )}
                                                                </Draggable>
                                                            ))}
                                                            {provided.placeholder}
                                                        </div>
                                                    )}
                                                </StrictModeDroppable>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            <EditarSolicitudModal
                isOpen={editModalOpen}
                onClose={() => setEditModalOpen(false)}
                onSave={handleEditSave}
                solicitud={editModalData}
                equipos={equipos}
                initialMode={editModalMode}
            />
            <MoverSolicitudModal
                isOpen={moveModalOpen}
                onClose={() => setMoveModalOpen(false)}
                onMove={handleMoveConfirm}
                equipos={equipos}
                solicitud={moveModalData}
            />
            <NuevoEquipoModal
                isOpen={teamModalOpen}
                onClose={() => { setTeamModalOpen(false); setTeamModalData(undefined); }}
                onConfirm={teamModalData ? handleEditTeam : handleCreateTeam}
                initialData={teamModalData ? { id: teamModalData.id, nombre: teamModalData.nombre, zona_asignada: teamModalData.zona_asignada, miembros: teamModalData.miembros } : undefined}
            />
        </DragDropContext>
    );
}
