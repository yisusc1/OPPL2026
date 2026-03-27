"use client"

import { useState } from "react"
import { ArrowUpRight, ArrowDownRight, History } from "lucide-react"
import { AssignmentDetailsDialog } from "@/components/almacen/assignment-details-dialog"

interface Transaction {
    id: string
    type: 'IN' | 'OUT' | 'ADJUST'
    quantity: number
    reason: string
    created_at: string
    inventory_products: {
        name: string
    } | null
    received_by?: string
    receiver_id?: string
}

interface RecentTransactionsProps {
    transactions: Transaction[]
}

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
    const [viewCode, setViewCode] = useState<string | null>(null)

    return (
        <>
            <div className="space-y-4">
                {transactions.length > 0 ? (
                    transactions.map((tx) => (
                        <div
                            key={tx.id}
                            className="flex items-center justify-between p-3 hover:bg-zinc-50 rounded-xl transition-colors border border-transparent hover:border-zinc-100 cursor-pointer"
                            onClick={() => {
                                const match = tx.reason?.match(/(DES|CMB)-[A-Za-z0-9]+/)
                                if (match) {
                                    setViewCode(match[0])
                                }
                            }}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${tx.type === 'IN' ? 'bg-green-100 text-green-700' : tx.type === 'OUT' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                    {tx.type === 'IN' ? <ArrowDownRight size={18} /> : tx.type === 'OUT' ? <ArrowUpRight size={18} /> : <History size={18} />}
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-medium text-zinc-900">
                                        {tx.inventory_products?.name || "Producto desconocido"}
                                    </span>
                                    <span className="text-xs text-zinc-500">
                                        {new Date(tx.created_at).toLocaleDateString()} • {tx.reason || "Sin motivo"}
                                    </span>
                                    {tx.received_by && (
                                        <div className="flex items-center gap-1 mt-1">
                                            <span className="text-[10px] bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded border border-orange-100 font-medium">
                                                Recibido por: {tx.received_by}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className={`font-bold ${tx.type === 'IN' ? 'text-green-700' : tx.type === 'OUT' ? 'text-red-700' : 'text-blue-700'}`}>
                                {tx.type === 'IN' ? '+' : '-'}{tx.quantity}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-8 text-zinc-500 italic">
                        No hay movimientos registrados.
                    </div>
                )}
            </div>

            <AssignmentDetailsDialog
                code={viewCode}
                open={!!viewCode}
                onOpenChange={(open) => !open && setViewCode(null)}
            />
        </>
    )
}
