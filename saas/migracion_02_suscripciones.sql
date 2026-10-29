-- MIRED360 SaaS v2: trusted-platform subscription activation and manual payment ledger.
-- Existing legacy CRM tables and policies remain untouched.
alter table public.saas_organizaciones
 add column if not exists vigente_hasta timestamptz;

create table if not exists public.saas_administradores_plataforma (
 usuario_id uuid primary key references auth.users(id) on delete cascade,
 creado_en timestamptz not null default now()
);
alter table public.saas_administradores_plataforma enable row level security;
revoke all on public.saas_administradores_plataforma from public,anon,authenticated;
insert into public.saas_administradores_plataforma(usuario_id)
select u.id from auth.users u
where lower(u.email)='ventas@mired360servicios.com'
  and u.email_confirmed_at is not null
on conflict do nothing;

create or replace function mired_private.saas_es_admin_plataforma() returns boolean
language sql stable security definer set search_path='' as $$
select (select auth.uid()) is not null and exists (
 select 1 from public.saas_administradores_plataforma a
 where a.usuario_id=(select auth.uid())
); $$;
revoke all on function mired_private.saas_es_admin_plataforma() from public,anon;
grant execute on function mired_private.saas_es_admin_plataforma() to authenticated;

create or replace function mired_private.saas_puede_escribir(p_org uuid) returns boolean
language sql stable security definer set search_path='' as $$
select (select auth.uid()) is not null
 and exists (select 1 from public.saas_miembros m where m.organizacion_id=p_org and m.usuario_id=(select auth.uid()))
 and exists (select 1 from public.saas_organizaciones o where o.id=p_org
   and ((o.estado_suscripcion='activa' and o.vigente_hasta>now())
     or (o.estado_suscripcion='prueba' and o.prueba_hasta>now())));
$$;

create table if not exists public.saas_activaciones (
 id uuid primary key default gen_random_uuid(),
 organizacion_id uuid not null references public.saas_organizaciones(id) on delete cascade,
 tipo text not null check (tipo in ('activacion','suspension')),
 plan text not null check (plan in ('esencial','equipo','empresa','prueba')),
 monto numeric(12,2) not null default 0 check(monto>=0),
 referencia text not null default '',
 observacion text not null default '',
 desde timestamptz,
 hasta timestamptz,
 registrado_por uuid not null references auth.users(id),
 creado_en timestamptz not null default now()
);
create index if not exists saas_activaciones_org_idx on public.saas_activaciones(organizacion_id,creado_en desc);
alter table public.saas_activaciones enable row level security;
revoke all on public.saas_activaciones from public,anon,authenticated;
grant select on public.saas_activaciones to authenticated;
create policy saas_activaciones_admin_ve on public.saas_activaciones for select to authenticated
using ((select mired_private.saas_es_admin_plataforma()));

create or replace function public.saas_admin_listar_empresas()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
 if (select auth.uid()) is null or not mired_private.saas_es_admin_plataforma() then raise exception 'No autorizado';end if;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.creado_en desc),'[]'::jsonb)
 into v_result from (
  select o.id,o.nombre,o.correo_facturacion,o.plan,o.estado_suscripcion,o.prueba_hasta,o.vigente_hasta,o.creado_en,
   (select count(*) from public.saas_miembros m where m.organizacion_id=o.id) as usuarios,
   (select count(*) from public.saas_prospectos p where p.organizacion_id=o.id) as prospectos
  from public.saas_organizaciones o
  order by o.creado_en desc limit 500
 ) t;
 return v_result;
end; $$;

create or replace function public.saas_admin_activar(p_org uuid,p_plan text,p_dias integer,p_monto numeric,p_referencia text)
returns timestamptz language plpgsql security definer set search_path='' as $$
declare v_org public.saas_organizaciones%rowtype; v_start timestamptz; v_end timestamptz;
begin
 if (select auth.uid()) is null or not mired_private.saas_es_admin_plataforma() then raise exception 'No autorizado';end if;
 if p_plan not in ('esencial','equipo','empresa') or p_dias not between 1 and 366
 then raise exception 'Plan o duración inválidos';end if;
 if p_monto is null or p_monto<0 or p_monto>100000000 then raise exception 'Monto inválido';end if;
 if char_length(btrim(coalesce(p_referencia,'')))<5 or char_length(p_referencia)>200
 then raise exception 'Registra una referencia o constancia de pago';end if;
 select * into v_org from public.saas_organizaciones where id=p_org for update;
 if not found then raise exception 'Empresa inexistente';end if;
 v_start:=greatest(now(),coalesce(v_org.vigente_hasta,now()));
 v_end:=v_start+make_interval(days=>p_dias);
 update public.saas_organizaciones set plan=p_plan,estado_suscripcion='activa',vigente_hasta=v_end where id=p_org;
 insert into public.saas_activaciones(organizacion_id,tipo,plan,monto,referencia,desde,hasta,registrado_por)
 values(p_org,'activacion',p_plan,p_monto,btrim(p_referencia),v_start,v_end,(select auth.uid()));
 return v_end;
end; $$;

create or replace function public.saas_admin_suspender(p_org uuid,p_motivo text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_org public.saas_organizaciones%rowtype;
begin
 if (select auth.uid()) is null or not mired_private.saas_es_admin_plataforma() then raise exception 'No autorizado';end if;
 if char_length(btrim(coalesce(p_motivo,'')))<8 then raise exception 'Explica brevemente el motivo';end if;
 select * into v_org from public.saas_organizaciones where id=p_org for update;
 if not found then raise exception 'Empresa inexistente';end if;
 update public.saas_organizaciones set estado_suscripcion='suspendida' where id=p_org;
 insert into public.saas_activaciones(organizacion_id,tipo,plan,monto,referencia,observacion,registrado_por)
 values(p_org,'suspension',v_org.plan,0,'Suspensión administrativa',left(btrim(p_motivo),1000),(select auth.uid()));
 return true;
end; $$;

revoke all on function public.saas_admin_listar_empresas() from public,anon;
revoke all on function public.saas_admin_activar(uuid,text,integer,numeric,text) from public,anon;
revoke all on function public.saas_admin_suspender(uuid,text) from public,anon;
grant execute on function public.saas_admin_listar_empresas(),public.saas_admin_activar(uuid,text,integer,numeric,text),public.saas_admin_suspender(uuid,text) to authenticated;
