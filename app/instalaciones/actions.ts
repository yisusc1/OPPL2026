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

    let headerIdx = -1, zonaIdx = -1, powergoIdx = -1;
    for (let i = 0; i < validRows.length; i++) {
        const rowUpper = validRows[i].map(x => x.toUpperCase());
        for (let j = 0; j < rowUpper.length; j++) {
            if (["ZONA", "SECTOR"].includes(rowUpper[j])) zonaIdx = j;
            if (["POWER GO", "POWERGO"].includes(rowUpper[j])) powergoIdx = j;
        }
        if (zonaIdx !== -1) {
            headerIdx = i;
            break;
        }
    }

    const zonasCount = { valle: 0, propatria: 0, la_vega: 0, tejerias: 0, coche: 0 };
    let powergoCount = 0, totalRealizadas = 0;
    const startRow = headerIdx !== -1 ? headerIdx + 1 : 0;

    for (let i = startRow; i < validRows.length; i++) {
        const row = validRows[i];
        totalRealizadas++;
        let zoneFound = false;

        if (zonaIdx !== -1 && zonaIdx < row.length) {
            const mapped = mapZone(row[zonaIdx]);
            if (mapped) {
                // @ts-ignore
                zonasCount[mapped]++;
                zoneFound = true;
            }
        }

        if (!zoneFound) {
            for (const cell of row) {
                const mapped = mapZone(cell);
                if (mapped) {
                    // @ts-ignore
                    zonasCount[mapped]++;
                    break;
                }
            }
        }

        if (powergoIdx !== -1 && powergoIdx < row.length) {
            if (["si", "s"].includes(normalizeText(row[powergoIdx]))) {
                powergoCount++;
            }
        }
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
        zonas: zonasCount
    };
}
