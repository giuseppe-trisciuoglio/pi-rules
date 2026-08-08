# Example rules

Ready-to-use [project rules](https://github.com/giuseppe-trisciuoglio/pi-rules) you
can drop into your own project. Each file is a standalone markdown rule with
frontmatter that controls how `pi-rules` activates it.

## How to use them

1. Pick the rules you want.
2. Copy them into your project's `.pi/rules/` (or `.claude/rules/`, or
   `.agents/rules/`).
3. Tweak the frontmatter and the wording to match your stack and conventions.
4. Run `/rules reload` in pi (or restart the session) to activate them.

## The rules

| File | Channel | What it does |
| --- | --- | --- |
| [`no-commits-push.md`](./no-commits-push.md) | always-apply | Prevents the agent from committing/pushing without asking — a non-negotiable safety guardrail. |
| [`no-over-commenting.md`](./no-over-commenting.md) | globs (`**/*`) | Stops the agent from over-commenting: comment the *why*, not the *what*. |
| [`no-duplicate-code.md`](./no-duplicate-code.md) | globs (`**/*`) | Forces the agent to search for an existing helper before creating a new one. |
| [`db-migration-policy.md`](./db-migration-policy.md) | globs (`**/migrations/**`) | Enforces immutable, incremental DB migrations (Drizzle-flavored). |

## The three channels

- **always-apply** — the full rule lives permanently in the system prompt. Use for
  guardrails that must never be missed (`no-commits-push`).
- **globs** — the rule is injected once per session, the first time the agent
  touches a matching file. Use for conventions tied to specific file types or
  paths.
- **on-demand** — the rule appears in a catalog; the agent loads it with `read`
  when relevant. Use for everything else.

See the main [README](../README.md) for the full frontmatter reference.

## License

Same as the parent project (MIT). Adapt freely.
