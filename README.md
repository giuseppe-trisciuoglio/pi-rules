# Pi Rules

Cursor/Claude-style project rules for [pi](https://github.com/earendil-works/pi): markdown files with optional frontmatter, injected into the agent context **only when relevant** — instead of stuffing every convention into the system prompt on every turn.

## How it works

Rules are plain markdown files. An optional frontmatter block controls how each rule is activated:

```markdown
---
description: Prevent direct commits and pushes to git
globs: "**/*"
alwaysApply: true
priority: 00
---

# No Direct Git Commits and Pushes
...
```

Three activation channels, driven by the frontmatter:

| Channel | Frontmatter | Behavior |
| --- | --- | --- |
| **Always-apply** | `alwaysApply: true` | Full rule text lives permanently in the system prompt, ordered by `priority`. |
| **Globs** | `globs: "**/*.ts"` | When the agent reads, writes or edits a matching file, the full rule text is appended to the tool result. Once per session per rule, then never again. |
| **On-demand** | only `description` | The rule appears in a system-prompt catalog (name + description + path); the agent loads it with the `read` tool when it judges it relevant. |

A **fourth channel — navigation context** — is not frontmatter-driven: it loads plain `CLAUDE.md` / `AGENTS.md` / `RULES.md` files from the directories the agent actually visits (see below).

Frontmatter is **optional but recommended**. Without it the rule still works — description is derived from the first markdown heading, and the rule becomes on-demand — but a warning is reported at scan time.

### Frontmatter fields

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `description` | string | derived from first `# heading` | Shown in the catalog; helps the agent pick on-demand rules. |
| `globs` | string or list | `[]` | Single pattern, comma-separated, or inline list (`["**/*.ts", "**/*.tsx"]`). |
| `alwaysApply` | boolean | `false` | Full text always in the system prompt. |
| `priority` | number | — | Ascending sort key for the always-applied block and the catalog. |

## Scanned directories

Six sources are scanned recursively for `.md` files:

| Level | Directories |
| --- | --- |
| Project | `.claude/rules`, `.agents/rules`, `.pi/rules` |
| User | `~/.claude/rules`, `~/.agents/rules`, `~/.pi/agent/rules` |

Name collisions are resolved by precedence: **project shadows user**; at the same level **`.pi` > `.agents` > `.claude`**. Every shadowed file is reported as a warning.

## Navigation context (on-demand context loading)

pi loads `CLAUDE.md` / `AGENTS.md` at startup only for the launch directory and its parents — deeper directories stay invisible. This extension closes that gap: as the agent navigates the project mid-session, context files of the directories it touches are loaded automatically.

- **What triggers loading**: any tool activity in a directory — a bash directory change (`cd services/api && pwd`), a `read`/`write`/`edit` of a file in it, or a `grep`/`ls`/`find` over it. From that directory the extension walks upward to the launch directory, collecting context files deepest-first.
- **Recognized file names**: exactly `CLAUDE.md`, `AGENTS.md`, `RULES.md` (a directory with several of them contributes all three, in that fixed order). Content is injected verbatim — no frontmatter parsing — capped at the first 64 KB per file.
- **One-time per session**: each file is delivered exactly once per session, as a single durable message before the agent's next response. Revisiting an already-served directory produces no new message and no UI line. Files the host already loaded at startup are never re-delivered, and files skipped (unreadable, or symlink-resolving outside the launch directory) are recorded with their reason.
- **Scope**: discovery never leaves the launch-directory subtree — nothing above it and nothing outside it (even via symlinks) is ever read.
- **Compact feedback**: each delivery shows one line, e.g. `📂 loaded services/api/CLAUDE.md, CLAUDE.md`; expanding the message shows the full contents.

### Usage examples

```bash
# agent navigates into a package — its context files are loaded before the next response
cd services/api && pwd

# touching a file also triggers discovery for its directory
# (read src/server.ts → walk-up from src/ to the launch directory)
```

> **Tip**: append `&& pwd` to directory-change commands. Ambiguous forms (`cd -`, `cd ~`, `cd $VAR`, `cd $(...)`) cannot be resolved from the command string alone — the `pwd` output is what lets the extension track them. The system prompt carries this recommendation automatically while the channel is active.

### Inspecting the channel

- `/list-context` — session listing of loaded project context files: relative paths, tracked working directory, pre-seeded count, and skipped files with reasons. Rendered as a widget with zero conversation cost.
- `/rules` — the report gains a **CONTEXT (navigation)** section with the same state.

Navigation state resets only with the session (`/new`, `/resume`, `/fork`); `/rules reload` rescans the rule sources without touching it — already-delivered context is never re-sent.

## Commands

- `/rules` — status report (rules by channel, sizes, globs, activated-this-session, warnings, navigation-context section)
- `/rules reload` — rescan the sources without a full `/reload`
- `/rules hide` — dismiss the report widget
- `/list-context` — session listing of loaded navigation-context files (see above)
- `/extract-rules [hints]` — distill codebase conventions into new rule files (see below)
- `/init [hints]` — generate a project `AGENTS.md` (agents.md convention) from the current codebase (see below)

The index is rebuilt on session start and on `/reload`; a rescan also resets the globs activation dedup, so edited rules can be injected again.

### Extracting rules from a codebase

The package ships an `/extract-rules` prompt template that turns the agent into a convention extractor. It explores the project with its own tools, presents a numbered list of candidate patterns with confidence levels, and — once you pick — writes one file per rule into `.pi/rules/` with kebab-case names. Extracted rules are always **Globs** or **On-Demand** rules: promotion to always-apply stays a human decision. Existing rules are read first and extended rather than overwritten. Run `/rules reload` afterwards to validate and activate them.

Optional free-text hints steer the scan: `/extract-rules focus on the billing module, stack NestJS`.

### Generating a project AGENTS.md

The package also ships an `/init` prompt template (analogous to Claude Code's `/init`) that turns the agent into a senior software engineer and technical writer. It explores the project with its own tools — manifests, scripts, CI/CD, lint/format/typecheck/test config, source structure, security configs — and writes a single `AGENTS.md` at the project root with the exact section structure required by the [agents.md](https://agents.md/) convention: `Project overview`, `Build and test commands`, `Code style guidelines`, `Testing instructions`, `Security considerations`. Commands and conventions are always file-verified, or marked `TODO: verify` for follow-up. Multi-package projects are grouped by component, and dangerous commands are documented only when relevant and explicitly flagged.

Optional free-text hints steer the scope: `/init scope: backend, languages: TypeScript and Python, focus: payments module`.

## Budget guardrails

Nothing is ever truncated silently. If always-applied rules exceed ~10KB of system prompt in total, a startup warning suggests trimming — the content is still injected, by design.

## Known limitations

- Only the `read`, `write` and `edit` tools trigger globs activation (paths in `bash` commands or patch-based tools are not matched). The navigation-context channel is broader: it additionally observes `bash` directory changes and `grep`/`ls`/`find` search directories — but patch-based tools remain invisible to it.
- `globs: "*"` matches only top-level files; use `**/*` to match at any depth (standard glob semantics).
- Bash commands that change directory without a visible `pwd` (e.g. `cd $SOME_DIR` alone) cannot be tracked — append `&& pwd`.

## Install

```bash
pi install git:github.com/giuseppe-trisciuoglio/pi-rules
# or from npm:
pi install npm:@giuseppe.trisciuoglio/pi-rules
# or from a local checkout:
pi install /path/to/pi-rules
# or try without installing:
pi -e /path/to/pi-rules/src/index.ts
```

## Development

```bash
npm install
npm test              # typecheck + vitest unit tests + smoke tests
npx tsx test/smoke-test.ts /path/to/some/project   # + live preview against a real rules dir
```

No build step: pi loads TypeScript extensions directly.

Dependency-update PRs (npm packages + GitHub Actions) are produced by [Dependabot](https://docs.github.com/en/code-security/dependabot) on a weekly Monday schedule, configured in [`.github/dependabot.yml`](./.github/dependabot.yml). Dependency bumps are grouped to keep PR noise low and labelled `dependencies` + `enhancement`.

## License

MIT — see [LICENSE](./LICENSE).
