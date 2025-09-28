create table public.document_versions(
    id uuid primary key default gen_random_uuid(),
    document_id uuid references public.documents(id) on delete cascade,
    created_at timestamp with time zone default now() not null,
    created_by uuid references auth.users(id) on delete set null,
    file_url text not null,
    notes text
);