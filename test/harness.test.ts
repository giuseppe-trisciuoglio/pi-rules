import { describe, expect, it } from "vitest";
import { Box, Text } from "@earendil-works/pi-tui";
import piRules from "../src/index";

describe("vitest harness", () => {
	it("loads the real extension entry point (and its renderer) under the alias", () => {
		expect(typeof piRules).toBe("function");
	});

	it("resolves @earendil-works/pi-tui to the stub", () => {
		expect(typeof Text).toBe("function");
		expect(typeof Box).toBe("function");
		expect(new Text("hello").render(80)).toEqual(["hello"]);
	});
});
