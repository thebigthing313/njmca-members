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
            -- Always update all users with the affected role, regardless of permission count
            for user_id in select public.profiles.user_id from public.profiles where public.profiles.role_id = v_role_id loop
                select jsonb_agg(p.name) into permissions
                from public.role_permissions rp
                join public.permissions p on p.id = rp.permission_id
                where rp.role_id = v_role_id;
                raise notice '[role_permissions] Updating user % with permissions: %', user_id, coalesce(permissions, '[]'::jsonb);
                perform private.update_user_app_metadata_value(
                    user_id,
                    'permissions',
                    coalesce(permissions, '[]'::jsonb)
                );
                -- Diagnostic: print final permissions value for every affected user
                raise notice '[role_permissions] Final permissions for user %: %', user_id, (select raw_app_meta_data->'permissions' from auth.users where id = user_id);
            end loop;
        end if;
        -- Final sweep: only clear permissions for users with a valid role but whose role has zero permissions
        for user_id in select p.user_id from public.profiles p left join public.role_permissions rp on rp.role_id = p.role_id where p.role_id is not null and rp.role_id is null loop
            raise notice '[role_permissions sweep] Clearing permissions for user %', user_id;
            perform private.update_user_app_metadata_value(
                user_id,
                'permissions',
                '[]'::jsonb
            );
            -- Diagnostic: print final permissions value for every affected user after sweep
            raise notice '[role_permissions sweep] Final permissions for user %: %', user_id, (select raw_app_meta_data->'permissions' from auth.users where id = user_id);
        end loop;
        return case when TG_OP = 'DELETE' then OLD else NEW end;
    elsif TG_TABLE_NAME = 'permissions' then
        -- Find all affected roles
        for v_role_id in select rp.role_id from public.role_permissions rp where rp.permission_id = coalesce(NEW.id, OLD.id) loop
            -- For each user with that role, update permissions
            for user_id in select public.profiles.user_id from public.profiles where public.profiles.role_id = v_role_id loop
                select jsonb_agg(p.name) into permissions
                from public.role_permissions rp
                join public.permissions p on p.id = rp.permission_id
                where rp.role_id = v_role_id;
                perform private.update_user_app_metadata_value(
                    user_id,
                    'permissions',
                    coalesce(permissions, '[]'::jsonb)
                );
            end loop;
        end loop;
        -- Final sweep: if no permissions remain for any user, set to []
        if TG_OP = 'DELETE' then
            if not exists (select 1 from public.permissions) then
                -- No permissions left, clear for all users
                for user_id in select id from auth.users loop
                    perform private.update_user_app_metadata_value(
                        user_id,
                        'permissions',
                        '[]'::jsonb
                    );
                end loop;
            end if;
            for user_id in select u.id from auth.users u left join public.profiles p on p.user_id = u.id left join public.role_permissions rp on rp.role_id = p.role_id where rp.role_id is null loop
                perform private.update_user_app_metadata_value(
                    user_id,
                    'permissions',
                    '[]'::jsonb
                );
            end loop;
            return OLD;
        else
            return NEW;
        end if;
    end if;
end;
$function$
;


