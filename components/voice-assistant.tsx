"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Mic, MicOff, X, Activity, Settings2, Check, Power } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { processWithGemini } from "@/app/actions/assistant"
import { useVoice } from "@/components/voice-provider"

// Extend Window interface for Web Speech API
declare global {
    interface Window {
        SpeechRecognition: any
        webkitSpeechRecognition: any
        speechSynthesis: any
        SpeechSynthesisUtterance: any
    }
}

export function VoiceAssistant() {
    const router = useRouter()
    const pathname = usePathname()

    // CONTEXT FOR HINTS
    const { setVoiceActive } = useVoice()

    // LOGIC STATE
    const [isActive, setIsActive] = useState(false) // User Intent: "I want it On"
    const [isListening, setIsListening] = useState(false) // Technical: "Mic is open"
    const isActiveRef = useRef(false) // Ref for event loop access

    // Sync global state for hints
    useEffect(() => {
        setVoiceActive(isActive)
    }, [isActive, setVoiceActive])

    // WAKE WORD STATE
    const [isAwaitingCommand, setIsAwaitingCommand] = useState(false)
    const awaitingCommandRef = useRef(false)
    const inputTimeoutRef = useRef<any>(null)

    // UI STATE
    const [showUI, setShowUI] = useState(false)
    const [showVoiceMenu, setShowVoiceMenu] = useState(false)

    // DATA
    const [isProcessing, setIsProcessing] = useState(false)
    const [transcript, setTranscript] = useState("")
    const [interimTranscript, setInterimTranscript] = useState("")
    const [feedback, setFeedback] = useState("")
    const [voices, setVoices] = useState<any[]>([])
    const [selectedVoice, setSelectedVoice] = useState<any>(null)

    const recognitionRef = useRef<any>(null)
    const processingRef = useRef(false)
    const continueConversationRef = useRef(false) // New: Track conversation session

    // Initialize Speech Recognition & Voices
    useEffect(() => {
        if (typeof window !== "undefined") {
            // 1. Setup Recognition
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
            if (SpeechRecognition) {
                const recognition = new SpeechRecognition()
                recognition.continuous = false
                recognition.lang = "es-ES"
                recognition.interimResults = true

                recognition.onstart = () => {
                    setIsListening(true)
                }

                recognition.onend = () => {
                    setIsListening(false)
                    // AUTO-RESTART LOOP
                    if (isActiveRef.current) {
                        setTimeout(() => {
                            if (isActiveRef.current && !processingRef.current) {
                                try { recognition.start() } catch (e) { }
                            }
                        }, 10)
                    }
                }

                recognition.onresult = (event: any) => {
                    if (processingRef.current) return

                    let interim = ""
                    let final = ""

                    for (let i = event.resultIndex; i < event.results.length; ++i) {
                        if (event.results[i].isFinal) {
                            final += event.results[i][0].transcript
                        } else {
                            interim += event.results[i][0].transcript
                        }
                    }

                    if (interim) setInterimTranscript(interim)

                    if (final) {
                        const clean = final.trim()
                        console.log("🎤 Heard:", clean)

                        // BROADENED WAKE WORD REGEX (Phonetic variations)
                        const wakeWordPattern = /^(oye\s+)?(linky|linki|lynky|link|linqui|vini|blinky)\b/i

                        // 1. One-Shot Command: "Linky busca x"
                        const oneShotMatch = clean.match(new RegExp(`^(oye\\s+)?(linky|linki|lynky|link|linqui|vini|blinky)\\b\\s*(.+)`, 'i'))

                        if (oneShotMatch && oneShotMatch[3]) {
                            const cmd = oneShotMatch[3].trim() // Capture group 3 is the command

                            // Reset waiting state
                            clearTimeout(inputTimeoutRef.current)
                            setIsAwaitingCommand(false)
                            awaitingCommandRef.current = false

                            setTranscript(cmd)
                            setInterimTranscript("")
                            processCommand(cmd)
                            return
                        }

                        // 2. Trigger Word Only: "Linky"
                        const triggerMatch = clean.match(new RegExp(`^(oye\\s+)?(linky|linki|lynky|link|linqui|vini|blinky)\\b$`, 'i'))

                        if (triggerMatch) {
                            // Enable listening for next phrase
                            clearTimeout(inputTimeoutRef.current)
                            setIsAwaitingCommand(true)
                            awaitingCommandRef.current = true
                            setFeedback("") // Clear previous response

                            setTranscript(clean)
                            // setInterimTranscript("¿Sí?")
                            // speak("¿Sí?") // Removed to reduce delay as requested

                            // Timeout if user says nothing
                            inputTimeoutRef.current = setTimeout(() => {
                                setIsAwaitingCommand(false)
                                awaitingCommandRef.current = false
                                setInterimTranscript("")
                            }, 5000)
                            return
                        }

                        // 3. Follow-up Command (if waiting): "Busca x"
                        if (awaitingCommandRef.current) {
                            clearTimeout(inputTimeoutRef.current)
                            setIsAwaitingCommand(false)
                            awaitingCommandRef.current = false

                            setTranscript(clean)
                            setInterimTranscript("")
                            processCommand(clean)
                            return
                        }

                        // 4. Ignore otherwise
                        console.log("Ignored (No wake word):", clean)
                        setInterimTranscript("")
                    }
                }

                recognition.onerror = (event: any) => {
                    // console.error("Speech recognition error", event.error)
                    if (event.error === 'not-allowed') {
                        setIsActive(false)
                        isActiveRef.current = false
                        toast.error("Permiso de micrófono denegado")
                    }

                    // Safety reset on error
                    processingRef.current = false

                    if (event.error === 'no-speech') {
                        // Just silence, ignore/restart loop handles it
                    }
                }

                recognitionRef.current = recognition
            }

            // 2. Load Voices
            const loadVoices = () => {
                const allVoices = window.speechSynthesis.getVoices()
                const spanishVoices = allVoices.filter((v: any) => v.lang.startsWith("es"))
                setVoices(spanishVoices)

                if (!selectedVoice) {
                    const bestVoice = spanishVoices.find((v: any) => v.name.includes("Google") && v.name.includes("es"))
                        || spanishVoices.find((v: any) => v.name.includes("Microsoft Sabina"))
                        || spanishVoices.find((v: any) => v.name.includes("Microsoft Helena"))
                        || spanishVoices[0]

                    if (bestVoice) setSelectedVoice(bestVoice)
                }
            }

            window.speechSynthesis.onvoiceschanged = loadVoices
            loadVoices()
        }
    }, [])

    const activateAssistant = () => {
        setIsActive(true)
        isActiveRef.current = true
        setShowUI(true)

        // Mobile TTS Warmup
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel()
            const warmUp = new window.SpeechSynthesisUtterance(" ")
            warmUp.volume = 0
            window.speechSynthesis.speak(warmUp)
        }

        try { recognitionRef.current?.start() } catch (e) { }
    }

    const deactivateAssistant = () => {
        setIsActive(false)
        isActiveRef.current = false
        setShowUI(false)
        setIsListening(false)
        if (recognitionRef.current) recognitionRef.current.stop()

        // Clear state
        setFeedback("")
        setTranscript("")
    }

    // Internal helper to close UI but keep listening
    const hideUI = () => {
        setShowUI(false)
    }

    // Helper to resume listening after an action is completed
    const speak = (text: string, onEnd?: () => void) => {
        if (typeof window !== "undefined" && window.speechSynthesis) {
            // Cancel previous
            window.speechSynthesis.cancel()

            // If empty text, just run callback immediately
            if (!text) {
                if (onEnd) onEnd()
                return
            }

            const utterance = new window.SpeechSynthesisUtterance(text)
            utterance.lang = "es-ES"
            utterance.rate = 1.05
            utterance.pitch = 1.0

            if (selectedVoice) {
                utterance.voice = selectedVoice
            }

            utterance.onend = () => {
                if (onEnd) onEnd()
            }

            // Safety timeout in case onend never fires (network/browser bug)
            // But we make it long enough to not cut off, but short enough to recover
            const safety = setTimeout(() => {
                if (onEnd) onEnd()
            }, 8000)

            utterance.onend = () => {
                clearTimeout(safety)
                if (onEnd) onEnd()
            }

            window.speechSynthesis.speak(utterance)
        } else {
            if (onEnd) onEnd()
        }
    }

    const restartLifecycle = () => {
        setIsProcessing(false)
        setTranscript("")
        processingRef.current = false

        // Only restart if the user hasn't turned it off
        if (isActiveRef.current && recognitionRef.current) {
            // Force abort first to ensure clean state
            try { recognitionRef.current.abort() } catch (e) { }

            // Small delay to ensure previous session cleared
            setTimeout(() => {
                if (isActiveRef.current && recognitionRef.current) {
                    try { recognitionRef.current.start() } catch (e) {
                        console.log("Restart error:", e)
                    }

                    // CONTINUOUS MODE: If flag set, keep listening for 10s
                    if (continueConversationRef.current) {
                        setFeedback("") // Clear previous response as requested
                        setIsAwaitingCommand(true)
                        awaitingCommandRef.current = true

                        // Auto-close command window if silence
                        clearTimeout(inputTimeoutRef.current)
                        inputTimeoutRef.current = setTimeout(() => {
                            setIsAwaitingCommand(false)
                            awaitingCommandRef.current = false
                            continueConversationRef.current = false // End session
                            setInterimTranscript("")
                        }, 10000) // 10 seconds window
                    }
                }
            }, 300)
        }
    }

    const processCommand = async (text: string) => {
        if (processingRef.current) return
        processingRef.current = true
        setIsProcessing(true)

        // --- LOCAL INTENT ROUTER (Offline "Offline Mode") ---
        const t = text.toLowerCase().trim()

        // CHECK IF IT IS A QUESTION / DATABASE QUERY
        // If the user asks "How many...", "Who...", "Analyze...", we should let Gemini handle it.
        const isQuery = /^(cu[aá]ntos?|qu[eé]|c[oó]mo|d[oó]nde|por qu[eé]|dime|analiza|resumen|total|cantidad)/i.test(t)

        let localAction = null

        // Only look for local navigation if it's NOT a complex query
        if (!isQuery) {
            // 1. Define Command Map
            const COMMAND_MAP = [
                // --- CHIT-CHAT (Quota Savers) ---
                { keywords: ["hola", "buenos días", "buenas tardes", "buenas noches", "hi", "hello", "saludos"], path: "SPEAK_ONLY", msg: "Hola, soy Linky. ¿En qué puedo ayudarte?" },
                { keywords: ["gracias", "muchas gracias", "te agradezco"], path: "SPEAK_ONLY", msg: "Es un placer ayudarte." },
                { keywords: ["quién eres", "quien eres", "tu nombre", "cómo te llamas"], path: "SPEAK_ONLY", msg: "Soy Linky, tu asistente virtual inteligente del SGO." },
                { keywords: ["ayuda", "qué puedes hacer", "comandos", "instrucciones"], path: "SPEAK_ONLY", msg: "Puedo navegar por el sistema, buscar vehículos y gestionar inventario. Intenta decir 'Ir a almacén' o 'Busca vehículo'." },

                // --- NAVIGATION ---
                // Operaciones / Técnicos
                { keywords: ["taller", "mecánica", "mecanica"], path: "/taller", msg: "Abriendo taller mecánico." },
                { keywords: ["técnico", "tecnico", "reporte", "mis tareas", "mis asignaciones"], path: "/tecnicos", msg: "Abriendo panel de técnicos." },
                { keywords: ["instalación", "instalacion", "nueva instalación", "nuevo reporte"], path: "/tecnicos/reportes?action=new", msg: "Iniciando nueva instalación." },
                { keywords: ["finalizar día", "finalizar dia", "fin de jornada", "terminar dia", "terminar día"], path: "SPEAK_ONLY", msg: "Recuerda pulsar el botón rojo para cerrar tu día." }, // Hint-only (button handles logic) or deep link if possible? "FinalizeDayButton" is a component. Let's make it speak only or navigate to a summary if existed. "SPEAK_ONLY" guide.
                { keywords: ["reportar soporte", "nuevo soporte"], path: "/tecnicos/reportes?action=support", msg: "Reportando soporte." },

                // Taller Actions
                { keywords: ["tablero", "tablero completo"], path: "/taller?view=board", msg: "Mostrando tablero Kanban." },
                { keywords: ["historial", "ver historial"], path: "/taller?view=history", msg: "Mostrando historial de taller." },
                { keywords: ["registrar", "registrar falla", "registrar mantenimiento"], path: "/taller?action=new", msg: "Abriendo formulario de registro." }, // Needs handling in page to open dialog? Page uses `maintenanceOpen` state. We can use URL param `?action=new` and useEffect in page to open it.

                // Inventario / Materiales

                // Inventario / Materiales
                { keywords: ["inventario", "almacén", "almacen", "bodega", "producto", "stock"], path: "/almacen", msg: "Yendo al almacén." },
                { keywords: ["bobina", "spool", "cable", "fibra", "mis bobinas"], path: "/control/spools", msg: "Abriendo gestión de bobinas." },
                { keywords: ["auditoría", "auditoria"], path: "/control/audit", msg: "Abriendo panel de auditoría." },

                // Flota / Transporte
                { keywords: ["vehículo", "vehiculo", "carro", "camioneta", "flota", "transporte"], path: "/admin/vehiculos", msg: "Aquí está la flota de vehículos." },
                { keywords: ["combustible", "gasolina", "diesel", "tanqueo"], path: "/control/combustible", msg: "Abriendo control de combustible." },

                // Administración / RRHH
                { keywords: ["usuario", "personal", "empleado", "rrhh", "recursos humanos"], path: "/admin/usuarios", msg: "Abriendo gestión de personal." },
                { keywords: ["configuración", "configuracion", "ajustes", "sistema"], path: "/admin/configuracion", msg: "Abriendo configuración." },
                { keywords: ["gerencia", "manager", "tablero de control", "resumen"], path: "/gerencia", msg: "Abriendo tablero de gerencia." },

                // General
                { keywords: ["inicio", "home", "casa", "principal", "dashboard", "escritorio"], path: "/", msg: "Volviendo al inicio." },
                { keywords: ["perfil", "mi cuenta", "mis datos"], path: "/perfil", msg: "Abriendo tu perfil." },
                { keywords: ["volver", "atrás", "atras", "regresar"], path: "BACK", msg: "Volviendo." }
            ]

            // 2. Find Match (Exact Keyword)
            localAction = COMMAND_MAP.find(cmd => cmd.keywords.some(k => t.includes(k)))
        }

        // 3. Smart Handling for "Vehicle X" Deep Link
        // Override generic match if we find a specific target for vehicles
        const vehicleMatch = t.match(/(?:vehículo|vehiculo|carro|placa|flota)\s+(.+)/i)
        if (vehicleMatch && vehicleMatch[1]) {
            // FIX: Use word boundaries to avoid stripping partial words (e.g., "michel" -> "mich")
            const term = vehicleMatch[1].replace(/\b(?:el|la|de|del|un|una)\b/gi, "").trim()

            if (term.length > 0) {
                console.log(`[Local Router] Deep Link Vehicle: "${term}"`)
                setFeedback(`Buscando vehículo ${term}...`)

                router.push(`/admin/vehiculos?q=${encodeURIComponent(term)}`)

                speak(`Buscando ${term}`, () => {
                    continueConversationRef.current = true
                    restartLifecycle()
                })
                return
            }
        }

        if (localAction) {
            console.log(`[Local Router] Matched: "${t}" -> ${localAction.path}`)

            setFeedback(localAction.msg)

            // Execute Navigation
            if (localAction.path === "BACK") {
                router.back()
            } else if (localAction.path !== "SPEAK_ONLY") {
                router.push(localAction.path)
            }

            // Speak & Restart immediately after
            speak(localAction.msg, () => {
                continueConversationRef.current = true
                restartLifecycle()
            })
            return
        }

        // --- END LOCAL ROUTER ---

        let response = ""
        let action: any = { type: 'NONE' }

        try {
            // PASS PATHNAME FOR CONTEXT AWARENESS
            const result = await processWithGemini(text, pathname)

            if (result.success && result.data) {
                response = result.data.response
                action = result.data.action
            } else {
                if (result.error === "MISSING_KEY") {
                    response = "Error: Falta la API Key de Gemini."
                    toast.error("Falta KEY")
                } else if (result.error === "DISABLED_BY_ADMIN") {
                    response = "El asistente ha sido desactivado por el administrador."
                    toast.warning("Linky desactivado")
                } else if (result.error === "API_ERROR") {
                    response = "Tuve un problema de conexión. Intenta de nuevo."
                } else {
                    response = "No entendí eso, ¿puedes repetir?"
                }
            }
        } catch (e) {
            console.error("Client processing failed", e)
            response = "Error de conexión."
        }

        // Safety Fallback
        if (!response) response = "Hubo un error silencioso."

        setFeedback(response)

        // Execute Action FIRST (so visual update happens while speaking)
        if (action.type === 'NAVIGATE') {
            if (action.path === 'BACK') {
                router.back()
            } else if (action.path) {
                router.push(action.path)
            }
        }

        // Speak & Restart
        speak(response, () => {
            continueConversationRef.current = true
            restartLifecycle()
        })
    }

    if (!recognitionRef.current) return null // Hide if not supported

    return (
        <>
            {/* Floating Trigger Button & Status Bubble */}
            {!showUI && (
                <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">

                    {/* Status Bubble */}
                    {(isActive || isProcessing) && (
                        <div className={cn(
                            "bg-white border border-zinc-200 shadow-xl px-4 py-2 rounded-2xl rounded-br-none text-sm font-medium animate-in slide-in-from-bottom-2 fade-in duration-300",
                            isProcessing ? "text-blue-600" : "text-zinc-600"
                        )}>
                            {isProcessing ? "Pensando..." : (isAwaitingCommand ? "Te escucho..." : "Di 'Linky' ...")}
                        </div>
                    )}

                    <Button
                        onClick={() => {
                            if (!isActive) activateAssistant()
                            else setShowUI(true)
                        }}
                        className={cn(
                            "h-14 w-14 rounded-full shadow-2xl transition-all duration-300 flex items-center justify-center group",
                            isActive
                                ? "bg-green-500 hover:bg-green-600 animate-pulse shadow-green-500/30"
                                : "bg-black text-white hover:bg-zinc-800 hover:scale-110"
                        )}
                    >
                        <Mic className="h-6 w-6" />
                        <span className="sr-only">Asistente de Voz</span>
                    </Button>
                </div>
            )}

            {/* Active Interface Overlay */}
            {showUI && (
                <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="absolute inset-0" onClick={hideUI} />

                    <div
                        className="relative w-full max-w-md bg-white rounded-[2rem] shadow-2xl overflow-visible animate-in slide-in-from-bottom-10 zoom-in-95 duration-300 p-6 flex flex-col items-center gap-6"
                        onClick={(e) => e.stopPropagation()}
                    >

                        {/* Top Bar: Close & Custom Voice Select */}
                        <div className="w-full flex justify-between items-center relative z-50">
                            {/* CUSTOM VOICE SELECTOR */}
                            <div className="relative">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 gap-2 text-zinc-500 rounded-full bg-zinc-50 hover:bg-zinc-100"
                                    onClick={(e) => { e.stopPropagation(); setShowVoiceMenu(!showVoiceMenu); }}
                                >
                                    <Settings2 size={14} />
                                    <span className="text-xs font-medium max-w-[100px] truncate">
                                        {selectedVoice?.name?.split(" ")[1] || "Voz"}
                                    </span>
                                </Button>

                                {/* Absolute List - Non-Portal */}
                                {showVoiceMenu && (
                                    <div className="absolute top-10 left-0 w-48 bg-white rounded-xl shadow-xl border border-zinc-100 max-h-48 overflow-y-auto z-[100] animate-in fade-in zoom-in-95 duration-200">
                                        <div className="p-1 space-y-0.5" onScroll={(e) => e.stopPropagation()}>
                                            {voices.map((v: any) => (
                                                <button
                                                    key={v.name}
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setSelectedVoice(v)
                                                        setShowVoiceMenu(false) // Close on select
                                                    }}
                                                    className={cn(
                                                        "w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-zinc-50 transition-colors flex items-center justify-between",
                                                        selectedVoice?.name === v.name ? "bg-blue-50 text-blue-700 font-medium" : "text-zinc-600"
                                                    )}
                                                >
                                                    <span className="truncate">{v.name}</span>
                                                    {selectedVoice?.name === v.name && <Check size={12} />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>


                            {/* Actions Group */}
                            <div className="flex items-center gap-2">
                                {/* Power Off Button */}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="rounded-full text-red-400 hover:text-white hover:bg-red-500 transition-colors"
                                    onClick={deactivateAssistant}
                                    title="Apagar Asistente"
                                >
                                    <Power size={20} />
                                </Button>

                                {/* Close UI Button (Keep listening) */}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="rounded-full text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"
                                    onClick={hideUI}
                                    title="Minimizar"
                                >
                                    <X size={20} />
                                </Button>
                            </div>
                        </div>


                        {/* Feedback / Status */}
                        {feedback ? (
                            <div className={cn(
                                "w-full p-4 rounded-2xl text-left max-h-60 overflow-y-auto border animate-in fade-in zoom-in-95 duration-300",
                                feedback.toLowerCase().includes("error")
                                    ? "bg-red-50 border-red-100"
                                    : "bg-blue-50 border-blue-100"
                            )}>
                                <p className={cn(
                                    "text-sm font-bold mb-1 flex items-center gap-2",
                                    feedback.toLowerCase().includes("error") ? "text-red-800" : "text-blue-800"
                                )}>
                                    {feedback.toLowerCase().includes("error") ? <Activity size={16} /> : <Settings2 size={16} />}
                                    {feedback.toLowerCase().includes("error") ? "Error" : "Respuesta"}
                                </p>
                                <p className={cn(
                                    "text-base leading-relaxed break-words select-text",
                                    feedback.toLowerCase().includes("error") ? "text-red-700" : "text-zinc-700"
                                )}>
                                    {feedback}
                                </p>
                            </div>
                        ) : (
                            /* Live Transcript Area */
                            <div className="w-full flex flex-col items-center gap-4 py-4 min-h-[140px] justify-center text-center">
                                {/* Visualizer */}
                                <div className={`relative h-16 w-16 flex items-center justify-center transition-all duration-300 ${interimTranscript ? 'scale-110' : 'scale-100'}`}>
                                    {isActive && <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping" />}
                                    <div className={cn(
                                        "relative h-12 w-12 rounded-full flex items-center justify-center shadow-lg transition-colors duration-300",
                                        isActive ? "bg-green-500 shadow-green-500/20" : "bg-black shadow-blue-500/20"
                                    )}>
                                        <Mic className="text-white h-5 w-5" />
                                    </div>
                                </div>

                                <div className="space-y-2 max-w-full">
                                    <p className="text-xl font-medium text-zinc-900 leading-snug break-words animate-in fade-in">
                                        {interimTranscript || transcript || (
                                            <span className="text-zinc-400">
                                                {isActive ? "Escuchando..." : "En pausa"}
                                            </span>
                                        )}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    )
}
