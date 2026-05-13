create table if not exists members (
  id text primary key,
  user_id text unique,
  first_name text not null,
  last_name text not null,
  email text,
  email_normalized text unique,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint members_email_normalized_matches_email
    check (
      email is null
      or email_normalized = lower(btrim(email))
    ),
  constraint members_email_normalized_required_when_email_present
    check (
      (email is null and email_normalized is null)
      or (email is not null and email_normalized is not null)
    )
);

create table if not exists audit_events (
  id text primary key,
  actor_user_id text,
  actor_member_id text references members(id),
  subject_type text not null,
  subject_id text not null,
  event_type text not null,
  transaction_method text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_events_transaction_method_known
    check (transaction_method in ('manual', 'csv_import', 'seed', 'system'))
);

create table if not exists member_claims (
  id text primary key,
  member_id text not null references members(id),
  email_normalized text not null,
  expires_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
