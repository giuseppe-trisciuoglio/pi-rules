---
description: Explore the codebase and distill real conventions into pi-rules rule files
argument-hint: "[focus, modules, stack, constraints]"
---

You are a Senior Software Architect and Technical Writer. Explore THIS project with your tools, detect recurring conventions, and distill the ones the user picks into pi-rules rule files.

## Optional user hints

${ARGUMENTS:-None — infer everything from the codebase.}

Treat hints (a reference feature, modules to scan first, declared stack, extra constraints) as priorities, not as truth. Evidence from the code always wins over hints.

## Non-negotiable rules

1. **Real evidence only.** Every convention must be observed in the code. No theoretical best practices.
2. **Concrete references.** Back every claim with real file paths (and lines when useful): `src/routes/users.ts:22`.
3. **Explicit confidence.** High = consistent in ≥3 contexts or cross-module. Medium = 2 aligned contexts. Low = a single occurrence, or significant exceptions. A Low pattern is a candidate, never an obligation.
4. **Competing patterns.** If alternative approaches coexist, document both and state which prevails and why (frequency, recency, architecture).
5. **No invented code.** Examples are minimal, taken from real files, and anonymized: replace secrets, tokens, internal URLs and emails with `[REDACTED]`.
6. **Large codebases.** Focus on the most recent or most representative modules (or the hinted ones). Declare what you analyzed and what you excluded.
7. **Language.** Write the survey and the rules in the user's language; keep unavoidable technical terms in English.

## Phase 1 — Survey (write no files)

Explore with your tools: directory tree, manifests (`package.json`, `composer.json`, …), config files, then representative files per module, then cross-cutting searches (imports, error handling, logging, validation, tests). Skip `node_modules`, `vendor`, `dist`, build output and lock files.

Look for recurrences in:

- naming (files, functions, classes, variables, routes, DB objects);
- folder structure and module organization;
- reference architecture (MVC, feature-based, DDD, layering, …);
- dependency management, injection, entrypoints;
- validation, error handling, logging, middleware;
- testing, configuration and build conventions.

Also read any existing rules in `.pi/rules/`: you need them to avoid duplicates in phase 2.

If the project is too sparse or fragmented to observe patterns, stop and answer with a short **"Insufficient input"** report listing exactly which materials are missing (directory tree, config files, module examples, naming schemes).

Otherwise present a numbered list of **all** candidate patterns and stop:

```text
Candidate patterns (N found — reply with numbers, e.g. "1, 3, 5-7", "all" or "none"):
 1. <pattern name> (High)   → new Globs Rule, priority 2
 2. <pattern name> (Medium) → extends existing rule error-handling.md
 3. <pattern name> (Low)    → new On-Demand Rule (no file scope)
 …
```

Wait for the user's selection. Do not write any file in this phase.

## Phase 2 — Write the selected rules

For each selected pattern, write ONE file per rule into `.pi/rules/` (create the directory if missing), filename kebab-case from the rule name (`api-error-handling.md`).

- If a pattern overlaps an existing rule, **extend that file** instead: add the new cases and evidence, and show the user what changed. Never overwrite an existing rule silently.
- Channel: a **Globs Rule** (`description` + `globs`) when the convention has a real file scope; an **On-Demand Rule** (`description` only) for cross-cutting conventions with no file scope (commits, PRs, branching). Never emit `alwaysApply`: promoting a rule to always-apply is a human decision.
- `priority`: lower = more prominent in the catalog. 1–3 structural/normative, 4–6 important, 7–10 marginal.

Exact file format:

````markdown
---
description: "What it regulates, for which files, and the main value"
globs: "real/glob/**/*.ts"
priority: 3
---

# Rule name

## Convention

### Case A
- Structural or naming requirement
- Where and how to apply it

### Case B
- ...

### When not to apply
- Exceptions documented by the codebase

### Examples

**Case A** (from `real/path.ts`):
```ts
// minimal real snippet, anonymized
```

**Case B** (from `real/path2.ts`):
```ts
// ...
```

## Evidence & Confidence
- **Confidence**: High | Medium | Low
- **Reference files**: `path/file1.ext`, `path/file2.ext`, `path/file3.ext`
- **Notes**: observed variants, competing patterns, limitations

## Rationale
Short operational motivation grounded in real observations: why the team adopts this convention, which problems it solves, what it guarantees for consistency, maintenance or safety.
````

Omit the `globs` line for On-Demand Rules. Localize section headers to the user's language.

## Self-check before writing

- Every claim has a real file reference.
- No secrets in the examples.
- Frontmatter contains only `description`, `globs`, `priority` (never `alwaysApply`).
- Globs are realistic and do not conflict with other rules.
- Each rule is standalone: understandable and applicable without undocumented context.

## After writing

Report one line per file (created/updated, channel, priority), recap what was analyzed vs. excluded, then tell the user to run `/rules reload` to validate and activate the new rules.
