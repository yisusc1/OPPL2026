'use client'

import { useState, useRef } from 'react';
import { crearSalida, registrarEntrada } from '@/app/transporte/actions';
import { Sun, Moon, Wrench, Shield, Zap, MessageCircle } from 'lucide-react';

type Vehiculo = { id: string; placa: string; modelo: string; codigo: string };

type Reporte = {
    id: string;
    created_at: string;
    conductor: string;
    departamento: string;
    km_salida: number;
    vehiculo_id: string;
    // Soporte para array o objeto (Supabase a veces devuelve array si no se detecta la relación 1:1)
    vehiculos: {
        codigo: string;
        placa: string;
        modelo: string;
    } | {
        codigo: string;
        placa: string;
        modelo: string;
    }[];
};

export default function ReporteManager({
    vehiculos,
    pendientes,
    lastKmMap = {}
}: {
    vehiculos: Vehiculo[],
    pendientes: Reporte[],
    lastKmMap?: Record<string, number>
}) {
    const [modo, setModo] = useState<'salida' | 'entrada' | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Estado para la lógica condicional en SALIDA
    const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState<Vehiculo | null>(null);
    const [departamento, setDepartamento] = useState<string>('');
    const [ultimoKm, setUltimoKm] = useState<number>(0);
    const [errorKmSalida, setErrorKmSalida] = useState<string | null>(null);

    // Estado para lógica condicional en ENTRADA (leemos del reporte pendiente)
    const [reporteEntrada, setReporteEntrada] = useState<Reporte | null>(null);
    const [errorKm, setErrorKm] = useState<string | null>(null);

    // Helpers para detectar tipo
    const esMoto = (v: { codigo: string; modelo: string } | null | undefined) => v?.codigo.startsWith('M-') || v?.modelo.includes('MOTO');
    const esInstalacion = (d: string) => d === 'Instalación';

    // Refs para WhatsApp
    const salidaFormRef = useRef<HTMLFormElement>(null);
    const entradaFormRef = useRef<HTMLFormElement>(null);

    // --- GENERADORES DE TEXTO (PLAIN TEXT) ---
    const formatSalidaText = (data: any, vehiculoObj: Vehiculo | null | undefined) => {
        const check = (val: boolean | number) => val ? '✅' : '❌';
        // Only Model name, no plate
        const vehiculoNombre = vehiculoObj ? vehiculoObj.modelo : 'Desconocido';

        const fecha = new Date().toLocaleDateString();
        const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        let msg = `*Reporte de Salida*\n\n`;
        msg += `Fecha: ${fecha}\n`;
        msg += `Hora: ${hora}\n\n`;

        msg += `Conductor: ${data.conductor}\n`;
        msg += `Departamento: ${data.departamento}\n\n`;

        msg += `Vehículo: ${vehiculoNombre}\n`;
        msg += `Kilometraje (Salida): ${data.km_salida}\n`;
        msg += `Nivel de Gasolina: ${data.gasolina_salida}\n\n`;

        msg += `*Chequeo Técnico:*\n`;
        msg += `Chequeo de Aceite: ${check(data.aceite_salida)}\n`;
        msg += `Chequeo de Agua/Refrigerante: ${check(data.agua_salida)}\n\n`;

        msg += `*Seguridad:*\n`;
        msg += `Gato: ${check(data.gato_salida)}\n`;
        msg += `Llave Cruz: ${check(data.cruz_salida)}\n`;
        msg += `Triángulo: ${check(data.triangulo_salida)}\n`;
        msg += `Caucho: ${check(data.caucho_salida)}\n`;
        msg += `Carpeta de Permisos: ${check(data.carpeta_salida)}\n\n`;

        msg += `*Equipos Asignados:*\n`;
        if (esInstalacion(data.departamento)) {
            msg += `ONU/Router: ${check(data.onu_salida)}\n`;
            msg += `Mini-UPS: ${check(data.ups_salida)}\n`;
            msg += `Escalera: ${check(data.escalera_salida)}\n\n`;
        } else {
            msg += `N/A\n\n`;
        }

        msg += `Observaciones: ${data.observaciones_salida || 'Ninguna'}`;
        return msg;
    };


    const formatEntradaText = (entradaData: any, reporteOriginal: Reporte) => {
        const check = (val: boolean | number) => val ? '✅' : '❌';

        // Calcular fechas y horas
        const fechaSalidaObj = new Date(reporteOriginal.created_at);
        const fechaEntradaObj = new Date(); // Asumimos tiempo actual del cliente al enviar

        const fechaEntrada = fechaEntradaObj.toLocaleDateString();
        const horaSalida = fechaSalidaObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const horaEntrada = fechaEntradaObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const vehiculo = Array.isArray(reporteOriginal.vehiculos) ? reporteOriginal.vehiculos[0] : reporteOriginal.vehiculos;
        const vehiculoNombre = vehiculo ? vehiculo.modelo : 'Desconocido';
        const kmRecorrido = Number(entradaData.km_entrada) - Number(reporteOriginal.km_salida);

        let msg = `*Reporte de Entrada*\n\n`;

        msg += `Fecha (Entrada): ${fechaEntrada}\n`;
        msg += `Hora (Salida): ${horaSalida}\n`;
        msg += `Hora (Entrada): ${horaEntrada}\n\n`;

        msg += `Conductor: ${reporteOriginal.conductor}\n`;
        msg += `Departamento: ${reporteOriginal.departamento}\n\n`;

        msg += `Vehículo: ${vehiculoNombre}\n`;
        msg += `Kilometraje (Salida): ${reporteOriginal.km_salida}\n`;
        msg += `Kilometraje (Entrada): ${entradaData.km_entrada}\n`;
        msg += `Kilometraje Recorrido: ${kmRecorrido}\n`;
        msg += `Nivel de Gasolina: ${entradaData.gasolina_entrada}\n\n`;

        msg += `*Chequeo Técnico:*\n`;
        msg += `Chequeo de Aceite: ${check(entradaData.aceite_entrada)}\n`;
        msg += `Chequeo de Agua/Refrigerante: ${check(entradaData.agua_entrada)}\n\n`;

        msg += `*Seguridad:*\n`;
        msg += `Gato: ${check(entradaData.gato_entrada)}\n`;
        msg += `Llave Cruz: ${check(entradaData.cruz_entrada)}\n`;
        msg += `Triángulo: ${check(entradaData.triangulo_entrada)}\n`;
        msg += `Caucho: ${check(entradaData.caucho_entrada)}\n`;
        msg += `Carpeta de Permisos: ${check(entradaData.carpeta_entrada)}\n\n`;

        msg += `*Equipos Asignados:*\n`;
        if (esInstalacion(reporteOriginal.departamento)) {
            msg += `ONU/Router: ${check(entradaData.onu_entrada)}\n`;
            msg += `Mini-UPS: ${check(entradaData.ups_entrada)}\n`;
            msg += `Escalera: ${check(entradaData.escalera_entrada)}\n\n`;
        } else {
            msg += `N/A\n\n`;
        }

        msg += `Observaciones: ${entradaData.observaciones_entrada || 'Ninguna'}`;
        return msg;
    };


    // --- HANDLERS UNIFICADOS ---

    const handleSalidaSubmit = async (formData: FormData) => {
        setSubmitting(true);
        const res = await crearSalida(formData);

        if (res?.success) {
            // 1. Preparar datos para el mensaje
            // Convertimos formData a objeto plano para facilitar
            const raw: any = {};
            formData.forEach((value, key) => raw[key] = value);

            // Re-procesar checkboxes y numeros como lo hace el server (aproximado para el msg)
            const processed = {
                ...raw,
                aceite_salida: raw.aceite_salida === 'on',
                agua_salida: raw.agua_salida === 'on',
                // ...otros booleanos
                gato_salida: raw.gato_salida === 'on',
                cruz_salida: raw.cruz_salida === 'on',
                triangulo_salida: raw.triangulo_salida === 'on',
                caucho_salida: raw.caucho_salida === 'on',
                carpeta_salida: raw.carpeta_salida === 'on',
                onu_salida: raw.onu_salida === 'on',
                ups_salida: raw.ups_salida === 'on',
                escalera_salida: raw.escalera_salida === 'on',
            };

            const vehiculoObj = vehiculos.find(v => v.id === processed.vehiculo_id);
            const text = formatSalidaText(processed, vehiculoObj);

            // 2. Abrir WhatsApp
            const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
            window.open(url, '_blank');

            // 3. Reset UI
            setModo(null);
            alert('Salida registrada con éxito. Se ha abierto WhatsApp.');
        } else {
            alert('Error al guardar: ' + res?.error);
        }
        setSubmitting(false);
    };

    const handleEntradaSubmit = async (formData: FormData) => {
        setSubmitting(true);
        const res = await registrarEntrada(formData);

        if (res?.success) {
            const raw: any = {};
            formData.forEach((value, key) => raw[key] = value);

            const processed = {
                ...raw,
                aceite_entrada: raw.aceite_entrada === 'on',
                agua_entrada: raw.agua_entrada === 'on',
                gato_entrada: raw.gato_entrada === 'on',
                cruz_entrada: raw.cruz_entrada === 'on',
                triangulo_entrada: raw.triangulo_entrada === 'on',
                caucho_entrada: raw.caucho_entrada === 'on',
                carpeta_entrada: raw.carpeta_entrada === 'on',
                onu_entrada: raw.onu_entrada === 'on',
                ups_entrada: raw.ups_entrada === 'on',
                escalera_entrada: raw.escalera_entrada === 'on',
            };

            const text = formatEntradaText(processed, reporteEntrada!);
            const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
            window.open(url, '_blank');

            setModo(null);
            alert('Entrada registrada con éxito. Se ha abierto WhatsApp.');
        } else {
            alert('Error al guardar: ' + res?.error);
        }
        setSubmitting(false);
    };

    return (
        <div className="w-full max-w-lg mx-auto pb-20">

            {/* PESTAÑAS (Solo visibles si no hay modo seleccionado) */}
            {!modo && (
                <div className="flex flex-col gap-4 mt-6">
                    <button
                        onClick={() => setModo('salida')}
                        className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-200 flex items-center justify-between active:scale-[0.98] transition-all group"
                    >
                        <div className="flex items-center gap-5">
                            <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-900 group-hover:bg-black group-hover:text-white transition-colors">
                                <Sun size={36} strokeWidth={1.5} />
                            </div>
                            <div className="text-left">
                                <span className="block text-xl font-bold text-zinc-900 tracking-tight">Mañana (Salida)</span>
                                <span className="text-zinc-500 text-base">Registrar inicio de ruta</span>
                            </div>
                        </div>
                        <div className="text-zinc-300">
                            <svg width="12" height="20" viewBox="0 0 12 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M2 2L10 10L2 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                    </button>

                    <button
                        onClick={() => setModo('entrada')}
                        className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-200 flex items-center justify-between active:scale-[0.98] transition-all group"
                    >
                        <div className="flex items-center gap-5">
                            <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-900 group-hover:bg-black group-hover:text-white transition-colors">
                                <Moon size={36} strokeWidth={1.5} />
                            </div>
                            <div className="text-left">
                                <span className="block text-xl font-bold text-zinc-900 tracking-tight">Tarde (Entrada)</span>
                                <span className="text-zinc-500 text-base">Cerrar ruta y novedades</span>
                            </div>
                        </div>
                        <div className="text-zinc-300">
                            <svg width="12" height="20" viewBox="0 0 12 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M2 2L10 10L2 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                    </button>
                </div>
            )}

            {(modo === 'salida' || modo === 'entrada') && (
                <div className="mb-6">
                    <button onClick={() => setModo(null)} className="text-base text-zinc-500 hover:text-black flex items-center gap-2 font-medium px-2 py-3">
                        <svg width="10" height="16" viewBox="0 0 12 20" fill="none" className="rotate-180" xmlns="http://www.w3.org/2000/svg">
                            <path d="M2 2L10 10L2 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Volver al menú
                    </button>
                </div>
            )}

            <div>

                {/* ---------------- FORMULARIO SALIDA ---------------- */}
                {modo === 'salida' && (
                    <form action={handleSalidaSubmit} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="px-2">
                            <h2 className="text-3xl font-bold tracking-tight text-zinc-900">Salida</h2>
                            <p className="text-zinc-500 text-lg mt-1">Complete los datos de la mañana.</p>
                        </div>

                        {/* GRUPO 1 INFO */}
                        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
                            <div className="divide-y divide-zinc-100 pl-6">
                                <div className="py-5 pr-6">
                                    <label className="label">Vehículo</label>
                                    <div className="relative mt-2">
                                        <select
                                            name="vehiculo_id" required className="input appearance-none bg-zinc-50 font-medium"
                                            onChange={(e) => {
                                                const v = vehiculos.find(x => x.id === e.target.value);
                                                setVehiculoSeleccionado(v || null);
                                                if (v && lastKmMap[v.id]) {
                                                    setUltimoKm(lastKmMap[v.id]);
                                                } else {
                                                    setUltimoKm(0);
                                                }
                                            }}
                                            defaultValue=""
                                        >
                                            <option value="" disabled>Seleccionar vehículo...</option>
                                            {vehiculos.map(v => (
                                                <option key={v.id} value={v.id}>{v.modelo} - {v.placa}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">▼</div>
                                    </div>
                                </div>
                                <div className="py-5 pr-6">
                                    <label className="label">Conductor</label>
                                    <input name="conductor" required type="text" className="input mt-2 bg-zinc-50 font-medium" placeholder="Su nombre completo" />
                                </div>
                                <div className="py-5 pr-6">
                                    <label className="label">Departamento</label>
                                    <div className="relative mt-2">
                                        <select
                                            name="departamento" required className="input appearance-none bg-zinc-50 font-medium"
                                            onChange={(e) => setDepartamento(e.target.value)}
                                        >
                                            <option value="">Seleccionar departamento...</option>
                                            <option>Instalación</option>
                                            <option>Afectaciones</option>
                                            <option>Distribución</option>
                                            <option>Comercialización</option>
                                            <option>Transporte</option>
                                            <option>Operaciones</option>
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">▼</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
                            <div className="divide-y divide-zinc-100 pl-6">
                                <div className="py-5 pr-6">
                                    <label className="label">Kilometraje Actual</label>
                                    <input
                                        name="km_salida" required type="number"
                                        className={`input mt-2 bg-zinc-50 text-xl font-medium tracking-wide ${errorKmSalida ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                        defaultValue={ultimoKm > 0 ? ultimoKm : ''}
                                        min={ultimoKm}
                                        placeholder="0"
                                        onChange={(e) => {
                                            const val = Number(e.target.value);
                                            if (ultimoKm > 0) {
                                                if (val < ultimoKm) {
                                                    setErrorKmSalida(`Error: Menor al último (${ultimoKm})`);
                                                } else if (val > ultimoKm + 10) {
                                                    setErrorKmSalida(`Error: Mayor a límite permitido (${ultimoKm + 10})`);
                                                } else {
                                                    setErrorKmSalida(null);
                                                }
                                            }
                                        }}
                                    />
                                    {ultimoKm > 0 && <p className="text-sm text-zinc-400 mt-2">Último cierre: <strong>{ultimoKm} km</strong></p>}
                                    {errorKmSalida && <p className="text-sm text-red-600 mt-1 font-medium">{errorKmSalida}</p>}
                                </div>
                                <div className="py-5 pr-6">
                                    <label className="label">Nivel de Gasolina</label>
                                    <div className="relative mt-2">
                                        <select name="gasolina_salida" className="input appearance-none bg-zinc-50 font-medium">
                                            <option>Full</option> <option>3/4</option> <option>1/2</option> <option>1/4</option> <option>Reserva</option>
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">▼</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <h3 className="text-xl font-bold text-zinc-900 px-2 pt-2">Chequeos</h3>

                        {/* 2. Chequeos Condicionales */}
                        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden divide-y divide-zinc-100">

                            {/* TÉCNICO */}
                            <div className="p-5 bg-zinc-50 border-b border-zinc-100">
                                <h4 className="font-bold text-zinc-500 uppercase text-xs tracking-wider flex items-center gap-2"><Wrench size={16} /> Técnico</h4>
                            </div>
                            <div className="pl-6">
                                <label className="check-row pr-6 py-5 border-b border-zinc-100 last:border-0">
                                    <span className="text-lg font-medium text-zinc-900">Nivel de Aceite</span>
                                    <input name="aceite_salida" type="checkbox" className="checkbox" />
                                </label>
                                <label className="check-row pr-6 py-5">
                                    <span className="text-lg font-medium text-zinc-900">Agua / Refrigerante</span>
                                    <input name="agua_salida" type="checkbox" className="checkbox" />
                                </label>
                            </div>

                            {/* SEGURIDAD */}
                            {!esMoto(vehiculoSeleccionado) && (
                                <>
                                    <div className="p-5 bg-zinc-50 border-b border-zinc-100 border-t">
                                        <h4 className="font-bold text-zinc-500 uppercase text-xs tracking-wider flex items-center gap-2"><Shield size={16} /> Seguridad</h4>
                                    </div>
                                    <div className="pl-6">
                                        {[{ k: 'gato_salida', l: 'Gato' }, { k: 'cruz_salida', l: 'Llave Cruz' }, { k: 'triangulo_salida', l: 'Triángulo' }, { k: 'caucho_salida', l: 'Caucho Repuesto' }, { k: 'carpeta_salida', l: 'Carpeta de Permisos' }].map((item) => (
                                            <label key={item.k} className="check-row pr-6 py-5 border-b border-zinc-100 last:border-0">
                                                <span className="text-lg font-medium text-zinc-900">{item.l}</span>
                                                <input name={item.k} type="checkbox" className="checkbox" />
                                            </label>
                                        ))}
                                    </div>
                                </>
                            )}

                            {/* EQUIPOS */}
                            {esInstalacion(departamento) && (
                                <>
                                    <div className="p-5 bg-zinc-50 border-b border-zinc-100 border-t">
                                        <h4 className="font-bold text-zinc-500 uppercase text-xs tracking-wider flex items-center gap-2"><Zap size={16} /> Equipos</h4>
                                    </div>
                                    <div className="pl-6">
                                        <label className="check-row pr-6 py-5 border-b border-zinc-100">
                                            <span className="text-lg font-medium text-zinc-900">ONU / Router</span>
                                            <input name="onu_salida" type="checkbox" className="checkbox" />
                                        </label>
                                        <label className="check-row pr-6 py-5 border-b border-zinc-100">
                                            <span className="text-lg font-medium text-zinc-900">Mini-UPS</span>
                                            <input name="ups_salida" type="checkbox" className="checkbox" />
                                        </label>
                                        <label className="check-row pr-6 py-5">
                                            <span className="text-lg font-medium text-zinc-900">Escalera</span>
                                            <input name="escalera_salida" type="checkbox" className="checkbox" />
                                        </label>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden p-6">
                            <label className="label">Observaciones</label>
                            <textarea name="observaciones_salida" rows={3} className="input mt-2 bg-zinc-50 resize-none text-lg" placeholder="Golpes, rayones..."></textarea>
                        </div>

                        <div className="pt-4 pb-12">
                            <button disabled={submitting || !!errorKmSalida} className={`btn-primary w-full shadow-xl shadow-zinc-300 transform active:scale-[0.98] transition-all ${!!errorKmSalida ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                <span>{submitting ? 'Enviando...' : 'Enviar Reporte'}</span>
                            </button>
                        </div>
                    </form>
                )}


                {/* ---------------- FORMULARIO ENTRADA ---------------- */}
                {modo === 'entrada' && (
                    <form action={handleEntradaSubmit} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="px-2">
                            <h2 className="text-3xl font-bold tracking-tight text-zinc-900">Entrada</h2>
                            <p className="text-zinc-500 text-lg mt-1">Cierre de ruta y novedades.</p>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden p-6">
                            <label className="label mb-2">Vehículo en Ruta</label>
                            <div className="relative">
                                <select
                                    name="reporte_id" required className="input appearance-none bg-zinc-50 text-lg py-4 font-medium" defaultValue=""
                                    onChange={(e) => {
                                        const r = pendientes.find(p => p.id === e.target.value);
                                        setReporteEntrada(r || null);
                                    }}
                                >
                                    <option value="" disabled>Seleccionar vehículo...</option>
                                    {pendientes.map((p) => {
                                        const v = Array.isArray(p.vehiculos) ? p.vehiculos[0] : p.vehiculos;
                                        const label = v ? `${v.modelo} - ${v.placa}` : `Vehículo (ID: ${p.vehiculo_id})`;
                                        return (
                                            <option key={p.id} value={p.id}>
                                                {label}
                                            </option>
                                        );
                                    })}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">▼</div>
                            </div>
                        </div>

                        {reporteEntrada && (
                            <>
                                <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
                                    <div className="divide-y divide-zinc-100 pl-6">
                                        <div className="py-5 pr-6">
                                            <label className="label">Kilometraje Llegada</label>
                                            <input
                                                name="km_entrada" required type="number"
                                                className={`input mt-2 bg-zinc-50 text-xl font-medium tracking-wide ${errorKm ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                                placeholder={reporteEntrada.km_salida.toString()}
                                                onChange={(e) => {
                                                    const val = Number(e.target.value);
                                                    const min = reporteEntrada.km_salida;
                                                    const max = min + 600;

                                                    if (val < min) {
                                                        setErrorKm(`Error: Menor a salida (${min})`);
                                                    } else if (val > max) {
                                                        setErrorKm(`Alerta: Kilometraje excesivo`);
                                                    } else {
                                                        setErrorKm(null);
                                                    }
                                                }}
                                            />
                                            {errorKm && <p className="text-sm text-red-600 mt-2 font-medium">{errorKm}</p>}
                                        </div>
                                        <div className="py-5 pr-6">
                                            <label className="label">Nivel Gasolina</label>
                                            <div className="relative mt-2">
                                                <select name="gasolina_entrada" className="input appearance-none bg-zinc-50 font-medium">
                                                    <option>Full</option> <option>3/4</option> <option>1/2</option> <option>1/4</option> <option>Reserva</option>
                                                </select>
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">▼</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <h3 className="text-xl font-bold text-zinc-900 px-2 pt-2">Estado Llegada</h3>

                                <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden divide-y divide-zinc-100">
                                    {/* TÉCNICO */}
                                    <div className="p-5 bg-zinc-50 border-b border-zinc-100">
                                        <h4 className="font-bold text-zinc-500 uppercase text-xs tracking-wider flex items-center gap-2"><Wrench size={16} /> Técnico</h4>
                                    </div>
                                    <div className="pl-6">
                                        <label className="check-row pr-6 py-5 border-b border-zinc-100 last:border-0">
                                            <span className="text-lg font-medium text-zinc-900">Nivel de Aceite</span>
                                            <input name="aceite_entrada" type="checkbox" className="checkbox" />
                                        </label>
                                        <label className="check-row pr-6 py-5">
                                            <span className="text-lg font-medium text-zinc-900">Agua / Refrigerante</span>
                                            <input name="agua_entrada" type="checkbox" className="checkbox" />
                                        </label>
                                    </div>

                                    {/* SEGURIDAD */}
                                    {!esMoto(Array.isArray(reporteEntrada.vehiculos) ? reporteEntrada.vehiculos[0] : reporteEntrada.vehiculos) && (
                                        <>
                                            <div className="p-5 bg-zinc-50 border-b border-zinc-100 border-t">
                                                <h4 className="font-bold text-zinc-500 uppercase text-xs tracking-wider flex items-center gap-2"><Shield size={16} /> Herramientas</h4>
                                            </div>
                                            <div className="pl-6">
                                                {['gato', 'cruz', 'triangulo', 'caucho', 'carpeta'].map(item => (
                                                    <label key={item} className="check-row pr-6 py-5 border-b border-zinc-100 last:border-0 capitalize">
                                                        <span className="text-lg font-medium text-zinc-900">{item}</span>
                                                        <input name={`${item}_entrada`} type="checkbox" className="checkbox" />
                                                    </label>
                                                ))}
                                            </div>
                                        </>
                                    )}

                                    {/* EQUIPOS */}
                                    {esInstalacion(reporteEntrada.departamento) && (
                                        <>
                                            <div className="p-5 bg-zinc-50 border-b border-zinc-100 border-t">
                                                <h4 className="font-bold text-zinc-500 uppercase text-xs tracking-wider flex items-center gap-2"><Zap size={16} /> Equipos</h4>
                                            </div>
                                            <div className="pl-6">
                                                <label className="check-row pr-6 py-5 border-b border-zinc-100">
                                                    <span className="text-lg font-medium text-zinc-900">ONU / Router</span>
                                                    <input name="onu_entrada" type="checkbox" className="checkbox" />
                                                </label>
                                                <label className="check-row pr-6 py-5 border-b border-zinc-100">
                                                    <span className="text-lg font-medium text-zinc-900">Mini-UPS</span>
                                                    <input name="ups_entrada" type="checkbox" className="checkbox" />
                                                </label>
                                                <label className="check-row pr-6 py-5">
                                                    <span className="text-lg font-medium text-zinc-900">Escalera</span>
                                                    <input name="escalera_entrada" type="checkbox" className="checkbox" />
                                                </label>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden p-6">
                                    <label className="label">Observaciones</label>
                                    <textarea name="observaciones_entrada" rows={3} className="input mt-2 bg-zinc-50 resize-none text-lg" placeholder="Novedades..."></textarea>
                                </div>

                                <div className="pt-4 pb-12">
                                    <button
                                        disabled={!!errorKm || submitting}
                                        className={`btn-primary w-full shadow-xl shadow-zinc-300 transform active:scale-[0.98] transition-all ${errorKm ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <span>{submitting ? 'Enviando...' : 'Enviar Reporte'}</span>
                                    </button>
                                </div>
                            </>
                        )}
                    </form>
                )}
            </div>

            <style jsx>{`
        .input { width: 100%; padding: 1rem 1.25rem; border-radius: 0.75rem; border: 1px solid transparent; outline: none; font-size: 1.1rem; color: #18181b; transition: all 0.2s; }
        .input:focus { background: white; border-color: #000; box-shadow: 0 0 0 1px #000; }
        .label { font-size: 0.8rem; font-weight: 700; color: #71717a; text-transform: uppercase; letter-spacing: 0.05em; }
        .btn-primary { background: #000; color: white; padding: 1.25rem; border-radius: 1rem; font-weight: 600; font-size: 1.1rem; border: none; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
        .check-row { display: flex; align-items: center; justify-content: space-between; cursor: pointer; }
        .checkbox { width: 1.5rem; height: 1.5rem; accent-color: black; border-radius: 0.375rem; }
      `}</style>
        </div>
    );
}
