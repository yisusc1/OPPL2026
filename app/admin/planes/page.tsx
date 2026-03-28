"use client"

import { useState, useEffect } from "react"
import { PremiumPageLayout } from "@/components/ui/premium-page-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { Plus, Pencil, Trash2, Save, X, Tv, Tag } from "lucide-react"
import { getPlanes, addPlan, updatePlan, deletePlan } from "@/app/actions/ventas"
import { getTvLabel, updateTvLabel } from "@/app/admin/settings-actions"

export default function PlanesAdmin() {
  const { toast } = useToast()
  const [planes, setPlanes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tvLabel, setTvLabel] = useState("TV")
  const [tvLabelInput, setTvLabelInput] = useState("TV")
  const [savingLabel, setSavingLabel] = useState(false)

  // New plan form
  const [showForm, setShowForm] = useState(false)
  const [formNombre, setFormNombre] = useState("")
  const [formTipo, setFormTipo] = useState("Domiciliario")
  const [formActivo, setFormActivo] = useState(true)
  const [formHasTv, setFormHasTv] = useState(false)
  const [savingPlan, setSavingPlan] = useState(false)

  // Edit state
  const [editId, setEditId] = useState<number | null>(null)
  const [editNombre, setEditNombre] = useState("")
  const [editTipo, setEditTipo] = useState("")
  const [editActivo, setEditActivo] = useState(true)
  const [editHasTv, setEditHasTv] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [p, label] = await Promise.all([getPlanes(), getTvLabel()])
      setPlanes(p)
      setTvLabel(label)
      setTvLabelInput(label)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveTvLabel() {
    setSavingLabel(true)
    try {
      await updateTvLabel(tvLabelInput)
      setTvLabel(tvLabelInput)
      toast({ title: `Etiqueta actualizada a "${tvLabelInput}"` })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setSavingLabel(false)
    }
  }

  async function handleAddPlan() {
    if (!formNombre.trim()) return
    setSavingPlan(true)
    try {
      await addPlan({ nombre: formNombre.trim(), tipo: formTipo, activo: formActivo, has_tv: formHasTv })
      toast({ title: "Plan creado" })
      setFormNombre(""); setFormHasTv(false); setShowForm(false)
      await loadData()
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setSavingPlan(false)
    }
  }

  async function handleUpdatePlan(id: number) {
    try {
      await updatePlan(id, { nombre: editNombre.trim(), tipo: editTipo, activo: editActivo, has_tv: editHasTv })
      toast({ title: "Plan actualizado" })
      setEditId(null)
      await loadData()
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  }

  async function handleDeletePlan(id: number) {
    if (!confirm("¿Eliminar este plan?")) return
    try {
      await deletePlan(id)
      toast({ title: "Plan eliminado" })
      await loadData()
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  }

  function startEdit(p: any) {
    setEditId(p.id)
    setEditNombre(p.nombre)
    setEditTipo(p.tipo)
    setEditActivo(p.activo)
    setEditHasTv(p.has_tv)
  }

  const domiciliarios = planes.filter(p => p.tipo === "Domiciliario")
  const empresariales = planes.filter(p => p.tipo === "Empresarial")

  if (loading) return (
    <PremiumPageLayout title="Gestión de Planes" description="Cargando...">
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    </PremiumPageLayout>
  )

  return (
    <PremiumPageLayout title="Gestión de Planes" description="Administra los planes de servicio disponibles para asesores.">
      <div className="space-y-6">

        {/* TV Label Config */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-zinc-500">
              <Tag size={16} /> Etiqueta de Servicio de TV
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Personaliza el nombre del servicio de TV que se muestra en los planes (ej: &quot;TV&quot;, &quot;Power Go&quot;, &quot;TV Streaming&quot;).
            </p>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <Label className="text-xs mb-1 block">Nombre del servicio</Label>
                <Input
                  value={tvLabelInput}
                  onChange={(e) => setTvLabelInput(e.target.value)}
                  placeholder="TV"
                  className="h-11 rounded-lg"
                />
              </div>
              <Button
                onClick={handleSaveTvLabel}
                disabled={savingLabel || tvLabelInput === tvLabel}
                className="h-11 rounded-lg"
              >
                <Save size={16} className="mr-2" />
                Guardar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Add plan */}
        <div className="flex justify-end">
          <Button onClick={() => setShowForm(!showForm)} variant={showForm ? "outline" : "default"} className="rounded-lg">
            {showForm ? <><X size={16} className="mr-2" /> Cancelar</> : <><Plus size={16} className="mr-2" /> Nuevo Plan</>}
          </Button>
        </div>

        {showForm && (
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wider text-zinc-500">Nuevo Plan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs mb-1 block">Nombre del Plan</Label>
                  <Input value={formNombre} onChange={(e) => setFormNombre(e.target.value)} placeholder="Ej: 400MB" className="h-11 rounded-lg" />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Tipo</Label>
                  <Select value={formTipo} onValueChange={setFormTipo}>
                    <SelectTrigger className="w-full h-11 rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Domiciliario">Domiciliario</SelectItem>
                      <SelectItem value="Empresarial">Empresarial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-3">
                  <Switch checked={formActivo} onCheckedChange={setFormActivo} />
                  <Label className="text-sm">Activo</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={formHasTv} onCheckedChange={setFormHasTv} />
                  <Label className="text-sm">Incluye {tvLabel}</Label>
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleAddPlan} disabled={savingPlan || !formNombre.trim()} className="rounded-lg">
                  <Save size={16} className="mr-2" />
                  {savingPlan ? "Guardando..." : "Crear Plan"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Plans table by type */}
        {[{ title: "Domiciliarios", data: domiciliarios }, { title: "Empresariales", data: empresariales }].map(({ title, data }) => (
          <Card key={title}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-zinc-500">
                <Tv size={16} /> Planes {title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No hay planes {title.toLowerCase()} configurados.</p>
              ) : (
                <div className="space-y-2">
                  {data.map((p: any) => (
                    <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-zinc-50/50 dark:bg-zinc-900/40">
                      {editId === p.id ? (
                        /* EDIT MODE */
                        <div className="flex-1 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Input value={editNombre} onChange={(e) => setEditNombre(e.target.value)} className="h-10 rounded-lg" />
                            <Select value={editTipo} onValueChange={setEditTipo}>
                              <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Domiciliario">Domiciliario</SelectItem>
                                <SelectItem value="Empresarial">Empresarial</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-2">
                              <Switch checked={editActivo} onCheckedChange={setEditActivo} />
                              <span className="text-sm">Activo</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch checked={editHasTv} onCheckedChange={setEditHasTv} />
                              <span className="text-sm">Incluye {tvLabel}</span>
                            </div>
                            <div className="flex gap-2 ml-auto">
                              <Button size="sm" onClick={() => handleUpdatePlan(p.id)} className="rounded-lg">
                                <Save size={14} className="mr-1" /> Guardar
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditId(null)} className="rounded-lg">
                                <X size={14} />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* VIEW MODE */
                        <>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm">{p.nombre}</span>
                              {p.has_tv && <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400 border-0 text-[11px]">+ {tvLabel}</Badge>}
                              {!p.activo && <Badge variant="outline" className="text-[11px] text-zinc-400">Inactivo</Badge>}
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => startEdit(p)}>
                              <Pencil size={14} />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20" onClick={() => handleDeletePlan(p.id)}>
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}

      </div>
    </PremiumPageLayout>
  )
}
