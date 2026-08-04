/**
 * Standalone smoke test for parser, sources, matcher and prompt builder.
 * Does not depend on pi: can be run with:
 *   npx tsx test/smoke-test.ts
 *   npx jiti test/smoke-test.ts
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { parseFrontmatter, parseGlobs, parseRuleContent, parseRuleFile, type Rule, type RuleFileRef } from "../src/parser";
import { ruleSources, scanRuleFiles } from "../src/sources";
import { ruleMatchesPath } from "../src/matcher";
import { buildRulesSection } from "../src/prompt";
import { buildReport } from "../src/command";

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
	const ok = JSON.stringify(actual) === JSON.stringify(expected);
	if (!ok) {
		failures++;
		console.error(`✗ ${label}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`);
	} else {
		console.log(`✓ ${label}`);
	}
}

function ref(name: string): RuleFileRef {
	return { name, filePath: `/fake/${name}.md`, displayPath: `.claude/rules/${name}.md`, source: "project:.claude" };
}

// ─── Frontmatter parsing ────────────────────────────────────────────────────

{
	const { data, body, hasFrontmatter } = parseFrontmatter(
		'---\ndescription: Prevent direct commits\nglobs: "**/*"\nalwaysApply: true\npriority: 00\n---\n\n# No commits\n',
	);
	check("frontmatter: detected", hasFrontmatter, true);
	check("frontmatter: description", data.description, "Prevent direct commits");
	check("frontmatter: globs quoted", data.globs, "**/*");
	check("frontmatter: alwaysApply boolean", data.alwaysApply, true);
	check("frontmatter: priority number", data.priority, 0);
	check("frontmatter: body without block", body.trim(), "# No commits");
}

{
	const { hasFrontmatter, body } = parseFrontmatter("# TypeScript Best Practices\n\n- strict mode\n");
	check("frontmatter: absent", hasFrontmatter, false);
	check("frontmatter: body untouched", body.startsWith("# TypeScript"), true);
}

{
	const { data } = parseFrontmatter('---\nglobs: ["**/*.ts", "**/*.tsx"]\ndescription: \'single quoted\'\n---\n');
	check("frontmatter: inline list", data.globs, ["**/*.ts", "**/*.tsx"]);
	check("frontmatter: single quotes", data.description, "single quoted");
}

check("globs: comma-separated", parseGlobs("**/*.ts, **/entities/**"), ["**/*.ts", "**/entities/**"]);
check("globs: undefined", parseGlobs(undefined), []);
check("globs: from list value", parseGlobs(["**/*.ts"]), ["**/*.ts"]);

// ─── Rule parsing with defaults ─────────────────────────────────────────────

{
	const rule = parseRuleContent("# NestJS — Services\n\n## Regole\n", ref("04-nestjs-services"));
	check("rule: description from heading", rule.description, "NestJS — Services");
	check("rule: defaults", [rule.alwaysApply, rule.globs, rule.hasFrontmatter, rule.priority], [
		false,
		[],
		false,
		Number.POSITIVE_INFINITY,
	]);
}

{
	const rule = parseRuleContent(
		'---\ndescription: x\nalwaysApply: true\n---\n# Body\n',
		ref("00-always"),
	);
	check("rule: alwaysApply parsed", rule.alwaysApply, true);
	check("rule: body excludes frontmatter", rule.body, "# Body");
}

{
	const rule = parseRuleContent("- bullet one\n- bullet two\n", ref("07-general"));
	check("rule: description from first line", rule.description, "bullet one");
}

// ─── Glob matching ──────────────────────────────────────────────────────────

const CWD = "/repo";
const matchCases: Array<[string, string[], string, boolean]> = [
	["nested ts file", ["**/*.ts"], "libs/server/odl/foo.service.ts", true],
	["top-level ts file", ["**/*.ts"], "foo.ts", true],
	["non-matching extension", ["**/*.ts"], "README.md", false],
	["middle segment", ["**/entities/**"], "libs/x/entities/user.ts", true],
	["star does not cross dirs", ["*.spec.ts"], "src/a.spec.ts", false],
	["star matches top level", ["*.spec.ts"], "a.spec.ts", true],
	["absolute path matching relative glob", ["**/*.ts"], "/repo/src/a.ts", true],
	["absolute path outside cwd", ["**/*.ts"], "/elsewhere/a.ts", true],
	["empty globs never match", [], "src/a.ts", false],
	["invalid glob ignored", ["["], "src/a.ts", false],
];
for (const [label, globs, toolPath, expected] of matchCases) {
	check(`match: ${label}`, ruleMatchesPath(globs, toolPath, CWD), expected);
}

// ─── Source scanning and shadowing ──────────────────────────────────────────

{
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "pi-rules-test-"));
	const proj = path.join(root, "proj");
	const home = path.join(root, "home");
	fs.mkdirSync(path.join(proj, ".claude", "rules"), { recursive: true });
	fs.mkdirSync(path.join(proj, ".pi", "rules"), { recursive: true });
	fs.mkdirSync(path.join(home, ".claude", "rules"), { recursive: true });
	fs.writeFileSync(path.join(proj, ".claude", "rules", "a.md"), "# project claude a\n");
	fs.writeFileSync(path.join(proj, ".pi", "rules", "a.md"), "---\ndescription: project pi a\n---\n# A\n");
	fs.writeFileSync(path.join(home, ".claude", "rules", "a.md"), "# user a\n");
	fs.writeFileSync(path.join(home, ".claude", "rules", "b.md"), "# user b\n");

	const { files, shadowWarnings } = scanRuleFiles(ruleSources(proj, ".pi", home), proj);
	const names = files.map((f) => `${f.name}@${f.source}`);
	check("scan: winner set", names, ["a@project:.pi", "b@user:.claude"]);
	check("scan: shadow warnings count", shadowWarnings.length, 2);
	check("scan: display path project-relative", files.find((f) => f.name === "a")?.displayPath, ".pi/rules/a.md");
	check("scan: display path user absolute", files.find((f) => f.name === "b")?.displayPath, path.join(home, ".claude", "rules", "b.md"));

	fs.rmSync(root, { recursive: true, force: true });
}

// ─── System prompt section ──────────────────────────────────────────────────

{
	const rules: Rule[] = [
		{ ...parseRuleContent("---\ndescription: d\nalwaysApply: true\npriority: 0\n---\nALWAYS BODY\n", ref("00-always")), sizeKb: 0.1 },
		{ ...parseRuleContent('---\ndescription: auto rule\nglobs: "**/*.ts"\n---\nAUTO BODY\n', ref("08-auto")), sizeKb: 0.1 },
		{ ...parseRuleContent("# Manual rule\n", ref("20-manual")), sizeKb: 0.1 },
	];
	const section = buildRulesSection(rules);
	check("section: always body included", section.includes("ALWAYS BODY"), true);
	check("section: auto body excluded from prompt", section.includes("AUTO BODY"), false);
	check("section: auto entry with globs", section.includes("(auto: **/*.ts)"), true);
	check("section: manual entry readable", section.includes("`" + ".claude/rules/20-manual.md" + "`"), true);
	check("section: empty rules", buildRulesSection([]), "");
}

// ─── /rules report ──────────────────────────────────────────────────────────

{
	const rules: Rule[] = [
		{ ...parseRuleContent("---\ndescription: d\nalwaysApply: true\n---\nBODY\n", ref("00-always")), sizeKb: 0.8 },
		{ ...parseRuleContent("# Manual\n", ref("20-manual")), sizeKb: 1 },
	];
	const lines = buildReport({
		getRules: () => rules,
		getActivated: () => new Set<string>(),
		getWarnings: () => ["1 rule(s) without frontmatter"],
		rescan: () => {},
	});
	const report = lines.join("\n");
	check("report: header count", report.includes("2 rules"), true);
	check("report: missing frontmatter row", report.includes("⚠ no frontmatter"), true);
	check("report: warnings section", report.includes("without frontmatter"), true);
}

// ─── Optional: live preview against a real project ──────────────────────────

const liveDir = process.argv[2];
if (liveDir && fs.existsSync(path.join(liveDir, ".claude", "rules"))) {
	console.log(`\n── live preview: ${liveDir} ──`);
	const { files, shadowWarnings } = scanRuleFiles(ruleSources(liveDir, ".pi", os.homedir()), liveDir);
	const liveRules = files.map(parseRuleFile);
	const missing = liveRules.filter((r) => !r.hasFrontmatter).length;
	const always = liveRules.filter((r) => r.alwaysApply).length;
	const globs = liveRules.filter((r) => !r.alwaysApply && r.globs.length > 0).length;
	console.log(
		`${liveRules.length} rules (${always} always · ${globs} globs · ${liveRules.length - always - globs} on-demand) · ${missing} without frontmatter · ${shadowWarnings.length} shadowed`,
	);
	const section = buildRulesSection(liveRules);
	console.log(`system prompt section: ${(section.length / 1024).toFixed(1)}KB`);
	console.log(
		buildReport({
			getRules: () => liveRules,
			getActivated: () => new Set<string>(),
			getWarnings: () => shadowWarnings,
			rescan: () => {},
		})
			.slice(0, 15)
			.join("\n"),
	);
}

console.log(failures === 0 ? "\n✅ all smoke tests passed" : `\n❌ ${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
