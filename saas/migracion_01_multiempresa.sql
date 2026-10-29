-- MIRED360 SaaS v1. Separate tables; no modification of legacy CRM.
-- A company created by a user has a 14-day trial. Billing activation remains manual.
create schema if not exists mired_private;
revoke all on schema mired_private from public, anon;
grant usage on schema mired_private to authenticated;

create table if not exists public.saas_organizaciones (
 id uuid primary key default gen_random_uuid(),
 nombre text not null check (char_length(trim(nombre)) between 3 and 120),
 correo_facturacion text not null check (char_length(correo_facturacion) between 5 and 180),
 propietario_id uuid not null references auth.users(id) on delete restrict,
 plan text not null default 'prueba' check (plan in ('prueba','esencial','equipo','empresa')),
 estado_suscripcion text not null default 'prueba' check (estado_suscripcion in ('prueba','activa','vencida','suspendida')),
 prueba_hasta timestamptz not null default (now() + interval '14 days'),
 creado_en timestamptz not null default now(),
 unique (propietario_id)
);
create table if not exists public.saas_miembros (
 organizacion_id uuid not null references public.saas_organizaciones(id) on delete cascade,
 usuario_id uuid not null references auth.users(id) on delete cascade,
 rol text not null check (rol in ('propietario','administrador','asesor')),
 creado_en timestamptz not null default now(),
 primary key (organizacion_id,usuario_id)
);
create index if not exists saas_miembros_usuario_idx on public.saas_miembros(usuario_id);

create table if not exists public.saas_prospectos (
 id uuid primary key default gen_random_uuid(),
 organizacion_id uuid not null references public.saas_organizaciones(id) on delete cascade,
 creado_por uuid not null references auth.users(id) on delete restrict,
 nombre text not null check (char_length(trim(nombre)) between 2 and 130),
 telefono text not null default '' check (char_length(telefono)<=30),
 correo text not null default '' check (char_length(correo)<=180),
 ciudad text not null default '' check (char_length(ciudad)<=110),
 origen text not null default 'Manual' check (char_length(origen)<=70),
 producto text not null default '' check (char_length(producto)<=110),
 estado text not null default 'Nuevo' check (estado in ('Nuevo','Contactado','Seguimiento','Venta','Instalado','Perdido')),
 valor_mensual numeric(12,2) not null default 0 check (valor_mensual>=0),
 proximo_seguimiento date,
 notas text not null default '' check (char_length(notas)<=5000),
 creado_en timestamptz not null default now(),
 actualizado_en timestamptz not null default now(),
 unique (id, organizacion_id)
);
create index if not exists saas_prospectos_org_idx on public.saas_prospectos(organizacion_id, creado_en desc);
create index if not exists saas_prospectos_estado_idx on public.saas_prospectos(organizacion_id, estado);

create table if not exists public.saas_actividades (
 id uuid primary key default gen_random_uuid(),
 organizacion_id uuid not null references public.saas_organizaciones(id) on delete cascade,
 prospecto_id uuid not null,
 usuario_id uuid not null references auth.users(id) on delete restrict,
 tipo text not null check (tipo in ('nota','llamada','seguimiento','cambio_estado')),
 detalle text not null check (char_length(trim(detalle)) between 1 and 2000),
 creado_en timestamptz not null default now(),
 foreign key (prospecto_id,organizacion_id) references public.saas_prospectos(id,organizacion_id) on delete cascade
);
create index if not exists saas_actividad_org_idx on public.saas_actividades(organizacion_id, creado_en desc);

create table if not exists public.saas_invitaciones (
 id uuid primary key default gen_random_uuid(),
 organizacion_id uuid not null references public.saas_organizaciones(id) on delete cascade,
 correo text not null,
 rol text not null check (rol in ('administrador','asesor')),
 hash_token text not null unique,
 creado_por uuid not null references auth.users(id) on delete restrict,
 vence_en timestamptz not null,
 aceptada_en timestamptz,
 creado_en timestamptz not null default now()
);
create index if not exists saas_invites_org_idx on public.saas_invitaciones(organizacion_id,creado_en desc);

-- Private predicates use only JWT's verified auth.uid(), not user-editable metadata.
create or replace function mired_private.saas_es_miembro(p_org uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and exists(
   select 1 from public.saas_miembros m where m.organizacion_id=p_org and m.usuario_id=(select auth.uid())
 );
$$;
create or replace function mired_private.saas_es_propietario(p_org uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and exists(
   select 1 from public.saas_organizaciones o where o.id=p_org and o.propietario_id=(select auth.uid())
 );
$$;
create or replace function mired_private.saas_rol(p_org uuid) returns text
 language sql stable security definer set search_path='' as $$
 select m.rol from public.saas_miembros m
 where m.organizacion_id=p_org and m.usuario_id=(select auth.uid()) limit 1;
$$;
create or replace function mired_private.saas_puede_escribir(p_org uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null
  and exists (select 1 from public.saas_miembros m where m.organizacion_id=p_org and m.usuario_id=(select auth.uid()))
  and exists (
   select 1 from public.saas_organizaciones o where o.id=p_org and (
     o.estado_suscripcion='activa' or (o.estado_suscripcion='prueba' and o.prueba_hasta>now())
   )
  );
$$;
revoke all on function mired_private.saas_es_miembro(uuid) from public,anon;
revoke all on function mired_private.saas_es_propietario(uuid) from public,anon;
revoke all on function mired_private.saas_rol(uuid) from public,anon;
revoke all on function mired_private.saas_puede_escribir(uuid) from public,anon;
grant execute on function mired_private.saas_es_miembro(uuid),mired_private.saas_es_propietario(uuid),mired_private.saas_rol(uuid),mired_private.saas_puede_escribir(uuid) to authenticated;

alter table public.saas_organizaciones enable row level security;
alter table public.saas_miembros enable row level security;
alter table public.saas_prospectos enable row level security;
alter table public.saas_actividades enable row level security;
alter table public.saas_invitaciones enable row level security;
revoke all on public.saas_organizaciones,public.saas_miembros,public.saas_prospectos,public.saas_actividades,public.saas_invitaciones from public,anon,authenticated;
grant select on public.saas_organizaciones,public.saas_miembros,public.saas_prospectos,public.saas_actividades,public.saas_invitaciones to authenticated;
grant insert (nombre,correo_facturacion,propietario_id) on public.saas_organizaciones to authenticated;
grant update (nombre,correo_facturacion) on public.saas_organizaciones to authenticated;
grant insert (organizacion_id,usuario_id,rol) on public.saas_miembros to authenticated;
grant insert (organizacion_id,creado_por,nombre,telefono,correo,ciudad,origen,producto,estado,valor_mensual,proximo_seguimiento,notas) on public.saas_prospectos to authenticated;
grant update (nombre,telefono,correo,ciudad,origen,producto,estado,valor_mensual,proximo_seguimiento,notas,actualizado_en) on public.saas_prospectos to authenticated;
grant delete on public.saas_prospectos to authenticated;
grant insert (organizacion_id,prospecto_id,usuario_id,tipo,detalle) on public.saas_actividades to authenticated;
-- Invitations can only be written through the validated RPCs below.

create policy saas_org_ver on public.saas_organizaciones
 for select to authenticated using (propietario_id=(select auth.uid()) or (select mired_private.saas_es_miembro(id)));
create policy saas_org_crear on public.saas_organizaciones
 for insert to authenticated with check (propietario_id=(select auth.uid()));
create policy saas_org_editar on public.saas_organizaciones
 for update to authenticated using (propietario_id=(select auth.uid()))
 with check (propietario_id=(select auth.uid()));

create policy saas_miembros_ver on public.saas_miembros for select to authenticated
 using (usuario_id=(select auth.uid()) or (select mired_private.saas_es_propietario(organizacion_id)));
create policy saas_miembros_crear_propietario on public.saas_miembros for insert to authenticated
 with check (usuario_id=(select auth.uid()) and rol='propietario' and (select mired_private.saas_es_propietario(organizacion_id)));

create policy saas_prospectos_ver on public.saas_prospectos for select to authenticated
 using ((select mired_private.saas_es_miembro(organizacion_id)));
create policy saas_prospectos_crear on public.saas_prospectos for insert to authenticated
 with check (creado_por=(select auth.uid()) and (select mired_private.saas_puede_escribir(organizacion_id)));
create policy saas_prospectos_editar on public.saas_prospectos for update to authenticated
 using ((select mired_private.saas_puede_escribir(organizacion_id)) and
  (creado_por=(select auth.uid()) or (select mired_private.saas_rol(organizacion_id)) in ('propietario','administrador')))
 with check ((select mired_private.saas_puede_escribir(organizacion_id)) and
  (creado_por=(select auth.uid()) or (select mired_private.saas_rol(organizacion_id)) in ('propietario','administrador')));
create policy saas_prospectos_borrar on public.saas_prospectos for delete to authenticated
 using ((select mired_private.saas_puede_escribir(organizacion_id)) and
   (select mired_private.saas_rol(organizacion_id)) in ('propietario','administrador'));

create policy saas_actividad_ver on public.saas_actividades for select to authenticated
 using ((select mired_private.saas_es_miembro(organizacion_id)));
create policy saas_actividad_crear on public.saas_actividades for insert to authenticated
 with check (usuario_id=(select auth.uid()) and (select mired_private.saas_puede_escribir(organizacion_id)));

create policy saas_invitaciones_ver on public.saas_invitaciones for select to authenticated
 using ((select mired_private.saas_es_propietario(organizacion_id)));

-- RPCs need elevated rights only for one-time membership acceptance and token issuance.
-- Exposed public functions: authenticated only, verified email in auth.users on acceptance.
create or replace function public.saas_crear_invitacion(p_org uuid,p_correo text,p_rol text)
returns text language plpgsql security definer set search_path='' as $$
declare v_token text; v_email text;
begin
 if (select auth.uid()) is null or not mired_private.saas_es_propietario(p_org) then
   raise exception 'No autorizado'; end if;
 v_email:=lower(btrim(coalesce(p_correo,'')));
 if char_length(v_email)>180 or v_email not like '%@%.%' then raise exception 'Correo inválido'; end if;
 if p_rol not in ('administrador','asesor') then raise exception 'Rol inválido'; end if;
 if (select count(*) from public.saas_invitaciones
      where organizacion_id=p_org and creado_en>now()-interval '1 hour')>=10
 then raise exception 'Límite de invitaciones por hora';end if;
 v_token:=replace(pg_catalog.gen_random_uuid()::text,'-','')||replace(pg_catalog.gen_random_uuid()::text,'-','');
 insert into public.saas_invitaciones (organizacion_id,correo,rol,hash_token,creado_por,vence_en)
 values (p_org,v_email,p_rol,encode(sha256(convert_to(v_token,'UTF8')),'hex'),(select auth.uid()),now()+interval '7 days');
 return v_token;
end; $$;

create or replace function public.saas_aceptar_invitacion(p_token text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_inv public.saas_invitaciones%rowtype; v_email text; v_uid uuid;
begin
 v_uid:=(select auth.uid());
 if v_uid is null or p_token is null or length(p_token)<>64 or p_token !~ '^[a-f0-9]+$'
 then raise exception 'Invitación inválida';end if;
 select lower(u.email) into v_email from auth.users u
 where u.id=v_uid and u.email_confirmed_at is not null;
 if v_email is null then raise exception 'Confirma tu correo antes de aceptar la invitación';end if;
 select * into v_inv from public.saas_invitaciones
 where hash_token=encode(sha256(convert_to(p_token,'UTF8')),'hex')
 and vence_en>now() and aceptada_en is null for update;
 if not found or v_inv.correo<>v_email then raise exception 'Invitación inválida o vencida';end if;
 insert into public.saas_miembros(organizacion_id,usuario_id,rol)
 values(v_inv.organizacion_id,v_uid,v_inv.rol)
 on conflict(organizacion_id,usuario_id) do nothing;
 update public.saas_invitaciones set aceptada_en=now() where id=v_inv.id;
 return v_inv.organizacion_id;
end; $$;

create or replace function public.saas_retirar_miembro(p_org uuid,p_usuario uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if (select auth.uid()) is null or not mired_private.saas_es_propietario(p_org)
 then raise exception 'No autorizado';end if;
 if p_usuario=(select auth.uid()) then raise exception 'No puedes retirarte como propietario';end if;
 delete from public.saas_miembros where organizacion_id=p_org and usuario_id=p_usuario and rol<>'propietario';
 return found;
end; $$;

revoke all on function public.saas_crear_invitacion(uuid,text,text) from public,anon;
revoke all on function public.saas_aceptar_invitacion(text) from public,anon;
revoke all on function public.saas_retirar_miembro(uuid,uuid) from public,anon;
grant execute on function public.saas_crear_invitacion(uuid,text,text),public.saas_aceptar_invitacion(text),public.saas_retirar_miembro(uuid,uuid) to authenticated;
comment on table public.saas_organizaciones is 'MIRED360 SaaS: isolated orgs; subscription activation by trusted administrator only';
comment on table public.saas_prospectos is 'MIRED360 SaaS: no legacy CRM data, strict organization RLS';
