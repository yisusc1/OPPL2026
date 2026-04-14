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
                            className="flex items-center justify-between p-3 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 rounded-xl transition-colors border border-transparent hover:border-zinc-100 dark:hover:border-zinc-800 cursor-pointer"
                            onClick={() => {
                                const match = tx.reason?.match(/(DES|CMB)-[A-Za-z0-9]+/)
                                if (match) {
                                    setViewCode(match[0])
                                }
                            }}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${tx.type === 'IN' ? 'bg-green-100 dark:bg-emerald-900/40 text-green-700 dark:text-emerald-400' : tx.type === 'OUT' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400' : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400'}`}>
                                    {tx.type === 'IN' ? <ArrowDownRight size={18} /> : tx.type === 'OUT' ? <ArrowUpRight size={18} /> : <History size={18} />}
                                </div>
                                <div className="flex flex-col justify-center h-full pt-1">
                                    <span className="font-bold text-sm tracking-tight text-foreground leading-none mb-[2px]">
                                        {tx.inventory_products?.name || "Producto desconocido"}
                                    </span>
                                    <span className="text-[11px] text-muted-foreground leading-tight">
                                        {new Date(tx.created_at).toLocaleDateString()} • {tx.reason || "Sin motivo"}
                                    </span>
                                    {tx.received_by && (
                                        <div className="flex items-center gap-1 mt-1.5">
                                            <span className="text-[10px] bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 px-1.5 py-[2px] rounded border border-orange-100 dark:border-orange-900/50 font-medium leading-none">
                                                Tercero: {tx.received_by}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className={`font-bold ${tx.type === 'IN' ? 'text-green-700 dark:text-emerald-400' : tx.type === 'OUT' ? 'text-red-700 dark:text-red-400' : 'text-blue-700 dark:text-blue-400'}`}>
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
