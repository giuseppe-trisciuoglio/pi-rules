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
 * Commands: /rules (status, incl. navigation-context section),
 * /rules reload, /rules hide, /list-context (session context listing).
 */

import {
	CONFIG_DIR_NAME,
	type ExtensionAPI,
	type ExtensionContext,
	type ToolResultEvent,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import * as os from "node:os";
import { parseRuleFile, type Rule } from "./parser";
import { ruleSources, scanRuleFiles } from "./sources";
import { ruleMatchesPath } from "./matcher";
import { ALWAYS_APPLY_WARN_KB, buildRulesSection } from "./prompt";
import { registerListContextCommand, registerRulesCommand } from "./command";
import {
	CONTEXT_MESSAGE_TYPE,
	NAVIGATION_GUIDANCE,
	deliveryDisplayPaths,
	dirForToolEvent,
	discoverContextFiles,
	formatDeliveryLine,
	initNavigationState,
	pickNewFiles,
	preseedSeenFiles,
	type ContextFile,
	type NavigationState,
} from "./context";

const PATH_TOOLS = new Set(["read", "write", "edit"]);

/** Concatenated text of a tool result's text blocks (bash output source). */
function textContent(content: ReadonlyArray<{ type: string; text?: string }>): string {
	return content
		.filter((block) => block.type === "text" && typeof block.text === "string")
		.map((block) => block.text)
		.join("\n");
}

/** Combined message body for one delivery, files already deepest-first. */
function composeContextMessage(files: readonly ContextFile[]): string {
	const blocks = files.map(
		(file) => `---\n\n📂 Project context: **${file.displayPath}**\n\n${file.content}\n\n---`,
	);
	return (
		`📂 Loaded ${files.length} project context file(s) for the current location:\n\n` +
		blocks.join("\n\n") +
		`\n\nTake the context above into account for files under these directories.`
	);
}

export default function piRules(pi: ExtensionAPI) {
	let rules: Rule[] = [];
	let activated = new Set<string>();
	let warnings: string[] = [];
	// Navigation-channel state. Lives and dies with this extension instance:
	// the host re-instantiates the extension on session replacement, so a
	// fresh instance (rebuilt on every session start) is the reset — there is
	// deliberately no explicit clear path.
	let navigation: NavigationState = initNavigationState("", []);

	// Compact renderer for context deliveries: one line listing the loaded
	// paths, full file contents on expansion. Registered once per extension
	// instance — the host keys renderers by custom type and rebuilds the
	// instance on session replacement, so re-registration never duplicates.
	pi.registerMessageRenderer(CONTEXT_MESSAGE_TYPE, (message, options, theme) => {
		const line = formatDeliveryLine(
			deliveryDisplayPaths(message.details, navigation.launchDir),
		);
		if (!options.expanded) {
			return new Text(theme.fg("customMessageLabel", line), 0, 0);
		}
		const body =
			typeof message.content === "string"
				? message.content
				: message.content
						.map((block) => (block.type === "text" ? block.text : ""))
						.join("\n");
		return new Text(
			`${theme.fg("customMessageLabel", line)}\n\n${theme.fg("customMessageText", body)}`,
			0,
			0,
		);
	});

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
		// The seen set is rebuilt from this session's own delivery records, so
		// a mid-conversation reinit still knows what was already delivered.
		let history: unknown[] = [];
		try {
			history = ctx.sessionManager.getEntries();
		} catch {
			// A host without readable history behaves like a fresh session.
		}
		navigation = initNavigationState(ctx.cwd, history);
	});

	pi.on("before_agent_start", (event, ctx) => {
		// Lazy pre-seed: the host's startup context files are only visible on
		// this event, and they must be seen before any delivery can occur.
		if (!navigation.preSeeded && navigation.launchDir !== null) {
			navigation.preSeeded = true;
			const preseed = preseedSeenFiles(
				event.systemPromptOptions?.contextFiles,
				navigation.launchDir,
			);
			for (const p of preseed.paths) navigation.seen.add(p);
			navigation.preseedCount = preseed.paths.length;
			if (preseed.fallback && ctx.hasUI) {
				ctx.ui.notify(
					"pi-rules: host context-file list absent or unparseable — seen files pre-seeded by scanning the launch directory tree",
					"warning",
				);
			}
		}

		let prompt = event.systemPrompt;
		let changed = false;
		if (rules.length > 0) {
			prompt += `\n\n${buildRulesSection(rules)}`;
			changed = true;
		}
		if (navigation.launchDir !== null) {
			prompt += `\n\n${NAVIGATION_GUIDANCE}`;
			changed = true;
		}
		return changed ? { systemPrompt: prompt } : undefined;
	});

	pi.on("tool_result", async (event, ctx) => {
		// Channel 1 (globs rules) runs first and is the only channel allowed
		// to alter the tool result. Channel 2 (navigation context) only ever
		// sends a durable message; it never touches the returned content.
		let ruleResult: { content: typeof event.content } | undefined;

		const toolPath = PATH_TOOLS.has(event.toolName) ? event.input.path : undefined;
		if (typeof toolPath === "string" && toolPath !== "") {
			const matched = rules
				.filter((rule) => !rule.alwaysApply && rule.globs.length > 0 && !activated.has(rule.filePath))
				.filter((rule) => ruleMatchesPath(rule.globs, toolPath, ctx.cwd))
				.sort((a, b) => {
					if (a.priority !== b.priority) return a.priority - b.priority;
					return a.name.localeCompare(b.name);
				});
			if (matched.length > 0) {
				const blocks: string[] = [];
				for (const rule of matched) {
					activated.add(rule.filePath);
					blocks.push(
						`\n\n---\n\n📏 Project rule activated: **${rule.name}** (${rule.displayPath})\n\n${rule.body}\n\n---\n\nFollow the rule above for this and related files.`,
					);
					if (ctx.hasUI) ctx.ui.notify(`📏 Rule activated: ${rule.name}`, "info");
				}
				const text = { type: "text" as const, text: blocks.join("") };
				ruleResult = { content: [...event.content, text] };
			}
		}

		await deliverNavigationContext(event, ctx);
		return ruleResult;
	});

	/**
	 * Navigation channel: maps the tool result to a Touched Directory,
	 * discovers unseen Context Files from it up to the Launch Directory, and
	 * delivers them as exactly one combined durable message. Files are marked
	 * seen synchronously before the awaited send; a rejected send rolls the
	 * marking back and warns, so the context stays deliverable. The host
	 * serializes tool_result handlers per session, so the pre-await marking
	 * is the guard against double delivery. Returns nothing — this channel
	 * never alters the tool result.
	 */
	async function deliverNavigationContext(
		event: ToolResultEvent,
		ctx: ExtensionContext,
	): Promise<void> {
		if (navigation.launchDir === null) return;
		const launchDir = navigation.launchDir;
		const bases = {
			launchDir,
			trackedDir: navigation.trackedDir ?? launchDir,
		};
		const { touchedDir, trackedDir } = dirForToolEvent(
			event.toolName,
			event.input,
			bases,
			event.toolName === "bash" ? textContent(event.content) : "",
		);
		if (trackedDir !== null) navigation.trackedDir = trackedDir;
		if (touchedDir === null) return;

		const { files, skipped } = discoverContextFiles(touchedDir, launchDir);
		// Skip Records accumulate for the session, deduped by path, so the
		// status commands can explain why a file never arrived.
		for (const skip of skipped) {
			if (!navigation.skipped.some((known) => known.path === skip.path)) {
				navigation.skipped.push(skip);
			}
		}
		const fresh = pickNewFiles(files, navigation.seen);
		if (fresh.length === 0) return;

		for (const file of fresh) navigation.seen.add(file.canonicalPath);
		try {
			await pi.sendMessage({
				customType: CONTEXT_MESSAGE_TYPE,
				display: true,
				content: composeContextMessage(fresh),
				details: {
					// Canonical paths: re-derivation of the seen set from session
					// history reads this field. Display paths: the renderer.
					files: fresh.map((file) => file.canonicalPath),
					displayPaths: fresh.map((file) => file.displayPath),
				},
			}, { deliverAs: "steer", triggerTurn: false });
			// Recorded only after the send succeeded: a rolled-back delivery
			// must not appear in the session listing.
			for (const file of fresh) navigation.delivered.push(file.displayPath);
		} catch (error) {
			for (const file of fresh) navigation.seen.delete(file.canonicalPath);
			if (ctx.hasUI) {
				const reason = error instanceof Error ? error.message : String(error);
				ctx.ui.notify(`pi-rules: context delivery failed (${reason}) — will retry on next navigation`, "warning");
			}
		}
	}

	// State accessor shared by both status commands.
	const getNavigationState = (): NavigationState => navigation;

	registerRulesCommand(pi, {
		getRules: () => rules,
		getActivated: () => activated,
		getWarnings: () => warnings,
		rescan,
	}, { getNavigationState });
	registerListContextCommand(pi, { getNavigationState });
}
