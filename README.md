# Pi Rules

Cursor/Claude-style project rules for [pi](https://github.com/earendil-works/pi-coding-agent): markdown files with optional frontmatter, injected into the agent context **only when relevant** — instead of stuffing every convention into the system prompt on every turn.

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

## Commands

- `/rules` — status report (rules by channel, sizes, globs, activated-this-session, warnings)
- `/rules reload` — rescan the sources without a full `/reload`
- `/rules hide` — dismiss the report widget
- `/extract-rules [hints]` — distill codebase conventions into new rule files (see below)

The index is rebuilt on session start and on `/reload`; a rescan also resets the globs activation dedup, so edited rules can be injected again.

### Extracting rules from a codebase

The package ships an `/extract-rules` prompt template that turns the agent into a convention extractor. It explores the project with its own tools, presents a numbered list of candidate patterns with confidence levels, and — once you pick — writes one file per rule into `.pi/rules/` with kebab-case names. Extracted rules are always **Globs** or **On-Demand** rules: promotion to always-apply stays a human decision. Existing rules are read first and extended rather than overwritten. Run `/rules reload` afterwards to validate and activate them.

Optional free-text hints steer the scan: `/extract-rules focus on the billing module, stack NestJS`.

## Budget guardrails

Nothing is ever truncated silently. If always-applied rules exceed ~10KB of system prompt in total, a startup warning suggests trimming — the content is still injected, by design.

## Known limitations

- Only the `read`, `write` and `edit` tools trigger globs activation (paths in `bash` commands or patch-based tools are not matched).
- `globs: "*"` matches only top-level files; use `**/*` to match at any depth (standard glob semantics).

## Install

```bash
pi install git:github.com/giuseppe-trisciuoglio/pi-rules
# or from a local checkout:
pi install /path/to/pi-rules
# or try without installing:
pi -e /path/to/pi-rules/src/index.ts
```

## Development

```bash
npm install
npm test              # typecheck + smoke tests
npx tsx test/smoke-test.ts /path/to/some/project   # + live preview against a real rules dir
```

No build step: pi loads TypeScript extensions directly.

## License

MIT — see [LICENSE](./LICENSE).
