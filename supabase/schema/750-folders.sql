create table public.folders(
    id uuid primary key default gen_random_uuid(),
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null, 
    created_by uuid references auth.users(id) on delete set null,
    updated_by uuid references auth.users(id) on delete set null,
    name text not null,
    description text,
    parent_id uuid references public.folders(id) on delete set null
);