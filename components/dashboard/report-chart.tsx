import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from "recharts";
import { cn } from "@/lib/utils";
import { GlowingEffect } from "@/components/ui/glowing-effect";

import { LucideIcon } from "lucide-react";

interface ReportChartProps {
    title: string;
    data: any[];
    type?: "bar" | "pie" | "horizontal-bar" | "area" | "donut";
    xAxisAngle?: number;
    className?: string;
    action?: React.ReactNode;
    icon?: LucideIcon;
}

export function ReportChart({ title, data, type = "bar", xAxisAngle = -45, className, action, icon: Icon }: ReportChartProps) {
    return (
        <div className={cn("relative h-full rounded-[1.25rem] border-[0.75px] border-border p-1", className)}>
            <GlowingEffect
                spread={40}
                glow={true}
                disabled={false}
                proximity={64}
                inactiveZone={0.01}
                borderWidth={3}
            />
            <div className="relative flex h-full flex-col overflow-hidden rounded-xl border-[0.75px] bg-background/40 backdrop-blur-md shadow-sm dark:shadow-[0px_0px_27px_0px_rgba(45,45,45,0.3)] hover:bg-background/60 transition-colors">

                {/* Header */}
                <div className="px-4 py-3 flex justify-between items-center z-10">
                    <div className="flex items-center gap-2">
                        {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
                        <h3 className="text-[11px] font-bold font-sans tracking-tight text-foreground uppercase">{title}</h3>
                        <span className="w-2 h-2 rounded-full bg-[#EAB308] shadow-[0_0_8px_rgba(234,179,8,0.8)] animate-pulse ml-1"></span>
                    </div>
                    {action}
                </div>

                {/* Content */}
                <div className="flex-1 p-2 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        {type === "pie" || type === "donut" ? (
                            <PieChart>
                                <Pie
                                    data={data}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={type === "donut" ? 50 : 0}
                                    outerRadius={80}
                                    paddingAngle={0}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {data.map((entry, index) => {
                                        // Palette: Yellow (Primary), Gray-300, Zinc-400, Zinc-600, Zinc-800
                                        const COLORS = ["#EAB308", "#D4D4D8", "#A1A1AA", "#52525B", "#27272A"];
                                        return <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />;
                                    })}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ fontSize: '12px', backgroundColor: 'var(--popover)', border: '1px solid var(--border)', color: 'var(--popover-foreground)', borderRadius: '8px' }}
                                    itemStyle={{ color: 'var(--foreground)' }}
                                    formatter={(value: number, name: string, props: any) => [value, props.payload.name]}
                                />
                                <Legend
                                    layout="vertical"
                                    verticalAlign="middle"
                                    align="right"
                                    iconType="circle"
                                    iconSize={12}
                                    formatter={(value) => <span className="text-xs font-bold text-foreground ml-1">{value}</span>}
                                    wrapperStyle={{ right: 0 }}
                                />
                            </PieChart>
                        ) : type === "horizontal-bar" ? (
                            <BarChart layout="vertical" data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                                <XAxis type="number" hide />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    width={120}
                                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                                    axisLine={false}
                                    tickLine={false}
                                    interval={0}
                                />
                                <Tooltip
                                    cursor={{ fill: 'var(--muted)', opacity: 0.2 }}
                                    contentStyle={{ fontSize: '12px', backgroundColor: 'var(--popover)', border: '1px solid var(--border)', color: 'var(--popover-foreground)', borderRadius: '8px' }}
                                    itemStyle={{ color: 'var(--foreground)' }}
                                    formatter={(value: number) => [value, "Cantidad"]}
                                />
                                <Bar dataKey="value" barSize={16} radius={[0, 4, 4, 0]}>
                                    {data.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index === 0 ? "#EAB308" : "var(--muted-foreground)"} />
                                    ))}
                                </Bar>
                            </BarChart>
                        ) : type === "area" ? (
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
                                    angle={xAxisAngle}
                                    textAnchor={xAxisAngle !== 0 ? "end" : "middle"}
                                    height={60}
                                />
                                <Tooltip
                                    cursor={{ stroke: '#EAB308', strokeWidth: 1 }}
                                    contentStyle={{ fontSize: '12px', backgroundColor: 'var(--popover)', border: '1px solid var(--border)', color: 'var(--popover-foreground)', borderRadius: '8px' }}
                                    itemStyle={{ color: 'var(--foreground)' }}
                                    formatter={(value: number) => [value, "Cantidad"]}
                                />
                                <Area type="monotone" dataKey="value" stroke="#EAB308" fillOpacity={1} fill="url(#colorYellow)" strokeWidth={3} />
                            </AreaChart>
                        ) : (
                            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <XAxis
                                    dataKey="name"
                                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                                    axisLine={{ stroke: 'var(--border)' }}
                                    tickLine={false}
                                    interval={0}
                                    angle={xAxisAngle}
                                    textAnchor={xAxisAngle !== 0 ? "end" : "middle"}
                                    height={60}
                                />
                                <Tooltip
                                    cursor={{ fill: 'var(--muted)', opacity: 0.2 }}
                                    contentStyle={{ fontSize: '12px', backgroundColor: 'var(--popover)', border: '1px solid var(--border)', color: 'var(--popover-foreground)', borderRadius: '8px' }}
                                    itemStyle={{ color: 'var(--foreground)' }}
                                    formatter={(value: number) => [value, "Cantidad"]}
                                />
                                <Bar dataKey="value" barSize={30} radius={[4, 4, 0, 0]}>
                                    {data.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index === 0 ? "#EAB308" : "var(--muted-foreground)"} />
                                    ))}
                                </Bar>
                            </BarChart>
                        )}
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
