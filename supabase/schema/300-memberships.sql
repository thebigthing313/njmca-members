create type public.membership_type as enum ('individual', 'sustaining', 'honorary', 'retiree', 'student');

create table public.memberships(
    id uuid primary key default gen_random_uuid(),
    profile_id uuid references public.profiles(id) on delete cascade,
    start_date date not null,
    end_date date not null default now(),
    membership_type public.membership_type not null default 'individual'
);