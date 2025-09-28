create table public.events(
    id uuid primary key default gen_random_uuid(),
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null,
    created_by uuid references auth.users(id) on delete set null,
    updated_by uuid references auth.users(id) on delete set null,
    name text not null,
    description text,
    start_time timestamp with time zone not null,
    end_time timestamp with time zone not null,
    is_all_day boolean default false not null,
    location text
);