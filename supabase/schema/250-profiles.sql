create table public.profiles (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) unique,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null,
    first_name text not null,
    last_name text not null,
    role_id uuid references public.roles(id) on delete set null,
    email_address text unique,
    organization_id uuid references public.organizations(id) on delete set null,
    phone_number text
);

alter table public.profiles enable row level security;

create policy "Authenticated can select any profile"
on public.profiles
for select
to authenticated
using (true);

create policy "Permission manage_members to insert"
on public.profiles
for insert
to authenticated
with check (public.has_permission('manage_members'));

create policy "Permission manage_members to update"
on public.profiles
for update
to authenticated
using (public.has_permission('manage_members'))
with check (public.has_permission('manage_members'));

create policy "Permission manage_members to delete"
on public.profiles
for delete
to authenticated
using (public.has_permission('manage_members'));