-- Owner-only team directory for operational supervision (no exposing auth.users to clients).
create or replace function public.saas_listar_equipo(p_org uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_rows jsonb;
begin
 if (select auth.uid()) is null or not mired_private.saas_es_miembro(p_org)
 then raise exception 'No autorizado';end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'usuario_id',m.usuario_id,'rol',m.rol,'sucursal_id',m.sucursal_id,
  'correo',coalesce(u.email,'Usuario sin correo'),
  'creado_en',m.creado_en
 ) order by m.creado_en),'[]'::jsonb) into v_rows
 from public.saas_miembros m
 left join auth.users u on u.id=m.usuario_id
 where m.organizacion_id=p_org
 and (m.usuario_id=(select auth.uid()) or mired_private.saas_rol(p_org) in ('propietario','administrador'));
 return v_rows;
end $$;
revoke all on function public.saas_listar_equipo(uuid) from public,anon;
grant execute on function public.saas_listar_equipo(uuid) to authenticated;
