---
applyTo: "**"
---

This is a conversion of the `pgTAP` documentation's table of contents and main assertion categories into a markdown format.

---

# pgTAP: Documentation Overview

_(Based on pgTAP 1.3.3 Documentation)_

**pgTAP** is a unit testing framework for PostgreSQL that outputs tests using the **Test Anything Protocol (TAP)**. It provides a suite of functions for writing and running tests directly within your database.

## 1. Test Planning and Execution

| Concept                                   | Key Functions                      | Description                                                      |
| :---------------------------------------- | :--------------------------------- | :--------------------------------------------------------------- |
| **I love it when a plan comes together.** | `plan( N )`, `no_plan()`           | Declares how many tests will be run.                             |
| **What a sweet unit!**                    | `finish()`                         | Marks the end of a test file or function.                        |
| **Test Descriptions.**                    | `set_test_descr()`, `test_descr()` | Sets and retrieves the description for the current test.         |
| **Tap that Batch.**                       | `do_tap()`, `runtests()`           | Functions for batch running tests.                               |
| **xUnit Function Names.**                 | _N/A_                              | Guidelines for naming test functions when using the xUnit style. |

---

## 2. Basic Assertions ("I'm ok, you're not ok.")

These functions are used for basic comparisons and truthiness checks.

- `ok( boolean, description )`: Checks if a condition is true.
- `is( got, expected, description )`: Tests that two values are equal (`=`).
- `isnt( got, expected, description )`: Tests that two values are not equal (`<>`).
- `matches( got, pattern, description )`: Tests a value against a case-sensitive regular expression (`~`).
- `imatches( got, pattern, description )`: Tests a value against a case-insensitive regular expression (`~*`).
- `doesnt_match( got, pattern, description )`: Tests a value against a case-sensitive regular expression fails (`!~`).
- `doesnt_imatch( got, pattern, description )`: Tests a value against a case-insensitive regular expression fails (`!~*`).
- `alike( got, expected, description )`: Tests that two values are deeply equal, typically for complex types like arrays/JSONB.
- `unalike( got, expected, description )`: Tests that two values are not deeply equal.
- `cmp_ok( got, operator, expected, description )`: Performs a comparison using any PostgreSQL operator (e.g., `cmp_ok(x, '>', 5)`).
- `pass( description )`: Explicitly marks a test as passed.
- `fail( description )`: Explicitly marks a test as failed.
- `isa_ok( expression, type, description )`: Checks if an expression is of a specific PostgreSQL data type.

---

## 3. Error and Performance Testing ("To Error is Human.")

These assertions test for expected errors or performance metrics.

- `throws_ok( statement, sql_state, expected_message, description )`: Checks if a statement throws a specific error code.
- `throws_like( statement, sql_state_pattern, expected_message_pattern, description )`: Checks if an error code or message matches a pattern.
- `throws_ilike()`, `throws_matching()`, `throws_imatching()`: Additional pattern-matching error tests.
- `lives_ok( statement, description )`: Checks that a statement executes without throwing an error.
- `performs_ok( statement, description )`: Checks that a statement executes.
- `performs_within( milliseconds, statement, description )`: Checks that a statement executes within the specified time limit.

---

## 4. Result Set Testing ("Can You Relate?")

These functions compare the results of a query against an expected set of data.

- `results_eq( got_query, expected_query, description )`: Compares the entire result set (order-sensitive) from two queries.
- `results_ne( got_query, expected_query, description )`: Checks that two result sets are not equal.
- `set_eq( got_query, expected_query, description )`: Compares two result sets (order-sensitive), comparing rows one by one.
- `set_ne()`, `set_has()`, `set_hasnt()`: Other order-sensitive set comparisons.
- `bag_eq( got_query, expected_query, description )`: Compares two result sets (order-**insensitive**).
- `bag_ne()`, `bag_has()`, `bag_hasnt()`: Other order-insensitive bag comparisons.
- `is_empty( query, description )`: Tests that a query returns zero rows.
- `isnt_empty( query, description )`: Tests that a query returns at least one row.
- `row_eq( got_query, expected_query, description )`: Compares a single row from two queries.

---

## 5. Schema and Object Existence/Content

### I Object! (Object Listing)

These functions check if a database's list of objects _matches_ a specified list.

- `tablespaces_are( expected_array, description )`
- `schemas_are( expected_array, description )`
- `tables_are( expected_array, description )`
- `views_are( expected_array, description )`
- `functions_are( expected_array, description )`
- ... and similar functions for `partitions`, `foreign_tables`, `materialized_views`, `sequences`, `columns`, `indexes`, `triggers`, `roles`, `users`, `types`, etc.

### To Have or Have Not. (Object Existence)

These functions check if a specific object exists or does not exist.

- `has_tablespace( name, description )`, `hasnt_tablespace()`
- `has_schema( name, description )`, `hasnt_schema()`
- `has_table( name, description )`, `hasnt_table()`
- `has_index( table_name, index_name, description )`, `hasnt_index()`
- `has_function( name, args, description )`, `hasnt_function()`
- `is_ancestor_of()`, `isnt_ancestor_of()`, `is_descendent_of()`, `isnt_descendent_of()` (for inherited tables)
- ... and similar existence checks for `views`, `sequences`, `triggers`, `roles`, `types`, etc.

### Table For One. (Column and Constraint Testing)

- `has_column( table_name, column_name, description )`, `hasnt_column()`
- `col_not_null( table_name, column_name, description )`, `col_is_null()`
- `col_has_default( table_name, column_name, description )`, `col_hasnt_default()`
- `col_type_is( table_name, column_name, expected_type, description )`
- `has_pk( table_name, description )`, `hasnt_pk()`
- `col_is_pk( table_name, column_name, description )`, `col_isnt_pk()`
- `has_fk( table_name, description )`, `hasnt_fk()`
- `col_is_fk( table_name, column_name, description )`, `col_isnt_fk()`
- `fk_ok( table_name, columns, foreign_table, foreign_columns, description )`: Checks foreign key relationship details.
- `has_check( table_name, description )`, `col_has_check()`
- `index_is_unique()`, `index_is_primary()`

---

## 6. Function, Trigger, and Database Details

### Feeling Funky. (Function/Trigger Testing)

- `can( name, args, description )`: An alias for `has_function()`.
- `function_lang_is( name, args, expected_lang, description )`
- `function_returns( name, args, expected_type, description )`
- `is_definer( name, args, description )`, `isnt_definer()`: Checks if a function is a `SECURITY DEFINER`.
- `is_strict()`, `isnt_strict()`: Checks if a function is `STRICT`.
- `is_aggregate()`, `isnt_aggregate()`, `is_window()`, `isnt_window()`, `is_procedure()`, `isnt_procedure()`
- `volatility_is( name, args, expected_volatility, description )`: Checks if a function's volatility is `IMMUTABLE`, `STABLE`, or `VOLATILE`.
- `trigger_is( table_name, trigger_name, timing, event, function, description )`: Checks the full definition of a trigger.

### Database Deets. (Miscellaneous/System Details)

- `language_is_trusted( lang_name, description )`
- `is_superuser( role_name, description )`, `isnt_superuser()`
- `is_member_of( role_name, group_role, description )`, `isnt_member_of()`

### Who owns me? (Ownership Testing)

- `db_owner_is( expected_owner, description )`
- `schema_owner_is( schema_name, expected_owner, description )`
- `table_owner_is( table_name, expected_owner, description )`
- ... and similar for other objects.

### Privileged Access. (Privilege Testing)

- `database_privs_are( role_name, expected_privs_array, description )`
- `table_privs_are( role_name, table_name, expected_privs_array, description )`
- `column_privs_are( role_name, table_name, column_name, expected_privs_array, description )`
- ... and similar for `sequences`, `functions`, `languages`, `fdw`, etc.

---

## 7. Utility and Diagnostics

- **Diagnostics.**
  - `diag( any_text )`: Prints diagnostic output to the TAP stream (e.g., used for debugging or printing variable values).
- **Conditional Tests.**
  - `skip( N, reason )`: Skips the next _N_ tests with a reason.
  - `todo( N, reason )`: Marks the next _N_ tests as `TODO` (expected to fail).
- **Utility Functions.**
  - `pgtap_version()`: Returns the version of pgTAP.
  - `pg_version()`, `pg_version_num()`: Returns PostgreSQL version information.
  - `os_name()`: Returns the operating system name.

---

For the full, detailed documentation on parameters and usage for each function, please refer to the official site: [pgTAP Documentation](https://pgtap.org/documentation.html).
