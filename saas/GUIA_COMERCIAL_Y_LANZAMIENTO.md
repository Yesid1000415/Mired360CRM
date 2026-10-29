# MIRED360 CRM EMPRESAS — Operación comercial y lanzamiento

**Fecha:** 29 de octubre de 2026  
**Estado:** Piloto técnico multiempresa; aún no declarar lanzamiento comercial general.

## Direcciones
- Presentación de venta de la marca: https://mired360servicios.com/crm.html
- Presentación alternativa: https://yesid1000415.github.io/Mired360CRM/crm-planes.html
- Demostración (datos ficticios): https://yesid1000415.github.io/Mired360CRM/demo-crm.html
- Plataforma multiempresa: https://yesid1000415.github.io/Mired360CRM/crm-empresas.html
- Administración privada de suscripciones: https://yesid1000415.github.io/Mired360CRM/crm-admin-saas.html
- Aviso de privacidad/uso piloto: https://yesid1000415.github.io/Mired360CRM/crm-politicas.html
- CRM de telecomunicaciones original (NO ofrecer acceso a nuevos clientes): https://yesid1000415.github.io/Mired360CRM/

## Flujo de prospecto a suscriptor
1. Mostrar la página comercial o la demostración (no contiene datos reales).
2. Acordar con el comprador alcance, precio COP, número de usuarios, apoyo técnico, impuestos y fecha de inicio. Los importes comerciales aún no están definidos; **no cotizar cifras inventadas**.
3. La empresa crea su cuenta, acepta el aviso de uso piloto, confirma su correo e inicia su prueba de 14 días.
4. Propietario invita administradores o asesores. Cada invitación tiene 7 días y exige coincidencia del correo verificado.
5. Antes de registrar cada contacto, el usuario declara disponer de autorización o base legal aplicable y debe conservar su evidencia.
6. Se acuerdan condiciones contractuales y pago por el canal comercial. **Los cobros no son automáticos**.
7. Un administrador autorizado de MIRED360 registra la referencia comprobada y activa el plan desde el panel privado.
8. El CRM bloquea la creación/edición de prospectos cuando expira o se suspende la suscripción; la consulta y exportación continúan disponibles para el titular.

## Administrador de suscripciones
La única cuenta administradora inicial está asociada al correo verificado `ventas@mired360servicios.com`. No se guardan contraseñas en el repositorio.

En el panel privado: ver empresas, usuarios registrados, número de prospectos, vigencia, registrar activación/referencia y consultar/exportar historial de movimientos. La activación requiere confirmar fuera de la plataforma que el pago realmente existe o que la cortesía está autorizada.

## Separación de datos
Se añadieron las tablas `saas_organizaciones`, `saas_miembros`, `saas_prospectos`, `saas_actividades`, `saas_invitaciones`, `saas_activaciones`, `saas_administradores_plataforma` y `saas_aceptaciones`; no sustituyen las tablas heredadas.

RLS protege los datos por empresa. Las invitaciones se validan por correo confirmado y token de un solo uso. El estado y duración del plan solo pueden modificarse mediante funciones restringidas a la cuenta administradora. La base registra la aceptación de condiciones y exige una declaración de autorización de los contactos.

Pruebas SQL en transacciones descartadas: separación entre dos empresas, rechazo a modificación de datos de otra empresa, invitación válida a un colaborador, rechazo a administrador no autorizado, creación de contacto con y sin declaración de autorización.

## Pendientes antes de comercialización general
- Ejecutar prueba real de extremo a extremo en navegador y smartphone: registro, verificación de correo, inicio de sesión, creación de empresa, alta de contacto, invitación, recepción y aceptación, activación, vencimiento y exportación.
- Configurar URLs de redirección permitidas en Supabase Auth para `crm-empresas.html`, habilitar servicio SMTP propio y revisar protección de contraseñas filtradas.
- Resolver advertencias de funciones privilegiadas en el proyecto Supabase compartido con el CRM original, o migrar a un proyecto independiente. **No anunciar aislamiento total del backend compartido sin la auditoría correspondiente.**
- Registrar y validar datos legales completos del prestador: razón social registrada o persona natural, NIT/RUT, facturación, dirección de notificaciones y responsables del tratamiento de datos. Los documentos públicos actualmente son informativos para piloto; revisar y firmar acuerdo de tratamiento de datos (responsable/encargado) y contrato SaaS.
- Definir tarifas de Esencial, Equipo y Empresa, límites de colaboradores, SLA, términos de soporte y políticas de devolución/cancelación. Hasta entonces los botones dicen Cotizar.
- Definir procedimiento de respaldo, restauración probada, eliminación de información al cancelar y manejo de incidentes.
- Confirmar habilitación de facturación electrónica según el régimen tributario del vendedor.

## Referencias técnicas
- `saas/migracion_01_multiempresa.sql`: organizaciones, miembros, contactos, RLS e invitaciones.
- `saas/migracion_02_suscripciones.sql`: administradores, vigencia, registro de pagos y activaciones.
- `saas/migracion_03_aceptaciones.sql`: aceptación y declaración de autorización.
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://sedeelectronica.sic.gov.co/publicaciones/boletin-juridico/concepto/politicas-de-tratamiento-de-datos-personales

**Criterio de salida:** no habilitar cobros recurrentes ni anunciar disponibilidad general hasta cerrar los pendientes y probar el flujo completo con cuentas de prueba controladas.
