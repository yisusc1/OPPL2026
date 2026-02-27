
import { createClient } from '@/lib/supabase/client';

// Types
export interface Installation {
    id: number;
    created_at: string;
    fecha: string; // YYYY-MM-DD
    mes: string;
    tecnico_1: string;
    tecnico_2: string | null;
    router: string | null;
    nombre_cliente: string;
    cedula: string;
    zona: string;
    sector: string;
    asesor: string;
    estatus: string;
    plan: string;
    power_go: string; // "SI" | "NO"
    servicio: string;
}

export interface MetricChart {
    name: string;
    value: number;
    fill?: string;
}

export interface DetailedDailyMetric {
    name: string;
    fullDate: string;
    instalaciones: number;
    solicitudes: number;
    asesor_top: string;
    sector_principal: string;
}

export interface DashboardMetrics {
    counters: {
        totalSolicitudes: number;
        powerGoCount: number;
        maxVentas: number;
        topAsesor: string;
        routerCount: number;
        nuevosServicios: number;
        diasLaborados: number;
    };
    trend: {
        percentageChange: number;
    };
    charts: {
        byMonth: MetricChart[];
        byDay: MetricChart[];
        detailedByDay: DetailedDailyMetric[];
        byStatus: MetricChart[];
        byService: MetricChart[];
        byPlan: MetricChart[];
        byZone: MetricChart[];
        byAdvisor: MetricChart[];
        byTechnician: MetricChart[];
        bySector: MetricChart[];
    };
    raw: Installation[];
}

export async function fetchInstallations(): Promise<DashboardMetrics> {
    const supabase = createClient();
    try {
        let allData: any[] = [];
        let from = 0;
        const limit = 1000;
        let moreDataAvailable = true;

        while (moreDataAvailable) {
            const { data, error } = await supabase
                .from('installations')
                .select('*')
                .range(from, from + limit - 1);

            if (error) {
                console.error(`Error fetching installations batch ${from}-${from + limit}:`, error);
                throw error;
            }

            if (data && data.length > 0) {
                allData = [...allData, ...data];

                if (data.length < limit) {
                    moreDataAvailable = false;
                } else {
                    from += limit;
                }
            } else {
                moreDataAvailable = false;
            }
        }

        if (allData.length === 0) return calculateAdvancedMetrics([]);

        // Format dates if needed (Assuming DB ensures correct format, but good to double check)
        const formattedData = allData.map((item: any) => ({
            ...item,
            // Ensure month is uppercase for consistency
            mes: item.mes?.toUpperCase() || "UNKNOWN",
        }));

        return calculateAdvancedMetrics(formattedData);
    } catch (e) {
        console.error("Error fetching data:", e);
        // Fallback to mock data
        const mockData = generateMockData(200);
        return calculateAdvancedMetrics(mockData);
    }
}


export function calculateAdvancedMetrics(data: Installation[], trendData: Installation[] = data): DashboardMetrics {
    const total = data.length;

    // 1. Counters
    const powerGoCount = data.filter(d => d.power_go === "SI").length;
    const routerCount = data.filter(d => d.router).length; // Assuming router is not null/empty
    const nuevosServicios = data.filter(d => d.estatus === "INSTALACION").length; // Approximation

    // Days worked (unique count of dates)
    const uniqueDays = new Set(data.map(d => d.fecha).filter(Boolean));
    const diasLaborados = uniqueDays.size;

    // Top Advisor
    const advisorCounts: Record<string, number> = {};
    data.forEach(d => {
        if (d.asesor) advisorCounts[d.asesor] = (advisorCounts[d.asesor] || 0) + 1;
    });
    const topAsesorEntry = Object.entries(advisorCounts).sort((a, b) => b[1] - a[1])[0];
    const topAsesor = topAsesorEntry ? topAsesorEntry[0] : "N/A";
    const maxVentas = topAsesorEntry ? topAsesorEntry[1] : 0;

    // 2. Trend (Real calculation based on month sequence)
    let percentageChange = 0;
    const monthOrder = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];

    if (trendData.length > 0 && data.length > 0) {
        // Find all unique months in the CURRENT view (data), sorted chronologically
        const monthsInData = Array.from(new Set(data.map(d => d.mes))).sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b));

        if (monthsInData.length > 0) {
            // The "current" month is the latest month present in the current filter view
            const currentMonth = monthsInData[monthsInData.length - 1];
            const currentMonthIdx = monthOrder.indexOf(currentMonth);

            if (currentMonthIdx > 0) {
                // The previous month is the one immediately preceding it chronologically in the year
                const previousMonth = monthOrder[currentMonthIdx - 1];

                // Count totals in the robust `trendData` (which has all months, but preserves other user filters)
                const currentMonthTotal = trendData.filter(d => d.mes === currentMonth).length;
                const previousMonthTotal = trendData.filter(d => d.mes === previousMonth).length;

                if (previousMonthTotal > 0) {
                    percentageChange = Math.round(((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100);
                } else if (currentMonthTotal > 0) {
                    percentageChange = 100; // From 0 to something is a 100% baseline increase symbol
                }
            }
        }
    }

    // 3. Charts
    const countBy = (key: keyof Installation) => {
        const counts: Record<string, number> = {};
        data.forEach(item => {
            const val = String(item[key] || "N/A");
            counts[val] = (counts[val] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    };

    // Special handling for merged technicians
    const techCounts: Record<string, number> = {};
    data.forEach(item => {
        if (item.tecnico_1) techCounts[item.tecnico_1] = (techCounts[item.tecnico_1] || 0) + 1;
        if (item.tecnico_2) techCounts[item.tecnico_2] = (techCounts[item.tecnico_2] || 0) + 1;
    });
    const byTechnician = Object.entries(techCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    // Month & Day ordering (reusing logic from calculateMetrics or simplifying)
    // We can reuse the aggregations.

    const byMonth = countBy('mes');
    byMonth.sort((a, b) => monthOrder.indexOf(a.name) - monthOrder.indexOf(b.name));

    // By Day (Detailed for TradingView Chart)
    const detailedDayMap = new Map<string, Installation[]>();
    data.forEach(item => {
        if (!item.fecha) return;
        if (!detailedDayMap.has(item.fecha)) {
            detailedDayMap.set(item.fecha, []);
        }
        detailedDayMap.get(item.fecha)!.push(item);
    });

    const detailedByDay: DetailedDailyMetric[] = Array.from(detailedDayMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([dateStr, itemsForDay]) => {
            const parts = dateStr.split('-');
            const name = parts.length === 3 ? `${parts[2]}-${parts[1]}` : dateStr;

            const solicitudes = itemsForDay.length;
            const instalaciones = itemsForDay.filter(d => d.power_go === "SI").length;

            // Top Asesor
            const advisorCounts: Record<string, number> = {};
            // Top Sector
            const sectorCounts: Record<string, number> = {};

            itemsForDay.forEach(d => {
                if (d.asesor) advisorCounts[d.asesor] = (advisorCounts[d.asesor] || 0) + 1;
                if (d.sector) sectorCounts[d.sector] = (sectorCounts[d.sector] || 0) + 1;
            });

            const topAsesorDaily = Object.entries(advisorCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";
            const topSectorDaily = Object.entries(sectorCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

            return {
                name,
                fullDate: dateStr,
                instalaciones,
                solicitudes,
                asesor_top: topAsesorDaily,
                sector_principal: topSectorDaily
            };
        });

    const byDay = detailedByDay.map(d => ({ name: d.name, value: d.instalaciones })); // Keep standard byDay pointing to 'value' for backward compatibility or replace

    return {
        counters: {
            totalSolicitudes: total,
            powerGoCount,
            maxVentas,
            topAsesor,
            routerCount,
            nuevosServicios,
            diasLaborados
        },
        trend: {
            percentageChange
        },
        charts: {
            byMonth,
            byDay,
            detailedByDay,
            byStatus: countBy('estatus'),
            byService: countBy('servicio'),
            byPlan: countBy('plan'),
            byZone: countBy('zona'),
            byAdvisor: countBy('asesor'),
            byTechnician,
            bySector: countBy('sector')
        },
        raw: data
    };
}


// Mock Generator (Simplified fallback)
export function generateMockData(count: number = 200): Installation[] {
    const STATUSES = ["INSTALACION", "MIGRACION", "CONVENIO", "EMPLEADO", "MUDANZA"];
    return Array.from({ length: count }).map((_, i) => ({
        id: i,
        created_at: new Date().toISOString(),
        fecha: "2026-01-02",
        mes: "ENERO",
        tecnico_1: "Tecnico Mock",
        tecnico_2: "Tecnico Mock 2",
        router: Math.random() > 0.5 ? "Huawei" : null,
        nombre_cliente: `Cliente ${i}`,
        cedula: "123456",
        zona: "LOS TEQUES",
        sector: "EL VIGIA",
        asesor: "TAQUILLA",
        estatus: STATUSES[Math.floor(Math.random() * STATUSES.length)],
        plan: "400 MB",
        power_go: Math.random() > 0.8 ? "SI" : "NO",
        servicio: "RESIDENCIAL"
    }));
}

// --- Network Map Data ---

export interface NetworkNode {
    id: number;
    nombre: string;
    latitud: number;
    longitud: number;
    tipo: string;
}

export async function fetchNetworkNodes(): Promise<NetworkNode[]> {
    const supabase = createClient();
    try {
        let allNodes: any[] = [];
        let from = 0;
        const limit = 1000;
        let moreDataAvailable = true;

        console.log("Starting batch fetch for network nodes...");

        while (moreDataAvailable) {
            const { data, error } = await supabase
                .from('network_nodes')
                .select('*')
                .range(from, from + limit - 1);

            if (error) {
                console.error(`Error fetching batch ${from}-${from + limit}:`, error);
                break;
            }

            if (data && data.length > 0) {
                allNodes = [...allNodes, ...data];
                console.log(`Fetched batch ${from}-${from + data.length - 1} (Total: ${allNodes.length})`);

                if (data.length < limit) {
                    moreDataAvailable = false; // Less than limit means we reached the end
                } else {
                    from += limit;
                }
            } else {
                moreDataAvailable = false;
            }
        }

        if (allNodes.length === 0) {
            console.log("No network nodes found in DB, using mock nodes.");
            return generateMockNodes();
        }

        console.log(`Total fetched network nodes: ${allNodes.length}`);

        return allNodes.map((node: any) => ({
            id: node.id,
            nombre: node.nombre || node.Nombre || "Sin Nombre",
            latitud: Number(node.latitud ?? node.Latitud ?? 0),
            longitud: Number(node.longitud ?? node.Longitud ?? 0),
            tipo: node.tipo || node.Tipo || "Desconocido"
        }));
    } catch (e) {
        console.error('Unexpected error fetching nodes:', e);
        return generateMockNodes();
    }
}

function generateMockNodes(): NetworkNode[] {
    return [
        { id: 101, nombre: "Manga-Test-01", latitud: 10.467, longitud: -66.905, tipo: "Manga 96" },
        { id: 102, nombre: "NAP-Test-01", latitud: 10.468, longitud: -66.904, tipo: "Manga 48" },
        { id: 103, nombre: "NAP-Test-02", latitud: 10.466, longitud: -66.906, tipo: "Manga 48" },
        { id: 104, nombre: "Manga-Test-02", latitud: 10.469, longitud: -66.903, tipo: "Manga 96" },
        { id: 105, nombre: "NAP-Test-03", latitud: 10.465, longitud: -66.907, tipo: "Manga 48" },
        { id: 106, nombre: "Empalme-Test-03", latitud: 10.470, longitud: -66.902, tipo: "Empalme" },
    ];
}
