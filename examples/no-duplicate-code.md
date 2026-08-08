---
description: Search before creating — reuse helpers, don't recreate them
globs: "**/*"
priority: 10
---

# No Duplicate Code — Search Before You Create

## Rule

Before writing **any** helper or technical utility (error type-guards, parsers,
formatters, mappers, validators, shared constants), it is **mandatory** to
search for an existing implementation and reuse it. Do not recreate code that
already exists.

This applies in particular to **cross-cutting** utilities (not tied to a single
domain): define them **once** in the canonical shared location and import from
there.

## Mandatory procedure (before creating a helper)

1. **Search by name and by logic** with a targeted grep:

   ```bash
   # by function name
   grep -rn "isDuplicateKeyError" .
   # by characteristic logic / constant (often more effective than the name)
   grep -rn "23505" .
   ```

2. If it exists → **import it**, don't rewrite it.
3. If it exists but in the wrong place (inside a feature when it's cross-cutting)
   → **promote it** to the canonical shared location and update imports, flagging
   it to the human reviewer.
4. Only if it exists nowhere → create it in the correct shared location, not in
   a feature-local `utils/` folder.

## The discrimination

> If the same logic could serve more than one feature, it's cross-cutting → it
> belongs in the shared library. Truly domain-specific logic stays in the feature.

## Do

- Run the search **before** creating a technical helper.
- Import from the canonical shared location.
- Promote a duplicated helper to the shared location and update imports.

## Don't

- Don't create a second `util-errors.ts` (or similar) with logic already present
  elsewhere.
- Don't assume an "obvious" function doesn't exist yet — always search.
- Don't leave `// TODO: use the one in shared` comments as an excuse to duplicate.
