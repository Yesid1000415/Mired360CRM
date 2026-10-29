-- MIRED360 SaaS operations hardening and admin module inventory.
create or replace function mired_private.saas_campana_pertenece_sucursal(p_org uuid,p_branch uuid,p_campaign uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select p_campaign is null or exists(select 1 from public.saas_campanas c where c.id=p_campaign
 and c.organizacion_id=p_org and c.sucursal_id=p_branch);
$$;
revoke all on function mired_private.saas_campana_pertenece_sucursal(uuid,uuid,uuid) from public,anon;
grant execute on function mired_private.saas_campana_pertenece_sucursal(uuid,uuid,uuid) to authenticated;
alter policy saas_prospectos_crear on public.saas_prospectos with check (
 creado_por=(select auth.uid()) and
 mired_private.saas_puede_trabajar_sucursal(organizacion_id,sucursal_id)
 and mired_private.saas_modulo_activo(organizacion_id,'crm')
 and mired_private.saas_campana_pertenece_sucursal(organizacion_id,sucursal_id,campana_id)
);
alter policy saas_prospectos_editar on public.saas_prospectos
 using (mired_private.saas_puede_trabajar_sucursal(organizacion_id,sucursal_id)
  and (creado_por=(select auth.uid()) or mired_private.saas_rol(organizacion_id) in ('propietario','administrador'))
  and mired_private.saas_modulo_activo(organizacion_id,'crm'))
 with check (mired_private.saas_puede_trabajar_sucursal(organizacion_id,sucursal_id)
  and (creado_por=(select auth.uid()) or mired_private.saas_rol(organizacion_id) in ('propietario','administrador'))
  and mired_private.saas_modulo_activo(organizacion_id,'crm')
  and mired_private.saas_campana_pertenece_sucursal(organizacion_id,sucursal_id,campana_id));
alter policy saas_sucursales_crear on public.saas_sucursales with check(
 mired_private.saas_puede_escribir(organizacion_id)
 and mired_private.saas_modulo_activo(organizacion_id,'sucursales')
 and mired_private.saas_rol(organizacion_id) in ('propietario','administrador'));
alter policy saas_sucursales_editar on public.saas_sucursales
 using(mired_private.saas_puede_escribir(organizacion_id)
 and mired_private.saas_modulo_activo(organizacion_id,'sucursales')
 and mired_private.saas_rol(organizacion_id) in ('propietario','administrador'))
 with check(mired_private.saas_puede_escribir(organizacion_id)
 and mired_private.saas_modulo_activo(organizacion_id,'sucursales')
 and mired_private.saas_rol(organizacion_id) in ('propietario','administrador'));
create or replace function public.saas_asignar_sucursal(p_org uuid,p_usuario uuid,p_sucursal uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if (select auth.uid()) is null or not mired_private.saas_es_propietario(p_org)
 then raise exception 'Solo el propietario puede asignar sucursales';end if;
 if not mired_private.saas_puede_escribir(p_org) or not mired_private.saas_modulo_activo(p_org,'sucursales')
 then raise exception 'Módulo de sucursales o suscripción no vigente';end if;
 if not exists(select 1 from public.saas_sucursales s where s.id=p_sucursal and s.organizacion_id=p_org and s.activa)
 then raise exception 'Sucursal inexistente o inactiva';end if;
 update public.saas_miembros set sucursal_id=p_sucursal
 where organizacion_id=p_org and usuario_id=p_usuario and rol<>'propietario';
 return found;
end $$;
revoke all on function public.saas_asignar_sucursal(uuid,uuid,uuid) from public,anon;
grant execute on function public.saas_asignar_sucursal(uuid,uuid,uuid) to authenticated;

create or replace function public.saas_admin_listar_modulos(p_org uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_rows jsonb;
begin
 if (select auth.uid()) is null or not mired_private.saas_es_admin_plataforma() then
  raise exception 'No autorizado';end if;
 select coalesce(jsonb_agg(jsonb_build_object('codigo',codigo,'activo',activo,'actualizado_en',actualizado_en)
 order by codigo),'[]'::jsonb) into v_rows
 from public.saas_modulos where organizacion_id=p_org;
 return v_rows;
end $$;
revoke all on function public.saas_admin_listar_modulos(uuid) from public,anon;
grant execute on function public.saas_admin_listar_modulos(uuid) to authenticated;
