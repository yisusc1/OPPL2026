"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function OperationsCharts({ data }: { data: any[] }) {
    return (
        <Card className="rounded-[32px] border-none shadow-sm h-full">
            <CardHeader>
                <CardTitle>Rendimiento Semanal</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={data}
                            margin={{
                                top: 5,
                                right: 30,
                                left: 20,
                                bottom: 5,
                            }}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E4E7" />
                            <XAxis
                                dataKey="date"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#71717A', fontSize: 12 }}
                                dy={10}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#71717A', fontSize: 12 }}
                            />
                            <Tooltip
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                cursor={{ fill: '#F4F4F5' }}
                            />
                            <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                            <Bar
                                dataKey="Instalaciones"
                                fill="#18181B"
                                radius={[4, 4, 0, 0]}
                                barSize={40}
                            />
                            <Bar
                                dataKey="Soportes"
                                fill="#A1A1AA"
                                radius={[4, 4, 0, 0]}
                                barSize={40}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    )
}

export function VehicleStatusChart({ stats }: { stats: any }) {
    const data = [
        { name: 'Operativos', value: stats.operational, fill: '#22C55E' }, // Green
        { name: 'En Taller', value: stats.maintenance, fill: '#F59E0B' }, // Amber
        { name: 'Críticos (Fallas)', value: stats.critical, fill: '#EF4444' }, // Red
    ]

    return (
        <Card className="rounded-[32px] border-none shadow-sm h-full">
            <CardHeader>
                <CardTitle>Estado de Flota</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col gap-4">
                    {data.map((item) => (
                        <div key={item.name} className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50">
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.fill }}></div>
                                <span className="font-medium text-zinc-700">{item.name}</span>
                            </div>
                            <span className="font-bold text-lg text-zinc-900">{item.value}</span>
                        </div>
                    ))}

                    <div className="mt-4 p-4 bg-blue-50 rounded-2xl text-blue-700 text-sm">
                        Total Vehículos: <strong>{stats.total}</strong>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
