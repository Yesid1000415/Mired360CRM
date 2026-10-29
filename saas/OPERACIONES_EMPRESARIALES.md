# MIRED360 CRM Empresas — Operación modular

Actualizado: 29 de octubre de 2026

## Funciones conectadas a la base de datos

- **CRM:** prospectos, seguimiento, ventas, exportación CSV y propietarios / asesores.
- **Sucursales:** una sucursal principal automática por empresa; creación de más sedes; asignación de colaboradores por propietario mediante RPC verificada; sucursal asociada a cada prospecto.
- **Equipo y supervisión:** listado autorizado con correo de los miembros, rol, sucursal; reportes por asesor (prospectos, ventas, instalados, ingreso mensual estimado) y por sucursal.
- **Campañas:** creación por propietario o administrador, canal, sucursal, presupuesto, estado activo/pausado y asociación de prospectos; conteo real de resultados.
- **Llamadas:** bitácora manual, cliente, agente, resultado, fecha, notas y próximo contacto. **No realiza ni recibe llamadas telefónicas automáticamente** y no está conectada con una central SIP/PBX.
- **Módulos:** habilitación / deshabilitación individual por empresa desde el panel interno `crm-admin-saas.html`, con validación de administrador de plataforma en SQL.

## Seguridad
- Tablas `saas_sucursales`, `saas_modulos`, `saas_campanas`, `saas_llamadas` con RLS.
- Clientes, campañas y llamadas visibles según empresa y sucursal; propietario/administrador de empresa pueden supervisar toda la empresa.
- El asesor no puede crear prospectos en otra sucursal, modificar prospectos ajenos ni cambiar su propia asignación.
- Asignaciones por RPC y registro de módulos por administrador de plataforma, no por el navegador.
- Se mantiene el CRM original separado; no se migraron ni alteraron las tablas de producción históricas.
- Migraciones SQL `migracion_04`, `05` y `06`, aplicadas a Supabase. Pruebas SQL transaccionales de propietario, asesor, sucursal y módulos, revertidas sin datos de prueba persistidos.

## Alcance comercial
- La **prueba gratuita de 14 días es una modalidad comercial para el cliente** y permite trabajar con funciones reales durante su vigencia, no una maqueta.
- No se ha instalado cobro automático. Las activaciones de plan siguen siendo manuales y supervisadas por el administrador de plataforma.
- Para dar por concluido el lanzamiento comercial público todavía hay que validar el recorrido completo en navegador para estos nuevos módulos, conectar los correos transaccionales SMTP, completar la revisión de seguridad de funciones históricas en el proyecto Supabase compartido y definir condiciones/planes.
- Integración a central telefónica, telefonía IP, marcación automatizada, campañas de mensajes WhatsApp y otras funciones históricas del CRM principal **no forman parte de esta ampliación**; requieren su propia adaptación multiempresa y conexión con servicios externos.
