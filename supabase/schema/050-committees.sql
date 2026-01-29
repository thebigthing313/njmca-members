create table public.committees(
    id uuid primary key default gen_random_uuid(),
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null,
    name text not null,
    description text,
    slug text not null,
    constraint committees_slug_unique unique (slug),
    constraint committees_name_unique unique (name)
);

alter table public.committees enable row level security;

create policy "Authenticated can select committees"
on public.committees
for select
using (auth.role() = 'authenticated');

create policy "Permission manage_committees to insert"
on public.committees
for insert
to authenticated
with check (public.has_permission('manage_committees'));

create policy "Permission manage_committees to update"
on public.committees
for update
to authenticated
using (public.has_permission('manage_committees'))
with check (public.has_permission('manage_committees'));

create policy "Permission manage_committees to delete"
on public.committees
for delete
to authenticated
using (public.has_permission('manage_committees'));