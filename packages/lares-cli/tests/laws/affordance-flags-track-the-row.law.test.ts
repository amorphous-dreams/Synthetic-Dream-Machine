/**
 * W2 · A CARRIER'S FLAGS EQUAL WHAT THE HANDLER READS (lar:///ha.ka.ba/kahua/memory/plan/cap-memes-lantern).
 *
 * Inputs: every cli route in the baked pack; the carrier's cli `takes` (its `#/takes` rows and the shared slots it calls,
 * minus args that skin other surfaces alone) against the door row's `accepts`, which `accepts-track-the-handlers` already
 * welds to the handler's own reads. So the carrier, the row and the handler agree, transitively. The MCP twin lives beside the
 * seat (`packages/lararium-sensorium/scripts/test_affordance_skin.py`). Seed: the oracle cast. Control: a carrier missing one
 * flag disagrees with its row.
 *
 * Law: lar:///ha.ka.ba/lares/docs/pono/cli-test-laws#/the-laws
 */
import { describe, expect, test } from "vitest";
import { COMMANDS } from "../../src/bin/lares.js";
import { REBAKE, SEED_ADDRESS, cliRoutes, pack } from "./affordance-harness.js";

/** A carrier's cli flags and its door row's accepts, both bare and sorted. */
function sides(address: string, door: string, takes?: readonly string[]): { carrier: string[]; row: string[] } {
  const flags = takes ?? pack().carriers[address]?.takes["cli"] ?? [];
  return {
    carrier: [...flags].map((f) => f.replace(/^--/, "")).sort(),
    row: [...(COMMANDS.find((c) => c.name === door)?.accepts ?? [])].sort(),
  };
}

describe("W2 · a carrier's cli flags equal its door row's accepts", () => {
  test("SEED: the oracle cast's carrier names its cli flags", () => {
    expect(pack().carriers[SEED_ADDRESS]?.takes["cli"]?.length ?? 0, `the pack holds no cli takes for the oracle cast; ${REBAKE}`).toBeGreaterThan(0);
  });

  test.each(cliRoutes().map((r) => [r.spelling, r.address, r.door] as const))("`lares %s`", (_spelling, address, door) => {
    const { carrier, row } = sides(address, door);
    expect(carrier).toEqual(row);
  });

  test("CONTROL: a carrier missing one flag disagrees with its row", () => {
    const takes = pack().carriers[SEED_ADDRESS]?.takes["cli"] ?? ["--recipe", "--asking"];
    const { carrier, row } = sides(SEED_ADDRESS, "oracle", takes.slice(1));
    expect(carrier).not.toEqual(row);
  });
});
