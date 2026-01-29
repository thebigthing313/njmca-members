create schema if not exists private;

-- revoke all privileges from public for security
revoke all on schema private from public;

-- grant usage and create privileges to privileged roles
grant usage on schema private to postgres, service_role;
grant create on schema private to postgres, service_role;