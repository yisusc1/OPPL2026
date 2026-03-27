import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface SpoolHistoryDialogProps {
    isOpen: boolean
    onClose: () => void
    history: any[]
}

export function SpoolHistoryDialog({ isOpen, onClose, history }: SpoolHistoryDialogProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Historial de Bobinas Finalizadas</DialogTitle>
                    <DialogDescription>
                        Registro detallado del consumo de bobinas cerradas.
                    </DialogDescription>
                </DialogHeader>

                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha Cierre</TableHead>
                                <TableHead>Serial</TableHead>
                                <TableHead>Equipo</TableHead>
                                <TableHead className="text-right">Inicial (m)</TableHead>
                                <TableHead className="text-right">Usado (m)</TableHead>
                                <TableHead className="text-right">Desecho (m)</TableHead>
                                <TableHead className="text-right">Restante (m)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {history.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                        No hay historial disponible.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                history.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell>
                                            {item.closed_at ? format(new Date(item.closed_at), "dd/MM/yyyy", { locale: es }) : "-"}
                                        </TableCell>
                                        <TableCell className="font-mono font-medium">{item.serial}</TableCell>
                                        <TableCell>{item.team}</TableCell>
                                        <TableCell className="text-right text-slate-500">{item.initial}</TableCell>
                                        <TableCell className="text-right font-bold text-blue-600">{item.used}</TableCell>
                                        <TableCell className="text-right text-red-500">{item.wasted}</TableCell>
                                        <TableCell className="text-right font-bold text-green-600">{item.remaining}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </DialogContent>
        </Dialog>
    )
}
