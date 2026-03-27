"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, ArrowLeft, Database, FileWarning, Fuel, Loader2, PackageX, Trash2, Factory, PackagePlus, Stethoscope, CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { resetFuelLogsAction, resetInventoryAction, resetOperationsAction } from "./actions"
import { seedProductsAction } from "./seed/actions"
import { runIntegrityCheck, type IntegrityIssue } from "./integrity/actions"
import { useRouter } from "next/navigation"

export default function DatabaseManagementPage() {
    const [inventoryLoading, setInventoryLoading] = useState(false)
    const [opsLoading, setOpsLoading] = useState(false)
    const [fuelLoading, setFuelLoading] = useState(false)

    // New States
    const [seederLoading, setSeederLoading] = useState(false)
    const [integrityLoading, setIntegrityLoading] = useState(false)
    const [integrityIssues, setIntegrityIssues] = useState<IntegrityIssue[]>([])


    const router = useRouter()

    const handleResetInventory = async () => {
        if (!confirm("⚠️ ¿ESTÁS SEGURO?\n\nEsto borrará:\n- Todo el historial de movimientos.\n- Todas las asignaciones.\n- Pondrá el stock a 0.\n\nNO borrará productos ni clientes.")) return

        setInventoryLoading(true)
        try {
            const result = await resetInventoryAction()
            if (result.success) {
                toast.success("Inventario vaciado correctamente")
                router.refresh()
            } else {
                toast.error("Error: " + result.error)
            }
        } catch (error) {
            toast.error("Error de conexión")
        } finally {
            setInventoryLoading(false)
        }
    }

    const handleResetOps = async () => {
        if (!confirm("⚠️ ¿ESTÁS SEGURO?\n\nEsto borrará:\n- Todos los reportes/cierres.\n- Todos los clientes.\n- Asignaciones de técnicos.\n\nNO borrará inventario ni vehículos.")) return

        setOpsLoading(true)
        try {
            const result = await resetOperationsAction()
            if (result.success) {
                toast.success("Operaciones reiniciadas correctamente")
                router.refresh()
            } else {
                toast.error("Error: " + result.error)
            }
        } catch (error) {
            toast.error("Error de conexión")
        } finally {
            setOpsLoading(false)
        }
    }

    const handleResetFuel = async () => {
        if (!confirm("⚠️ ¿ESTÁS SEGURO?\n\nEsto borrará:\n- Todo el historial de carga de combustible.\n\nNO borrará los vehículos.")) return

        setFuelLoading(true)
        try {
            const result = await resetFuelLogsAction()
            if (result.success) {
                toast.success("Logs de combustible eliminados")
                router.refresh()
            } else {
                toast.error("Error: " + result.error)
            }
        } catch (error) {
            toast.error("Error de conexión")
        } finally {
            setFuelLoading(false)
        }
    }

    const handleSeedProducts = async (count: number) => {
        setSeederLoading(true)
        try {
            const result = await seedProductsAction(count)
            if (result.success) {
                toast.success(result.message)
                router.refresh()
            } else {
                toast.error("Error: " + result.error)
            }
        } catch (error) {
            toast.error("Error de conexión")
        } finally {
            setSeederLoading(false)
        }
    }

    const handleIntegrityCheck = async () => {
        setIntegrityLoading(true)
        setIntegrityIssues([])
        try {
            const issues = await runIntegrityCheck()
            setIntegrityIssues(issues)
            if (issues.length === 0) {
                toast.success("Base de Datos Saludable")
            } else {
                toast.warning(`Se detectaron ${issues.length} problemas`)
            }
        } catch (error) {
            toast.error("Error al ejecutar diagnóstico")
        } finally {
            setIntegrityLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-slate-50/50 p-6 md:p-10">
            <div className="max-w-4xl mx-auto mb-10">
                <div className="flex items-center gap-2 mb-2">
                    <Link href="/admin" className="p-2 -ml-2 rounded-full hover:bg-slate-200/50 transition-colors text-slate-500">
                        <ArrowLeft size={24} />
                    </Link>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Gestión de Base de Datos</h1>
                </div>
                <p className="text-slate-500">Herramientas de limpieza y reinicio para pruebas (Testing).</p>
            </div>

            {/* RESET ACTIONS */}
            <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* 1. INVENTORY */}
                <Card className="border-red-200 bg-red-50/30">
                    <CardHeader>
                        <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center text-red-600 mb-4">
                            <PackageX size={24} />
                        </div>
                        <CardTitle className="text-xl text-red-700">Vaciar Inventario</CardTitle>
                        <CardDescription>Reinicia el stock a 0 y borra movimientos.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="text-sm text-red-800 bg-red-100/50 p-3 rounded-lg border border-red-100">
                            <strong>Conserva:</strong> Productos, Clientes, Vehículos.
                        </div>
                        <Button
                            variant="destructive"
                            className="w-full font-bold"
                            onClick={handleResetInventory}
                            disabled={inventoryLoading}
                        >
                            {inventoryLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                            Vaciar Almacén
                        </Button>
                    </CardContent>
                </Card>

                {/* 2. OPERATIONS */}
                <Card className="border-orange-200 bg-orange-50/30">
                    <CardHeader>
                        <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600 mb-4">
                            <FileWarning size={24} />
                        </div>
                        <CardTitle className="text-xl text-orange-700">Reiniciar Operaciones</CardTitle>
                        <CardDescription>Borra clientes, reportes y asignaciones.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="text-sm text-orange-800 bg-orange-100/50 p-3 rounded-lg border border-orange-100">
                            <strong>Conserva:</strong> Stock, Vehículos, Productos.
                        </div>
                        <Button
                            className="w-full font-bold bg-orange-600 hover:bg-orange-700 text-white"
                            onClick={handleResetOps}
                            disabled={opsLoading}
                        >
                            {opsLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                            Borrar Reportes
                        </Button>
                    </CardContent>
                </Card>

                {/* 3. FUEL */}
                <Card className="border-blue-200 bg-blue-50/30">
                    <CardHeader>
                        <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 mb-4">
                            <Fuel size={24} />
                        </div>
                        <CardTitle className="text-xl text-blue-700">Reiniciar Combustible</CardTitle>
                        <CardDescription>Borra el historial de carga de combustible.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="text-sm text-blue-800 bg-blue-100/50 p-3 rounded-lg border border-blue-100">
                            <strong>Conserva:</strong> Vehículos, Conductores.
                        </div>
                        <Button
                            className="w-full font-bold bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={handleResetFuel}
                            disabled={fuelLoading}
                        >
                            {fuelLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                            Borrar Logs Fuel
                        </Button>
                    </CardContent>
                </Card>

            </div>

            {/* SEEDER & INTEGRITY SECTION */}
            <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">

                {/* 4. SEEDER */}
                <Card className="border-emerald-200 bg-emerald-50/30">
                    <CardHeader>
                        <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 mb-4">
                            <Factory size={24} />
                        </div>
                        <CardTitle className="text-xl text-emerald-700">Fábrica de Datos</CardTitle>
                        <CardDescription>Genera datos de prueba automáticamente.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Button
                            variant="outline"
                            className="w-full justify-start text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            onClick={() => handleSeedProducts(50)}
                            disabled={seederLoading}
                        >
                            {seederLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackagePlus className="mr-2 h-4 w-4" />}
                            Generar 50 Productos
                        </Button>
                        <p className="text-xs text-emerald-800">Crea productos aleatorios con stock positivo.</p>
                    </CardContent>
                </Card>

                {/* 5. INTEGRITY */}
                <Card className="border-zinc-200 bg-white">
                    <CardHeader>
                        <div className="w-12 h-12 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-600 mb-4">
                            <Stethoscope size={24} />
                        </div>
                        <CardTitle className="text-xl text-zinc-900">Verificador de Salud</CardTitle>
                        <CardDescription>Detecta inconsistencias en la base de datos.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Button
                            variant="outline"
                            className="w-full text-zinc-700 hover:bg-zinc-50"
                            onClick={handleIntegrityCheck}
                            disabled={integrityLoading}
                        >
                            {integrityLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                            Escanear Base de Datos
                        </Button>

                        {integrityIssues.length > 0 && (
                            <div className="space-y-2 mt-4 max-h-40 overflow-y-auto">
                                {integrityIssues.map((issue, idx) => (
                                    <div key={idx} className={`p-2 rounded text-xs border ${issue.type === 'CRITICAL' ? 'bg-red-50 border-red-100 text-red-700' : 'bg-yellow-50 border-yellow-100 text-yellow-700'}`}>
                                        <strong>{issue.title}:</strong> {issue.description}
                                    </div>
                                ))}
                            </div>
                        )}
                        {integrityIssues.length === 0 && !integrityLoading && (
                            <div className="text-xs text-center text-zinc-400 italic mt-2">
                                Sistema estable. No se detectaron problemas.
                            </div>
                        )}
                    </CardContent>
                </Card>

            </div>
        </div>
    )
}
