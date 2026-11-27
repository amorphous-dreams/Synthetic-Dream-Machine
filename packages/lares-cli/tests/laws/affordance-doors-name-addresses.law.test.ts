/**
 * W1 · EVERY DOOR NAMES ONE ADDRESS, EVERY SKIN NAMES A LIVE DOOR (lar:///ha.ka.ba/kahua/memory/plan/cap-memes-lantern).
 *
 * Inputs: the baked pack's routes against the live tables: `COMMANDS` and each door's verb table (cli), the `@mcp.tool`
 * functions of the seat (mcp), the widget modules (tw5). A skin naming a door no table holds reads red; a flipped door whose
 * verbs some carrier leaves unrouted reads red (a door flips whole). Two carriers claiming one spelling refuse at the bake
 * (`affordance-door-claimed-twice`), before this law reads. Seed: `oracle cast` routes to lar:///oracle.library.consults.
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
import { flattenVerbs } from "../../src/verb-table.js";
import { REBAKE, SEED_ADDRESS, cliRoutes, pack } from "./affordance-harness.js";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const SEAT = readFileSync(join(REPO, "packages/lararium-sensorium/scripts/lares_mcp.py"), "utf8");
const SEAT_TOOLS = new Set([...SEAT.matchAll(/@mcp\.tool\([^\n]*\)\n\s*def (\w+)\(/g)].map((m) => m[1]!));

/** Every skin in a pack that names no live door: one line per orphan. */
function orphans(p: AffordancePack): string[] {
  const out: string[] = [];
  for (const r of cliRoutes(p)) {
    const cmd = COMMANDS.find((c) => c.name === r.door);
    if (!cmd) { out.push(`cli \`lares ${r.spelling}\`: no door "${r.door}"`); continue; }
    if (r.path.length === 0) continue;
    const tables = cmd.verbs === null ? [] : flattenVerbs(cmd.name, cmd.verbs);
    const at = tables.find((t) => t.door === [r.door, ...r.path.slice(0, -1)].join(" "));
    if (!at || !at.verbs.includes(r.path[r.path.length - 1]!)) out.push(`cli \`lares ${r.spelling}\`: the door's verb table holds no such verb`);
  }
  for (const tool of Object.keys(p.routes["mcp"] ?? {})) if (!SEAT_TOOLS.has(tool)) out.push(`mcp \`${tool}\`: the seat holds no such tool`);
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
    expect(routes["mcp"], REBAKE).toMatchObject({ ddate: "lar:///oracle.calendar.dates", law_index: "lar:///engine.law.indexes", law_pin: "lar:///engine.law.pins", law_unpin: "lar:///engine.law.unpins" });
  });

  test("SEED: wave 2's doors route each verb, an alias beside its twin, to a carrier", () => {
    const cli = pack().routes["cli"] ?? {};
    expect(cli["act ADD"], REBAKE).toBe("lar:///carriage.record.adds");
    expect(cli["act MOVE"], REBAKE).toBe("lar:///carriage.bag.moves");
    expect(cli["act"], REBAKE).toBe("lar:///carriage.draft.pulls");
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
    expect(pack().routes["mcp"], REBAKE).toMatchObject({ shore: "lar:///carriage.disk.reads", shore_flush: "lar:///carriage.disk.flushes", flow: "lar:///sense.record.flows" });
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
    expect(pack().routes["mcp"], REBAKE).toMatchObject({
      kahua_propose: "lar:///face.draft.proposes", kahua_stage: "lar:///face.draft.stages", kahua_get: "lar:///face.draft.reads",
      kapae: "lar:///sense.kapae.mutes", un_kapae: "lar:///sense.kapae.restores",
    });
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
    const planted: AffordancePack = { ...pack(), routes: { cli: { "zz-no-such-name cast": SEED_ADDRESS, "oracle zz-no-such-name": SEED_ADDRESS }, mcp: { zz_no_such_name: SEED_ADDRESS }, tw5: { "zz-no-such-name": SEED_ADDRESS } } };
    expect(orphans(planted)).toHaveLength(4);
  });
});
