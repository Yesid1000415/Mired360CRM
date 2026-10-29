-- Endurecer control de acceso cuando la cuenta no pertenece a la empresa.
-- RLS sigue vigente: la función usa SECURITY INVOKER.
create index if not exists saas_cc_gestiones_org_fecha_idx
 on public.saas_cc_gestiones(organizacion_id,creado_en desc);

-- MIRED360 CRM Empresas · Reporte privado para supervisores del Call Center.
-- No modifica ninguna tabla del Call Center heredado.
-- SECURITY INVOKER + RLS evita exponer filas de empresas ajenas.
create or replace function public.saas_cc_reporte_gerencia(
 p_org uuid, p_desde date, p_hasta date
) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_result jsonb; v_rol text;
begin
 v_rol:=mired_private.saas_rol(p_org);
 if (select auth.uid()) is null or coalesce(v_rol,'') not in ('propietario','administrador')
 then raise exception 'No tienes permiso para consultar la supervisión empresarial' using errcode='42501';end if;
 if p_desde is null or p_hasta is null or p_hasta<p_desde
    or p_hasta-p_desde>366
 then raise exception 'Intervalo inválido: selecciona máximo 367 días' using errcode='22023';end if;
 if not mired_private.saas_modulo_activo(p_org,'llamadas')
 then raise exception 'El módulo Call Center no está habilitado' using errcode='42501';end if;
 with
 v_bases as materialized (
  select b.id,b.nombre,b.estado,b.sucursal_id,b.asignado_a,b.extension_id
  from public.saas_cc_bases b where b.organizacion_id=p_org
 ),
 v_contacts as materialized (
  select c.id,c.base_id,c.estado,c.proxima_llamada
  from public.saas_cc_contactos c join v_bases b on b.id=c.base_id
  where c.organizacion_id=p_org
 ),
 v_gestiones as materialized (
  select g.id,g.usuario_id,g.extension_id,g.base_id,g.contacto_id,g.resultado,
   (g.creado_en at time zone 'America/Bogota')::date as dia
  from public.saas_cc_gestiones g
  join v_bases b on b.id=g.base_id
  where g.organizacion_id=p_org
   and g.creado_en >= (p_desde::timestamp at time zone 'America/Bogota')
   and g.creado_en < ((p_hasta+1)::timestamp at time zone 'America/Bogota')
 ),
 v_hoy as (select (now() at time zone 'America/Bogota')::date as fecha),
 v_summary as (
  select jsonb_build_object(
   'bases', (select count(*) from v_bases),
   'contactos', (select count(*) from v_contacts),
   'pendientes', (select count(*) from v_contacts where estado='Pendiente'),
   'gestionados_actual', (select count(*) from v_contacts where estado<>'Pendiente'),
   'seguimientos_vencidos', (select count(*) from v_contacts,v_hoy where proxima_llamada<=fecha and estado not in ('Venta','No interesado')),
   'seguimientos_proximos', (select count(*) from v_contacts,v_hoy where proxima_llamada>fecha and proxima_llamada<=fecha+7 and estado not in ('Venta','No interesado')),
   'gestiones', (select count(*) from v_gestiones),
   'contactos_gestionados', (select count(distinct contacto_id) from v_gestiones),
   'ventas', (select count(distinct contacto_id) from v_gestiones where resultado='Venta'),
   'interesados', (select count(distinct contacto_id) from v_gestiones where resultado='Interesado'),
   'sin_respuesta', (select count(*) from v_gestiones where resultado='Sin respuesta'),
   'seguimientos_registrados', (select count(*) from v_gestiones where resultado='Seguimiento')
  ) as datos
 ),
 v_asesores as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'usuario_id',usuario_id,'gestiones',gestiones,'contactos',contactos,
    'ventas',ventas,'interesados',interesados,'seguimientos',seguimientos,
    'sin_respuesta',sin_respuesta
   ) order by gestiones desc), '[]'::jsonb) as datos
  from (
   select g.usuario_id,count(*) as gestiones,count(distinct g.contacto_id) as contactos,
     count(distinct g.contacto_id) filter(where g.resultado='Venta') as ventas,
     count(distinct g.contacto_id) filter(where g.resultado='Interesado') as interesados,
     count(*) filter(where g.resultado='Seguimiento') as seguimientos,
     count(*) filter(where g.resultado='Sin respuesta') as sin_respuesta
   from v_gestiones g group by g.usuario_id
  ) x
 ),
 v_extensions as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'codigo',codigo,'usuario_id',usuario_id,'meta',meta_mensual,
    'gestiones',gestiones,'contactos',contactos,'ventas',ventas
   ) order by codigo), '[]'::jsonb) as datos
  from (
   select e.id,e.codigo,e.usuario_id,e.meta_mensual,
    count(g.id) as gestiones,count(distinct g.contacto_id) as contactos,
    count(distinct g.contacto_id) filter(where g.resultado='Venta') as ventas
   from public.saas_cc_extensiones e left join v_gestiones g on g.extension_id=e.id
   where e.organizacion_id=p_org
   group by e.id,e.codigo,e.usuario_id,e.meta_mensual
  ) x
 ),
 v_days as (
  select coalesce(jsonb_agg(jsonb_build_object(
   'dia',dia,'gestiones',gestiones,'contactos',contactos,'ventas',ventas
  ) order by dia), '[]'::jsonb) as datos
  from (
   select g.dia,count(*) as gestiones,count(distinct g.contacto_id) as contactos,
    count(distinct g.contacto_id) filter(where g.resultado='Venta') as ventas
   from v_gestiones g group by g.dia
  ) x
 ),
 v_results as (
  select coalesce(jsonb_agg(jsonb_build_object('resultado',resultado,'total',total)
   order by total desc), '[]'::jsonb) as datos
  from (select resultado,count(*) total from v_gestiones group by resultado) x
 ),
 v_by_base as (
  select coalesce(jsonb_agg(jsonb_build_object(
   'id',id,'nombre',nombre,'estado',estado,'asignado_a',asignado_a,
   'sucursal_id',sucursal_id,'total',total,'gestionados',gestionados,
   'pendientes',pendientes,'ventas',ventas,'vencidos',vencidos
  ) order by nombre), '[]'::jsonb) as datos
  from (
   select b.id,b.nombre,b.estado,b.asignado_a,b.sucursal_id,
    count(c.id) as total,
    count(c.id) filter(where c.estado<>'Pendiente') as gestionados,
    count(c.id) filter(where c.estado='Pendiente') as pendientes,
    count(c.id) filter(where c.estado='Venta') as ventas,
    count(c.id) filter(where c.proxima_llamada<= (select fecha from v_hoy) and c.estado not in ('Venta','No interesado')) as vencidos
   from v_bases b left join v_contacts c on c.base_id=b.id
   group by b.id,b.nombre,b.estado,b.asignado_a,b.sucursal_id
  ) x
 )
 select jsonb_build_object(
  'desde',p_desde,'hasta',p_hasta,'summary',(select datos from v_summary),
  'asesores',(select datos from v_asesores),
  'extensiones',(select datos from v_extensions),
  'dias',(select datos from v_days),
  'resultados',(select datos from v_results),
  'bases',(select datos from v_by_base)
 ) into v_result;
 return v_result;
end $$;
revoke all on function public.saas_cc_reporte_gerencia(uuid,date,date) from public,anon;
grant execute on function public.saas_cc_reporte_gerencia(uuid,date,date) to authenticated;
