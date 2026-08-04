import * as fs from "node:fs";

/**
 * A rule file discovered on disk, before its content is parsed.
 */
export interface RuleFileRef {
	/** Path relative to the rule source root, without the .md extension. */
	name: string;
	/** Absolute path of the markdown file. */
	filePath: string;
	/** Path shown to the agent so it can load the file with the read tool. */
	displayPath: string;
	/** Source identifier, e.g. "project:.claude" or "user:.pi". */
	source: string;
}

/**
 * A parsed rule ready for activation.
 */
export interface Rule extends RuleFileRef {
	description: string;
	globs: string[];
	alwaysApply: boolean;
	/** Lower sorts first; Infinity when the file does not declare a priority. */
	priority: number;
	hasFrontmatter: boolean;
	/** Markdown content without the frontmatter block. */
	body: string;
	sizeKb: number;
}

export type FrontmatterValue = string | number | boolean | string[];

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function unquote(value: string): string {
	const trimmed = value.trim();
	if (
		trimmed.length >= 2 &&
		((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'")))
	) {
		return trimmed.slice(1, -1);
	}
	return trimmed;
}

function parseScalar(raw: string): string | number | boolean {
	const value = unquote(raw);
	if (/^(true|false)$/i.test(value)) return value.toLowerCase() === "true";
	if (value !== "" && !Number.isNaN(Number(value))) return Number(value);
	return value;
}

/**
 * Parses the optional frontmatter block at the top of a rule file.
 * Supports the flat `key: value` subset used by Cursor-style rule files:
 * quoted strings, booleans, numbers, and inline lists like ["a", "b"].
 */
export function parseFrontmatter(raw: string): {
	data: Record<string, FrontmatterValue>;
	body: string;
	hasFrontmatter: boolean;
} {
	const match = raw.match(FRONTMATTER_RE);
	if (!match) return { data: {}, body: raw, hasFrontmatter: false };

	const data: Record<string, FrontmatterValue> = {};
	for (const line of match[1].split(/\r?\n/)) {
		const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
		if (!kv) continue;
		const value = kv[2].trim();
		if (value.startsWith("[") && value.endsWith("]")) {
			data[kv[1]] = value
				.slice(1, -1)
				.split(",")
				.map(unquote)
				.map((s) => s.trim())
				.filter(Boolean);
		} else {
			data[kv[1]] = parseScalar(value);
		}
	}
	return { data, body: raw.slice(match[0].length), hasFrontmatter: true };
}

/**
 * Normalizes the globs field: inline list, comma-separated string, or single pattern.
 */
export function parseGlobs(value: FrontmatterValue | undefined): string[] {
	if (Array.isArray(value)) return value.map(String).map((s) => s.trim()).filter(Boolean);
	if (typeof value !== "string") return [];
	return value
		.split(",")
		.map(unquote)
		.map((s) => s.trim())
		.filter(Boolean);
}

/**
 * Builds a description for rules without one: first markdown heading,
 * then first meaningful line, then the file name as last resort.
 */
function deriveDescription(body: string, name: string): string {
	for (const line of body.split(/\r?\n/)) {
		const heading = line.match(/^#\s+(.+?)\s*$/);
		if (heading) return heading[1].replace(/\*+/g, "").trim();
	}
	for (const line of body.split(/\r?\n/)) {
		const text = line
			.trim()
			.replace(/^[#>*\-\s]+/, "")
			.replace(/\*+/g, "")
			.trim();
		if (text) return text.slice(0, 100);
	}
	return name;
}

export function parseRuleContent(raw: string, ref: RuleFileRef): Rule {
	const { data, body, hasFrontmatter } = parseFrontmatter(raw);
	const description =
		typeof data.description === "string" && data.description.trim() !== ""
			? data.description.trim()
			: deriveDescription(body, ref.name);
	return {
		...ref,
		description,
		globs: parseGlobs(data.globs),
		alwaysApply: data.alwaysApply === true,
		priority: typeof data.priority === "number" ? data.priority : Number.POSITIVE_INFINITY,
		hasFrontmatter,
		body: body.trim(),
		sizeKb: Buffer.byteLength(raw, "utf8") / 1024,
	};
}

export function parseRuleFile(ref: RuleFileRef): Rule {
	return parseRuleContent(fs.readFileSync(ref.filePath, "utf8"), ref);
}
