import type { Rule } from "./parser";

/** Total size of always-applied rules beyond which a startup warning is raised. */
export const ALWAYS_APPLY_WARN_KB = 10;

function byPriorityThenName(a: Rule, b: Rule): number {
	if (a.priority !== b.priority) return a.priority - b.priority;
	return a.name.localeCompare(b.name);
}

export function alwaysApplyRules(rules: Rule[]): Rule[] {
	return rules.filter((rule) => rule.alwaysApply).sort(byPriorityThenName);
}

export function globsRules(rules: Rule[]): Rule[] {
	return rules.filter((rule) => !rule.alwaysApply && rule.globs.length > 0).sort(byPriorityThenName);
}

export function onDemandRules(rules: Rule[]): Rule[] {
	return rules.filter((rule) => !rule.alwaysApply && rule.globs.length === 0).sort(byPriorityThenName);
}

/**
 * Builds the system-prompt section: full text of always-applied rules first,
 * then the catalog of the remaining rules so the agent knows what exists and
 * how each rule becomes active. Nothing is ever truncated: an oversized
 * always-applied set is reported through the startup warning instead.
 */
export function buildRulesSection(rules: Rule[]): string {
	if (rules.length === 0) return "";

	const parts: string[] = ["## Project Rules", ""];

	const always = alwaysApplyRules(rules);
	if (always.length > 0) {
		parts.push("### Always applied", "");
		for (const rule of always) {
			parts.push(`<!-- ${rule.displayPath} -->`, rule.body, "");
		}
	}

	const auto = globsRules(rules);
	const manual = onDemandRules(rules);
	if (auto.length + manual.length > 0) {
		parts.push("### Available rules", "");
		parts.push(
			"Rules marked (auto: …) are injected automatically when you read or edit a matching file. Load any other rule with the `read` tool when it becomes relevant to the task.",
			"",
		);
		for (const rule of auto) {
			parts.push(`- **${rule.name}** — ${rule.description} (auto: ${rule.globs.join(", ")}) · \`${rule.displayPath}\``);
		}
		for (const rule of manual) {
			parts.push(`- **${rule.name}** — ${rule.description} · \`${rule.displayPath}\``);
		}
	}

	return parts.join("\n");
}
