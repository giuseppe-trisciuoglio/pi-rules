import * as path from "node:path";

/**
 * Checks whether a path touched by a tool matches at least one of the rule
 * globs. Tools may pass project-relative or absolute paths, so both forms
 * are tested. Invalid glob patterns are ignored rather than breaking the
 * tool call that triggered the check.
 */
export function ruleMatchesPath(globs: string[], toolPath: string, cwd: string): boolean {
	if (globs.length === 0 || toolPath === "") return false;

	const candidates = new Set<string>([toolPath]);
	if (path.isAbsolute(toolPath)) {
		const relative = path.relative(cwd, toolPath);
		if (relative !== "" && !relative.startsWith("..")) {
			candidates.add(relative.split(path.sep).join("/"));
		}
	} else {
		candidates.add(path.resolve(cwd, toolPath));
	}

	for (const glob of globs) {
		for (const candidate of candidates) {
			try {
				if (path.matchesGlob(candidate, glob)) return true;
			} catch {
				// Invalid glob pattern in the rule file: skip it.
			}
		}
	}
	return false;
}
