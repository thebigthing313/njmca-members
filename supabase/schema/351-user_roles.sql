create table public.user_roles(
    user_id uuid references auth.users(id) on delete cascade,
    role_id uuid references public.roles(id) on delete cascade,
    created_at timestamp with time zone default now() not null,
    primary key (user_id, role_id)
);