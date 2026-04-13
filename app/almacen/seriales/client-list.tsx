"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { QrCode, Search } from "lucide-react"

export function SerialListClient({ serials }: { serials: any[] }) {
    const [searchTerm, setSearchTerm] = useState("")

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'AVAILABLE': return <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-500 font-bold tracking-wider">DISPONIBLE</Badge>
            case 'ASSIGNED': return <Badge variant="outline" className="border-blue-500/20 bg-blue-500/10 text-blue-500 font-bold tracking-wider">ASIGNADO</Badge>
            case 'SOLD': return <Badge variant="outline" className="border-muted bg-muted text-muted-foreground font-bold tracking-wider">VENDIDO</Badge>
            case 'RETURNED': return <Badge variant="outline" className="border-amber-500/20 bg-amber-500/10 text-amber-500 font-bold tracking-wider">DEVUELTO</Badge>
            default: return <Badge variant="outline" className="border-border bg-muted text-muted-foreground font-bold tracking-wider">{status}</Badge>
        }
    }

    const filteredSerials = serials.filter(s => 
        s.serial_number.toLowerCase().includes(searchTerm.toLowerCase()) || 
        s.product?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.product?.sku?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <>
            <div className="p-4 border-b border-border bg-muted/10">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <Input 
                        placeholder="Buscar por serial, código o producto..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 bg-background/50 border-border/50 focus-visible:ring-emerald-500/20"
                    />
                </div>
            </div>
            
            <div className="divide-y divide-border max-h-[600px] overflow-auto">
                {filteredSerials.length > 0 ? (
                    filteredSerials.map((serial: any) => (
                        <div key={serial.serial_number} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-lg bg-background border border-border text-muted-foreground flex items-center justify-center shrink-0">
                                    <QrCode size={20} />
                                </div>
                                <div>
                                    <p className="font-bold text-foreground font-mono text-lg tracking-wide">{serial.serial_number}</p>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs font-bold text-blue-500">Cód: {serial.product?.sku}</span>
                                        <span className="text-xs text-muted-foreground">•</span>
                                        <span className="text-xs text-muted-foreground">{serial.product?.name}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                {getStatusBadge(serial.status)}
                                <p className="text-[10px] text-muted-foreground/70 mt-1">
                                    Ingreso: {new Date(serial.created_at).toLocaleDateString()}
                                </p>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="py-12 text-center text-muted-foreground">
                        <QrCode size={48} className="mx-auto mb-3 opacity-20" />
                        <p>{searchTerm ? `No se encontraron seriales coincidiendo con "${searchTerm}"` : 'No hay seriales registrados.'}</p>
                    </div>
                )}
            </div>
        </>
    )
}
