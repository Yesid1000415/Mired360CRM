-- Módulo de cobro de comisiones MIRED360SERVICIOS
-- Ejecutar una sola vez en Supabase > SQL Editor.

create table if not exists public.perfiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nombre text,
  rol text not null default 'asesor' check (rol in ('asesor','coordinador','administrador')),
  creado_en timestamptz not null default now()
);

create or replace function public.es_coordinacion()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.perfiles where user_id=auth.uid() and rol in ('coordinador','administrador')) $$;

create sequence if not exists public.solicitud_comision_seq start 1;
create table if not exists public.solicitudes_comision (
  id uuid primary key default gen_random_uuid(),
  numero_solicitud text not null unique default ('COM-'||to_char(current_date,'YYYYMM')||'-'||lpad(nextval('public.solicitud_comision_seq')::text,5,'0')),
  user_id uuid not null references auth.users(id),
  nombre_asesor text not null,
  cedula_asesor text not null,
  cuenta_nequi text not null,
  cantidad_servicios integer not null check(cantidad_servicios>0),
  coordinador text not null,
  estado text not null default 'Pendiente' check(estado in ('Pendiente','Aprobado','Pagado','Rechazado')),
  observacion_coordinacion text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table if not exists public.servicios_comision (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references public.solicitudes_comision(id) on delete restrict,
  user_id uuid not null references auth.users(id),
  item integer not null,
  orden_trabajo text not null,
  cuenta text not null,
  cedula_cliente text not null,
  fecha_instalacion date not null,
  ciudad_instalacion text not null,
  tipo_red text not null check(tipo_red in ('FTTH','HFC','Otra')),
  estrato integer not null check(estrato between 1 and 6),
  tipo_producto text not null check(tipo_producto in ('Residencial','SOHO','PYMES')),
  creado_en timestamptz not null default now(),
  unique(solicitud_id,item), unique(orden_trabajo)
);

alter table public.perfiles enable row level security;
alter table public.solicitudes_comision enable row level security;
alter table public.servicios_comision enable row level security;

drop policy if exists "perfil propio o coordinacion" on public.perfiles;
create policy "perfil propio o coordinacion" on public.perfiles for select to authenticated using(user_id=auth.uid() or public.es_coordinacion());

drop policy if exists "asesor crea solicitud" on public.solicitudes_comision;
create policy "asesor crea solicitud" on public.solicitudes_comision for insert to authenticated with check(user_id=auth.uid() and estado='Pendiente');
drop policy if exists "asesor consulta propias" on public.solicitudes_comision;
create policy "asesor consulta propias" on public.solicitudes_comision for select to authenticated using(user_id=auth.uid() or public.es_coordinacion());
drop policy if exists "solo coordinacion actualiza" on public.solicitudes_comision;
create policy "solo coordinacion actualiza" on public.solicitudes_comision for update to authenticated using(public.es_coordinacion()) with check(public.es_coordinacion());

drop policy if exists "asesor crea detalle" on public.servicios_comision;
create policy "asesor crea detalle" on public.servicios_comision for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from public.solicitudes_comision s where s.id=solicitud_id and s.user_id=auth.uid() and s.estado='Pendiente'));
drop policy if exists "asesor consulta detalle propio" on public.servicios_comision;
create policy "asesor consulta detalle propio" on public.servicios_comision for select to authenticated using(user_id=auth.uid() or public.es_coordinacion());

create or replace function public.registrar_solicitud_comision(p_datos jsonb)
returns text language plpgsql security invoker set search_path=public as $$
declare
  v_id uuid;
  v_numero text;
  v_servicio jsonb;
  v_item integer:=0;
begin
  if auth.uid() is null then raise exception 'Sesión no válida'; end if;
  if nullif(trim(p_datos->>'nombre_asesor'),'') is null
     or nullif(trim(p_datos->>'cedula_asesor'),'') is null
     or nullif(trim(p_datos->>'cuenta_nequi'),'') is null
     or nullif(trim(p_datos->>'coordinador'),'') is null
     or jsonb_typeof(p_datos->'servicios') <> 'array'
     or jsonb_array_length(p_datos->'servicios')=0 then
    raise exception 'La solicitud está incompleta';
  end if;
  insert into public.solicitudes_comision(user_id,nombre_asesor,cedula_asesor,cuenta_nequi,cantidad_servicios,coordinador)
  values(auth.uid(),trim(p_datos->>'nombre_asesor'),trim(p_datos->>'cedula_asesor'),trim(p_datos->>'cuenta_nequi'),jsonb_array_length(p_datos->'servicios'),trim(p_datos->>'coordinador'))
  returning id,numero_solicitud into v_id,v_numero;
  for v_servicio in select value from jsonb_array_elements(p_datos->'servicios') loop
    v_item:=v_item+1;
    insert into public.servicios_comision(solicitud_id,user_id,item,orden_trabajo,cuenta,cedula_cliente,fecha_instalacion,ciudad_instalacion,tipo_red,estrato,tipo_producto)
    values(v_id,auth.uid(),v_item,trim(v_servicio->>'orden_trabajo'),trim(v_servicio->>'cuenta'),trim(v_servicio->>'cedula_cliente'),(v_servicio->>'fecha_instalacion')::date,trim(v_servicio->>'ciudad_instalacion'),v_servicio->>'tipo_red',(v_servicio->>'estrato')::integer,v_servicio->>'tipo_producto');
  end loop;
  return v_numero;
end $$;
grant execute on function public.registrar_solicitud_comision(jsonb) to authenticated;


-- Eliminación administrativa atómica. Los asesores no pueden ejecutarla porque
-- la función valida el rol de coordinación antes de borrar detalles y cabecera.
create or replace function public.eliminar_solicitud_comision(p_id uuid)
returns text
language plpgsql
security definer
set search_path=public
as $
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
end $;

revoke all on function public.eliminar_solicitud_comision(uuid) from public;
grant execute on function public.eliminar_solicitud_comision(uuid) to authenticated;

-- No existen políticas UPDATE ni DELETE para asesores en ninguna tabla de cobros.
-- Después de ejecutar, asigne el rol al usuario coordinador existente:
-- insert into public.perfiles(user_id,nombre,rol)
-- select id,'Yesid Rojas','coordinador' from auth.users where email='CORREO_DEL_COORDINADOR'
-- on conflict(user_id) do update set rol='coordinador', nombre=excluded.nombre;
