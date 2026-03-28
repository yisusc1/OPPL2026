"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { FileText, QrCode, LogOut, Fuel, MapPin, AlertTriangle, CheckCircle, Car, ArrowRight } from "lucide-react"
import Image from "next/image"
import QRCode from "react-qr-code"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function ChoferPage() {
    const [profile, setProfile] = useState<any>(null)
    const [vehicle, setVehicle] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [qrOpen, setQrOpen] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            router.push('/login')
            return
        }

        // Fetch Profile
        const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()

        setProfile(profileData)

        // Fetch Assigned Vehicle
        // We look for a vehicle where assigned_driver_id matches
        const { data: vehicleData } = await supabase
            .from('vehiculos')
            .select('*')
            .eq('assigned_driver_id', user.id)
            .single()

        if (vehicleData) {
            setVehicle(vehicleData)
        }

        setLoading(false)
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-zinc-50 text-zinc-400">Cargando panel...</div>
    }

    const qrData = JSON.stringify({
        type: 'FUEL_AUTH',
        driverId: profile?.id,
        vehicleId: vehicle?.id,
        placa: vehicle?.placa,
        driverName: `${profile?.first_name} ${profile?.last_name}`
    })

    return (
        <div className="min-h-screen bg-[#F2F2F7] flex flex-col font-sans mb-10">
            {/* iOS Header */}
            <div className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-200 pt-12 pb-4 px-6 flex justify-between items-center transition-all duration-300">
                <div>
                    <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Panel de Control</h2>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Hola, {profile?.first_name || 'Conductor'}</h1>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleLogout}
                    className="rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-red-600 transition-colors"
                >
                    <LogOut size={20} />
                </Button>
            </div>

            {/* Main Content Scrollable */}
            <div className="flex-1 p-6 space-y-6">

                {vehicle ? (
                    <>
                        {/* Vehicle Card - iOS Widget Style */}
                        <div className="bg-white rounded-[2rem] shadow-sm p-6 relative overflow-hidden">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`h-2.5 w-2.5 rounded-full ${vehicle.falla_activa ? "bg-red-500 animate-pulse" : "bg-green-500"}`}></span>
                                        <span className={`text-xs font-bold uppercase tracking-wider ${vehicle.falla_activa ? "text-red-500" : "text-green-600"}`}>
                                            {vehicle.falla_activa ? "Mantenimiento" : "Operativo"}
                                        </span>
                                    </div>
                                    <h2 className="text-3xl font-bold text-gray-900 leading-tight">{vehicle.modelo}</h2>
                                    <p className="text-gray-400 font-mono text-lg">{vehicle.placa}</p>
                                </div>
                                <div className="h-12 w-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                                    <Car size={24} />
                                </div>
                            </div>

                            {/* Stats Flex */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-50 rounded-2xl p-4">
                                    <div className="flex items-center gap-2 mb-1 text-gray-400">
                                        <Fuel size={14} />
                                        <span className="text-xs font-bold uppercase">Combustible</span>
                                    </div>
                                    <span className="text-xl font-bold text-gray-900">{vehicle.current_fuel_level || 0}%</span>
                                </div>
                                <div className="bg-gray-50 rounded-2xl p-4">
                                    <div className="flex items-center gap-2 mb-1 text-gray-400">
                                        <MapPin size={14} />
                                        <span className="text-xs font-bold uppercase">Km</span>
                                    </div>
                                    <span className="text-xl font-bold text-gray-900">{(vehicle.kilometraje || 0).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        {/* Primary Action: QR Code */}
                        <Dialog open={qrOpen} onOpenChange={setQrOpen}>
                            <DialogTrigger asChild>
                                <Button className="w-full h-24 rounded-[2rem] bg-black text-white hover:bg-gray-800 shadow-xl shadow-gray-200 transition-all active:scale-95 flex flex-col items-center justify-center gap-2">
                                    <QrCode size={32} />
                                    <span className="text-base font-semibold">Mi Código QR</span>
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md bg-white/95 backdrop-blur-xl border-none shadow-2xl rounded-[2.5rem] p-8 flex flex-col items-center">
                                <div className="bg-gray-100 h-1.5 w-12 rounded-full mb-6"></div>
                                <DialogTitle className="text-center text-2xl font-bold mb-2">Código de Carga</DialogTitle>
                                <DialogDescription className="text-center text-gray-400 mb-8 max-w-[200px]">
                                    Muestra este código al supervisor para autorizar combustible.
                                </DialogDescription>

                                <div className="p-6 bg-white border border-gray-100 shadow-lg rounded-[2rem] mb-6 w-full max-w-[280px]">
                                    <div style={{ height: "auto", margin: "0 auto", width: "100%" }}>
                                        <QRCode
                                            size={256}
                                            style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                            value={qrData}
                                            viewBox={`0 0 256 256`}
                                        />
                                    </div>
                                </div>
                                <p className="font-mono text-sm font-bold text-gray-900 tracking-widest">{vehicle.placa}</p>
                            </DialogContent>
                        </Dialog>

                        {/* Secondary Actions Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <Link href={`/transporte?action=salida&vehicle_id=${vehicle.id}`} className="w-full block">
                                <Button className="w-full h-32 rounded-[2rem] bg-white text-gray-900 hover:bg-gray-50 border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-3 active:scale-95 transition-all">
                                    <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                                        <FileText size={20} />
                                    </div>
                                    <span className="font-bold text-sm">Registrar Salida</span>
                                </Button>
                            </Link>

                            <Link href={`/transporte?action=entrada&vehicle_id=${vehicle.id}`} className="w-full block">
                                <Button className="w-full h-32 rounded-[2rem] bg-white text-gray-900 hover:bg-gray-50 border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-3 active:scale-95 transition-all">
                                    <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                                        <LogOut size={20} className="scale-x-[-1]" />
                                    </div>
                                    <span className="font-bold text-sm">Registrar Entrada</span>
                                </Button>
                            </Link>
                        </div>

                        {/* NEW FEATURE: Report Issue */}
                        <Link href="/chofer/reportar" className="block mt-2">
                            <Button variant="ghost" className="w-full h-16 rounded-[1.5rem] bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-between px-6 active:scale-95 transition-all">
                                <div className="flex items-center gap-3">
                                    <AlertTriangle size={20} />
                                    <span className="font-bold">Reportar Falla Mecánica</span>
                                </div>
                                <ArrowRight size={18} className="opacity-50" />
                            </Button>
                        </Link>

                    </>
                ) : (
                    <div className="bg-white rounded-[2rem] p-10 flex flex-col items-center justify-center text-center shadow-sm min-h-[50vh]">
                        <div className="h-24 w-24 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mb-6">
                            <Car size={40} />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2">Sin Vehículo Asignado</h2>
                        <p className="text-gray-500 max-w-[200px]">Contacta a supervisión para que te asignen una unidad.</p>
                    </div>
                )}
            </div>
            {/* iOS Bottom SafeArea Spacer if needed, usually handled by mb-10 */}
        </div>
    )
}
