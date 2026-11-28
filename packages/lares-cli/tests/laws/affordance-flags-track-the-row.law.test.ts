/**
 * W2 · A CARRIER'S FLAGS EQUAL WHAT THE HANDLER READS (lar:///ha.ka.ba/kahua/memory/plan/cap-memes-lantern).
 *
 * Inputs: every cli route in the baked pack; the carrier's cli `takes` (its `#/takes` rows and the shared slots it calls,
 * minus args that skin other surfaces alone) against the door row's `accepts`, which `accepts-track-the-handlers` already
 * welds to the handler's own reads. So the carrier, the row and the handler agree, transitively. The MCP twin lives beside the
 * seat (`packages/lararium-sensorium/scripts/test_affordance_skin.py`). A door row's `accepts` names the flags of the whole door,
 * so a door of several verbs (`law index | pin | unpin`) holds the UNION of its routes' flags; a positional arg (`seat/N`) rides
 * no flag and stands outside it. A CALL-SHAPE door (`lares get · put · delete · rename`, comms-ux-enacts landing 8) reads no flag at
 * all: its row accepts nothing, and its carrier's cli takes spell `name=…` params, bound in the VM. Seed: the oracle cast and the
 * law. Control: a carrier missing one flag disagrees with its row.
 *
 * Law: lar:///ha.ka.ba/lares/docs/pono/cli-test-laws#/the-laws
 */
import { describe, expect, test } from "vitest";
import { COMMANDS } from "../../src/bin/lares.js";
import { cmdCall, isCallHead } from "../../src/commands/call.js";
import { REBAKE, SEED_ADDRESS, cliRoutes, pack, partDoors } from "./affordance-harness.js";

/**
 * A door's carrier flags (the union over every route the door skins) and its row's accepts, both bare and sorted. A part door
 * (one whose verbs some carrier leaves unskinned; none stands) would read each routed verb's own path (`pathAccepts`), since
 * its row's `accepts` would also name the flags of the verbs no carrier skins.
 */
function sides(door: string, takesOf: (address: string) => readonly string[] = (a) => pack().carriers[a]?.takes["cli"] ?? []): { carrier: string[]; row: string[] } {
  const routes = cliRoutes().filter((r) => r.door === door);
  const flags = routes.flatMap((r) => takesOf(r.address));
  const cmd = COMMANDS.find((c) => c.name === door);
  const row = partDoors().includes(door)
    ? routes.flatMap((r) => cmd?.pathAccepts?.({ command: door, positional: r.path, options: {}, flags: {} }) ?? cmd?.accepts ?? [])
    : cmd?.accepts ?? [];
  return {
    carrier: [...new Set(flags.map((f) => f.replace(/^--/, "")))].sort(),
    row: [...new Set(row)].sort(),
  };
}

/** The doors the call door answers: their lines take params alone. */
const CALL_DOORS = COMMANDS.filter((c) => c.handler === cmdCall).map((c) => c.name).sort();
/** The call heads with no COMMANDS row of their own (`act`, the one act): their lines take params alone too. */
const CALL_HEADS = [...new Set(cliRoutes().map((r) => r.door))].filter((d) => !COMMANDS.some((c) => c.name === d) && isCallHead(d)).sort();
const DOORS = [...new Set(cliRoutes().map((r) => r.door))].filter((d) => !CALL_DOORS.includes(d) && !CALL_HEADS.includes(d)).sort();

describe("W2 · a door's carrier flags equal its row's accepts", () => {
  test("SEED: the oracle cast's carrier names its cli flags, and the law's three verbs name the door's four", () => {
    expect(pack().carriers[SEED_ADDRESS]?.takes["cli"]?.length ?? 0, `the pack holds no cli takes for the oracle cast; ${REBAKE}`).toBeGreaterThan(0);
    expect(sides("law").carrier, `the pack holds no law carriers; ${REBAKE}`).toEqual(["after", "all", "face", "limit"]);
    expect(sides("ddate").carrier).toEqual([]);   // the format and the date ride positionals, no flag
  });

  test("★ a call-shape door's row accepts no flag, and its carriers' cli takes spell params, never flags ★", () => {
    expect(CALL_DOORS).toEqual(["delete", "get", "msg", "put", "rename", "watch"]);
    for (const door of CALL_DOORS) {
      expect(COMMANDS.find((c) => c.name === door)!.accepts, door).toEqual([]);
      const takes = cliRoutes().filter((r) => r.door === door).flatMap((r) => pack().carriers[r.address]?.takes["cli"] ?? []);
      expect(takes.filter((t) => t.startsWith("--")), `${door}: a carrier's cli takes spell a flag; ${REBAKE}`).toEqual([]);
    }
    expect(cliRoutes().map((r) => r.door), `the burned tiddler door routes nowhere; ${REBAKE}`).not.toContain("tiddler");
    // THE ONE ACT (landing 9): `act` stands no COMMANDS row, and every carrier it heads spells params, never flags.
    expect(CALL_HEADS, `the pack routes no act line; ${REBAKE}`).toEqual(["act"]);
    const actTakes = cliRoutes().filter((r) => r.door === "act").flatMap((r) => pack().carriers[r.address]?.takes["cli"] ?? []);
    expect(actTakes.length, REBAKE).toBeGreaterThan(0);
    expect(actTakes.filter((t) => t.startsWith("--")), `act: a carrier's cli takes spell a flag; ${REBAKE}`).toEqual([]);
  });

  test.each(DOORS.map((d) => [d] as const))("`lares %s`", (door) => {
    const { carrier, row } = sides(door);
    // A PART DOOR would read the verbs no carrier skins off its own table, so its row would name their flags too: every carried
    // flag sits in the row, and the two read equal once the door flips whole. Every door reads whole now (the census reads zero).
    if (partDoors().includes(door)) expect(carrier.filter((f) => !row.includes(f)), door).toEqual([]);
    else expect(carrier).toEqual(row);
  });

  test("CONTROL: a carrier missing one flag disagrees with its row", () => {
    const { carrier, row } = sides("oracle", (a) => (pack().carriers[a]?.takes["cli"] ?? ["--recipe", "--asking"]).slice(1));
    expect(carrier).not.toEqual(row);
  });
});
