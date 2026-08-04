import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Rule } from "./parser";
import { alwaysApplyRules, globsRules, onDemandRules } from "./prompt";

/**
 * Read-only view over the extension state used to render the /rules report.
 */
export interface RulesView {
	getRules(): Rule[];
	getActivated(): ReadonlySet<string>;
	getWarnings(): string[];
	rescan(ctx: ExtensionContext): void;
}

function formatKb(kb: number): string {
	return `${kb.toFixed(1)}KB`;
}

function pad(text: string, width: number): string {
	return text.length >= width ? text : text + " ".repeat(width - text.length);
}

export function buildReport(view: RulesView): string[] {
	const rules = view.getRules();
	const activated = view.getActivated();
	const always = alwaysApplyRules(rules);
	const auto = globsRules(rules);
	const manual = onDemandRules(rules);

	const lines: string[] = [];
	lines.push(`pi-rules — ${rules.length} rules · ${activated.size} activated this session`, "");

	const row = (icon: string, rule: Rule, extra: string): string =>
		` ${icon} ${pad(rule.name, 30)} ${pad(formatKb(rule.sizeKb), 8)} ${extra}${rule.hasFrontmatter ? "" : "  ⚠ no frontmatter"}`;

	if (always.length > 0) {
		lines.push("ALWAYS-APPLY");
		for (const rule of always) lines.push(row("✅", rule, rule.displayPath));
		lines.push("");
	}
	if (auto.length > 0) {
		lines.push("GLOBS (auto-activate)");
		for (const rule of auto) {
			lines.push(row("🔗", rule, `${activated.has(rule.filePath) ? "ACTIVATED · " : ""}${rule.globs.join(", ")}`));
		}
		lines.push("");
	}
	if (manual.length > 0) {
		lines.push("ON-DEMAND");
		for (const rule of manual) lines.push(row("📄", rule, rule.displayPath));
		lines.push("");
	}

	const warnings = view.getWarnings();
	if (warnings.length > 0) {
		lines.push("WARNINGS");
		for (const warning of warnings) lines.push(` ⚠ ${warning}`);
	}
	return lines;
}

/**
 * /rules            → status report as a widget above the editor
 * /rules reload     → rescan the rule sources (same as /reload, scoped to rules)
 * /rules hide       → dismiss the report widget
 */
export function registerRulesCommand(pi: ExtensionAPI, view: RulesView): void {
	pi.registerCommand("rules", {
		description: "Show pi-rules status. Subcommands: reload, hide",
		handler: async (args, ctx) => {
			const subcommand = (args ?? "").trim();
			if (subcommand === "reload") {
				view.rescan(ctx);
				return;
			}
			if (!ctx.hasUI) return;
			if (subcommand === "hide") {
				ctx.ui.setWidget("pi-rules", undefined);
				return;
			}
			ctx.ui.setWidget("pi-rules", buildReport(view));
		},
	});
}
