/**
 * W3 · THE PACK EQUALS A FRESH BAKE (lar:///ha.ka.ba/kahua/memory/plan/cap-memes-lantern #/witness-laws).
 *
 * Inputs: every canon carrier under `bags/` naming the affordance type tag. The tracked `affordance-pack.json` must equal the
 * bytes a fresh bake writes, and each entry's `bcc` the frame check of the carrier it baked; a hand-edited pack and a stale one
 * both read red, naming the cure. Seed: the oracle cast flipped first, so the pack holds `lar:///oracle.cast.throws`.
 * Control: a pack with one byte moved disagrees with the bake.
 *
 * Law: lar:///ha.ka.ba/lares/docs/pono/cli-test-laws
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { bccOf, headUriOf } from "@lararium/memetic-frame";
import { PACK_PATH, bakeAffordancePack, canonTexts, canonicalJson } from "../scripts/build-affordance-pack.js";
import { REPO, skipNote, wikiSkip } from "./test-wiki.js";

const CURE = "re-bake: pnpm --filter @lararium/tw5 build (or tsx scripts/build-affordance-pack.ts), then commit affordance-pack.json";

describe.skipIf(wikiSkip)(`W3 · the tracked pack equals a fresh bake of canon${skipNote}`, () => {
  test("★ the pack's bytes equal a fresh bake ★", async () => {
    expect(existsSync(PACK_PATH), `affordance-pack-absent: ${PACK_PATH}; ${CURE}`).toBe(true);
    const fresh = canonicalJson(await bakeAffordancePack(canonTexts(path.join(REPO, "bags"))));
    expect(readFileSync(PACK_PATH, "utf8") === fresh, `affordance-pack-stale: ${CURE}`).toBe(true);
  });

  test("SEED: the oracle cast stands in the pack, its bcc the canon carrier's own frame check", () => {
    const pack = JSON.parse(readFileSync(PACK_PATH, "utf8")) as { carriers: Record<string, { title: string; bcc: string | null }> };
    const oracle = pack.carriers["lar:///oracle.cast.throws"];
    expect(oracle, `the pack holds no lar:///oracle.cast.throws; ${CURE}`).toBeDefined();
    const text = canonTexts(path.join(REPO, "bags")).find((t) => headUriOf(t) === oracle!.title);
    expect(text).toBeDefined();
    expect(oracle!.bcc).toBe(bccOf(text!));
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

  test("CONTROL: one byte moved in the pack disagrees with the bake", async () => {
    const fresh = canonicalJson(await bakeAffordancePack(canonTexts(path.join(REPO, "bags"))));
    expect(fresh.replace("oracle", "orac1e") === fresh).toBe(false);
  });
});
