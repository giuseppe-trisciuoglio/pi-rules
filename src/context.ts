import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Directory-resolution helpers for the navigation-context channel. Everything
 * here is pure string/FS logic with no host imports: command strings are only
 * ever inspected, never executed — the model authors them, so anything derived
 * from them is untrusted input.
 */

/** Successful canonicalization carries the real on-disk directory. */
export type CanonicalDirResult = { ok: true; dir: string } | { ok: false };

/** Result of mapping a tool event to directories. */
export interface ToolDirResult {
	/** Touched Directory for discovery, or null when the tool maps to nothing. */
	touchedDir: string | null;
	/** New Tracked Working Directory; only ever set for bash directory changes. */
	trackedDir: string | null;
}

/** Base directories the helpers resolve against. */
export interface DirBases {
	/** Launch Directory — the base for relative file/search tool paths. */
	launchDir: string;
	/** Tracked Working Directory — the system's knowledge of the shell's cwd. */
	trackedDir: string;
}

export interface CdResolutionInput {
	/** The bash command string, as authored by the model. Never executed. */
	command: string;
	/** The command's combined output, where a trusted pwd line may appear. */
	output: string;
	/** Last known Tracked Working Directory; resolution base for literals. */
	lastDir: string;
}

// A `cd` segment starts the command or follows a shell operator, so words that
// merely contain the letters ("echo cd foo", "src/cd/") never match.
const CD_SEGMENT = /(?:^|(?:[;&|]\s*)+)cd(?:\s|$)/;

// A pwd request chained onto the command; its output line is authoritative.
const PWD_CHAIN = /(?:&&|;)\s*pwd(?:\s|$)/;

// A simple `cd <literal>`: quoted ("…" / '…') or bare, stopping at whitespace
// or the next operator.
const SIMPLE_CD = /(?:^|(?:[;&|]\s*)+)cd\s+(?:"([^"]*)"|'([^']*)'|([^\s;&|'"]+))/;

// Absolute-path-shaped line: Unix root or a Windows drive prefix.
const ABSOLUTE_LINE = /^\s*(\/|[A-Za-z]:[\\/])/;

const FILE_TOOLS = new Set(["read", "edit", "write"]);
const SEARCH_TOOLS = new Set(["grep", "ls", "find"]);

/**
 * Pure string transform from git-bash/msys form (`/c/Users/...`) to the host
 * drive form (`C:/Users/...`). Paths that are not in msys form are returned
 * unchanged. Exported so the transform can be verified on any platform.
 */
export function normalizeMsysPath(p: string): string {
	const match = /^\/([A-Za-z])(?=\/|$)/.exec(p);
	if (match === null) return p;
	const rest = p.slice(match[0].length);
	return `${match[1].toUpperCase()}:${rest === "" ? "/" : rest}`;
}

/**
 * Resolves a directory to its canonical on-disk form: msys normalization,
 * then symlink resolution via realpath. Fail-closed by design — a relative,
 * missing, broken or non-directory input yields `{ ok: false }`, which callers
 * treat as "load nothing" rather than guessing.
 */
export function canonicalizeDir(dir: string): CanonicalDirResult {
	if (dir.trim() === "") return { ok: false };
	const normalized = normalizeMsysPath(dir);
	// On non-Windows hosts the msys form is not absolute after the transform;
	// fall back to the original so a genuine `/c/...` POSIX path still works.
	let candidate: string | null;
	if (path.isAbsolute(normalized)) candidate = normalized;
	else if (path.isAbsolute(dir)) candidate = dir;
	else candidate = null;
	if (candidate === null) return { ok: false };
	try {
		const real = fs.realpathSync(candidate);
		if (!fs.statSync(real).isDirectory()) return { ok: false };
		return { ok: true, dir: real };
	} catch {
		return { ok: false };
	}
}

/** Last output line that looks like an absolute path, or null. */
function lastAbsolutePathLine(output: string): string | null {
	let found: string | null = null;
	for (const rawLine of output.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (line !== "" && ABSOLUTE_LINE.test(line)) found = line;
	}
	return found;
}

/**
 * Extracts the target of a simple `cd <literal>`, or null when the cd is not
 * simple. Dynamic targets (`-`, `~` forms, `$VAR`, substitutions) are never
 * guessed: without pwd evidence the previous dir must be kept.
 */
function simpleCdTarget(command: string): string | null {
	const match = SIMPLE_CD.exec(command);
	if (match === null) return null;
	const target = match[1] ?? match[2] ?? match[3];
	if (target === undefined || target === "") return null;
	if (target === "-" || target.startsWith("~")) return null;
	if (target.includes("$") || target.includes("`")) return null;
	return target;
}

/**
 * Resolves the Tracked Working Directory after a bash command. Returns the
 * canonical new directory, or null to keep the previous one. Three tiers:
 *
 * 1. The command chains a pwd request and the output holds an absolute-path
 *    line — that line is authoritative and handles every exotic cd form
 *    (spaces, `cd -`, variables, substitutions).
 * 2. A simple `cd <literal>` is resolved against the last known dir and
 *    adopted only when it lands on a real directory — a failed cd never moves
 *    the tracked dir because bash keeps its cwd on error.
 * 3. Anything else keeps the previous dir.
 */
export function resolveCdDir(input: CdResolutionInput): string | null {
	const { command, output, lastDir } = input;
	if (!CD_SEGMENT.test(command)) return null;

	if (PWD_CHAIN.test(command)) {
		// pwd was requested but produced no path line: the cd almost certainly
		// failed, so no tier-2 fallback — adopting the literal would be a guess.
		const line = lastAbsolutePathLine(output);
		if (line === null) return null;
		const canon = canonicalizeDir(line);
		return canon.ok ? canon.dir : null;
	}

	const target = simpleCdTarget(command);
	if (target === null) return null;
	const canon = canonicalizeDir(path.resolve(lastDir, target));
	return canon.ok ? canon.dir : null;
}

/** Resolves a possibly-relative tool path against the Launch Directory. */
function resolveAgainstLaunch(p: string, launchDir: string): string {
	return path.isAbsolute(p) ? p : path.resolve(launchDir, p);
}

/** Path argument of a file/search tool call, when present. */
function toolPathArg(input: Record<string, unknown> | undefined): string | null {
	if (input === undefined) return null;
	const p = input.path;
	return typeof p === "string" && p !== "" ? p : null;
}

/**
 * Maps an observed tool call to its Touched Directory. Only `bash` may move
 * the Tracked Working Directory (via resolveCdDir); file and search tools
 * never do. Relative file/search paths resolve against the Launch Directory,
 * matching the host's own resolution — the shell's tracked dir is not their
 * base. Search tools: a directory argument is used as given, a file argument
 * maps to its containing directory, and no argument means the tracked dir.
 * Canonicalization is left to the caller's choke point.
 */
export function dirForToolEvent(
	toolName: string,
	input: Record<string, unknown> | undefined,
	bases: DirBases,
	bashOutput = "",
): ToolDirResult {
	const none: ToolDirResult = { touchedDir: null, trackedDir: null };

	if (toolName === "bash") {
		const command =
			input !== undefined && typeof input.command === "string"
				? input.command
				: "";
		const trackedDir = resolveCdDir({
			command,
			output: bashOutput,
			lastDir: bases.trackedDir,
		});
		return { touchedDir: trackedDir ?? bases.trackedDir, trackedDir };
	}

	const pathArg = toolPathArg(input);

	if (FILE_TOOLS.has(toolName)) {
		if (pathArg === null) return none;
		return {
			touchedDir: path.dirname(resolveAgainstLaunch(pathArg, bases.launchDir)),
			trackedDir: null,
		};
	}

	if (SEARCH_TOOLS.has(toolName)) {
		if (pathArg === null) {
			return { touchedDir: bases.trackedDir, trackedDir: null };
		}
		const resolved = resolveAgainstLaunch(pathArg, bases.launchDir);
		let isFile = false;
		try {
			isFile = fs.statSync(resolved).isFile();
		} catch {
			// Not on disk (new file, glob-ish argument): treat as a directory.
		}
		return {
			touchedDir: isFile ? path.dirname(resolved) : resolved,
			trackedDir: null,
		};
	}

	return none;
}

/** Recognized Context File names, in their fixed same-directory order. */
const CONTEXT_FILE_NAMES = ["CLAUDE.md", "AGENTS.md", "RULES.md"];

/** Maximum content bytes kept per Context File. */
const CONTENT_CAP = 64 * 1024;

/** A discovered Context File, ready for delivery and dedup. */
export interface ContextFile {
	/** Recognized file name (one of CONTEXT_FILE_NAMES). */
	name: string;
	/** Canonical directory containing the file. */
	dir: string;
	/** Canonical absolute path — the Seen Files dedup key. */
	canonicalPath: string;
	/** File content, capped at the first 64 KB of raw file bytes. */
	content: string;
	/** Path relative to the Launch Directory, for compact display. */
	displayPath: string;
}

/** Why a Context File was skipped during discovery. */
export interface SkipRecord {
	/** Absolute path of the skipped file (pre-read form). */
	path: string;
	/** Human-readable reason (unreadable, target outside subtree, ...). */
	reason: string;
}

/** Outcome of a walk-up discovery: collected files plus skip records. */
export interface DiscoveryResult {
	files: ContextFile[];
	skipped: SkipRecord[];
}

/** Content reader; injectable so failure modes are testable without
 * permission-bit fixtures that silently pass when CI runs as root. */
export type ContextFileReader = (filePath: string) => string;

/**
 * Decodes a raw byte slice as UTF-8, dropping a trailing partial multi-byte
 * sequence so capped content never ends mid-character (or on a lone
 * surrogate).
 */
function decodeUtf8Complete(buf: Buffer, length: number): string {
	let end = length;
	let lead = end - 1;
	while (lead >= 0 && (buf[lead] & 0xc0) === 0x80) lead--;
	if (lead >= 0) {
		const b = buf[lead];
		let seqLen: number;
		if (b >= 0xf0) seqLen = 4;
		else if (b >= 0xe0) seqLen = 3;
		else if (b >= 0xc0) seqLen = 2;
		else seqLen = 1;
		if (seqLen > 1 && lead + seqLen > end) end = lead;
	}
	return buf.subarray(0, end).toString("utf8");
}

// The cap is measured on raw file bytes: read at most CONTENT_CAP bytes, then
// decode. Decoding first and slicing the string would let multi-byte content
// deliver several times the cap.
const defaultReader: ContextFileReader = (filePath) => {
	const fd = fs.openSync(filePath, "r");
	try {
		const buf = Buffer.alloc(CONTENT_CAP);
		let total = 0;
		while (total < CONTENT_CAP) {
			const n = fs.readSync(fd, buf, total, CONTENT_CAP - total, null);
			if (n <= 0) break;
			total += n;
		}
		return decodeUtf8Complete(buf, total);
	} finally {
		fs.closeSync(fd);
	}
};

/** True when dir is the subtree root or lies below it (canonical forms). */
function withinSubtree(dir: string, subtreeRoot: string): boolean {
	return dir === subtreeRoot || dir.startsWith(subtreeRoot + path.sep);
}

/**
 * Walk-up discovery: from the Touched Directory up to and including the
 * Launch Directory, collecting exactly CLAUDE.md / AGENTS.md / RULES.md.
 * Files are ordered deepest-first, `files[0]` being the deepest; within one
 * directory the order is the fixed CONTEXT_FILE_NAMES order.
 *
 * Both ends are canonicalized here — containment is decided on canonical
 * forms, so a touched dir that escapes via symlink discovers nothing. A
 * Context File that is itself a symlink is resolved before reading; when its
 * target lies outside the subtree the file is skipped (never read) and a Skip
 * Record is produced, as it is for any unreadable file. Discovery itself
 * never throws.
 */
/** Result of attempting to read a single Context File candidate. */
type ReadOutcome =
	| { kind: "file"; file: ContextFile }
	| { kind: "skip"; skip: SkipRecord };

/** Enumerates one directory's entries as a name set; empty set on failure. */
function readEntries(dir: string): Set<string> {
	try {
		return new Set(fs.readdirSync(dir));
	} catch {
		return new Set();
	}
}

/**
 * Resolves a candidate's symlink, checks subtree containment, and reads its
 * content. Returns a file record on success and a skip record on any
 * resolution / containment / read failure. The caller's loop body is the
 * only place that decides which bucket the record lands in.
 */
function readContextFile(
	candidate: string,
	name: string,
	dir: string,
	launchRoot: string,
	readFile: ContextFileReader,
): ReadOutcome {
	let canonical: string;
	try {
		canonical = fs.realpathSync(candidate);
	} catch {
		return { kind: "skip", skip: { path: candidate, reason: "unresolvable path" } };
	}
	if (!withinSubtree(canonical, launchRoot)) {
		return {
			kind: "skip",
			skip: {
				path: candidate,
				reason: "symlink target outside the launch directory subtree",
			},
		};
	}
	try {
		const content = readFile(canonical).slice(0, CONTENT_CAP);
		return {
			kind: "file",
			file: {
				name,
				dir,
				canonicalPath: canonical,
				content,
				displayPath: path.relative(launchRoot, canonical),
			},
		};
	} catch (error) {
		return {
			kind: "skip",
			skip: {
				path: candidate,
				reason: `unreadable: ${error instanceof Error ? error.message : String(error)}`,
			},
		};
	}
}

export function discoverContextFiles(
	touchedDir: string,
	launchDir: string,
	readFile: ContextFileReader = defaultReader,
): DiscoveryResult {
	const result: DiscoveryResult = { files: [], skipped: [] };
	const launch = canonicalizeDir(launchDir);
	const touched = canonicalizeDir(touchedDir);
	if (!launch.ok || !touched.ok) return result;
	if (!withinSubtree(touched.dir, launch.dir)) return result;

	const launchRoot = launch.dir;
	let dir = touched.dir;
	for (;;) {
		// Enumerate entries and match names exactly: probing each candidate
		// with existsSync would accept `claude.md` on a case-insensitive
		// filesystem, but only the exact names are Context Files.
		const entries = readEntries(dir);
		for (const name of CONTEXT_FILE_NAMES) {
			if (!entries.has(name)) continue;
			const outcome = readContextFile(path.join(dir, name), name, dir, launchRoot, readFile);
			if (outcome.kind === "file") result.files.push(outcome.file);
			else result.skipped.push(outcome.skip);
		}
		if (dir === launchRoot) break;
		const parent = path.dirname(dir);
		if (parent === dir) break; // filesystem root reached before launch
		dir = parent;
	}
	return result;
}

/**
 * Pure Seen Files selection: returns the discovered files whose canonical
 * paths are not yet in the seen set, preserving discovery order. Neither the
 * set nor the input array is mutated — marking happens only after delivery.
 */
export function pickNewFiles(
	files: readonly ContextFile[],
	seen: ReadonlySet<string>,
): ContextFile[] {
	return files.filter((file) => !seen.has(file.canonicalPath));
}

/**
 * Extracts the launch-relative paths for a delivery record's compact
 * rendering. Prefers the display paths recorded at delivery time; when a
 * record predates them (or they are unusable), recomputes relative paths
 * from the canonical files against the current Launch Directory. History is
 * host-owned, so extraction is tolerant and never throws.
 */
export function deliveryDisplayPaths(details: unknown, launchDir: string | null): string[] {
	if (typeof details !== "object" || details === null) return [];
	const record = details as Record<string, unknown>;
	if (Array.isArray(record.displayPaths)) {
		const paths = record.displayPaths.filter(
			(p): p is string => typeof p === "string" && p !== "",
		);
		if (paths.length > 0) return paths;
	}
	if (launchDir === null || !Array.isArray(record.files)) return [];
	const paths: string[] = [];
	for (const file of record.files) {
		if (typeof file !== "string" || file === "") continue;
		const relative = path.relative(launchDir, file);
		if (relative !== "") paths.push(relative);
	}
	return paths;
}

/**
 * The single compact line a delivery renders as in the TUI: the loaded
 * paths comma-separated, with a generic fallback when no path is known.
 */
export function formatDeliveryLine(paths: readonly string[]): string {
	return paths.length > 0
		? `📂 loaded ${paths.join(", ")}`
		: "📂 loaded project context";
}

/** Custom message type marking a context delivery in session history. */
export const CONTEXT_MESSAGE_TYPE = "pi-rules-context";

/**
 * Re-derives the Seen Files set from prior delivery records found in session
 * history. Anything that is not a delivery record of this channel, or whose
 * details do not carry a string path list, is ignored — history is host-owned
 * and must be read tolerantly. Never throws.
 */
export function deriveSeenFromRecords(entries: readonly unknown[]): Set<string> {
	const seen = new Set<string>();
	for (const entry of entries) {
		if (typeof entry !== "object" || entry === null) continue;
		const record = entry as Record<string, unknown>;
		if (record.type !== "custom_message") continue;
		if (record.customType !== CONTEXT_MESSAGE_TYPE) continue;
		const details = record.details;
		if (typeof details !== "object" || details === null) continue;
		const files = (details as Record<string, unknown>).files;
		if (!Array.isArray(files)) continue;
		for (const file of files) {
			if (typeof file === "string" && file !== "") seen.add(file);
		}
	}
	return seen;
}

/**
 * Re-derives the delivered display paths from prior delivery records in
 * session history, in record order. Same tolerance rules as
 * deriveSeenFromRecords: anything that is not a delivery record of this
 * channel yields nothing, and extraction never throws.
 */
export function deriveDeliveredFromRecords(
	entries: readonly unknown[],
	launchDir: string | null,
): string[] {
	const delivered: string[] = [];
	for (const entry of entries) {
		if (typeof entry !== "object" || entry === null) continue;
		const record = entry as Record<string, unknown>;
		if (record.type !== "custom_message") continue;
		if (record.customType !== CONTEXT_MESSAGE_TYPE) continue;
		delivered.push(...deliveryDisplayPaths(record.details, launchDir));
	}
	return delivered;
}

/**
 * Canonicalizes a single file path (possibly relative to the Launch
 * Directory) for use as a Seen Files key. Returns null when the path does
 * not resolve to an on-disk file — unresolvable host entries are ignored,
 * never fatal.
 */
export function canonicalizeFilePath(p: string, launchDir: string): string | null {
	if (typeof p !== "string" || p.trim() === "") return null;
	const resolved = path.isAbsolute(p) ? p : path.resolve(launchDir, p);
	try {
		const real = fs.realpathSync(resolved);
		return fs.statSync(real).isFile() ? real : null;
	} catch {
		return null;
	}
}

/**
 * Fallback pre-seed scan: walks from the Launch Directory up to the
 * filesystem root collecting the canonical paths of recognized Context
 * Files. Used when the host's startup context-file list is absent or
 * unparseable; only paths are recorded (content is never read). Never
 * throws.
 */
export function prescanLaunchTree(launchDir: string): string[] {
	const found: string[] = [];
	const launch = canonicalizeDir(launchDir);
	if (!launch.ok) return found;
	let dir = launch.dir;
	for (;;) {
		let entries: Set<string>;
		try {
			entries = new Set(fs.readdirSync(dir));
		} catch {
			entries = new Set();
		}
		for (const name of CONTEXT_FILE_NAMES) {
			if (!entries.has(name)) continue;
			const canonical = canonicalizeFilePath(path.join(dir, name), launch.dir);
			if (canonical !== null) found.push(canonical);
		}
		const parent = path.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	return found;
}

/** Outcome of the Seen Files pre-seed against the host's startup list. */
export interface PreseedResult {
	/** Canonical paths to mark as seen. */
	paths: string[];
	/** True when the host list was absent or unparseable and the fallback
	 * subtree scan ran instead — the caller should surface a warning. */
	fallback: boolean;
}

/**
 * Computes the Seen Files pre-seed from the host's startup context-file
 * list. The list's shape is only loosely contracted, so extraction is
 * tolerant: string entries and objects with a string `path` are accepted,
 * anything else is ignored, and paths are compared canonically. An absent
 * list, a non-array value, or a list with entries but no usable path yields
 * the fallback scan of the launch tree instead.
 */
/** Extracts the loose-shaped path strings from the host's startup list. */
function extractRawPaths(contextFiles: readonly unknown[]): string[] {
	const rawPaths: string[] = [];
	for (const entry of contextFiles) {
		if (typeof entry === "string") {
			rawPaths.push(entry);
		} else if (typeof entry === "object" && entry !== null) {
			const p = (entry as Record<string, unknown>).path;
			if (typeof p === "string") rawPaths.push(p);
		}
	}
	return rawPaths;
}

/** Canonicalizes a list of loose-shaped paths for the Seen Files set. */
function canonicalizeRawPaths(rawPaths: readonly string[], launchDir: string): string[] {
	const paths: string[] = [];
	for (const raw of rawPaths) {
		const canonical = canonicalizeFilePath(raw, launchDir);
		if (canonical !== null) paths.push(canonical);
	}
	return paths;
}

export function preseedSeenFiles(contextFiles: unknown, launchDir: string): PreseedResult {
	if (!Array.isArray(contextFiles)) {
		return { paths: prescanLaunchTree(launchDir), fallback: true };
	}
	const rawPaths = extractRawPaths(contextFiles);
	if (contextFiles.length > 0 && rawPaths.length === 0) {
		return { paths: prescanLaunchTree(launchDir), fallback: true };
	}
	return { paths: canonicalizeRawPaths(rawPaths, launchDir), fallback: false };
}

/** Navigation-channel session state, owned by the extension-factory closure. */
export interface NavigationState {
	/** Canonical Launch Directory, or null when it could not be canonicalized
	 * (the channel stays inactive for the session). */
	launchDir: string | null;
	/** Canonical Tracked Working Directory; starts at the Launch Directory. */
	trackedDir: string | null;
	/** Canonical paths of Context Files already known to the conversation. */
	seen: Set<string>;
	/** Whether the lazy host-list pre-seed has run for this session. */
	preSeeded: boolean;
	/** Launch-relative display paths delivered this session, in delivery
	 * order; re-derived from history on reinit so the listing survives it. */
	delivered: string[];
	/** Seen entries contributed by the host-list pre-seed (0 when the
	 * pre-seed has not run yet). */
	preseedCount: number;
	/** Skip Records accumulated at discovery time, deduped by path. */
	skipped: SkipRecord[];
}

/**
 * Initializes the navigation state for a fresh extension instance: the
 * Launch Directory is canonicalized once and becomes the initial Tracked
 * Working Directory, and the Seen Files set is re-derived from prior
 * delivery records in session history (empty for a fresh conversation).
 * Session replacement discards the whole instance, so a fresh object here
 * is the reset mechanism — there is no explicit clear path.
 */
export function initNavigationState(
	cwd: string,
	historyEntries: readonly unknown[],
): NavigationState {
	const launch = canonicalizeDir(cwd);
	return {
		launchDir: launch.ok ? launch.dir : null,
		trackedDir: launch.ok ? launch.dir : null,
		seen: deriveSeenFromRecords(historyEntries),
		preSeeded: false,
		delivered: launch.ok ? deriveDeliveredFromRecords(historyEntries, launch.dir) : [],
		preseedCount: 0,
		skipped: [],
	};
}

/**
 * System-prompt guidance carried while the navigation channel is active:
 * the pwd chain lets the tracked working directory follow the shell even
 * for directory changes the extension cannot parse statically.
 */
export const NAVIGATION_GUIDANCE =
	"Navigation context: when a shell command changes the working directory, " +
	"append `&& pwd` to it so the new location can be tracked and the relevant " +
	"project context files can be loaded on demand.";

