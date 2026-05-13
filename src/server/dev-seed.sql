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

insert into permissions (id, key, display_name) values
  ('permission-manage-members', 'manage_members', 'Manage members'),
  (
    'permission-manage-organizations',
    'manage_organizations',
    'Manage organizations'
  ),
  ('permission-manage-roles', 'manage_roles', 'Manage roles')
on conflict (id) do update set
  key = excluded.key,
  display_name = excluded.display_name;

insert into roles (id, key, display_name, assignment_mode) values
  ('role-webmaster', 'webmaster', 'Webmaster', 'multiple'),
  ('role-president', 'president', 'President', 'single'),
  ('role-secretary', 'secretary', 'Secretary', 'single'),
  ('role-trustee', 'trustee', 'Trustee', 'multiple')
on conflict (id) do update set
  key = excluded.key,
  display_name = excluded.display_name,
  assignment_mode = excluded.assignment_mode;

insert into role_permissions (role_id, permission_id) values
  ('role-webmaster', 'permission-manage-members'),
  ('role-webmaster', 'permission-manage-organizations'),
  ('role-webmaster', 'permission-manage-roles'),
  ('role-secretary', 'permission-manage-members')
on conflict (role_id, permission_id) do nothing;

insert into member_roles (id, member_id, role_id, starts_on, ends_on) values
  (
    'member-role-active-webmaster',
    'dev-member-active',
    'role-webmaster',
    null,
    null
  )
on conflict (id) do update set
  member_id = excluded.member_id,
  role_id = excluded.role_id,
  starts_on = excluded.starts_on,
  ends_on = excluded.ends_on;
