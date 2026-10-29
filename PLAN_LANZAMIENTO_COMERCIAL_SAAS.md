# MIRED360 CRM · Preparación para comercialización

**Actualizado:** 29 de octubre de 2026  
**Estado:** Diseño corporativo operativo para revisión y demostración comercial disponible. **No es aún un SaaS multiempresa listo para contratar.**

## Avances implementados
- La entrada principal `index.html` usa el diseño corporativo y conserva sus procesos de CRM.
- 21 pantallas auxiliares incorporan una barra corporativa con acceso al panel principal, estilo visual unificado y diseño adaptable.
- El panel principal permite menú lateral y móvil, buscador de módulos, accesos rápidos y pantalla completa cuando el navegador lo permite.
- La demostración pública `demo-crm.html` usa únicamente registros inventados; **no incluye cliente de Supabase** y no consulta ni modifica el CRM operativo.
- El enlace a la demostración está disponible desde la página de inicio de sesión.
- Se conservó `crm-corporativo.html` como referencia de la primera versión aprobada.

## Bloqueantes antes de vender cuentas multiempresa

### 1. Aislamiento de datos por empresa (imprescindible)
La política actual de `prospectos` permite consultar filas por `user_id = auth.uid()`. Protege al usuario en esa tabla, pero no permite gestionar una **organización con varios colaboradores** ni garantiza aislamiento empresarial transversal en los demás módulos.

Diseñar y probar **organizaciones**, **miembros de organización**, **roles** y **empresa_id** en todas las tablas comerciales. No activar cuentas externas sobre el mismo proyecto sin ese aislamiento. Los coordinadores deben gestionar únicamente su propia organización. **No sustituir** las políticas de acceso vigentes hasta tener pruebas de migración y reversión.

### 2. Revisión de funciones privilegiadas
La revisión del proyecto Supabase `MIRED360CRN` encontró alertas del asesor de seguridad sobre funciones `SECURITY DEFINER` accesibles por `anon` y por usuarios autenticados. Algunas pueden ser públicas de forma intencionada, como procesos de autorización con token; otras requieren revisar permisos y validación del llamador.

Antes del lanzamiento:
- Clasificar cada función entre pública y restringida.
- Revocar `EXECUTE` a roles que no deban llamarla y restringir permisos al mínimo, después de revisar impactos.
- Auditar funciones de coordinación, asignación de bases, extensiones, cobros y firmas.
- Ejecutar el asesor de seguridad nuevamente y revisar los hallazgos.

Referencia: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable

### 3. Registro y administración de clientes
Diseñar alta de empresa, invitación de empleados, recuperación de acceso, roles de propietario/coordinador/asesor y desactivación de cuentas; registrar auditoría de cambios sensibles.

### 4. Facturación y planes
Definir planes y límites de usuarios/funcionalidades, contratación, pago, estados de suscripción, comprobantes, suspensión y reactivación. Separar las herramientas específicas de telecomunicaciones de un CRM genérico para otras industrias.

### 5. Confiabilidad y privacidad
Política de tratamiento de datos personales, autorización de contacto, acceso por roles, exportación, eliminación, respaldos, monitoreo, registros de errores y respuesta ante incidentes.

### 6. Pruebas antes del lanzamiento
1. Abrir el CRM en computador y smartphone, incluyendo 360px, 390px y 1366px.
2. Validar ingreso, cierre de sesión, nuevo prospecto, seguimiento, venta, comisiones y sus módulos asociados.
3. Registrar dos empresas ficticias de prueba A y B. A no puede leer, editar ni listar nada de B; B tampoco A. Verificar esto en la base de datos mediante RLS, no solo ocultando botones.
4. Confirmar que los roles no puedan escalar privilegios ni tomar control de asesores de otras empresas.
5. Revisar la demo pública sin una sesión: no debe conectar a Supabase ni exponer registros comerciales reales.
6. Revisar despliegues, errores en navegador, rendimiento y accesibilidad.

## Orden recomendado
**Primera etapa — realizada:** estética corporativa y demo pública con datos ficticios.

**Segunda etapa — pendiente:** aislamiento multiempresa y revisión de seguridad en un entorno de pruebas, con respaldo y migración comprobada.

**Tercera etapa — pendiente:** administración de organizaciones, planes de pago, contratos y soporte.

**Cuarta etapa — pendiente:** piloto con una empresa de confianza usando datos propios, pruebas de funcionamiento y posterior apertura comercial.

## Enlaces
- CRM corporativo operativo: https://yesid1000415.github.io/Mired360CRM/
- Demostración pública: https://yesid1000415.github.io/Mired360CRM/demo-crm.html
- Vista corporativa de referencia: https://yesid1000415.github.io/Mired360CRM/crm-corporativo.html

**Regla de lanzamiento:** se puede mostrar públicamente la demo; **no ofrecer cuentas de clientes externos en el CRM operativo** hasta aprobar las pruebas multiempresa y seguridad.
