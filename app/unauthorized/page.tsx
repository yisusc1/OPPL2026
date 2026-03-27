import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ShieldAlert } from "lucide-react"

export default function UnauthorizedPage() {
    return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-zinc-50 gap-6">
            <div className="bg-red-50 p-6 rounded-full">
                <ShieldAlert size={64} className="text-red-500" />
            </div>
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold text-zinc-900">Acceso Denegado</h1>
                <p className="text-zinc-500 max-w-md">No tienes permisos suficientes para acceder a esta sección. Si crees que es un error, contacta al administrador.</p>
            </div>
            <Link href="/">
                <Button variant="outline" className="min-w-[150px]">
                    Volver al Inicio
                </Button>
            </Link>
        </div>
    )
}
