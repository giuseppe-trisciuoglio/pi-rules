import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Rule } from "./parser";
import type { NavigationState } from "./context";
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

/**
 * Read-only view over the navigation-context session state. Both status
 * widgets render from it; neither mutates it.
 */
export interface NavigationView {
	getNavigationState(): NavigationState;
}

/** Widget key shared by both status widgets: whichever command rendered
 * most recently owns the slot, and `/rules hide` dismisses either. */
const REPORT_WIDGET = "pi-rules";

function formatKb(kb: number): string {
	return `${kb.toFixed(1)}KB`;
}

function pad(text: string, width: number): string {
	return text.length >= width ? text : text + " ".repeat(width - text.length);
}

export function buildReport(view: RulesView, nav?: NavigationView): string[] {
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
		lines.push("");
	}

	if (nav !== undefined) {
		lines.push(...buildContextSection(nav.getNavigationState()));
	}
	return lines;
}

/**
 * Compact navigation-context section of the /rules report: counts and the
 * tracked directory, plus each skipped file with its reason.
 */
export function buildContextSection(nav: NavigationState): string[] {
	if (nav.launchDir === null) {
		return ["CONTEXT (navigation)", " inactive — launch directory unavailable"];
	}
	const lines = ["CONTEXT (navigation)"];
	lines.push(
		` loaded: ${nav.delivered.length} · pre-seeded: ${nav.preseedCount} · skipped: ${nav.skipped.length}`,
	);
	lines.push(` tracked dir: ${nav.trackedDir ?? "(unset)"}`);
	for (const skip of nav.skipped) lines.push(` ⚠ ${skip.path} — ${skip.reason}`);
	return lines;
}

/**
 * Full /list-context widget: every context file loaded this session
 * (launch-relative paths), the tracked working directory, the host
 * pre-seeded count, and skipped files with their reasons. Pure formatting
 * seam — the command handler only feeds it the live state.
 */
export function buildContextReport(nav: NavigationState): string[] {
	if (nav.launchDir === null) {
		return ["pi-rules context — inactive (launch directory unavailable)"];
	}
	const lines: string[] = [];
	lines.push(
		`pi-rules context — ${nav.delivered.length} loaded · ${nav.preseedCount} pre-seeded · ${nav.skipped.length} skipped`,
		"",
		` launch dir:  ${nav.launchDir}`,
		` tracked dir: ${nav.trackedDir ?? "(unset)"}`,
		"",
	);
	if (nav.delivered.length === 0) {
		lines.push("LOADED THIS SESSION", " (none loaded yet)", "");
	} else {
		lines.push("LOADED THIS SESSION");
		for (const displayPath of nav.delivered) lines.push(` 📂 ${displayPath}`);
		lines.push("");
	}
	if (nav.skipped.length > 0) {
		lines.push("SKIPPED");
		for (const skip of nav.skipped) lines.push(` ⚠ ${skip.path} — ${skip.reason}`);
	}
	return lines;
}

/**
 * /rules            → status report as a widget above the editor
 * /rules reload     → rescan the rule sources (same as /reload, scoped to rules)
 * /rules hide       → dismiss the report widget
 */
export function registerRulesCommand(
	pi: ExtensionAPI,
	view: RulesView,
	nav: NavigationView,
): void {
	pi.registerCommand("rules", {
		description: "Show pi-rules status. Subcommands: reload, hide",
		handler: async (args, ctx) => {
			const subcommand = (args ?? "").trim();
			if (subcommand === "reload") {
				// Rules rescan only — navigation-context state is owned by the
				// extension instance and resets with the session, not here.
				view.rescan(ctx);
				return;
			}
			if (!ctx.hasUI) return;
			if (subcommand === "hide") {
				ctx.ui.setWidget(REPORT_WIDGET, undefined);
				return;
			}
			ctx.ui.setWidget(REPORT_WIDGET, buildReport(view, nav));
		},
	});
}

/**
 * /list-context → session listing of the navigation-context channel as a
 * widget: loaded files (relative paths), tracked working directory,
 * pre-seeded count, skipped files with reasons. Widget-only — nothing is
 * added to the agent conversation.
 */
export function registerListContextCommand(pi: ExtensionAPI, nav: NavigationView): void {
	pi.registerCommand("list-context", {
		description: "List project context files loaded this session",
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) return;
			ctx.ui.setWidget(REPORT_WIDGET, buildContextReport(nav.getNavigationState()));
		},
	});
}
