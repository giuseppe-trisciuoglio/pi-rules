import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	CONTEXT_MESSAGE_TYPE,
	NAVIGATION_GUIDANCE,
	canonicalizeDir,
	deriveSeenFromRecords,
	deliveryDisplayPaths,
	dirForToolEvent,
	discoverContextFiles,
	formatDeliveryLine,
	initNavigationState,
	normalizeMsysPath,
	pickNewFiles,
	preseedSeenFiles,
	resolveCdDir,
} from "../src/context.js";
import piRules from "../src/index.js";

let root: string; // canonical (realpath'd) fixture root
let launchDir: string;

beforeAll(() => {
	const raw = fs.mkdtempSync(path.join(os.tmpdir(), "pi-rules-context-"));
	root = fs.realpathSync(raw); // macOS tmp dirs live behind a symlink
	launchDir = root;
	fs.mkdirSync(path.join(root, "services", "api"), { recursive: true });
	fs.mkdirSync(path.join(root, "dir with spaces"), { recursive: true });
	fs.mkdirSync(path.join(root, "search-target"), { recursive: true });
	fs.writeFileSync(path.join(root, "search-target", "hit.ts"), "x = 1;\n");
	fs.symlinkSync(
		path.join(root, "services", "api"),
		path.join(root, "api-link"),
		"dir",
	);
});

afterAll(() => {
	fs.rmSync(root, { recursive: true, force: true });
});

const abs = (...parts: string[]) => path.join(root, ...parts);

describe("resolveCdDir", () => {
	it("adopts the pwd line for `cd <path> && pwd`", () => {
		const target = abs("services", "api");
		expect(
			resolveCdDir({
				command: "cd services/api && pwd",
				output: `${target}\n`,
				lastDir: launchDir,
			}),
		).toBe(target);
	});

	it("adopts pwd output for paths containing spaces", () => {
		const target = abs("dir with spaces");
		expect(
			resolveCdDir({
				command: 'cd "dir with spaces" && pwd',
				output: `${target}\n`,
				lastDir: launchDir,
			}),
		).toBe(target);
	});

	it("takes the last absolute-path-shaped line anywhere in the output", () => {
		const target = abs("services", "api");
		expect(
			resolveCdDir({
				command: "cd services/api && pwd && echo done",
				output: `some noise\n${target}\ndone\n`,
				lastDir: launchDir,
			}),
		).toBe(target);
	});

	it.each([
		"cd - && pwd",
		"cd $SOME_VAR && pwd",
		"cd $(dirname ./x) && pwd",
		"cd ~ && pwd",
	])("adopts the pwd output for the exotic form: %s", (command) => {
		const target = abs("services", "api");
		expect(
			resolveCdDir({ command, output: `${target}\n`, lastDir: launchDir }),
		).toBe(target);
	});

	it("supports `; pwd` chaining", () => {
		const target = abs("services", "api");
		expect(
			resolveCdDir({
				command: "cd services/api; pwd",
				output: target,
				lastDir: launchDir,
			}),
		).toBe(target);
	});

	it("does not adopt when pwd was chained but the output has no path line", () => {
		expect(
			resolveCdDir({
				command: "cd services/api && pwd",
				output: "hello\nnot a path\ndone\n",
				lastDir: launchDir,
			}),
		).toBeNull();
	});

	it("resolves a plain `cd <literal>` against the last known dir", () => {
		expect(
			resolveCdDir({
				command: "cd services/api",
				output: "",
				lastDir: launchDir,
			}),
		).toBe(abs("services", "api"));
	});

	it("resolves a quoted literal containing spaces", () => {
		expect(
			resolveCdDir({
				command: 'cd "dir with spaces"',
				output: "",
				lastDir: launchDir,
			}),
		).toBe(abs("dir with spaces"));
	});

	it("keeps the tracked dir when a plain cd target does not exist", () => {
		expect(
			resolveCdDir({
				command: "cd definitely/not/here",
				output: "",
				lastDir: launchDir,
			}),
		).toBeNull();
	});

	it.each([
		"cd -",
		"cd $SOME_VAR",
		"cd $(pwd)",
		"cd ~",
		"cd ~/somewhere",
		"cd",
	])("keeps the tracked dir for the ambiguous form: %s", (command) => {
		expect(
			resolveCdDir({ command, output: "", lastDir: launchDir }),
		).toBeNull();
	});

	it.each(["echo cd foo", "git add src/cd/", "echo abcd"])(
		"ignores commands that merely contain the letters cd: %s",
		(command) => {
			expect(
				resolveCdDir({ command, output: "", lastDir: launchDir }),
			).toBeNull();
		},
	);
});

describe("canonicalizeDir", () => {
	it("resolves a symlinked directory to its real target", () => {
		const result = canonicalizeDir(abs("api-link"));
		expect(result).toEqual({ ok: true, dir: abs("services", "api") });
	});

	it("fails closed for a missing directory", () => {
		expect(canonicalizeDir(abs("no", "such", "dir"))).toEqual({ ok: false });
	});

	it("fails closed for a broken symlink", () => {
		fs.symlinkSync(abs("gone"), abs("broken-link"), "dir");
		expect(canonicalizeDir(abs("broken-link"))).toEqual({ ok: false });
	});

	it("fails closed for a path that is a file", () => {
		expect(canonicalizeDir(abs("search-target", "hit.ts"))).toEqual({
			ok: false,
		});
	});

	it("fails closed for relative input", () => {
		expect(canonicalizeDir("services/api")).toEqual({ ok: false });
	});
});

describe("normalizeMsysPath", () => {
	it("converts msys drive form to host form", () => {
		expect(normalizeMsysPath("/c/Users/dev/project")).toBe("C:/Users/dev/project");
		expect(normalizeMsysPath("/d/work")).toBe("D:/work");
		expect(normalizeMsysPath("/c")).toBe("C:/");
	});

	it("leaves ordinary Unix paths unchanged", () => {
		expect(normalizeMsysPath("/Users/dev/project")).toBe("/Users/dev/project");
		expect(normalizeMsysPath("/var/tmp")).toBe("/var/tmp");
	});
});

describe("dirForToolEvent", () => {
	const bases = () => ({ launchDir, trackedDir: abs("services") });

	it.each(["read", "edit", "write"])(
		"%s maps to the touched file's directory (absolute path)",
		(toolName) => {
			const result = dirForToolEvent(
				toolName,
				{ path: abs("services", "api", "index.ts") },
				bases(),
			);
			expect(result).toEqual({
				touchedDir: abs("services", "api"),
				trackedDir: null,
			});
		},
	);

	it("resolves relative file paths against the launch directory", () => {
		const result = dirForToolEvent(
			"read",
			{ path: path.join("services", "api", "index.ts") },
			bases(),
		);
		expect(result.touchedDir).toBe(abs("services", "api"));
		expect(result.trackedDir).toBeNull();
	});

	it.each(["grep", "ls", "find"])(
		"%s maps a directory argument to the searched directory",
		(toolName) => {
			const result = dirForToolEvent(
				toolName,
				{ path: abs("search-target") },
				bases(),
			);
			expect(result).toEqual({
				touchedDir: abs("search-target"),
				trackedDir: null,
			});
		},
	);

	it("maps a file argument to its containing directory", () => {
		const result = dirForToolEvent(
			"grep",
			{ path: abs("search-target", "hit.ts") },
			bases(),
		);
		expect(result).toEqual({
			touchedDir: abs("search-target"),
			trackedDir: null,
		});
	});

	it("maps a missing path argument to the tracked working directory", () => {
		const result = dirForToolEvent("ls", {}, bases());
		expect(result).toEqual({ touchedDir: bases().trackedDir, trackedDir: null });
	});

	it("maps a relative search path against the launch directory", () => {
		const result = dirForToolEvent("find", { path: "search-target" }, bases());
		expect(result.touchedDir).toBe(abs("search-target"));
		expect(result.trackedDir).toBeNull();
	});

	it("maps bash through resolveCdDir and reports the tracked-dir move", () => {
		const result = dirForToolEvent(
			"bash",
			{ command: "cd services/api && pwd" },
			bases(),
			`${abs("services", "api")}\n`,
		);
		expect(result.touchedDir).toBe(abs("services", "api"));
		expect(result.trackedDir).toBe(abs("services", "api"));
	});

	it("keeps the tracked dir as touched dir for bash without a cd", () => {
		const result = dirForToolEvent("bash", { command: "ls -la" }, bases(), "");
		expect(result).toEqual({ touchedDir: bases().trackedDir, trackedDir: null });
	});

	it("returns nothing for unobserved tools", () => {
		expect(dirForToolEvent("webfetch", { path: "/x" }, bases())).toEqual({
			touchedDir: null,
			trackedDir: null,
		});
	});

	it("returns nothing when a file tool carries no usable path", () => {
		expect(dirForToolEvent("read", {}, bases())).toEqual({
			touchedDir: null,
			trackedDir: null,
		});
	});
});

describe("discoverContextFiles", () => {
	// Discovery fixture tree (under `root`):
	//   walk/                    — CLAUDE.md, AGENTS.md, RULES.md (trio)
	//   walk/mid/                — no context files (gap)
	//   walk/mid/deep/           — RULES.md
	//   walk/mid/deep/leaf/      — AGENTS.md, README.md, claude.md (ignored)
	let walkRoot: string;
	let deep: string;
	let leaf: string;

	beforeAll(() => {
		walkRoot = abs("walk");
		deep = abs("walk", "mid", "deep");
		leaf = abs("walk", "mid", "deep", "leaf");
		fs.mkdirSync(leaf, { recursive: true });
		fs.writeFileSync(path.join(walkRoot, "CLAUDE.md"), "root claude");
		fs.writeFileSync(path.join(walkRoot, "AGENTS.md"), "root agents");
		fs.writeFileSync(path.join(walkRoot, "RULES.md"), "root rules");
		fs.writeFileSync(path.join(deep, "RULES.md"), "deep rules");
		fs.writeFileSync(path.join(leaf, "AGENTS.md"), "leaf agents");
		fs.writeFileSync(path.join(leaf, "README.md"), "ignored");
		fs.writeFileSync(path.join(leaf, "claude.md"), "ignored (lowercase)");
	});

	const names = (files: { name: string }[]) => files.map((f) => f.name);

	it("collects files from touched up to launch, deepest-first (AC-007/009)", () => {
		const { files, skipped } = discoverContextFiles(leaf, walkRoot);
		expect(skipped).toEqual([]);
		expect(names(files)).toEqual([
			"AGENTS.md", // leaf
			"RULES.md", // deep
			// mid has none — the walk tolerates gaps
			"CLAUDE.md", // walkRoot trio in fixed order
			"AGENTS.md",
			"RULES.md",
		]);
		// Deepest-first invariant: files[0] is the deepest file.
		expect(files[0].dir).toBe(leaf);
	});

	it("ignores names that are not exact matches (AC-007)", () => {
		const { files } = discoverContextFiles(leaf, leaf);
		expect(names(files)).toEqual(["AGENTS.md"]);
	});

	it("returns the same-directory trio in fixed order (AC-010)", () => {
		const { files } = discoverContextFiles(walkRoot, walkRoot);
		expect(names(files)).toEqual(["CLAUDE.md", "AGENTS.md", "RULES.md"]);
		expect(files.every((f) => f.dir === walkRoot)).toBe(true);
	});

	it("handles touched dir equal to launch dir (walk length one)", () => {
		const { files } = discoverContextFiles(deep, deep);
		expect(names(files)).toEqual(["RULES.md"]);
	});

	it("discovers nothing when touched dir is outside the launch subtree (AC-008)", () => {
		const outside = abs("services", "api");
		expect(discoverContextFiles(outside, walkRoot).files).toEqual([]);
		expect(discoverContextFiles(outside, walkRoot).skipped).toEqual([]);
	});

	it("discovers nothing via a symlink escape from the subtree (AC-008)", () => {
		// api-link resolves to services/api, which is not under walk/.
		const { files } = discoverContextFiles(abs("api-link"), walkRoot);
		expect(files).toEqual([]);
	});

	it("caps content at 64 KB (AC-011)", () => {
		const big = path.join(deep, "CLAUDE.md");
		fs.writeFileSync(big, "x".repeat(100 * 1024));
		try {
			const { files } = discoverContextFiles(deep, deep);
			const claude = files.find((f) => f.name === "CLAUDE.md");
			expect(claude?.content.length).toBe(64 * 1024);
		} finally {
			fs.rmSync(big);
		}
	});

	it("caps multi-byte content at 64 KB of raw bytes, decoding cleanly (AC-011)", () => {
		// CJK characters are 3 UTF-8 bytes each: 200,000 of them are ~600 KB
		// raw. A code-unit cap would deliver up to 3x the 64 KB byte budget.
		const big = path.join(deep, "CLAUDE.md");
		fs.writeFileSync(big, "漢".repeat(200_000));
		try {
			const { files } = discoverContextFiles(deep, deep);
			const claude = files.find((f) => f.name === "CLAUDE.md");
			const byteLength = Buffer.byteLength(claude?.content ?? "", "utf8");
			expect(byteLength).toBeLessThanOrEqual(64 * 1024);
			// No trailing partial character: content is whole 漢 characters only.
			expect(/^漢*$/.test(claude?.content ?? "")).toBe(true);
		} finally {
			fs.rmSync(big);
		}
	});

	it("skips an unreadable file, records it, and keeps the rest (REQ-NR005, AC-022)", () => {
		// Injected reader rejects for AGENTS.md — permission bits are avoided
		// because they silently pass when tests run as root.
		const reader = (filePath: string): string => {
			if (filePath.endsWith("AGENTS.md")) throw new Error("EACCES: denied");
			return fs.readFileSync(filePath, "utf8");
		};
		const { files, skipped } = discoverContextFiles(walkRoot, walkRoot, reader);
		expect(names(files)).toEqual(["CLAUDE.md", "RULES.md"]);
		expect(skipped).toEqual([
			{
				path: path.join(walkRoot, "AGENTS.md"),
				reason: "unreadable: EACCES: denied",
			},
		]);
	});

	it("skips and records a file whose symlink target lies outside the subtree (AC-023)", () => {
		const escapee = path.join(deep, "AGENTS.md");
		fs.symlinkSync(path.join(walkRoot, "AGENTS.md"), escapee);
		try {
			const { files, skipped } = discoverContextFiles(deep, deep);
			// deep/RULES.md still collected; the escapee is not, and its target
			// content ("root agents") never appears.
			expect(names(files)).toEqual(["RULES.md"]);
			expect(files.some((f) => f.content === "root agents")).toBe(false);
			expect(skipped).toEqual([
				{
					path: escapee,
					reason: "symlink target outside the launch directory subtree",
				},
			]);
		} finally {
			fs.rmSync(escapee);
		}
	});

	it("carries the derived record shape (canonical path, display path, dir)", () => {
		const { files } = discoverContextFiles(leaf, walkRoot);
		const agents = files[0];
		expect(agents.canonicalPath).toBe(path.join(leaf, "AGENTS.md"));
		expect(agents.dir).toBe(leaf);
		expect(agents.displayPath).toBe(
			path.join("mid", "deep", "leaf", "AGENTS.md"),
		);
		expect(agents.content).toBe("leaf agents");
	});
});

describe("pickNewFiles", () => {
	let walkRoot: string;
	let leaf: string;
	beforeAll(() => {
		walkRoot = abs("walk");
		leaf = abs("walk", "mid", "deep", "leaf");
	});

	it("excludes seen files, keeps unseen in discovery order, never mutates (AC-020)", () => {
		const { files } = discoverContextFiles(leaf, walkRoot);
		expect(files.length).toBeGreaterThanOrEqual(2);
		const seen = new Set([files[0].canonicalPath, files[2].canonicalPath]);
		const picked = pickNewFiles(files, seen);
		expect(picked.map((f) => f.canonicalPath)).toEqual(
			[files[1], ...files.slice(3)].map((f) => f.canonicalPath),
		);
		// Input set and array untouched by the selection.
		expect(seen.size).toBe(2);
		expect(picked).not.toBe(files);
		expect(files.length).toBe(5);
	});

	it("returns everything when nothing has been seen", () => {
		const { files } = discoverContextFiles(leaf, walkRoot);
		expect(pickNewFiles(files, new Set())).toEqual(files);
	});
});

describe("preseedSeenFiles", () => {
	// Pre-seed fixture tree (under `root`):
	//   preseed/                 — CLAUDE.md (host-loaded at startup)
	//   preseed/sub/             — AGENTS.md
	let preseedRoot: string;
	let preseedSub: string;
	let claudePath: string;
	let agentsPath: string;

	beforeAll(() => {
		preseedRoot = abs("preseed");
		preseedSub = abs("preseed", "sub");
		fs.mkdirSync(preseedSub, { recursive: true });
		fs.writeFileSync(path.join(preseedRoot, "CLAUDE.md"), "host loaded");
		fs.writeFileSync(path.join(preseedSub, "AGENTS.md"), "nested");
		claudePath = fs.realpathSync(path.join(preseedRoot, "CLAUDE.md"));
		agentsPath = fs.realpathSync(path.join(preseedSub, "AGENTS.md"));
	});

	it("marks host-provided context files as seen, canonically keyed (AC-014)", () => {
		const result = preseedSeenFiles(
			[{ path: path.join(preseedRoot, "CLAUDE.md"), content: "host loaded" }],
			preseedRoot,
		);
		expect(result.fallback).toBe(false);
		expect(result.paths).toEqual([claudePath]);
	});

	it("accepts plain string entries and relative paths", () => {
		const result = preseedSeenFiles(["CLAUDE.md"], preseedRoot);
		expect(result.fallback).toBe(false);
		expect(result.paths).toEqual([claudePath]);
	});

	it("an empty host list yields an empty pre-seed without fallback (AC-014)", () => {
		const result = preseedSeenFiles([], preseedRoot);
		expect(result).toEqual({ paths: [], fallback: false });
	});

	it("an absent host list triggers the fallback subtree scan (AC-026)", () => {
		const result = preseedSeenFiles(undefined, preseedSub);
		expect(result.fallback).toBe(true);
		// Fallback walks from the launch dir upward: both fixtures are found.
		expect(result.paths).toContain(agentsPath);
		expect(result.paths).toContain(claudePath);
	});

	it("an unparseable host list triggers the fallback subtree scan (AC-026)", () => {
		for (const bogus of [42, "nope", { path: 1 }, [{}, { path: 42 }]]) {
			const result = preseedSeenFiles(bogus, preseedSub);
			expect(result.fallback).toBe(true);
			expect(result.paths).toContain(claudePath);
		}
	});

	it("tolerates non-path and unresolvable entries without throwing (AC-014)", () => {
		const result = preseedSeenFiles(
			[null, 42, {}, { path: "" }, { path: "does/not/exist.md" }, "CLAUDE.md"],
			preseedRoot,
		);
		expect(result.fallback).toBe(false);
		expect(result.paths).toEqual([claudePath]);
	});
});

describe("deriveSeenFromRecords", () => {
	const record = (files: string[]) => ({
		type: "custom_message",
		customType: CONTEXT_MESSAGE_TYPE,
		content: "…",
		display: true,
		details: { files },
	});

	it("re-derives exactly the delivered files from prior records (AC-027)", () => {
		const seen = deriveSeenFromRecords([
			{ type: "custom_message", customType: "other", details: { files: ["/x"] } },
			record(["/a/CLAUDE.md", "/a/sub/AGENTS.md"]),
			{ type: "user" },
			record(["/b/RULES.md"]),
			{ type: "custom_message", customType: "pi-rules-context", details: null },
		]);
		expect([...seen].sort()).toEqual(
			["/a/CLAUDE.md", "/a/sub/AGENTS.md", "/b/RULES.md"].sort(),
		);
	});

	it("yields an empty set when history holds no prior records (AC-027)", () => {
		expect(deriveSeenFromRecords([]).size).toBe(0);
		expect(
			deriveSeenFromRecords([{ type: "user" }, "junk", null]).size,
		).toBe(0);
	});
});

describe("initNavigationState", () => {
	it("fresh instance: empty seen set, tracked dir = launch dir (AC-018)", () => {
		const state = initNavigationState(root, []);
		expect(state.launchDir).toBe(root);
		expect(state.trackedDir).toBe(root);
		expect(state.seen.size).toBe(0);
		expect(state.preSeeded).toBe(false);
	});

	it("re-derives the seen set from prior records on reinit (AC-027)", () => {
		const delivered = abs("walk", "CLAUDE.md");
		const state = initNavigationState(root, [
			{
				type: "custom_message",
				customType: CONTEXT_MESSAGE_TYPE,
				details: { files: [delivered] },
			},
		]);
		expect(state.seen.has(delivered)).toBe(true);
	});

	it("a non-canonicalizable cwd inactivates the channel without throwing", () => {
		const state = initNavigationState(path.join(root, "gone"), []);
		expect(state.launchDir).toBeNull();
		expect(state.trackedDir).toBeNull();
	});
});

describe("NAVIGATION_GUIDANCE", () => {
	it("recommends the `&& pwd` chain for directory-change commands (AC-024)", () => {
		expect(NAVIGATION_GUIDANCE).toContain("&& pwd");
		expect(NAVIGATION_GUIDANCE).toContain("working directory");
	});
});

describe("deliveryDisplayPaths (renderer seam)", () => {
	it("prefers the display paths recorded at delivery time (AC-015)", () => {
		const details = {
			files: [abs("CLAUDE.md")],
			displayPaths: ["CLAUDE.md", "services/api/AGENTS.md"],
		};
		expect(deliveryDisplayPaths(details, root)).toEqual([
			"CLAUDE.md",
			"services/api/AGENTS.md",
		]);
	});

	it("falls back to recomputing launch-relative paths from canonical files (AC-015)", () => {
		const details = {
			files: [abs("CLAUDE.md"), abs("services", "api", "AGENTS.md")],
		};
		expect(deliveryDisplayPaths(details, root)).toEqual([
			"CLAUDE.md", // the launch dir's own file renders as its bare name
			path.join("services", "api", "AGENTS.md"),
		]);
	});

	it("yields nothing for junk details or a missing launch dir", () => {
		expect(deliveryDisplayPaths(undefined, root)).toEqual([]);
		expect(deliveryDisplayPaths("junk", root)).toEqual([]);
		expect(deliveryDisplayPaths({ files: "nope" }, root)).toEqual([]);
		expect(deliveryDisplayPaths({ files: [abs("CLAUDE.md")] }, null)).toEqual([]);
		expect(deliveryDisplayPaths({ files: ["", 42] }, root)).toEqual([]);
	});
});

describe("formatDeliveryLine", () => {
	it("renders multiple files as a comma-separated list on one line (AC-015)", () => {
		expect(formatDeliveryLine(["CLAUDE.md", "services/api/AGENTS.md"])).toBe(
			"📂 loaded CLAUDE.md, services/api/AGENTS.md",
		);
	});

	it("renders a generic fallback when no path is known", () => {
		expect(formatDeliveryLine([])).toBe("📂 loaded project context");
	});
});

describe("tool_result wiring (simulated events + captured sender)", () => {
	// Wiring fixture tree (launch dir = wiring/):
	//   wiring/CLAUDE.md                  — launch-dir context
	//   wiring/services/api/AGENTS.md     — cd target context
	//   wiring/pkg/AGENTS.md, foo.ts      — globs-rule + context combo
	//   wiring/retry/AGENTS.md            — rejection/rollback target
	//   wiring/await-target/AGENTS.md     — await-verification target
	//   wiring/broken/AGENTS.md           — broken symlink (skip at delivery)
	//   wiring/.pi/rules/ts-rule.md       — globs rule for **/*.ts
	//   wiring-outside/CLAUDE.md          — outside the launch subtree
	//   plain2/                           — launch dir with no context files
	let wiring: string;
	let outside: string;
	let plain: string;

	beforeAll(() => {
		wiring = abs("wiring");
		outside = abs("wiring-outside");
		plain = abs("plain2");
		fs.mkdirSync(abs("wiring", "services", "api"), { recursive: true });
		fs.mkdirSync(abs("wiring", "pkg"), { recursive: true });
		fs.mkdirSync(abs("wiring", "retry"), { recursive: true });
		fs.mkdirSync(abs("wiring", "await-target"), { recursive: true });
		fs.mkdirSync(abs("wiring", "broken"), { recursive: true });
		fs.mkdirSync(abs("wiring", ".pi", "rules"), { recursive: true });
		fs.mkdirSync(outside, { recursive: true });
		fs.mkdirSync(plain, { recursive: true });
		fs.writeFileSync(abs("wiring", "CLAUDE.md"), "wiring root context\n");
		fs.writeFileSync(abs("wiring", "services", "api", "AGENTS.md"), "api context\n");
		fs.writeFileSync(abs("wiring", "pkg", "AGENTS.md"), "pkg context\n");
		fs.writeFileSync(abs("wiring", "pkg", "foo.ts"), "export {};\n");
		fs.writeFileSync(abs("wiring", "retry", "AGENTS.md"), "retry context\n");
		fs.writeFileSync(abs("wiring", "await-target", "AGENTS.md"), "await context\n");
		fs.writeFileSync(path.join(outside, "CLAUDE.md"), "outside context\n");
		fs.writeFileSync(path.join(plain, "x.txt"), "nothing here\n");
		fs.writeFileSync(
			abs("wiring", ".pi", "rules", "ts-rule.md"),
			"---\ndescription: TypeScript rule\nglobs: [\"**/*.ts\"]\n---\nTS rule body.\n",
		);
		fs.symlinkSync(abs("wiring", "gone-target"), abs("wiring", "broken", "AGENTS.md"));
	});

	interface SentMessage {
		message: {
			customType: string;
			display?: boolean;
			content: string;
			details?: { files: string[]; displayPaths: string[] };
		};
		options: { deliverAs?: string; triggerTurn?: boolean } | undefined;
	}

	interface FakeMessage {
		customType: string;
		content: string;
		details?: unknown;
	}
	type FakeRenderer = (
		message: FakeMessage,
		options: { expanded: boolean },
		theme: { fg: (color: string, text: string) => string },
	) => { text?: string } | undefined;

	const fakeTheme = { fg: (_color: string, text: string) => text };

	function makeWiring(cwd: string) {
		const handlers = new Map<string, (event: unknown, ctx: unknown) => unknown>();
		const renderers = new Map<string, FakeRenderer>();
		const commands = new Map<
			string,
			(args: string | undefined, ctx: unknown) => unknown
		>();
		const sent: SentMessage[] = [];
		const notifications: { message: string; level: string }[] = [];
		const widgets = new Map<string, string[] | undefined>();
		let rendererRegistrations = 0;
		let sendBehavior: () => unknown = () => {};
		const fakePi = {
			on: (name: string, fn: (event: unknown, ctx: unknown) => unknown) => {
				handlers.set(name, fn);
			},
			registerCommand: (
				name: string,
				def: { handler: (args: string | undefined, ctx: unknown) => unknown },
			) => {
				commands.set(name, def.handler);
			},
			registerMessageRenderer: (customType: string, renderer: FakeRenderer) => {
				rendererRegistrations++;
				renderers.set(customType, renderer);
			},
			sendMessage: (message: SentMessage["message"], options: SentMessage["options"]) => {
				sent.push({ message, options });
				return sendBehavior();
			},
		};
		piRules(fakePi as never);
		const ctx = {
			cwd,
			hasUI: true,
			ui: {
				notify: (message: string, level: string) => notifications.push({ message, level }),
				setWidget: (key: string, lines: string[] | undefined) => {
					widgets.set(key, lines);
				},
			},
			sessionManager: { getEntries: () => [] },
		};
		handlers.get("session_start")!({ reason: "startup" }, ctx);
		const toolResult = (event: unknown) =>
			handlers.get("tool_result")!(event, ctx) as
				| Promise<{ content: { type: string; text?: string }[] } | undefined>
				| { content: { type: string; text?: string }[] }
				| undefined;
		const command = (name: string, args?: string) =>
			commands.get(name)!(args, ctx) as Promise<void> | void;
		return {
			sent,
			notifications,
			toolResult,
			renderers,
			commands,
			command,
			widgets,
			getRendererRegistrations: () => rendererRegistrations,
			sessionStart: () => handlers.get("session_start")!({ reason: "startup" }, ctx),
			setSendBehavior: (fn: () => unknown) => {
				sendBehavior = fn;
			},
		};
	}

	const bashEvent = (command: string, output: string) => ({
		type: "tool_result",
		toolName: "bash",
		input: { command },
		content: [{ type: "text", text: output }],
		isError: false,
	});

	it("`cd <dir> && pwd` with unseen context files sends exactly one combined message, marked seen (AC-001, AC-012)", async () => {
		const w = makeWiring(wiring);
		const target = abs("wiring", "services", "api");
		const result = await w.toolResult(bashEvent("cd services/api && pwd", `${target}\n`));

		expect(result).toBeUndefined(); // navigation channel never alters the result
		expect(w.sent).toHaveLength(1);
		const { message, options } = w.sent[0];
		expect(message.customType).toBe(CONTEXT_MESSAGE_TYPE);
		expect(options).toEqual({ deliverAs: "steer", triggerTurn: false });
		// Combined, deepest-first: api/AGENTS.md before wiring/CLAUDE.md.
		expect(message.details?.files).toEqual([
			abs("wiring", "services", "api", "AGENTS.md"),
			abs("wiring", "CLAUDE.md"),
		]);
		expect(message.details?.displayPaths).toEqual([
			path.join("services", "api", "AGENTS.md"),
			"CLAUDE.md",
		]);
		expect(message.content).toContain("api context");
		expect(message.content).toContain("wiring root context");

		// Second identical cd: deduped — no further send, no side effects.
		await w.toolResult(bashEvent("cd services/api && pwd", `${target}\n`));
		expect(w.sent).toHaveLength(1);
	});

	it("read on a file matching a globs rule delivers rule block AND one context send (AC-021)", async () => {
		const w = makeWiring(wiring);
		const result = await w.toolResult({
			type: "tool_result",
			toolName: "read",
			input: { path: abs("wiring", "pkg", "foo.ts") },
			content: [{ type: "text", text: "export {};" }],
			isError: false,
		});

		// Channel 1: rule block appended to the returned tool result.
		expect(result).toBeDefined();
		const blocks = result!.content;
		const last = blocks[blocks.length - 1];
		expect(last.text).toContain("Project rule activated: **ts-rule**");
		expect(last.text).toContain("TS rule body.");
		// Channel 2: exactly one context message.
		expect(w.sent).toHaveLength(1);
		expect(w.sent[0].message.details?.files).toEqual([
			abs("wiring", "pkg", "AGENTS.md"),
			abs("wiring", "CLAUDE.md"),
		]);
	});

	it("tool result with no new files sends nothing and returns undefined (REQ-013)", async () => {
		const w = makeWiring(plain);
		const result = await w.toolResult({
			type: "tool_result",
			toolName: "read",
			input: { path: abs("plain", "x.txt") },
			content: [{ type: "text", text: "nothing here" }],
			isError: false,
		});
		expect(result).toBeUndefined();
		expect(w.sent).toHaveLength(0);
	});

	it("rejected send: handler does not throw, rolls back seen-marking, warns, delivers later (AC-025, REQ-NR005)", async () => {
		const w = makeWiring(wiring);
		const target = abs("wiring", "retry");
		const event = bashEvent("cd retry && pwd", `${target}\n`);

		w.setSendBehavior(() => Promise.reject(new Error("boom")));
		const result = await w.toolResult(event); // must not throw
		expect(result).toBeUndefined();
		expect(w.sent).toHaveLength(1);
		expect(
			w.notifications.some(
				(n) => n.level === "warning" && n.message.includes("context delivery failed"),
			),
		).toBe(true);

		// Rolled back: a later identical event delivers again.
		w.setSendBehavior(() => {});
		await w.toolResult(event);
		expect(w.sent).toHaveLength(2);
		expect(w.sent[1].message.details?.files).toContain(abs("wiring", "retry", "AGENTS.md"));
	});

	it("await verification: the handler's promise does not resolve before the send promise (AC-012)", async () => {
		const w = makeWiring(wiring);
		const target = abs("wiring", "await-target");
		let release!: () => void;
		w.setSendBehavior(
			() =>
				new Promise<void>((resolve) => {
					release = resolve;
				}),
		);
		let handlerResolved = false;
		const pending = Promise.resolve(
			w.toolResult(bashEvent("cd await-target && pwd", `${target}\n`)),
		).then(() => {
			handlerResolved = true;
		});
		await new Promise((r) => setTimeout(r, 20));
		expect(handlerResolved).toBe(false); // a dropped await would resolve early
		release();
		await pending;
		expect(handlerResolved).toBe(true);
		expect(w.sent).toHaveLength(1);
	});

	it("unreadable context file at delivery is skipped, others still delivered (REQ-NR005)", async () => {
		const w = makeWiring(wiring);
		const target = abs("wiring", "broken");
		const result = await w.toolResult(bashEvent("cd broken && pwd", `${target}\n`));
		expect(result).toBeUndefined();
		expect(w.sent).toHaveLength(1);
		// broken/AGENTS.md is a broken symlink — skipped; launch CLAUDE.md delivered.
		expect(w.sent[0].message.details?.files).toEqual([abs("wiring", "CLAUDE.md")]);
	});

	it("touched dir outside the launch subtree sends nothing regardless of files (AC-008)", async () => {
		const w = makeWiring(wiring);
		const result = await w.toolResult(bashEvent("cd ../wiring-outside && pwd", `${outside}\n`));
		expect(result).toBeUndefined();
		expect(w.sent).toHaveLength(0);
	});

	it("rule-only combination: globs rule fires after the dir's context was already served (AD-006)", async () => {
		const w = makeWiring(wiring);
		const target = abs("wiring", "pkg");
		// Consume the directory's context first (wiring/CLAUDE.md + pkg/AGENTS.md).
		await w.toolResult(bashEvent("cd pkg && pwd", `${target}\n`));
		expect(w.sent).toHaveLength(1);

		// Now the read fires the globs rule but the context channel must stay
		// silent — and the rule block must still be returned.
		const result = await w.toolResult({
			type: "tool_result",
			toolName: "read",
			input: { path: abs("wiring", "pkg", "foo.ts") },
			content: [{ type: "text", text: "export {};" }],
			isError: false,
		});
		expect(result).toBeDefined();
		const last = result!.content[result!.content.length - 1];
		expect(last.text).toContain("Project rule activated: **ts-rule**");
		expect(last.text).toContain("TS rule body.");
		expect(w.sent).toHaveLength(1);
	});

	it("registers the context renderer exactly once, surviving repeated session starts (AC-015)", () => {
		const w = makeWiring(wiring);
		expect(w.renderers.has(CONTEXT_MESSAGE_TYPE)).toBe(true);
		expect(w.getRendererRegistrations()).toBe(1);
		w.sessionStart();
		expect(w.getRendererRegistrations()).toBe(1);
	});

	it("compact render: one line listing loaded paths, contents hidden (AC-015)", () => {
		const w = makeWiring(wiring);
		const renderer = w.renderers.get(CONTEXT_MESSAGE_TYPE)!;
		const component = renderer(
			{
				customType: CONTEXT_MESSAGE_TYPE,
				content: "📂 Loaded 2 project context file(s) …\n\nFULL BODY",
				details: { files: [], displayPaths: ["CLAUDE.md", "services/api/AGENTS.md"] },
			},
			{ expanded: false },
			fakeTheme,
		);
		expect(component?.text).toBe("📂 loaded CLAUDE.md, services/api/AGENTS.md");
		expect(component?.text).not.toContain("FULL BODY");
	});

	it("expanded render: the full delivered contents are visible (AC-015)", () => {
		const w = makeWiring(wiring);
		const renderer = w.renderers.get(CONTEXT_MESSAGE_TYPE)!;
		const component = renderer(
			{
				customType: CONTEXT_MESSAGE_TYPE,
				content: "📂 Loaded 1 project context file(s)\n\nFULL BODY",
				details: { files: [abs("wiring", "CLAUDE.md")] },
			},
			{ expanded: true },
			fakeTheme,
		);
		// No displayPaths recorded: paths are recomputed against the wiring
		// launch dir, so the launch dir's own file renders as its bare name.
		expect(component?.text).toContain("📂 loaded CLAUDE.md");
		expect(component?.text).toContain("FULL BODY");
	});

	it("/list-context lists loaded files, tracked dir, pre-seed count and skips — widget only (AC-016, AC-022)", async () => {
		const w = makeWiring(wiring);
		const target = abs("wiring", "broken");
		await w.toolResult(bashEvent("cd broken && pwd", `${target}\n`));
		// broken/AGENTS.md is a broken symlink (skipped); wiring/CLAUDE.md was
		// delivered. The conversation carries the delivery message; the
		// command itself must add nothing to it.
		expect(w.sent).toHaveLength(1);

		await w.command("list-context");
		expect(w.sent).toHaveLength(1); // zero conversation cost
		const lines = w.widgets.get("pi-rules");
		expect(lines).toBeDefined();
		const text = lines!.join("\n");
		expect(text).toContain("1 loaded");
		expect(text).toContain("0 pre-seeded");
		expect(text).toContain("1 skipped");
		expect(text).toContain(`tracked dir: ${target}`);
		expect(text).toContain("📂 CLAUDE.md"); // launch-relative display path
		expect(text).toContain(abs("wiring", "broken", "AGENTS.md"));
		expect(text).toContain("unresolvable path");
	});

	it("/list-context on an untouched session renders an explicit empty state (AC-016)", async () => {
		const w = makeWiring(plain);
		await w.command("list-context");
		const text = w.widgets.get("pi-rules")!.join("\n");
		expect(text).toContain("0 loaded");
		expect(text).toContain("(none loaded yet)");
		expect(text).toContain(`tracked dir: ${plain}`);
		expect(text).not.toContain("SKIPPED");
	});

	it("/rules report gains a context section with counts, tracked dir and skip reasons (AC-017, AC-022)", async () => {
		const w = makeWiring(wiring);
		const target = abs("wiring", "broken");
		await w.toolResult(bashEvent("cd broken && pwd", `${target}\n`));

		await w.command("rules");
		const text = w.widgets.get("pi-rules")!.join("\n");
		expect(text).toContain("CONTEXT (navigation)");
		expect(text).toContain("loaded: 1");
		expect(text).toContain("skipped: 1");
		expect(text).toContain(`tracked dir: ${target}`);
		expect(text).toContain(abs("wiring", "broken", "AGENTS.md"));
		expect(text).toContain("unresolvable path");
	});

	it("/rules reload rescans rules only — navigation state is left untouched (F1)", async () => {
		const w = makeWiring(wiring);
		const target = abs("wiring", "broken");
		await w.toolResult(bashEvent("cd broken && pwd", `${target}\n`));
		expect(w.sent).toHaveLength(1);

		await w.command("rules", "reload");
		// No widget rendered by reload; the navigation state must be intact.
		expect(w.widgets.has("pi-rules")).toBe(false);
		await w.command("list-context");
		const text = w.widgets.get("pi-rules")!.join("\n");
		expect(text).toContain("1 loaded");
		expect(text).toContain("1 skipped");
		expect(text).toContain(`tracked dir: ${target}`);

		// Re-touching the visited directory delivers nothing new: the seen set
		// and the skip records survived the reload.
		await w.toolResult(bashEvent("cd broken && pwd", `${target}\n`));
		expect(w.sent).toHaveLength(1);
	});
});
