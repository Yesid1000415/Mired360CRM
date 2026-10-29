-- MIRED360 CRM Empresas - Call Center multiempresa de trabajo comercial
-- No altera las tablas ni extensiones del Call Center original.
create table public.saas_cc_extensiones(
 id uuid primary key default gen_random_uuid(),
 organizacion_id uuid not null references public.saas_organizaciones(id) on delete cascade,
 sucursal_id uuid not null,
 codigo text not null check (codigo ~ '^[0-9]{2,8}$'),
 usuario_id uuid references auth.users(id),
 meta_mensual integer not null default 15 check(meta_mensual between 1 and 10000),
 creado_en timestamptz not null default now(),
 unique(organizacion_id,id),
 unique(organizacion_id,codigo),
 foreign key(organizacion_id,sucursal_id) references public.saas_sucursales(organizacion_id,id)
);
create unique index saas_cc_ext_un_asesor on public.saas_cc_extensiones(organizacion_id,usuario_id)
 where usuario_id is not null;
create index saas_cc_ext_org_branch_idx on public.saas_cc_extensiones(organizacion_id,sucursal_id);

create table public.saas_cc_bases(
 id uuid primary key default gen_random_uuid(),
 organizacion_id uuid not null references public.saas_organizaciones(id) on delete cascade,
 sucursal_id uuid not null,
 nombre text not null check(char_length(btrim(nombre)) between 3 and 110),
 estado text not null default 'activa' check(estado in ('activa','pausada')),
 asignado_a uuid references auth.users(id),
 extension_id uuid,
 autorizacion_declarada boolean not null check(autorizacion_declarada=true),
 creado_por uuid not null references auth.users(id),
 creado_en timestamptz not null default now(),
 unique(organizacion_id,id),
 unique(organizacion_id,sucursal_id,id),
 foreign key(organizacion_id,sucursal_id) references public.saas_sucursales(organizacion_id,id),
 foreign key(organizacion_id,extension_id) references public.saas_cc_extensiones(organizacion_id,id)
);
create index saas_cc_bases_org_branch_idx on public.saas_cc_bases(organizacion_id,sucursal_id);
create index saas_cc_bases_assignee_idx on public.saas_cc_bases(organizacion_id,asignado_a);

create table public.saas_cc_contactos(
 id uuid primary key default gen_random_uuid(),
 organizacion_id uuid not null,
 sucursal_id uuid not null,
 base_id uuid not null,
 nombre text not null check(length(btrim(nombre)) between 2 and 150),
 telefono text not null check(length(btrim(telefono)) between 7 and 32),
 ciudad text not null default '',
 observaciones text not null default '',
 estado text not null default 'Pendiente'
  check(estado in ('Pendiente','Sin respuesta','Contactado','Interesado','Seguimiento','Venta','No interesado')),
 proxima_llamada date,
 gestionado_por uuid references auth.users(id),
 creado_en timestamptz not null default now(),
 actualizado_en timestamptz not null default now(),
 foreign key(organizacion_id,sucursal_id,base_id)
  references public.saas_cc_bases(organizacion_id,sucursal_id,id) on delete cascade
);
create index saas_cc_contactos_base_idx on public.saas_cc_contactos(organizacion_id,base_id,creado_en desc);
create index saas_cc_contactos_estado_idx on public.saas_cc_contactos(organizacion_id,estado);
create index saas_cc_contactos_proxima_idx on public.saas_cc_contactos(organizacion_id,proxima_llamada);

create table public.saas_cc_gestiones(
 id uuid primary key default gen_random_uuid(),
 organizacion_id uuid not null,
 sucursal_id uuid not null,
 base_id uuid not null,
 contacto_id uuid not null references public.saas_cc_contactos(id) on delete cascade,
 usuario_id uuid not null references auth.users(id),
 resultado text not null check(resultado in ('Sin respuesta','Contactado','Interesado','Seguimiento','Venta','No interesado')),
 notas text not null default '' check(length(notas)<=2000),
 proxima_llamada date,
 creado_en timestamptz not null default now(),
 foreign key(organizacion_id,sucursal_id,base_id)
  references public.saas_cc_bases(organizacion_id,sucursal_id,id) on delete cascade
);
create index saas_cc_gestiones_contacto_idx on public.saas_cc_gestiones(contacto_id,creado_en desc);
create index saas_cc_gestiones_asesor_idx on public.saas_cc_gestiones(organizacion_id,usuario_id,creado_en desc);

create or replace function mired_private.saas_cc_base_visible(p_org uuid,p_base uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and exists (
  select 1 from public.saas_cc_bases b
  join public.saas_miembros m on m.organizacion_id=b.organizacion_id and m.usuario_id=(select auth.uid())
  where b.id=p_base and b.organizacion_id=p_org
    and (m.rol in ('propietario','administrador') or (b.asignado_a=m.usuario_id and b.sucursal_id=m.sucursal_id))
 );
$$;
revoke all on function mired_private.saas_cc_base_visible(uuid,uuid) from public,anon;
grant execute on function mired_private.saas_cc_base_visible(uuid,uuid) to authenticated;

alter table public.saas_cc_extensiones enable row level security;
alter table public.saas_cc_bases enable row level security;
alter table public.saas_cc_contactos enable row level security;
alter table public.saas_cc_gestiones enable row level security;
revoke all on public.saas_cc_extensiones,public.saas_cc_bases,public.saas_cc_contactos,public.saas_cc_gestiones from public,anon,authenticated;
grant select on public.saas_cc_extensiones,public.saas_cc_bases,public.saas_cc_contactos,public.saas_cc_gestiones to authenticated;
grant insert(organizacion_id,sucursal_id,nombre,autorizacion_declarada,creado_por)
 on public.saas_cc_bases to authenticated;
grant insert(organizacion_id,sucursal_id,base_id,nombre,telefono,ciudad,observaciones)
 on public.saas_cc_contactos to authenticated;

create policy saas_cc_ext_leer on public.saas_cc_extensiones for select to authenticated
using(mired_private.saas_es_miembro(organizacion_id)
 and (mired_private.saas_rol(organizacion_id) in ('propietario','administrador')
 or usuario_id=(select auth.uid())));
create policy saas_cc_bases_leer on public.saas_cc_bases for select to authenticated
using(mired_private.saas_cc_base_visible(organizacion_id,id));
create policy saas_cc_bases_crear on public.saas_cc_bases for insert to authenticated with check(
 creado_por=(select auth.uid()) and mired_private.saas_puede_trabajar_sucursal(organizacion_id,sucursal_id)
 and mired_private.saas_modulo_activo(organizacion_id,'llamadas')
 and mired_private.saas_rol(organizacion_id) in ('propietario','administrador')
 and autorizacion_declarada=true
);
create policy saas_cc_contactos_leer on public.saas_cc_contactos for select to authenticated
using(mired_private.saas_cc_base_visible(organizacion_id,base_id));
create policy saas_cc_contactos_importar on public.saas_cc_contactos for insert to authenticated with check(
 mired_private.saas_puede_trabajar_sucursal(organizacion_id,sucursal_id)
 and mired_private.saas_modulo_activo(organizacion_id,'llamadas')
 and mired_private.saas_rol(organizacion_id) in ('propietario','administrador')
 and exists(select 1 from public.saas_cc_bases b where b.id=base_id
  and b.organizacion_id=organizacion_id and b.sucursal_id=sucursal_id
  and b.estado='activa' and b.autorizacion_declarada=true)
);
create policy saas_cc_gestiones_leer on public.saas_cc_gestiones for select to authenticated
using(mired_private.saas_cc_base_visible(organizacion_id,base_id));

-- Admin-managed extension names are labels only; no SIP passwords or telephony secrets.
create or replace function public.saas_cc_guardar_extension(
 p_org uuid,p_sucursal uuid,p_codigo text,p_usuario uuid,p_meta integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_existing public.saas_cc_extensiones%rowtype;
begin
 if (select auth.uid()) is null or mired_private.saas_rol(p_org) not in ('propietario','administrador')
  or not mired_private.saas_puede_trabajar_sucursal(p_org,p_sucursal)
  or not mired_private.saas_modulo_activo(p_org,'llamadas')
 then raise exception 'No autorizado';end if;
 if p_codigo is null or p_codigo !~ '^[0-9]{2,8}$' or p_meta not between 1 and 10000
 then raise exception 'Extensión o meta inválida';end if;
 if p_usuario is not null and not exists(
  select 1 from public.saas_miembros m where m.organizacion_id=p_org
   and m.usuario_id=p_usuario and m.sucursal_id=p_sucursal)
 then raise exception 'Asesor no pertenece a esta sucursal';end if;
 select * into v_existing from public.saas_cc_extensiones where organizacion_id=p_org and codigo=p_codigo for update;
 if found and v_existing.sucursal_id<>p_sucursal then raise exception 'La extensión pertenece a otra sucursal';end if;
 insert into public.saas_cc_extensiones(organizacion_id,sucursal_id,codigo,usuario_id,meta_mensual)
 values(p_org,p_sucursal,p_codigo,p_usuario,p_meta)
 on conflict(organizacion_id,codigo) do update set usuario_id=excluded.usuario_id,meta_mensual=excluded.meta_mensual
 returning id into v_id;
 return v_id;
end $$;
create or replace function public.saas_cc_asignar_base(
 p_org uuid,p_base uuid,p_usuario uuid,p_extension uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare b public.saas_cc_bases%rowtype;e public.saas_cc_extensiones%rowtype;
begin
 if (select auth.uid()) is null or mired_private.saas_rol(p_org) not in ('propietario','administrador')
 or not mired_private.saas_puede_escribir(p_org)
 or not mired_private.saas_modulo_activo(p_org,'llamadas')
 then raise exception 'No autorizado';end if;
 select * into b from public.saas_cc_bases where id=p_base and organizacion_id=p_org for update;
 if not found then raise exception 'Base no existe';end if;
 if p_usuario is not null and not exists(select 1 from public.saas_miembros m
  where m.organizacion_id=p_org and m.usuario_id=p_usuario and m.sucursal_id=b.sucursal_id)
 then raise exception 'Asesor no pertenece a esta sucursal';end if;
 if p_extension is not null then
  select * into e from public.saas_cc_extensiones where id=p_extension and organizacion_id=p_org;
  if not found or e.sucursal_id<>b.sucursal_id or (p_usuario is not null and e.usuario_id is distinct from p_usuario)
   then raise exception 'Extensión no corresponde a la asignación';end if;
 end if;
 update public.saas_cc_bases set asignado_a=p_usuario,extension_id=p_extension
 where id=b.id and organizacion_id=p_org;
 return found;
end $$;
create or replace function public.saas_cc_registrar_gestion(
 p_org uuid,p_contacto uuid,p_resultado text,p_notas text,p_proxima date)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.saas_cc_contactos%rowtype;b public.saas_cc_bases%rowtype;v_id uuid;
begin
 if (select auth.uid()) is null or not mired_private.saas_puede_escribir(p_org)
 or not mired_private.saas_modulo_activo(p_org,'llamadas')
 then raise exception 'Módulo no disponible';end if;
 if p_resultado not in ('Sin respuesta','Contactado','Interesado','Seguimiento','Venta','No interesado')
 or length(coalesce(p_notas,''))>2000
 then raise exception 'Resultado o notas no válidos';end if;
 select * into c from public.saas_cc_contactos where id=p_contacto and organizacion_id=p_org for update;
 if not found then raise exception 'Contacto no existe';end if;
 select * into b from public.saas_cc_bases where id=c.base_id and organizacion_id=p_org;
 if not found or b.estado<>'activa'
  or not mired_private.saas_puede_trabajar_sucursal(p_org,b.sucursal_id)
  or not mired_private.saas_cc_base_visible(p_org,b.id)
 then raise exception 'No tienes acceso a esta base activa';end if;
 update public.saas_cc_contactos set estado=p_resultado,proxima_llamada=p_proxima,
 observaciones=left(coalesce(p_notas,''),2000),gestionado_por=(select auth.uid()),actualizado_en=now()
 where id=c.id;
 insert into public.saas_cc_gestiones(organizacion_id,sucursal_id,base_id,contacto_id,usuario_id,resultado,notas,proxima_llamada)
 values(p_org,c.sucursal_id,c.base_id,c.id,(select auth.uid()),p_resultado,coalesce(p_notas,''),p_proxima)
 returning id into v_id;
 return v_id;
end $$;
revoke all on function public.saas_cc_guardar_extension(uuid,uuid,text,uuid,integer),
public.saas_cc_asignar_base(uuid,uuid,uuid,uuid),
public.saas_cc_registrar_gestion(uuid,uuid,text,text,date) from public,anon;
grant execute on function public.saas_cc_guardar_extension(uuid,uuid,text,uuid,integer),
public.saas_cc_asignar_base(uuid,uuid,uuid,uuid),
public.saas_cc_registrar_gestion(uuid,uuid,text,text,date) to authenticated;
