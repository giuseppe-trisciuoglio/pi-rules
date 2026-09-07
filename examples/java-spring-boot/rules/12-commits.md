---
description: Commit message conventions
globs: "**/*"
alwaysApply: false
---

# Commit Rules

Use Conventional Commits with a scope when the project does not specify a different standard.

```text
<type>(<scope>): <subject>
```

## Recommended Types

| Type | Use |
|------|-----|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Refactoring without functional change |
| `perf` | Performance improvement |
| `style` | Formatting without logic change |
| `test` | Tests |
| `docs` | Documentation |
| `build` | Build system or dependencies |
| `ci` | CI/CD |
| `chore` | Maintenance |
| `revert` | Revert |

## Scope

- Use a lowercase, meaningful scope: domain, module, package, or component (`search`, `payment`, `api`, `persistence`, `global`).
- For cross-cutting changes, use `global` or the scope established by the project.

## Rules

- Subject max 100 characters.
- Use the imperative present: `add`, `fix`, `remove`, `update`.
- Do not include sensitive details in the message.
- If the commit closes an issue or introduces a breaking change, document it in the body/footer.

## Examples

```text
feat(search): add provider timeout handling
fix(api): return problem details for validation errors
test(persistence): cover duplicate key conflict
refactor(domain): extract value object validation
```