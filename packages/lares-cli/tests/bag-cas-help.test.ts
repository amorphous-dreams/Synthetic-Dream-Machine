/**
 * `lares bag cas --help` NAMES EVERY DOOR THE VERB OPENS.
 *
 * The `cas` sub-verb carries flags (`--all` · `--fetch <cid>` · `--pin <cid>` · `--release <cid>` · `--sweep [--dry-run]`) and the
 * help line is the one place an operator reads them without opening the source. A flag the handler answers and the help omits is
 * a door with no sign on it: the sweep landed that way (c54f22b39 wired the verb, the summary kept the four it knew). The words
 * live in the carrier `lar:///carriage.bag.tends`, so the check reads the help the CLI PRINTS from the baked pack (`helpLines`),
 * never a transcription of it. CONTROL: a flag the verb never carried stays absent.
 */
import { describe, test, expect } from "vitest";
import { helpLines } from "../src/command-help.js";
import { cmdBag } from "../src/commands/bag.js";

const casHelp = (): string => helpLines("bag cas").join("\n");

async function bagHelp(): Promise<string> {
  const lines: string[] = [];
  const orig = console.log;
  console.log = (...a: unknown[]) => { lines.push(a.map(String).join(" ")); };
  try { await cmdBag({ command: "bag", positional: ["help"], options: {}, flags: {} }); }
  finally { console.log = orig; }
  return lines.join("\n");
}

describe("lares bag cas --help", () => {
  test("★ the cas usage names sweep= · dry-run= · pin=<cid> · release=<cid> · fetch=<cid> · all= ★", () => {
    const help = casHelp();
    const usage = help.split("\n").find((l) => l.startsWith("usage:")) ?? "";
    expect(usage, `no usage line in:\n${help}`).toContain("lares bag cas");
    for (const word of ["sweep=<true>", "dry-run=<true>", "pin=<cid>", "release=<cid>", "fetch=<cid>", "all=<true>"]) expect(usage).toContain(word);
  });

  test("`lares bag help` lists the door's verbs, one carrier each, and points at `--help` per verb", async () => {
    const help = await bagHelp();
    expect(help).toMatch(/lares bag cas\s{2,}/);
    expect(help).toContain("Read one: lares bag <verb> --help");
  });

  test("CONTROL: a flag the verb never carried stays off the line", () => {
    expect(casHelp()).not.toContain("--prune");
  });
});
