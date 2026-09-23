-- Corrección definitiva: administrar cobros y asesores desde MIRED360 CRM.
-- Ejecutar una sola vez en Supabase > SQL Editor.

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

create or replace function public.editar_asesor_crm(p_user_id uuid, p_nombre text)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  v_nombre text;
begin
  if auth.uid() is null or not public.es_coordinacion() then
    raise exception 'No tiene permiso para editar asesores.';
  end if;
  if nullif(trim(p_nombre),'') is null then
    raise exception 'El nombre no puede quedar vacío.';
  end if;

  update public.perfiles
  set nombre=trim(p_nombre)
  where user_id=p_user_id and rol='asesor'
  returning nombre into v_nombre;

  if v_nombre is null then
    raise exception 'El asesor no existe o ya fue retirado.';
  end if;
  return v_nombre;
end $$;

create or replace function public.retirar_asesor_crm(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_nombre text;
begin
  if auth.uid() is null or not public.es_coordinacion() then
    raise exception 'No tiene permiso para retirar asesores.';
  end if;
  if p_user_id=auth.uid() then
    raise exception 'No puede retirar su propio usuario.';
  end if;

  select nombre into v_nombre
  from public.perfiles
  where user_id=p_user_id and rol='asesor';

  if v_nombre is null then
    raise exception 'El asesor no existe o ya fue retirado.';
  end if;

  update auth.users
  set banned_until=now()+interval '100 years', updated_at=now()
  where id=p_user_id;

  delete from public.perfiles where user_id=p_user_id and rol='asesor';
  return v_nombre;
end $$;

revoke all on function public.eliminar_solicitud_comision(uuid) from public;
revoke all on function public.editar_asesor_crm(uuid,text) from public;
revoke all on function public.retirar_asesor_crm(uuid) from public;
grant execute on function public.eliminar_solicitud_comision(uuid) to authenticated;
grant execute on function public.editar_asesor_crm(uuid,text) to authenticated;
grant execute on function public.retirar_asesor_crm(uuid) to authenticated;

-- Un asesor retirado deja de poder consultar o crear cobros aunque conserve su historial.
drop policy if exists "asesor crea solicitud" on public.solicitudes_comision;
create policy "asesor crea solicitud" on public.solicitudes_comision
for insert to authenticated
with check (
  user_id=auth.uid() and estado='Pendiente'
  and exists(select 1 from public.perfiles p where p.user_id=auth.uid() and p.rol='asesor')
);

drop policy if exists "asesor consulta propias" on public.solicitudes_comision;
create policy "asesor consulta propias" on public.solicitudes_comision
for select to authenticated
using (
  public.es_coordinacion()
  or (
    user_id=auth.uid()
    and exists(select 1 from public.perfiles p where p.user_id=auth.uid() and p.rol='asesor')
  )
);

drop policy if exists "asesor crea detalle" on public.servicios_comision;
create policy "asesor crea detalle" on public.servicios_comision
for insert to authenticated
with check (
  user_id=auth.uid()
  and exists(select 1 from public.perfiles p where p.user_id=auth.uid() and p.rol='asesor')
  and exists(
    select 1 from public.solicitudes_comision s
    where s.id=solicitud_id and s.user_id=auth.uid() and s.estado='Pendiente'
  )
);

drop policy if exists "asesor consulta detalle propio" on public.servicios_comision;
create policy "asesor consulta detalle propio" on public.servicios_comision
for select to authenticated
using (
  public.es_coordinacion()
  or (
    user_id=auth.uid()
    and exists(select 1 from public.perfiles p where p.user_id=auth.uid() and p.rol='asesor')
  )
);

select 'CORRECCION COMPLETA' as resultado;
