'use client';

import { useState } from 'react';
import { X, Users, MapPin } from 'lucide-react';

interface NuevoEquipoModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (nombre: string, zona?: string) => void;
    initialData?: { id: number; nombre: string; zona_asignada?: string | null };
}

export function NuevoEquipoModal({ isOpen, onClose, onConfirm, initialData }: NuevoEquipoModalProps) {
    const [nombre, setNombre] = useState(initialData?.nombre || '');
    const [zona, setZona] = useState(initialData?.zona_asignada || '');

    const isEditing = !!initialData;

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!nombre.trim()) return;
        onConfirm(nombre.trim(), zona.trim() || undefined);
        setNombre('');
        setZona('');
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-[#18181b] w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border border-zinc-200 dark:border-white/10">
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
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
                            Nombre del equipo
                        </label>
                        <input
                            autoFocus
                            type="text"
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                            placeholder="Ej: Equipo A: Jose, Simon"
                            className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all outline-none font-medium text-zinc-900 dark:text-white placeholder:text-zinc-400"
                        />
                    </div>

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
