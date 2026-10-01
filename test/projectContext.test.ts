import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
	buildProjectContextSection,
	discoverProjectContext,
	discoverProjectContextFiles,
	isGraphStale,
	parseGraphStats,
	PROJECT_CONTEXT_WARN_KB,
	type GraphSummary,
} from "../src/projectContext";

function tmpDir(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), "pi-rules-pctx-"));
}

function writeFile(dir: string, relative: string, content: string): void {
	const filePath = path.join(dir, relative);
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, content);
}

describe("discoverProjectContextFiles", () => {
	it("reads root documents in fixed order and skips missing ones", () => {
		const dir = tmpDir();
		writeFile(dir, "architecture.md", "# Architecture\nlayers");
		writeFile(dir, "CONTEXT.md", "# Context\nglossary");
		const files = discoverProjectContextFiles(dir);
		expect(files.map((file) => file.name)).toEqual(["architecture.md", "CONTEXT.md"]);
		expect(files[0].body).toContain("layers");
		fs.rmSync(dir, { recursive: true, force: true });
	});

	it("ignores nested documents", () => {
		const dir = tmpDir();
		writeFile(dir, "docs/architecture.md", "nested");
		expect(discoverProjectContextFiles(dir)).toEqual([]);
		fs.rmSync(dir, { recursive: true, force: true });
	});
});

describe("parseGraphStats", () => {
	it("summarizes counts and principal communities from graph.json", () => {
		const dir = tmpDir();
		writeFile(
			dir,
			"graph.json",
			JSON.stringify({
				nodes: [{ community_name: "core" }, { community_name: "core" }, { community_name: "ui" }],
				links: [{}, {}],
				built_at_commit: "abc123",
			}),
		);
		const parsed = parseGraphStats(path.join(dir, "graph.json"));
		expect(parsed).not.toBeNull();
		expect(parsed!.stats.nodeCount).toBe(3);
		expect(parsed!.stats.linkCount).toBe(2);
		expect(parsed!.stats.communityCount).toBe(2);
		expect(parsed!.stats.communities[0]).toBe("core");
		expect(parsed!.builtAtCommit).toBe("abc123");
		fs.rmSync(dir, { recursive: true, force: true });
	});

	it("returns null for malformed or missing files", () => {
		expect(parseGraphStats("/nonexistent/graph.json")).toBeNull();
		const dir = tmpDir();
		writeFile(dir, "graph.json", "not json");
		expect(parseGraphStats(path.join(dir, "graph.json"))).toBeNull();
		fs.rmSync(dir, { recursive: true, force: true });
	});
});

describe("discoverProjectContext", () => {
	it("prefers GRAPH_REPORT.md over numeric stats", () => {
		const dir = tmpDir();
		writeFile(dir, "graphify-out/GRAPH_REPORT.md", "# Graph Report\nsummary body");
		writeFile(dir, "graphify-out/graph.json", "{}");
		const state = discoverProjectContext(dir, () => "report body");
		expect(state.graph?.reportBody).toBe("report body");
		expect(state.graph?.displayPath).toBe("graphify-out/GRAPH_REPORT.md");
		expect(state.graph?.stats).toBeNull();
		fs.rmSync(dir, { recursive: true, force: true });
	});

	it("falls back to numeric stats when the report is absent", () => {
		const dir = tmpDir();
		writeFile(dir, "graphify-out/graph.json", JSON.stringify({ nodes: [{}], links: [] }));
		const state = discoverProjectContext(dir);
		expect(state.graph?.reportBody).toBeNull();
		expect(state.graph?.stats?.nodeCount).toBe(1);
		expect(state.graph?.displayPath).toBe("graphify-out/graph.json");
		fs.rmSync(dir, { recursive: true, force: true });
	});

	it("warns when the total exceeds the size budget", () => {
		const dir = tmpDir();
		const big = "x".repeat((PROJECT_CONTEXT_WARN_KB + 1) * 1024);
		writeFile(dir, "architecture.md", big);
		const state = discoverProjectContext(dir);
		expect(state.warnings.some((w) => w.includes("project context files total"))).toBe(true);
		fs.rmSync(dir, { recursive: true, force: true });
	});

	it("is inactive for a null root", () => {
		expect(discoverProjectContext(null).files).toEqual([]);
	});
});

describe("isGraphStale", () => {
	it("is false without a summary or a recorded commit", () => {
		const dir = tmpDir();
		expect(isGraphStale(dir, null)).toBe(false);
		const summary: GraphSummary = {
			displayPath: "graphify-out/GRAPH_REPORT.md",
			reportBody: "x",
			stats: null,
			builtAtCommit: null,
			sizeKb: 0,
		};
		expect(isGraphStale(dir, summary)).toBe(false);
		fs.rmSync(dir, { recursive: true, force: true });
	});
});

describe("buildProjectContextSection", () => {
	it("returns empty for an empty state", () => {
		expect(buildProjectContextSection({ root: null, files: [], graph: null, graphStale: false, warnings: [] })).toBe("");
	});

	it("orders files before the graph section", () => {
		const dir = tmpDir();
		writeFile(dir, "architecture.md", "# Architecture");
		writeFile(dir, "CONTEXT.md", "# Context");
		writeFile(dir, "graphify-out/GRAPH_REPORT.md", "# Graph Report");
		const state = discoverProjectContext(dir);
		const section = buildProjectContextSection(state);
		expect(section.startsWith("## Project Context")).toBe(true);
		const archIndex = section.indexOf("<!-- architecture.md -->");
		const contextIndex = section.indexOf("<!-- CONTEXT.md -->");
		const graphIndex = section.indexOf("### Knowledge Graph");
		expect(archIndex).toBeLessThan(contextIndex);
		expect(contextIndex).toBeLessThan(graphIndex);
		expect(section).not.toContain('"nodes"');
		fs.rmSync(dir, { recursive: true, force: true });
	});
});
