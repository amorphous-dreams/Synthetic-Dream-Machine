/**
 * projection-conflict-reaches-the-operator — THE WIRE, not the gate.
 *
 * `projection-conflict-surfaces` pins the pure decision law. This file measures the other half: that
 * `LarDiskProjector.flush` actually CONSULTS it, that a file a hand moved reaches the capture door before any byte
 * writes over it, that the next reading after a capture writes the records' render, and (the control that matters most)
 * that the `≈` clause does not turn the gate into a rubber stamp.
 *
 * States, driven through the real projector against a real temp mirror:
 *   1. BOTH MOVED (disk and records each moved past their last agreement, and they say DIFFERENT things), with a capture
 *      door answering `drafted` → nothing writes before the capture; the base moves to the file's bytes; the next
 *      reading finds the file where the base names it and writes the records' render.
 *   2. the same state with NO capture door → the file stays as the hand left it, the base stays, and `onRefusal` fires.
 *   3. the ORDINARY round trip (the streams say the SAME thing, framing apart) → nothing writes and nothing captures.
 *   4. the same framing-only edit with NO canonicalizer → the file goes to capture. Absent is not equivalent; a
 *      projector mounted without the view fails CLOSED, handing the house the file's words before anything writes.
 *
 * And a fifth, measured rather than assumed: the injected memetic view reaches a `.mem` carrier and NOTHING ELSE, so a
 * native filetype's framing-only edit with no native congruence goes to capture too.
 *
 * The congruence here stands in for the memetic one: these vectors measure the PLUMBING (does the view reach the gate,
 * does the verdict reach disk and the capture door), and a stand-in makes "say the same thing" and "say different
 * things" separable by construction. `canonicalizeCarrierText` itself is measured in `projection-conflict-surfaces`,
 * over the real corpus.
 */

import { describe, test, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { carrierHash } from "@lararium/mesh/crypto";
import { MEME_EXT } from "@lararium/mesh/mirror-paths";
import { LarDiskProjector } from "../src/disk-projector.js";
import type { CaptureOutcome, MovedFile } from "../src/disk-projector/entries.js";
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
/** What the operator's hands left when both sides moved: a different MEANING. */
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

/** The last projection, which BOTH streams have since moved past. */
const LAST = carrierHash("title: records\n\nTHE LAST PROJECTION\n");

/** One projector over a fresh mirror, a LIVE base, and whatever disk bytes stand. `answer` names the capture door's
 *  answer; absent, the projector stands no door at all. Every file the door saw (and what stood on disk then) records. */
function stand(diskBody: string, opts: { canonicalize: boolean; answer?: CaptureOutcome }): {
  projector: LarDiskProjector;
  stop: () => Promise<void>;
  captures: Array<{ moved: MovedFile; onDisk: string }>;
  refusals: Array<{ bagId: string; uri: string; reason: string }>;
  abs: string;
  tree: SyncedTree;
} {
  root = mkdtempSync(join(tmpdir(), "lar-confl-"));
  const abs = join(root, REL);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, diskBody, "utf-8");

  const tree = new SyncedTree(join(root, ".projection", "synced-tree"));
  tree.set(syncedTreeKey(BAG, URI), join(root, REL), LAST);

  const captures: Array<{ moved: MovedFile; onDisk: string }> = [];
  const refusals: Array<{ bagId: string; uri: string; reason: string }> = [];
  const answer = opts.answer;
  const projector = new LarDiskProjector({
    mirrors: [{ bagId: BAG, mirrorRoot: root }],
    carrierFileFn: async () => ({ ext: MEME_EXT, body: RECORDS_RENDER, encoding: "utf8" }),
    syncedTree: tree,
    onRefusal: (info) => { refusals.push(info); },
    ...(answer !== undefined ? { capture: async (moved: MovedFile) => { captures.push({ moved, onDisk: readFileSync(moved.path, "utf-8") }); return answer; } } : {}),
    ...(opts.canonicalize ? { canonicalizeFn: collapseFraming } : {}),
  });
  const stop = projector.start(fakeEngine());
  return { projector, stop, captures, refusals, abs, tree };
}

describe("the projecting leg's verdict reaches disk and the capture door", () => {
  test("★ BOTH MOVED: the file goes to capture before any write; drafted, the base moves and the next reading writes the render ★", async () => {
    const { projector, stop, captures, refusals, abs, tree } = stand(DISK_DIVERGED, { canonicalize: true, answer: { kind: "drafted", drafts: [`Draft of '${URI}' by disk`] } });

    await reconcile(projector, URI);

    // The door saw the file as the hand left it: nothing wrote over it first.
    expect(captures).toHaveLength(1);
    expect(captures[0]!.onDisk).toBe(DISK_DIVERGED);
    expect(captures[0]!.moved).toMatchObject({
      bagId: BAG, uri: URI, path: abs,
      disk: carrierHash(DISK_DIVERGED), records: carrierHash(RECORDS_RENDER), base: { disk: LAST, records: LAST },
    });
    expect(refusals).toEqual([]);

    // The next reading finds the file where the moved base names it, and writes whatever the records say.
    await projector.idle();
    await reconcile(projector, URI);
    expect(readFileSync(abs, "utf-8")).toBe(RECORDS_RENDER);
    expect(tree.base(syncedTreeKey(BAG, URI))).toMatchObject({ path: abs, disk: carrierHash(RECORDS_RENDER) });
    // Captured once: the reading after the capture reads no moved file.
    expect(captures).toHaveLength(1);

    await stop();
  });

  test("BOTH MOVED with NO capture door: the file stays, the base stays, and the refusal reaches the ward rail", async () => {
    const { projector, stop, refusals, abs, tree } = stand(DISK_DIVERGED, { canonicalize: true });

    await reconcile(projector, URI);

    // The operator's bytes stand untouched — no bytes a hand left get overwritten before the house holds them.
    expect(readFileSync(abs, "utf-8")).toBe(DISK_DIVERGED);
    // The base keeps naming the last projection: nothing captured, so nothing moved it.
    expect(tree.get(syncedTreeKey(BAG, URI))).toBe(LAST);
    expect(refusals).toHaveLength(1);
    expect(refusals[0]).toMatchObject({ bagId: BAG, uri: URI });
    expect(refusals[0]!.reason).toContain("moved since the projector last wrote it");

    // A later reading meets the same file and still writes nothing over it.
    await reconcile(projector, URI);
    expect(readFileSync(abs, "utf-8")).toBe(DISK_DIVERGED);

    await stop();
  });

  test("a REFUSED capture writes nothing and moves no base", async () => {
    const { projector, stop, captures, refusals, abs, tree } = stand(DISK_DIVERGED, { canonicalize: true, answer: { kind: "refused", why: "the words fail the ingest grade" } });

    await reconcile(projector, URI);

    expect(captures).toHaveLength(1);
    expect(readFileSync(abs, "utf-8")).toBe(DISK_DIVERGED);
    expect(tree.get(syncedTreeKey(BAG, URI))).toBe(LAST);
    expect(refusals.map((r) => r.reason).join("\n")).toContain("the words fail the ingest grade");

    await stop();
  });

  test("the ORDINARY round trip writes NOTHING and captures nothing: the streams say the same thing, so the base pins", async () => {
    const { projector, stop, captures, refusals, abs, tree } = stand(DISK_FRAMED, { canonicalize: true, answer: { kind: "landed" } });

    await reconcile(projector, URI);

    // No byte moved: the disk keeps the framing a hand gave it.
    expect(readFileSync(abs, "utf-8")).toBe(DISK_FRAMED);
    // AND the base pinned at this agreement, the disk's bytes on one side and the records' render on
    // the other: the ingest scan reads the file unchanged, and each gate still tells the two apart.
    expect(tree.base(syncedTreeKey(BAG, URI))).toEqual({ path: join(root, REL), disk: carrierHash(DISK_FRAMED), records: carrierHash(RECORDS_RENDER) });
    expect(captures).toHaveLength(0);
    expect(refusals).toHaveLength(0);

    // Idempotent: the second pass meets the same agreement and moves nothing.
    await reconcile(projector, URI);
    expect(readFileSync(abs, "utf-8")).toBe(DISK_FRAMED);
    expect(tree.base(syncedTreeKey(BAG, URI))).toEqual({ path: join(root, REL), disk: carrierHash(DISK_FRAMED), records: carrierHash(RECORDS_RENDER) });
    expect(captures).toHaveLength(0);

    await stop();
  });

  test("a hand edit to a file whose base holds two sides goes to capture as disk-moved: the records never moved", async () => {
    // The agreement pinned earlier: the disk held DISK_FRAMED, the records rendered RECORDS_RENDER.
    // Since then a hand changed the file's MEANING and the records stand where they stood.
    const { projector, stop, captures, abs, tree } = stand(DISK_DIVERGED, { canonicalize: true, answer: { kind: "refused", why: "held for the vector" } });
    tree.set(syncedTreeKey(BAG, URI), join(root, REL), carrierHash(DISK_FRAMED), carrierHash(RECORDS_RENDER));

    await reconcile(projector, URI);

    // The door hears the records where the base left them: the capture lands the disk's words through the ingest grade.
    expect(captures).toHaveLength(1);
    expect(captures[0]!.moved.records).toBe(captures[0]!.moved.base!.records);
    expect(readFileSync(abs, "utf-8")).toBe(DISK_DIVERGED);
    expect(tree.base(syncedTreeKey(BAG, URI))).toEqual({ path: join(root, REL), disk: carrierHash(DISK_FRAMED), records: carrierHash(RECORDS_RENDER) });

    await stop();
  });

  test("CONTROL — the same edit over a base that names the disk's bytes for both sides goes to capture as both-moved", async () => {
    const { projector, stop, captures, abs, tree } = stand(DISK_DIVERGED, { canonicalize: true, answer: { kind: "refused", why: "held for the vector" } });
    tree.set(syncedTreeKey(BAG, URI), join(root, REL), carrierHash(DISK_FRAMED));

    await reconcile(projector, URI);

    expect(captures).toHaveLength(1);
    expect(captures[0]!.moved.records).not.toBe(captures[0]!.moved.base!.records);
    expect(readFileSync(abs, "utf-8")).toBe(DISK_DIVERGED);

    await stop();
  });

  test("CONTROL — with NO canonicalizer the same framing-only edit goes to capture", async () => {
    // Absent is not equivalent. A projector mounted without the view cannot tell the two states apart, so the house
    // takes the file's words before anything writes, never a silent overwrite.
    const { projector, stop, refusals, abs } = stand(DISK_FRAMED, { canonicalize: false });

    await reconcile(projector, URI);

    expect(readFileSync(abs, "utf-8")).toBe(DISK_FRAMED);   // nothing written
    expect(refusals).toHaveLength(1);                       // no door stands here, so the capture refused

    await stop();
  });

  test("THE NATIVE SHORE RIDES FAIL-CLOSED — a `.tid` framing-only edit goes to capture when no native congruence stands", async () => {
    // The memetic view reaches a `.mem` carrier and nothing else. With no `canonicalizeNativeFn`, a native filetype hands
    // the gate a null view, and a moved file goes to capture (`native-projection-congruence` measures the native view).
    root = mkdtempSync(join(tmpdir(), "lar-confl-native-"));
    const abs = join(root, REL_TID);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, DISK_FRAMED, "utf-8");
    const tree = new SyncedTree(join(root, ".projection", "synced-tree"));
    tree.set(syncedTreeKey(BAG, URI), join(root, REL), LAST);
    const refusals: Array<{ bagId: string; uri: string; reason: string }> = [];
    const projector = new LarDiskProjector({
      mirrors: [{ bagId: BAG, mirrorRoot: root }],
      carrierFileFn: async () => ({ ext: ".tid", body: RECORDS_RENDER, encoding: "utf8" }),
      syncedTree: tree,
      onRefusal: (info) => { refusals.push(info); },
      canonicalizeFn: collapseFraming,   // injected, and DELIBERATELY not consulted for `.tid`
    });
    const stop = projector.start(fakeEngine());

    await reconcile(projector, URI);

    expect(readFileSync(abs, "utf-8")).toBe(DISK_FRAMED);   // the operator's bytes stand
    expect(refusals).toHaveLength(1);                       // handed to capture, which no door here answers
    await stop();
  });

  test("CONTROL — a carrier absent from disk projects, canonicalizer or not", async () => {
    // The clause refines the moved-file reading and nothing above it: `absent-on-disk` still writes,
    // so the wire cannot have made the gate harder to satisfy for a state that already
    // wrote. Measured through the same door, with no file standing.
    for (const canonicalize of [true, false]) {
      if (root) { rmSync(root, { recursive: true, force: true }); }
      root = mkdtempSync(join(tmpdir(), "lar-confl-absent-"));
      const abs = join(root, REL);
      const projector = new LarDiskProjector({
        mirrors: [{ bagId: BAG, mirrorRoot: root }],
        carrierFileFn: async () => ({ ext: MEME_EXT, body: RECORDS_RENDER, encoding: "utf8" }),
        ...(canonicalize ? { canonicalizeFn: collapseFraming } : {}),
      });
      const stop = projector.start(fakeEngine());
      await reconcile(projector, URI);
      expect(existsSync(abs), `canonicalizer: ${canonicalize}`).toBe(true);
      expect(readFileSync(abs, "utf-8")).toBe(RECORDS_RENDER);
      await stop();
    }
  });
});
