insert into public.permissions (id, name, description) values
('manage_permissions','Manage Permissions', 'Can manage user roles and permissions'),
('manage_all_events','Manage All Events', 'Can create, update, and delete events'),
('manage_all_announcements', 'Manage All Announcements', 'Can create, update, and delete announcements'),
('manage_own_events', 'Manage Own Events', 'Can create, update, and delete their own events only'),
('manage_own_announcements', 'Manage Own Announcements', 'Can create, update, and delete their own announcements only'),
('manage_committees', 'Manage Committees', 'Can update any committee chairs and members'),
('manage_members', 'Manage Members', 'Can invite or remove members from the organization');