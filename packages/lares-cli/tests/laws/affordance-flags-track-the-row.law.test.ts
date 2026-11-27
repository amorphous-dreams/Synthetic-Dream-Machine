/**
 * W2 · A CARRIER'S FLAGS EQUAL WHAT THE HANDLER READS (lar:///ha.ka.ba/kahua/memory/plan/cap-memes-lantern).
 *
 * Inputs: every cli route in the baked pack; the carrier's cli `takes` (its `#/takes` rows and the shared slots it calls,
 * minus args that skin other surfaces alone) against the door row's `accepts`, which `accepts-track-the-handlers` already
 * welds to the handler's own reads. So the carrier, the row and the handler agree, transitively. The MCP twin lives beside the
 * seat (`packages/lararium-sensorium/scripts/test_affordance_skin.py`). A door row's `accepts` names the flags of the whole door,
 * so a door of several verbs (`law index | pin | unpin`) holds the UNION of its routes' flags; a positional arg (`seat/N`) rides
 * no flag and stands outside it. Seed: the oracle cast and the law. Control: a carrier missing one flag disagrees with its row.
 *
 * Law: lar:///ha.ka.ba/lares/docs/pono/cli-test-laws#/the-laws
 */
import { describe, expect, test } from "vitest";
import { COMMANDS } from "../../src/bin/lares.js";
import { REBAKE, SEED_ADDRESS, cliRoutes, pack } from "./affordance-harness.js";

/** A door's carrier flags (the union over every route the door skins) and its row's accepts, both bare and sorted. */
function sides(door: string, takesOf: (address: string) => readonly string[] = (a) => pack().carriers[a]?.takes["cli"] ?? []): { carrier: string[]; row: string[] } {
  const flags = cliRoutes().filter((r) => r.door === door).flatMap((r) => takesOf(r.address));
  return {
    carrier: [...new Set(flags.map((f) => f.replace(/^--/, "")))].sort(),
    row: [...(COMMANDS.find((c) => c.name === door)?.accepts ?? [])].sort(),
  };
}

const DOORS = [...new Set(cliRoutes().map((r) => r.door))].sort();

describe("W2 · a door's carrier flags equal its row's accepts", () => {
  test("SEED: the oracle cast's carrier names its cli flags, and the law's three verbs name the door's four", () => {
    expect(pack().carriers[SEED_ADDRESS]?.takes["cli"]?.length ?? 0, `the pack holds no cli takes for the oracle cast; ${REBAKE}`).toBeGreaterThan(0);
    expect(sides("law").carrier, `the pack holds no law carriers; ${REBAKE}`).toEqual(["after", "all", "face", "limit"]);
    expect(sides("ddate").carrier).toEqual([]);   // the format and the date ride positionals, no flag
  });

  test.each(DOORS.map((d) => [d] as const))("`lares %s`", (door) => {
    const { carrier, row } = sides(door);
    expect(carrier).toEqual(row);
  });

  test("CONTROL: a carrier missing one flag disagrees with its row", () => {
    const { carrier, row } = sides("oracle", (a) => (pack().carriers[a]?.takes["cli"] ?? ["--recipe", "--asking"]).slice(1));
    expect(carrier).not.toEqual(row);
  });
});
