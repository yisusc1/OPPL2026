"use client";

import { useState } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Calendar, Maximize2, X, Users, MapPinned, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { DetailedDailyMetric } from "@/lib/dashboard-data";

interface Props {
    data: DetailedDailyMetric[];
}

export function DetailedInstallationsChart({ data }: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [view, setView] = useState<'daily' | 'monthly'>('daily');

    // Meta diaria de instalaciones
    const GOAL_THRESHOLD = 5;

    // Derived Monthly Data for the alternative View
    const monthlyData = data.reduce((acc, curr) => {
        const month = curr.name.split('-')[1]; // e.g. "01" from "02-01"
        // Need a robust way to extract or map month, but 'curr.fullDate' has it like "FEBRERO 02"
        const monthName = curr.fullDate ? curr.fullDate.split(' ')[0] : curr.name;

        const existing = acc.find(item => item.name === monthName);
        if (existing) {
            existing.instalaciones += curr.instalaciones;
            existing.solicitudes += curr.solicitudes;
        } else {
            acc.push({
                ...curr,
                name: monthName,
                fullDate: monthName,
                instalaciones: curr.instalaciones,
                solicitudes: curr.solicitudes
            });
        }
        return acc;
    }, [] as DetailedDailyMetric[]);

    const activeData = view === 'daily' ? data : monthlyData;

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const dayData = payload[0].payload as DetailedDailyMetric;
            return (
                <div className="bg-popover border border-border p-3 rounded-lg shadow-xl !text-foreground min-w-[200px]">
                    <p className="font-bold text-sm mb-2 pb-2 border-b border-border text-center">{dayData.fullDate}</p>
                    <div className="flex flex-col gap-1.5 text-xs">
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground font-medium">Instalaciones:</span>
                            <span className="font-bold text-[#EAB308] text-base">
                                {dayData.instalaciones}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground font-medium">Solicitudes (Volumen):</span>
                            <span className="font-bold text-foreground text-base">{dayData.solicitudes}</span>
                        </div>
                        <div className="mt-2 pt-2 border-t border-border/50">
                            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                                <Users className="w-3 h-3" />
                                <span>Asesor Top:</span>
                            </div>
                            <p className="font-semibold">{dayData.asesor_top}</p>
                        </div>
                        <div className="mt-1">
                            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                                <MapPinned className="w-3 h-3" />
                                <span>Sector:</span>
                            </div>
                            <p className="font-semibold">{dayData.sector_principal}</p>
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };

    const MiniTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const dayData = payload[0].payload as DetailedDailyMetric;
            return (
                <div className="bg-popover border border-border p-2 rounded-md shadow-lg !text-foreground min-w-[120px]">
                    <p className="font-semibold text-xs mb-1 text-muted-foreground">{dayData.fullDate}</p>
                    <div className="flex justify-between items-center text-sm">
                        <span>Instalaciones:</span>
                        <span className="font-bold text-[#EAB308]">
                            {dayData.instalaciones}
                        </span>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <>
            {/* MINI CHART (Dashboard Card) */}
            <div
                className={cn("relative h-full rounded-[1.25rem] border-[0.75px] border-border p-1 cursor-pointer group")}
                onClick={() => setIsOpen(true)}
            >
                <GlowingEffect
                    spread={40}
                    glow={true}
                    disabled={false}
                    proximity={64}
                    inactiveZone={0.01}
                    borderWidth={3}
                />
                <div className="relative flex h-full flex-col overflow-hidden rounded-xl border-[0.75px] bg-background/40 backdrop-blur-md shadow-sm dark:shadow-[0px_0px_27px_0px_rgba(45,45,45,0.3)] group-hover:bg-background/60 transition-colors">
                    <div className="px-4 py-3 flex justify-between items-center z-10 border-b border-border/30">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <h3 className="text-[11px] font-bold font-sans tracking-tight text-foreground uppercase">Instalaciones vs Meta Diaria</h3>
                            <span className="w-2 h-2 rounded-full bg-[#EAB308] shadow-[0_0_8px_rgba(234,179,8,0.8)] animate-pulse ml-1"></span>
                        </div>
                        <Maximize2 className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>

                    <div className="flex-1 p-2 min-h-0 mt-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorYellow" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#EAB308" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#EAB308" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis
                                    dataKey="name"
                                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                                    axisLine={{ stroke: 'var(--border)' }}
                                    tickLine={false}
                                    interval={0}
                                    angle={-45}
                                    textAnchor="end"
                                    height={60}
                                />
                                <Tooltip content={<MiniTooltip />} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} />
                                <Area
                                    type="monotone"
                                    dataKey="instalaciones"
                                    stroke="#EAB308"
                                    fill="url(#colorYellow)"
                                    strokeWidth={3}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* EXPANDED CHART MODAL (TradingView Style) */}
            {isOpen && (
                <div className="fixed inset-0 z-[999] bg-background flex flex-col animate-in fade-in duration-200">
                    {/* Modal Header */}
                    <div className="h-14 border-b border-border/50 bg-background/50 px-6 flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-3">
                            <TrendingUp className="w-5 h-5 text-[#EAB308]" />
                            <h2 className="text-lg font-bold text-foreground">Análisis de Instalaciones vs Solicitudes</h2>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex bg-background border border-border rounded-md p-0.5 shadow-sm">
                                <button
                                    onClick={() => setView('daily')}
                                    className={cn("px-3 py-1 text-xs font-medium rounded-sm transition-colors", view === 'daily' ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}
                                >
                                    Vista Diaria
                                </button>
                                <button
                                    onClick={() => setView('monthly')}
                                    className={cn("px-3 py-1 text-xs font-medium rounded-sm transition-colors", view === 'monthly' ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}
                                >
                                    Vista Mensual
                                </button>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground bg-background border border-border shadow-sm"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Modal Content */}
                    <div className="flex-1 flex flex-col p-4 gap-4 bg-transparent">
                        {/* Upper Chart (Instalaciones) - 70% */}
                        <div className="flex-[7] min-h-0 border border-border/60 rounded-xl p-4 bg-background/60 shadow-sm relative backdrop-blur-md">
                            <h3 className="absolute top-4 left-6 text-[11px] text-muted-foreground font-bold font-sans tracking-tight z-10 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-[#EAB308]"></span>
                                INSTALACIONES (COMPLETADAS)
                            </h3>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={activeData} syncId="tradingViewChart" margin={{ top: 30, right: 30, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="tvMainColor" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#EAB308" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#EAB308" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} vertical={false} />
                                    <XAxis dataKey="name" hide />
                                    <YAxis
                                        tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                                        axisLine={false}
                                        tickLine={false}
                                        orientation="right"
                                    />
                                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--muted-foreground)', strokeWidth: 1, strokeDasharray: '3 3' }} />
                                    <Area
                                        type="monotone"
                                        dataKey="instalaciones"
                                        stroke="#EAB308"
                                        fillOpacity={1}
                                        fill="url(#tvMainColor)"
                                        strokeWidth={2.5}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Lower Chart (Solicitudes) - 30% */}
                        <div className="flex-[3] min-h-0 border border-border/60 rounded-xl p-4 bg-background/60 shadow-sm relative backdrop-blur-md">
                            <h3 className="absolute top-4 left-6 text-[11px] text-muted-foreground font-bold font-sans tracking-tight z-10 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-muted-foreground"></span>
                                VOLUMEN DE SOLICITUDES
                            </h3>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={activeData} syncId="tradingViewChart" margin={{ top: 25, right: 30, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} vertical={false} />
                                    <XAxis
                                        dataKey="name"
                                        tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                                        tickLine={false}
                                        axisLine={{ stroke: 'var(--border)', opacity: 0.5 }}
                                    />
                                    <YAxis
                                        tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                                        axisLine={false}
                                        tickLine={false}
                                        orientation="right"
                                        tickCount={4}
                                    />
                                    <Tooltip
                                        cursor={{ fill: 'var(--muted)', opacity: 0.2 }}
                                        content={<></>} // To avoid duplicating the rich tooltip, but keep the crosshair
                                    />
                                    <Bar dataKey="solicitudes" fill="var(--muted-foreground)" radius={[2, 2, 0, 0]} maxBarSize={30} opacity={0.4} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
