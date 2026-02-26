"use client";

import { FileText, Monitor, TrendingUp, User, Wifi, Users, Calendar, Headset, Map as MapIcon, MapPinned, CreditCard, Target, Activity, GripVertical } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    rectSortingStrategy
} from "@dnd-kit/sortable";

import {
    fetchInstallations,
    generateMockData,
    calculateAdvancedMetrics,
    Installation
} from "@/lib/dashboard-data";
import { KPICard } from "@/components/dashboard/kpi-card";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { ReportChart } from "@/components/dashboard/report-chart";
import { SlicerPanel } from "@/components/dashboard/slicer-panel";
import { Switch } from "@/components/ui/switch";
import { BackgroundPaths } from "@/components/ui/background-paths";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { SortableCard } from "@/components/dashboard/sortable-card";

export default function DashboardPage() {
    const [rawData, setRawData] = useState<Installation[]>([]);
    const [loading, setLoading] = useState(true);

    // Drag and Drop State
    const [items, setItems] = useState([
        'compliance',
        'advisor',
        'technician',
        'zone',
        'sector',
        'status',
        'service',
        'plan',
        'daily',
        'monthly'
    ]);

    const STORAGE_KEY = 'dashboard-order-v1';

    // Load order from storage
    useEffect(() => {
        const savedOrder = localStorage.getItem(STORAGE_KEY);
        if (savedOrder) {
            try {
                const parsed = JSON.parse(savedOrder);
                // Basic validation to ensure we have valid items
                if (Array.isArray(parsed) && parsed.length > 0) {
                    // Merge with any new items that might have been added since save
                    const currentSet = new Set(parsed);
                    const missingItems = items.filter(i => !currentSet.has(i));
                    setItems([...parsed, ...missingItems]);
                }
            } catch (e) {
                console.error("Failed to parse saved layout", e);
            }
        }
    }, []);

    // Save order to storage
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }, [items]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setItems((items) => {
                const oldIndex = items.indexOf(active.id as string);
                const newIndex = items.indexOf(over.id as string);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    }

    // View Toggle State (Individual)
    const [viewModes, setViewModes] = useState<Record<string, 'list' | 'chart'>>({});

    const toggleView = (key: string) => {
        setViewModes(prev => ({
            ...prev,
            [key]: prev[key] === 'chart' ? 'list' : 'chart'
        }));
    };

    const getView = (key: string) => viewModes[key] || 'list';

    // Filter State
    const [filters, setFilters] = useState({
        advisors: [] as string[],
        zones: [] as string[],
        statuses: [] as string[],
        months: [] as string[],
        sectors: [] as string[],
        technicians: [] as string[]
    });

    useEffect(() => {
        async function loadData() {
            setLoading(true);
            try {
                let data = await fetchInstallations();
                if (data === null) {
                    console.log("Using mock data...");
                }

                if (data && 'raw' in data) {
                    setRawData(data.raw || []);
                } else if (Array.isArray(data)) {
                    setRawData(data);
                } else {
                    setRawData([]);
                }
            } catch (error) {
                console.error("Failed to load data", error);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, []);

    // Filter Logic
    const filteredData = useMemo(() => {
        return rawData.filter(item => {
            const matchAdvisor = filters.advisors.length === 0 || filters.advisors.includes(item.asesor);
            const matchZone = filters.zones.length === 0 || filters.zones.includes(item.zona);
            const matchStatus = filters.statuses.length === 0 || filters.statuses.includes(item.estatus);
            const matchMonth = filters.months.length === 0 || filters.months.includes(item.mes);
            const matchSector = filters.sectors.length === 0 || filters.sectors.includes(item.sector);
            const matchTechnician = filters.technicians.length === 0 ||
                filters.technicians.includes(item.tecnico_1) ||
                filters.technicians.includes(item.tecnico_2 || "");

            return matchAdvisor && matchZone && matchStatus && matchMonth && matchSector && matchTechnician;
        });
    }, [rawData, filters]);

    // Calculate Metrics based on FILTERED data
    const metrics = useMemo(() => calculateAdvancedMetrics(filteredData), [filteredData]);

    // Determine available options from RAW data
    const options = useMemo(() => {
        const unique = (key: keyof Installation) => Array.from(new Set(rawData.map(i => String(i[key] || "")).filter(Boolean)));

        // Custom for technicians (combine 1 & 2)
        const allTechs = new Set<string>();
        rawData.forEach(i => {
            if (i.tecnico_1) allTechs.add(i.tecnico_1);
            if (i.tecnico_2) allTechs.add(i.tecnico_2);
        });

        return {
            advisors: unique('asesor'),
            zones: unique('zona'),
            sectors: unique('sector'),
            statuses: unique('estatus'),
            months: unique('mes'), // Ensure 'months' is available if used
            technicians: Array.from(allTechs).sort()
        };
    }, [rawData]);

    const handleFilterChange = (type: keyof typeof filters, value: string) => {
        setFilters(prev => {
            const current = (prev as any)[type] as string[];
            const exists = current.includes(value);
            return {
                ...prev,
                [type]: exists
                    ? current.filter(i => i !== value)
                    : [...current, value]
            };
        });
    };

    // Card Renderer
    const renderCard = (id: string) => {
        switch (id) {
            case 'compliance':
                return (
                    <div className="relative flex flex-col overflow-hidden rounded-[1.25rem] border-[0.75px] border-border p-1 shadow-sm transition-colors duration-300 hover:border-border/80 min-h-[300px] h-full">
                        <GlowingEffect
                            spread={40}
                            glow={true}
                            disabled={false}
                            proximity={64}
                            inactiveZone={0.01}
                            borderWidth={3}
                        />
                        <div className="flex flex-col flex-1 rounded-xl border-[0.75px] bg-background/80 backdrop-blur-md relative overflow-hidden h-full z-10">
                            <div className="bg-muted/50 px-4 py-2 border-b border-border/50 backdrop-blur-md flex items-center gap-2">
                                <Target className="w-4 h-4 text-muted-foreground" />
                                <h3 className="text-sm font-semibold font-sans tracking-tight text-foreground uppercase">Cumplimiento</h3>
                            </div>
                            <div className="flex-1 flex flex-col items-center justify-center gap-4">
                                <TrendingUp className="w-16 h-16 text-[#EAB308]" />
                                <div className="text-center">
                                    <span className="text-5xl font-bold font-sans text-foreground tracking-tighter">{metrics?.trend?.percentageChange}%</span>
                                    <p className="text-sm text-muted-foreground mt-2 font-sans">vs Mes Anterior</p>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'advisor':
                return getView('advisor') === 'list' ? (
                    <SummaryCard
                        title="Asesor"
                        icon={Headset}
                        data={metrics?.charts?.byAdvisor.slice(0, 12) || []}
                        action={<Switch checked={getView('advisor') === 'chart'} onCheckedChange={() => toggleView('advisor')} />}
                    />
                ) : (
                    <ReportChart
                        title="Asesor"
                        icon={Headset}
                        data={metrics?.charts?.byAdvisor.slice(0, 12) || []}
                        type="horizontal-bar"
                        action={<Switch checked={getView('advisor') === 'chart'} onCheckedChange={() => toggleView('advisor')} />}
                    />
                );
            case 'technician':
                return getView('technician') === 'list' ? (
                    <SummaryCard
                        title="Top 6 Técnicos"
                        icon={Users}
                        data={metrics?.charts?.byTechnician.slice(0, 6) || []}
                        action={<Switch checked={getView('technician') === 'chart'} onCheckedChange={() => toggleView('technician')} />}
                    />
                ) : (
                    <ReportChart
                        title="Top 6 Técnicos"
                        icon={Users}
                        data={metrics?.charts?.byTechnician.slice(0, 6) || []}
                        type="horizontal-bar"
                        action={<Switch checked={getView('technician') === 'chart'} onCheckedChange={() => toggleView('technician')} />}
                    />
                );
            case 'zone':
                return getView('zone') === 'list' ? (
                    <SummaryCard
                        title="Zona"
                        icon={MapIcon}
                        data={metrics?.charts?.byZone || []}
                        action={<Switch checked={getView('zone') === 'chart'} onCheckedChange={() => toggleView('zone')} />}
                    />
                ) : (
                    <ReportChart
                        title="Zona"
                        icon={MapIcon}
                        data={metrics?.charts?.byZone || []}
                        type="bar"
                        action={<Switch checked={getView('zone') === 'chart'} onCheckedChange={() => toggleView('zone')} />}
                    />
                );
            case 'sector':
                return getView('sector') === 'list' ? (
                    <SummaryCard
                        title="Sector"
                        icon={MapPinned}
                        data={metrics?.charts?.bySector.slice(0, 10) || []}
                        action={<Switch checked={getView('sector') === 'chart'} onCheckedChange={() => toggleView('sector')} />}
                    />
                ) : (
                    <ReportChart
                        title="Sector"
                        icon={MapPinned}
                        data={metrics?.charts?.bySector.slice(0, 10) || []}
                        type="bar"
                        action={<Switch checked={getView('sector') === 'chart'} onCheckedChange={() => toggleView('sector')} />}
                    />
                );
            case 'status':
                return getView('status') === 'list' ? (
                    <SummaryCard
                        title="Tipo de Solicitud"
                        icon={FileText}
                        data={metrics?.charts?.byStatus || []}
                        action={<Switch checked={getView('status') === 'chart'} onCheckedChange={() => toggleView('status')} />}
                    />
                ) : (
                    <ReportChart
                        title="Tipo de Solicitud"
                        icon={FileText}
                        data={metrics?.charts?.byStatus || []}
                        type="pie"
                        action={<Switch checked={getView('status') === 'chart'} onCheckedChange={() => toggleView('status')} />}
                    />
                );
            case 'service':
                return getView('service') === 'list' ? (
                    <SummaryCard
                        title="Servicio"
                        icon={Activity}
                        data={metrics?.charts?.byService || []}
                        action={<Switch checked={getView('service') === 'chart'} onCheckedChange={() => toggleView('service')} />}
                    />
                ) : (
                    <ReportChart
                        title="Servicio"
                        icon={Activity}
                        data={metrics?.charts?.byService || []}
                        type="donut"
                        action={<Switch checked={getView('service') === 'chart'} onCheckedChange={() => toggleView('service')} />}
                    />
                );
            case 'plan':
                return getView('plan') === 'list' ? (
                    <SummaryCard
                        title="Plan"
                        icon={CreditCard}
                        data={metrics?.charts?.byPlan || []}
                        action={<Switch checked={getView('plan') === 'chart'} onCheckedChange={() => toggleView('plan')} />}
                    />
                ) : (
                    <ReportChart
                        title="Plan"
                        icon={CreditCard}
                        data={metrics?.charts?.byPlan || []}
                        type="pie"
                        action={<Switch checked={getView('plan') === 'chart'} onCheckedChange={() => toggleView('plan')} />}
                    />
                );
            case 'daily':
                return (
                    <ReportChart
                        title="Instalaciones por Día (Mes Actual)"
                        icon={Calendar}
                        data={metrics?.charts?.byDay || []}
                        type="area"
                        xAxisAngle={-45}
                    />
                );
            case 'monthly':
                return (
                    <ReportChart
                        title="Tendencia Mensual"
                        icon={TrendingUp}
                        data={metrics?.charts?.byMonth || []}
                        type="area"
                        xAxisAngle={0}
                    />
                );
            default:
                return null;
        }
    };

    // Configuration for layout spans
    const cardConfig: Record<string, string> = {
        compliance: "",
        advisor: "col-span-1 h-[300px]",
        technician: "col-span-1 h-[300px]",
        zone: "col-span-1 h-[300px]",
        sector: "col-span-1 h-[300px]",
        status: "col-span-1 h-[300px]",
        service: "col-span-1 h-[300px]",
        plan: "col-span-1 h-[300px]",
        daily: "col-span-1 md:col-span-2 lg:col-span-3 xl:col-span-4 h-[300px]",
        monthly: "col-span-1 md:col-span-2 lg:col-span-3 xl:col-span-4 h-[300px]",
    };

    return (
        <div className="min-h-screen bg-background p-4 font-sans text-foreground flex flex-col gap-4 relative">
            <div className="fixed inset-0 z-0 pointer-events-none">
                <BackgroundPaths />
            </div>

            {/* TOP ROW: KPI CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 relative z-10">
                <KPICard
                    label="Solicitudes"
                    value={metrics?.counters?.totalSolicitudes || 0}
                    icon={FileText}
                />
                <KPICard
                    label="Power Go"
                    value={metrics?.counters?.powerGoCount || 0}
                    icon={Monitor}
                />
                <KPICard
                    label="Max. Ventas"
                    value={metrics?.counters?.maxVentas || 0}
                    icon={TrendingUp}
                />
                <KPICard
                    label="Asesor Top"
                    value={metrics?.counters?.topAsesor?.split(" ")[0] || "N/A"}
                    subValue="Mejor Rendimiento"
                    icon={User}
                    className="col-span-1"
                />
                <KPICard
                    label="Routers"
                    value={metrics?.counters?.routerCount || 0}
                    icon={Wifi}
                />
                <KPICard
                    label="Nuevos"
                    value={metrics?.counters?.nuevosServicios || 0}
                    icon={Users}
                />
                <KPICard
                    label="Días"
                    value={metrics?.counters?.diasLaborados || 0}
                    icon={Calendar}
                />
            </div>

            {/* FILTER BAR */}
            <div className="relative z-20 mb-4">
                <SlicerPanel
                    advisors={options.advisors}
                    zones={options.zones}
                    sectors={options.sectors}
                    statuses={options.statuses}
                    months={options.months || []}
                    technicians={options.technicians}
                    currentFilters={filters}
                    onFilterChange={handleFilterChange}
                />
            </div>

            {/* UNIFIED CONTENT GRID WITH DND */}
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={items}
                    strategy={rectSortingStrategy}
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 relative z-10 h-[calc(100vh-250px)] overflow-y-auto pr-2 pb-4 content-start [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-zinc-700/30 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-zinc-700/50">
                        {items.map((id) => (
                            <SortableCard key={id} id={id} className={cardConfig[id]}>
                                {renderCard(id)}
                            </SortableCard>
                        ))}
                    </div>
                </SortableContext>
            </DndContext>
        </div>
    );
}
