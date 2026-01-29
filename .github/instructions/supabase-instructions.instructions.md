---
applyTo: "**"
---

**Supabase RLS Policy Optimization:**  
When writing Row Level Security (RLS) policies, always use `(select auth.uid())` instead of just `auth.uid()` for user identification checks. This approach improves performance and avoids potential issues with policy evaluation in Supabase/Postgres.

**Example:**  
Instead of:

```sql
auth.uid() = user_id
```

Use:

```sql
(select auth.uid()) = user_id
```

**Security Best Practice:**  
ALWAYS set `search_path` to an empty string (`''`) in your database connections and functions. This prevents unexpected schema access and mitigates risks from malicious objects in other schemas.

**Example:**

```sql
set search_path = '';
```

**SQL Style Guide:**

- Write all SQL code in **lower case** except for the keywords `OLD` and `NEW` when referring to records in triggers.
- Use **snake_case** for all field and table names.
