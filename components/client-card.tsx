"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, Clock, AlertCircle, Trash2, Pencil, MapPin } from "lucide-react"

type ClientCardProps = {
  client: {
    id: string
    nombre: string
    cedula: string
    direccion: string
    plan: string
    equipo?: string
  }
  onSelectPhase: (phase: "assignment" | "review" | "closure") => void
  onFinalize?: () => void
  onEdit?: () => void
  onDelete?: () => void
  isClosureCompleted?: boolean
  // New props for status
  isAssignmentCompleted?: boolean
  isReviewCompleted?: boolean
}

export function ClientCard({ client, onSelectPhase, onFinalize, onEdit, onDelete, isClosureCompleted, isAssignmentCompleted, isReviewCompleted }: ClientCardProps) {
  return (
    <Card className="rounded-[28px] border-0 shadow-lg shadow-zinc-900/5 bg-white dark:bg-zinc-900 overflow-hidden ring-1 ring-zinc-100 dark:ring-zinc-800 hover:ring-zinc-200 dark:hover:ring-zinc-700 transition-all duration-300 group">
      <CardHeader className="pb-2 pt-6 px-6">
        <div className="flex justify-between items-start">
          <div className="flex-1 space-y-1">
            <CardTitle className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight leading-snug">{client.nombre}</CardTitle>
            <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500 font-medium font-mono text-xs">
              <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md text-zinc-600 dark:text-zinc-300">{client.cedula}</span>
              {client.equipo && (
                <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md uppercase tracking-wider text-[10px] font-bold">
                  {client.equipo}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              onClick={onEdit}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
              title="Editar"
            >
              <Pencil size={16} />
            </button>
            {onDelete && (
              <button
                onClick={onDelete}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-red-50 dark:bg-red-900/20 text-red-500 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 transition-all"
                title="Eliminar Cliente"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-6 pb-6 pt-2 space-y-6">

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="col-span-2 bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-2xl flex items-start gap-3">
            <div className="mt-0.5 text-zinc-400 shrink-0">
              <MapPin size={16} />
            </div>
            <span className="text-zinc-600 dark:text-zinc-300 font-medium leading-relaxed">{client.direccion}</span>
          </div>

          <div className="flex items-center gap-2 px-1">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Plan</span>
            <span className="text-zinc-900 dark:text-zinc-100 font-bold">{client.plan}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest pl-1">Progreso de Instalación</p>

          <div className="grid grid-cols-1 gap-2">
            <Button
              onClick={() => onSelectPhase("assignment")}
              variant="ghost"
              className={`h-14 w-full justify-between px-4 rounded-2xl border-0 transition-all duration-300 group/btn ${isAssignmentCompleted
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${isAssignmentCompleted ? 'bg-emerald-200/50 dark:bg-emerald-900/40' : 'bg-zinc-200/50 dark:bg-zinc-800'
                  }`}>
                  <Clock size={18} className={isAssignmentCompleted ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-400'} />
                </div>
                <span className="font-bold text-lg">Asignación</span>
              </div>
              {isAssignmentCompleted && <CheckCircle size={20} className="text-emerald-500" />}
            </Button>

            <Button
              onClick={() => onSelectPhase("review")}
              variant="ghost"
              className={`h-14 w-full justify-between px-4 rounded-2xl border-0 transition-all duration-300 group/btn ${isReviewCompleted
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${isReviewCompleted ? 'bg-emerald-200/50 dark:bg-emerald-900/40' : 'bg-zinc-200/50 dark:bg-zinc-800'
                  }`}>
                  <AlertCircle size={18} className={isReviewCompleted ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-400'} />
                </div>
                <span className="font-bold text-lg">Revisión</span>
              </div>
              {isReviewCompleted && <CheckCircle size={20} className="text-emerald-500" />}
            </Button>

            <Button
              onClick={() => onSelectPhase("closure")}
              variant="ghost"
              className={`h-14 w-full justify-between px-4 rounded-2xl border-0 transition-all duration-300 group/btn ${isClosureCompleted
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${isClosureCompleted ? 'bg-emerald-200/50 dark:bg-emerald-900/40' : 'bg-zinc-200/50 dark:bg-zinc-800'
                  }`}>
                  <CheckCircle size={18} className={isClosureCompleted ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-400'} />
                </div>
                <span className="font-bold text-lg">Cierre</span>
              </div>
              {isClosureCompleted && <CheckCircle size={20} className="text-emerald-500" />}
            </Button>

            {isClosureCompleted && onFinalize && (
              <Button
                onClick={onFinalize}
                variant="ghost"
                className="w-full h-14 justify-center gap-2 rounded-2xl text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 font-bold mt-2 transition-all opacity-80 hover:opacity-100"
              >
                <Trash2 size={18} />
                Finalizar Instalación
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
