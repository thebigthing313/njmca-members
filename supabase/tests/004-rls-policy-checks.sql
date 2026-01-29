begin;

-- Count tables in public schema
select plan((
  select ((count(*) * 4)::integer) from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE'
));

-- For each table, check for one insert, update, select, and delete RLS policy
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = t.table_name
      and cmd = 'insert'
  ),
  'public.' || t.table_name || ' has INSERT RLS policy'
)
from information_schema.tables t
where t.table_schema = 'public' and t.table_type = 'BASE TABLE';

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = t.table_name
      and cmd = 'update'
  ),
  'public.' || t.table_name || ' has UPDATE RLS policy'
)
from information_schema.tables t
where t.table_schema = 'public' and t.table_type = 'BASE TABLE';

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = t.table_name
      and cmd = 'select'
  ),
  'public.' || t.table_name || ' has SELECT RLS policy'
)
from information_schema.tables t
where t.table_schema = 'public' and t.table_type = 'BASE TABLE';

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = t.table_name
      and cmd = 'delete'
  ),
  'public.' || t.table_name || ' has DELETE RLS policy'
)
from information_schema.tables t
where t.table_schema = 'public' and t.table_type = 'BASE TABLE';

select finish();
rollback;
