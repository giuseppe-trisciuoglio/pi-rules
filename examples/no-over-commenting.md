---
description: Comment the why, not the what — default to no comment
globs: "**/*"
priority: 10
---

# No Over-Commenting — Explain the Why, Not the What

> **Anti-noise rule.** Agents tend to comment *every* line and restate the code
> they just wrote. Well-written code is largely self-documenting; a comment
> should say what the code *cannot* say on its own.

## Principle

A comment must add information that is **not deducible** from the code: the
*why* of a choice, an external constraint, a non-obvious gotcha. It must not
paraphrase *what* a readable line does.

- ✅ **Why**: motivation, trade-offs, domain/business constraints, gotchas,
  invariants, references to external contracts (specs, infra, RFCs).
- ❌ **What**: paraphrasing the code (`// increment i`, `// return the result`),
  types already obvious from the signature, language trivialities.

## Operating rules

1. **Default: no comment.** Add one only when a competent reader would not
   understand *why* the code is this way. If you need a comment to explain
   *what* it does, first try to make the code clearer (better names, extract a
   function), then reconsider.
2. **Concise docstrings.** For public functions/types, one or two lines covering
   responsibility and non-obvious constraints. Do **not** restate every parameter
   (`@param value The value`). Use `@param` / `@throws` only when they add
   information (error conditions, non-obvious expected formats).
3. **One line, not a paragraph.** Avoid comment blocks longer than the code they
   describe. If a unit needs an essay to be understood, that's a design signal —
   not a documentation task.
4. **No "for the reviewer" comments.** Approach explanations go in the PR
   description or review comments, **not** in source.
5. **No redundant comments in tests.** `describe` / `it` already state behavior.
   In test bodies, comment only the *non-obvious* intent of a fixture or
   assertion, not what the assertion already says.
6. **Keep the comments that explain why.** This rule cuts noise; it is not an
   invitation to delete useful comments (constraints, gotchas, external
   references). Don't remove a comment documenting a non-obvious choice just to
   "reduce."

## Examples

```
# ❌ over-commenting: paraphrases the code
# Trim the value and parse it as a number
parsed = parse_number(trim(value))
# If it's not finite, raise an error
if not is_finite(parsed):
    raise CoercionError(...)

# ✅ comment only if it adds a non-obvious why
# Trimming tolerates residual spaces from an infra-injected secret.
parsed = parse_number(trim(value))
if not is_finite(parsed):
    raise CoercionError(...)
```

## Also applies

- Security and i18n rules still hold: when a comment is needed (e.g. "never log
  secret values"), keep it — that's a *why* of security, not a paraphrase.
