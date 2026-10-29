-- MIRED360 CRM Empresas | Operación modular multiempresa
-- Only saas_* objects: do not modify the legacy telecom CRM.
create table if not exists public.saas_sucursales(
 id uuid primary key default gen_random_uuid(),
 organizacion_id uuid not null references public.saas_organizaciones(id) on delete cascade,
 nombre text not null check(length(btrim(nombre)) between 2 and 90),
 ciudad text not null default '',
 activa boolean not null default true,
 creado_en timestamptz not null default now(),
 unique(organizacion_id,id)
);
create unique index if not exists saas_sucursal_nombre_idx on public.saas_sucursales(organizacion_id,lower(nombre));
create index if not exists saas_sucursales_org_idx on public.saas_sucursales(organizacion_id);

insert into public.saas_sucursales(organizacion_id,nombre)
select o.id,'Principal' from public.saas_organizaciones o
where not exists(select 1 from public.saas_sucursales s where s.organizacion_id=o.id);

create or replace function mired_private.saas_al_crear_empresa_sucursal()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.saas_sucursales(organizacion_id,nombre) values(new.id,'Principal');
 return new;
end $$;
drop trigger if exists saas_crear_sucursal_principal on public.saas_organizaciones;
create trigger saas_crear_sucursal_principal after insert on public.saas_organizaciones
for each row execute function mired_private.saas_al_crear_empresa_sucursal();

alter table public.saas_miembros add column if not exists sucursal_id uuid;
alter table public.saas_prospectos add column if not exists sucursal_id uuid;
alter table public.saas_miembros add constraint saas_miembro_sucursal_org_fk
 foreign key (organizacion_id,sucursal_id) references public.saas_sucursales(organizacion_id,id);
alter table public.saas_prospectos add constraint saas_prospecto_sucursal_org_fk
 foreign key (organizacion_id,sucursal_id) references public.saas_sucursales(organizacion_id,id);
update public.saas_miembros m set sucursal_id = (select s.id from public.saas_sucursales s where s.organizacion_id=m.organizacion_id order by creado_en limit 1)
where sucursal_id is null;
update public.saas_prospectos p set sucursal_id = (select s.id from public.saas_sucursales s where s.organizacion_id=p.organizacion_id order by creado_en limit 1)
where sucursal_id is null;

create or replace function mired_private.saas_auto_sucursal()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.sucursal_id is null then
  select id into new.sucursal_id from public.saas_sucursales
   where organizacion_id=new.organizacion_id and activa order by creado_en limit 1;
 end if;
 if new.sucursal_id is null then raise exception 'La empresa necesita una sucursal activa'; end if;
 return new;
end $$;
drop trigger if exists saas_asignar_sucursal_miembro on public.saas_miembros;
create trigger saas_asignar_sucursal_miembro before insert on public.saas_miembros
for each row execute function mired_private.saas_auto_sucursal();
drop trigger if exists saas_asignar_sucursal_prospecto on public.saas_prospectos;
create trigger saas_asignar_sucursal_prospecto before insert on public.saas_prospectos
for each row execute function mired_private.saas_auto_sucursal();

create or replace function mired_private.saas_puede_ver_sucursal(p_org uuid,p_sucursal uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and exists(
  select 1 from public.saas_miembros m where m.organizacion_id=p_org
   and m.usuario_id=(select auth.uid())
   and (m.rol in ('propietario','administrador') or m.sucursal_id=p_sucursal)
 );
$$;
create or replace function mired_private.saas_puede_trabajar_sucursal(p_org uuid,p_sucursal uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select (select mired_private.saas_puede_escribir(p_org))
   and (select mired_private.saas_puede_ver_sucursal(p_org,p_sucursal))
   and exists(select 1 from public.saas_sucursales s
    where s.id=p_sucursal and s.organizacion_id=p_org and s.activa);
$$;
revoke all on function mired_private.saas_puede_ver_sucursal(uuid,uuid),mired_private.saas_puede_trabajar_sucursal(uuid,uuid) from public,anon;
grant execute on function mired_private.saas_puede_ver_sucursal(uuid,uuid),mired_private.saas_puede_trabajar_sucursal(uuid,uuid) to authenticated;

alter table public.saas_sucursales enable row level security;
revoke all on public.saas_sucursales from public,anon,authenticated;
grant select on public.saas_sucursales to authenticated;
grant insert(organizacion_id,nombre,ciudad) on public.saas_sucursales to authenticated;
grant update(nombre,ciudad,activa) on public.saas_sucursales to authenticated;
create policy saas_sucursales_leer on public.saas_sucursales for select to authenticated
 using (mired_private.saas_es_miembro(organizacion_id));
create policy saas_sucursales_crear on public.saas_sucursales for insert to authenticated
 with check (mired_private.saas_puede_escribir(organizacion_id)
 and mired_private.saas_rol(organizacion_id) in ('propietario','administrador'));
create policy saas_sucursales_editar on public.saas_sucursales for update to authenticated
 using (mired_private.saas_puede_escribir(organizacion_id)
  and mired_private.saas_rol(organizacion_id) in ('propietario','administrador'))
 with check (mired_private.saas_puede_escribir(organizacion_id)
  and mired_private.saas_rol(organizacion_id) in ('propietario','administrador'));

grant insert(sucursal_id) on public.saas_prospectos to authenticated;
grant update(sucursal_id) on public.saas_prospectos to authenticated;
alter policy saas_prospectos_ver on public.saas_prospectos
 using (mired_private.saas_puede_ver_sucursal(organizacion_id,sucursal_id));
alter policy saas_prospectos_crear on public.saas_prospectos
 with check (creado_por=(select auth.uid())
 and mired_private.saas_puede_trabajar_sucursal(organizacion_id,sucursal_id));
alter policy saas_prospectos_editar on public.saas_prospectos
 using (mired_private.saas_puede_trabajar_sucursal(organizacion_id,sucursal_id)
 and (creado_por=(select auth.uid()) or mired_private.saas_rol(organizacion_id) in ('propietario','administrador')))
 with check (mired_private.saas_puede_trabajar_sucursal(organizacion_id,sucursal_id)
 and (creado_por=(select auth.uid()) or mired_private.saas_rol(organizacion_id) in ('propietario','administrador')));
alter policy saas_actividad_ver on public.saas_actividades
 using (exists(select 1 from public.saas_prospectos p
  where p.id=prospecto_id and p.organizacion_id=organizacion_id
  and mired_private.saas_puede_ver_sucursal(p.organizacion_id,p.sucursal_id)));
alter policy saas_actividad_crear on public.saas_actividades
 with check (usuario_id=(select auth.uid()) and
 exists(select 1 from public.saas_prospectos p
  where p.id=prospecto_id and p.organizacion_id=organizacion_id
  and mired_private.saas_puede_trabajar_sucursal(p.organizacion_id,p.sucursal_id)));

create or replace function public.saas_asignar_sucursal(p_org uuid,p_usuario uuid,p_sucursal uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if (select auth.uid()) is null or not mired_private.saas_es_propietario(p_org) then
  raise exception 'Solo el propietario puede asignar sucursales';
 end if;
 if not exists(select 1 from public.saas_sucursales s where s.id=p_sucursal
 and s.organizacion_id=p_org and s.activa) then raise exception 'Sucursal inexistente o inactiva';end if;
 update public.saas_miembros set sucursal_id=p_sucursal
 where organizacion_id=p_org and usuario_id=p_usuario and rol<>'propietario';
 return found;
end $$;
revoke all on function public.saas_asignar_sucursal(uuid,uuid,uuid) from public,anon;
grant execute on function public.saas_asignar_sucursal(uuid,uuid,uuid) to authenticated;

-- Module subscriptions are controlled by platform operators, not by paying companies.
create table if not exists public.saas_modulos(
 organizacion_id uuid not null references public.saas_organizaciones(id) on delete cascade,
 codigo text not null check(codigo in ('crm','sucursales','equipo','campanas','llamadas')),
 activo boolean not null default true,
 actualizado_en timestamptz not null default now(),
 primary key (organizacion_id,codigo)
);
insert into public.saas_modulos(organizacion_id,codigo,activo)
 select o.id,m.codigo,true from public.saas_organizaciones o
 cross join (values ('crm'),('sucursales'),('equipo'),('campanas'),('llamadas')) m(codigo)
 on conflict do nothing;
create or replace function mired_private.saas_al_crear_empresa_modulos()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.saas_modulos(organizacion_id,codigo,activo)
 values (new.id,'crm',true),(new.id,'sucursales',true),(new.id,'equipo',true),
 (new.id,'campanas',true),(new.id,'llamadas',true);
 return new;
end $$;
drop trigger if exists saas_crear_modulos on public.saas_organizaciones;
create trigger saas_crear_modulos after insert on public.saas_organizaciones
for each row execute function mired_private.saas_al_crear_empresa_modulos();
create or replace function mired_private.saas_modulo_activo(p_org uuid,p_codigo text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.saas_modulos m
 where m.organizacion_id=p_org and m.codigo=p_codigo and m.activo);
$$;
revoke all on function mired_private.saas_modulo_activo(uuid,text) from public,anon;
grant execute on function mired_private.saas_modulo_activo(uuid,text) to authenticated;
alter table public.saas_modulos enable row level security;
revoke all on public.saas_modulos from public,anon,authenticated;
grant select on public.saas_modulos to authenticated;
create policy saas_modulos_ver on public.saas_modulos for select to authenticated
 using (mired_private.saas_es_miembro(organizacion_id));
create or replace function public.saas_admin_modulo(p_org uuid,p_codigo text,p_activo boolean)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if (select auth.uid()) is null or not mired_private.saas_es_admin_plataforma() then raise exception 'No autorizado';end if;
 if p_codigo not in ('crm','sucursales','equipo','campanas','llamadas') then raise exception 'Módulo no permitido';end if;
 insert into public.saas_modulos(organizacion_id,codigo,activo,actualizado_en)
 values(p_org,p_codigo,p_activo,now())
 on conflict(organizacion_id,codigo) do update set activo=excluded.activo,actualizado_en=excluded.actualizado_en;
 return true;
end $$;
revoke all on function public.saas_admin_modulo(uuid,text,boolean) from public,anon;
grant execute on function public.saas_admin_modulo(uuid,text,boolean) to authenticated;

create table if not exists public.saas_campanas(
 id uuid primary key default gen_random_uuid(),
 organizacion_id uuid not null references public.saas_organizaciones(id) on delete cascade,
 sucursal_id uuid not null,
 nombre text not null check(length(btrim(nombre)) between 3 and 120),
 canal text not null default 'Otro' check (canal in ('WhatsApp','Facebook','Instagram','Web','Llamada','Referidos','Otro')),
 presupuesto numeric(12,2) not null default 0 check(presupuesto>=0),
 estado text not null default 'activa' check(estado in ('activa','pausada','cerrada')),
 creado_por uuid not null references auth.users(id),
 creado_en timestamptz not null default now(),
 unique(organizacion_id,id),
 foreign key(organizacion_id,sucursal_id) references public.saas_sucursales(organizacion_id,id)
);
create index if not exists saas_campanas_org_idx on public.saas_campanas(organizacion_id,sucursal_id,creado_en desc);
alter table public.saas_campanas enable row level security;
revoke all on public.saas_campanas from public,anon,authenticated;
grant select on public.saas_campanas to authenticated;
grant insert(organizacion_id,sucursal_id,nombre,canal,presupuesto,estado,creado_por) on public.saas_campanas to authenticated;
grant update(nombre,canal,presupuesto,estado) on public.saas_campanas to authenticated;
create policy saas_campanas_ver on public.saas_campanas for select to authenticated
 using (mired_private.saas_puede_ver_sucursal(organizacion_id,sucursal_id));
create policy saas_campanas_crear on public.saas_campanas for insert to authenticated
 with check(creado_por=(select auth.uid()) and mired_private.saas_puede_trabajar_sucursal(organizacion_id,sucursal_id)
 and mired_private.saas_rol(organizacion_id) in ('propietario','administrador')
 and mired_private.saas_modulo_activo(organizacion_id,'campanas'));
create policy saas_campanas_editar on public.saas_campanas for update to authenticated
 using(mired_private.saas_puede_trabajar_sucursal(organizacion_id,sucursal_id)
 and mired_private.saas_rol(organizacion_id) in ('propietario','administrador')
 and mired_private.saas_modulo_activo(organizacion_id,'campanas'))
 with check(mired_private.saas_puede_trabajar_sucursal(organizacion_id,sucursal_id)
 and mired_private.saas_rol(organizacion_id) in ('propietario','administrador')
 and mired_private.saas_modulo_activo(organizacion_id,'campanas'));

alter table public.saas_prospectos add column if not exists campana_id uuid;
alter table public.saas_prospectos add constraint saas_prospecto_campana_org_fk
 foreign key (organizacion_id,campana_id) references public.saas_campanas(organizacion_id,id);
grant insert(campana_id) on public.saas_prospectos to authenticated;
grant update(campana_id) on public.saas_prospectos to authenticated;

create table if not exists public.saas_llamadas(
 id uuid primary key default gen_random_uuid(),
 organizacion_id uuid not null references public.saas_organizaciones(id) on delete cascade,
 sucursal_id uuid not null,
 prospecto_id uuid not null,
 usuario_id uuid not null references auth.users(id),
 resultado text not null check(resultado in ('Sin respuesta','Contactado','Interesado','Seguimiento','Venta','No interesado')),
 detalle text not null default '',
 siguiente_contacto date,
 creado_en timestamptz not null default now(),
 foreign key(organizacion_id,sucursal_id) references public.saas_sucursales(organizacion_id,id),
 foreign key(prospecto_id) references public.saas_prospectos(id) on delete cascade
);
create index if not exists saas_llamadas_org_idx on public.saas_llamadas(organizacion_id,sucursal_id,creado_en desc);
alter table public.saas_llamadas enable row level security;
revoke all on public.saas_llamadas from public,anon,authenticated;
grant select on public.saas_llamadas to authenticated;
grant insert(organizacion_id,sucursal_id,prospecto_id,usuario_id,resultado,detalle,siguiente_contacto) on public.saas_llamadas to authenticated;
create policy saas_llamadas_ver on public.saas_llamadas for select to authenticated
 using(mired_private.saas_puede_ver_sucursal(organizacion_id,sucursal_id));
create policy saas_llamadas_crear on public.saas_llamadas for insert to authenticated
 with check(usuario_id=(select auth.uid())
 and mired_private.saas_puede_trabajar_sucursal(organizacion_id,sucursal_id)
 and mired_private.saas_modulo_activo(organizacion_id,'llamadas')
 and exists(select 1 from public.saas_prospectos p
 where p.id=prospecto_id and p.organizacion_id=organizacion_id and p.sucursal_id=sucursal_id));

-- Viewing and modifying prospects is always tenant and branch scoped.
-- Module-level permission checks protect prospect writes.
alter policy saas_prospectos_crear on public.saas_prospectos
 with check (creado_por=(select auth.uid())
 and mired_private.saas_puede_trabajar_sucursal(organizacion_id,sucursal_id)
 and mired_private.saas_modulo_activo(organizacion_id,'crm'));
alter policy saas_prospectos_editar on public.saas_prospectos
 using(mired_private.saas_puede_trabajar_sucursal(organizacion_id,sucursal_id)
 and (creado_por=(select auth.uid()) or mired_private.saas_rol(organizacion_id) in ('propietario','administrador'))
 and mired_private.saas_modulo_activo(organizacion_id,'crm'))
 with check(mired_private.saas_puede_trabajar_sucursal(organizacion_id,sucursal_id)
 and (creado_por=(select auth.uid()) or mired_private.saas_rol(organizacion_id) in ('propietario','administrador'))
 and mired_private.saas_modulo_activo(organizacion_id,'crm'));
