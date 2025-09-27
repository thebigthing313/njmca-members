create table public.profiles (
    user_id uuid references auth.users(id) not null primary key,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null,
    first_name text not null,
    last_name text not null
);