import * as fs from "node:fs";
import * as path from "node:path";
import type { RuleFileRef } from "./parser";

/**
 * One directory that may contain rule files.
 */
export interface RuleSource {
	root: string;
	level: "project" | "user";
	brand: string;
}

/**
 * The six directories scanned for rules: the three supported brands at
 * project level, then the same three at user level. The user-level pi brand
 * lives under the global agent directory, mirroring how project `.pi`
 * maps to the user configuration home.
 */
export function ruleSources(cwd: string, configDirName: string, homeDir: string): RuleSource[] {
	return [
		{ root: path.join(cwd, ".claude", "rules"), level: "project", brand: ".claude" },
		{ root: path.join(cwd, ".agents", "rules"), level: "project", brand: ".agents" },
		{ root: path.join(cwd, configDirName, "rules"), level: "project", brand: configDirName },
		{ root: path.join(homeDir, ".claude", "rules"), level: "user", brand: ".claude" },
		{ root: path.join(homeDir, ".agents", "rules"), level: "user", brand: ".agents" },
		{ root: path.join(homeDir, configDirName, "agent", "rules"), level: "user", brand: configDirName },
	];
}

/**
 * Project beats user; within the same level the pi-native brand wins over
 * the tool-specific ones, so a rule migrated to `.pi` takes precedence over
 * its legacy copy without deleting it.
 */
const BRAND_SCORES: Record<string, number> = {
	".claude": 1,
	".agents": 2,
};

function sourceScore(source: RuleSource): number {
	const brandScore = BRAND_SCORES[source.brand] ?? 3;
	return (source.level === "project" ? 10 : 0) + brandScore;
}

function walk(dir: string): string[] {
	let entries: fs.Dirent[];
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true });
	} catch {
		return [];
	}
	let out: string[] = [];
	for (const entry of entries) {
		if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) out = out.concat(walk(full));
		else if (entry.isFile() && entry.name.endsWith(".md")) out.push(full);
	}
	return out.sort((a, b) => a.localeCompare(b));
}

export interface ScanResult {
	files: RuleFileRef[];
	shadowWarnings: string[];
}

/**
 * Scans every existing source for markdown files and resolves name
 * collisions by source precedence, recording each shadowed file.
 */
export function scanRuleFiles(sources: RuleSource[], cwd: string): ScanResult {
	const byName = new Map<string, { ref: RuleFileRef; score: number }>();
	const shadowWarnings: string[] = [];

	for (const source of sources) {
		for (const filePath of walk(source.root)) {
			const relative = path.relative(source.root, filePath).split(path.sep).join("/");
			const name = relative.replace(/\.md$/, "");
			const displayPath =
				source.level === "project" ? path.relative(cwd, filePath).split(path.sep).join("/") : filePath;
			const ref: RuleFileRef = { name, filePath, displayPath, source: `${source.level}:${source.brand}` };
			const score = sourceScore(source);
			const existing = byName.get(name);
			if (!existing) {
				byName.set(name, { ref, score });
			} else if (score > existing.score) {
				shadowWarnings.push(`"${name}" from ${existing.ref.source} shadowed by ${ref.source}`);
				byName.set(name, { ref, score });
			} else {
				shadowWarnings.push(`"${name}" from ${ref.source} shadowed by ${existing.ref.source}`);
			}
		}
	}

	const files = [...byName.values()].map((value) => value.ref).sort((a, b) => a.name.localeCompare(b.name));
	return { files, shadowWarnings };
}
