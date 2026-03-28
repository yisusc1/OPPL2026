"use client"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Chrome, Loader2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import { EllielLogo } from "@/components/ui/elliel-logo"
import { BackgroundPaths } from "@/components/ui/background-paths"

export default function LoginPage() {
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [isSignUp, setIsSignUp] = useState(false)

    const handleLogin = async () => {
        setLoading(true)
        try {
            const supabase = createClient()
            const redirectTo = `${window.location.origin}/auth/callback`

            const { error } = await supabase.auth.signInWithOAuth({
                provider: "google",
                options: {
                    redirectTo,
                },
            })

            if (error) throw error
        } catch (error) {
            console.error("Error logging in:", error)
            toast.error("Error al iniciar sesión con Google")
            setLoading(false)
        }
    }

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        const supabase = createClient()

        if (isSignUp) {
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        first_name: "Test",
                        last_name: "User"
                    }
                }
            })
            if (error) {
                toast.error("Error registro: " + error.message)
                setLoading(false)
            } else {
                toast.success("Cuenta creada! Intenta iniciar sesión")
                setLoading(false)
            }
        } else {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password
            })

            if (error) {
                toast.error("Error: " + error.message)
                setLoading(false)
            } else {
                toast.success("Bienvenido")
                router.push("/")
                router.refresh()
            }
        }
    }

    return (
        <main className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden bg-background">
            {/* Animación de fondo (estilo premium principal del proyecto) */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <BackgroundPaths />
            </div>

            {/* Tarjeta de Glassmorphism */}
            <div className="w-full max-w-[400px] relative z-10 backdrop-blur-xl bg-background/60 border border-border/40 rounded-[2.5rem] p-8 sm:p-10 shadow-2xl">
                <div className="flex flex-col items-center text-center">
                    
                    {/* Logo Area (Reemplaza al cuadro de prueba) */}
                    <div className="mb-8 flex items-center justify-center animate-in zoom-in duration-500">
                        <EllielLogo width={110} />
                    </div>

                    <div className="space-y-1 mb-6 animate-in slide-in-from-bottom-4 duration-700 fade-in delay-100">
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">
                            Bienvenido
                        </h1>
                        <p className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                            Sistema de Gestión y Operatividad
                        </p>
                    </div>

                    <form onSubmit={handleEmailLogin} className="w-full space-y-4 mb-6 animate-in slide-in-from-bottom-6 duration-700 fade-in delay-200">
                        <div className="space-y-1.5 text-left">
                            <Label className="text-xs text-muted-foreground ml-1">Correo Electrónico</Label>
                            <Input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="h-11 rounded-xl bg-background/50 border-border/50 focus:bg-background transition-colors"
                                placeholder="correo@ejemplo.com"
                                required
                            />
                        </div>
                        <div className="space-y-1.5 text-left">
                            <Label className="text-xs text-muted-foreground ml-1">Contraseña</Label>
                            <Input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="h-11 rounded-xl bg-background/50 border-border/50 focus:bg-background transition-colors"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                        
                        <div className="pt-2">
                            <Button
                                type="submit"
                                className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition-all shadow-md shadow-blue-600/20"
                                disabled={loading || !email || !password}
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isSignUp ? "Registrar Cuenta" : "Iniciar Sesión")}
                            </Button>
                        </div>

                        <div className="text-center pt-2">
                            <button
                                type="button"
                                onClick={() => setIsSignUp(!isSignUp)}
                                className="text-[11px] text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 font-medium hover:underline transition-colors"
                            >
                                {isSignUp ? "¿Ya tienes cuenta? Ingresa aquí" : "¿Necesitas acceso? Crea una cuenta de prueba"}
                            </button>
                        </div>
                    </form>

                    <div className="w-full relative animate-in slide-in-from-bottom-8 duration-700 fade-in delay-300">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-border/50" />
                        </div>
                        <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-wider">
                            <span className="bg-background/80 backdrop-blur-md px-2 text-muted-foreground rounded-full">O continúa con</span>
                        </div>
                    </div>

                    <div className="w-full mt-6 animate-in slide-in-from-bottom-8 duration-700 fade-in delay-300">
                        <Button
                            onClick={handleLogin}
                            variant="outline"
                            className="w-full h-11 rounded-xl text-sm font-medium border-border/50 bg-background/50 hover:bg-muted/50 transition-all duration-300 shadow-sm"
                            disabled={loading}
                        >
                            {loading ? (
                                <span className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Conectando...</span>
                            ) : (
                                <div className="flex items-center justify-center gap-3">
                                    <Chrome className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                                    <span>Continuar con Google</span>
                                </div>
                            )}
                        </Button>

                        <p className="text-[9px] text-center text-zinc-400 mt-6 uppercase tracking-widest font-semibold flex items-center justify-center gap-2">
                            Acceso Autorizado únicamente
                        </p>
                    </div>
                </div>
            </div>
        </main>
    )
}
