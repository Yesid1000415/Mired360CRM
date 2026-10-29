-- MIRED360 Call Center: pipeline real with required follow-up scheduling.
-- This alters only the SaaS management RPC, leaving the legacy call center untouched.
create or replace function public.saas_cc_registrar_gestion(
 p_org uuid,p_contacto uuid,p_resultado text,p_notas text,p_proxima date)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.saas_cc_contactos%rowtype;
 b public.saas_cc_bases%rowtype;v_id uuid;
 v_hoy date:=(now() at time zone 'America/Bogota')::date;
begin
 if (select auth.uid()) is null or not mired_private.saas_puede_escribir(p_org)
 or not mired_private.saas_modulo_activo(p_org,'llamadas')
 then raise exception 'Módulo no disponible' using errcode='42501';end if;
 if p_resultado not in ('Sin respuesta','Contactado','Interesado','Seguimiento','Venta','No interesado')
 or length(coalesce(p_notas,''))>2000
 then raise exception 'Resultado o notas no válidos' using errcode='22023';end if;
 select * into c from public.saas_cc_contactos
 where id=p_contacto and organizacion_id=p_org for update;
 if not found then raise exception 'Contacto no existe' using errcode='22023';end if;
 select * into b from public.saas_cc_bases
 where id=c.base_id and organizacion_id=p_org;
 if not found or b.estado<>'activa'
  or not mired_private.saas_puede_trabajar_sucursal(p_org,b.sucursal_id)
  or not mired_private.saas_cc_base_visible(p_org,b.id)
 then raise exception 'No tienes acceso a esta base activa' using errcode='42501';end if;
 if c.prospecto_id is not null
 then raise exception 'Esta venta ya fue trasladada al CRM. Gestiona el prospecto desde el CRM.'
 using errcode='22023';end if;
 if p_resultado in ('Interesado','Seguimiento') and p_proxima is null
 then raise exception 'Indica la fecha para dar seguimiento al cliente interesado.'
 using errcode='22023';end if;
 if p_resultado in ('Venta','No interesado') then
  p_proxima:=null;
 elsif p_proxima is not null and p_proxima<v_hoy then
  raise exception 'La fecha de próximo contacto no puede ser anterior a hoy.'
  using errcode='22023';
 end if;
 update public.saas_cc_contactos
 set estado=p_resultado,proxima_llamada=p_proxima,
 observaciones=left(coalesce(p_notas,''),2000),gestionado_por=(select auth.uid()),
 actualizado_en=now()
 where id=c.id;
 insert into public.saas_cc_gestiones(
  organizacion_id,sucursal_id,base_id,contacto_id,usuario_id,resultado,notas,proxima_llamada,extension_id)
 values(p_org,c.sucursal_id,c.base_id,c.id,(select auth.uid()),p_resultado,coalesce(p_notas,''),p_proxima,b.extension_id)
 returning id into v_id;
 return v_id;
end $$;
revoke all on function public.saas_cc_registrar_gestion(uuid,uuid,text,text,date) from public,anon;
grant execute on function public.saas_cc_registrar_gestion(uuid,uuid,text,text,date) to authenticated;
