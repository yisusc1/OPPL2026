'use server';

import { createClient } from '@/lib/supabase/server';
import { format } from 'date-fns';
import { revalidatePath } from 'next/cache';

// Tipos
export type ConfigData = {
    valle: number;
    propatria: number;
    la_vega: number;
    tejerias: number;
    coche: number;
    mes_acumulado: number;
    mes_actual: string;
};

export type HistoryEntry = {
    id?: string;
    fecha: string;
    reporte: string;
    metadata?: {
        total_realizadas: number;
        zonas_count: Record<string, number>;
    };
};

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const DEFAULT_CONFIG: ConfigData = {
    valle: 0, propatria: 0, la_vega: 0, tejerias: 0, coche: 0,
    mes_acumulado: 0, mes_actual: "Febrero"
};

const CONFIG_ID = 1;

// Base Data functions
async function loadConfigDB(): Promise<ConfigData> {
    const supabase = await createClient();
    const { data, error } = await supabase.from('config_totales').select('*').eq('id', CONFIG_ID).single();

    if (error || !data) {
        // Al fallar o no existir, intentar insertar los por defecto
        const fallback = { id: CONFIG_ID, ...DEFAULT_CONFIG };
        await supabase.from('config_totales').upsert([fallback]);
        return DEFAULT_CONFIG;
    }

    const { id, ...configData } = data;
    return configData as ConfigData;
}

async function saveConfigDB(config: ConfigData): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
        .from('config_totales')
        .upsert({ id: CONFIG_ID, ...config })
        .eq('id', CONFIG_ID);
    if (error) throw new Error(error.message);
}

async function checkMonth(config: ConfigData): Promise<ConfigData> {
    const currentMonthName = MESES[new Date().getMonth()];
    if (config.mes_actual !== currentMonthName) {
        config.mes_actual = currentMonthName;
        config.mes_acumulado = 0;
        await saveConfigDB(config);
    }
    return config;
}

// Exported Actions
export async function getConfig() {
    const config = await loadConfigDB();
    return await checkMonth(config);
}

export async function updateConfig(newConfig: any) {
    await saveConfigDB(newConfig);
    revalidatePath('/instalaciones');
    return { success: true };
}

export async function getHistory() {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('historial_reportes')
        .select('*')
        .order('fecha', { ascending: true });

    if (error || !data) return [];

    return data.map(h => ({
        ...h,
        // Mantener la visualización de la fecha
        fechaString: h.fecha ? format(new Date(h.fecha), 'dd/MM/yyyy HH:mm:ss') : ''
    }));
}

export async function deleteHistory(id: string, metadata: any) {
    const supabase = await createClient();
    // 1. Borrar historial
    const { error } = await supabase.from('historial_reportes').delete().eq('id', id);
    if (error) throw new Error(error.message);

    // 2. Descontar las métricas de la configuración global
    if (metadata) {
        const config = await loadConfigDB();
        const mz = metadata.zonas_count;
        const mt = metadata.total_realizadas;

        config.valle = Math.max(0, config.valle - (mz?.valle || 0));
        config.propatria = Math.max(0, config.propatria - (mz?.propatria || 0));
        config.la_vega = Math.max(0, config.la_vega - (mz?.la_vega || 0));
        config.tejerias = Math.max(0, config.tejerias - (mz?.tejerias || 0));
        config.coche = Math.max(0, config.coche - (mz?.coche || 0));
        config.mes_acumulado = Math.max(0, config.mes_acumulado - mt);

        await saveConfigDB(config);
    }

    revalidatePath('/instalaciones');
    return { success: true };
}

export async function saveReport(reportData: any) {
    const supabase = await createClient();

    // 1. Actualizar configuración global 
    const config = await loadConfigDB();
    config.valle += reportData.zonas.valle;
    config.propatria += reportData.zonas.propatria;
    config.la_vega += reportData.zonas.la_vega;
    config.tejerias += reportData.zonas.tejerias;
    config.coche += reportData.zonas.coche;
    config.mes_acumulado += reportData.totales;
    await saveConfigDB(config);

    // 2. Guardar en historial
    const { error } = await supabase.from('historial_reportes').insert([{
        fecha: new Date().toISOString(),
        reporte: reportData.reporte_texto,
        metadata: {
            total_realizadas: reportData.totales,
            zonas_count: reportData.zonas
        }
    }]);

    if (error) throw new Error(error.message);

    revalidatePath('/instalaciones');
    return { success: true };
}

export async function bulkInsertInstallations(dataArray: any[]) {
    if (!dataArray || dataArray.length === 0) return { success: true };

    const supabase = await createClient();
    const { error } = await supabase.from('installations').insert(dataArray);

    if (error) {
        throw new Error(error.message || 'Error inserting bulk data');
    }

    revalidatePath('/dashboard');
    revalidatePath('/instalaciones');

    return { success: true, count: dataArray.length };
}

// Logic parsing core
function normalizeText(name: string): string {
    name = name.toLowerCase();
    name = name.replace(/[áäâà]/g, 'a').replace(/[éëêè]/g, 'e').replace(/[íïîì]/g, 'i').replace(/[óöôò]/g, 'o').replace(/[úüûù]/g, 'u');
    return name;
}

function mapZone(text: string): string | null {
    const normalized = normalizeText(text);
    if (normalized.includes("valle")) return "valle";
    if (normalized.includes("propatria")) return "propatria";
    if (normalized.includes("vega")) return "la_vega";
    if (normalized.includes("tejeria")) return "tejerias";
    if (normalized.includes("coche")) return "coche";
    return null;
}

export async function processDataLogic(planificadas: number, reagendas: number, textData: string) {
    // Parsing excel text from clipboard
    const rows = textData.split('\n').map(row => row.split('\t').map(c => c.trim()));
    const validRows = rows.filter(r => r.filter(c => c).length >= 3);

    if (validRows.length === 0) throw new Error("No se encontraron filas válidas");

    // Índices de columnas
    let headerIdx = -1;
    let idx = {
        zona: -1,
        sector: -1,
        powergo: -1,
        cliente: -1,
        cedula: -1,
        router: -1,
        plan: -1,
        tecnico1: -1,
        tecnico2: -1,
        asesor: -1,
        servicio: -1,
        estatus: -1
    };

    for (let i = 0; i < validRows.length; i++) {
        const rowUpper = validRows[i].map(x => x.toUpperCase());
        for (let j = 0; j < rowUpper.length; j++) {
            const h = rowUpper[j];
            if (h.includes("ZONA")) idx.zona = j;
            if (h.includes("SECTOR") || h.includes("NODO")) idx.sector = j;
            if (h.includes("POWER") || h.includes("POWER GO")) idx.powergo = j;
            if (h.includes("CLIENTE") || h.includes("NOMBRE")) idx.cliente = j;
            if (h.includes("CEDULA") || h.includes("RIF") || h.includes("C.I")) idx.cedula = j;
            if (h.includes("ROUTER") || h.includes("EQUIPO") || h.includes("SERIAL")) idx.router = j;
            if (h.includes("PLAN") || h.includes("VELOCIDAD")) idx.plan = j;
            // Técnicos (buscamos la principal y la asistente)
            if (h.includes("TECNICO") || h.includes("TÉCNICO")) {
                if (idx.tecnico1 === -1) idx.tecnico1 = j;
                else if (idx.tecnico2 === -1) idx.tecnico2 = j;
            }
            if (h.includes("ASESOR") || h.includes("VENDEDOR")) idx.asesor = j;
            if (h.includes("SERVICIO")) idx.servicio = j;
            if (h.includes("ESTATUS") || h.includes("ESTADO") || h.includes("MOTIVO")) idx.estatus = j;
        }
        if (idx.zona !== -1 || idx.cliente !== -1) {
            headerIdx = i;
            break;
        }
    }

    const zonasCount = { valle: 0, propatria: 0, la_vega: 0, tejerias: 0, coche: 0 };
    let powergoCount = 0, totalRealizadas = 0;
    const startRow = headerIdx !== -1 ? headerIdx + 1 : 0;

    // Objeto base para inserción
    const raw_installations: any[] = [];
    const currentMonth = MESES[new Date().getMonth()].toUpperCase();
    const currentDate = new Date().toISOString().split('T')[0];

    for (let i = startRow; i < validRows.length; i++) {
        const row = validRows[i];
        if (row.filter(c => c).length < 2) continue; // Skip empty rows

        totalRealizadas++;
        let zoneFound = false;
        let mappedZoneVal = '';

        if (idx.zona !== -1 && idx.zona < row.length) {
            const mapped = mapZone(row[idx.zona]);
            if (mapped) {
                // @ts-ignore
                zonasCount[mapped]++;
                zoneFound = true;
                mappedZoneVal = mapped.toUpperCase().replace('_', ' ');
            } else {
                mappedZoneVal = row[idx.zona].toUpperCase();
            }
        }

        if (!zoneFound) {
            for (const cell of row) {
                const mapped = mapZone(cell);
                if (mapped) {
                    // @ts-ignore
                    zonasCount[mapped]++;
                    mappedZoneVal = mapped.toUpperCase().replace('_', ' ');
                    break;
                }
            }
        }

        let powerGoVal = "NO";
        if (idx.powergo !== -1 && idx.powergo < row.length) {
            if (["si", "s", "1", "yes"].includes(normalizeText(row[idx.powergo]))) {
                powergoCount++;
                powerGoVal = "SI";
            }
        }

        // Construir registro
        const getVal = (i: number, def = '') => (i !== -1 && i < row.length && row[i] ? row[i] : def);

        let planStr = getVal(idx.plan).toUpperCase();
        // Replace MBM with MB as requested by user
        planStr = planStr.replace(/MBM/g, 'MB').trim();

        raw_installations.push({
            fecha: currentDate,
            mes: currentMonth,
            tecnico_1: getVal(idx.tecnico1, 'Desconocido').toUpperCase(),
            tecnico_2: getVal(idx.tecnico2),
            router: getVal(idx.router),
            nombre_cliente: getVal(idx.cliente, 'Cliente Desconocido').toUpperCase(),
            cedula: getVal(idx.cedula, 'N/A'),
            zona: mappedZoneVal || getVal(idx.zona).toUpperCase() || 'DESCONOCIDA',
            sector: getVal(idx.sector).toUpperCase(),
            asesor: getVal(idx.asesor).toUpperCase(),
            estatus: getVal(idx.estatus, 'INSTALACION').toUpperCase(),
            plan: planStr,
            power_go: powerGoVal,
            servicio: getVal(idx.servicio, 'RESIDENCIAL').toUpperCase(),
        });
    }

    const config = await checkMonth(await loadConfigDB());
    const fPlan = totalRealizadas - (planificadas - reagendas);
    const fecha = format(new Date(), 'dd/MM/yyyy');

    // Construcción del Layout de texto esperado
    let txt = `Leyenda de Instalaciones ${fecha}\n\n`;
    txt += `Planificadas: ${planificadas}\nReagenda: ${reagendas}\nFuera de planificación: ${fPlan}\n`;
    txt += `Total Realizadas: ${totalRealizadas}\nPowerGo Hoy: ${powergoCount}\n`;
    txt += `Realizadas en el Valle: ${zonasCount.valle}\nRealizadas en Propatria: ${zonasCount.propatria}\n`;
    txt += `Realizadas en la Vega: ${zonasCount.la_vega}\nRealizadas en Tejerias: ${zonasCount.tejerias}\n`;
    txt += `Realizadas en Coche: ${zonasCount.coche}\n`;

    txt += `Total clientes el Valle: ${config.valle + zonasCount.valle}\nTotal Clientes Propatria: ${config.propatria + zonasCount.propatria}\n`;
    txt += `Total Clientes la Vega: ${config.la_vega + zonasCount.la_vega}\nTotal Clientes Tejerias: ${config.tejerias + zonasCount.tejerias}\n`;
    txt += `Total Clientes Coche: ${config.coche + zonasCount.coche}\nInstalaciones del mes (${config.mes_actual}): ${config.mes_acumulado + totalRealizadas}`;

    return {
        reporte_texto: txt,
        totales: totalRealizadas,
        zonas: zonasCount,
        raw_installations
    };
}

export async function insertManualInstallation(data: any) {
    const supabase = await createClient();

    // The data object should match the 'installations' table schema
    // Fields: fecha, mes, tecnico_1, tecnico_2, router, nombre_cliente, cedula, zona, sector, asesor, estatus, plan, power_go, servicio
    const { error } = await supabase.from('installations').insert([data]);

    if (error) {
        throw new Error(error.message || 'Error inserting manual installation');
    }

    // Revalidate paths to update the dashboard immediately
    revalidatePath('/dashboard');
    revalidatePath('/instalaciones');

    return { success: true };
}
