create extension if not exists pgcrypto;
create table if not exists public.reclutamiento_asesores (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 nombre text not null, telefono text not null, ciudad text, experiencia text, vendido text, canal text, origen text default 'Facebook Ads',
 meta_semanal integer default 0, notas text, estado text not null default 'Nuevo',
 prospectos integer not null default 0, instalados integer not null default 0, fecha_activacion timestamptz,
 creado_en timestamptz not null default now(), actualizado_en timestamptz not null default now()
);
alter table public.reclutamiento_asesores enable row level security;
drop policy if exists "reclutamiento_select_own" on public.reclutamiento_asesores;
drop policy if exists "reclutamiento_insert_own" on public.reclutamiento_asesores;
drop policy if exists "reclutamiento_update_own" on public.reclutamiento_asesores;
drop policy if exists "reclutamiento_delete_own" on public.reclutamiento_asesores;
create policy "reclutamiento_select_own" on public.reclutamiento_asesores for select to authenticated using (auth.uid()=user_id);
create policy "reclutamiento_insert_own" on public.reclutamiento_asesores for insert to authenticated with check (auth.uid()=user_id);
create policy "reclutamiento_update_own" on public.reclutamiento_asesores for update to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "reclutamiento_delete_own" on public.reclutamiento_asesores for delete to authenticated using (auth.uid()=user_id);
create index if not exists reclutamiento_user_estado_idx on public.reclutamiento_asesores(user_id,estado);
