---
description: Explore the codebase and generate a project AGENTS.md (agents.md convention) for AI agents
argument-hint: "[scope, languages, focus areas, target audience]"
---

You are a senior software engineer and a technical writer for AI agents. Explore THIS codebase with your tools and generate a file `AGENTS.md` at the project root that will guide an AI agent through development, debugging, refactoring, and testing of the project.

Follow the [agents.md](https://agents.md/) convention. Output ONLY the content of `AGENTS.md` in Markdown — no preamble, no commentary, no code fences around the document itself.

## Optional user hints

${ARGUMENTS:-None — infer everything from the codebase.}

Treat hints (a target scope, languages, focus areas, a target audience) as priorities, not as truth. Evidence from the code always wins over hints.

## Required exploration

Before writing anything, explore the repository systematically. Cover at least:

1. Top-level documentation: `README*`, `CONTRIBUTING*`, `CHANGELOG*`, `LICENSE*`, `docs/`.
2. Manifests and dependencies: `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `pom.xml`, `build.gradle*`, `composer.json`, `Gemfile`, `requirements*.txt`, `Pipfile`, `poetry.lock`, `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, etc.
3. Scripts and automation: `Makefile`, `justfile`, `Taskfile*`, `Rakefile`, `scripts/`, `bin/`, all scripts declared in package manifests.
4. CI/CD: `.github/workflows/`, `.gitlab-ci.yml`, `Jenkinsfile`, `.circleci/`, `azure-pipelines*`, etc.
5. Build, lint, format, typecheck, test, container config: `Dockerfile*`, `docker-compose*`, `.env.example`, `.editorconfig`, `.eslintrc*`, `eslint.config.*`, `.prettierrc*`, `pyproject.toml` (tool sections), `rustfmt.toml`, `.ruff.toml`, `biome.json`, `tsconfig*.json`, `sonar-project.properties`, etc.
6. Source structure: entrypoints, main architecture, key modules and their roles, test directories.
7. Security: secret scanning config (`.gitleaks*`, `truffle*`, `.secret-scanning*`), dependency audit (Dependabot `dependabot.yml`, `Renovate*`, `renovate.json`), auth, input validation, error and logging policy, file of any `SECURITY*` / `CODEOWNERS` / `.github/CODEOWNERS`.

Skip `node_modules`, `vendor`, `dist`, `build`, `.next`, target output, and lock files when gathering evidence.

## Non-negotiable constraints

1. **No invented commands, conventions, or behaviors.**
   - When a command or convention cannot be verified from the files, write `TODO: verify` followed by what to check.
   - Prefer exact, file-verified commands. Quote them verbatim.
2. **Concise, operational, specific.** No marketing language, no vague descriptions. Prefer lists, tables, and code blocks.
3. **Exact structure.** The file must contain exactly these sections in this order — headings must match verbatim:

   ```text
   # agents.md

   ## Project overview
   ## Build and test commands
   ## Code style guidelines
   ## Testing instructions
   ## Security considerations
   ```

4. **Multi-language or multi-package projects.** Organize commands by language or package, with each command clearly attributed to its component. Never mix a command from one component into another.
5. **Dangerous, destructive, or side-effect commands.** Do NOT execute them. Document only what is relevant for development. Flag them explicitly as potentially dangerous (for example, commands that drop databases, force-push, `rm -rf`, mutate CI secrets).
6. **Language.** The content of `AGENTS.md` must be written in English. Section headings must be exactly as specified above. Tone: clear, direct, suited to an AI agent.

## Section contents

Use these checklists as a mandatory content guide. Hit every applicable bullet; if a bullet does not apply, omit it (don't write `N/A`).

### `## Project overview`

- Project purpose (one or two sentences).
- Problem the project solves.
- Main architecture (style, layering, key patterns).
- Key components and their responsibilities.
- Main entrypoints (CLI, server, library exports, worker entrypoints).
- Main technologies and frameworks.
- Most important directories and what each holds.
- Main execution or data flow, when relevant.

### `## Build and test commands`

- Prerequisites (runtime versions, system tools, environment variables).
- Install dependencies — one command per package manager.
- Build — one command per component.
- Run the project locally — one command per component.
- Lint, format, typecheck — one command per tool.
- Run all tests — one command per package manager / framework.
- Run a single test — give the exact invocation (file path or filter).
- Clean, rebuild, reset — only if the project provides such a command.

### `## Code style guidelines`

- Naming conventions (files, functions, classes, variables, constants, DB objects, routes).
- Formatting rules (indentation, line length, quotes, trailing commas).
- Import management (order, grouping, absolute vs relative, alias conventions).
- Error handling (how errors are created, propagated, logged, exposed to callers).
- Recommended patterns (dependency injection, immutability, pure functions, etc.).
- Patterns to avoid (any documented anti-patterns found in docs or reviews).
- File, directory, and module conventions.
- Comments and documentation conventions (when to add JSDoc / docstring / godoc / rustdoc / etc.).
- Project-specific rules found in `CONTRIBUTING`, code style config, or commit hooks.

### `## Testing instructions`

- Test framework(s) used per language.
- Where tests live.
- How to run all tests.
- How to run a single test (exact invocation, filter syntax, IDE run config equivalent).
- How to run tests for a specific module.
- Naming conventions for test files, suites, and individual cases.
- Use of fixtures, mocks, factories, fakes, or helper utilities.
- Coverage expectations or thresholds, when defined.
- CI rules: required checks, required jobs, coverage gates, snapshot rules.

### `## Security considerations`

- Secrets handling: where secrets live, how they are loaded, how they must NOT be hardcoded.
- Input validation: rules and the libraries that enforce them.
- Authentication and authorization: where it lives, which library, how it is tested.
- Dependency and vulnerability management: scanners used, update policy, advisory sources.
- Logging: what is allowed, what must be redacted, log sinks in production.
- Local-dev security: env files, dev containers, debug endpoints, sample credentials.
- Pre-commit, pre-PR, pre-deploy rules (lint, format, secret scan, dependency audit, SAST).
- Code patterns to avoid for security reasons (raw SQL, unsafe deserialization, dynamic eval, path traversal, SSRF, open redirects, etc.).

## Self-check before writing

- Every command and convention is either file-verified or marked `TODO: verify`.
- No commands were executed during exploration beyond read-only inspection (`read`, `grep`, `ls`, `find`). Never run build, install, test, or destructive commands just to discover behavior.
- All five required sections are present, in order, with exact headings.
- Multi-package content is grouped by component and each command is attributed.
- Dangerous commands are documented only when relevant, and flagged.
- The file is in English. Tone is direct and operational.
- The document starts with `# agents.md` and contains nothing else: no preamble, no closing notes.

## Output

Produce ONLY the Markdown content of `AGENTS.md`. Do not wrap it in code fences. Do not add explanation before or after.
