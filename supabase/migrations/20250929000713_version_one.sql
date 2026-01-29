create schema if not exists "private";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.update_user_app_metadata()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
    json_key text := TG_ARGV[0];
    value_column text := TG_ARGV[1];
    value jsonb;
    user_id uuid;
begin
    if TG_OP = 'DELETE' then
        user_id := OLD.user_id;
        value := null;
    else
        user_id := NEW.user_id;
        execute format('select to_jsonb($1.%I)', value_column) into value using NEW;
    end if;
    if user_id is not null then
        update auth.users
        set raw_app_meta_data = jsonb_set(
            coalesce(auth.users.raw_app_meta_data, '{}'::jsonb),
            array[json_key],
            coalesce(value, 'null'::jsonb)
        )
        where id = user_id;
    end if;
    if TG_OP = 'DELETE' then
        return OLD;
    else
        return NEW;
    end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.update_user_app_metadata_value(p_user_id uuid, p_json_key text, p_value jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
    if p_user_id is not null then
        update auth.users
        set raw_app_meta_data = jsonb_set(
            coalesce(auth.users.raw_app_meta_data, '{}'::jsonb),
            array[p_json_key],
            p_value
        )
        where id = p_user_id;
    end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.update_user_committees_in_app_metadata()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
    committees jsonb;
    user_id uuid;
begin
    if TG_OP = 'DELETE' then
        select p.user_id into user_id from public.profiles p where p.id = OLD.profile_id;
        if user_id is not null and exists (select 1 from auth.users where id = user_id) then
            select jsonb_agg(row_to_json(c))
            into committees
            from (
                select
                    cm.committee_id,
                    c.name as committee_name,
                    cm.role as committee_role
                from public.committee_members cm
                join public.committees c on c.id = cm.committee_id
                where cm.profile_id = OLD.profile_id
            ) c;
            perform private.update_user_app_metadata_value(
                user_id,
                'committee_memberships',
                coalesce(committees, '[]'::jsonb)
            );
        end if;
        return OLD;
    else
        select p.user_id into user_id from public.profiles p where p.id = NEW.profile_id;
        if user_id is not null and exists (select 1 from auth.users where id = user_id) then
            select jsonb_agg(row_to_json(c))
            into committees
            from (
                select
                    cm.committee_id,
                    c.name as committee_name,
                    cm.role as committee_role
                from public.committee_members cm
                join public.committees c on c.id = cm.committee_id
                where cm.profile_id = NEW.profile_id
            ) c;
            perform private.update_user_app_metadata_value(
                user_id,
                'committee_memberships',
                coalesce(committees, '[]'::jsonb)
            );
        end if;
        return NEW;
    end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.update_user_permissions_in_app_metadata()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
    permissions jsonb;
    user_id uuid;
    role_id uuid;
begin
    if TG_TABLE_NAME = 'profiles' then
        if TG_OP = 'DELETE' then
            user_id := OLD.user_id;
            role_id := OLD.role_id;
        else
            user_id := NEW.user_id;
            role_id := NEW.role_id;
        end if;
        if user_id is not null and role_id is not null then
            select jsonb_agg(permission)
            into permissions
            from (
                select p.name as permission
                from public.role_permissions rp
                join public.permissions p on p.id = rp.permission_id
                where rp.role_id = role_id
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
            role_id := OLD.role_id;
        else
            role_id := NEW.role_id;
        end if;
        if role_id is not null then
            for user_id in select user_id from public.profiles where role_id = role_id loop
                select jsonb_agg(permission)
                into permissions
                from (
                    select p.name as permission
                    from public.role_permissions rp
                    join public.permissions p on p.id = rp.permission_id
                    where rp.role_id = role_id
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
        for role_id in select rp.role_id from public.role_permissions rp where rp.permission_id = coalesce(NEW.id, OLD.id) loop
            for user_id in select user_id from public.profiles where role_id = role_id loop
                select jsonb_agg(permission)
                into permissions
                from (
                    select p.name as permission
                    from public.role_permissions rp
                    join public.permissions p on p.id = rp.permission_id
                    where rp.role_id = role_id
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


create type "public"."committee_role" as enum ('member', 'chair');

create type "public"."document_audience" as enum ('members', 'board_of_trustees', 'executive_committee');

create type "public"."membership_type" as enum ('individual', 'sustaining', 'honorary', 'retiree', 'student');

create table "public"."announcements" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "created_by" uuid,
    "updated_by" uuid,
    "title" text not null,
    "content" text not null,
    "is_published" boolean not null default false,
    "published_at" timestamp with time zone
);


create table "public"."committee_members" (
    "profile_id" uuid not null,
    "committee_id" uuid not null,
    "role" committee_role not null default 'member'::committee_role
);


create table "public"."committees" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "name" text not null,
    "description" text,
    "slug" text not null
);


create table "public"."document_versions" (
    "id" uuid not null default gen_random_uuid(),
    "document_id" uuid,
    "created_at" timestamp with time zone not null default now(),
    "created_by" uuid,
    "file_url" text not null,
    "notes" text
);


create table "public"."documents" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "created_by" uuid,
    "updated_by" uuid,
    "title" text not null,
    "folder_id" uuid,
    "description" text,
    "audience" document_audience not null default 'members'::document_audience
);


create table "public"."events" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "created_by" uuid,
    "updated_by" uuid,
    "name" text not null,
    "description" text,
    "start_time" timestamp with time zone not null,
    "end_time" timestamp with time zone not null,
    "is_all_day" boolean not null default false,
    "location" text
);


create table "public"."folders" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "created_by" uuid,
    "updated_by" uuid,
    "name" text not null,
    "description" text,
    "parent_id" uuid
);


create table "public"."memberships" (
    "id" uuid not null default gen_random_uuid(),
    "profile_id" uuid,
    "start_date" date not null,
    "end_date" date not null default now(),
    "membership_type" membership_type not null default 'individual'::membership_type
);


create table "public"."organizations" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "created_by" uuid,
    "updated_by" uuid,
    "is_sustaining_member" boolean not null default false,
    "name" text not null,
    "full_address" text,
    "phone_number" text,
    "fax_number" text,
    "email" text,
    "website_url" text
);


create table "public"."permissions" (
    "id" text not null,
    "name" text not null,
    "created_at" timestamp with time zone not null default now(),
    "description" text
);


create table "public"."profiles" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "first_name" text not null,
    "last_name" text not null,
    "role_id" uuid,
    "email_address" text,
    "organization_id" uuid,
    "phone_number" text
);


create table "public"."role_permissions" (
    "role_id" uuid not null,
    "permission_id" text not null,
    "created_at" timestamp with time zone not null default now()
);


create table "public"."roles" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "description" text,
    "created_at" timestamp with time zone not null default now()
);


CREATE UNIQUE INDEX announcements_pkey ON public.announcements USING btree (id);

CREATE UNIQUE INDEX committee_members_pkey ON public.committee_members USING btree (profile_id, committee_id);

CREATE UNIQUE INDEX committees_name_unique ON public.committees USING btree (name);

CREATE UNIQUE INDEX committees_pkey ON public.committees USING btree (id);

CREATE UNIQUE INDEX committees_slug_unique ON public.committees USING btree (slug);

CREATE UNIQUE INDEX document_versions_pkey ON public.document_versions USING btree (id);

CREATE UNIQUE INDEX documents_pkey ON public.documents USING btree (id);

CREATE UNIQUE INDEX events_pkey ON public.events USING btree (id);

CREATE UNIQUE INDEX folders_pkey ON public.folders USING btree (id);

CREATE UNIQUE INDEX memberships_pkey ON public.memberships USING btree (id);

CREATE UNIQUE INDEX organizations_pkey ON public.organizations USING btree (id);

CREATE UNIQUE INDEX permissions_name_key ON public.permissions USING btree (name);

CREATE UNIQUE INDEX permissions_pkey ON public.permissions USING btree (id);

CREATE UNIQUE INDEX profiles_email_address_key ON public.profiles USING btree (email_address);

CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id);

CREATE UNIQUE INDEX profiles_user_id_key ON public.profiles USING btree (user_id);

CREATE UNIQUE INDEX role_permissions_pkey ON public.role_permissions USING btree (role_id, permission_id);

CREATE UNIQUE INDEX roles_name_key ON public.roles USING btree (name);

CREATE UNIQUE INDEX roles_pkey ON public.roles USING btree (id);

alter table "public"."announcements" add constraint "announcements_pkey" PRIMARY KEY using index "announcements_pkey";

alter table "public"."committee_members" add constraint "committee_members_pkey" PRIMARY KEY using index "committee_members_pkey";

alter table "public"."committees" add constraint "committees_pkey" PRIMARY KEY using index "committees_pkey";

alter table "public"."document_versions" add constraint "document_versions_pkey" PRIMARY KEY using index "document_versions_pkey";

alter table "public"."documents" add constraint "documents_pkey" PRIMARY KEY using index "documents_pkey";

alter table "public"."events" add constraint "events_pkey" PRIMARY KEY using index "events_pkey";

alter table "public"."folders" add constraint "folders_pkey" PRIMARY KEY using index "folders_pkey";

alter table "public"."memberships" add constraint "memberships_pkey" PRIMARY KEY using index "memberships_pkey";

alter table "public"."organizations" add constraint "organizations_pkey" PRIMARY KEY using index "organizations_pkey";

alter table "public"."permissions" add constraint "permissions_pkey" PRIMARY KEY using index "permissions_pkey";

alter table "public"."profiles" add constraint "profiles_pkey" PRIMARY KEY using index "profiles_pkey";

alter table "public"."role_permissions" add constraint "role_permissions_pkey" PRIMARY KEY using index "role_permissions_pkey";

alter table "public"."roles" add constraint "roles_pkey" PRIMARY KEY using index "roles_pkey";

alter table "public"."announcements" add constraint "announcements_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."announcements" validate constraint "announcements_created_by_fkey";

alter table "public"."announcements" add constraint "announcements_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."announcements" validate constraint "announcements_updated_by_fkey";

alter table "public"."committee_members" add constraint "committee_members_committee_id_fkey" FOREIGN KEY (committee_id) REFERENCES committees(id) ON DELETE CASCADE not valid;

alter table "public"."committee_members" validate constraint "committee_members_committee_id_fkey";

alter table "public"."committee_members" add constraint "committee_members_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE not valid;

alter table "public"."committee_members" validate constraint "committee_members_profile_id_fkey";

alter table "public"."committees" add constraint "committees_name_unique" UNIQUE using index "committees_name_unique";

alter table "public"."committees" add constraint "committees_slug_unique" UNIQUE using index "committees_slug_unique";

alter table "public"."document_versions" add constraint "document_versions_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."document_versions" validate constraint "document_versions_created_by_fkey";

alter table "public"."document_versions" add constraint "document_versions_document_id_fkey" FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE not valid;

alter table "public"."document_versions" validate constraint "document_versions_document_id_fkey";

alter table "public"."documents" add constraint "documents_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."documents" validate constraint "documents_created_by_fkey";

alter table "public"."documents" add constraint "documents_folder_id_fkey" FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL not valid;

alter table "public"."documents" validate constraint "documents_folder_id_fkey";

alter table "public"."documents" add constraint "documents_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."documents" validate constraint "documents_updated_by_fkey";

alter table "public"."events" add constraint "events_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."events" validate constraint "events_created_by_fkey";

alter table "public"."events" add constraint "events_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."events" validate constraint "events_updated_by_fkey";

alter table "public"."folders" add constraint "folders_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."folders" validate constraint "folders_created_by_fkey";

alter table "public"."folders" add constraint "folders_parent_id_fkey" FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE SET NULL not valid;

alter table "public"."folders" validate constraint "folders_parent_id_fkey";

alter table "public"."folders" add constraint "folders_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."folders" validate constraint "folders_updated_by_fkey";

alter table "public"."memberships" add constraint "memberships_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE not valid;

alter table "public"."memberships" validate constraint "memberships_profile_id_fkey";

alter table "public"."organizations" add constraint "organizations_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."organizations" validate constraint "organizations_created_by_fkey";

alter table "public"."organizations" add constraint "organizations_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."organizations" validate constraint "organizations_updated_by_fkey";

alter table "public"."permissions" add constraint "permissions_name_key" UNIQUE using index "permissions_name_key";

alter table "public"."profiles" add constraint "profiles_email_address_key" UNIQUE using index "profiles_email_address_key";

alter table "public"."profiles" add constraint "profiles_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL not valid;

alter table "public"."profiles" validate constraint "profiles_organization_id_fkey";

alter table "public"."profiles" add constraint "profiles_role_id_fkey" FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL not valid;

alter table "public"."profiles" validate constraint "profiles_role_id_fkey";

alter table "public"."profiles" add constraint "profiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."profiles" validate constraint "profiles_user_id_fkey";

alter table "public"."profiles" add constraint "profiles_user_id_key" UNIQUE using index "profiles_user_id_key";

alter table "public"."role_permissions" add constraint "role_permissions_permission_id_fkey" FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE not valid;

alter table "public"."role_permissions" validate constraint "role_permissions_permission_id_fkey";

alter table "public"."role_permissions" add constraint "role_permissions_role_id_fkey" FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE not valid;

alter table "public"."role_permissions" validate constraint "role_permissions_role_id_fkey";

alter table "public"."roles" add constraint "roles_name_key" UNIQUE using index "roles_name_key";

grant delete on table "public"."announcements" to "anon";

grant insert on table "public"."announcements" to "anon";

grant references on table "public"."announcements" to "anon";

grant select on table "public"."announcements" to "anon";

grant trigger on table "public"."announcements" to "anon";

grant truncate on table "public"."announcements" to "anon";

grant update on table "public"."announcements" to "anon";

grant delete on table "public"."announcements" to "authenticated";

grant insert on table "public"."announcements" to "authenticated";

grant references on table "public"."announcements" to "authenticated";

grant select on table "public"."announcements" to "authenticated";

grant trigger on table "public"."announcements" to "authenticated";

grant truncate on table "public"."announcements" to "authenticated";

grant update on table "public"."announcements" to "authenticated";

grant delete on table "public"."announcements" to "service_role";

grant insert on table "public"."announcements" to "service_role";

grant references on table "public"."announcements" to "service_role";

grant select on table "public"."announcements" to "service_role";

grant trigger on table "public"."announcements" to "service_role";

grant truncate on table "public"."announcements" to "service_role";

grant update on table "public"."announcements" to "service_role";

grant delete on table "public"."committee_members" to "anon";

grant insert on table "public"."committee_members" to "anon";

grant references on table "public"."committee_members" to "anon";

grant select on table "public"."committee_members" to "anon";

grant trigger on table "public"."committee_members" to "anon";

grant truncate on table "public"."committee_members" to "anon";

grant update on table "public"."committee_members" to "anon";

grant delete on table "public"."committee_members" to "authenticated";

grant insert on table "public"."committee_members" to "authenticated";

grant references on table "public"."committee_members" to "authenticated";

grant select on table "public"."committee_members" to "authenticated";

grant trigger on table "public"."committee_members" to "authenticated";

grant truncate on table "public"."committee_members" to "authenticated";

grant update on table "public"."committee_members" to "authenticated";

grant delete on table "public"."committee_members" to "service_role";

grant insert on table "public"."committee_members" to "service_role";

grant references on table "public"."committee_members" to "service_role";

grant select on table "public"."committee_members" to "service_role";

grant trigger on table "public"."committee_members" to "service_role";

grant truncate on table "public"."committee_members" to "service_role";

grant update on table "public"."committee_members" to "service_role";

grant delete on table "public"."committees" to "anon";

grant insert on table "public"."committees" to "anon";

grant references on table "public"."committees" to "anon";

grant select on table "public"."committees" to "anon";

grant trigger on table "public"."committees" to "anon";

grant truncate on table "public"."committees" to "anon";

grant update on table "public"."committees" to "anon";

grant delete on table "public"."committees" to "authenticated";

grant insert on table "public"."committees" to "authenticated";

grant references on table "public"."committees" to "authenticated";

grant select on table "public"."committees" to "authenticated";

grant trigger on table "public"."committees" to "authenticated";

grant truncate on table "public"."committees" to "authenticated";

grant update on table "public"."committees" to "authenticated";

grant delete on table "public"."committees" to "service_role";

grant insert on table "public"."committees" to "service_role";

grant references on table "public"."committees" to "service_role";

grant select on table "public"."committees" to "service_role";

grant trigger on table "public"."committees" to "service_role";

grant truncate on table "public"."committees" to "service_role";

grant update on table "public"."committees" to "service_role";

grant delete on table "public"."document_versions" to "anon";

grant insert on table "public"."document_versions" to "anon";

grant references on table "public"."document_versions" to "anon";

grant select on table "public"."document_versions" to "anon";

grant trigger on table "public"."document_versions" to "anon";

grant truncate on table "public"."document_versions" to "anon";

grant update on table "public"."document_versions" to "anon";

grant delete on table "public"."document_versions" to "authenticated";

grant insert on table "public"."document_versions" to "authenticated";

grant references on table "public"."document_versions" to "authenticated";

grant select on table "public"."document_versions" to "authenticated";

grant trigger on table "public"."document_versions" to "authenticated";

grant truncate on table "public"."document_versions" to "authenticated";

grant update on table "public"."document_versions" to "authenticated";

grant delete on table "public"."document_versions" to "service_role";

grant insert on table "public"."document_versions" to "service_role";

grant references on table "public"."document_versions" to "service_role";

grant select on table "public"."document_versions" to "service_role";

grant trigger on table "public"."document_versions" to "service_role";

grant truncate on table "public"."document_versions" to "service_role";

grant update on table "public"."document_versions" to "service_role";

grant delete on table "public"."documents" to "anon";

grant insert on table "public"."documents" to "anon";

grant references on table "public"."documents" to "anon";

grant select on table "public"."documents" to "anon";

grant trigger on table "public"."documents" to "anon";

grant truncate on table "public"."documents" to "anon";

grant update on table "public"."documents" to "anon";

grant delete on table "public"."documents" to "authenticated";

grant insert on table "public"."documents" to "authenticated";

grant references on table "public"."documents" to "authenticated";

grant select on table "public"."documents" to "authenticated";

grant trigger on table "public"."documents" to "authenticated";

grant truncate on table "public"."documents" to "authenticated";

grant update on table "public"."documents" to "authenticated";

grant delete on table "public"."documents" to "service_role";

grant insert on table "public"."documents" to "service_role";

grant references on table "public"."documents" to "service_role";

grant select on table "public"."documents" to "service_role";

grant trigger on table "public"."documents" to "service_role";

grant truncate on table "public"."documents" to "service_role";

grant update on table "public"."documents" to "service_role";

grant delete on table "public"."events" to "anon";

grant insert on table "public"."events" to "anon";

grant references on table "public"."events" to "anon";

grant select on table "public"."events" to "anon";

grant trigger on table "public"."events" to "anon";

grant truncate on table "public"."events" to "anon";

grant update on table "public"."events" to "anon";

grant delete on table "public"."events" to "authenticated";

grant insert on table "public"."events" to "authenticated";

grant references on table "public"."events" to "authenticated";

grant select on table "public"."events" to "authenticated";

grant trigger on table "public"."events" to "authenticated";

grant truncate on table "public"."events" to "authenticated";

grant update on table "public"."events" to "authenticated";

grant delete on table "public"."events" to "service_role";

grant insert on table "public"."events" to "service_role";

grant references on table "public"."events" to "service_role";

grant select on table "public"."events" to "service_role";

grant trigger on table "public"."events" to "service_role";

grant truncate on table "public"."events" to "service_role";

grant update on table "public"."events" to "service_role";

grant delete on table "public"."folders" to "anon";

grant insert on table "public"."folders" to "anon";

grant references on table "public"."folders" to "anon";

grant select on table "public"."folders" to "anon";

grant trigger on table "public"."folders" to "anon";

grant truncate on table "public"."folders" to "anon";

grant update on table "public"."folders" to "anon";

grant delete on table "public"."folders" to "authenticated";

grant insert on table "public"."folders" to "authenticated";

grant references on table "public"."folders" to "authenticated";

grant select on table "public"."folders" to "authenticated";

grant trigger on table "public"."folders" to "authenticated";

grant truncate on table "public"."folders" to "authenticated";

grant update on table "public"."folders" to "authenticated";

grant delete on table "public"."folders" to "service_role";

grant insert on table "public"."folders" to "service_role";

grant references on table "public"."folders" to "service_role";

grant select on table "public"."folders" to "service_role";

grant trigger on table "public"."folders" to "service_role";

grant truncate on table "public"."folders" to "service_role";

grant update on table "public"."folders" to "service_role";

grant delete on table "public"."memberships" to "anon";

grant insert on table "public"."memberships" to "anon";

grant references on table "public"."memberships" to "anon";

grant select on table "public"."memberships" to "anon";

grant trigger on table "public"."memberships" to "anon";

grant truncate on table "public"."memberships" to "anon";

grant update on table "public"."memberships" to "anon";

grant delete on table "public"."memberships" to "authenticated";

grant insert on table "public"."memberships" to "authenticated";

grant references on table "public"."memberships" to "authenticated";

grant select on table "public"."memberships" to "authenticated";

grant trigger on table "public"."memberships" to "authenticated";

grant truncate on table "public"."memberships" to "authenticated";

grant update on table "public"."memberships" to "authenticated";

grant delete on table "public"."memberships" to "service_role";

grant insert on table "public"."memberships" to "service_role";

grant references on table "public"."memberships" to "service_role";

grant select on table "public"."memberships" to "service_role";

grant trigger on table "public"."memberships" to "service_role";

grant truncate on table "public"."memberships" to "service_role";

grant update on table "public"."memberships" to "service_role";

grant delete on table "public"."organizations" to "anon";

grant insert on table "public"."organizations" to "anon";

grant references on table "public"."organizations" to "anon";

grant select on table "public"."organizations" to "anon";

grant trigger on table "public"."organizations" to "anon";

grant truncate on table "public"."organizations" to "anon";

grant update on table "public"."organizations" to "anon";

grant delete on table "public"."organizations" to "authenticated";

grant insert on table "public"."organizations" to "authenticated";

grant references on table "public"."organizations" to "authenticated";

grant select on table "public"."organizations" to "authenticated";

grant trigger on table "public"."organizations" to "authenticated";

grant truncate on table "public"."organizations" to "authenticated";

grant update on table "public"."organizations" to "authenticated";

grant delete on table "public"."organizations" to "service_role";

grant insert on table "public"."organizations" to "service_role";

grant references on table "public"."organizations" to "service_role";

grant select on table "public"."organizations" to "service_role";

grant trigger on table "public"."organizations" to "service_role";

grant truncate on table "public"."organizations" to "service_role";

grant update on table "public"."organizations" to "service_role";

grant delete on table "public"."permissions" to "anon";

grant insert on table "public"."permissions" to "anon";

grant references on table "public"."permissions" to "anon";

grant select on table "public"."permissions" to "anon";

grant trigger on table "public"."permissions" to "anon";

grant truncate on table "public"."permissions" to "anon";

grant update on table "public"."permissions" to "anon";

grant delete on table "public"."permissions" to "authenticated";

grant insert on table "public"."permissions" to "authenticated";

grant references on table "public"."permissions" to "authenticated";

grant select on table "public"."permissions" to "authenticated";

grant trigger on table "public"."permissions" to "authenticated";

grant truncate on table "public"."permissions" to "authenticated";

grant update on table "public"."permissions" to "authenticated";

grant delete on table "public"."permissions" to "service_role";

grant insert on table "public"."permissions" to "service_role";

grant references on table "public"."permissions" to "service_role";

grant select on table "public"."permissions" to "service_role";

grant trigger on table "public"."permissions" to "service_role";

grant truncate on table "public"."permissions" to "service_role";

grant update on table "public"."permissions" to "service_role";

grant delete on table "public"."profiles" to "anon";

grant insert on table "public"."profiles" to "anon";

grant references on table "public"."profiles" to "anon";

grant select on table "public"."profiles" to "anon";

grant trigger on table "public"."profiles" to "anon";

grant truncate on table "public"."profiles" to "anon";

grant update on table "public"."profiles" to "anon";

grant delete on table "public"."profiles" to "authenticated";

grant insert on table "public"."profiles" to "authenticated";

grant references on table "public"."profiles" to "authenticated";

grant select on table "public"."profiles" to "authenticated";

grant trigger on table "public"."profiles" to "authenticated";

grant truncate on table "public"."profiles" to "authenticated";

grant update on table "public"."profiles" to "authenticated";

grant delete on table "public"."profiles" to "service_role";

grant insert on table "public"."profiles" to "service_role";

grant references on table "public"."profiles" to "service_role";

grant select on table "public"."profiles" to "service_role";

grant trigger on table "public"."profiles" to "service_role";

grant truncate on table "public"."profiles" to "service_role";

grant update on table "public"."profiles" to "service_role";

grant delete on table "public"."role_permissions" to "anon";

grant insert on table "public"."role_permissions" to "anon";

grant references on table "public"."role_permissions" to "anon";

grant select on table "public"."role_permissions" to "anon";

grant trigger on table "public"."role_permissions" to "anon";

grant truncate on table "public"."role_permissions" to "anon";

grant update on table "public"."role_permissions" to "anon";

grant delete on table "public"."role_permissions" to "authenticated";

grant insert on table "public"."role_permissions" to "authenticated";

grant references on table "public"."role_permissions" to "authenticated";

grant select on table "public"."role_permissions" to "authenticated";

grant trigger on table "public"."role_permissions" to "authenticated";

grant truncate on table "public"."role_permissions" to "authenticated";

grant update on table "public"."role_permissions" to "authenticated";

grant delete on table "public"."role_permissions" to "service_role";

grant insert on table "public"."role_permissions" to "service_role";

grant references on table "public"."role_permissions" to "service_role";

grant select on table "public"."role_permissions" to "service_role";

grant trigger on table "public"."role_permissions" to "service_role";

grant truncate on table "public"."role_permissions" to "service_role";

grant update on table "public"."role_permissions" to "service_role";

grant delete on table "public"."roles" to "anon";

grant insert on table "public"."roles" to "anon";

grant references on table "public"."roles" to "anon";

grant select on table "public"."roles" to "anon";

grant trigger on table "public"."roles" to "anon";

grant truncate on table "public"."roles" to "anon";

grant update on table "public"."roles" to "anon";

grant delete on table "public"."roles" to "authenticated";

grant insert on table "public"."roles" to "authenticated";

grant references on table "public"."roles" to "authenticated";

grant select on table "public"."roles" to "authenticated";

grant trigger on table "public"."roles" to "authenticated";

grant truncate on table "public"."roles" to "authenticated";

grant update on table "public"."roles" to "authenticated";

grant delete on table "public"."roles" to "service_role";

grant insert on table "public"."roles" to "service_role";

grant references on table "public"."roles" to "service_role";

grant select on table "public"."roles" to "service_role";

grant trigger on table "public"."roles" to "service_role";

grant truncate on table "public"."roles" to "service_role";

grant update on table "public"."roles" to "service_role";

CREATE TRIGGER update_committees_in_app_metadata_trigger AFTER INSERT OR DELETE OR UPDATE ON public.committee_members FOR EACH ROW EXECUTE FUNCTION private.update_user_committees_in_app_metadata();

CREATE TRIGGER update_permissions_in_app_metadata_on_permissions AFTER INSERT OR DELETE OR UPDATE ON public.permissions FOR EACH ROW EXECUTE FUNCTION private.update_user_permissions_in_app_metadata();

CREATE TRIGGER profile_id_to_app_metadata_trigger AFTER INSERT OR DELETE OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.update_user_app_metadata('profile_id', 'id');

CREATE TRIGGER role_id_to_app_metadata_trigger AFTER INSERT OR DELETE OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.update_user_app_metadata('role_id', 'role_id');

CREATE TRIGGER update_permissions_in_app_metadata_trigger AFTER INSERT OR DELETE OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.update_user_permissions_in_app_metadata();

CREATE TRIGGER update_permissions_in_app_metadata_on_role_permissions AFTER INSERT OR DELETE OR UPDATE ON public.role_permissions FOR EACH ROW EXECUTE FUNCTION private.update_user_permissions_in_app_metadata();


