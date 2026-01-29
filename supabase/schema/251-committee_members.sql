create type public.committee_role as enum ('member', 'chair');

create table public.committee_members(
    profile_id uuid references public.profiles(id) on delete cascade,
    committee_id uuid references public.committees(id) on delete cascade,
    role public.committee_role not null default 'member',
    primary key (profile_id, committee_id)
);

alter table public.committee_members enable row level security;

create policy "Authenticated can select"
on public.committee_members
for select
to authenticated
using (true);

create policy "Permission manage_committees to insert"
on public.committee_members
for insert
to authenticated
with check (public.has_permission('manage_committees'));

create policy "Permission manage_committees to update"
on public.committee_members
for update
to authenticated
using (public.has_permission('manage_members'))
with check (public.has_permission('manage_members'));

create policy "Permission manage_committees to delete"
on public.committee_members
for delete
to authenticated
using (public.has_permission('manage_committees'));