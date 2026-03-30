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
    agendarSolicitud, moverSolicitud, actualizarEstatus,
    transferirTecnico, getTecnicos
} from '@/app/actions/planificacion';
import type { Equipo, SolicitudPlanificacion, EstatusPlanificacion, TecnicoDisponible } from '@/lib/types/planificacion';
import { format, addDays, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Users, Inbox, Loader2, Settings, Trash2, Pencil, ArrowRightLeft, Check, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { ModeToggle } from '@/components/mode-toggle';
import { createClient } from '@/lib/supabase/client';

const PENDING_DROPPABLE = 'pending-pool';

export function PlanificacionBoard() {
    const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [equipos, setEquipos] = useState<Equipo[]>([]);
    const [allTecnicos, setAllTecnicos] = useState<TecnicoDisponible[]>([]);
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
    const [editingTeamId, setEditingTeamId] = useState<number | null>(null);
    const [editTeamName, setEditTeamName] = useState("");
    const [editTeamZone, setEditTeamZone] = useState("");
    const [savingTeamId, setSavingTeamId] = useState<number | null>(null);

    // Transfer Technician Confirmation
    const [transferData, setTransferData] = useState<{ userId: string, userName: string, newTeam: Equipo } | null>(null);
    const [isTransferring, setIsTransferring] = useState(false);

    // Board scroll ref
    const boardRef = useRef<HTMLDivElement>(null);

    // ── Data Loading ─────────────────────────────────────────
    const loadData = useCallback(async (showLoading = true) => {
        if (showLoading) setLoading(true);
        try {
            const [eqRes, pendRes, planRes, tecData] = await Promise.all([
                getEquipos(),
                getSolicitudesPendientes(selectedDate),
                getSolicitudesPlanificadas(selectedDate),
                getTecnicos()
            ]);
            
            if (!eqRes.success) {
                toast({ title: 'Error cargando equipos', description: eqRes.error, variant: 'destructive' });
                setEquipos([]);
            } else {
                setEquipos(eqRes.data || []);
            }
            
            setAllTecnicos(tecData || []);
            setPendientes(pendRes.success ? (pendRes.data || []) : []);
            setPlanificadas(planRes.success ? (planRes.data || []) : []);
        } catch (e: any) {
            toast({ title: 'Error al cargar datos', description: e.message, variant: 'destructive' });
        } finally {
            if (showLoading) setLoading(false);
        }
    }, [selectedDate]);

    useEffect(() => { 
        loadData(); 
        
        // ── Realtime Setup ────────────────────────────────────────
        const supabase = createClient();
        const sub = supabase.channel('planificacion-board-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitudes' }, () => {
                // Silently refresh data when any solicitud changes
                loadData(false);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(sub);
        };
    }, [loadData]);

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

        const solId = draggableId.replace('sol-', '');

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
                loadData(false);
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
                loadData(false);
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
        // Optimistic UI for quick change
        if (status === 'pendiente') {
            setPlanificadas(prev => prev.filter(s => s.id !== sol.id));
            setPendientes(prev => [{ ...sol, equipo_id: null, fecha_instalacion: null, estatus_planificacion: 'pendiente' }, ...prev]);
        } else {
            setPlanificadas(prev => prev.map(s => s.id === sol.id ? { ...s, estatus_planificacion: status } : s));
        }
        try {
            await actualizarEstatus(sol.id, status);
            toast({ title: 'Estatus actualizado' });
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
            loadData(false);
        }
    };

    const handleEditSave = async (id: string, updates: { estatus: EstatusPlanificacion; equipo_id?: number; motivo?: string; notas?: string; nueva_fecha_disponibilidad?: string }) => {
        try {
            if (updates.equipo_id && updates.equipo_id !== editModalData?.equipo_id && updates.estatus !== 'reprogramado') {
                await moverSolicitud(id, updates.equipo_id);
            }
            await actualizarEstatus(id, updates.estatus, updates.motivo, updates.notas, updates.nueva_fecha_disponibilidad);
            toast({ title: 'Solicitud actualizada', description: updates.nueva_fecha_disponibilidad ? 'Se creó un ticket pendiente para la nueva fecha.' : undefined });
            setEditModalOpen(false);
            loadData(false);
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
        }
    };

    const handleMoveConfirm = async (solId: string, newTeamId: number) => {
        try {
            await moverSolicitud(solId, newTeamId);
            toast({ title: 'Solicitud movida' });
            loadData(false);
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
        loadData(false);
    };

    const handleEditTeam = async (nombre: string, zona?: string, miembroIds?: string[]) => {
        if (!teamModalData) return;
        const res = await actualizarEquipo(teamModalData.id, { nombre, zona_asignada: zona || null }, miembroIds);
        if (!res.success) {
            toast({ title: 'Error de Servidor', description: res.error, variant: 'destructive', duration: 10000 });
            throw new Error(res.error);
        }
        toast({ title: 'Equipo actualizado' });
        loadData(false);
    };

    const handleDeleteTeam = async (id: number) => {
        if (!window.confirm('¿Seguro que quieres eliminar este equipo? Las solicitudes volverán a pendientes y se mantendrá el historial de la gestión.')) return;
        
        try {
            const res = await eliminarEquipo(id);
            if (!res.success) throw new Error(res.error);
            toast({ title: 'Equipo eliminado', description: 'Las solicitudes regresaron a pendientes' });
            await loadData(false);
        } catch (e: any) {
            toast({ title: 'Error eliminando equipo', description: e.message, variant: 'destructive' });
        }
    };

    const startEditingTeam = (team: Equipo) => {
        setEditingTeamId(team.id);
        setEditTeamName(team.nombre);
        setEditTeamZone(team.zona_asignada || "");
    };

    const saveTeamInline = async (teamId: number) => {
        if (!editTeamName.trim()) return;
        setSavingTeamId(teamId);
        const res = await actualizarEquipo(teamId, { nombre: editTeamName, zona_asignada: editTeamZone });
        setSavingTeamId(null);
        if (res.success) {
            toast({ title: 'Equipo actualizado' });
            setEditingTeamId(null);
            await loadData(false);
        } else {
            toast({ title: 'Error al guardar', description: res.error, variant: 'destructive' });
        }
    };

    const confirmTransfer = async () => {
        if (!transferData) return;
        setIsTransferring(true);
        const res = await transferirTecnico(transferData.userId, transferData.newTeam.id);
        setIsTransferring(false);
        if (res.success) {
            toast({ title: 'Técnico transferido exitosamente' });
            setTransferData(null);
            await loadData(false);
        } else {
            toast({ title: 'Error en la transferencia', description: res.error, variant: 'destructive' });
        }
    };

    const handleAddTecnico = async (userId: string, targetTeamId: number) => {
        const res = await transferirTecnico(userId, targetTeamId);
        if (res.success) {
            toast({ title: 'Técnico asignado' });
            await loadData(false);
        } else {
            toast({ title: 'Error al asignar', description: res.error, variant: 'destructive' });
        }
    };

    // ── Grab to Pan Horizontal Scroll ────────────────────────
    useEffect(() => {
        const board = boardRef.current;
        if (!board) return;

        let isDown = false;
        let startX = 0;
        let scrollLeft = 0;

        const handleMouseDown = (e: MouseEvent) => {
            if ((e.target as HTMLElement).closest('[data-rbd-draggable-id]')) return;
            if ((e.target as HTMLElement).closest('.pending-sidebar')) return;
            
            isDown = true;
            document.body.style.cursor = 'grabbing';
            startX = e.pageX;
            scrollLeft = window.scrollX || document.documentElement.scrollLeft;
        };

        const handleMouseLeave = () => {
            isDown = false;
            document.body.style.cursor = '';
        };

        const handleMouseUp = () => {
            isDown = false;
            document.body.style.cursor = '';
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX;
            const walk = (x - startX) * 1.5;
            window.scrollTo(scrollLeft - walk, window.scrollY);
        };

        board.addEventListener('mousedown', handleMouseDown);
        board.addEventListener('mouseleave', handleMouseLeave);
        board.addEventListener('mouseup', handleMouseUp);
        board.addEventListener('mousemove', handleMouseMove);

        return () => {
            board.removeEventListener('mousedown', handleMouseDown);
            board.removeEventListener('mouseleave', handleMouseLeave);
            board.removeEventListener('mouseup', handleMouseUp);
            board.removeEventListener('mousemove', handleMouseMove);
        };
    }, []);

    // ── Helpers ───────────────────────────────────────────────
    const getSolicitudesForTeam = (teamId: number) => {
        return planificadas.filter(s => s.equipo_id === teamId);
    };

    // ── Render ────────────────────────────────────────────────
    const assignedUserIds = new Set(equipos.flatMap(eq => eq.miembros?.map(m => m.user_id) || []));
    const unassignedTecnicos = allTecnicos.filter(t => !assignedUserIds.has(t.id));

    return (
        <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950 w-max min-w-full relative">

                {/* Header Bar */}
                <header className="sticky top-0 left-0 right-0 z-40 flex items-center justify-between px-4 sm:px-6 py-3 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-200 dark:border-white/5 w-screen max-w-full">
                    <div className="flex items-center gap-3">
                        <SidebarTrigger className="-ml-2" />
                        <h1 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tracking-tight">Planificación</h1>
                    </div>

                    <div className="flex items-center gap-3">
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
                        
                        <ModeToggle />

                        {/* New Team */}
                        <button
                            onClick={() => { setTeamModalData(undefined); setTeamModalOpen(true); }}
                            className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors shadow-lg shadow-indigo-500/20"
                        >
                            <Plus className="w-4 h-4" />
                            <span className="hidden sm:inline">Nuevo Equipo</span>
                        </button>
                    </div>
                </header>

                {loading ? (
                    <div className="flex-1 flex items-center justify-center h-[calc(100vh-60px)]">
                        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
                    </div>
                ) : (
                    <div className="flex flex-1 items-stretch">

                        {/* Pending Sidebar */}
                        <div className="pending-sidebar w-[280px] sm:w-[320px] shrink-0 border-r border-zinc-200 dark:border-white/5 bg-white/50 dark:bg-zinc-900/30 flex flex-col sticky left-0 z-30 h-[calc(100vh-60px)] top-[60px]">
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
                            className="flex-1"
                        >
                            <div className="flex w-max min-h-[calc(100vh-60px)]">
                                {equipos.length === 0 ? (
                                    <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 gap-4 min-w-[50vw]">
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
                                            <div key={team.id} className="w-[320px] flex-none flex flex-col border-r border-zinc-100 dark:border-white/5 last:border-r-0 h-full">
                                                {/* Team Header */}
                                                <div className="px-4 py-3 border-b border-zinc-100 dark:border-white/5 bg-white/30 dark:bg-white/[0.02] relative group">
                                                    
                                                    {editingTeamId === team.id ? (
                                                        <div className="flex flex-col gap-2 relative">
                                                            <input 
                                                                autoFocus
                                                                value={editTeamName}
                                                                onChange={e => setEditTeamName(e.target.value)}
                                                                className="w-full text-sm font-bold bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-500/30 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500/50"
                                                                placeholder="Nombre de Equipo"
                                                            />
                                                            <input 
                                                                value={editTeamZone}
                                                                onChange={e => setEditTeamZone(e.target.value)}
                                                                className="w-full text-[10px] font-bold uppercase bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500/50"
                                                                placeholder="Zona (Opcional)"
                                                            />
                                                            <div className="flex justify-end gap-1 mt-1">
                                                                <button onClick={() => handleDeleteTeam(team.id)} className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/40 text-red-500 transition-colors mr-auto" title="Eliminar Equipo">
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button onClick={() => setEditingTeamId(null)} className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-500 transition-colors">
                                                                    <X className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button onClick={() => saveTeamInline(team.id)} disabled={savingTeamId === team.id || !editTeamName.trim()} className="p-1.5 rounded-md bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-500/20 dark:hover:bg-indigo-500/30 text-indigo-600 dark:text-indigo-400 transition-colors disabled:opacity-50">
                                                                    {savingTeamId === team.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-start justify-between">
                                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                                <div className="w-7 h-7 rounded-lg bg-zinc-900 dark:bg-white flex items-center justify-center text-white dark:text-black text-xs font-black shrink-0 self-start">
                                                                    {team.nombre.charAt(0).toUpperCase()}
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex items-center gap-1">
                                                                        <h3 className="text-sm font-bold text-zinc-900 dark:text-white truncate leading-tight">{team.nombre}</h3>
                                                                        <button onClick={() => startEditingTeam(team)} className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-400 hover:text-indigo-500 transition-all rounded" title="Editar Equipo">
                                                                            <Pencil className="w-3 h-3" />
                                                                        </button>
                                                                    </div>
                                                                    
                                                                    <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 items-center">
                                                                        {team.miembros && team.miembros.map(m => {
                                                                            if (!m.profile) return null;
                                                                            const fullName = `${m.profile.first_name} ${m.profile.last_name}`.trim();
                                                                            return (
                                                                                <div key={m.id} className="inline-flex items-center bg-zinc-100 dark:bg-white/5 bg-opacity-50 rounded px-1 group/tec">
                                                                                    <span className="text-[10px] text-zinc-600 dark:text-zinc-400 font-medium">
                                                                                        {fullName}
                                                                                    </span>
                                                                                    {equipos.length > 1 && (
                                                                                        <DropdownMenu>
                                                                                            <DropdownMenuTrigger asChild>
                                                                                                <button className="ml-1 text-zinc-400 hover:text-blue-500 dark:hover:text-blue-400 opacity-0 group-hover/tec:opacity-100 transition-opacity focus:outline-none" title="Transferir Técnico">
                                                                                                    <ArrowRightLeft className="w-2.5 h-2.5" />
                                                                                                </button>
                                                                                            </DropdownMenuTrigger>
                                                                                            <DropdownMenuContent align="start" className="w-[180px]">
                                                                                                <div className="px-2 py-1.5 text-xs font-bold uppercase text-zinc-500 mb-1 border-b border-zinc-100 dark:border-white/5">
                                                                                                    Mover a...
                                                                                                </div>
                                                                                                {equipos.filter(eq => eq.id !== team.id).map(destinationTeam => (
                                                                                                    <DropdownMenuItem 
                                                                                                        key={destinationTeam.id}
                                                                                                        onClick={() => setTransferData({ userId: m.user_id, userName: fullName, newTeam: destinationTeam })}
                                                                                                        className="text-xs cursor-pointer focus:bg-blue-50 focus:text-blue-600 dark:focus:bg-blue-500/10 dark:focus:text-blue-400"
                                                                                                    >
                                                                                                        {destinationTeam.nombre}
                                                                                                    </DropdownMenuItem>
                                                                                                ))}
                                                                                            </DropdownMenuContent>
                                                                                        </DropdownMenu>
                                                                                    )}
                                                                                </div>
                                                                            );
                                                                        })}

                                                                        {/* Píldora para Añadir Técnico */}
                                                                        <DropdownMenu>
                                                                            <DropdownMenuTrigger asChild>
                                                                                <button className="inline-flex items-center justify-center w-4 h-4 rounded bg-zinc-200 dark:bg-white/10 hover:bg-zinc-300 dark:hover:bg-white/20 text-zinc-500 transition-colors focus:outline-none" title="Añadir Técnico Disponible">
                                                                                    <Plus className="w-2.5 h-2.5" />
                                                                                </button>
                                                                            </DropdownMenuTrigger>
                                                                            <DropdownMenuContent align="start" className="w-[200px] max-h-[300px] overflow-y-auto">
                                                                                <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1 border-b border-zinc-100 dark:border-white/5">
                                                                                    Añadir Disponible...
                                                                                </div>
                                                                                {unassignedTecnicos.length === 0 ? (
                                                                                    <div className="px-2 py-3 text-xs text-zinc-400 text-center italic">No hay disponibles</div>
                                                                                ) : (
                                                                                    unassignedTecnicos.map(t => (
                                                                                        <DropdownMenuItem 
                                                                                            key={t.id}
                                                                                            onClick={() => handleAddTecnico(t.id, team.id)}
                                                                                            className="text-xs cursor-pointer focus:bg-indigo-50 focus:text-indigo-600 dark:focus:bg-indigo-500/10 dark:focus:text-indigo-400"
                                                                                        >
                                                                                            {t.first_name} {t.last_name}
                                                                                        </DropdownMenuItem>
                                                                                    ))
                                                                                )}
                                                                            </DropdownMenuContent>
                                                                        </DropdownMenu>
                                                                    </div>

                                                                    {team.zona_asignada && (
                                                                        <p className="text-[9px] uppercase tracking-wider text-blue-500 font-bold truncate mt-1.5 flex items-center group/zone">
                                                                            {team.zona_asignada}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="flex items-center gap-1 shrink-0 ml-2">
                                                                <span className="text-[10px] font-mono font-bold bg-zinc-100 dark:bg-white/10 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded-full" title="Solicitudes Asignadas">
                                                                    {teamSolicitudes.length}
                                                                </span>
                                                            </div>
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
            {transferData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 dark:bg-black/60 backdrop-blur-[2px]">
                    <div className="bg-white dark:bg-zinc-900 rounded-[28px] p-8 shadow-2xl max-w-md w-full border border-zinc-200 dark:border-white/10 text-center animate-in fade-in zoom-in-95 duration-200">
                        <div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center mb-6 ring-8 ring-blue-50 dark:ring-blue-500/10">
                            <ArrowRightLeft className="w-10 h-10" />
                        </div>
                        <h3 className="text-2xl font-black text-zinc-900 dark:text-white mb-3 tracking-tight">
                            Transferir Operador
                        </h3>
                        <p className="text-base text-zinc-600 dark:text-zinc-400 mb-8 max-w-[280px] mx-auto leading-relaxed">
                            ¿Estás seguro que deseas mover a <span className="font-bold text-zinc-900 dark:text-white">{transferData.userName}</span> al <span className="font-bold text-blue-600 dark:text-blue-400">"{transferData.newTeam.nombre}"</span>?
                        </p>
                        
                        <div className="flex gap-4">
                            <button
                                onClick={() => setTransferData(null)}
                                disabled={isTransferring}
                                className="flex-1 px-5 py-3.5 rounded-2xl border border-zinc-200 dark:border-white/10 text-sm font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5 transition-all outline-none focus:ring-2 focus:ring-zinc-500/50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmTransfer}
                                disabled={isTransferring}
                                className="flex-1 px-5 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-lg shadow-blue-500/25 transition-all outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isTransferring ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <ArrowRightLeft className="w-4 h-4" /> Transferir
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {editModalOpen && editModalData && (
                <EditarSolicitudModal
                    isOpen={editModalOpen}
                    onClose={() => setEditModalOpen(false)}
                    onSave={handleEditSave}
                    solicitud={editModalData}
                    equipos={equipos}
                    initialMode={editModalMode}
                />
            )}
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
                equipos={equipos}
            />
        </DragDropContext>
    );
}
