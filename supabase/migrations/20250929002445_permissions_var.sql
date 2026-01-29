set check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.update_user_permissions_in_app_metadata()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
    permissions jsonb;
    user_id uuid;
    v_role_id uuid;
begin
    if TG_TABLE_NAME = 'profiles' then
        if TG_OP = 'DELETE' then
            user_id := OLD.user_id;
            v_role_id := OLD.role_id;
        else
            user_id := NEW.user_id;
            v_role_id := NEW.role_id;
        end if;
        if user_id is not null and v_role_id is not null then
            select jsonb_agg(permission)
            into permissions
            from (
                select p.name as permission
                from public.role_permissions rp
                join public.permissions p on p.id = rp.permission_id
                where rp.role_id = v_role_id
            ) sub;
            perform private.update_user_app_metadata_value(
                user_id,
                'permissions',
                coalesce(permissions, '[]'::jsonb)
            );
        end if;
        if TG_OP = 'DELETE' then
            return OLD;
        else
            return NEW;
        end if;
    elsif TG_TABLE_NAME = 'role_permissions' then
        if TG_OP = 'DELETE' then
            v_role_id := OLD.role_id;
        else
            v_role_id := NEW.role_id;
        end if;
        if v_role_id is not null then
            for user_id in select public.profiles.user_id from public.profiles where public.profiles.role_id = v_role_id loop
                select jsonb_agg(permission)
                into permissions
                from (
                    select p.name as permission
                    from public.role_permissions rp
                    join public.permissions p on p.id = rp.permission_id
                    where rp.role_id = v_role_id
                ) sub;
                perform private.update_user_app_metadata_value(
                    user_id,
                    'permissions',
                    coalesce(permissions, '[]'::jsonb)
                );
            end loop;
        end if;
        if TG_OP = 'DELETE' then
            return OLD;
        else
            return NEW;
        end if;
    elsif TG_TABLE_NAME = 'permissions' then
        for v_role_id in select rp.role_id from public.role_permissions rp where rp.permission_id = coalesce(NEW.id, OLD.id) loop
            for user_id in select public.profiles.user_id from public.profiles where public.profiles.role_id = v_role_id loop
                select jsonb_agg(permission)
                into permissions
                from (
                    select p.name as permission
                    from public.role_permissions rp
                    join public.permissions p on p.id = rp.permission_id
                    where rp.role_id = v_role_id
                ) sub;
                perform private.update_user_app_metadata_value(
                    user_id,
                    'permissions',
                    coalesce(permissions, '[]'::jsonb)
                );
            end loop;
        end loop;
        if TG_OP = 'DELETE' then
            return OLD;
        else
            return NEW;
        end if;
    end if;
end;
$function$
;


