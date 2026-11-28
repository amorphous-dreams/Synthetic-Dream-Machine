/**
 * W1 · EVERY DOOR NAMES ONE ADDRESS, EVERY SKIN NAMES A LIVE DOOR (lar:///ha.ka.ba/kahua/memory/plan/cap-memes-lantern).
 *
 * Inputs: the baked pack's routes against the live tables: `COMMANDS` and each door's verb table, or the call door's `act`
 * head with the address it names (cli), the `@mcp.tool` functions of the seat, `act` with the address it names (mcp), the
 * widget modules (tw5). A skin naming a door no table holds reads red; a flipped door whose
 * verbs some carrier leaves unrouted reads red (a door flips whole; a `door/part` skin gathers no door entry, so its door keeps
 * its own table and counts legacy until every verb holds a carrier). Two carriers claiming one spelling refuse at the bake
 * (`affordance-door-claimed-twice`), before this law reads. Seed: `oracle cast` routes to lar:///library.oracle.speaks.
 * Control: a planted orphan skin reads red.
 *
 * Law: lar:///ha.ka.ba/lares/docs/pono/cli-test-laws#/the-laws
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import type { AffordancePack } from "@lararium/tw5/affordance-pack";
import { COMMANDS } from "../../src/bin/lares.js";
import { isCallHead } from "../../src/commands/call.js";
import { flattenVerbs } from "../../src/verb-table.js";
import { REBAKE, SEED_ADDRESS, cliRoutes, pack, partDoors } from "./affordance-harness.js";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const SEAT = readFileSync(join(REPO, "packages/lararium-sensorium/scripts/lares_mcp.py"), "utf8");
const SEAT_TOOLS = new Set([...SEAT.matchAll(/@mcp\.tool\([^\n]*\)\n\s*def (\w+)\(/g)].map((m) => m[1]!));

/** Every skin in a pack that names no live door: one line per orphan. */
function orphans(p: AffordancePack): string[] {
  const out: string[] = [];
  for (const r of cliRoutes(p)) {
    const cmd = COMMANDS.find((c) => c.name === r.door);
    // THE ONE ACT (landing 9): `lares act lar:///<address>` rides the call door's `act` head, which no command row carries.
    if (!cmd && isCallHead(r.door, r.path) && r.path.join(" ") === r.address) continue;
    if (!cmd) { out.push(`cli \`lares ${r.spelling}\`: no door "${r.door}"`); continue; }
    if (r.path.length === 0) continue;
    const tables = cmd.verbs === null ? [] : flattenVerbs(cmd.name, cmd.verbs);
    const at = tables.find((t) => t.door === [r.door, ...r.path.slice(0, -1)].join(" "));
    if (!at || !at.verbs.includes(r.path[r.path.length - 1]!)) out.push(`cli \`lares ${r.spelling}\`: the door's verb table holds no such verb`);
  }
  // An mcp spelling names a seat tool (`put`), or the one act and the address it reaches (`act lar:///<address>`).
  for (const [spelling, address] of Object.entries(p.routes["mcp"] ?? {})) {
    const [head, ...rest] = spelling.split(/\s+/);
    if (!SEAT_TOOLS.has(head!)) out.push(`mcp \`${spelling}\`: the seat holds no such tool`);
    else if (head === "act" && rest.join(" ") !== address) out.push(`mcp \`${spelling}\`: the act names another address than ${address}`);
  }
  for (const widget of Object.keys(p.routes["tw5"] ?? {})) {
    if (!existsSync(join(REPO, "packages/lararium-tw5/src/widgets", `${widget}.ts`))) out.push(`tw5 \`${widget}\`: no widget module`);
  }
  return out;
}

describe("W1 · every door names one address; every skin names a live door", () => {
  test("SEED: the oracle cast's cli skin routes to its address", () => {
    expect(pack().routes["cli"]?.["oracle cast"], `the pack routes no \`oracle cast\`; ${REBAKE}`).toBe(SEED_ADDRESS);
  });

  test("SEED: the calendar and the law verbs route to their carriers", () => {
    const routes = pack().routes;
    expect(routes["cli"]?.["ddate"], REBAKE).toBe("lar:///oracle.calendar.dates");
    expect(routes["cli"]?.["law index"], REBAKE).toBe("lar:///engine.law.indexes");
    expect(routes["cli"]?.["law pin"], REBAKE).toBe("lar:///engine.law.pins");
    expect(routes["cli"]?.["law unpin"], REBAKE).toBe("lar:///engine.law.unpins");
    for (const address of ["lar:///oracle.calendar.dates", "lar:///engine.law.indexes", "lar:///engine.law.pins", "lar:///engine.law.unpins"]) {
      expect(routes["mcp"]?.[`act ${address}`], REBAKE).toBe(address);
    }
  });

  test("SEED: wave 2's doors route each verb, an alias beside its twin, to a carrier", () => {
    const cli = pack().routes["cli"] ?? {};
    expect(cli["act lar:///carriage.record.adds"], REBAKE).toBe("lar:///carriage.record.adds");
    expect(cli["act lar:///carriage.bag.moves"], REBAKE).toBe("lar:///carriage.bag.moves");
    expect(cli["act lar:///carriage.draft.pulls"], REBAKE).toBe("lar:///carriage.draft.pulls");
    expect(cli["ingest"], REBAKE).toBe("lar:///carriage.capture.ingests");
    expect(cli["export"], REBAKE).toBe("lar:///carriage.bundle.exports");
    expect(cli["import"], REBAKE).toBe("lar:///carriage.bundle.imports");
    expect(cli["shore take-records"], REBAKE).toBe("lar:///carriage.record.wins");
    expect(cli["shore keep-records"], REBAKE).toBe("lar:///carriage.record.wins");
    expect(cli["shore take-disk"], REBAKE).toBe("lar:///carriage.disk.wins");
    expect(cli["shore keep-disk"], REBAKE).toBe("lar:///carriage.disk.wins");
    expect(cli["shore flush"], REBAKE).toBe("lar:///carriage.disk.flushes");
    expect(cli["bag compact"], REBAKE).toBe("lar:///carriage.bag.compacts");
    expect(cli["bag share"], REBAKE).toBe("lar:///realm.bag.shares");
    expect(cli["flow"], REBAKE).toBe("lar:///sense.record.flows");
    for (const address of ["lar:///carriage.disk.reads", "lar:///carriage.disk.flushes", "lar:///sense.record.flows"]) {
      expect(pack().routes["mcp"]?.[`act ${address}`], REBAKE).toBe(address);
    }
  });

  test("SEED: wave 3a's doors route each verb to a carrier, the two lifts apart", () => {
    const cli = pack().routes["cli"] ?? {};
    expect(cli["kahua mint"], REBAKE).toBe("lar:///face.key.mints");
    expect(cli["kahua propose"], REBAKE).toBe("lar:///face.draft.proposes");
    expect(cli["kahua stage"], REBAKE).toBe("lar:///face.draft.stages");
    expect(cli["kahua lift"], REBAKE).toBe("lar:///face.hand.lifts");
    expect(cli["shore lift-kahua"], REBAKE).toBe("lar:///carriage.draft.lifts");
    expect(cli["kahua withdraw"], REBAKE).toBe("lar:///face.hand.withdraws");
    expect(cli["kahua carry"], REBAKE).toBe("lar:///face.carry.restands");
    expect(cli["kahua get"], REBAKE).toBe("lar:///face.draft.reads");
    expect(cli["trust list"], REBAKE).toBe("lar:///realm.offer.reads");
    expect(cli["trust orphan"], REBAKE).toBe("lar:///realm.offer.orphans");
    expect(cli["kapae raise"], REBAKE).toBe("lar:///realm.kapae.raises");
    expect(cli["kapae flag"], REBAKE).toBe("lar:///realm.kapae.flags");
    expect(cli["events"], REBAKE).toBe("lar:///engine.status.follows");
    expect(cli["hooks pause"], REBAKE).toBe("lar:///sense.capture.pauses");
    expect(cli["hooks status"], REBAKE).toBe("lar:///sense.capture.reads");
    expect(cli["mcp aho"], REBAKE).toBe("lar:///engine.seat.holds");
    for (const address of ["lar:///face.draft.proposes", "lar:///face.draft.stages", "lar:///face.draft.reads",
      "lar:///sense.kapae.mutes", "lar:///sense.kapae.restores"]) {
      expect(pack().routes["mcp"]?.[`act ${address}`], REBAKE).toBe(address);
    }
  });

  test("SEED: the call verbs route to their carriers on both skins; `get` chooses by param and the burned spellings route nowhere", () => {
    const routes = pack().routes;
    expect(routes["cli"], REBAKE).toMatchObject({
      put: "lar:///engine.record.puts", delete: "lar:///engine.record.removes", rename: "lar:///engine.record.renames",
    });
    // `get` skins two carriers (`by/title`, the default, and `by/filter`): a shared word claims no route of its own.
    expect(routes["cli"]?.["get"], REBAKE).toBeUndefined();
    for (const burned of ["tiddler get", "tiddler put", "tiddler delete", "tiddler rename", "wiki filter"]) expect(routes["cli"]?.[burned], `${burned}; ${REBAKE}`).toBeUndefined();
    expect(routes["mcp"], REBAKE).toMatchObject({
      put: "lar:///engine.record.puts", delete: "lar:///engine.record.removes", rename: "lar:///engine.record.renames",
    });
    // The seat's `get` skins both read carriers by the same `by/` choice the terminal's does, so it claims no route either.
    expect(routes["mcp"]?.["get"], REBAKE).toBeUndefined();
    expect(pack().doors["tiddler"], REBAKE).toBeUndefined();
    expect(pack().doors["wiki"], "the wiki door keeps its own table").toBeUndefined();
    // FOUR DOORS HOLD `door/part` SKINS beside their own tables (comms course landings 10 + 23): `meme`, `wiki` and `sense` keep
    // the verbs landing 9's carriers own (engine.meme.projects, realm.offer.signs · shows, engine.layer.reads, engine.wiki.*,
    // render.sidebar.lays, the sense.* reads) until those carriers take their cli skins, and `vessel` keeps `roster` until
    // face.roster.reads takes it. Each flips whole in the commit that routes its last verb, and leaves this list then.
    expect(partDoors(), "the part doors wait on landing 9's cli skins").toEqual(["meme", "sense", "vessel", "wiki"]);
  });

  test("★ every skin in the pack names a door a live table holds ★", () => {
    expect(orphans(pack())).toEqual([]);
  });

  test("a flipped door flips whole: every verb its table answers routes to a carrier", () => {
    const unrouted = Object.keys(pack().doors).flatMap((door) => {
      const cmd = COMMANDS.find((c) => c.name === door);
      const verbs = cmd?.verbs === null || cmd === undefined ? [] : flattenVerbs(door, cmd.verbs).find((t) => t.door === door)?.verbs ?? [];
      return verbs.filter((v) => v !== "help" && pack().routes["cli"]?.[`${door} ${v}`] === undefined).map((v) => `${door} ${v}`);
    });
    expect(unrouted).toEqual([]);
  });

  test("CONTROL: a planted orphan skin on each surface reads red", () => {
    const planted: AffordancePack = { ...pack(), routes: { cli: { "zz-no-such-name cast": SEED_ADDRESS, "oracle zz-no-such-name": SEED_ADDRESS }, mcp: { zz_no_such_name: SEED_ADDRESS, "act lar:///zz.no.such": SEED_ADDRESS }, tw5: { "zz-no-such-name": SEED_ADDRESS } } };
    expect(orphans(planted)).toHaveLength(5);
  });
});
