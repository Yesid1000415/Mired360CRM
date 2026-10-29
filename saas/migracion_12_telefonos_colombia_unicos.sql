-- Identificadores telefónicos uniformes para evitar duplicados con/sin +57.
-- No convierte otros códigos internacionales ni descarta información de contacto.
create or replace function mired_private.saas_cc_telefono_clave(p_telefono text)
returns text language sql immutable parallel safe set search_path='' as $$
 select case when length(d)=12 and left(d,2)='57' and substring(d,3,1)='3'
 then right(d,10) else d end
 from (select pg_catalog.regexp_replace(coalesce(p_telefono,''),'[^0-9]','','g') as d) n;
$$;
revoke all on function mired_private.saas_cc_telefono_clave(text) from public,anon;
grant execute on function mired_private.saas_cc_telefono_clave(text) to authenticated;
drop index if exists public.saas_cc_contactos_base_telefono_unico;
create unique index saas_cc_contactos_base_telefono_unico
 on public.saas_cc_contactos(base_id,mired_private.saas_cc_telefono_clave(telefono));

create or replace function public.saas_cc_importar_contactos(
 p_org uuid,p_base uuid,p_registros jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_base public.saas_cc_bases%rowtype;
 v_item jsonb;
 v_nombre text;v_tel text;v_ciudad text;v_notas text;
 v_inserted uuid;
 v_importados int:=0;v_repetidos int:=0;v_invalidos int:=0;
 v_total int;
begin
 if (select auth.uid()) is null or p_org is null or p_base is null
  or not mired_private.saas_puede_escribir(p_org)
  or mired_private.saas_rol(p_org) not in ('propietario','administrador')
  or not mired_private.saas_modulo_activo(p_org,'llamadas')
 then raise exception 'Sin permiso para importar contactos';end if;
 if p_registros is null or jsonb_typeof(p_registros)<>'array'
 then raise exception 'Datos de importación inválidos';end if;
 v_total:=jsonb_array_length(p_registros);
 if v_total<1 or v_total>2000 then raise exception 'La importación requiere entre 1 y 2000 contactos';end if;
 select * into v_base from public.saas_cc_bases
 where organizacion_id=p_org and id=p_base for update;
 if not found or v_base.estado<>'activa'
  or not v_base.autorizacion_declarada
  or not mired_private.saas_puede_trabajar_sucursal(p_org,v_base.sucursal_id)
 then raise exception 'Base no disponible, inactiva o sin autorización';end if;

 for v_item in select value from jsonb_array_elements(p_registros) loop
  if jsonb_typeof(v_item)<>'object' then v_invalidos:=v_invalidos+1;continue;end if;
  v_nombre:=left(btrim(coalesce(v_item->>'nombre','')),150);
  v_tel:=mired_private.saas_cc_telefono_clave(coalesce(v_item->>'telefono',''));
  v_ciudad:=left(btrim(coalesce(v_item->>'ciudad','')),110);
  v_notas:=left(btrim(coalesce(v_item->>'observaciones','')),1000);
  if length(v_nombre)<2 or length(v_tel)<7 or length(v_tel)>18 then
    v_invalidos:=v_invalidos+1;continue;
  end if;
  v_inserted:=null;
  insert into public.saas_cc_contactos(organizacion_id,sucursal_id,base_id,nombre,telefono,ciudad,observaciones)
    values(p_org,v_base.sucursal_id,p_base,v_nombre,v_tel,v_ciudad,v_notas)
    on conflict do nothing returning id into v_inserted;
  if v_inserted is null then v_repetidos:=v_repetidos+1;
  else v_importados:=v_importados+1;end if;
 end loop;
 return jsonb_build_object('importados',v_importados,'repetidos',v_repetidos,'invalidos',v_invalidos,'solicitados',v_total);
end $$;

revoke all on function public.saas_cc_importar_contactos(uuid,uuid,jsonb) from public,anon;
grant execute on function public.saas_cc_importar_contactos(uuid,uuid,jsonb) to authenticated;
