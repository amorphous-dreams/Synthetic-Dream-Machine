/**
 * L3 · HELP AND REFUSAL RENDER FROM ONE SOURCE: `--help` prints exactly the lines a refusal prints.
 *
 * Inputs: every key in the live help registry, a door or a `"<door> <sub>"` sub-door. Control: two
 * different doors render different bytes, so an equality that held for everything would read red.
 *
 * Law: lar:///ha.ka.ba/lares/docs/pono/cli-test-laws#/L3
 */
import { describe, expect, test, vi } from "vitest";
import { helpLines, renderCommandHelp } from "../../src/command-help.js";
import { helpKeys } from "./harness.js";

function rendered(key: string): string {
  const printed: string[] = [];
  const log = vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { printed.push(a.map(String).join(" ")); });
  try { renderCommandHelp(key); } finally { log.mockRestore(); }
  return printed.join("\n");
}

describe("L3 · help and refusal render the same bytes", () => {
  test.each(helpKeys().map((k) => [k]))("`%s`: --help prints the refusal's lines", (key) => {
    expect(rendered(key)).toBe(helpLines(key).join("\n"));
  });

  test.each(helpKeys().map((k) => [k]))("`%s`: the refusal leads with its usage spine", (key) => {
    expect(helpLines(key)[0]).toMatch(new RegExp(`^usage: lares ${key}`));
  });

  test("CONTROL: two doors render different bytes", () => {
    const [a, b] = helpKeys();
    expect(rendered(a!)).not.toBe(rendered(b!));
  });
});
