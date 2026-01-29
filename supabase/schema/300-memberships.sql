create type public.membership_type as enum ('individual', 'sustaining', 'honorary', 'retiree', 'student');

create table public.memberships(
    id uuid primary key default gen_random_uuid(),
    profile_id uuid references public.profiles(id) on delete cascade,
    start_date date not null,
    end_date date not null default now(),
    membership_type public.membership_type not null default 'individual'
);

alter table public.memberships enable row level security;

create policy "Authenticated can select memberships"
on public.memberships
for select
to authenticated
using (true);

create policy "Permission manage_members to insert"
on public.memberships
for insert
to authenticated
with check (public.has_permission('manage_members'));

create policy "Permission manage_members to update"
on public.memberships
for update
to authenticated
using (public.has_permission('manage_members'))
with check (public.has_permission('manage_members'));

create policy "Permission manage_members to delete"
on public.memberships
for delete
to authenticated
using (public.has_permission('manage_members'));
