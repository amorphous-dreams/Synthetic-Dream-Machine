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
