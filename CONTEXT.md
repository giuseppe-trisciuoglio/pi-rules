# pi-rules

A pi extension that reads project rule files (markdown with optional frontmatter, Cursor-style) and injects them into the agent's context only when relevant.

## Language

**Rule**:
A markdown file in a project's rules directory (e.g. `.claude/rules/*.md`) carrying guidance the agent must follow. Frontmatter is optional but recommended: `description`, `globs`, `alwaysApply` guide activation; when absent, defaults are derived from content and a warning is logged.
_Avoid_: guideline, convention, policy

**Always-Apply Rule**:
A Rule with `alwaysApply: true`; its full content lives permanently in the system prompt.
_Avoid_: global rule, permanent rule

**Globs Rule**:
A Rule with `globs` patterns; it activates when the agent touches a file whose path matches.
_Avoid_: conditional rule, path rule

**On-Demand Rule**:
A Rule with only a `description` (explicit or derived); it appears in the system-prompt catalog and the agent loads it deliberately when it judges it relevant.
_Avoid_: manual rule, lazy rule

**Rule Source**:
One of the six directories scanned for Rules: `.claude/rules`, `.agents/rules`, `.pi/rules` under the project root, and `~/.claude/rules`, `~/.agents/rules`, `~/.pi/agent/rules` for the user level. Project Rules shadow user Rules with the same filename; at the same level, `.pi` > `.agents` > `.claude` wins with a warning.
_Avoid_: rules folder, origin

**Activation**:
The one-time injection of a Globs Rule's full content into a tool result when the agent touches a matching file. Happens at most once per session per Rule; resets on rescan.
_Avoid_: trigger, firing

**Rule Extraction**:
The derivation of Rules from conventions actually observed in a codebase, performed by the `/extract-rules` prompt template shipped with the package. Extraction produces Globs Rules or On-Demand Rules — never Always-Apply Rules — written as individual files into the project's `.pi/rules` Rule Source.
_Avoid_: import, bootstrap, generation
