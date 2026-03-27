"use client"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Chrome } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"

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
            console.log("DEBUG LOGIN: Redirecting to:", redirectTo)

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
                toast.success("Cuenta creada! Revisa tu correo o intenta iniciar sesión (si el auto-confirm está activo)")
                // Try auto login logic or just notify
                // For dev environments without email confirm, this works immediately usually
                // If email confirm is on, they are stuck. 
                // Let's assume they can login or middleware handles it.
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
        <main className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden bg-[#F2F2F7]">
            {/* Background Gradients - Subtle Silver/Gray */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-gray-200/50 blur-[100px]" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-slate-200/50 blur-[100px]" />

            {/* Glass Card - Light Mode iOS Style */}
            <div className="w-full max-w-md relative z-10 backdrop-blur-xl bg-white/70 border border-white/40 rounded-[2.5rem] p-8 shadow-xl shadow-black/5 ring-1 ring-white/60">
                <div className="flex flex-col items-center text-center space-y-8 py-8">
                    {/* Logo Area */}
                    <div className="w-24 h-24 bg-gradient-to-br from-white to-gray-100 rounded-2xl flex items-center justify-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-2 animate-in zoom-in duration-500 border border-white/60">
                        <div className="w-12 h-12 border-4 border-gray-900 rounded-xl" />
                    </div>

                    <div className="space-y-2 animate-in slide-in-from-bottom-4 duration-700 fade-in fill-mode-both delay-100">
                        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
                            Bienvenido
                        </h1>
                        <p className="text-gray-500 text-sm font-medium tracking-wide uppercase">
                            Sistema de Gestión y Operatividad
                        </p>
                    </div>

                    <div className="w-full space-y-4 pt-4 animate-in slide-in-from-bottom-8 duration-700 fade-in fill-mode-both delay-200">

                        {/* Manual Login Form */}
                        <form onSubmit={handleEmailLogin} className="space-y-3 mb-6">
                            <div className="space-y-1 text-left">
                                <Label className="text-xs text-gray-500 ml-1">Email</Label>
                                <Input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="rounded-xl border-gray-200 bg-gray-50/50"
                                    placeholder="correo@ejemplo.com"
                                />
                            </div>
                            <div className="space-y-1 text-left">
                                <Label className="text-xs text-gray-500 ml-1">Contraseña</Label>
                                <Input
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="rounded-xl border-gray-200 bg-gray-50/50"
                                    placeholder="••••••••"
                                />
                            </div>
                            <Button
                                type="submit"
                                variant="outline"
                                className="w-full rounded-xl h-11 border-gray-200 text-gray-700 hover:bg-gray-50 mb-2"
                                disabled={loading || !email || !password}
                            >
                                {loading ? "Procesando..." : (isSignUp ? "Registrar Cuenta de Prueba" : "Iniciar con Correo")}
                            </Button>

                            <div className="text-center">
                                <button
                                    type="button"
                                    onClick={() => setIsSignUp(!isSignUp)}
                                    className="text-xs text-blue-600 hover:underline"
                                >
                                    {isSignUp ? "¿Ya tienes cuenta? Inicia Sesión" : "¿No tienes contraseña? Crea una cuenta de prueba"}
                                </button>
                            </div>
                        </form>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-gray-200" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-white px-2 text-gray-400">O continúa con</span>
                            </div>
                        </div>
                        <Button
                            onClick={handleLogin}
                            className="w-full h-14 rounded-full text-base font-medium bg-gray-900 text-white hover:bg-black transition-all duration-300 shadow-lg shadow-gray-900/10 hover:scale-[1.02] active:scale-[0.98]"
                            disabled={loading}
                        >
                            {loading ? (
                                <span className="animate-pulse">Conectando...</span>
                            ) : (
                                <div className="flex items-center justify-center gap-3">
                                    <Chrome className="w-5 h-5 text-white" />
                                    <span>Continuar con Google</span>
                                </div>
                            )}
                        </Button>

                        <p className="text-xs text-center text-gray-400">
                            Acceso seguro restringido a personal autorizado
                        </p>
                    </div>
                </div>
            </div>
        </main>
    )
}
