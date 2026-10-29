# MIRED360 CRM EMPRESAS — Primera prueba piloto

**Fecha:** 29 de octubre de 2026  
**Estado:** Listo para comenzar pruebas controladas, no para cobrar suscripciones al público.

## 0. Configuración necesaria en Supabase Auth
Proyecto: `lpiusomsuswdcraoozdn`.

Abre: https://supabase.com/dashboard/project/lpiusomsuswdcraoozdn/auth/url-configuration

En **Redirect URLs**, agrega o verifica:
- `https://yesid1000415.github.io/Mired360CRM/crm-empresas.html` (confirmación normal y recuperación).
- `https://yesid1000415.github.io/Mired360CRM/crm-empresas.html*` (confirmaciones de usuarios invitados con parámetro `invitacion`).

**No sustituyas el Site URL de la instalación original si otros módulos todavía lo usan.** Revisa también que la plantilla del correo de confirmación respete `RedirectTo` y que se esté enviando correctamente. Los ajustes de Authentication no están expuestos en las herramientas disponibles; deben verificarse en el panel del proyecto.

Documentación: https://supabase.com/docs/guides/auth/redirect-urls

## 1. Crear empresa de prueba
1. Abrir https://yesid1000415.github.io/Mired360CRM/crm-empresas.html
2. Ingresar con un correo propio existente y su contraseña o crear uno nuevo, confirmar el email y aceptar políticas.
3. Crear una empresa llamada **MIRED360 PILOTO**.
4. Confirmar que el panel aparece con cifras iniciales cero y la prueba de 14 días activa.

## 2. Probar prospectos y ventas
1. Seleccionar `Nuevo prospecto`.
2. Crear un contacto ficticio llamado `Cliente Piloto 01` (no usar un teléfono real).
3. Marcar la declaración requerida de autorización; para una demostración, los datos deben ser completamente inventados.
4. Comprobar que el contacto aparece en el listado y en los indicadores.
5. Editar el estado a `Seguimiento`, asignar una fecha, guardar y revisar `Seguimientos`.
6. Cambiar a `Venta`, guardar y revisar `Ventas`.
7. Exportar el CSV y comprobar que solo contiene los contactos de la empresa.

## 3. Probar colaboradores
1. Desde la cuenta propietaria, abrir `Equipo y accesos`.
2. Crear una invitación para una **segunda dirección real de correo propia** (distinta de la primera), rol `asesor`.
3. Copiar el enlace de invitación y abrirlo desde un navegador o perfil diferente.
4. Si el segundo usuario es nuevo, registrarlo y confirmar el correo. La URL de confirmación conserva el código de invitación solo si está permitido el patrón de Redirect URL en Supabase.
5. Comprobar que aparece dentro de la empresa MIRED360 PILOTO; no debe poder acceder al panel de suscripciones de MIRED360.
6. Registrar un prospecto ficticio desde esa cuenta y comprobar que el propietario lo ve.

## 4. Probar aislamiento de datos
Crear un segundo negocio desde una cuenta que no pertenezca al primero, sin invitarla.
La empresa B **no debe poder consultar ni modificar los prospectos de A**. La prueba SQL de RLS ya resultó correcta, pero también hay que comprobarlo en el navegador.

## 5. Probar administración comercial
Ingresar con la cuenta administradora autorizada a:
https://yesid1000415.github.io/Mired360CRM/crm-admin-saas.html

Debe ser posible ver las empresas y el estado de prueba. La activación manual se probará solo con una empresa ficticia, referencia de prueba explícita y sin afirmar haber recibido dinero. Una cuenta normal debe recibir error de permisos.

## 6. Qué se comprobó automáticamente
- SQL: empresa A no puede leer ni editar prospectos de B.
- SQL: invitaciones de un solo uso con correo confirmado.
- SQL: una cuenta ajena no puede consultar RPC de administración.
- SQL: prueba o plan vencido no permite escritura, pero activo sí.
- SQL: se requiere declaración de autorización para insertar un prospecto.
- JS: análisis de sintaxis del archivo principal `saas/empresas.js`.

Todas las pruebas SQL temporales se deshicieron al terminar. **No se ha ejecutado una prueba completa con navegación y correo real**.

## 7. Bloqueantes para venta general
- Configurar y probar SMTP y Redirect URLs.
- Completar revisión de seguridad de funciones privilegiadas existentes en el Supabase compartido.
- Revisar política de privacidad/contrato SaaS definitivo con los datos legales del prestador.
- Definir precios, número máximo de usuarios por plan y mecanismo de facturación.
- Verificar en dispositivo móvil y computador, copias de seguridad y recuperación de datos.
