-- Checks if the current JWT contains a specific permission in app_metadata.permissions (array of strings)
create or replace function public.has_permission(permission text)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
    claims jsonb;
    permissions text[];
begin
    -- Get JWT claims from current session
    claims := auth.jwt();
    if claims is null then
        return false;
    end if;

    -- Extract permissions array from app_metadata
    permissions := (
        select array_agg(value::text)
        from jsonb_array_elements_text(
            claims -> 'app_metadata' -> 'permissions'
        ) as value
    );

    if permissions is null then
        return false;
    end if;

    -- Check if the requested permission exists in the array
    return permission = any(permissions);
end;
$$;