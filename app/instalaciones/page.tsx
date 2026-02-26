'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Activity, Settings, Save, Trash2, Copy, CheckCircle, AlertCircle, RefreshCcw, Database } from 'lucide-react';
import { processDataLogic, saveReport, getConfig, updateConfig, getHistory, deleteHistory } from './actions';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export default function ProcesadorDatosPage() {
    type TabType = 'generador' | 'historial' | 'configuracion';
    const [activeTab, setActiveTab] = useState<TabType>('generador');

    // States - Procesar
    const [planificadas, setPlanificadas] = useState('');
    const [reagendas, setReagendas] = useState('');
    const [textData, setTextData] = useState('');
    const [report, setReport] = useState<any>(null);

    // States - Data
    const [config, setConfig] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [selectedHistory, setSelectedHistory] = useState<number | null>(null);

    // Toast
    const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        try {
            const [cfg, hist] = await Promise.all([getConfig(), getHistory()]);
            setConfig(cfg);
            setHistory(hist.reverse());
        } catch (e) {
            showToast('Error cargando datos de la Base de Datos', 'error');
        }
    };

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    // HANDLERS PROCESAR
    const handleLimpiar = () => {
        setPlanificadas('');
        setReagendas('');
        setTextData('');
        setReport(null);
    };

    const handleGenerar = async () => {
        const p = parseInt(planificadas);
        const r = parseInt(reagendas);
        if (isNaN(p) || isNaN(r)) return showToast('Ingresa números válidos en planificadas y reagendas', 'error');
        if (!textData.trim()) return showToast('Pega el excel antes de generar', 'error');

        try {
            const res = await processDataLogic(p, r, textData);
            setReport(res);
            showToast('Reporte generado correctamente');
        } catch (e: any) {
            showToast(e.message, 'error');
        }
    };

    const handleGuardarReporte = async () => {
        if (!report) return;
        if (!confirm('¿Deseas sumar estos valores a la base de datos y archivar este reporte? (Hazlo solo 1 vez al día)')) return;

        try {
            await saveReport(report);
            showToast('¡Reporte archivado con éxito!');
            handleLimpiar();
            loadInitialData();
        } catch (e: any) {
            showToast(e.message || 'Hubo un error al guardar', 'error');
        }
    };

    const handleCopiar = () => {
        if (report) {
            navigator.clipboard.writeText(report.reporte_texto);
            showToast('Copiado al portapapeles');
        }
    };

    const handleDeleteHistory = async () => {
        if (selectedHistory === null) return;
        const historyItem = history[selectedHistory];
        if (!historyItem?.id) return;

        if (!confirm('¿Estás seguro de eliminar este reporte de la base de datos? Se restarán las métricas sumadas en la configuración y no se puede deshacer.')) return;

        try {
            await deleteHistory(historyItem.id, historyItem.metadata);
            setSelectedHistory(null);
            showToast('Reporte eliminado y métricas restadas exitosamente');
            loadInitialData();
        } catch (e: any) {
            showToast('Error al eliminar', 'error');
        }
    };

    const handleSaveConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        const formData = new FormData(e.target as HTMLFormElement);
        const newConfig = {
            valle: parseInt(formData.get('valle') as string),
            propatria: parseInt(formData.get('propatria') as string),
            la_vega: parseInt(formData.get('la_vega') as string),
            tejerias: parseInt(formData.get('tejerias') as string),
            coche: parseInt(formData.get('coche') as string),
            mes_acumulado: parseInt(formData.get('mes_acumulado') as string),
            mes_actual: config?.mes_actual || 'Febrero'
        };

        try {
            await updateConfig(newConfig);
            setConfig(newConfig);
            showToast('Base actualizada con éxito');
        } catch (e) {
            showToast('Error actualizando la configuración', 'error');
        }
    };

    const tabs = [
        { id: 'generador', label: 'Procesar', icon: <Zap size={18} /> },
        { id: 'historial', label: 'Historial', icon: <Activity size={18} /> },
        { id: 'configuracion', label: 'Configuración', icon: <Settings size={18} /> }
    ];

    return (
        <div className="relative min-h-screen bg-background text-foreground font-sans overflow-hidden">

            {/* Ambient Background Elements (Subtle Glows behind content) */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="relative z-10 max-w-[1200px] mx-auto p-6 md:p-12 space-y-10">

                {/* Header Section */}
                <header className="flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-16 h-16 rounded-[24px] bg-white/60 dark:bg-white/5 border border-zinc-200/50 dark:border-white/10 backdrop-blur-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-xl shadow-indigo-500/10">
                        <Database size={32} />
                    </div>
                    <div>
                        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-zinc-900 dark:text-white mb-2">
                            Procesador de Datos
                        </h1>
                        <p className="text-zinc-500 dark:text-zinc-400 font-medium max-w-xl mx-auto text-sm md:text-base">
                            Automatización de reportes diarios de instalaciones, control de métricas zonales y operaciones.
                        </p>
                    </div>
                </header>

                {/* Floating Tabs Navigation */}
                <div className="flex justify-center">
                    <div className="flex p-1.5 bg-zinc-100/80 dark:bg-zinc-900/60 backdrop-blur-md rounded-full border border-zinc-200/50 dark:border-white/5 shadow-inner">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as TabType)}
                                className={cn(
                                    "relative flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-full transition-all duration-300",
                                    activeTab === tab.id
                                        ? "text-zinc-900 dark:text-white"
                                        : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                                )}
                            >
                                {activeTab === tab.id && (
                                    <motion.div
                                        layoutId="active-tab"
                                        className="absolute inset-0 bg-white dark:bg-white/10 shadow-sm border border-black/5 dark:border-white/5 rounded-full"
                                        initial={false}
                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                    />
                                )}
                                <span className="relative z-10 flex items-center gap-2">
                                    {tab.icon} {tab.label}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Content Area */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
                        transition={{ duration: 0.2 }}
                        className="w-full"
                    >

                        {/* --------------------- SECTION: GENERADOR --------------------- */}
                        {activeTab === 'generador' && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                                {/* INGESTA GLASS CARD */}
                                <div className="bg-white/70 dark:bg-zinc-900/40 backdrop-blur-2xl border border-zinc-200/50 dark:border-white/10 shadow-2xl shadow-black/5 dark:shadow-black/20 rounded-[32px] p-8 flex flex-col h-full">
                                    <div className="flex items-center justify-between mb-8">
                                        <h3 className="font-bold text-xl text-zinc-900 dark:text-white flex items-center gap-3">
                                            1. Ingesta de Datos
                                        </h3>
                                        <button onClick={handleLimpiar} className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors font-semibold text-sm flex items-center gap-2">
                                            <Trash2 size={16} /> Limpiar
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6 mb-6">
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-zinc-600 dark:text-zinc-400">Planificadas</label>
                                            <input
                                                type="number"
                                                value={planificadas}
                                                onChange={(e) => setPlanificadas(e.target.value)}
                                                className="w-full bg-zinc-50/50 dark:bg-black/20 border border-zinc-200/80 dark:border-white/10 focus:border-indigo-500 dark:focus:border-indigo-500 rounded-2xl px-5 py-3.5 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all text-base font-semibold text-zinc-900 dark:text-white"
                                                placeholder="Ej. 20"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-zinc-600 dark:text-zinc-400">Reagendas</label>
                                            <input
                                                type="number"
                                                value={reagendas}
                                                onChange={(e) => setReagendas(e.target.value)}
                                                className="w-full bg-zinc-50/50 dark:bg-black/20 border border-zinc-200/80 dark:border-white/10 focus:border-indigo-500 dark:focus:border-indigo-500 rounded-2xl px-5 py-3.5 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all text-base font-semibold text-zinc-900 dark:text-white"
                                                placeholder="Ej. 3"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2 mb-8 flex-1 flex flex-col">
                                        <label className="text-sm font-bold text-zinc-600 dark:text-zinc-400 flex items-center justify-between">
                                            Tabla Cruda (Pegado desde Excel)
                                        </label>
                                        <textarea
                                            value={textData}
                                            onChange={(e) => setTextData(e.target.value)}
                                            className="w-full flex-1 min-h-[180px] bg-zinc-50/50 dark:bg-black/20 border border-zinc-200/80 dark:border-white/10 focus:border-indigo-500 dark:focus:border-indigo-500 rounded-2xl px-5 py-4 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-mono text-sm resize-none whitespace-pre text-zinc-800 dark:text-zinc-200 custom-scrollbar"
                                            placeholder="Selecciona las filas en excel y pégalas directamente aquí..."
                                        />
                                    </div>

                                    <button
                                        onClick={handleGenerar}
                                        className="w-full bg-black dark:bg-white text-white dark:text-black font-bold flex items-center justify-center gap-3 py-4 rounded-2xl transition-transform active:scale-[0.98] shadow-xl shadow-black/10 dark:shadow-white/10 hover:opacity-90 mt-auto"
                                    >
                                        <RefreshCcw size={20} /> Generar Estructura Inteligente
                                    </button>
                                </div>

                                {/* OUTPUT GLASS CARD */}
                                <div className="bg-white/70 dark:bg-zinc-900/40 backdrop-blur-2xl border border-zinc-200/50 dark:border-white/10 shadow-2xl shadow-black/5 dark:shadow-black/20 rounded-[32px] p-8 flex flex-col h-full">
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                                        <h3 className="font-bold text-xl text-zinc-900 dark:text-white">2. Reporte Final</h3>
                                        <button
                                            onClick={handleGuardarReporte}
                                            disabled={!report}
                                            className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm rounded-2xl flex items-center gap-2 transition-transform active:scale-95 shadow-lg shadow-indigo-600/20"
                                        >
                                            <Save size={18} /> Consolidar en DB
                                        </button>
                                    </div>

                                    <textarea
                                        readOnly
                                        value={report?.reporte_texto || ''}
                                        placeholder="El reporte consolidado se mostrará aquí..."
                                        className="w-full flex-1 min-h-[300px] bg-zinc-50/50 dark:bg-black/20 border border-zinc-200/80 dark:border-white/10 rounded-2xl p-6 text-zinc-800 dark:text-zinc-200 font-mono text-sm leading-relaxed resize-none outline-none overflow-y-auto mb-6 custom-scrollbar"
                                    />

                                    <button
                                        onClick={handleCopiar}
                                        disabled={!report}
                                        className="w-full bg-zinc-100/50 hover:bg-zinc-200 dark:bg-white/5 dark:hover:bg-white/10 disabled:opacity-50 text-zinc-900 dark:text-white font-bold flex items-center justify-center gap-3 py-4 rounded-2xl transition-transform active:scale-[0.98] mt-auto"
                                    >
                                        <Copy size={20} /> Copiar al Portapapeles
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* --------------------- SECTION: HISTORIAL --------------------- */}
                        {activeTab === 'historial' && (
                            <div className="bg-white/70 dark:bg-zinc-900/40 backdrop-blur-2xl border border-zinc-200/50 dark:border-white/10 shadow-2xl shadow-black/5 dark:shadow-black/20 rounded-[32px] p-8 min-h-[600px] flex flex-col">
                                <h3 className="font-bold text-2xl text-zinc-900 dark:text-white flex items-center gap-3 mb-8">
                                    Historial de Operaciones
                                </h3>

                                <div className="flex-1 flex flex-col lg:flex-row gap-8 min-h-0">
                                    {/* Lista fechas */}
                                    <div className="lg:w-[240px] flex flex-col gap-2 overflow-y-auto pr-2 custom-scrollbar h-[300px] lg:h-auto">
                                        {history.map((h, i) => (
                                            <button
                                                key={i}
                                                onClick={() => setSelectedHistory(i)}
                                                className={cn(
                                                    "w-full text-left px-5 py-4 rounded-2xl transition-all text-sm font-bold flex items-center justify-between group",
                                                    selectedHistory === i
                                                        ? "bg-black text-white dark:bg-white dark:text-black shadow-lg"
                                                        : "bg-zinc-50/50 dark:bg-black/20 hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-400"
                                                )}
                                            >
                                                {h.fechaString.split(' ')[0]}
                                                <span className={cn("text-xs", selectedHistory === i ? "opacity-70" : "opacity-0 group-hover:opacity-100 transition-opacity")}>→</span>
                                            </button>
                                        ))}
                                        {history.length === 0 && (
                                            <div className="text-sm font-medium text-zinc-400 text-center py-8">
                                                Sin registros guardados.
                                            </div>
                                        )}
                                    </div>

                                    {/* Visor */}
                                    <div className="flex-1 flex flex-col gap-4">
                                        <div className="flex-1 bg-zinc-50/50 dark:bg-black/20 border border-zinc-200/80 dark:border-white/10 rounded-[24px] overflow-hidden relative">
                                            {selectedHistory !== null ? (
                                                <textarea
                                                    readOnly
                                                    value={history[selectedHistory].reporte}
                                                    className="w-full h-full absolute inset-0 p-6 text-zinc-800 dark:text-zinc-300 font-mono text-xs md:text-sm leading-relaxed resize-none outline-none overflow-y-auto bg-transparent custom-scrollbar"
                                                />
                                            ) : (
                                                <div className="absolute inset-0 flex items-center justify-center text-zinc-400 dark:text-zinc-600 font-medium">
                                                    Selecciona una fecha de la izquierda para ver el detalle.
                                                </div>
                                            )}
                                        </div>

                                        <button
                                            disabled={selectedHistory === null}
                                            onClick={handleDeleteHistory}
                                            className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-600 disabled:opacity-50 py-4 rounded-2xl font-bold transition-all flex justify-center items-center gap-2 text-sm"
                                        >
                                            <Trash2 size={18} /> Revertir Registro y Restar Métricas
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* --------------------- SECTION: CONFIGURACION --------------------- */}
                        {activeTab === 'configuracion' && (
                            <div className="max-w-2xl mx-auto bg-white/70 dark:bg-zinc-900/40 backdrop-blur-2xl border border-zinc-200/50 dark:border-white/10 shadow-2xl shadow-black/5 dark:shadow-black/20 rounded-[32px] p-8 md:p-12">
                                <div className="text-center mb-10">
                                    <h3 className="font-bold text-2xl text-zinc-900 dark:text-white mb-2">
                                        Parámetros de Base Activos
                                    </h3>
                                    <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                                        Estas son las métricas acumuladas actuales que se usarán como sumandos para los próximos reportes.
                                    </p>
                                </div>

                                {config ? (
                                    <form onSubmit={handleSaveConfig} className="flex flex-col gap-5">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {['valle', 'propatria', 'la_vega', 'tejerias', 'coche'].map((key) => (
                                                <div key={key} className="flex flex-col gap-2 p-5 rounded-[24px] bg-zinc-50/50 dark:bg-black/20 border border-zinc-200/50 dark:border-white/5">
                                                    <label className="text-sm font-bold text-zinc-500 dark:text-zinc-400 capitalize">
                                                        Zona: {key.replace('_', ' ')}
                                                    </label>
                                                    <input
                                                        name={key}
                                                        defaultValue={config[key]}
                                                        type="number"
                                                        required
                                                        className="w-full bg-transparent border-none px-0 py-1 outline-none font-mono text-3xl font-extrabold text-zinc-900 dark:text-white placeholder:text-zinc-200 transition-all focus:ring-0"
                                                    />
                                                </div>
                                            ))}

                                            <div className="flex flex-col gap-2 p-5 rounded-[24px] bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 col-span-1 sm:col-span-2 relative overflow-hidden">
                                                <div className="absolute -right-6 -bottom-6 opacity-10">
                                                    <Activity size={100} />
                                                </div>
                                                <label className="text-sm font-bold text-indigo-700 dark:text-indigo-400 capitalize relative z-10">
                                                    Acumulado Mes ({config.mes_actual})
                                                </label>
                                                <input
                                                    name="mes_acumulado"
                                                    defaultValue={config.mes_acumulado}
                                                    type="number"
                                                    required
                                                    className="w-full bg-transparent border-none px-0 py-1 outline-none font-mono text-4xl font-extrabold text-indigo-900 dark:text-indigo-100 placeholder:text-zinc-200 transition-all focus:ring-0 relative z-10"
                                                />
                                            </div>
                                        </div>

                                        <button
                                            type="submit"
                                            className="mt-6 w-full bg-black dark:bg-white text-white dark:text-black font-bold text-lg py-4 rounded-2xl transition-all shadow-xl shadow-black/10 dark:shadow-white/10 hover:scale-[0.98]"
                                        >
                                            Guardar Cambios Permanentemente
                                        </button>
                                    </form>
                                ) : (
                                    <div className="h-64 flex items-center justify-center">
                                        <div className="flex items-center gap-3 text-zinc-400 font-medium">
                                            <div className="w-5 h-5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                                            Cargando métricas...
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Floating Toast UI */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 50, scale: 0.9 }}
                        className={cn(
                            "fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-4 rounded-2xl flex items-center gap-3 shadow-2xl z-50 text-white font-bold tracking-wide backdrop-blur-xl border",
                            toast.type === 'success'
                                ? "bg-black/80 dark:bg-white/90 dark:text-black border-white/10 dark:border-black/10"
                                : "bg-red-600/90 border-red-500/50"
                        )}
                    >
                        {toast.type === 'success' ? <CheckCircle size={20} className={toast.type === 'success' ? "text-green-400 dark:text-green-600" : ""} /> : <AlertCircle size={20} />}
                        <span className="text-sm">{toast.msg}</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
