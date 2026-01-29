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
                perform private.update_user_app_metadata_value(
                    user_id,
                    'permissions',
                    coalesce(permissions, '[]'::jsonb)
                );
            end loop;
        end if;
        -- Final sweep: if no permissions remain for any user, set to []
        for user_id in select u.id from auth.users u left join public.profiles p on p.user_id = u.id left join public.role_permissions rp on rp.role_id = p.role_id where rp.role_id is null loop
            perform private.update_user_app_metadata_value(
                user_id,
                'permissions',
                '[]'::jsonb
            );
        end loop;
        if TG_OP = 'DELETE' then
            return OLD;
        else
            return NEW;
        end if;
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


alter table "public"."committee_members" enable row level security;

alter table "public"."committees" enable row level security;

alter table "public"."memberships" enable row level security;

alter table "public"."organizations" enable row level security;

alter table "public"."profiles" enable row level security;

alter table "public"."roles" enable row level security;

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.has_permission(permission text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$
;

create policy "Authenticated can select"
on "public"."committee_members"
as permissive
for select
to authenticated
using (true);


create policy "Permission manage_committees to delete"
on "public"."committee_members"
as permissive
for delete
to authenticated
using (has_permission('manage_committees'::text));


create policy "Permission manage_committees to insert"
on "public"."committee_members"
as permissive
for insert
to authenticated
with check (has_permission('manage_committees'::text));


create policy "Permission manage_committees to update"
on "public"."committee_members"
as permissive
for update
to authenticated
using (has_permission('manage_members'::text))
with check (has_permission('manage_members'::text));


create policy "Authenticated can select committees"
on "public"."committees"
as permissive
for select
to public
using ((auth.role() = 'authenticated'::text));


create policy "Permission manage_committees to delete"
on "public"."committees"
as permissive
for delete
to authenticated
using (has_permission('manage_committees'::text));


create policy "Permission manage_committees to insert"
on "public"."committees"
as permissive
for insert
to authenticated
with check (has_permission('manage_committees'::text));


create policy "Permission manage_committees to update"
on "public"."committees"
as permissive
for update
to authenticated
using (has_permission('manage_committees'::text))
with check (has_permission('manage_committees'::text));


create policy "Authenticated can select memberships"
on "public"."memberships"
as permissive
for select
to authenticated
using (true);


create policy "Permission manage_members to delete"
on "public"."memberships"
as permissive
for delete
to authenticated
using (has_permission('manage_members'::text));


create policy "Permission manage_members to insert"
on "public"."memberships"
as permissive
for insert
to authenticated
with check (has_permission('manage_members'::text));


create policy "Permission manage_members to update"
on "public"."memberships"
as permissive
for update
to authenticated
using (has_permission('manage_members'::text))
with check (has_permission('manage_members'::text));


create policy "Authenticated can insert"
on "public"."organizations"
as permissive
for insert
to authenticated
with check (true);


create policy "Authenticated can select organizations"
on "public"."organizations"
as permissive
for select
to authenticated
using (true);


create policy "Permission manage_organizations to delete"
on "public"."organizations"
as permissive
for delete
to authenticated
using (has_permission('manage_organizations'::text));


create policy "Permission manage_organizations to update"
on "public"."organizations"
as permissive
for update
to authenticated
using (has_permission('manage_organizations'::text))
with check (has_permission('manage_organizations'::text));


create policy "Authenticated can select any profile"
on "public"."profiles"
as permissive
for select
to authenticated
using (true);


create policy "Permission manage_members to delete"
on "public"."profiles"
as permissive
for delete
to authenticated
using (has_permission('manage_members'::text));


create policy "Permission manage_members to insert"
on "public"."profiles"
as permissive
for insert
to authenticated
with check (has_permission('manage_members'::text));


create policy "Permission manage_members to update"
on "public"."profiles"
as permissive
for update
to authenticated
using (has_permission('manage_members'::text))
with check (has_permission('manage_members'::text));


create policy "Authenticated can select roles"
on "public"."roles"
as permissive
for select
to public
using ((auth.role() = 'authenticated'::text));


create policy "Block role deletes for authenticated"
on "public"."roles"
as permissive
for delete
to authenticated
using (false);


create policy "Block role inserts for authenticated"
on "public"."roles"
as permissive
for insert
to authenticated
with check (false);


create policy "Block role updates for authenticated"
on "public"."roles"
as permissive
for update
to authenticated
using (false)
with check (false);



