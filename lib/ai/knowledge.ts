
export const PROJECT_CONTEXT = `
NOMBRE DEL SISTEMA: Sistema de Gestión de Operaciones (SGO) - Telecomunicaciones

DESCRIPCIÓN GENERAL:
Este sistema es una plataforma integral para gestionar las operaciones de una empresa de telecomunicaciones que realiza instalaciones de fibra óptica, mantenimientos y gestión de flota vehicular.

MÓDULOS PRINCIPALES:

1.  **Técnicos (/tecnicos)**:
    -   Permite a los técnicos ver sus asignaciones de material (Bobinas, ONUs, etc.).
    -   Registrar reportes diarios de actividad (Instalaciones, Soportes).
    -   Consultar su inventario actual (Cierre de día).

2.  **Taller y Mantenimiento (/taller)**:
    -   Gestión de la flota de vehículos.
    -   Registro de mantenimientos preventivos (cambio de aceite, frenos) y correctivos (fallas).
    -   Control de kilometraje.

3.  **Control de Operaciones (/control)**:
    -   Supervisión de combustible (Cargas de gasolina/diesel).
    -   Gestión de Bobinas (Spools): Asignación y retorno de material de fibra.
    -   Auditoría de inventario.

4.  **Almacén (/almacen)**:
    -   Control de stock de productos (Routers, ONUs, Cables, Herramientas).
    -   Asignación de material a técnicos.

5.  **Administración (/admin)**:
    -   Gestión de usuarios y permisos (Roles: Admin, Técnico, Taller, Almacén).
    -   Base de datos y auditoría del sistema.

ROLES DE USUARIO:
-   **Técnico**: Solo ve su propio inventario y reportes.
-   **Admin**: Acceso total.
-   **Taller**: Acceso a vehículos y mantenimientos.
-   **Almacén**: Acceso a inventario y despachos.
`

export const DB_SCHEMA = `
TABLAS PRINCIPALES (SUPABASE - POSTGRESQL):

1.  **clientes**:
    -   id (uuid), nombre, cedula (unique), direccion, plan, estatus (activo/inactivo), created_at.
    
2.  **soportes** (Reportes de actividad de técnicos):
    -   id, cliente_id, tecnico_id (fk profiles), tipo (instalacion/soporte/reparacion), 
    -   materiales usados: metraje_usado, conectores, rosetas, patchcord, onu_nueva.
    -   estatus (Realizado, Pendiente).
    -   observacion, coordenadas.

3.  **inventory_products** (Catálogo de Productos):
    -   id, sku (código único), name (nombre), current_stock (cantidad actual), category.
    -   Ejemplos SKU: 'I002' (Bobina), 'CONV' (Conector), 'ONU-HUAWEI'.

4.  **inventory_assignments** (Asignaciones de material a técnicos):
    -   id, assigned_to (tecnico_id), status (ACTIVE, RETURNED), created_at.
    -   Items relacionados en tabla 'inventory_assignment_items'.

5.  **vehiculos**:
    -   id, codigo (ej: V-01), placa, modelo, tipo_combustible.
    -   last_oil_change_km (último km cambio aceite).

6.  **fuel_logs** (Cargas de Combustible):
    -   id, vehicle_id, liters (litros), mileage (kilometraje al cargar), fuel_date, driver_name.

7.  **technician_daily_reports** (Cierre diario del técnico):
    -   user_id, date, vehiculo_id, conectores_usados, cables_usados, etc.

NOTAS TÉCNICAS:
-   Usa "snake_case" para nombres de columnas.
-   Las fechas suelen estar en ISO (timestamptz) o YYYY-MM-DD.
-   Para consultas de usuario actual, usa 'auth.uid()'.
`
