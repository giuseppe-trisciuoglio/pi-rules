import { describe, expect, it } from "vitest";
import {
	buildContextReport,
	buildContextSection,
	buildReport,
	type RulesView,
} from "../src/command.js";
import {
	deriveDeliveredFromRecords,
	initNavigationState,
	type NavigationState,
} from "../src/context.js";

const navState = (over: Partial<NavigationState> = {}): NavigationState => ({
	launchDir: "/launch",
	trackedDir: "/launch/services/api",
	seen: new Set<string>(),
	preSeeded: true,
	delivered: [],
	preseedCount: 0,
	skipped: [],
	...over,
});

const emptyRulesView: RulesView = {
	getRules: () => [],
	getActivated: () => new Set<string>(),
	getWarnings: () => [],
	rescan: () => {},
};

describe("buildContextReport (/list-context formatting seam)", () => {
	it("renders loaded files as relative paths with tracked-dir and pre-seed lines (AC-016)", () => {
		const lines = buildContextReport(
			navState({
				delivered: ["services/api/AGENTS.md", "CLAUDE.md"],
				preseedCount: 2,
			}),
		);
		const text = lines.join("\n");
		expect(text).toContain("2 loaded");
		expect(text).toContain("2 pre-seeded");
		expect(text).toContain("0 skipped");
		expect(text).toContain("launch dir:  /launch");
		expect(text).toContain("tracked dir: /launch/services/api");
		expect(text).toContain("📂 services/api/AGENTS.md");
		expect(text).toContain("📂 CLAUDE.md");
	});

	it("renders an explicit empty state when nothing is loaded and the tracked dir is unset (AC-016)", () => {
		const lines = buildContextReport(navState({ trackedDir: null }));
		const text = lines.join("\n");
		expect(text).toContain("0 loaded");
		expect(text).toContain("(none loaded yet)");
		expect(text).toContain("tracked dir: (unset)");
		expect(text).not.toContain("SKIPPED");
	});

	it("renders skipped files with their reasons (AC-022)", () => {
		const lines = buildContextReport(
			navState({
				skipped: [
					{ path: "/launch/broken/AGENTS.md", reason: "unresolvable path" },
					{
						path: "/launch/link/CLAUDE.md",
						reason: "symlink target outside the launch directory subtree",
					},
				],
			}),
		);
		const text = lines.join("\n");
		expect(text).toContain("2 skipped");
		expect(text).toContain("SKIPPED");
		expect(text).toContain("⚠ /launch/broken/AGENTS.md — unresolvable path");
		expect(text).toContain(
			"⚠ /launch/link/CLAUDE.md — symlink target outside the launch directory subtree",
		);
	});

	it("renders the inactive state when the launch directory is unavailable", () => {
		const lines = buildContextReport(navState({ launchDir: null, trackedDir: null }));
		expect(lines).toEqual(["pi-rules context — inactive (launch directory unavailable)"]);
	});
});

describe("buildContextSection (/rules report section)", () => {
	it("shows loaded count, tracked dir and skipped count (AC-017)", () => {
		const lines = buildContextSection(
			navState({
				delivered: ["CLAUDE.md"],
				preseedCount: 3,
				skipped: [{ path: "/launch/x/AGENTS.md", reason: "unreadable: boom" }],
			}),
		);
		expect(lines[0]).toBe("CONTEXT (navigation)");
		expect(lines[1]).toBe(" loaded: 1 · pre-seeded: 3 · skipped: 1");
		expect(lines[2]).toBe(" tracked dir: /launch/services/api");
		expect(lines[3]).toBe(" ⚠ /launch/x/AGENTS.md — unreadable: boom");
	});

	it("degrades gracefully when the channel is inactive", () => {
		expect(buildContextSection(navState({ launchDir: null, trackedDir: null }))).toEqual([
			"CONTEXT (navigation)",
			" inactive — launch directory unavailable",
		]);
	});
});

describe("buildReport with navigation view", () => {
	it("appends the context section after the rules report (AC-017)", () => {
		const lines = buildReport(emptyRulesView, {
			getNavigationState: () => navState({ delivered: ["CLAUDE.md"] }),
		});
		const text = lines.join("\n");
		expect(text).toContain("pi-rules — 0 rules · 0 activated this session");
		expect(text).toContain("CONTEXT (navigation)");
		expect(text).toContain("loaded: 1");
	});

	it("omits the context section when no navigation view is given", () => {
		const text = buildReport(emptyRulesView).join("\n");
		expect(text).not.toContain("CONTEXT (navigation)");
	});
});

describe("deriveDeliveredFromRecords", () => {
	it("collects display paths from delivery records in order, tolerating junk", () => {
		const entries: unknown[] = [
			null,
			42,
			{ type: "message" },
			{ type: "custom_message", customType: "other" },
			{ type: "custom_message", customType: "pi-rules-context", details: "junk" },
			{
				type: "custom_message",
				customType: "pi-rules-context",
				details: { files: ["/launch/CLAUDE.md"], displayPaths: ["CLAUDE.md"] },
			},
			{
				type: "custom_message",
				customType: "pi-rules-context",
				details: { files: ["/launch/services/api/AGENTS.md"] },
			},
		];
		expect(deriveDeliveredFromRecords(entries, "/launch")).toEqual([
			"CLAUDE.md",
			"services/api/AGENTS.md",
		]);
	});

	it("returns an empty list when the launch dir is null", () => {
		expect(
			deriveDeliveredFromRecords(
				[
					{
						type: "custom_message",
						customType: "pi-rules-context",
						details: { files: ["/launch/CLAUDE.md"] },
					},
				],
				null,
			),
		).toEqual([]);
	});
});

describe("initNavigationState listing fields", () => {
	it("re-derives delivered paths from history and starts with empty skips", () => {
		const state = initNavigationState("/definitely/not/on/disk", []);
		expect(state.delivered).toEqual([]);
		expect(state.preseedCount).toBe(0);
		expect(state.skipped).toEqual([]);

		const cwd = process.cwd();
		const history = [
			{
				type: "custom_message",
				customType: "pi-rules-context",
				details: { files: [], displayPaths: ["CLAUDE.md", "sub/AGENTS.md"] },
			},
		];
		const rederived = initNavigationState(cwd, history);
		expect(rederived.delivered).toEqual(["CLAUDE.md", "sub/AGENTS.md"]);
		expect(rederived.preSeeded).toBe(false);
		expect(rederived.preseedCount).toBe(0);
	});
});
