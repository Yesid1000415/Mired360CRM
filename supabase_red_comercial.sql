begin;
create table public.red_asesores (
 user_id uuid primary key references public.perfiles(user_id),
 pais text not null check(pais in ('Colombia','Venezuela')),
 telefono text not null check(telefono ~ '^\+[1-9][0-9]{7,14}$'),
 modalidad text not null check(modalidad in ('Publicidad propia','Call center','Mixto')),
 medio_pago text not null default 'Por acordar' check(length(medio_pago)<=150),
 actualizado_en timestamptz not null default now()
);
create table public.red_gestiones (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references public.perfiles(user_id),
 nombre text not null check(length(trim(nombre)) between 2 and 150),
 telefono text not null check(telefono ~ '^57[0-9]{10}$'),
 ciudad text not null check(length(trim(ciudad)) between 2 and 100),
 barrio text not null default '', direccion text not null check(length(trim(direccion)) between 5 and 250),
 operador text not null default 'Claro', plan text not null default '',
 consentimiento_contacto boolean not null default true check(consentimiento_contacto),
 origen text not null check(origen in ('Publicidad propia','Call center','Redes sociales','Contacto directo')),
 estado text not null default 'Nuevo' check(estado in ('Nuevo','Validación solicitada','Cobertura confirmada','Sin cobertura','Venta enviada','En instalación','Instalado','Rechazado','Cancelado')),
 notas text not null default '', respuesta text not null default '',
 orden_trabajo text not null default '', fecha_instalacion date,
 comision numeric(12,2) not null default 0 check(comision>=0),
 estado_comision text not null default 'Pendiente' check(estado_comision in ('Pendiente','Aprobada','Pagada')),
 fecha_pago date, creado_en timestamptz not null default now(), actualizado_en timestamptz not null default now()
);
create index red_gestiones_owner on public.red_gestiones(user_id,creado_en desc);
create table public.red_soporte (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references public.perfiles(user_id),
 gestion_id uuid references public.red_gestiones(id),
 tema text not null check(tema in ('Cobertura','Venta','Instalación','Comisión','Acceso','Otro')),
 mensaje text not null check(length(trim(mensaje)) between 5 and 3000),
 estado text not null default 'Abierto' check(estado in ('Abierto','En atención','Resuelto')),
 respuesta text not null default '', creado_en timestamptz not null default now(), actualizado_en timestamptz not null default now()
);
create index red_soporte_owner on public.red_soporte(user_id);
create index red_soporte_gestion on public.red_soporte(gestion_id);
create table public.red_canales (id boolean primary key default true check(id), telegram_url text not null default '' check(telegram_url='' or telegram_url ~ '^https://t\.me/[A-Za-z0-9_+/-]+$'));
insert into public.red_canales(id) values(true);
create table public.red_historial (
 id bigint generated always as identity primary key, gestion_id uuid not null references public.red_gestiones(id),
 actor_id uuid references auth.users(id), estado text not null, respuesta text not null default '', creado_en timestamptz not null default now()
);
create index red_historial_gestion on public.red_historial(gestion_id);
create index red_historial_actor on public.red_historial(actor_id);
create schema if not exists crm_private;
create function public.red_acceso() returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.perfiles where user_id=(select auth.uid()) and activo is not false and rol in ('asesor','coordinador','administrador','admin'))
$$;
create function public.red_coordinacion() returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.perfiles where user_id=(select auth.uid()) and activo is not false and rol in ('coordinador','administrador','admin'))
$$;
revoke all on function public.red_acceso(),public.red_coordinacion() from public,anon;
grant execute on function public.red_acceso(),public.red_coordinacion() to authenticated;
alter table public.red_asesores enable row level security;
alter table public.red_gestiones enable row level security;
alter table public.red_soporte enable row level security;
alter table public.red_canales enable row level security;
alter table public.red_historial enable row level security;
revoke all on public.red_asesores,public.red_gestiones,public.red_soporte,public.red_canales,public.red_historial from anon,authenticated;
grant select,insert,update on public.red_asesores,public.red_gestiones,public.red_soporte to authenticated;
grant select,update on public.red_canales to authenticated;
grant select on public.red_historial to authenticated;
create policy red_perfil_read on public.red_asesores for select to authenticated using((select public.red_acceso()) and (user_id=(select auth.uid()) or (select public.red_coordinacion())));
create policy red_perfil_insert on public.red_asesores for insert to authenticated with check((select public.red_acceso()) and (user_id=(select auth.uid()) or (select public.red_coordinacion())));
create policy red_perfil_update on public.red_asesores for update to authenticated using((select public.red_acceso()) and (user_id=(select auth.uid()) or (select public.red_coordinacion()))) with check((select public.red_acceso()) and (user_id=(select auth.uid()) or (select public.red_coordinacion())));
create policy red_gestion_read on public.red_gestiones for select to authenticated using((select public.red_acceso()) and (user_id=(select auth.uid()) or (select public.red_coordinacion())));
create policy red_gestion_insert on public.red_gestiones for insert to authenticated with check((select public.red_acceso()) and user_id=(select auth.uid()));
create policy red_gestion_update on public.red_gestiones for update to authenticated using((select public.red_acceso()) and (user_id=(select auth.uid()) or (select public.red_coordinacion()))) with check((select public.red_acceso()) and (user_id=(select auth.uid()) or (select public.red_coordinacion())));
create policy red_soporte_read on public.red_soporte for select to authenticated using((select public.red_acceso()) and (user_id=(select auth.uid()) or (select public.red_coordinacion())));
create policy red_soporte_insert on public.red_soporte for insert to authenticated with check((select public.red_acceso()) and user_id=(select auth.uid()) and (gestion_id is null or exists(select 1 from public.red_gestiones g where g.id=gestion_id and g.user_id=(select auth.uid()))));
create policy red_soporte_update on public.red_soporte for update to authenticated using((select public.red_coordinacion())) with check((select public.red_coordinacion()));
create policy red_canales_read on public.red_canales for select to authenticated using((select public.red_acceso()));
create policy red_canales_update on public.red_canales for update to authenticated using((select public.red_coordinacion())) with check((select public.red_coordinacion()));
create policy red_historial_read on public.red_historial for select to authenticated using(exists(select 1 from public.red_gestiones g where g.id=gestion_id));
create function crm_private.red_guardar() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='UPDATE' and new.user_id<>old.user_id then raise exception 'No se puede cambiar el propietario.'; end if;
 if TG_TABLE_NAME='red_gestiones' then
  if not public.red_coordinacion() then
   if TG_OP='INSERT' then
    if new.estado<>'Nuevo' or new.respuesta<>'' or new.orden_trabajo<>'' or new.fecha_instalacion is not null or new.comision<>0 or new.estado_comision<>'Pendiente' or new.fecha_pago is not null then raise exception 'La aprobación corresponde a coordinación.'; end if;
   else
    if row(new.respuesta,new.orden_trabajo,new.fecha_instalacion,new.comision,new.estado_comision,new.fecha_pago) is distinct from row(old.respuesta,old.orden_trabajo,old.fecha_instalacion,old.comision,old.estado_comision,old.fecha_pago) then raise exception 'La aprobación corresponde a coordinación.'; end if;
    if old.estado not in ('Nuevo','Rechazado','Sin cobertura') and row(new.nombre,new.telefono,new.ciudad,new.barrio,new.direccion,new.operador,new.plan,new.origen) is distinct from row(old.nombre,old.telefono,old.ciudad,old.barrio,old.direccion,old.operador,old.plan,old.origen) then raise exception 'Solicite a coordinación la corrección de la venta enviada.'; end if;
    if new.estado<>old.estado and not ((old.estado in ('Nuevo','Rechazado','Sin cobertura') and new.estado='Validación solicitada') or (old.estado='Cobertura confirmada' and new.estado='Venta enviada' and length(trim(new.plan))>0)) then raise exception 'Transición reservada a coordinación o cobertura pendiente.'; end if;
   end if;
  end if;
  if new.estado='Instalado' and (new.fecha_instalacion is null or new.orden_trabajo='') then raise exception 'Registre fecha de instalación y orden de trabajo.'; end if;
  if new.estado_comision in ('Aprobada','Pagada') and new.estado<>'Instalado' then raise exception 'La comisión requiere instalación confirmada.'; end if;
  if new.estado_comision='Pagada' and new.fecha_pago is null then raise exception 'Registre la fecha de pago.'; end if;
 elsif TG_TABLE_NAME='red_soporte' and TG_OP='INSERT' and (new.estado<>'Abierto' or new.respuesta<>'') then raise exception 'El soporte debe iniciar abierto.';
 end if;
 if TG_OP='UPDATE' then new.creado_en=old.creado_en; end if;
 new.actualizado_en=now(); return new;
end $$;
revoke all on function crm_private.red_guardar() from public,anon,authenticated;
create trigger red_gestion_guard before insert or update on public.red_gestiones for each row execute function crm_private.red_guardar();
create trigger red_soporte_guard before insert or update on public.red_soporte for each row execute function crm_private.red_guardar();
create function crm_private.red_auditar() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' then insert into public.red_historial(gestion_id,actor_id,estado,respuesta) values(new.id,auth.uid(),new.estado,new.respuesta);
 elsif row(new.estado,new.respuesta,new.estado_comision,new.comision) is distinct from row(old.estado,old.respuesta,old.estado_comision,old.comision) then insert into public.red_historial(gestion_id,actor_id,estado,respuesta) values(new.id,auth.uid(),new.estado,new.respuesta||' · Comisión: '||new.estado_comision||' COP '||new.comision::text); end if;
 return new;
end $$;
revoke all on function crm_private.red_auditar() from public,anon,authenticated;
create trigger red_gestion_audit after insert or update on public.red_gestiones for each row execute function crm_private.red_auditar();
commit;
