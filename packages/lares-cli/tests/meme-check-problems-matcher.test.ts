/**
 * The canon's problem matcher reads every golden line the door prints.
 *
 * lar:///ha.ka.ba/lares/cli/problems carries a sample `tasks.json` whose `problemMatcher` regexp an
 * operator drops into VS Code. This weld reads that fence, holds its regexp equal to the door's own
 * (`PROBLEM_LINE_SOURCE`), and parses every golden line (fixtures/problems/golden.ts) through it, so the
 * shape, the door and the canon sample move together or red.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { PROBLEM_LINE_SOURCE } from "../src/problems.js";
import { GOLDEN, NAMES } from "./fixtures/problems/golden.js";

const REPO = path.resolve(new URL("../../..", import.meta.url).pathname);
const CANON = path.join(REPO, "bags/lares/ha.ka.ba/lares/cli/problems.mem");

describe("the canon's matcher regexp reads every golden line", () => {
  test("the tasks.json sample parses, and its pattern captures file, line, column, severity, code, message", () => {
    const canon = readFileSync(CANON, "utf8");
    const fence = /```json tasks\n([\s\S]*?)\n```/.exec(canon);
    expect(fence, "the canon carries a ```json tasks fence").not.toBeNull();
    const tasks = JSON.parse(fence![1]!) as { tasks: Array<{ problemMatcher: { pattern: Record<string, unknown> } }> };
    const pattern = tasks.tasks[0]!.problemMatcher.pattern;
    expect(pattern).toMatchObject({ file: 1, line: 2, column: 3, severity: 4, code: 5, message: 6 });
    expect(pattern["regexp"], "the canon's regexp and the door's own name one shape").toBe(PROBLEM_LINE_SOURCE);
    const re = new RegExp(String(pattern["regexp"]));
    const lines = NAMES.flatMap((n) => GOLDEN[n].lines);
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      const m = re.exec(line);
      expect(m, line).not.toBeNull();
      const [, file, row, col, severity, code, message] = m!;
      expect(`${file}:${row}:${col}: ${severity}: ${code}: ${message}`).toBe(line);
      expect(file).toMatch(/\.mem$/);
      expect(["error", "warning", "info"]).toContain(severity);
    }
    // A Windows path keeps its drive letter's colon inside the file capture.
    expect(re.exec("C:\\house\\x.mem:3:7: warning: flag: a reading")?.[1]).toBe("C:\\house\\x.mem");
  });
});
