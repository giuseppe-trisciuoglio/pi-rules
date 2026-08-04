/**
 * Pi Rules
 *
 * Loads project rules (Cursor/Claude-style markdown files with optional
 * frontmatter) and injects them into the agent context only when relevant:
 *
 * - alwaysApply rules live permanently in the system prompt;
 * - globs rules activate once per session when the agent reads, writes or
 *   edits a matching file — the full rule text is appended to the tool
 *   result, landing exactly when the guidance is needed;
 * - description-only rules are listed in a system-prompt catalog so the
 *   agent can load them with the read tool when it judges them relevant.
 *
 * Scanned directories: .claude/rules, .agents/rules and .pi/rules in the
 * project, plus ~/.claude/rules, ~/.agents/rules and ~/.pi/agent/rules for
 * personal rules. Project rules shadow user rules with the same name.
 *
 * Commands: /rules (status), /rules reload, /rules hide.
 */

import { CONFIG_DIR_NAME, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import * as os from "node:os";
import { parseRuleFile, type Rule } from "./parser";
import { ruleSources, scanRuleFiles } from "./sources";
import { ruleMatchesPath } from "./matcher";
import { ALWAYS_APPLY_WARN_KB, buildRulesSection } from "./prompt";
import { registerRulesCommand } from "./command";

const PATH_TOOLS = new Set(["read", "write", "edit"]);

export default function piRules(pi: ExtensionAPI) {
	let rules: Rule[] = [];
	let activated = new Set<string>();
	let warnings: string[] = [];

	function rescan(ctx: ExtensionContext): void {
		const sources = ruleSources(ctx.cwd, CONFIG_DIR_NAME, os.homedir());
		const { files, shadowWarnings } = scanRuleFiles(sources, ctx.cwd);
		rules = files.map(parseRuleFile);
		activated = new Set<string>();

		warnings = [...shadowWarnings];
		const missingFrontmatter = rules.filter((rule) => !rule.hasFrontmatter);
		if (missingFrontmatter.length > 0) {
			warnings.push(
				`${missingFrontmatter.length} rule(s) without frontmatter — description, globs and alwaysApply are recommended`,
			);
		}
		const alwaysKb = rules.filter((rule) => rule.alwaysApply).reduce((sum, rule) => sum + rule.sizeKb, 0);
		if (alwaysKb > ALWAYS_APPLY_WARN_KB) {
			warnings.push(`always-apply rules total ${alwaysKb.toFixed(1)}KB of system prompt — consider trimming`);
		}

		if (!ctx.hasUI || rules.length === 0) return;
		const always = rules.filter((rule) => rule.alwaysApply).length;
		const globs = rules.filter((rule) => !rule.alwaysApply && rule.globs.length > 0).length;
		const manual = rules.length - always - globs;
		ctx.ui.notify(`📏 pi-rules: ${rules.length} rules (${always} always · ${globs} globs · ${manual} on-demand)`, "info");
		if (warnings.length > 0) {
			ctx.ui.notify(`pi-rules: ${warnings.length} warning(s) — /rules for details`, "warning");
		}
	}

	pi.on("session_start", (_event, ctx) => {
		rescan(ctx);
	});

	pi.on("before_agent_start", (event) => {
		if (rules.length === 0) return;
		return { systemPrompt: `${event.systemPrompt}\n\n${buildRulesSection(rules)}` };
	});

	pi.on("tool_result", (event, ctx) => {
		if (!PATH_TOOLS.has(event.toolName)) return;
		const toolPath = event.input.path;
		if (typeof toolPath !== "string" || toolPath === "") return;

		const matched = rules
			.filter((rule) => !rule.alwaysApply && rule.globs.length > 0 && !activated.has(rule.filePath))
			.filter((rule) => ruleMatchesPath(rule.globs, toolPath, ctx.cwd))
			.sort((a, b) => {
				if (a.priority !== b.priority) return a.priority - b.priority;
				return a.name.localeCompare(b.name);
			});
		if (matched.length === 0) return;

		const blocks: string[] = [];
		for (const rule of matched) {
			activated.add(rule.filePath);
			blocks.push(
				`\n\n---\n\n📏 Project rule activated: **${rule.name}** (${rule.displayPath})\n\n${rule.body}\n\n---\n\nFollow the rule above for this and related files.`,
			);
			if (ctx.hasUI) ctx.ui.notify(`📏 Rule activated: ${rule.name}`, "info");
		}
		const text = { type: "text" as const, text: blocks.join("") };
		return { content: [...event.content, text] };
	});

	registerRulesCommand(pi, {
		getRules: () => rules,
		getActivated: () => activated,
		getWarnings: () => warnings,
		rescan,
	});
}
