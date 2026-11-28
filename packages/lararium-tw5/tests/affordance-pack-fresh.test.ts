/**
 * W3 · THE PACK EQUALS A FRESH BAKE (lar:///ha.ka.ba/kahua/memory/plan/cap-memes-lantern #/witness-laws).
 *
 * The pack bakes the CANON FLOOR a sleeping vessel answers from; a standing vessel reads routes, loops and cures from its own
 * live stack (comms-ux-enacts landing 3), so this witness holds the floor to canon and never the stack to the pack.
 *
 * Inputs: every canon carrier under `bags/` naming the affordance type tag. The tracked `affordance-pack.json` must equal the
 * bytes a fresh bake writes, and each entry's `bcc` the frame check of the carrier it baked; a hand-edited pack and a stale one
 * both read red, naming the cure. Seed: the oracle cast flipped first, so the pack holds `lar:///library.oracle.speaks`.
 * Control: a pack with one byte moved disagrees with the bake.
 *
 * Law: lar:///ha.ka.ba/lares/docs/pono/cli-test-laws
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { bccOf, headUriOf } from "@lararium/memetic-frame";
import { PACK_PATH, bakeAffordancePack, canonTexts, canonicalJson } from "../scripts/build-affordance-pack.js";
import { REPO, bootTestWiki, skipNote, wikiSkip } from "./test-wiki.js";
import { routesOf } from "../src/affordance-read.js";

/** Wave 2's carriers: `act` · `ingest` · `export` · `import` · `shore` · `bag` · `flow` (the same list the CLI laws seed on). */
const WAVE_2 = [
  "carriage.record.adds", "carriage.bag.copies", "carriage.bag.moves", "carriage.bag.clears", "carriage.bag.drops", "carriage.bag.loads",
  "carriage.bag.creates", "carriage.bundle.repacks", "carriage.draft.pulls", "carriage.capture.ingests", "carriage.bundle.exports",
  "carriage.bundle.imports", "carriage.disk.reads",
  "carriage.disk.restores", "carriage.disk.removes", "carriage.disk.settles", "face.hand.lifts", "carriage.disk.flushes", "carriage.disk.logs",
  "carriage.bag.reads", "carriage.bag.declares", "carriage.bag.homes", "carriage.bag.registers", "carriage.bag.cools", "carriage.bag.compacts",
  "carriage.bag.tends", "realm.bag.shares", "sense.record.flows",
];

/** Wave 3a's carriers: `kahua` · `trust` · `kapae` · `events` · `hooks` · `mcp`, with the seat's branch mute and restore. */
const WAVE_3A = [
  "face.key.mints", "face.draft.proposes", "face.draft.stages", "face.hand.withdraws", "face.carry.restands", "face.draft.reads",
  "carriage.draft.lifts", "realm.offer.reads", "realm.offer.prepares", "realm.offer.commits", "realm.offer.drops", "realm.offer.orphans",
  "realm.kapae.raises", "realm.kapae.lowers", "realm.kapae.flags", "engine.status.follows", "sense.capture.pauses", "sense.capture.resumes",
  "sense.capture.reads", "engine.seat.holds",
  "sense.kapae.mutes", "sense.kapae.restores",
];

const CURE = "re-bake: pnpm --filter @lararium/tw5 build (or tsx scripts/build-affordance-pack.ts), then commit affordance-pack.json";

describe.skipIf(wikiSkip)(`W3 · the tracked pack equals a fresh bake of canon${skipNote}`, () => {
  test("★ the pack's bytes equal a fresh bake ★", async () => {
    expect(existsSync(PACK_PATH), `affordance-pack-absent: ${PACK_PATH}; ${CURE}`).toBe(true);
    const fresh = canonicalJson(await bakeAffordancePack(canonTexts(path.join(REPO, "bags"))));
    expect(readFileSync(PACK_PATH, "utf8") === fresh, `affordance-pack-stale: ${CURE}`).toBe(true);
  }, 60_000);   // a whole-canon bake boots a wiki and renders every carrier: a loaded floor slot runs it past the 5 s default

  test("SEED: the oracle cast stands in the pack, its bcc the canon carrier's own frame check", () => {
    const pack = JSON.parse(readFileSync(PACK_PATH, "utf8")) as { carriers: Record<string, { title: string; bcc: string | null }> };
    const oracle = pack.carriers["lar:///library.oracle.speaks"];
    expect(oracle, `the pack holds no lar:///library.oracle.speaks; ${CURE}`).toBeDefined();
    const text = canonTexts(path.join(REPO, "bags")).find((t) => headUriOf(t) === oracle!.title);
    expect(text).toBeDefined();
    expect(oracle!.bcc).toBe(bccOf(text!));
  });

  test("RED: the consult carries its loop rows resolved, and the pack its shelves, so a vessel with no canon wiki still casts", () => {
    const pack = JSON.parse(readFileSync(PACK_PATH, "utf8")) as { carriers: Record<string, { loop?: string[] }>; shelves?: Record<string, { title: string; method: string }> };
    const loop = pack.carriers["lar:///library.oracle.speaks"]?.loop ?? [];
    expect(loop.map((l) => /name=`([^`]*)`/.exec(l)?.[1]), `the pack carries no consult loop; ${CURE}`).toEqual(["#/observe", "#/orient", "#/decide", "#/act", "#/hooko"]);
    expect(pack.shelves, `the pack carries no shelves; ${CURE}`).toMatchObject({
      "e-jing": { title: "lar:///ha.ka.ba/lares/library/oracles/e-jing/index", method: "three-coins" },
      doa: { title: "lar:///ha.ka.ba/lares/library/oracles/doa/index", method: "three-coins" },
    });
  });

  test("SEED: the calendar and the three law verbs stand in the pack, each bcc the canon carrier's own frame check", () => {
    const pack = JSON.parse(readFileSync(PACK_PATH, "utf8")) as { carriers: Record<string, { title: string; bcc: string | null }> };
    for (const address of ["oracle.calendar.dates", "engine.law.indexes", "engine.law.pins", "engine.law.unpins"]) {
      const carrier = pack.carriers[`lar:///${address}`];
      expect(carrier, `the pack holds no lar:///${address}; ${CURE}`).toBeDefined();
      const text = canonTexts(path.join(REPO, "bags")).find((t) => headUriOf(t) === carrier!.title);
      expect(text).toBeDefined();
      expect(carrier!.bcc).toBe(bccOf(text!));
    }
  });

  test("SEED: wave 2's thirty-two carriers stand in the pack, each bcc the canon carrier's own frame check", () => {
    const pack = JSON.parse(readFileSync(PACK_PATH, "utf8")) as { carriers: Record<string, { title: string; bcc: string | null }> };
    for (const address of [...WAVE_2, ...WAVE_3A]) {
      const carrier = pack.carriers[`lar:///${address}`];
      expect(carrier, `the pack holds no lar:///${address}; ${CURE}`).toBeDefined();
      const text = canonTexts(path.join(REPO, "bags")).find((t) => headUriOf(t) === carrier!.title);
      expect(text).toBeDefined();
      expect(carrier!.bcc).toBe(bccOf(text!));
    }
  });

  test("RED: the floor still matches canon: the pack's routes equal `routesOf` over canon's carriers, the rule the live stack reads by", async () => {
    const pack = JSON.parse(readFileSync(PACK_PATH, "utf8")) as { routes: Record<string, Record<string, string>> };
    const engine = await bootTestWiki();
    for (const text of canonTexts(path.join(REPO, "bags"))) {
      const uri = headUriOf(text);
      if (uri) engine.ingestCarrier(uri, text);
    }
    const textOf = (title: string): string | undefined => {
      const fields = (engine.wiki.getTiddler(title) as { fields?: Record<string, unknown> } | undefined)?.fields;
      return fields === undefined ? undefined : String(fields["text"] ?? "");
    };
    // Every title the canon engine holds, with no tag pre-filter: the stack's own reading (the skinless alias routes nothing).
    const live = routesOf(textOf, engine.wiki.filterTiddlers("[all[tiddlers]]"));
    expect(live.twice, "canon claims one spelling twice").toEqual([]);
    expect(live.routes, `the floor's routes drift from canon's; ${CURE}`).toEqual(pack.routes);
  }, 60_000);   // a whole-canon ingest boots a wiki

  test("CONTROL: one byte moved in the pack disagrees with the bake", async () => {
    const fresh = canonicalJson(await bakeAffordancePack(canonTexts(path.join(REPO, "bags"))));
    expect(fresh.replace("oracle", "orac1e") === fresh).toBe(false);
  }, 60_000);   // the same whole-canon bake
});
