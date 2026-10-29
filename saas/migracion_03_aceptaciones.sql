-- MIRED360 SaaS v3: recorded account acceptance and lead-authorization declarations.
-- New SaaS-only tables; no changes to legacy CRM.
create table if not exists public.saas_aceptaciones (
 usuario_id uuid not null references auth.users(id) on delete cascade,
 version text not null check (char_length(version) between 8 and 70),
 aceptado_en timestamptz not null default now(),
 primary key (usuario_id,version)
);
alter table public.saas_aceptaciones enable row level security;
revoke all on public.saas_aceptaciones from public,anon,authenticated;
grant select on public.saas_aceptaciones to authenticated;
grant insert (usuario_id,version) on public.saas_aceptaciones to authenticated;
create policy saas_aceptaciones_ver on public.saas_aceptaciones
 for select to authenticated using (usuario_id=(select auth.uid()));
create policy saas_aceptaciones_crear on public.saas_aceptaciones
 for insert to authenticated with check (usuario_id=(select auth.uid()));

alter table public.saas_prospectos
 add column if not exists autorizacion_confirmada boolean not null default false,
 add column if not exists autorizacion_fecha timestamptz not null default now();
grant insert (autorizacion_confirmada) on public.saas_prospectos to authenticated;
drop policy if exists saas_prospectos_crear on public.saas_prospectos;
create policy saas_prospectos_crear on public.saas_prospectos
 for insert to authenticated with check (
  creado_por=(select auth.uid()) and autorizacion_confirmada=true
  and (select mired_private.saas_puede_escribir(organizacion_id))
 );
comment on column public.saas_prospectos.autorizacion_confirmada is
 'Declaration by account user: they obtained authorization from the prospect; maintain independent evidence if required.';
