/**
 * L · A SUB-PATH NARROWS ITS DOOR, NEVER WIDENS IT: every `pathAccepts` result stays inside its door's `accepts`.
 *
 * `pathAccepts` replaces the door's row for the path on the line (`unknownFlags` reads it in place of `accepts`). A name it
 * returns that the row never declares would ride past the door's own audit (accepts-track-the-handlers reads the row, not the
 * path), so a path could grow a flag no law ever counted. The probe drives each narrowing row over every first word its paths
 * branch on, every flag its row declares and every lens its sense fold reads; each answer is null (the whole row) or a subset.
 * Control: a row whose path returns a name outside its row reads red.
 *
 * Law: lar:///ha.ka.ba/lares/docs/pono/cli-test-laws#/the-laws
 */
import { describe, expect, test } from "vitest";
import { COMMANDS, type Command } from "../../src/bin/lares.js";
import { SENSE_LENSES, SENSE_LENS_ALIASES } from "../../src/commands/sense-analyze.js";
import type { ParsedArgs } from "../../src/parse-args.js";

/** The first words a narrowing row branches on, the sense fold's verbs, and a sensorium name leading them. */
const HEADS = [undefined, "request", "raise-sign", "list", "analyze", "pour", "roster", "holders", "search", "render", "filter", "status", "act", "other"];
const LENSES = [undefined, "zz-no-such-lens", ...Object.keys(SENSE_LENSES), ...Object.keys(SENSE_LENS_ALIASES)];

function probes(cmd: Command): ParsedArgs[] {
  const out: ParsedArgs[] = [];
  for (const head of HEADS) {
    const tails = head === "other" ? [["analyze"], ["pour"], ["roster"]] : [[]];
    for (const tail of tails) {
      const positional = [...(head === undefined ? [] : [head]), ...tail];
      for (const flag of [undefined, ...cmd.accepts]) {
        for (const lens of LENSES) {
          out.push({
            command: cmd.name, positional,
            options: lens === undefined ? {} : { lens },
            flags: flag === undefined ? {} : { [flag]: true },
          });
        }
      }
    }
  }
  return out;
}

/** Each probe's answer names outside the row, as `door · path · name`. */
function escapes(cmd: Command): string[] {
  if (cmd.pathAccepts === undefined) return [];
  const row = new Set(cmd.accepts);
  const out = new Set<string>();
  for (const a of probes(cmd)) {
    for (const n of cmd.pathAccepts(a) ?? []) {
      if (!row.has(n)) out.add(`${cmd.name} · ${a.positional.join(" ") || "(bare)"} · --${n}`);
    }
  }
  return [...out];
}

describe("every pathAccepts answer stays inside its door's accepts", () => {
  test("the narrowing rows exist to be read (sense among them)", () => {
    const narrowing = COMMANDS.filter((c) => c.pathAccepts !== undefined).map((c) => c.name);
    expect(narrowing.length).toBeGreaterThan(3);
    expect(narrowing).toContain("sense");
  });

  test.each(COMMANDS.filter((c) => c.pathAccepts !== undefined).map((c) => [c.name, c] as const))(
    "`%s`: no path answers a flag its row never declares", (_name, cmd) => {
      expect(escapes(cmd)).toEqual([]);
    });

  test("CONTROL: a path answering a name outside its row reads red", () => {
    const sense = COMMANDS.find((c) => c.name === "sense")!;
    const widened: Command = { ...sense, pathAccepts: (a) => [...(sense.pathAccepts?.(a) ?? []), "zz-not-in-the-row"] };
    expect(escapes(widened).length).toBeGreaterThan(0);
  });
});
