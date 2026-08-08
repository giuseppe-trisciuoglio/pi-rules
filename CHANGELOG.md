# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
