create type public.committee_role as enum ('member', 'chair');

create table public.committee_members(
    profile_id uuid references public.profiles(id) on delete cascade,
    committee_id uuid references public.committees(id) on delete cascade,
    role public.committee_role not null default 'member',
    primary key (profile_id, committee_id)
);