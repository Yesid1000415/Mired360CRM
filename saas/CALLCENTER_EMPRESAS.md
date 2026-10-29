# MIRED360 CRM Empresas — Call Center operativo

Actualización: 29 de octubre de 2026

## Funciones disponibles
- Crear bases separadas por empresa y sucursal, con declaración de fundamento válido para tratar contactos.
- Cargar CSV, TSV o TXT con nombre y teléfono obligatorios; ciudad y observaciones opcionales. Hasta 2.000 contactos nuevos por archivo, límite de archivo 2 MB, validación básica y filtro de repetidos.
- La importación de cada archivo es **atómica**: o se guarda correctamente el lote, o se revierte; otros archivos simultáneos no duplican números. Los celulares de Colombia se comparan también con y sin prefijo +57.
- Configurar identificadores de extensión (2–8 dígitos), responsable y meta mensual.
- Asignar bases a asesores en la misma sucursal; propietario/administrador supervisa las bases autorizadas y asesores solo ven las bases asignadas.
- Buscar contactos, clasificar estados, registrar notas y próxima llamada, mantener historial de gestiones y observar ventas del mes por la **extensión que tenía la base al registrar cada llamada**, no por el asesor asignado después.
- Abrir el marcador nativo del dispositivo con `tel:` cuando esté disponible.
- Pausar o reactivar una base.
- Convertir una gestión marcada como Venta en un prospecto con estado Venta dentro del CRM, con producto y valor, bloqueando duplicados del mismo contacto.
- Activar/desactivar el módulo «llamadas» por empresa desde el panel SaaS administrador.

## Datos y seguridad
Tablas nuevas: `saas_cc_extensiones`, `saas_cc_bases`, `saas_cc_contactos` y `saas_cc_gestiones`, todas con RLS. Funciones RPC protegidas: `saas_cc_guardar_extension`, `saas_cc_asignar_base`, `saas_cc_registrar_gestion`, `saas_cc_pasar_crm`, `saas_cc_estado_base`. El asesor no puede importar por su cuenta, autoasignarse otra base ni leer contactos de otra empresa/sucursal. El acceso sigue sujeto al módulo y suscripción vigentes. SQL migraciones 08 a 12.

Se ejecutaron pruebas SQL transaccionales con dos identidades autorizadas, comprobando la importación de contacto por gerente, extensión, asignación, lectura restringida, registro de gestión, bloqueo de módulo desactivado y conversión a CRM sin duplicados. Las transacciones se revirtieron: no se persistió información ficticia. Se volvió a probar importación duplicada (+57 y sin +57), gestión del asesor, captura de extensión histórica, conversión al CRM y prevención de una segunda conversión.

## Límites importantes
- **NO hay conexión al PBX/SIP de Comuniquémonos** ni una función de marcación automática WebRTC/SIP. Una extensión registrada es una etiqueta de gestión interna hasta enlazar proveedor y cuenta autorizada.
- `tel:` abre el marcador disponible del usuario: no inicia una llamada por sí solo ni produce CDR/verificación telefónica.
- No hay envíos masivos de WhatsApp, campañas SMS, discador predictivo, grabación, escucha o transferencia real de llamadas.
- Los resultados de llamada son registros declarados por los asesores, no verificados por la central telefónica.
- Las cuentas nuevas aún dependen de configurar el sistema de correos de autenticación (SMTP). No anunciar como disponible para venta masiva sin completarlo.
- Los resultados del navegador en móviles reales deben validarse antes de ofrecer contratación a clientes finales; las pruebas disponibles hasta ahora incluyen validación SQL, carga/estructura de código, compilación de JavaScript y publicación de GitHub Pages.
- El CRM original y sus bases de llamadas antiguas no fueron modificados ni importados.
- El proyecto Supabase compartido contiene advertencias de seguridad heredadas que requieren auditoría o separación antes de operar un SaaS público a escala.

## Recorrido operativo
1. Propietario: abre Call Center, crea base en la sucursal y conserva soportes de autorización.
2. Importa CSV con nombre y teléfono. Puede repetir en una base, omitiendo repetidos del archivo y teléfonos que ya figuren en esa base.
3. Asigna la extensión al asesor y la base a ese asesor/extensión.
4. Asesor: entra con su usuario, abre su base, llama desde el marcador disponible y registra resultado, notas y próxima fecha.
5. Con resultado Venta, usa «Pasar al CRM» para añadir producto y valor, sin registrar dos veces el mismo contacto.
6. Propietario: consulta gestión, historial, ventas por extensión y reportes comerciales del CRM.
