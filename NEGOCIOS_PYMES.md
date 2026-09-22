# Módulo de visitas a negocios Claro Pymes

## Activación

1. En Supabase, abra SQL Editor del proyecto usado por MIRED360CRM y ejecute `supabase_negocios.sql` una vez. Requiere que `supabase_comisiones.sql` ya haya creado `public.es_coordinacion()` y el perfil de coordinación.
2. Publique `negocios.html` y la actualización de `index.html` en la misma rama de GitHub Pages.
3. Inicie sesión con un usuario de coordinación en el CRM y abra **Negocios Pymes** desde el menú. Un asesor sin perfil de coordinación no puede consultar estos registros.

## Flujo

Registrar la visita desde el celular; revisar posibles duplicados del mismo negocio y teléfono; anotar oferta vigente, condiciones y autorización de contacto; guardar; descargar el PDF individual y compartirlo con el cliente por el canal que elija. Desde la tabla se puede editar resultado y seguimiento. El CSV y PDF consolidado respetan búsqueda y filtro visibles. El CSV excluye la firma.

No se envía WhatsApp automáticamente ni se crea un prospecto en la tabla general: la base TAT se mantiene separada. Las ofertas no están precargadas para evitar mostrar precios sin confirmar cobertura o vigencia.

## Comprobación

Registre una visita de prueba con un número de uso propio; recargue la página; edite el resultado; descargue el PDF individual y el CSV. Compruebe que un usuario sin rol de coordinación no pueda leer la tabla mediante la API.
