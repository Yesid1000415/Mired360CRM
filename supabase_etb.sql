create table public.etb_solicitudes (
 id uuid primary key,
 owner_id uuid not null references auth.users(id),
 creado_en timestamptz not null default now(),
 tipo text not null check(tipo in ('Residencial','PyME')),
 nombre text not null, cedula text not null,
 expedicion date not null, nacimiento date not null,
 email text not null, telefono text not null, adicional text,
 direccion text not null, barrio text not null, ciudad text not null,
 estrato integer not null check(estrato between 1 and 6),
 plan text not null, velocidad integer not null check(velocidad>0),
 valor numeric not null check(valor>0), asesor text not null,
 fecha_solicitud date not null,
 frontal text not null, posterior text not null,
 consentimiento text not null, ip_hash text not null,
 estado text not null default 'Nueva' check(estado in ('Nueva','En validación','Radicada','Instalada','No viable')),
 notas text not null default ''
);
alter table public.etb_solicitudes enable row level security;
revoke all on public.etb_solicitudes from anon,authenticated;
grant select on public.etb_solicitudes to authenticated;
grant update(estado,notas) on public.etb_solicitudes to authenticated;
create policy etb_owner_read on public.etb_solicitudes for select to authenticated using(owner_id=(select auth.uid()));
create policy etb_owner_update on public.etb_solicitudes for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create index etb_owner_created on public.etb_solicitudes(owner_id,creado_en desc);
create index etb_rate on public.etb_solicitudes(ip_hash,creado_en);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('etb-documentos','etb-documentos',false,4194304,array['image/jpeg','image/png','image/webp']);
create policy etb_document_owner on storage.objects for select to authenticated using(bucket_id='etb-documentos' and exists(select 1 from public.etb_solicitudes s where s.owner_id=(select auth.uid()) and (s.frontal=name or s.posterior=name)));

grant select, insert, delete on public.etb_solicitudes to service_role;
