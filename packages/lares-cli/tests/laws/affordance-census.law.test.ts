/**
 * THE CENSUS RATCHET (lar:///ha.ka.ba/kahua/memory/plan/cap-memes-compass §4): flipped doors + legacy doors = the door count,
 * the legacy count only falls, and a door holds one home for its words, never two.
 *
 * A door FLIPS when every affordance it skins holds a carrier: the baked pack then carries its help (`doors.<door>`), and no
 * registry beside the pack holds its words. LEGACY_CEILING records the legacy count as it stands, and no commit may raise it.
 * The count reads zero: `command-help.ts` reads the pack alone, and no registry stands beside it. Seed: `oracle` flipped first, `ddate` and `law` with wave 1a, `act` · `ingest` · `export` · `import` · `shore` · `bag` · `flow` with wave 2, `kahua` · `trust` · `kapae` · `events` · `hooks` · `mcp` with wave 3a, `get` · `put` · `delete` · `rename` with the comms course's call shape (`get` chooses its carrier by the param a call names, so it claims no route of its own; its door gathers both choices), and the comms course's landings 10 + 23 the twenty-four doors whose every verb holds a carrier (`realm` · `herm` · `wear` · `library` · `vault` · `sensorium` · `mempalace` · `home` · `repo` · `cabal` · `circle` · `edge` · `fleet` · `handle` · `spirit` · `surface` · `rite` · `intent` · `intent-relay` · `lei` · `walk` · `host` · `persona` · `nexus`), and the [22 + 24] flip the last four part doors (`meme` · `wiki` · `sense` · `vessel`), whose seat carriers skin
 * the terminal now. Control: a census over a pack that flips nothing breaks the ceiling, and a door planted in a registry reads red.
 *
 * Law: lar:///ha.ka.ba/lares/docs/pono/cli-test-laws#/the-laws
 */
import { describe, expect, test } from "vitest";
import * as commandHelp from "../../src/command-help.js";
import { COMMAND_NAMES } from "../../src/bin/lares.js";
import { isCallHead } from "../../src/commands/call.js";

/** Every door: each COMMANDS row, and the one act's call head (`lares act lar:///<address> …`), which stands no row of its own. */
const DOOR_NAMES: readonly string[] = [...COMMAND_NAMES, ...["act"].filter((head) => isCallHead(head) && !COMMAND_NAMES.includes(head))];
import { REBAKE, pack } from "./affordance-harness.js";

/** The legacy count: zero, every door flipped. Never raise it. */
const LEGACY_CEILING = 0;

/** The four part doors the [22 + 24] flip took whole, their seat carriers skinned on the terminal. */
const PART_DOORS = ["meme", "wiki", "sense", "vessel"];

/** The doors landings 10 + 23 flipped whole. */
const FLIPPED_10_23 = ["realm", "herm", "wear", "library", "vault", "sensorium", "mempalace", "home", "repo", "cabal", "circle", "edge", "fleet", "handle", "spirit", "surface", "rite", "intent", "intent-relay", "lei", "walk", "host", "persona", "nexus"];

/** The words a registry beside the pack would hold: none stands, so every door keeps one home. */
const REGISTRY: Readonly<Record<string, unknown>> = {};

function census(flippedDoors: readonly string[], help: Readonly<Record<string, unknown>> = REGISTRY) {
  const flipped = DOOR_NAMES.filter((d) => flippedDoors.includes(d));
  const legacy = DOOR_NAMES.filter((d) => !flippedDoors.includes(d));
  const twoHomes = flipped.filter((d) => Object.keys(help).some((k) => k === d || k.startsWith(`${d} `)));
  const strays = flippedDoors.filter((d) => !DOOR_NAMES.includes(d));
  return { flipped, legacy, twoHomes, strays };
}

describe("the census ratchet: flipped + legacy = doors; legacy only falls; one home per door", () => {
  const c = census(Object.keys(pack().doors));

  test("SEED: oracle, ddate, law, wave 2's seven, wave 3a's six, the call verbs, landings 10 + 23's twenty-four and the last four part doors read flipped; no door reads legacy", () => {
    for (const door of ["oracle", "ddate", "law", "act", "ingest", "export", "import", "shore", "bag", "flow", "kahua", "trust", "kapae", "events", "hooks", "mcp", "get", "put", "delete", "rename", "watch", ...FLIPPED_10_23, ...PART_DOORS]) expect(c.flipped, `the pack flips no ${door} door; ${REBAKE}`).toContain(door);
    expect(c.legacy).toEqual([]);
    expect(Object.keys(pack().doors), `the burned tiddler door holds no pack entry; ${REBAKE}`).not.toContain("tiddler");
  });

  test("★ every door counts once, flipped or legacy ★", () => {
    expect(c.flipped.length + c.legacy.length).toBe(DOOR_NAMES.length);
    expect(c.strays).toEqual([]);
  });

  test("★ the legacy count never rises past its ceiling ★", () => {
    expect(c.legacy.length).toBeLessThanOrEqual(LEGACY_CEILING);
  });

  test("★ a flipped door keeps no legacy help entry: no registry stands ★", () => {
    expect(c.twoHomes).toEqual([]);
    expect(Object.keys(commandHelp), "command-help reads the pack alone").not.toContain("COMMAND_HELP");
  });

  test("CONTROL: a door in both homes, and a pack that flips nothing, each read red", () => {
    expect(census(["oracle"], { oracle: {} }).twoHomes).toEqual(["oracle"]);
    expect(census([]).legacy.length).toBeGreaterThan(LEGACY_CEILING);
  });
});
