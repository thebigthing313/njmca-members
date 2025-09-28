create table public.permissions(
    id text primary key,
    name text not null unique,
    created_at timestamp with time zone default now() not null,
    description text
);