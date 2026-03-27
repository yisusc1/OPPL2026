import { LucideIcon } from "lucide-react"
import { LogoutButton } from "@/components/ui/logout-button"
import { Home as HomeIcon } from "lucide-react"

interface DepartmentPageProps {
    title: string
    description: string
    icon: LucideIcon
    colorClass: string
}

export function DepartmentPageLayout({ title, description, icon: Icon, colorClass }: DepartmentPageProps) {
    return (
        <main className="min-h-screen bg-zinc-50 pb-20">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-12">
                {/* HEADER */}
                <div className="flex justify-between items-end mb-12">
                    <div>
                        <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">{title}</h1>
                        <p className="text-zinc-500 font-medium mt-1">{description}</p>
                    </div>
                    <div className="flex gap-2">
                        <a
                            href="/"
                            className="p-2 text-zinc-400 hover:text-zinc-900 transition-colors rounded-full hover:bg-zinc-100 flex items-center justify-center"
                            title="Ir al inicio"
                        >
                            <HomeIcon size={24} />
                        </a>
                        <LogoutButton />
                    </div>
                </div>

                {/* CONTENT PLACEHOLDER */}
                <div className="bg-white rounded-[32px] p-12 border border-zinc-200 text-center shadow-sm">
                    <div className={`w-20 h-20 mx-auto rounded-3xl ${colorClass} bg-opacity-10 flex items-center justify-center mb-6`}>
                        <Icon size={40} className={colorClass.replace('bg-', 'text-')} />
                    </div>
                    <h2 className="text-xl font-semibold text-zinc-900 mb-2">Panel de {title}</h2>
                    <p className="text-zinc-500 max-w-md mx-auto">
                        Este módulo está habilitado para el departamento de {title}.
                        <br />
                        Las funciones específicas estarán disponibles pronto.
                    </p>
                </div>
            </div>
        </main>
    )
}
