begin;

-- Count tables with both updated_at and updated_by columns
select plan((
  select count(*) from (
    select table_name
    from information_schema.columns
    where table_schema = 'public' and column_name = 'updated_at'
    intersect
    select table_name
    from information_schema.columns
    where table_schema = 'public' and column_name = 'updated_by'
  ) as tables_with_update
)::integer);

-- For each such table, check for the trigger and emit ok() statements
select ok(
  exists (
    select 1 from pg_trigger
    join pg_class on pg_trigger.tgrelid = pg_class.oid
    join pg_namespace on pg_class.relnamespace = pg_namespace.oid
    where pg_trigger.tgname = table_name || '_update_trigger'
      and pg_namespace.nspname = 'public'
      and pg_class.relname = table_name
  ),
  'public.' || table_name || ' has update trigger or does not require one'
)
from (
  select table_name
  from information_schema.columns
  where table_schema = 'public' and column_name = 'updated_at'
  intersect
  select table_name
  from information_schema.columns
  where table_schema = 'public' and column_name = 'updated_by'
) as tables_with_update;

select finish();
rollback;
