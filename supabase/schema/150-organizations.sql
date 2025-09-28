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