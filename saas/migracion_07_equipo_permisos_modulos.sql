create or replace function public.saas_crear_invitacion(p_org uuid,p_correo text,p_rol text)
returns text language plpgsql security definer set search_path='' as $$
declare v_token text; v_email text;
begin
 if (select auth.uid()) is null or not mired_private.saas_es_propietario(p_org)
 or not mired_private.saas_puede_escribir(p_org)
 or not mired_private.saas_modulo_activo(p_org,'equipo') then
   raise exception 'No autorizado'; end if;
 v_email:=lower(btrim(coalesce(p_correo,'')));
 if char_length(v_email)>180 or v_email not like '%@%.%' then raise exception 'Correo inválido'; end if;
 if p_rol not in ('administrador','asesor') then raise exception 'Rol inválido'; end if;
 if (select count(*) from public.saas_invitaciones
      where organizacion_id=p_org and creado_en>now()-interval '1 hour')>=10
 then raise exception 'Límite de invitaciones por hora';end if;
 v_token:=replace(pg_catalog.gen_random_uuid()::text,'-','')||replace(pg_catalog.gen_random_uuid()::text,'-','');
 insert into public.saas_invitaciones (organizacion_id,correo,rol,hash_token,creado_por,vence_en)
 values (p_org,v_email,p_rol,encode(sha256(convert_to(v_token,'UTF8')),'hex'),(select auth.uid()),now()+interval '7 days');
 return v_token;
end; $$;

create or replace function public.saas_aceptar_invitacion(p_token text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_inv public.saas_invitaciones%rowtype; v_email text; v_uid uuid;
begin
 v_uid:=(select auth.uid());
 if v_uid is null or p_token is null or length(p_token)<>64 or p_token !~ '^[a-f0-9]+$'
 then raise exception 'Invitación inválida';end if;
 select lower(u.email) into v_email from auth.users u
 where u.id=v_uid and u.email_confirmed_at is not null;
 if v_email is null then raise exception 'Confirma tu correo antes de aceptar la invitación';end if;
 select * into v_inv from public.saas_invitaciones
 where hash_token=encode(sha256(convert_to(p_token,'UTF8')),'hex')
 and vence_en>now() and aceptada_en is null for update;
 if not found or v_inv.correo<>v_email then raise exception 'Invitación inválida o vencida';end if;
 if not mired_private.saas_modulo_activo(v_inv.organizacion_id,'equipo')
 then raise exception 'Módulo de equipo no habilitado';end if;
 insert into public.saas_miembros(organizacion_id,usuario_id,rol)
 values(v_inv.organizacion_id,v_uid,v_inv.rol)
 on conflict(organizacion_id,usuario_id) do nothing;
 update public.saas_invitaciones set aceptada_en=now() where id=v_inv.id;
 return v_inv.organizacion_id;
end; $$;


revoke all on function public.saas_crear_invitacion(uuid,text,text),public.saas_aceptar_invitacion(text) from public,anon;
grant execute on function public.saas_crear_invitacion(uuid,text,text),public.saas_aceptar_invitacion(text) to authenticated;
