create type public.document_audience as enum ('members', 'board_of_trustees', 'executive_committee');

create table public.documents(
    id uuid primary key default gen_random_uuid(),
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null,
    created_by uuid references auth.users(id) on delete set null,
    updated_by uuid references auth.users(id) on delete set null,
    title text not null,
    folder_id uuid references public.folders(id) on delete set null,
    description text,
    audience public.document_audience not null default 'members'
);
