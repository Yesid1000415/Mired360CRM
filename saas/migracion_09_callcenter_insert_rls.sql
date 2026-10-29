-- Call Center: allow owners to see newly inserted bases via RETURNING;
-- and eliminate ambiguous correlated column references in import policies.
alter policy saas_cc_bases_leer on public.saas_cc_bases
 using(
  (mired_private.saas_rol(organizacion_id) in ('propietario','administrador'))
  or mired_private.saas_cc_base_visible(organizacion_id,id)
 );
create or replace function mired_private.saas_cc_base_pertenece(p_org uuid,p_branch uuid,p_base uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.saas_cc_bases b where b.id=p_base
 and b.organizacion_id=p_org and b.sucursal_id=p_branch
 and b.estado='activa' and b.autorizacion_declarada=true);
$$;
revoke all on function mired_private.saas_cc_base_pertenece(uuid,uuid,uuid) from public,anon;
grant execute on function mired_private.saas_cc_base_pertenece(uuid,uuid,uuid) to authenticated;
alter policy saas_cc_contactos_importar on public.saas_cc_contactos with check(
 mired_private.saas_puede_trabajar_sucursal(organizacion_id,sucursal_id)
 and mired_private.saas_modulo_activo(organizacion_id,'llamadas')
 and mired_private.saas_rol(organizacion_id) in ('propietario','administrador')
 and mired_private.saas_cc_base_pertenece(organizacion_id,sucursal_id,base_id)
);
