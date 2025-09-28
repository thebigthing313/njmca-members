create table public.announcements(
    id uuid primary key default gen_random_uuid(),
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null,
    created_by uuid references auth.users(id) on delete set null,
    updated_by uuid references auth.users(id) on delete set null,
    title text not null,
    content text not null,
    is_published boolean default false not null,
    published_at timestamp with time zone
);