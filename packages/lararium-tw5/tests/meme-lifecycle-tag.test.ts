/**
 * A GOVERNED MEME'S STAGE RIDES ONE TAG, AND THE TAG CARRIES ITS REASON BESIDE IT.
 *
 * WHY THIS GUARD EXISTS. Twelve implementation memes once carried one word — "proposed" — across
 * states that differ completely: a design ledger with no code, a core built and revert-verified with
 * one shore unlit, and a rite a person ENACTS where "built" is not a question that applies. The prose
 * in each was precise; the field had gone flat, so a reader scanning it learned nothing and a reader
 * trusting it learned wrong. Nine words rode that field before the collapse — approved, canon, draft,
 * working-draft, enacting, active, proposed among them — each drifted in reasonably and alone, and
 * together they answered three different questions at once. A reader had to know WHICH question a
 * given word answered before the answer meant anything.
 *
 * THE VOCABULARY IS CLOSED AND IT RIDES `tags`. Five stages — designed · standing · folded · harvest ·
 * retiring — spelled `lifecycle/<stage>`, on the mechanism TiddlyWiki already indexes, so a filter
 * answers the stage in the wiki and the stage RENDERS. A KIND rides beside it (`kind/rite`): a rite is
 * convened rather than built, so build-state is not a property it could hold, and seating it as a rung
 * made a completed practice read as a way-station.
 *
 * GOVERNED IS THE NARROW CASE. A carrier writing no `lifecycle/*` tag stands UNGOVERNED — a law, a
 * record, a reference, a fiction-canon concept — and this guard asks nothing of it. The ladder stays
 * cheap to decline, which is why the shelf can afford to mean something by standing on it.
 *
 * AND EVERY STAGE CARRIES ITS REASON. `status-why` sits beside the tag so the field cannot drift from
 * the prose again without the drift being visible — a bare word is exactly what went flat the first time.
 *
 * SCOPE: the whole memegraph, both bags. The pono canon and the implementation bag answer the same
 * question about their own subjects, so they answer it in the same words.
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { carrierFiles } from "../src/carrier-files.js";
import { LIFECYCLE_STAGES, readCarrierLifecycle, readCarrierTags } from "../src/carrier-lifecycle.js";

const REPO = resolve(__dirname, "../../..");

function memegraph(): string[] {
  return carrierFiles(REPO).filter((f) => f.endsWith(".mem"));
}

function read(rel: string): string | null {
  try { return readFileSync(resolve(REPO, rel), "utf8"); } catch { return null; }
}

describe("the lifecycle tag carries a stage that differs, and its reason", () => {
  const files = memegraph();

  test("the walk finds memes to check", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  /**
   * THE KEYS THE TAG REPLACED. `status` fused a KIND axis into a STAGE axis; `retain` carried a
   * disposition office nothing ever read. Both retire to one spelling, and a carrier still writing
   * either reads as a carrier the sweep has not reached.
   */
  /**
   * THE HOLD IS NAMED, REASONED, AND SHRINKS ONLY. Three carriers stand outside the sweep, each for a
   * reason a reader can act on — never "these are hard". Two sit under another hand's edit this watch,
   * and rewriting a file a second hand holds open is how a sweep manufactures a conflict out of a
   * one-line change. The third states a collision the operator has yet to rule: it reads `standing`
   * while holding five open leans whose blockers its own `status-why` names as measured and held — the
   * design admits exactly that case ("unless `status-why` names it as held-open with its blocker") and
   * no mechanical spelling of the exception stands yet. Inventing one would be a ruling wearing a
   * sweep's clothes. A hold that grew would stop measuring anything; this one may only lose entries.
   */
  /**
   * BOTH "another hand this watch" ENTRIES RETIRED 2026-09-13 — deleted, never widened, the way the
   * house retires a self-clearing exception. That watch closed: the hand was the meme hearth and the
   * operator closed it (`docs/pono/hearths.mem`).
   *
   * `scale-stories-basket-one.mem` — its last held lean, the heraldry read, landed at `96fac1df9`; the
   * carrier now takes `lifecycle/standing` and both retired keys came out with this entry.
   *
   * `heraldry.mem` — ALREADY swept, at `58d47f09b`, and the entry outlived the sweep. The CONTROL below
   * was RED against the tree before this edit, saying exactly that: //swept; drop the entry//. A hold is
   * meant to shrink on its own, and this is the shrink; the red proves the CONTROL measures.
   *
   * The lesson the pair leaves: a hold entry carries TWO facts — that the carrier still writes a retired
   * key, and WHY it stands outside the sweep. The CONTROL checks the first and cannot check the second,
   * so a reason like "this watch" outlives the watch silently while the entry still reads green.
   */
  const HELD_OUTSIDE_THE_SWEEP: ReadonlyArray<readonly [string, string]> = [
    [
      "bags/lares/ha.ka.ba/lares/docs/pono/syncer-back-parity.mem",
      "reads standing while holding five leans its own status-why names as held with their blockers — awaiting the operator's ruling on whether a witness sentence may carry that exception",
    ],
  ];

  test("no meme still writes the retired keys, but for the named hold", () => {
    const held = new Set(HELD_OUTSIDE_THE_SWEEP.map(([f]) => f));
    const still: string[] = [];
    for (const rel of files) {
      const src = read(rel);
      if (!src) continue;
      const keys = readCarrierLifecycle(src).retiredKeys;
      if (keys.length > 0 && !held.has(rel)) still.push(`${rel} → ${keys.join(", ")}`);
    }
    expect(still, `these still write a retired key — the stage rides tags:\n  ${still.join("\n  ")}`).toEqual([]);
  });

  /**
   * CONTROL — a hold entry whose carrier has since been swept is a stale entry, and a stale hold is
   * indistinguishable from a growing one. Each entry must still be TRUE.
   */
  test("CONTROL — every held carrier still carries what the hold says it does", () => {
    const stale: string[] = [];
    for (const [rel, why] of HELD_OUTSIDE_THE_SWEEP) {
      const src = read(rel);
      if (src === null) { stale.push(`${rel} — gone; drop the entry (${why})`); continue; }
      if (readCarrierLifecycle(src).retiredKeys.length === 0) stale.push(`${rel} — swept; drop the entry`);
    }
    expect(stale, `\n  ${stale.join("\n  ")}`).toEqual([]);
  });

  test("a meme declaring a stage carries its reason beside it", () => {
    const bare: string[] = [];
    let governed = 0;
    for (const rel of files) {
      const src = read(rel);
      if (!src) continue;
      const stage = readCarrierLifecycle(src).stage;
      if (stage === null) continue;
      governed++;
      const why = /^status-why\s*=\s*"([^"]*)"/m.exec(src)?.[1];
      if (!why || why.length < 8) bare.push(`${rel} → stage "${stage}" with no reason beside it`);
    }
    expect(bare, `\n  ${bare.join("\n  ")}`).toEqual([]);
    // An empty walk would pass vacuously — the same silence the flat field fell into.
    expect(governed).toBeGreaterThan(8);
  });

  test("the vocabulary stays closed — a sixth stage cannot drift back in", () => {
    const strays: string[] = [];
    const census = new Map<string, number>();
    for (const rel of files) {
      const src = read(rel);
      if (!src) continue;
      for (const tag of readCarrierTags(src)) {
        if (!tag.startsWith("lifecycle/")) continue;
        const stage = tag.slice("lifecycle/".length);
        census.set(stage, (census.get(stage) ?? 0) + 1);
        if (!(LIFECYCLE_STAGES as readonly string[]).includes(stage)) strays.push(`${rel} → "${tag}"`);
      }
    }
    expect(strays, `a stage outside the five drifted in:\n  ${strays.join("\n  ")}`).toEqual([]);
    console.log(`\n[meme-lifecycle] ` + [...census].map(([k, n]) => `${k}×${n}`).join(" · "));
  });

  /**
   * CONTROL — the shelf overwhelmingly DECLINES the ladder, and must keep being able to. A guard that
   * drifted toward requiring a stage would fault a reference table for not entering a lifecycle.
   */
  test("CONTROL — the great majority of the shelf stands ungoverned", () => {
    const governed = files.filter((rel) => {
      const src = read(rel);
      return src !== null && readCarrierLifecycle(src).stage !== null;
    });
    expect(governed.length).toBeLessThan(files.length / 2);
  });
});
