"use client"

import type React from "react"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { X, User, CreditCard, Box, ScanLine } from "lucide-react"
import { toast } from "sonner"

type CreateClientDialogProps = {
  isOpen: boolean
  onClose: () => void
  onClientCreated: () => void
  teamName?: string
  availableOnus?: string[]
  restrictionsEnabled?: boolean
}

export function CreateClientDialog({ isOpen, onClose, onClientCreated, teamName, availableOnus = [], restrictionsEnabled = true }: CreateClientDialogProps) {
  const [loading, setLoading] = useState(false)
  const [manualMode, setManualMode] = useState(false)
  const [formData, setFormData] = useState({
    nombre: "",
    cedula: "",
    plan: "",
    equipo: teamName || "",
    onu: "",
  })

  // Update formData when teamName changes (if props update while open)
  if (teamName && formData.equipo !== teamName) {
    setFormData(prev => ({ ...prev, equipo: teamName }))
  }

  const planes = [
    "400MB Residencial",
    "600MB Residencial",
    "800MB Residencial",
    "400MB Empresarial",
    "600MB Empresarial",
    "800MB Empresarial",
    "1GB Empresarial",
  ]

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    let { name, value } = e.target

    if (name === "onu") {
      // Force uppercase and remove non-alphanumeric characters
      value = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15) // increased length for serials
    }

    setFormData({
      ...formData,
      [name]: value,
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.from("clientes").insert({
        nombre: formData.nombre,
        cedula: formData.cedula,
        direccion: "Pendiente de Revisión", // Inicializar como pendiente
        plan: formData.plan,
        equipo: formData.equipo,
        onu: formData.onu,
        user_id: (await supabase.auth.getUser()).data.user?.id
      })

      if (error) throw error

      setFormData({ nombre: "", cedula: "", plan: "", equipo: teamName || "", onu: "" })
      onClientCreated()
      onClose()
      toast.success("Cliente creado exitosamente")
    } catch (error) {
      console.error("Error creating client:", error)
      if (typeof error === "object" && error !== null) {
        // @ts-ignore
        if (error.code === '23505') {
          toast.error("Esta cédula de cliente ya ha sido utilizada.")
        } else {
          console.error("Error Details:", JSON.stringify(error, null, 2))
          // @ts-ignore
          if (error.message) console.error("Error Message:", error.message)
          // @ts-ignore
          toast.error(`Error: ${error.message || "Error desconocido al crear el cliente"}`)
        }
      } else {
        toast.error("Error al crear el cliente")
      }
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
      <Card className="w-full max-w-lg rounded-[32px] border-0 shadow-2xl bg-white dark:bg-zinc-950 overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="relative p-6 pt-8 pb-4">
          <button
            onClick={onClose}
            className="absolute right-6 top-6 w-10 h-10 rounded-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Crear Nuevo Cliente</CardTitle>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Ingrese los datos para registrar la instalación</p>
          </div>
        </div>

        <CardContent className="p-6 pt-0">
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* NOMBRE */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider pl-1">Nombre Completo</label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-zinc-800 dark:group-focus-within:text-zinc-200 transition-colors" size={20} />
                <input
                  type="text"
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleChange}
                  required
                  className="w-full h-14 pl-12 pr-4 bg-zinc-50 dark:bg-zinc-900/50 border-0 rounded-2xl text-lg text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
                  placeholder="Ej. Juan Pérez"
                />
              </div>
            </div>

            {/* CEDULA & PLAN GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider pl-1">Cédula</label>
                <div className="relative group">
                  <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-zinc-800 dark:group-focus-within:text-zinc-200 transition-colors" size={20} />
                  <input
                    type="text"
                    name="cedula"
                    value={formData.cedula}
                    onChange={handleChange}
                    required
                    className="w-full h-14 pl-12 pr-4 bg-zinc-50 dark:bg-zinc-900/50 border-0 rounded-2xl text-lg text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
                    placeholder="V-1234..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider pl-1">Plan</label>
                <div className="relative">
                  <select
                    name="plan"
                    value={formData.plan}
                    onChange={handleChange}
                    required
                    className="w-full h-14 pl-4 pr-10 bg-zinc-50 dark:bg-zinc-900/50 border-0 rounded-2xl text-base text-zinc-900 dark:text-zinc-100 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-medium cursor-pointer"
                  >
                    <option value="" className="text-zinc-400">Seleccionar...</option>
                    {planes.map((plan) => (
                      <option key={plan} value={plan} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
                        {plan}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* EQUIPO & ONU GRID */}
            <div className="space-y-4 pt-2">
              <div className="p-4 rounded-3xl bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-100 dark:border-zinc-800 space-y-4">
                {/* EQUIPO */}
                <div className="opacity-70 pointer-events-none">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 block">Equipo Asignado</label>
                  <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <Box className="text-zinc-400" size={18} />
                    <span className="text-zinc-600 dark:text-zinc-300 font-medium">{formData.equipo || "Sin Equipo"}</span>
                  </div>
                </div>

                {/* ONU SECTION */}
                <div>
                  <div className="flex justify-between items-center mb-2 pl-1">
                    <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">ONU (Serial)</label>
                    {!restrictionsEnabled && (
                      <button
                        type="button"
                        onClick={() => setManualMode(!manualMode)}
                        className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline uppercase tracking-wide"
                      >
                        {manualMode ? "Usar Lista" : "Manual"}
                      </button>
                    )}
                  </div>

                  {manualMode ? (
                    <div className="relative group">
                      <ScanLine className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                      <input
                        type="text"
                        name="onu"
                        value={formData.onu}
                        onChange={handleChange}
                        required
                        className="w-full h-14 pl-12 pr-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-lg text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono font-medium tracking-wide"
                        placeholder="ZTEGC..."
                      />
                    </div>
                  ) : (
                    <div className="relative">
                      <select
                        name="onu"
                        value={formData.onu}
                        onChange={handleChange}
                        required
                        className="w-full h-14 px-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-lg text-zinc-900 dark:text-zinc-100 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono font-medium tracking-wide"
                      >
                        <option value="" className="text-zinc-400">Seleccionar ONU Disponibile...</option>
                        {availableOnus.map((serial) => (
                          <option key={serial} value={serial} className="text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900">
                            {serial}
                          </option>
                        ))}
                        {availableOnus.length === 0 && (
                          <option disabled>Sin ONUs disponibles</option>
                        )}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-14 bg-zinc-900 hover:bg-black dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-lg font-bold rounded-2xl shadow-xl shadow-zinc-900/10 active:scale-[0.98] transition-all"
              >
                {loading ? "Registrando..." : "Crear Cliente"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
