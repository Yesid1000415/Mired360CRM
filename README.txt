MIRED360CRM — VERSIÓN SUPABASE

Esta versión reemplaza el almacenamiento local de PROSPECTOS por Supabase.
Incluye:
- Inicio de sesión por correo y contraseña de Supabase Auth.
- Carga de prospectos desde public.prospectos.
- Crear, editar y eliminar prospectos en Supabase.
- IDs UUID gestionados por Supabase.
- Botón opcional para migrar prospectos antiguos de localStorage.
- Publicidad y configuración general siguen locales por ahora.

PARA PUBLICAR EN GITHUB
1. En el repositorio Mired360CRM, sustituye el index.html actual por este index.html.
2. Haz commit directamente a main.
3. Espera a que GitHub Pages termine el despliegue.
4. Abre el CRM y entra con el usuario de Supabase Authentication > Users.

PRIMERA PRUEBA
- Inicia sesión.
- Crea un prospecto de prueba.
- Actualiza su estado.
- Recarga la página.
- Verifica que siga apareciendo una sola vez.
- En Supabase > Table Editor > prospectos debe verse el registro.

NOTA
Si al guardar aparece un error relacionado con API/Data API, hay que habilitar Data API access para la tabla prospectos en Supabase. RLS debe permanecer activado.
