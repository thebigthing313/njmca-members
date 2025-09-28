create table public.profiles (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) unique,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null,
    first_name text not null,
    last_name text not null,
    email_address text unique,
    organization_id uuid references public.organizations(id) on delete set null,
    phone_number text
);