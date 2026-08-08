---
description: Database migrations are immutable — generate incremental, review, apply
globs: "**/migrations/**, **/schema/**, **/*.sql"
priority: 10
---

# Database Migration Policy

## Commands (Drizzle)

```bash
drizzle-kit generate   # generate an incremental migration
drizzle-kit migrate    # apply pending migrations
drizzle-kit studio     # open Drizzle Studio
```

## Incremental migrations are mandatory

⚠️ **Existing migrations are immutable.** Once a migration is committed and the
database holds data, it must never be deleted, modified, or regenerated.

When you need a schema change:

1. Update the Drizzle schema in your schema source files.
2. Generate a new incremental migration (`drizzle-kit generate`).
3. Review the generated SQL and verify it is safe for a populated database
   (no `NOT NULL` columns without a default, `USING` casts for enum changes when
   needed, etc.).
4. Apply the migration locally (`drizzle-kit migrate`).
5. Update the ER diagram / schema docs if you keep one.

## Rules for agents

- Never delete or modify already-committed migrations.
- Don't hand-edit generated `.sql` files, unless a human explicitly approves a
  fix for a generation bug (while keeping the final snapshot consistent).
- Don't leave pending migrations: generate, apply, and validate.
- Run migrations before testing code that depends on the updated schema.
