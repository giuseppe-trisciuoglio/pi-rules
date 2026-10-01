import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

export const PROJECT_CONTEXT_FILE_NAMES = ["architecture.md", "CONTEXT.md"];

export const GRAPHIFY_DIR = "graphify-out";

export const GRAPH_REPORT_NAME = "GRAPH_REPORT.md";

export const GRAPH_JSON_NAME = "graph.json";

export const PROJECT_CONTEXT_WARN_KB = 10;

const MAX_COMMUNITIES = 10;

export type ProjectContextReader = (filePath: string) => string;

function defaultReader(filePath: string): string {
	return fs.readFileSync(filePath, "utf8");
}

export interface ProjectContextFile {
	name: string;
	displayPath: string;
	body: string;
	sizeKb: number;
}

export interface GraphStats {
	nodeCount: number;
	linkCount: number;
	communityCount: number;
	communities: string[];
}

export interface GraphSummary {
	displayPath: string;
	reportBody: string | null;
	stats: GraphStats | null;
	builtAtCommit: string | null;
	sizeKb: number;
}

export interface ProjectContextState {
	root: string | null;
	files: ProjectContextFile[];
	graph: GraphSummary | null;
	graphStale: boolean;
	warnings: string[];
}

export function emptyProjectContextState(): ProjectContextState {
	return { root: null, files: [], graph: null, graphStale: false, warnings: [] };
}

export function discoverProjectContextFiles(
	root: string,
	readFile: ProjectContextReader = defaultReader,
): ProjectContextFile[] {
	const files: ProjectContextFile[] = [];
	for (const name of PROJECT_CONTEXT_FILE_NAMES) {
		const filePath = path.join(root, name);
		if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) continue;
		try {
			const body = readFile(filePath);
			files.push({
				name,
				displayPath: name,
				body,
				sizeKb: Buffer.byteLength(body, "utf8") / 1024,
			});
		} catch {
			continue;
		}
	}
	return files;
}

export function parseGraphStats(
	graphJsonPath: string,
): { stats: GraphStats; builtAtCommit: string | null } | null {
	let raw: string;
	try {
		raw = fs.readFileSync(graphJsonPath, "utf8");
	} catch {
		return null;
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}
	if (typeof parsed !== "object" || parsed === null) return null;
	const graph = parsed as Record<string, unknown>;
	if (!Array.isArray(graph.nodes)) return null;

	const nodes = graph.nodes as ReadonlyArray<Record<string, unknown>>;
	const links = Array.isArray(graph.links) ? (graph.links as unknown[]) : [];
	const counts = new Map<string, number>();
	for (const node of nodes) {
		const name = node.community_name;
		if (typeof name === "string" && name !== "") {
			counts.set(name, (counts.get(name) ?? 0) + 1);
		}
	}
	const communities = [...counts.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, MAX_COMMUNITIES)
		.map(([name]) => name);
	const builtAtCommit = typeof graph.built_at_commit === "string" ? graph.built_at_commit : null;

	return {
		stats: {
			nodeCount: nodes.length,
			linkCount: links.length,
			communityCount: counts.size,
			communities,
		},
		builtAtCommit,
	};
}

export function buildGraphSummary(
	root: string,
	readFile: ProjectContextReader = defaultReader,
): GraphSummary | null {
	const dir = path.join(root, GRAPHIFY_DIR);
	const reportPath = path.join(dir, GRAPH_REPORT_NAME);
	const jsonPath = path.join(dir, GRAPH_JSON_NAME);
	if (!fs.existsSync(reportPath) && !fs.existsSync(jsonPath)) return null;

	let reportBody: string | null = null;
	if (fs.existsSync(reportPath) && fs.statSync(reportPath).isFile()) {
		try {
			reportBody = readFile(reportPath);
		} catch {
			reportBody = null;
		}
	}

	const parsed = parseGraphStats(jsonPath);
	const stats = reportBody === null ? (parsed?.stats ?? null) : null;
	const sizeKb =
		reportBody !== null
			? Buffer.byteLength(reportBody, "utf8") / 1024
			: stats !== null
				? JSON.stringify(stats).length / 1024
				: 0;

	return {
		displayPath: `${GRAPHIFY_DIR}/${reportBody !== null ? GRAPH_REPORT_NAME : GRAPH_JSON_NAME}`,
		reportBody,
		stats,
		builtAtCommit: parsed?.builtAtCommit ?? null,
		sizeKb,
	};
}

export function isGraphStale(root: string, summary: GraphSummary | null): boolean {
	if (summary === null || summary.builtAtCommit === null) return false;
	try {
		const head = execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: root,
			encoding: "utf8",
			timeout: 2000,
		}).trim();
		return head !== "" && head !== summary.builtAtCommit;
	} catch {
		return false;
	}
}

export function discoverProjectContext(
	root: string | null,
	readFile: ProjectContextReader = defaultReader,
): ProjectContextState {
	if (root === null) return emptyProjectContextState();
	const state = emptyProjectContextState();
	state.root = root;
	state.files = discoverProjectContextFiles(root, readFile);
	state.graph = buildGraphSummary(root, readFile);
	state.graphStale = isGraphStale(root, state.graph);

	const totalKb = state.files.reduce((sum, file) => sum + file.sizeKb, 0) + (state.graph?.sizeKb ?? 0);
	if (totalKb > PROJECT_CONTEXT_WARN_KB) {
		state.warnings.push(
			`project context files total ${totalKb.toFixed(1)}KB of system prompt — consider trimming`,
		);
	}
	if (state.graphStale) {
		state.warnings.push(
			`knowledge graph (${state.graph?.displayPath}) was built from an earlier commit — consider regenerating with graphify`,
		);
	}
	return state;
}

export function rootContextFilePath(root: string | null): string | null {
	if (root === null) return null;
	const filePath = path.join(root, "CONTEXT.md");
	return fs.existsSync(filePath) ? filePath : null;
}

function formatGraphBody(graph: GraphSummary): string {
	if (graph.reportBody !== null) return graph.reportBody;
	if (graph.stats === null) return "";
	const stats = graph.stats;
	const lines = [`${stats.nodeCount} nodes · ${stats.linkCount} edges · ${stats.communityCount} communities`];
	if (stats.communities.length > 0) {
		lines.push(`Principal communities: ${stats.communities.join(", ")}`);
	}
	return lines.join("\n");
}

export function buildProjectContextSection(state: ProjectContextState): string {
	if (state.files.length === 0 && state.graph === null) return "";

	const parts: string[] = ["## Project Context", ""];
	for (const file of state.files) {
		parts.push(`<!-- ${file.displayPath} -->`, file.body, "");
	}
	if (state.graph !== null) {
		parts.push(
			"### Knowledge Graph",
			"",
			`A graphify knowledge graph of this project exists (\`${state.graph.displayPath}\`). Use it to answer questions about architecture, file relationships and project content.`,
			"",
			formatGraphBody(state.graph),
			"",
		);
	}
	return parts.join("\n");
}
