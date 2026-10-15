/**
 * `lares bag cas --help` NAMES EVERY DOOR THE VERB OPENS.
 *
 * The `cas` sub-verb carries five flags (`--all` · `--fetch <cid>` · `--pin <cid>` · `--release <cid>` ·
 * `--sweep [--dry-run]`) and the help line is the one place an operator reads them without opening the
 * source. A flag the handler answers and the help omits is a door with no sign on it — the sweep landed
 * that way (c54f22b39 wired the verb, the summary kept the four it knew). The check reads the help the CLI
 * PRINTS, never a transcription of it. CONTROL: a flag the verb never carried stays absent.
 */
import { describe, test, expect } from "vitest";
import { cmdBag } from "../src/commands/bag.js";

async function bagHelp(): Promise<string> {
  const lines: string[] = [];
  const orig = console.log;
  console.log = (...a: unknown[]) => { lines.push(a.map(String).join(" ")); };
  try { await cmdBag({ command: "bag", positional: ["help"], options: {}, flags: {} }); }
  finally { console.log = orig; }
  return lines.join("\n");
}

describe("lares bag cas --help", () => {
  test("★ the cas line names --sweep [--dry-run] · --pin <cid> · --release <cid> · --fetch <cid> ★", async () => {
    const help = await bagHelp();
    const cas = help.split("\n").find((l) => /^\s+cas\s{2,}/.test(l)) ?? "";
    expect(cas, `no \`cas\` line in:\n${help}`).not.toBe("");
    expect(cas).toContain("--sweep [--dry-run]");
    expect(cas).toContain("--pin <cid>");
    expect(cas).toContain("--release <cid>");
    expect(cas).toContain("--fetch <cid>");
    expect(cas).toContain("--all");
  });

  test("CONTROL: a flag the verb never carried stays off the line", async () => {
    const help = await bagHelp();
    const cas = help.split("\n").find((l) => /^\s+cas\s{2,}/.test(l)) ?? "";
    expect(cas).not.toContain("--prune");
  });
});
