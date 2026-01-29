begin;

-- Test setup: Insert sample data
-- 1. Insert a role
insert into public.roles (id, name, description, created_at)
values ('00000000-0000-0000-0000-000000000010', 'member', 'Test role', now());

-- 2. Insert permissions
insert into public.permissions (id, name, created_at, description)
values ('perm_view', 'view', now(), 'View permission'),
       ('perm_edit', 'edit', now(), 'Edit permission');

-- 3. Map role to permissions
insert into public.role_permissions (role_id, permission_id, created_at)
values ('00000000-0000-0000-0000-000000000010', 'perm_view', now()),
       ('00000000-0000-0000-0000-000000000010', 'perm_edit', now());

-- 4. Insert a user
insert into auth.users (id, email, raw_app_meta_data)
values ('00000000-0000-0000-0000-000000000001', 'testuser@example.com', '{}'::jsonb);

-- 5. Insert a profile linked to the user and role
insert into public.profiles (id, user_id, created_at, updated_at, first_name, last_name, role_id, email_address, organization_id, phone_number)
values ('00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000001', now(), now(), 'Test', 'User', '00000000-0000-0000-0000-000000000010', 'testuser@example.com', null, '555-5555');

-- 6. Insert a committee
insert into public.committees (id, created_at, updated_at, name, description, slug)
values ('00000000-0000-0000-0000-000000001000', now(), now(), 'Finance', 'Finance Committee', 'finance');

insert into public.committee_members (profile_id, committee_id, role)
values ('00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000001000', 'member');

select plan(12);

select ok(
  exists (
    select 1 from auth.users u
    join public.profiles p on p.user_id = u.id
    where (u.raw_app_meta_data->>'profile_id') = p.id::text
  ),
  'auth.users.raw_app_meta_data updated with profile_id when profile inserted and user_id is not null'
);

-- 2. user inserted and there is a matching profile by e-mail
select ok(
  exists (
    select 1 from auth.users u
    join public.profiles p on lower(p.email_address) = lower(u.email)
    where (u.raw_app_meta_data->>'profile_id') = p.id::text
  ),
  'auth.users.raw_app_meta_data updated with profile_id when user inserted and matching profile by email'
);


-- 3. role_id is properly updated when profile is inserted or updated
select ok(
  exists (
    select 1 from auth.users u
    join public.profiles p on p.user_id = u.id
    where (u.raw_app_meta_data->>'role_id') = p.role_id::text
  ),
  'auth.users.raw_app_meta_data updated with role_id when profile inserted or updated'
);


-- 4. permissions list is properly updated when profile is inserted or updated
select ok(
  exists (
    select 1 from (
      select u.id as user_id, u.raw_app_meta_data, array_agg(perm.name) as permissions
      from auth.users u
      join public.profiles p on p.user_id = u.id
      join public.role_permissions rp on rp.role_id = p.role_id
      join public.permissions perm on perm.id = rp.permission_id
      group by u.id, u.raw_app_meta_data
    ) sub
    where sub.raw_app_meta_data->'permissions' @> to_jsonb(sub.permissions)
  ),
  'auth.users.raw_app_meta_data updated with permissions list when profile inserted or updated'
);



select ok(
  exists (
    select 1 from (
      select u.id as user_id, u.raw_app_meta_data, array_agg(jsonb_build_object('committee_id', cm.committee_id, 'committee_name', c.name, 'committee_role', cm.role)) as committees
      from auth.users u
      join public.profiles p on p.user_id = u.id
      join public.committee_members cm on cm.profile_id = p.id
      join public.committees c on c.id = cm.committee_id
      group by u.id, u.raw_app_meta_data
    ) sub
    where sub.raw_app_meta_data->'committee_memberships' @> to_jsonb(sub.committees)
  ),
  'auth.users.raw_app_meta_data updated with committee_memberships when committee_members inserted or updated'
);

-- 6. Update profile: change role_id
update public.profiles set role_id = null where id = '00000000-0000-0000-0000-000000000100';
select ok(
  exists (
    select 1 from auth.users u
    join public.profiles p on p.user_id = u.id
    where (u.raw_app_meta_data->>'role_id') is null
  ),
  'auth.users.raw_app_meta_data role_id is null after profile role_id is set to null'
);


-- 8. Update role_permissions: remove a permission
delete from public.role_permissions where permission_id = 'perm_edit' and role_id = '00000000-0000-0000-0000-000000000010';
select ok(
  exists (
    select 1 from (
      select u.id as user_id, u.raw_app_meta_data, array_agg(perm.name) as permissions
      from auth.users u
      join public.profiles p on p.user_id = u.id
      join public.role_permissions rp on rp.role_id = p.role_id
      join public.permissions perm on perm.id = rp.permission_id
      group by u.id, u.raw_app_meta_data
    ) sub
    where sub.raw_app_meta_data->'permissions' @> to_jsonb(sub.permissions)
      and jsonb_array_length(sub.raw_app_meta_data->'permissions') = 1
  ),
  'auth.users.raw_app_meta_data permissions list updated after role_permissions delete'
);

-- 9. Update committee_members: change role
update public.committee_members set role = 'chair' where profile_id = '00000000-0000-0000-0000-000000000100' and committee_id = '00000000-0000-0000-0000-000000001000';
select ok(
  exists (
    select 1 from (
      select u.id as user_id, u.raw_app_meta_data, array_agg(jsonb_build_object('committee_id', cm.committee_id, 'committee_name', c.name, 'committee_role', cm.role)) as committees
      from auth.users u
      join public.profiles p on p.user_id = u.id
      join public.committee_members cm on cm.profile_id = p.id
      join public.committees c on c.id = cm.committee_id
      group by u.id, u.raw_app_meta_data
    ) sub
    where sub.raw_app_meta_data->'committee_memberships' @> to_jsonb(sub.committees)
      and (sub.raw_app_meta_data->'committee_memberships'->0->>'committee_role') = 'chair'
  ),
  'auth.users.raw_app_meta_data committee_memberships updated after committee_members role update'
);

-- 10. Delete committee_members: remove membership
delete from public.committee_members where profile_id = '00000000-0000-0000-0000-000000000100' and committee_id = '00000000-0000-0000-0000-000000001000';
select ok(
  exists (
    select 1 from auth.users u
    where jsonb_array_length(u.raw_app_meta_data->'committee_memberships') = 0
  ),
  'auth.users.raw_app_meta_data committee_memberships cleared after committee_members delete'
);

-- 11. Delete profile: remove profile
delete from public.profiles where id = '00000000-0000-0000-0000-000000000100';
select ok(
  exists (
    select 1 from auth.users u
    where (u.raw_app_meta_data->>'profile_id') is null
  ),
  'auth.users.raw_app_meta_data profile_id cleared after profile delete'
);

-- 12. Delete role: remove role
delete from public.roles where id = '00000000-0000-0000-0000-000000000010';
select ok(
  exists (
    select 1 from auth.users u
    where (u.raw_app_meta_data->>'role_id') is null
  ),
  'auth.users.raw_app_meta_data role_id cleared after role delete'
);

-- 13. Delete permissions: remove all permissions
delete from public.permissions where id in ('perm_view', 'perm_edit');
select ok(
  exists (
    select 1 from auth.users u
    where jsonb_array_length(u.raw_app_meta_data->'permissions') = 0
  ),
  'auth.users.raw_app_meta_data permissions cleared after permissions delete'
);

select finish();
rollback;
