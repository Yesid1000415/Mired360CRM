-- Call Center Empresas: importación atómica de contactos y métricas por extensión real de gestión.
-- No altera los objetos del Call Center de telecomunicaciones original.

-- Todos los contactos de importación se normalizan a dígitos. Una base no debe
-- contener el mismo teléfono dos veces, incluso bajo importaciones concurrentes.
create unique index if not exists saas_cc_contactos_base_telefono_unico
 on public.saas_cc_contactos(base_id,(regexp_replace(telefono,'[^0-9]','','g')));

-- La extensión asignada se captura en el momento de la gestión.
-- Cambiar un asesor después no debe transferirle ventas históricas de otro.
alter table public.saas_cc_gestiones
 add column if not exists extension_id uuid;
alter table public.saas_cc_gestiones
 add constraint saas_cc_gestion_extension_org_fk
 foreign key(organizacion_id,extension_id)
 references public.saas_cc_extensiones(organizacion_id,id);
create index if not exists saas_cc_gestiones_ext_mes_idx
 on public.saas_cc_gestiones(organizacion_id,extension_id,creado_en desc);

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
  v_tel:=regexp_replace(coalesce(v_item->>'telefono',''),'[^0-9]','','g');
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
 insert into public.saas_cc_gestiones(organizacion_id,sucursal_id,base_id,contacto_id,usuario_id,resultado,notas,proxima_llamada,extension_id)
 values(p_org,c.sucursal_id,c.base_id,c.id,(select auth.uid()),p_resultado,coalesce(p_notas,''),p_proxima,b.extension_id)
 returning id into v_id;
 return v_id;
end $$;
revoke all on function public.saas_cc_registrar_gestion(uuid,uuid,text,text,date) from public,anon;
grant execute on function public.saas_cc_registrar_gestion(uuid,uuid,text,text,date) to authenticated;

-- Evita registrar una llamada asociada a un prospecto de otra sucursal de
-- la misma empresa (o de otra organización).
create or replace function mired_private.saas_llamada_contacto_coincide(
 p_org uuid,p_sucursal uuid,p_prospecto uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.saas_prospectos p
  where p.id=p_prospecto and p.organizacion_id=p_org and p.sucursal_id=p_sucursal);
$$;
revoke all on function mired_private.saas_llamada_contacto_coincide(uuid,uuid,uuid) from public,anon;
grant execute on function mired_private.saas_llamada_contacto_coincide(uuid,uuid,uuid) to authenticated;
alter policy saas_llamadas_crear on public.saas_llamadas
 with check(
  usuario_id=(select auth.uid())
  and mired_private.saas_puede_trabajar_sucursal(organizacion_id,sucursal_id)
  and mired_private.saas_modulo_activo(organizacion_id,'llamadas')
  and mired_private.saas_llamada_contacto_coincide(organizacion_id,sucursal_id,prospecto_id)
 );
