-- Corrección definitiva del botón Eliminar en Cobro de comisiones.
-- Ejecutar una vez en Supabase > SQL Editor.

create or replace function public.eliminar_solicitud_comision(p_id uuid)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  v_numero text;
begin
  if auth.uid() is null or not public.es_coordinacion() then
    raise exception 'No tiene permiso para eliminar solicitudes.';
  end if;

  select numero_solicitud into v_numero
  from public.solicitudes_comision
  where id=p_id;

  if v_numero is null then
    raise exception 'La solicitud no existe o ya fue eliminada.';
  end if;

  delete from public.servicios_comision where solicitud_id=p_id;
  delete from public.solicitudes_comision where id=p_id;
  return v_numero;
end $$;

revoke all on function public.eliminar_solicitud_comision(uuid) from public;
grant execute on function public.eliminar_solicitud_comision(uuid) to authenticated;
