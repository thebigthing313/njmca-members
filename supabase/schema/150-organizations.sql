create table public.organizations(
    id uuid primary key default gen_random_uuid(),
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null,
    created_by uuid references auth.users(id) on delete set null,
    updated_by uuid references auth.users(id) on delete set null,
    is_sustaining_member boolean default false not null,
    name text not null,
    full_address text,
    phone_number text,
    fax_number text,
    email text,
    website_url text
);

alter table public.organizations enable row level security;

create policy "Authenticated can select organizations"
on public.organizations
for select
to authenticated
using (true);

create policy "Authenticated can insert"
on public.organizations
for insert
to authenticated
with check (true);

create policy "Permission manage_organizations to update"
on public.organizations
for update
to authenticated
using (public.has_permission('manage_organizations'))
with check (public.has_permission('manage_organizations'));

create policy "Permission manage_organizations to delete"
on public.organizations
for delete
to authenticated
using (public.has_permission('manage_organizations'));