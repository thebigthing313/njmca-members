begin;
select plan(55); -- Update this number to match the total number of tests below

select has_schema('private', 'private schema exists');
select has_schema('public', 'public schema exists');

select has_enum('public', 'committee_role', 'committee_role enum exists');
select has_enum('public', 'membership_type', 'membership_type enum exists');
select has_enum('public', 'document_audience', 'document_audience enum exists');


select has_table('public', 'committees', 'committees table exists');
select has_column('public', 'committees', 'id', 'committees.id exists');
select has_column('public', 'committees', 'name', 'committees.name exists');
select has_column('public', 'committees', 'slug', 'committees.slug exists');

select has_table('public', 'committee_members', 'committee_members table exists');
select has_column('public', 'committee_members', 'profile_id', 'committee_members.profile_id exists');
select has_column('public', 'committee_members', 'committee_id', 'committee_members.committee_id exists');
select has_column('public', 'committee_members', 'role', 'committee_members.role exists');

select has_table('public', 'organizations', 'organizations table exists');
select has_column('public', 'organizations', 'id', 'organizations.id exists');
select has_column('public', 'organizations', 'name', 'organizations.name exists');

select has_table('public', 'profiles', 'profiles table exists');
select has_column('public', 'profiles', 'id', 'profiles.id exists');
select has_column('public', 'profiles', 'user_id', 'profiles.user_id exists');
select has_column('public', 'profiles', 'first_name', 'profiles.first_name exists');
select has_column('public', 'profiles', 'last_name', 'profiles.last_name exists');
select has_column('public', 'profiles', 'role_id', 'profiles.role_id exists');
select has_column('public', 'profiles', 'organization_id', 'profiles.organization_id exists');
select has_column('public', 'profiles', 'email_address', 'profiles.email_address exists');
select has_column('public', 'profiles', 'phone_number', 'profiles.phone_number exists');

select has_table('public', 'memberships', 'memberships table exists');
select has_column('public', 'memberships', 'id', 'memberships.id exists');
select has_column('public', 'memberships', 'profile_id', 'memberships.profile_id exists');
select has_column('public', 'memberships', 'membership_type', 'memberships.membership_type exists');

select has_table('public', 'roles', 'roles table exists');
select has_column('public', 'roles', 'id', 'roles.id exists');
select has_column('public', 'roles', 'name', 'roles.name exists');

select has_table('public', 'permissions', 'permissions table exists');
select has_column('public', 'permissions', 'id', 'permissions.id exists');
select has_column('public', 'permissions', 'name', 'permissions.name exists');

select has_table('public', 'role_permissions', 'role_permissions table exists');
select has_column('public', 'role_permissions', 'role_id', 'role_permissions.role_id exists');
select has_column('public', 'role_permissions', 'permission_id', 'role_permissions.permission_id exists');

select has_table('public', 'events', 'events table exists');
select has_column('public', 'events', 'id', 'events.id exists');
select has_column('public', 'events', 'name', 'events.name exists');

select has_table('public', 'announcements', 'announcements table exists');
select has_column('public', 'announcements', 'id', 'announcements.id exists');
select has_column('public', 'announcements', 'title', 'announcements.title exists');

select has_table('public', 'folders', 'folders table exists');
select has_column('public', 'folders', 'id', 'folders.id exists');
select has_column('public', 'folders', 'name', 'folders.name exists');

select has_table('public', 'documents', 'documents table exists');
select has_column('public', 'documents', 'id', 'documents.id exists');
select has_column('public', 'documents', 'title', 'documents.title exists');
select has_column('public', 'documents', 'audience', 'documents.audience exists');

select has_table('public', 'document_versions', 'document_versions table exists');
select has_column('public', 'document_versions', 'id', 'document_versions.id exists');
select has_column('public', 'document_versions', 'document_id', 'document_versions.document_id exists');
select has_column('public', 'document_versions', 'file_url', 'document_versions.file_url exists');

select * from finish();
rollback;
