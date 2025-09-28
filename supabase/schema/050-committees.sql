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

