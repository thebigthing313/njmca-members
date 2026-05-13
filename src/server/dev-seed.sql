insert into members (
  id,
  user_id,
  first_name,
  last_name,
  email,
  email_normalized,
  is_active
) values
  (
    'dev-member-active',
    'dev-user-active-member',
    'Avery',
    'Active',
    'active.member.test@njmca.test',
    'active.member.test@njmca.test',
    true
  ),
  (
    'dev-member-inactive',
    'dev-user-inactive-member',
    'Indigo',
    'Inactive',
    'inactive.member.test@njmca.test',
    'inactive.member.test@njmca.test',
    false
  ),
  (
    'dev-member-email-mismatch',
    'dev-user-email-mismatch',
    'Morgan',
    'Mismatch',
    'old.email.test@njmca.test',
    'old.email.test@njmca.test',
    true
  ),
  (
    'dev-member-claimable',
    null,
    'Casey',
    'Claimable',
    'casey.claimable@njmca.test',
    'casey.claimable@njmca.test',
    true
  )
on conflict (id) do update set
  user_id = excluded.user_id,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  email = excluded.email,
  email_normalized = excluded.email_normalized,
  is_active = excluded.is_active,
  updated_at = now();
