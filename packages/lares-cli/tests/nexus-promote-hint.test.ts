/**
 * nexus-promote-hint.test.ts — every sign command the promote door prints names the statement digest, the one
 * confirmation that signs. A hint naming only the bytes hash leaves the person in the read-only branch.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = readFileSync(fileURLToPath(new URL("../src/commands/nexus-promote.ts", import.meta.url)), "utf8");
const printed = source.split("\n").filter((line) => line.includes("console.log(") && line.includes("--confirm-"));

describe("the promote door's printed sign hints", () => {
  test("CONTROL: the door prints at least two sign hints", () => {
    expect(printed.length).toBeGreaterThanOrEqual(2);
  });
  test("each printed hint names --confirm-statement with the statement digest", () => {
    for (const line of printed) expect(line).toMatch(/--confirm-statement \$\{r\.statement\}/);
  });
});
