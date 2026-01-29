create table public.roles(
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    description text,
    created_at timestamp with time zone default now() not null
);

alter table public.roles enable row level security;

create policy "Authenticated can select roles"
on public.roles
for select
using (auth.role() = 'authenticated');

create policy "Block role inserts for authenticated"
on public.roles
for insert
to authenticated
with check (false);

create policy "Block role updates for authenticated"
on public.roles
for update
to authenticated
using (false)
with check (false);

create policy "Block role deletes for authenticated"
on public.roles
for delete
to authenticated
using (false);