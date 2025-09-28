create table public.role_permissions(
    role_id uuid references public.roles(id) on delete cascade,
    permission_id text references public.permissions(id) on delete cascade,
    created_at timestamp with time zone default now() not null,
    primary key (role_id, permission_id)
);