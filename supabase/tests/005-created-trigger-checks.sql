begin;

-- Count tables in public schema with created_by column
select plan((
  select count(*)::integer from information_schema.columns
  where table_schema = 'public' and column_name = 'created_by'
));

-- For each such table, check for the trigger and emit ok() statements
select ok(
  exists (
    select 1 from pg_trigger
    join pg_class on pg_trigger.tgrelid = pg_class.oid
    join pg_namespace on pg_class.relnamespace = pg_namespace.oid
    where pg_trigger.tgname = table_name || '_created_trigger'
      and pg_namespace.nspname = 'public'
      and pg_class.relname = table_name
  ),
  'public.' || table_name || ' has created trigger or does not require one'
)
from (
  select table_name
  from information_schema.columns
  where table_schema = 'public' and column_name = 'created_by'
) as tables_with_created_by;

select finish();
rollback;
