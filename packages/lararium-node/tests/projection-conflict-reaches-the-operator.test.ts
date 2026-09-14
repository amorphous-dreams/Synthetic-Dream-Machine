/**
 * projection-conflict-reaches-the-operator — THE WIRE, not the gate.
 *
 * `projection-conflict-surfaces` pins the pure decision law. This file measures the
 * other half: that `LarDiskProjector.flush` actually CONSULTS it, that a standoff
 * reaches the operator instead of being logged and forgotten, and — the control that
 * matters most — that the `≈` clause does not turn the gate into a rubber stamp.
 *
 * Three states, driven through the real projector against a real temp mirror:
 *   1. a GENUINE standoff (disk and records both moved, and they say DIFFERENT things)
 *      → nothing written, the operator's bytes intact, `onConflict` fired ONCE.
 *   2. the ORDINARY round trip (the streams say the SAME thing, framing apart)
 *      → the write LANDS, normalizing, and `onConflict` never fires.
 *   3. the same standoff with NO canonicalizer injected
 *      → still a conflict. Absent is not equivalent; a projector mounted without the
 *        view fails CLOSED, surfacing what it cannot resolve rather than writing over it.
 *
 * And a fifth, measured rather than assumed: the injected view is the MEMETIC congruence,
 * so it reaches a `.mem` carrier and NOTHING ELSE. A native filetype's standoff therefore
 * reads `conflict` — fail-closed, and a change from the pre-gate projector, which wrote
 * through it. A native congruence (the ingest leg already takes one per family) is what
 * would lift that; until one is passed, the native shore surfaces instead of overwriting.
 *
 * The congruence here is a stand-in, not the memetic one: these vectors measure the
 * PLUMBING (does the view reach the gate, does the verdict reach disk and the operator),
 * and a stand-in makes "say the same thing" and "say different things" separable by
 * construction. `canonicalizeCarrierText` itself is measured in
 * `projection-conflict-surfaces`, over the real corpus.
 */

import { describe, test, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { carrierHash } from "@lararium/mesh";
import { MEME_EXT } from "@lararium/mesh/mirror-paths";
import { LarDiskProjector } from "../src/disk-projector.js";
import { SyncedTree, syncedTreeKey } from "../src/synced-tree.js";
import type { TW5Engine } from "@lararium/tw5";

let root = "";
afterEach(() => { if (root) { rmSync(root, { recursive: true, force: true }); root = ""; } });

const BAG = "lares";
const URI = "lar:///ha.ka.ba/probe/carrier";
const REL = "ha.ka.ba/probe/carrier.mem";
/** The NATIVE shore's path — a filetype the memetic congruence does not read. */
const REL_TID = "ha.ka.ba/probe/carrier.tid";

/** The records' render — what the projector would write. */
const RECORDS_RENDER = "title: records\n\nTHE SAME THING, canonically framed\n";
/** What the operator's hands left: the same MEANING, different framing. */
const DISK_FRAMED    = "title: records\n\n   THE SAME THING, canonically framed   \n";
/** What the operator's hands left in the standoff: a different MEANING. */
const DISK_DIVERGED  = "title: records\n\nSOMETHING ELSE ENTIRELY\n";

function fakeEngine(): TW5Engine {
  return {
    $tw: {
      wiki: {
        getTiddler: (title: string) =>
          title === URI ? { fields: { title: URI, "$origin-bag": BAG } } : undefined,
        addEventListener: () => {},
        removeEventListener: () => {},
      },
    },
  } as unknown as TW5Engine;
}

function reconcile(p: LarDiskProjector, uri: string): Promise<void> {
  return (p as unknown as { reconcile: (u: string) => Promise<void> }).reconcile(uri);
}

/**
 * A stand-in congruence: collapse leading/trailing whitespace per line. Two texts that
 * differ only in framing collapse to one canonical text; a text that says something else
 * does not. Exactly the separation the gate's `≈` needs, with no grammar in the way.
 */
const collapseFraming = (_uri: string, text: string): string =>
  text.split("\n").map((l) => l.trim()).join("\n");

/** One projector over a fresh mirror, a LIVE anchor, and whatever disk bytes stand. */
function stand(diskBody: string, opts: { canonicalize: boolean }): {
  projector: LarDiskProjector;
  stop: () => void;
  conflicts: Array<{ bagId: string; uri: string; reason: string }>;
  abs: string;
  tree: SyncedTree;
} {
  root = mkdtempSync(join(tmpdir(), "lar-confl-"));
  const abs = join(root, REL);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, diskBody, "utf-8");

  // THE MERGE BASE IS LIVE AND STALE — the last projection, which BOTH streams have
  // since moved past. That is the only state clause 7 can reach.
  const tree = new SyncedTree(join(root, ".projection", "synced-tree.json"), 0);
  tree.set(syncedTreeKey(BAG, URI), carrierHash("title: records\n\nTHE LAST PROJECTION\n"));

  const conflicts: Array<{ bagId: string; uri: string; reason: string }> = [];
  const projector = new LarDiskProjector({
    mirrors: [{ bagId: BAG, mirrorRoot: root }],
    carrierFileFn: async () => ({ ext: MEME_EXT, body: RECORDS_RENDER, encoding: "utf8" }),
    debounceMs: 1,
    syncedTree: tree,
    onConflict: (info) => { conflicts.push(info); },
    ...(opts.canonicalize ? { canonicalizeFn: collapseFraming } : {}),
  });
  const stop = projector.start(fakeEngine());
  return { projector, stop, conflicts, abs, tree };
}

describe("the projecting leg's verdict reaches disk and the operator", () => {
  test("a GENUINE standoff writes NOTHING and surfaces ONCE", async () => {
    const { projector, stop, conflicts, abs, tree } = stand(DISK_DIVERGED, { canonicalize: true });

    await reconcile(projector, URI);

    // The operator's bytes stand untouched — surface, never overwrite.
    expect(readFileSync(abs, "utf-8")).toBe(DISK_DIVERGED);
    // And the anchor did NOT move: it must keep naming the last projection, or the
    // ingest leg loses its own view of the divergence.
    expect(tree.get(syncedTreeKey(BAG, URI)))
      .toBe(carrierHash("title: records\n\nTHE LAST PROJECTION\n"));
    // The divergence REACHED the operator, named for the mechanism that stood down.
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.bagId).toBe(BAG);
    expect(conflicts[0]!.uri).toBe(URI);
    expect(conflicts[0]!.reason).toContain("both moved past the last projection");

    stop();
  });

  test("the ORDINARY round trip WRITES — the streams say the same thing, so it normalizes", async () => {
    const { projector, stop, conflicts, abs, tree } = stand(DISK_FRAMED, { canonicalize: true });

    await reconcile(projector, URI);

    // The write landed: the disk now carries the canonical framing.
    expect(readFileSync(abs, "utf-8")).toBe(RECORDS_RENDER);
    // AND the anchor advanced — which is the whole reason the verdict is a write and
    // not a noop: only this closes the round trip in one cycle.
    expect(tree.get(syncedTreeKey(BAG, URI))).toBe(carrierHash(RECORDS_RENDER));
    expect(conflicts).toHaveLength(0);

    // Idempotent: the second pass is the echo gate, not a second write.
    await reconcile(projector, URI);
    expect(readFileSync(abs, "utf-8")).toBe(RECORDS_RENDER);
    expect(conflicts).toHaveLength(0);

    stop();
  });

  test("CONTROL — with NO canonicalizer the same framing-only edit still CONFLICTS", async () => {
    // Absent is not equivalent. A projector mounted without the view cannot tell the two
    // states apart, and the honest answer to that is the standoff — never a silent write.
    const { projector, stop, conflicts, abs } = stand(DISK_FRAMED, { canonicalize: false });

    await reconcile(projector, URI);

    expect(readFileSync(abs, "utf-8")).toBe(DISK_FRAMED);   // nothing written
    expect(conflicts).toHaveLength(1);                      // and it surfaced

    stop();
  });

  test("THE NATIVE SHORE RIDES FAIL-CLOSED — a `.tid` standoff conflicts, congruence or not", async () => {
    // The `≈` view the projector injects is the MEMETIC congruence, so it reaches a `.mem`
    // carrier and nothing else. A native filetype therefore hands the gate a null view and
    // a standoff reads `conflict` — which is the fail-closed answer, and a CHANGE from the
    // pre-gate projector, which wrote through it. Deliberate, and pinned here so the limit
    // is measured rather than discovered: a native congruence is what would lift it (the
    // ingest leg already takes one per family through `IngestOps`), and until one is passed
    // the native shore surfaces instead of overwriting.
    root = mkdtempSync(join(tmpdir(), "lar-confl-native-"));
    const abs = join(root, REL_TID);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, DISK_FRAMED, "utf-8");
    const tree = new SyncedTree(join(root, ".projection", "synced-tree.json"), 0);
    tree.set(syncedTreeKey(BAG, URI), carrierHash("title: records\n\nTHE LAST PROJECTION\n"));
    const conflicts: Array<{ bagId: string; uri: string; reason: string }> = [];
    const projector = new LarDiskProjector({
      mirrors: [{ bagId: BAG, mirrorRoot: root }],
      carrierFileFn: async () => ({ ext: ".tid", body: RECORDS_RENDER, encoding: "utf8" }),
      debounceMs: 1,
      syncedTree: tree,
      onConflict: (info) => { conflicts.push(info); },
      canonicalizeFn: collapseFraming,   // injected, and DELIBERATELY not consulted for `.tid`
    });
    const stop = projector.start(fakeEngine());

    await reconcile(projector, URI);

    expect(readFileSync(abs, "utf-8")).toBe(DISK_FRAMED);   // the operator's bytes stand
    expect(conflicts).toHaveLength(1);                      // and the divergence surfaced
    stop();
  });

  test("CONTROL — a carrier absent from disk projects, canonicalizer or not", async () => {
    // The clause refines the standoff and nothing above it: `absent-on-disk` still writes,
    // so the wire cannot have made the gate harder to satisfy for a state that already
    // wrote. Measured through the same door, with no file standing.
    for (const canonicalize of [true, false]) {
      if (root) { rmSync(root, { recursive: true, force: true }); }
      root = mkdtempSync(join(tmpdir(), "lar-confl-absent-"));
      const abs = join(root, REL);
      const projector = new LarDiskProjector({
        mirrors: [{ bagId: BAG, mirrorRoot: root }],
        carrierFileFn: async () => ({ ext: MEME_EXT, body: RECORDS_RENDER, encoding: "utf8" }),
        debounceMs: 1,
        ...(canonicalize ? { canonicalizeFn: collapseFraming } : {}),
      });
      const stop = projector.start(fakeEngine());
      await reconcile(projector, URI);
      expect(existsSync(abs), `canonicalizer: ${canonicalize}`).toBe(true);
      expect(readFileSync(abs, "utf-8")).toBe(RECORDS_RENDER);
      stop();
    }
  });
});
