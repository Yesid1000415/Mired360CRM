-- MIRED360 CRM Empresas · imported call-detail records (CDR).
-- Manually imported historical PBX records only; not provider API telemetry.
-- Distinct from sales/CRM gestiones and original telecom Call Center.
create table if not exists public.saas_cc_cdr (
 id uuid primary key default gen_random_uuid(),
 organizacion_id uuid not null references public.saas_organizaciones(id) on delete cascade,
 sucursal_id uuid not null,
 proveedor text not null default 'Comuniquemonos',
 id_externo text not null,
 telefono text not null,
 extension text not null default '',
 inicio timestamptz not null,
 duracion_segundos integer not null default 0 check(duracion_segundos between 0 and 86400),
 contestada boolean not null default false,
 direccion text not null check(direccion in ('entrante','saliente')),
 estado text not null default '',
 importado_por uuid not null,
 creado_en timestamptz not null default now(),
 unique (organizacion_id,proveedor,id_externo),
 foreign key (organizacion_id,sucursal_id) references public.saas_sucursales(organizacion_id,id)
);
create index if not exists saas_cc_cdr_org_inicio_idx on public.saas_cc_cdr (organizacion_id,inicio desc);
create index if not exists saas_cc_cdr_org_extension_idx on public.saas_cc_cdr (organizacion_id,extension,inicio desc);
alter table public.saas_cc_cdr enable row level security;
revoke all on public.saas_cc_cdr from public,anon,authenticated;
grant select on public.saas_cc_cdr to authenticated;
drop policy if exists saas_cc_cdr_gerencia_leer on public.saas_cc_cdr;
create policy saas_cc_cdr_gerencia_leer
 on public.saas_cc_cdr for select to authenticated
 using (
  mired_private.saas_rol(organizacion_id) in ('propietario','administrador')
  and mired_private.saas_modulo_activo(organizacion_id,'llamadas')
 );
create or replace function public.saas_cc_importar_cdr(
 p_org uuid,p_sucursal uuid,p_registros jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_item jsonb;v_extid text;v_phone text;v_extension text;v_inicio timestamptz;
 v_duration int;v_answer boolean;v_direction text;v_provider text;
 v_added uuid;v_new int:=0;v_duplicates int:=0;v_invalid int:=0;v_total int;
 v_date_text text;v_hash text;v_status text;
begin
 if (select auth.uid()) is null
   or not mired_private.saas_puede_escribir(p_org)
   or mired_private.saas_rol(p_org) not in ('propietario','administrador')
   or not mired_private.saas_modulo_activo(p_org,'llamadas')
 then raise exception 'Sin autorización para importar historial de telefonía' using errcode='42501';end if;
 if not exists(select 1 from public.saas_sucursales where id=p_sucursal and organizacion_id=p_org and activa)
 then raise exception 'Sucursal inválida o inactiva' using errcode='22023';end if;
 if p_registros is null or jsonb_typeof(p_registros)<>'array'
 then raise exception 'El archivo debe contener un listado' using errcode='22023';end if;
 v_total:=jsonb_array_length(p_registros);
 if v_total<1 or v_total>1000 then raise exception 'Carga entre 1 y 1000 llamadas por vez' using errcode='22023';end if;
 for v_item in select value from jsonb_array_elements(p_registros) loop
  if jsonb_typeof(v_item)<>'object' then v_invalid:=v_invalid+1;continue;end if;
  v_phone:=pg_catalog.regexp_replace(coalesce(v_item->>'telefono',''),'[^0-9]','','g');
  v_extension:=left(btrim(coalesce(v_item->>'extension','')),20);
  v_provider:='Comuniquemonos';
  v_status:=left(btrim(coalesce(v_item->>'estado','')),80);
  v_direction:=lower(coalesce(v_item->>'direccion',''));
  v_date_text:=coalesce(v_item->>'inicio','');
  if length(v_phone)<7 or length(v_phone)>18
     or v_direction not in ('entrante','saliente')
     or length(v_date_text)<19
     or v_date_text !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$'
     or coalesce(v_item->>'duracion_segundos','') !~ '^\d{1,5}$'
     or jsonb_typeof(v_item->'contestada') is distinct from 'boolean'
  then v_invalid:=v_invalid+1;continue;end if;
  begin
   v_inicio:=v_date_text::timestamptz;
   v_duration:=(v_item->>'duracion_segundos')::int;
   v_answer:=(v_item->>'contestada')::boolean;
  exception when others then v_invalid:=v_invalid+1;continue;end;
  if v_duration>86400 or v_inicio>'now'::timestamptz+interval '1 day'
     or v_inicio<'2000-01-01'::timestamptz
  then v_invalid:=v_invalid+1;continue;end if;
  v_extid:=left(btrim(coalesce(v_item->>'id_externo','')),120);
  if v_extid='' then
   v_hash:=(v_inicio::text||'|'||v_phone||'|'||v_extension||'|'||v_duration::text||'|'||v_direction);
   v_extid:='sin-id-'||md5(v_hash);
  end if;
  v_added:=null;
  insert into public.saas_cc_cdr(
   organizacion_id,sucursal_id,proveedor,id_externo,telefono,extension,inicio,
   duracion_segundos,contestada,direccion,estado,importado_por
  ) values(p_org,p_sucursal,v_provider,v_extid,v_phone,v_extension,v_inicio,
    v_duration,v_answer,v_direction,v_status,(select auth.uid()))
  on conflict (organizacion_id,proveedor,id_externo) do nothing returning id into v_added;
  if v_added is null then v_duplicates:=v_duplicates+1;else v_new:=v_new+1;end if;
 end loop;
 return jsonb_build_object('importados',v_new,'repetidos',v_duplicates,'invalidos',v_invalid,'solicitados',v_total);
end $$;
revoke all on function public.saas_cc_importar_cdr(uuid,uuid,jsonb) from public,anon;
grant execute on function public.saas_cc_importar_cdr(uuid,uuid,jsonb) to authenticated;
create or replace function public.saas_cc_resumen_cdr(p_org uuid,p_desde date,p_hasta date)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_result jsonb;
begin
 if (select auth.uid()) is null or coalesce(mired_private.saas_rol(p_org),'') not in ('propietario','administrador')
 or not mired_private.saas_modulo_activo(p_org,'llamadas') then
  raise exception 'No autorizado para consultar registros de central' using errcode='42501';
 end if;
 if p_desde is null or p_hasta is null or p_hasta<p_desde or p_hasta-p_desde>366 then
  raise exception 'Selecciona un período válido (máximo 367 días)' using errcode='22023';end if;
 select jsonb_build_object(
  'total',count(*),'contestadas',count(*) filter(where contestada),
  'no_contestadas',count(*) filter(where not contestada),
  'entrantes',count(*) filter(where direccion='entrante'),
  'salientes',count(*) filter(where direccion='saliente'),
  'minutos',coalesce(round(sum(duracion_segundos)::numeric/60,1),0),
  'extensiones',coalesce(
    (select jsonb_agg(jsonb_build_object('extension',extension,'total',total,'contestadas',contestadas)
                     order by total desc)
     from (select extension,count(*) total,count(*) filter(where contestada) contestadas
           from public.saas_cc_cdr
           where organizacion_id=p_org
            and inicio >= (p_desde::timestamp at time zone 'America/Bogota')
            and inicio < ((p_hasta+1)::timestamp at time zone 'America/Bogota')
           group by extension) e),'[]'::jsonb)
 ) into v_result
 from public.saas_cc_cdr
 where organizacion_id=p_org
  and inicio >= (p_desde::timestamp at time zone 'America/Bogota')
  and inicio < ((p_hasta+1)::timestamp at time zone 'America/Bogota');
 return v_result;
end $$;
revoke all on function public.saas_cc_resumen_cdr(uuid,date,date) from public,anon;
grant execute on function public.saas_cc_resumen_cdr(uuid,date,date) to authenticated;
