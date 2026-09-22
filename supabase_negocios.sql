-- Ejecutar en SQL Editor de Supabase antes de abrir Negocios Pymes.
-- El módulo es exclusivo de usuarios con perfil coordinador o administrador.
create sequence if not exists public.negocios_tat_seq;
create table if not exists public.negocios_tat (
  id uuid primary key default gen_random_uuid(),
  consecutivo text not null unique default ('TAT-' || to_char(current_date,'YYYYMM') || '-' || lpad(nextval('public.negocios_tat_seq')::text,5,'0')),
  user_id uuid not null default auth.uid() references auth.users(id),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  fecha_visita date not null default current_date,
  nombre_negocio text not null check(length(trim(nombre_negocio)) > 0),
  tipo_negocio text,
  nombre_encargado text not null check(length(trim(nombre_encargado)) > 0),
  cargo_encargado text,
  telefono text not null check(length(regexp_replace(telefono,'[^0-9]','','g')) >= 7),
  correo text,
  ciudad text not null,
  barrio text,
  direccion text not null,
  servicio_actual text,
  proveedor_actual text,
  pago_actual numeric(12,0) check(pago_actual >= 0),
  necesidades text,
  oferta_plan text,
  oferta_beneficios text,
  oferta_precio numeric(12,0) check(oferta_precio >= 0),
  oferta_condiciones text,
  resultado text not null default 'Visitado' check(resultado in ('Visitado','Interesado','Oferta enviada','Seguimiento','Venta','No interesado')),
  proximo_contacto date,
  observaciones text,
  nombre_asesor text not null,
  telefono_asesor text not null,
  firma text check(firma is null or (length(firma)<200000 and firma like 'data:image/png;base64,%')),
  autorizo_contacto boolean not null default false
);
create index if not exists negocios_tat_telefono_idx on public.negocios_tat (regexp_replace(telefono,'[^0-9]','','g'));
create index if not exists negocios_tat_seguimiento_idx on public.negocios_tat(proximo_contacto);
alter table public.negocios_tat enable row level security;
drop policy if exists "coordinacion consulta negocios" on public.negocios_tat;
create policy "coordinacion consulta negocios" on public.negocios_tat for select to authenticated using(public.es_coordinacion());
drop policy if exists "coordinacion crea negocios" on public.negocios_tat;
create policy "coordinacion crea negocios" on public.negocios_tat for insert to authenticated with check(public.es_coordinacion() and user_id=auth.uid());
drop policy if exists "coordinacion edita negocios" on public.negocios_tat;
create policy "coordinacion edita negocios" on public.negocios_tat for update to authenticated using(public.es_coordinacion()) with check(public.es_coordinacion());
grant select,insert,update on public.negocios_tat to authenticated;
grant usage,select on sequence public.negocios_tat_seq to authenticated;
-- Requiere la función public.es_coordinacion() definida en supabase_comisiones.sql.
