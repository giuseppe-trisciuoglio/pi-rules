# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.0] - 2026-09-12

### Added

- Navigation-context channel (fourth activation channel): plain `CLAUDE.md` / `AGENTS.md` / `RULES.md` files discovered by walking up from each directory the agent touches (bash `cd`, `read`/`write`/`edit` file paths, `grep`/`ls`/`find` search dirs) to the launch directory are delivered verbatim (64 KB per-file cap) as a single durable message, exactly once per session per file. Discovery is hard-bounded to the launch-directory subtree, including through symlinks; skipped files (unreadable / out-of-subtree) are recorded with their reason.
- `/list-context` command: session listing of loaded context files (relative paths, tracked working directory, pre-seeded count, skipped files with reasons), rendered as a widget with zero conversation cost.
- `/rules` report gains a CONTEXT (navigation) section; compact delivery feedback line (`📂 loaded <paths>`) with expandable full contents via a registered message renderer.
- System-prompt guidance recommending `&& pwd` on directory-change commands while the navigation channel is active.
- Pre-seed of the seen-files set from the host's startup context files (warning + upward fallback scan when absent) and re-derivation of the seen/delivered sets from session history across host-driven `/reload` — already-delivered context is never re-sent.
- Dependabot configuration for npm and GitHub Actions ecosystems with weekly Monday schedule, separate production/dev-dependency groups, low open-PR limits, and an auto rebase strategy; tracked in `.github/dependabot.yml` and announced in the README.
- English translation of the 23 rule files under `examples/java-spring-boot/rules/` (body, headings, and frontmatter `description`); filenames and Java code blocks were already English and were preserved as-is.

### Changed

- Bumped GitHub Actions: `actions/checkout` from 4 to 7 and `actions/setup-node` from 4 to 7.
- Bumped dev dependencies: `@earendil-works/pi-coding-agent` from 0.80.2 to 0.85.1 and `tsx` from 4.21.0 to 4.23.13 (isolated from the higher-risk toolchain bumps still on Dependabot PR #12).
- Internal refactor of report building, command parsing, and context-delivery record handling to support the navigation-context channel without affecting public command surface or unit-test contracts.

### Fixed

- Globs-rule dedup re-armed on session compaction: a Globs Rule can fire once between session start (or `/rules reload`) and the first compaction, and again after each subsequent compaction, instead of being silently dropped after a re-touch of the same file. Implemented by clearing the `activated` set synchronously in a `session_before_compact` handler so the dedup gate is reset before the host invokes the LLM to generate the summary.

## [1.1.0] - 2026-08-09

### Added

- `/extract-rules` prompt template: two-phase Rule Extraction that surveys the codebase for evidence-based conventions (with per-pattern confidence), lets the user pick candidates interactively, and writes the selected ones as individual Globs or On-Demand Rules into `.pi/rules/` — extending existing rules instead of overwriting them, and never emitting `alwaysApply`.

## [1.0.0] - 2026-08-04

### Added

- Three-channel rule activation: always-apply (system prompt), globs (tool-result injection, once per session), on-demand (catalog).
- Cursor-style frontmatter (`description`, `globs`, `alwaysApply`, `priority`), optional with derived defaults and a missing-frontmatter warning.
- Recursive scanning of six rule sources: `.claude/rules`, `.agents/rules`, `.pi/rules` at project and user level, with project-over-user and `.pi` > `.agents` > `.claude` shadowing.
- `/rules` status report command, with `reload` and `hide` subcommands.
- Startup notifications: aggregated rule counts, missing-frontmatter and ~10KB always-apply budget warnings.
- Smoke test suite covering frontmatter parsing, glob matching, source shadowing, prompt building and the report renderer.
