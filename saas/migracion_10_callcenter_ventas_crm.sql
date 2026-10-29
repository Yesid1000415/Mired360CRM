-- Vinculación voluntaria de ventas de Call Center con el CRM empresarial.
alter table public.saas_prospectos
 add constraint saas_prospectos_org_id_unicos unique(organizacion_id,id);
alter table public.saas_cc_contactos add column if not exists prospecto_id uuid;
alter table public.saas_cc_contactos
 add constraint saas_cc_contactos_prospecto_empresa_fk
 foreign key(organizacion_id,prospecto_id)
 references public.saas_prospectos(organizacion_id,id);
create unique index if not exists saas_cc_contactos_prospecto_unico
 on public.saas_cc_contactos(organizacion_id,prospecto_id) where prospecto_id is not null;

create or replace function public.saas_cc_pasar_crm(
 p_org uuid,p_contacto uuid,p_producto text,p_valor numeric)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_contact public.saas_cc_contactos%rowtype;
 v_base public.saas_cc_bases%rowtype;v_lead uuid;
begin
 if (select auth.uid()) is null or not mired_private.saas_puede_escribir(p_org)
 or not mired_private.saas_modulo_activo(p_org,'crm')
 or not mired_private.saas_modulo_activo(p_org,'llamadas')
 then raise exception 'Módulos o suscripción no vigentes';end if;
 if length(btrim(coalesce(p_producto,''))) not between 3 and 110
 or p_valor is null or p_valor<0 or p_valor>100000000
 then raise exception 'Indica producto y valor válidos';end if;
 select * into v_contact from public.saas_cc_contactos
 where id=p_contacto and organizacion_id=p_org for update;
 if not found then raise exception 'Contacto inexistente';end if;
 select * into v_base from public.saas_cc_bases
 where id=v_contact.base_id and organizacion_id=p_org;
 if not found or v_base.estado<>'activa'
 or not mired_private.saas_cc_base_visible(p_org,v_base.id)
 or not mired_private.saas_puede_trabajar_sucursal(p_org,v_base.sucursal_id)
 then raise exception 'Sin permiso de conversión';end if;
 if v_contact.prospecto_id is not null then raise exception 'Esta venta ya está registrada en el CRM';end if;
 if v_contact.estado<>'Venta' then raise exception 'Solo se convierte un contacto con resultado Venta';end if;
 insert into public.saas_prospectos(organizacion_id,sucursal_id,creado_por,nombre,telefono,ciudad,
 origen,producto,estado,valor_mensual,proximo_seguimiento,notas,
 autorizacion_confirmada)
 values(p_org,v_contact.sucursal_id,(select auth.uid()),v_contact.nombre,v_contact.telefono,v_contact.ciudad,
  'Llamada',btrim(p_producto),'Venta',p_valor,v_contact.proxima_llamada,
  'Convertido desde Call Center · Base: '||left(v_base.nombre,110),true)
 returning id into v_lead;
 update public.saas_cc_contactos set prospecto_id=v_lead,actualizado_en=now() where id=p_contacto;
 insert into public.saas_actividades(organizacion_id,prospecto_id,usuario_id,tipo,detalle)
 values(p_org,v_lead,(select auth.uid()),'nota','Venta registrada desde la base de Call Center');
 return v_lead;
end $$;
create or replace function public.saas_cc_estado_base(p_org uuid,p_base uuid,p_estado text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_base public.saas_cc_bases%rowtype;
begin
 if (select auth.uid()) is null or mired_private.saas_rol(p_org) not in ('propietario','administrador')
 or not mired_private.saas_puede_escribir(p_org)
 or not mired_private.saas_modulo_activo(p_org,'llamadas')
 then raise exception 'No autorizado';end if;
 if p_estado not in ('activa','pausada') then raise exception 'Estado inválido';end if;
 select * into v_base from public.saas_cc_bases where id=p_base and organizacion_id=p_org for update;
 if not found or not mired_private.saas_puede_ver_sucursal(p_org,v_base.sucursal_id) then
 raise exception 'Base no autorizada';end if;
 update public.saas_cc_bases set estado=p_estado where id=v_base.id;
 return true;
end $$;
revoke all on function public.saas_cc_pasar_crm(uuid,uuid,text,numeric),
public.saas_cc_estado_base(uuid,uuid,text) from public,anon;
grant execute on function public.saas_cc_pasar_crm(uuid,uuid,text,numeric),
public.saas_cc_estado_base(uuid,uuid,text) to authenticated;
