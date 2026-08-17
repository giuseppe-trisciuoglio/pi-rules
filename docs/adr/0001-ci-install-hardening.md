# ADR-0001: Harden dependency installation in CI

Date: 2026-08-15
Status: Accepted

## Context

A SonarQube triage round flagged the GitHub Actions workflows: `npm install` in
`ci.yml` installed without a lockfile-resolved dependency tree and allowed
lifecycle scripts to run during installation, and `npm ci` in `publish.yml`
also allowed lifecycle scripts. The codebase has no native modules or packages
that rely on install scripts, and `package-lock.json` is committed.

## Decision

- Both workflows install dependencies with `npm ci --ignore-scripts`.
- `ci.yml` switches from `npm install` to `npm ci`, so every CI run resolves
  the exact versions pinned in `package-lock.json`.

## Consequences

- Dependency installation no longer executes arbitrary lifecycle scripts from
  third-party packages, shrinking the CI supply-chain attack surface.
- `npm ci` guarantees reproducible installs across the Node 22.x/24.x matrix.
- Verified locally: `npm ci --ignore-scripts` completes and `tsx`/`esbuild`
  still work because the platform binaries come from lockfile-pinned optional
  dependencies, not from a postinstall script.
- Future caveat: adding a dependency that genuinely needs an install script
  (e.g. native modules built with node-gyp) will silently skip that step; the
  fix at that point is a per-package allowlist via npm's
  `--allow-scripts=true` configuration, not removing the flag globally.

The same triage also fixed parser regexes flagged for super-linear
backtracking, an undocumented default sort in `sources.ts`, a nested ternary,
and consecutive `Array#push` calls in `prompt.ts`; those were mechanical
rule-driven fixes with no behavioral decisions to record.
