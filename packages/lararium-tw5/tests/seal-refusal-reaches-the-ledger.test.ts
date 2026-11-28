/** Seal refusals reach the face-wiki alert rail; absent a home wiki the answer names none. */
import { memoryWorkStore } from "./work-store-fixture.js";
import { describe, expect, test } from "vitest";

import { CompositeStore } from "@lararium/mesh/composite-store";
import { DAEMON_BAG_ID } from "@lararium/mesh/lar-uris";
import { wikiSlotUri } from "@lararium/mesh/wiki-recipe";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { makeWardAlertReactor, HOME_WIKI_TITLE } from "../src/index.js";
import type { DaemonMsg_WikiAlert } from "../src/index.js";

/** The face's daemon wiki's working layer: the face's home preference rests here, where only that face reads it. */
const DAEMON_WORKING = wikiSlotUri("daemon", "working");
const workingLayers = new WeakMap<CompositeStore, MemoryTiddlerStore>();

/** The daemon bag under the face wiki working layer. */
async function daemonStore(): Promise<CompositeStore> {
  const composite = new CompositeStore();
  composite.addLayer({ bagId: DAEMON_BAG_ID, store: new MemoryTiddlerStore(DAEMON_BAG_ID), writable: true });
  const working = new MemoryTiddlerStore(DAEMON_WORKING);
  composite.addLayer({ bagId: DAEMON_WORKING, store: working, writable: true });
  workingLayers.set(composite, working);
  controls.set(composite, memoryWorkStore());
  return composite;
}

/** The face writes its home preference into its daemon wiki's working layer, by name, and the record rests there alone. */
async function putHomePreference(composite: CompositeStore, slug: string): Promise<void> {
  await composite.put({ tiddler: { title: HOME_WIKI_TITLE, text: `[[${slug}]]` } }, { kind: "lares-verb", requestId: "pin" }, { bag: DAEMON_WORKING });
  expect(await workingLayers.get(composite)!.get(HOME_WIKI_TITLE), "the home preference rests in the daemon's working layer").toBeTruthy();
}

/** A state document stands beside each daemon store. */
const controls = new WeakMap<CompositeStore, CompositeStore>();
const controlFor = (composite: CompositeStore): CompositeStore => controls.get(composite)!;

describe("seal refusals reach the face-wiki alert", () => {
  test("without a home wiki the answer names none and no state row lands", async () => {
    const composite = await daemonStore();
    const posted: DaemonMsg_WikiAlert[] = [];
    const out = await react(composite, (m) => posted.push(m));
    expect(out.alerted).toBe("none");
    expect(posted).toEqual([]);
    expect(await controlFor(composite).listVisible()).toEqual([]);
  });
  test("the home wiki receives the seal refusal on the ward rail", async () => {
    const composite = await daemonStore();
    const posted: DaemonMsg_WikiAlert[] = [];
    await putHomePreference(composite, "home");
    const out = await react(composite, (m) => posted.push(m));
    expect(out.alerted).toBe("home");
    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({ wikiSlug: "home", kind: "disk-ward" });
    expect(posted[0]?.message).toMatch(/archive-seal.*does not open it/);
    expect(await controlFor(composite).listVisible()).toEqual([]);
  });

  /**
   * The loop body that FOLLOWS `anchor` in `src`, delimited by BRACE MATCHING rather than by a
   * character count. Returns null when the anchor or its block cannot be found.
   *
   * WHY THIS REPLACED A 900-CHARACTER WINDOW. The window was measured once, against one body, and
   * both of its failure directions were live: grow the loop past 900 chars and the weld reds with
   * nothing broken, and — the one that mattered — MOVE the ledger call out of the loop while leaving
   * anything matching inside the slack, and the weld goes GREEN over a loop that only warns to
   * stdout. Measured, not feared: gutting the loop to `console.warn` alone and parking a dead
   * `if (false)` branch carrying the same call ~100 chars later read `5 passed`. The brace match has
   * no slack to hide in — the window IS the block, so a relocation leaves the block and reds.
   */
  function blockAfter(src: string, anchor: string): string | null {
    const at = src.indexOf(anchor);
    if (at < 0) return null;
    const open = src.indexOf("{", at);
    if (open < 0) return null;
    let depth = 0;
    for (let i = open; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") { depth--; if (depth === 0) return src.slice(open, i + 1); }
    }
    return null;   // unbalanced — the caller reds rather than guessing
  }

  // ── THE WELD · the boot frame must SURFACE the door's refusals on the rail ───────────────────────
  // `persistArchiveFloor` DECIDES the refusals (Rail B: never raise from inside a reading) and the
  // boot frame surfaces them. A frame that quietly went back to `console.warn` would leave every
  // test above green and the operator with nothing, so the source is read.
  //
  // ⚠ A SOURCE-READING WELD PINS TEXT, NEVER BEHAVIOUR. What it can honestly pin is a STRUCTURAL
  // fact — "the ledger call sits INSIDE the refusal loop" — and that is what the brace match buys.
  // It still cannot see `fileWardRefusal` stop posting from the inside; the reds above this weld own
  // that, and this weld owns only the composition they restate.
  test("WELD — `operator-daemon-behavior` surfaces floor refusals on the ward-alert rail", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(
      new URL("../../lararium-keyhive/src/operator-daemon-behavior.ts", import.meta.url), "utf8",
    );
    const ANCHOR = "for (const r of floor.refusals)";
    // THE RENAME PIN. A weld that reads a token alone cannot tell "the field was renamed" from "the
    // loop was deleted", so it names the field it depends on out loud: `refusals` must stand on the
    // floor reading's own TYPE, where a rename lands loudly instead of silently unhooking the anchor.
    const floorType = readFileSync(
      new URL("../../lararium-keyhive/src/archive-floor-write.ts", import.meta.url), "utf8",
    );
    expect(floorType, "the `refusals` field this weld anchors on stands on the floor reading itself")
      .toMatch(/\brefusals\b/);
    const loop = blockAfter(src, ANCHOR);
    expect(loop, `the refusal-surfacing loop stands (anchor: ${ANCHOR})`).not.toBeNull();
    // NOT ONLY A WARN. stdout may stay — an operator at a terminal should see it — but the refusal
    // must ALSO reach the ward alert rail.
    expect(loop!, "the refusal rides Rail A, not stdout alone").toMatch(/fileWardRefusal\(ctx\.composite, stateOf\(ctx\), ctx\.post,/);
    expect(loop!, "and it names the seal, not the disk ward").toMatch(/wardKind:\s*"archive-seal"/);
    // AND THE CALL IS THE LOOP'S OWN, not a dead sibling the old window reached: exactly one such
    // call stands in the whole file, so it cannot be both inside the loop and duplicated outside it.
    expect([...src.matchAll(/fileWardRefusal\(ctx\.composite, stateOf\(ctx\), ctx\.post,[\s\S]{0,300}?wardKind:\s*"archive-seal"/g)].length,
      "exactly one archive-seal refusal call stands — a second would let one of them go dead unnoticed").toBe(1);
    // ONE BODY, TWO DOORS — the same act the registered "ward-alert" verb performs, never a second rail.
    expect(src).toMatch(/registry\.register\("ward-alert", makeWardAlertReactor\(ctx\.composite, ctx\.post\)\)/);
  });
});

/** The archive-seal refusal, as the boot frame files it. */
async function react(
  composite: CompositeStore,
  post: (m: DaemonMsg_WikiAlert) => void,
): Promise<Record<string, unknown>> {
  const reactor = makeWardAlertReactor(composite, post);
  return (await reactor({
    bagId:    DAEMON_BAG_ID,
    uri:      "lar:///ha.ka.ba/identity/keyhive-archive.bin",
    reason:   "the vessel key in hand does not open it",
    wardKind: "archive-seal",
  })) as Record<string, unknown>;
}
