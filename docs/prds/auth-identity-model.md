# PRD: Auth, identity, members, roles, and permissions

## Problem Statement

NJMCA Members needs an authentication and identity foundation before the portal can safely expose member-only workflows. The project will use BetterAuth self-hosted on Railway with Postgres, but the app still needs its own domain model for who is allowed to become a user, how real NJMCA members relate to auth accounts, how organizations are displayed, and how NJMCA-side titles grant permissions.

The core risk is treating BetterAuth users as the source of membership truth. In this product, the membership list is authoritative: a person may only access the portal if they correspond to an active NJMCA member record. The app must support imported and manually managed member data, display-only organizations, title-based permissions, and an auditable management surface.

## Solution

Build an auth and identity layer where BetterAuth proves login identity, while NJMCA member records decide portal eligibility and authorization.

A BetterAuth user represents a real login identity. A member represents a human person in the NJMCA membership list. Members may have nullable emails for historical records, but any email present must be globally unique after trim/lowercase normalization. A member may optionally link to exactly one BetterAuth user after first-time email OTP verification and mandatory password setup.

Organizations are display-only entities representing where members are from. They do not determine permissions. Members can be linked to organizations through a lean join table that may include a nullable title.

NJMCA-side authority is modeled through code-defined roles and permissions. Roles represent titles such as president, trustee, secretary, or webmaster. Permissions represent application capabilities such as `manage_members`, `manage_organizations`, and `manage_roles`. Members can hold multiple roles through dated role assignments. Effective permissions are computed from active members, active role terms, and role-permission seed data.

Most of the app should be protected. Public unauthenticated surfaces are limited to first-time access, login, password recovery, and health-style endpoints. Authenticated users without an active matching member land on an access-blocked page instead of being silently signed out.

## User Stories

1. As an NJMCA member, I want to claim my account using the email in the membership list, so that only the real email owner can activate portal access.
2. As a first-time member, I want to verify my email with an OTP, so that I can prove ownership before my member record is linked to an auth account.
3. As a first-time member, I want to set a password after OTP verification, so that I can use password login for future access.
4. As a returning member, I want to log in with email and password, so that I do not need to repeat OTP verification each time.
5. As a member with an existing linked account, I want first-time access to be blocked and redirected toward login or password reset, so that duplicate auth users are not created.
6. As an inactive member, I want to see a clear access-blocked state, so that I understand my login succeeded but portal access is unavailable.
7. As a member, I want password reset to work at the auth layer, so that I can recover my login even though portal access is still gated by membership status.
8. As an operator, I want members to be the authoritative source of who can become users, so that random signups cannot enter the portal.
9. As an operator, I want to manually create members, so that NJMCA can maintain the membership list directly.
10. As an operator, I want to import members from CSV, so that existing membership data can be loaded efficiently.
11. As an operator, I want CSV import to preview all changes before commit, so that I can catch bad mappings and duplicate records.
12. As an operator, I want CSV field mapping with convenience guesses, so that imports are faster while still explicit.
13. As an operator, I want CSV import to prevent duplicate members by normalized email, so that account claiming remains unambiguous.
14. As an operator, I want name and organization matches without email to be treated as possible duplicates requiring review, so that the system does not guess incorrectly.
15. As an operator, I want CSV import to support a fixed organization for the whole import, so that single-organization spreadsheets are easy to load.
16. As an operator, I want CSV import to support an organization column, so that statewide or mixed-org spreadsheets can be loaded.
17. As an operator, I want CSV import to create organizations only after preview confirmation, so that display orgs are not silently polluted.
18. As an operator, I want CSV import to handle one organization affiliation per row for v1, so that the import rules stay understandable.
19. As an operator, I want member imports to exclude roles and permissions, so that membership management does not accidentally grant authority.
20. As an operator, I want member email changes to be operator-only, so that members cannot change the authoritative claim key themselves.
21. As an operator, I want changing a linked member's email to unlink the auth user by default, so that the new email owner must prove ownership.
22. As an operator, I want to unlink a member from an auth user, so that account recovery and security cleanup are possible.
23. As an operator, I do not want normal UI to manually link members to auth users, so that proof of email ownership is not bypassed.
24. As an operator, I want to deactivate members instead of deleting them, so that access can be removed while history remains intact.
25. As an operator, I want inactive members to retain their user link, so that reactivation can restore access without re-claiming.
26. As an operator, I want organizations to be unique by normalized name, so that the display list remains clean.
27. As an operator, I want organizations with member links to be protected from deletion, so that historical affiliations are not broken.
28. As an operator, I want a member to link to multiple organizations, so that multiple affiliations can be displayed.
29. As an operator, I want organization-member links to include an optional title, so that a member's position at an org can be shown.
30. As an NJMCA leader, I want roles to model association titles, so that permissions are assigned in domain language.
31. As an NJMCA leader, I want permissions to model app capabilities, so that code checks stable capabilities rather than title names.
32. As an NJMCA leader, I want permissions to be code-defined seed data, so that the app and database agree on supported capabilities.
33. As an NJMCA leader, I want roles and permissions to have stable keys, so that seed data and authorization checks are reliable.
34. As an NJMCA leader, I want permissions to be flat, so that authority does not come from hidden inheritance rules.
35. As an NJMCA leader, I want webmaster/admin authority represented by explicit permissions, so that there is no bypass flag.
36. As an operator with `manage_roles`, I want to assign roles to members, so that officer and support authority can be maintained.
37. As an operator with `manage_roles`, I want role assignments to have optional start and end dates, so that officer terms can be scheduled and recorded.
38. As an operator with `manage_roles`, I want future-dated roles, so that upcoming leadership changes can be entered ahead of time.
39. As an operator with `manage_roles`, I want role removal to end-date assignments, so that history is preserved.
40. As an operator with `manage_roles`, I want assignment notes to stay out of member_roles for v1, so that the table remains focused and audit metadata can carry context.
41. As the system, I want inactive members to have no effective permissions, so that deactivation always removes portal authority.
42. As the system, I want a member with no email to be allowed to hold roles for recordkeeping, so that historical/offline records can be represented.
43. As the system, I want a member who later claims an account to inherit existing effective roles immediately, so that officer onboarding works naturally.
44. As the system, I want high-privilege members to use the same verified-email claim flow, so that authority follows the authoritative member record.
45. As the system, I want single-assignment roles to prevent overlapping effective assignments across members, so that roles like president or secretary can be exclusive.
46. As the system, I want multiple-assignment roles to allow concurrent holders, so that roles like trustee or committee roles can be shared.
47. As the system, I want overlapping assignments for the same member and role to be rejected, so that role history stays coherent.
48. As the system, I want all protected server loaders, actions, and APIs to re-check active member and permissions from Postgres, so that access changes take effect without waiting for session refresh.
49. As the system, I want the client UI to hide unauthorized controls while server functions still enforce permissions, so that the UX is helpful but security is server-side.
50. As the system, I want protected access to require linked user ID and matching normalized email, so that database drift does not grant access.
51. As the system, I want normalized email to be trim and lowercase only, so that matching is predictable without provider-specific assumptions.
52. As the system, I want organization names normalized by trim, whitespace collapse, and lowercase, so that duplicates are reduced without over-merging.
53. As a developer, I want a shared AppResult type for server functions, so that expected validation, auth, conflict, and unexpected failures are handled consistently.
54. As a developer, I want server functions not to throw for expected outcomes, so that UI code can render typed responses predictably.
55. As a developer, I want UnexpectedError to include a user-facing message for now, so that failures are displayable without adding logging infrastructure yet.
56. As a developer, I want route guards to handle redirects and access-blocked navigation states, so that server functions can stay focused on data mutations.
57. As a developer, I want the authenticated app context to contain both BetterAuth user and linked member, so that auth identity and domain actor are explicit.
58. As a developer, I want audit events to store both actor_user_id and actor_member_id, so that account-link issues can be investigated later.
59. As a developer, I want audit events to include concise before/after metadata for sensitive changes, so that administrative history is useful.
60. As a developer, I want audit events to include transaction_method values such as manual, csv_import, seed, and system, so that the source of changes is visible.
61. As a developer, I want CSV import to write per-row/per-entity audit events, so that imported changes are traceable without a separate import batch table.
62. As a developer, I want app-owned domain tables to use UUID primary keys generated by server application code, so that persistence does not depend on database UUID extensions.
63. As a developer, I want timestamps generated by server or database code, so that browser client time is never authoritative.
64. As a developer, I want core invariants enforced in app logic and doubled with Postgres constraints where practical, so that Railway extension availability is not a blocker.
65. As a developer, I want membership and auth-sensitive mutations to run in transactions, so that validation, writes, and audit events commit together.
66. As a developer, I want development seed data for permission edge cases, so that role and access boundaries can be tested quickly.
67. As a developer, I want a development-only auth bypass that selects a member identity, so that permission boundaries can be tested without production impersonation.
68. As a developer, I want dev fixtures to use fake `.test` emails and fake names, so that tests never target real people.
69. As an operator, I want special webmaster/admin identities to be represented as members, so that all authorization roles attach to members.
70. As the product owner, I want production impersonation excluded from v1, so that support tooling does not create unnecessary security risk.

## Implementation Decisions

- Use BetterAuth as the authentication/session provider and Postgres as the persistence layer.
- Treat BetterAuth users as login identities only; treat members as the authoritative source for portal eligibility and domain authority.
- Model members as human people with first name, last name, nullable email, normalized nullable email, nullable phone, `is_active` defaulting to true, nullable unique linked user ID, and timestamps.
- Normalize emails by trim plus lowercase only.
- Enforce global uniqueness for `members.email_normalized` when present, including inactive members.
- Allow members without emails for historical or offline records, but they cannot claim accounts or access the portal.
- First-time access requires an active member with exactly one matching normalized email.
- First-time access uses email OTP to prove email ownership, then requires password setup before linking `member.user_id`.
- Returning login uses email and password through BetterAuth.
- Account claiming is blocked for already-linked members; users should sign in or reset password instead.
- Member linking only happens after OTP verification and password setup are complete.
- Member email changes are operator-only and unlink the existing user by default.
- Deactivating a member keeps the linked user but removes all portal access and effective permissions.
- Protected server routes/loaders/actions/APIs must re-check current `member.is_active`, linked user ID, matching normalized email, and effective permissions from Postgres.
- Authenticated users without active member access should see an access-blocked page, not be silently signed out.
- Keep almost all app routes protected except login, first-time access, forgot password, and health-style endpoints.
- Organizations are display-only and represent where members are from, not NJMCA itself.
- Model organization affiliations with a lean `organization_members` table containing `id`, `member_id`, `organization_id`, and nullable `title`.
- Normalize organization names by trimming, collapsing whitespace, and lowercasing.
- Enforce unique organization normalized names.
- Prevent deleting organizations that have member links.
- Avoid member hard-delete from v1 UI; use `is_active = false` instead.
- Roles represent NJMCA titles such as president, trustee, secretary, and webmaster.
- Permissions represent app capabilities such as `manage_members`, `manage_organizations`, and `manage_roles`.
- Roles and permissions are code-defined seed data with stable unique keys and display names.
- Code must guard behavior by permission keys, not role keys.
- Permissions are flat with no hierarchy or inheritance.
- Webmaster/admin power is represented by explicit permissions, not a bypass flag.
- Role permissions are current-state seed data and do not have start/end dates.
- Members can hold roles through `member_roles` with nullable `starts_on` and `ends_on` dates.
- Role assignment date ranges are inclusive using America/New_York local dates for effective permission checks.
- Allow future-dated role assignments.
- Disallow overlapping assignments for the same member and role.
- Add `roles.assignment_mode` with `single` and `multiple` values.
- For single roles, reject overlapping effective assignments across all members.
- Allow role assignments to inactive members and members without emails, but grant no effective permissions unless the member is active and linked.
- Role removal should set `ends_on` rather than deleting the assignment in normal UI.
- Do not store assignment notes on `member_roles` in v1; use audit metadata when needed.
- Keep role and permission catalogs seed-managed in v1; role management UI means assigning/removing member role terms.
- Manual member creation and CSV import are in scope for v1.
- CSV import must require explicit preview and confirmation before committing.
- CSV import must support explicit field mapping with convenience guesses.
- CSV import must prevent duplicate normalized emails and treat name/org matches without email as review-required candidates.
- CSV import supports one organization affiliation per row.
- CSV import supports both fixed-organization mode and organization-column mode.
- CSV import may create organizations after preview confirmation.
- Normal member CSV import must not modify roles or permissions.
- Use a shared `AppResult`/`AppError` shape for server functions, including validation, unauthorized, forbidden, not_found, conflict, and unexpected error types.
- Server functions should return typed result objects for expected outcomes and catch unknown failures into `UnexpectedError` with a user-facing message.
- Route guards should handle navigation states such as unauthenticated redirect, access-blocked, and forbidden.
- Auth context should include both BetterAuth user and linked member, with member as the primary domain actor.
- Audit events should store `actor_user_id`, `actor_member_id`, `subject_type`, `subject_id`, `event_type`, `transaction_method`, `metadata`, and `created_at`.
- Audit event `transaction_method` initial values are `manual`, `csv_import`, `seed`, and `system`.
- Audit metadata should include concise before/after data for sensitive changes, never passwords, OTP codes, session tokens, or secrets.
- CSV import should write per-row/per-entity audit events with `transaction_method = csv_import`; do not add an import batch table in v1.
- App-owned tables should use UUID primary keys generated by server application code with `crypto.randomUUID()`.
- Server/database code should generate timestamps; browser time is not authoritative.
- Enforce critical invariants in application validation first and add standard Postgres uniqueness/FK/check constraints where practical.
- Do not rely on Postgres extensions for v1 correctness. Add stronger Postgres constraints later only if available.
- Auth/membership management writes should run in transactions with validation and audit events committed together.
- Add development seed members and roles for permission edge cases, using fake `.test` emails and fake names.
- Add a development-only auth bypass/member switcher for testing permission boundaries; keep production impersonation out of scope.

Potential modules to build or modify:

- Auth integration and session access module for BetterAuth setup, first-time access, login, password setup, and password reset wiring.
- Member access gate module that resolves the current BetterAuth session into user, member, and permission context.
- Permission evaluator module that computes effective permissions from member activity, role assignment dates, role assignment mode, and role_permissions.
- Membership management server functions for creating/updating/deactivating members and unlinking users.
- Organization management server functions for creating/updating organizations and member affiliations.
- Role assignment server functions for assigning/end-dating roles and enforcing overlap/single-role rules.
- CSV import parser/mapper/preview/commit module with explicit mapping, duplicate detection, fixed-org mode, org-column mode, and transactional commit.
- Audit writer module with a small interface for recording before/after events from manual, CSV, seed, and system actions.
- Seed data module for roles, permissions, role_permissions, and development fixtures.
- Protected route/layout guards and access-blocked/forbidden UI states.

Deep modules to keep independently testable:

- Email and organization normalization.
- Effective permission evaluation.
- Role assignment overlap validation.
- CSV import reconciliation and preview generation.
- `AppResult`/`AppError` helpers.
- Audit event construction.

## Testing Decisions

Tests should focus on externally visible behavior and domain invariants rather than implementation details. Good tests should ask whether a member can access the portal, whether a role assignment grants a permission on a date, whether an import preview detects conflicts, and whether a mutation returns the correct typed `AppResult`.

Modules that should receive focused tests:

- Email normalization and uniqueness handling.
- Organization name normalization.
- Member claim/access eligibility: active member, inactive member, no member, linked member, email mismatch, already-linked first-time access.
- Permission evaluation: active roles, expired roles, future roles, inactive members, missing user links, members without emails.
- Role assignment validation: same member overlap rejection, single-role cross-member overlap rejection, multiple-role concurrency allowed, inclusive date boundaries, nullable open-ended dates.
- CSV import preview: explicit mapping, convenience guesses, duplicate email rejection, possible duplicate detection by name/org, fixed-org mode, org-column mode, new organization staging.
- CSV import commit: transactional behavior, per-entity audit events, no role/permission mutation.
- Membership management server functions: typed success/error results, validation errors, conflict errors, forbidden errors, unexpected error translation.
- Audit event construction: actor IDs, transaction_method, subject fields, before/after metadata, no secret values.
- Route guard behavior: unauthenticated redirect, authenticated inactive/access-blocked state, forbidden state for missing permissions.

Prior art in the current codebase is minimal because the repo is still a TanStack Start demo with a server-backed counter and a small API route. New tests should establish the patterns for domain modules and server function validation as auth is introduced.

## Out of Scope

- Production impersonation or support account switching.
- Self-service member profile editing for authoritative fields.
- Self-service email changes.
- Public self-registration without a pre-existing active member record.
- Organization-level permissions or organization roles.
- Dues, payment standing, membership terms, or organization membership status beyond display affiliation.
- CRUD-split permissions such as `create_member` versus `edit_member` unless later product requirements demand it.
- App UI for editing role and permission catalogs; catalogs are seed-managed for v1.
- Importing roles or permissions through the normal member CSV import.
- Separate import batch persistence table.
- Postgres extension-dependent constraints as required correctness mechanisms.
- Incident IDs, structured error logging, and observability infrastructure.
- Production session revocation beyond protected request access checks, unless BetterAuth makes it trivial during implementation.
- Directory visibility flags or public/private member directory behavior.
- Hard-deleting members from the v1 UI.

## Further Notes

This PRD reflects a deliberate separation between auth identity and NJMCA membership authority. BetterAuth answers whether a browser is signed in as a user. The app answers whether that user maps to an active member and what permissions that member currently has.

Railway/Postgres is the target deployment environment, but correctness should not depend on Postgres extensions. App-layer validation and transactions are the primary enforcement mechanism, with simple database constraints added where practical.

The first release should seed a more complete role and permission list than the initial examples once the app's real workflows are enumerated. Initial permission examples are `manage_members`, `manage_organizations`, and `manage_roles`.
