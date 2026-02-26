"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { getAuditHistory } from "../../actions"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Calendar, FileText, ChevronRight, User, AlertCircle, Loader2 } from "lucide-react"
import { PremiumPageLayout } from "@/components/ui/premium-page-layout"
import { PremiumCard } from "@/components/ui/premium-card"
import { PremiumContent } from "@/components/ui/premium-content"

export default function AuditHistoryPage() {
    const params = useParams()
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [audits, setAudits] = useState<any[]>([])

    useEffect(() => {
        async function load() {
            try {
                const res = await getAuditHistory(params.id as string)
                setAudits(res)
            } catch (e) {
                console.error(e)
            } finally {
                setLoading(false)
            }
        }
        if (params.id) load()
    }, [params.id])

    return (
        <PremiumPageLayout title="Historial de Auditorías" description="Registro histórico de auditorías realizadas.">
            <div className="space-y-8">
                <PremiumContent className="p-4 md:p-6">
                    <Button onClick={() => router.push("/control")} variant="ghost" className="pl-0 hover:bg-transparent hover:text-primary">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Volver al Tablero
                    </Button>
                </PremiumContent>

                <div className="space-y-4 max-w-4xl mx-auto">
                    {loading ? (
                        <div className="flex justify-center py-20">
                            <Loader2 className="animate-spin text-primary" size={40} />
                        </div>
                    ) : audits.length === 0 ? (
                        <div className="text-center py-20 bg-muted/5 rounded-3xl border-2 border-dashed border-muted">
                            <FileText className="mx-auto h-16 w-16 text-muted-foreground opacity-20 mb-4" />
                            <h3 className="text-foreground font-medium text-lg">Sin historial</h3>
                            <p className="text-muted-foreground text-sm mt-1">No se han realizado auditorías a esta entidad.</p>
                        </div>
                    ) : (
                        audits.map((audit) => (
                            <PremiumCard
                                key={audit.id}
                                onClick={() => router.push(`/control/history/view/${audit.id}`)}
                                className="group p-6 flex items-center justify-between cursor-pointer hover:border-blue-500/30 transition-all rounded-2xl"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${audit.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                        {audit.status === 'COMPLETED' ? <FileText size={24} /> : <AlertCircle size={24} />}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-foreground text-sm font-mono">Ref: {audit.id.slice(0, 8)}</h3>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${audit.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                                                {audit.status === 'COMPLETED' ? 'FINALIZADO' : 'PENDIENTE'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 mt-1">
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <Calendar size={12} />
                                                <span className="capitalize">
                                                    {new Date(audit.created_at).toLocaleDateString('es-VE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            {audit.notes && (
                                                <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded line-clamp-1 max-w-[200px]">
                                                    {audit.notes}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <ChevronRight className="text-muted-foreground group-hover:text-primary transition-colors" />
                            </PremiumCard>
                        ))
                    )}
                </div>
            </div>
        </PremiumPageLayout>
    )
}
