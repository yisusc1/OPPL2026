"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { UserCog, Mail, Calendar, Settings2, Building2, Briefcase, User as UserIcon, ArrowLeft, Pencil, Shield, LogIn } from "lucide-react"
import Link from "next/link"
import { updateProfileDetails, impersonateUserAction, createUserAction } from "./user-actions"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { DEPARTMENTS, JOB_TITLES_BY_DEPARTMENT } from "@/lib/constants"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { PremiumPageLayout } from "@/components/ui/premium-page-layout"
import { PremiumCard } from "@/components/ui/premium-card"
import { PremiumContent } from "@/components/ui/premium-content"

type Profile = {
    id: string
    email: string
    roles: string[]
    created_at: string
    first_name?: string
    last_name?: string
    department?: string
    job_title?: string
}

// Grouped roles for UI
const ROLE_GROUPS = [
    {
        title: "Sistema y Acceso",
        roles: ["admin", "invitado"]
    },
    {
        title: "Operaciones de Campo",
        roles: ["tecnico", "chofer", "supervisor"]
    },
    {
        title: "Módulos Operativos",
        roles: ["transporte", "taller", "almacen", "mecánico"]
    },
    {
        title: "Control y Auditoría",
        roles: ["auditoria", "combustible"]
    },
    {
        title: "Visualización y Gerencia",
        roles: ["dashboard", "mapa", "procesador", "gerencia"]
    }
]

export default function AdminUsersPage() {
    const [profiles, setProfiles] = useState<Profile[]>([])
    const [loading, setLoading] = useState(true)

    // Edit Details State
    const [editingUser, setEditingUser] = useState<Profile | null>(null)
    const [editForm, setEditForm] = useState({ department: "", job_title: "" })
    const [saving, setSaving] = useState(false)

    // Permissions State
    const [permissionsUser, setPermissionsUser] = useState<Profile | null>(null)

    // Create User State
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [createForm, setCreateForm] = useState({
        email: "",
        password: "",
        firstName: "",
        lastName: "",
        role: "tecnico"
    })
    const [creating, setCreating] = useState(false)

    useEffect(() => {
        loadProfiles()
    }, [])

    const loadProfiles = async () => {
        try {
            const supabase = createClient()
            const { data, error } = await supabase
                .from("profiles")
                .select("*")
                .order("created_at", { ascending: false })

            if (error) throw error
            setProfiles(data || [])
        } catch (error) {
            console.error("Error loading profiles:", error)
            toast.error("Error al cargar usuarios")
        } finally {
            setLoading(false)
        }
    }

    const startEditing = (profile: Profile) => {
        setEditingUser(profile)
        setEditForm({
            department: profile.department || "",
            job_title: profile.job_title || ""
        })
    }

    const handleSaveDetails = async () => {
        if (!editingUser) return
        setSaving(true)
        const result = await updateProfileDetails(editingUser.id, editForm.department, editForm.job_title)
        setSaving(false)

        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success("Datos actualizados")
            setEditingUser(null)
            loadProfiles() // Reload to show changes
        }
    }

    const handleRoleToggle = async (userId: string, currentRoles: string[], roleToToggle: string) => {
        try {
            const supabase = createClient()

            // Calculate new roles
            let newRoles: string[]
            if (currentRoles.includes(roleToToggle)) {
                newRoles = currentRoles.filter(r => r !== roleToToggle)
            } else {
                newRoles = [...currentRoles, roleToToggle]
            }

            const { error } = await supabase
                .from("profiles")
                .update({ roles: newRoles })
                .eq("id", userId)

            if (error) throw error

            // Update local state immediately for responsiveness
            const updatedProfiles = profiles.map(p => (p.id === userId ? { ...p, roles: newRoles } : p))
            setProfiles(updatedProfiles)

            // Also update the permission user state so the UI reflects changes instantly
            if (permissionsUser?.id === userId) {
                setPermissionsUser({ ...permissionsUser, roles: newRoles })
            }

            toast.success("Permiso actualizado")
        } catch (error) {
            console.error("Error updating roles:", error)
            toast.error("Error al actualizar permisos")
        }
    }



    const handleImpersonate = async (email: string) => {
        if (!confirm("⚠️ ¿Iniciar sesión como este usuario?\n\nTu sesión de Administrador actual se cerrará.\nDeberás volver a iniciar sesión para regresar al admin.")) return

        toast.loading("Generando acceso seguro...")
        const result = await impersonateUserAction(email)

        if (result.success && result.url) {
            window.location.href = result.url
        } else {
            toast.dismiss()
            toast.error(result.error || "Error desconocido")
        }
    }

    const getRoleBadgeColor = (role: string) => {
        if (role === "admin") return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50"
        if (["tecnico", "chofer", "supervisor"].includes(role)) return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
        if (["auditoria", "combustible"].includes(role)) return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
        return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
    }

    const handleCreateUser = async () => {
        if (!createForm.email || !createForm.password || !createForm.firstName) {
            toast.error("Complete los campos obligatorios")
            return
        }

        setCreating(true)
        const result = await createUserAction({
            email: createForm.email,
            password: createForm.password,
            firstName: createForm.firstName,
            lastName: createForm.lastName,
            role: createForm.role
        })
        setCreating(false)

        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success("Usuario creado exitosamente")
            setIsCreateOpen(false)
            setCreateForm({ email: "", password: "", firstName: "", lastName: "", role: "tecnico" }) // Reset
            loadProfiles()
        }
    }

    return (
        <PremiumPageLayout>
            <PremiumContent>
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-zinc-900/10 dark:bg-white/10 rounded-xl shadow-lg shadow-zinc-900/5 backdrop-blur-sm border border-zinc-900/10 dark:border-white/10">
                            <UserCog className="text-zinc-900 dark:text-white" size={24} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">Gestión de Usuarios</h1>
                            <p className="text-zinc-500 dark:text-zinc-400">Administra los permisos y roles del personal</p>
                        </div>
                    </div>
                    <Button
                        onClick={() => setIsCreateOpen(true)}
                        className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-xl"
                    >
                        + Nuevo Usuario
                    </Button>
                </div>

                <PremiumCard className="overflow-hidden p-0">
                    <div className="p-6 border-b border-zinc-100 dark:border-white/10 bg-zinc-50/50 dark:bg-zinc-950/50">
                        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Usuarios Registrados</h2>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">Lista completa de empleados registrados en el sistema</p>
                    </div>
                    <div className="p-0">
                        <Table>
                            <TableHeader className="bg-zinc-50 dark:bg-zinc-900/50">
                                <TableRow className="hover:bg-transparent border-zinc-100 dark:border-white/10">
                                    <TableHead className="pl-6 text-zinc-500 dark:text-zinc-400">Empleado</TableHead>
                                    <TableHead className="text-zinc-500 dark:text-zinc-400">Datos Laborales</TableHead>
                                    <TableHead className="text-zinc-500 dark:text-zinc-400">Roles Asignados</TableHead>
                                    <TableHead className="text-zinc-500 dark:text-zinc-400">Fecha Registro</TableHead>
                                    <TableHead className="text-right pr-6 text-zinc-500 dark:text-zinc-400">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center h-32 text-zinc-500 dark:text-zinc-400">
                                            Cargando usuarios...
                                        </TableCell>
                                    </TableRow>
                                ) : profiles.map((profile) => {
                                    const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ");
                                    return (
                                        <TableRow key={profile.id} className="hover:bg-zinc-50/50 dark:hover:bg-white/5 transition-colors border-zinc-100 dark:border-white/5">
                                            <TableCell className="pl-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center border border-zinc-200 dark:border-zinc-700 shrink-0">
                                                        <UserIcon size={18} className="text-zinc-500 dark:text-zinc-400" />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                                            {fullName || "Sin nombre"}
                                                        </span>
                                                        <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                                                            <Mail size={12} />
                                                            {profile.email}
                                                        </div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                                                        <Briefcase size={14} className="text-zinc-400 dark:text-zinc-500" />
                                                        <span>{profile.job_title || "Sin Cargo"}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-500">
                                                        <Building2 size={12} />
                                                        {profile.department || "Sin Dpto."}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-2 max-w-[200px]">
                                                    {(profile.roles || []).slice(0, 3).map((role) => (
                                                        <Badge key={role} variant="secondary" className={`capitalize px-2 py-0.5 text-xs font-normal border-transparent ${getRoleBadgeColor(role)}`}>
                                                            {role}
                                                        </Badge>
                                                    ))}
                                                    {(profile.roles || []).length > 3 && (
                                                        <Badge variant="outline" className="px-1.5 text-[10px] text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700">
                                                            +{profile.roles.length - 3}
                                                        </Badge>
                                                    )}
                                                    {(!profile.roles || profile.roles.length === 0) && (
                                                        <span className="text-zinc-400 dark:text-zinc-600 text-xs italic">Sin roles</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-sm">
                                                    <Calendar size={14} />
                                                    {new Date(profile.created_at).toLocaleDateString()}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => startEditing(profile)}
                                                        className="h-8 w-8 p-0 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                                                        title="Editar Datos"
                                                    >
                                                        <Pencil size={16} />
                                                    </Button>

                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:text-violet-600 dark:hover:text-violet-400"
                                                        title="Iniciar Sesión como..."
                                                        onClick={() => handleImpersonate(profile.email)}
                                                    >
                                                        <LogIn size={16} />
                                                    </Button>

                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="gap-2 h-8 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                                                        onClick={() => setPermissionsUser(profile)}
                                                    >
                                                        <Shield size={14} className="text-zinc-500 dark:text-zinc-400" />
                                                        <span className="hidden sm:inline">Permisos</span>
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </PremiumCard>

                {/* EDIT DETAILS DIALOG */}
                <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
                    <DialogContent className="sm:max-w-md bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                        <DialogHeader>
                            <DialogTitle className="text-zinc-900 dark:text-white">Editar Datos Laborales</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label className="text-zinc-900 dark:text-zinc-100">Departamento</Label>
                                <Select
                                    value={editForm.department}
                                    onValueChange={(value) => setEditForm({ department: value, job_title: "" })}
                                >
                                    <SelectTrigger className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white">
                                        <SelectValue placeholder="Seleccionar Departamento" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                                        {DEPARTMENTS.map((dept) => (
                                            <SelectItem key={dept} value={dept} className="text-zinc-900 dark:text-white focus:bg-zinc-100 dark:focus:bg-zinc-800 cursor-pointer">
                                                {dept}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-zinc-900 dark:text-zinc-100">Cargo / Título</Label>
                                <Select
                                    value={editForm.job_title}
                                    onValueChange={(value) => setEditForm({ ...editForm, job_title: value })}
                                    disabled={!editForm.department}
                                >
                                    <SelectTrigger className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white">
                                        <SelectValue placeholder="Seleccionar Cargo" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                                        {editForm.department && JOB_TITLES_BY_DEPARTMENT[editForm.department]?.map((title) => (
                                            <SelectItem key={title} value={title} className="text-zinc-900 dark:text-white focus:bg-zinc-100 dark:focus:bg-zinc-800 cursor-pointer">
                                                {title}
                                            </SelectItem>
                                        ))}
                                        {!editForm.department && (
                                            <SelectItem value="placeholder" disabled>Primero selecciona un dpto.</SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setEditingUser(null)} className="border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800">Cancelar</Button>
                            <Button onClick={handleSaveDetails} disabled={saving} className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200">
                                {saving ? "Guardando..." : "Guardar Cambios"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* PERMISSIONS MANAGER DIALOG */}
                <Dialog open={!!permissionsUser} onOpenChange={(open) => !open && setPermissionsUser(null)}>
                    <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                        <DialogHeader>
                            <DialogTitle className="text-zinc-900 dark:text-white">Gestionar Permisos de Acceso</DialogTitle>
                            <DialogDescription className="text-zinc-500 dark:text-zinc-400">
                                Asigna roles manuales para conceder acceso a paneles específicos.
                                El usuario: <span className="font-semibold text-zinc-900 dark:text-zinc-200">{permissionsUser?.email}</span>
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 py-4">
                            {ROLE_GROUPS.map((group) => (
                                <div key={group.title} className="space-y-3">
                                    <h4 className="font-medium text-sm text-zinc-500 dark:text-zinc-400 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 pb-1">
                                        {group.title}
                                    </h4>
                                    <div className="space-y-2">
                                        {group.roles.map((role) => {
                                            const isChecked = (permissionsUser?.roles || []).includes(role)
                                            return (
                                                <div key={role} className="flex items-center space-x-2 p-2 hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded-lg transition-colors border border-transparent hover:border-zinc-100 dark:hover:border-zinc-800">
                                                    <Checkbox
                                                        id={`perm-${role}`}
                                                        checked={isChecked}
                                                        onCheckedChange={() => permissionsUser && handleRoleToggle(permissionsUser.id, permissionsUser.roles || [], role)}
                                                        className="border-zinc-300 dark:border-zinc-600 data-[state=checked]:bg-zinc-900 dark:data-[state=checked]:bg-white data-[state=checked]:text-white dark:data-[state=checked]:text-zinc-900"
                                                    />
                                                    <Label
                                                        htmlFor={`perm-${role}`}
                                                        className="text-sm font-medium leading-none cursor-pointer flex-1 capitalize text-zinc-700 dark:text-zinc-300"
                                                    >
                                                        {role}
                                                    </Label>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <DialogFooter>
                            <Button onClick={() => setPermissionsUser(null)} className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200">
                                Listo, Cerrar
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
                {/* CREATE USER DIALOG */}
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogContent className="sm:max-w-md bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                        <DialogHeader>
                            <DialogTitle className="text-zinc-900 dark:text-white">Crear Nuevo Usuario</DialogTitle>
                            <DialogDescription className="text-zinc-500 dark:text-zinc-400">
                                Crea una cuenta con contraseña definida manualmente.
                                El usuario podrá iniciar sesión inmediatamente.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-2">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-zinc-900 dark:text-zinc-100">Nombre</Label>
                                    <Input
                                        value={createForm.firstName}
                                        onChange={e => setCreateForm({ ...createForm, firstName: e.target.value })}
                                        placeholder="Ej: Juan"
                                        className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-zinc-900 dark:text-zinc-100">Apellido</Label>
                                    <Input
                                        value={createForm.lastName}
                                        onChange={e => setCreateForm({ ...createForm, lastName: e.target.value })}
                                        placeholder="Ej: Pérez"
                                        className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-zinc-900 dark:text-zinc-100">Correo Electrónico</Label>
                                <Input
                                    type="email"
                                    value={createForm.email}
                                    onChange={e => setCreateForm({ ...createForm, email: e.target.value })}
                                    placeholder="usuario@empresa.com"
                                    className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-zinc-900 dark:text-zinc-100">Contraseña Inicial</Label>
                                <Input
                                    type="text"
                                    value={createForm.password}
                                    onChange={e => setCreateForm({ ...createForm, password: e.target.value })}
                                    placeholder="Clave segura..."
                                    className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400"
                                />
                                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Mínimo 6 caracteres.</p>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-zinc-900 dark:text-zinc-100">Rol Inicial</Label>
                                <Select
                                    value={createForm.role}
                                    onValueChange={v => setCreateForm({ ...createForm, role: v })}
                                >
                                    <SelectTrigger className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white">
                                        <SelectValue placeholder="Seleccionar Rol" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                                        <SelectItem value="tecnico" className="focus:bg-zinc-100 dark:focus:bg-zinc-800 cursor-pointer">Técnico</SelectItem>
                                        <SelectItem value="admin" className="focus:bg-zinc-100 dark:focus:bg-zinc-800 cursor-pointer">Administrador</SelectItem>
                                        <SelectItem value="supervisor" className="focus:bg-zinc-100 dark:focus:bg-zinc-800 cursor-pointer">Supervisor</SelectItem>
                                        <SelectItem value="chofer" className="focus:bg-zinc-100 dark:focus:bg-zinc-800 cursor-pointer">Chofer</SelectItem>
                                        <SelectItem value="invitado" className="focus:bg-zinc-100 dark:focus:bg-zinc-800 cursor-pointer">Invitado</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800">Cancelar</Button>
                            <Button onClick={handleCreateUser} disabled={creating} className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200">
                                {creating ? "Creando..." : "Crear Cuenta"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </PremiumContent>
        </PremiumPageLayout>
    )
}

