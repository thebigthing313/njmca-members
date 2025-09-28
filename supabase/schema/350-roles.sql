create table public.roles(
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    description text,
    created_at timestamp with time zone default now() not null
);

