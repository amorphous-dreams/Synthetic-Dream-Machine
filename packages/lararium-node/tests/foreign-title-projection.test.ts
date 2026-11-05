/**
 * foreign-title-projection — a tiddler whose title is not a `lar:` URI lands on disk.
 *
 * Two halves.
 *
 * ① THE FORM CUT. The change handler used to read `if (!title.startsWith("lar:")) continue;` — a
 *    withholding by FORM, the same move canon refused for hostful URIs. The volatile-residency bar
 *    (the in-wiki cascade's named withholding, `isVolatileVmUri`, and the mirror roster) stays the
 *    only bar: a title reaches the gate, and `reconcile` drops it when its `$origin-bag` names no
 *    mirror.
 *
 * ② THE UNIQUIFIER. TW5's adaptor resolves a path collision by trying `title.tid`, `title_1.tid`, …
 *    until `fs.existsSync` reads free, and stays STABLE across restarts because `$tw.boot.files`
 *    holds the title→path assignment for the process's life. This projector holds no such registry —
 *    it reconciles per carrier root against settled VM state — so a naive `existsSync` loop would
 *    write `title.tid` on the first boot and `title_1.tid` on the second, growing one file per boot.
 *    The free-path test is therefore "absent OR ALREADY MINE", and MINE is proved FROM DISK: every
 *    native projection writes its own `title:` — in the `.tid` field block, in the `.json` array, or
 *    in the `.meta` sidecar. A format that carries no title (a flattened `.mem`) cannot prove it, and
 *    an OCCUPIED candidate there REFUSES loudly rather than clobber or grow.
 *
 * Meme: lar:///ha.ka.ba/lararium/api/disk-projection
 */

import { describe, test, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LarDiskProjector } from "../src/disk-projector.js";
import { SyncedTree } from "../src/synced-tree.js";
import type { CarrierFile } from "@lararium/tw5";
import { createHash } from "node:crypto";
import { afterDispatch, draftBag, openDraft, shoreRig, turns, typeInto } from "../../lararium-tw5/tests/wiki-shore-rig.js";
import { makeReceiptCapability } from "../../lararium-tw5/src/receipt.js";
import { attachMessageChannelSync } from "@lararium/mesh";
import { DurableNodeFSStorageAdapter } from "../src/durable-storage-adapter.js";
import { receiptInStore } from "../src/open-node-vessel.js";
import { answerReceipt } from "../src/worker-handle.js";
import type { CapabilityRecord } from "@lararium/mesh";
import { restingRepo, restEvery } from "./resting-repo.js";

let root = "";
afterEach(() => { if (root) { rmSync(root, { recursive: true, force: true }); root = ""; } });

type Flushable = {
  flush: (b: string, u: string) => Promise<void>;
  _scheduleUnlinkByTitle: (t: string) => Promise<void>;
  start: (tw5: unknown) => () => void;
};

/** A `.tid` body exactly as `makeTw5FileInfo` writes one: the field block names the title. */
function tidBody(title: string, text: string): string {
  return `title: ${title}\ntype: text/vnd.tiddlywiki\n\n${text}`;
}

function rig(file: (uri: string) => CarrierFile | null, refusals: string[] = []): { projector: Flushable; root: string } {
  root = mkdtempSync(join(tmpdir(), "lar-foreign-title-"));
  const projector = new LarDiskProjector({
    mirrors: [{ bagId: "wiki", mirrorRoot: root }],
    carrierFileFn: async (uri) => file(uri),
    onRefusal: (r) => refusals.push(r.reason),
  }) as unknown as Flushable;
  return { projector, root };
}

/** A second projector over the SAME root — the "restart" (a fresh, empty `sited` memory). */
function restart(mirrorRoot: string, file: (uri: string) => CarrierFile | null, refusals: string[] = []): Flushable {
  return new LarDiskProjector({
    mirrors: [{ bagId: "wiki", mirrorRoot }],
    carrierFileFn: async (uri) => file(uri),
    onRefusal: (r) => refusals.push(r.reason),
  }) as unknown as Flushable;
}

const nativeFile = (title: string, text: string): CarrierFile => ({
  ext: ".tid",
  body: tidBody(title, text),
  defaultRelPath: `${title.replace(/\/|\\/g, "_")}.tid`,
});

test.each([false, true])("recovery drain waits for projection after durable heads (grant=%s)", async (grant) => {
  root = mkdtempSync(join(tmpdir(), "lar-recovery-drain-"));
  const r = await shoreRig();
  await r.adaptor.armSeedCheckpoint();
  let releaseRender!: () => void;
  let renderStarted!: () => void;
  const heldRender = new Promise<void>((resolve) => { releaseRender = resolve; });
  const rendering = new Promise<void>((resolve) => { renderStarted = resolve; });
  let first = true;
  const projector = new LarDiskProjector({
    mirrors: grant ? [{ bagId: draftBag, mirrorRoot: root, mirrorClass: "recovery" }] : [],
    carrierFileFn: async () => null,
    recoveryStore: (bag) => bag === draftBag ? r.draft : null,
    recoveryFileFn: async (fields) => {
      if (first) { first = false; renderStarted(); await heldRender; }
      return nativeFile(String(fields.title), String(fields.text));
    },
  });
  const stopProjector = projector.start(r.engine);
  r.adaptor.recoveryAtRest = (bag, title, fields) => projector.recoveryAtRest(bag, title, fields);
  const asks: Array<{ requestId: string; documentIds: string[]; heads: Record<string, string[]> }> = [];
  let sequence = 0;
  const capability = makeReceiptCapability({
    post: (message) => { if (message.type === "receipt:request") asks.push(message); },
    handles: () => new Map(Object.entries(r.handles)),
    mintId: () => `recovery-${++sequence}`,
  });
  r.adaptor.caps.receipt = capability;
  const count = () => r.calls.filter((call) => call.bag === draftBag && call.puts.includes(title)).length;
  let title = "";
  try {
    title = openDraft(r, "Note", "first");
    await afterDispatch();
    await turns(30);
    if (grant) await rendering;
    expect(count()).toBe(1);
    expect(asks).toHaveLength(1);
    const ask = asks[0]!;
    expect(ask.documentIds).toContain(r.draftHandle.documentId);
    expect(ask.heads[r.draftHandle.documentId]!.length).toBeGreaterThan(0);
    typeInto(r, title, "latest");
    await afterDispatch();
    await turns(20);
    expect(count(), "held repo acknowledgement prevents the second drain").toBe(1);
    capability.answer({ type: "receipt:issued", requestId: ask.requestId, issued: true });
    await turns(30);
    const beforeProjection = count();
    releaseRender();
    await projector.idle();
    await turns(30);
    if (asks[1]) capability.answer({ type: "receipt:issued", requestId: asks[1].requestId, issued: true });
    await turns(20);
    if (grant) {
      const bytes = readFileSync(join(root, `${title}.tid`));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(createHash("sha256").update(tidBody(title, "latest")).digest("hex"));
      expect(beforeProjection, "the granted recovery file must land before the next drain").toBe(1);
    } else {
      expect(readdirSync(root)).toEqual([]);
      expect(beforeProjection, "without a recovery grant the drain needs only durable heads").toBe(2);
    }
  } finally {
    releaseRender();
    capability.close();
    r.adaptor.caps.receipt = null;
    await stopProjector();
    await r.stop();
  }
}, 60_000);

test("a held durable receipt plus a production boundary never opens a parallel write", async () => {
  const r = await shoreRig();
  await r.adaptor.armSeedCheckpoint();
  let release!: () => void;
  let started!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  const reached = new Promise<void>((resolve) => { started = resolve; });
  let first = true;
  const capability = makeReceiptCapability({
    post: (message) => {
      if (message.type !== "receipt:request") return;
      if (first) {
        first = false;
        started();
        void (async () => { await held; capability.answer({ type: "receipt:issued", requestId: message.requestId, issued: true }); })();
        return;
      }
      capability.answer({ type: "receipt:issued", requestId: message.requestId, issued: true });
    },
    handles: () => new Map(Object.entries(r.handles)),
  });
  r.adaptor.caps.receipt = capability;
  const title = openDraft(r, "Boundary receipt", "first");
  const count = () => r.calls.filter((call) => call.bag === draftBag && call.puts.includes(title)).length;
  try {
    await afterDispatch();
    await reached;
    typeInto(r, title, "latest");
    await afterDispatch();
    const boundary = r.adaptor.boundary();
    await turns(30);
    expect(count(), "the boundary opened a second write before the first durable receipt landed").toBe(1);
    release();
    await boundary;
    for (let i = 0; i < 200 && count() < 2; i++) await new Promise<void>((resolve) => setTimeout(resolve, 5));
    expect(count()).toBe(2);
  } finally {
    release();
    capability.close();
    r.adaptor.caps.receipt = null;
    await r.stop();
  }
}, 60_000);

test("recovery drain retains its obligation when the granted file conflicts", async () => {
  root = mkdtempSync(join(tmpdir(), "lar-recovery-conflict-"));
  const r = await shoreRig();
  await r.adaptor.armSeedCheckpoint();
  let releaseRender!: () => void;
  let renderStarted!: () => void;
  const heldRender = new Promise<void>((resolve) => { releaseRender = resolve; });
  const rendering = new Promise<void>((resolve) => { renderStarted = resolve; });
  let first = true;
  const conflicts: string[] = [];
  const projector = new LarDiskProjector({
    mirrors: [{ bagId: draftBag, mirrorRoot: root, mirrorClass: "recovery" }],
    carrierFileFn: async () => null,
    onConflict: (entry) => conflicts.push(entry.uri),
    recoveryStore: (bag) => bag === draftBag ? r.draft : null,
    recoveryFileFn: async (fields) => {
      if (first) { first = false; renderStarted(); await heldRender; }
      return nativeFile(String(fields.title), String(fields.text));
    },
  });
  const stopProjector = projector.start(r.engine);
  r.adaptor.recoveryAtRest = (bag, title, fields) => projector.recoveryAtRest(bag, title, fields);
  const asks: Array<{ requestId: string }> = [];
  const capability = makeReceiptCapability({
    post: (message) => { if (message.type === "receipt:request") asks.push(message); },
    handles: () => new Map(Object.entries(r.handles)),
    mintId: () => `conflict-${asks.length}`,
  });
  r.adaptor.caps.receipt = capability;
  let title = "";
  try {
    title = openDraft(r, "Note", "first");
    await afterDispatch();
    await rendering;
    await turns(20);
    expect(asks).toHaveLength(1);
    const path = join(root, `${title}.tid`);
    const disk = tidBody(title, "a separate disk edit");
    writeFileSync(path, disk);
    typeInto(r, title, "latest");
    await afterDispatch();
    releaseRender();
    await projector.idle();
    expect(conflicts).toContain(title);
    expect(readFileSync(path, "utf8")).toBe(disk);
    capability.answer({ type: "receipt:issued", requestId: asks[0]!.requestId, issued: true });
    await turns(30);
    const writes = r.calls.filter((call) => call.bag === draftBag && call.puts.includes(title));
    // A landing wave after the refusal also releases the retry (the drain's ruling 2), so a loaded host may show a second write; the claim holds in the title staying owed.
    expect(writes.length, "the first drain wrote").toBeGreaterThanOrEqual(1);
    expect(r.adaptor.pendingTitles()).toContain(title);
  } finally {
    releaseRender();
    capability.close();
    r.adaptor.caps.receipt = null;
    await stopProjector();
    await r.stop();
  }
}, 60_000);

test.each([false, true])("recovery retry rechecks the file without another edit (conflict=%s)", async (conflict) => {
  root = mkdtempSync(join(tmpdir(), "lar-recovery-retry-"));
  const r = await shoreRig();
  await r.adaptor.armSeedCheckpoint();
  let releaseRender!: () => void;
  let renderStarted!: () => void;
  const heldRender = new Promise<void>((resolve) => { releaseRender = resolve; });
  const rendering = new Promise<void>((resolve) => { renderStarted = resolve; });
  let first = true;
  const projector = new LarDiskProjector({
    mirrors: [{ bagId: draftBag, mirrorRoot: root, mirrorClass: "recovery" }],
    carrierFileFn: async () => null,
    recoveryStore: (bag) => bag === draftBag ? r.draft : null,
    recoveryFileFn: async (fields) => {
      if (first) { first = false; renderStarted(); await heldRender; }
      return nativeFile(String(fields.title), String(fields.text));
    },
  });
  const stopProjector = projector.start(r.engine);
  let checks = 0;
  r.adaptor.recoveryAtRest = (bag, title, fields) => {
    checks++;
    return projector.recoveryAtRest(bag, title, fields);
  };
  const asks: Array<{ requestId: string }> = [];
  const capability = makeReceiptCapability({
    post: (message) => { if (message.type === "receipt:request") asks.push(message); },
    handles: () => new Map(Object.entries(r.handles)),
    mintId: () => `retry-${asks.length}`,
  });
  r.adaptor.caps.receipt = capability;
  try {
    const title = openDraft(r, "Note", "first");
    await afterDispatch();
    await rendering;
    await turns(20);
    expect(asks).toHaveLength(1);
    const path = join(root, `${title}.tid`);
    if (conflict) writeFileSync(path, tidBody(title, "separate disk edit"));
    releaseRender();
    await projector.idle();
    capability.answer({ type: "receipt:issued", requestId: asks[0]!.requestId, issued: true });
    // WAIT ON THE CONDITION, never a turn count: a recheck rides real disk I/O (the render, the file read), which `setImmediate`
    // turns outrun under load. Quiet means the recheck count and the ask count held still across several rounds, each round
    // letting a slice of real time pass (a receipt left unanswered holds the drain, so no idle edge can stand in for this).
    const quiet = async (): Promise<void> => {
      let still = 0, mark = "";
      for (let round = 0; round < 400 && still < 12; round++) {
        await new Promise<void>((resolve) => setTimeout(resolve, 5));
        const now = `${checks}/${asks.length}`;
        still = now === mark ? still + 1 : 0; mark = now;
      }
      expect(still, "the recheck loop reached quiet").toBeGreaterThanOrEqual(12);
    };
    await quiet();
    // The first answer draws one recheck. Under a standing conflict the refusal raises its alert, and a landing wave for the
    // refused title releases ONE retry on its own (the drain's ruling 2), so how soon that second recheck lands rides the
    // loop's turn order: the claim here reads "at least one", and exactly one where no conflict refuses.
    if (conflict) expect(checks).toBeGreaterThanOrEqual(1);
    else expect(checks).toBe(1);
    if (conflict) {
      expect(r.adaptor.pendingTitles()).toContain(title);
      const before = checks;                       // taken BEFORE the request: only the request's own work can raise it past here
      r.adaptor.requestDrain();
      await quiet();
      if (asks[1]) capability.answer({ type: "receipt:issued", requestId: asks[1].requestId, issued: true });
      await quiet();
      expect(checks, "the request drew at least one more recheck of the failed projection receipt").toBeGreaterThan(before);
      // QUIESCENCE without another request: a further quiet stretch draws no further check, and the retries stay bounded.
      const settled = checks;
      await quiet();
      expect(checks, "no request stands, so no further recheck runs").toBe(settled);
      expect(settled - before, "the request's retries stay bounded").toBeLessThanOrEqual(3);
      expect.soft(r.adaptor.pendingTitles(), "conflict still prevents acknowledgement").toContain(title);
      expect(readFileSync(path, "utf8")).toBe(tidBody(title, "separate disk edit"));
    } else {
      expect(r.adaptor.pendingTitles()).not.toContain(title);
      expect(readFileSync(path, "utf8")).toBe(tidBody(title, "first"));
    }
    expect(r.calls.filter((call) => call.bag === draftBag && call.puts.includes(title))).toHaveLength(1);
  } finally {
    releaseRender();
    capability.close();
    r.adaptor.caps.receipt = null;
    await stopProjector();
    await r.stop();
  }
}, 60_000);

describe("foreign-title projection — the form cut", () => {
  test("★ a tiddler titled `My Notes` projects to disk ★", async () => {
    const { projector, root } = rig(() => nativeFile("My Notes", "a plain title.\n"));
    await projector.flush("wiki", "My Notes");
    expect(existsSync(join(root, "My Notes.tid"))).toBe(true);
    expect(readFileSync(join(root, "My Notes.tid"), "utf8")).toContain("a plain title.");
  });

  test("★ the change handler admits a foreign title by FORM ★", async () => {
    const { projector } = rig(() => null);
    const marked: string[] = [];
    let handler: ((c: Record<string, unknown>) => void) | undefined;
    const fakeTw5 = {
      $tw: {
        wiki: {
          getTiddler: () => undefined,
          addEventListener: (_e: string, h: (c: Record<string, unknown>) => void) => { handler = h; },
          removeEventListener: () => {},
        },
      },
    };
    const stop = projector.start(fakeTw5);
    // The handler closes over the gate the projector built; patch that object's `mark` in place.
    const gate = (projector as unknown as { gate: { mark: (k: string) => void } }).gate;
    gate.mark = (k) => marked.push(k);
    handler?.({ "My Notes": {}, "lar:///ha.ka.ba/lares/api/x": {}, "$:/state/tab": {} });
    await stop();
    expect(marked).toContain("My Notes");
    expect(marked).toContain("lar:///ha.ka.ba/lares/api/x");
  });
});

describe("foreign-title projection — the uniquifier", () => {
  test("★ two titles that sanitize alike each keep their own file ★", async () => {
    const bodies: Record<string, string> = { "A/B": "slash.\n", "A_B": "underscore.\n" };
    const { projector, root } = rig((uri) => nativeFile(uri, bodies[uri]!));
    await projector.flush("wiki", "A/B");
    await projector.flush("wiki", "A_B");
    const files = readdirSync(root).sort();
    expect(files).toEqual(["A_B.tid", "A_B_1.tid"]);
    // and NEITHER overwrote the other
    const all = files.map((f) => readFileSync(join(root, f), "utf8")).join("\n");
    expect(all).toContain("slash.");
    expect(all).toContain("underscore.");
  });

  test("★ project · restart · project — the SAME file, never `_1` ★", async () => {
    const { projector, root } = rig(() => nativeFile("My Notes", "a plain title.\n"));
    await projector.flush("wiki", "My Notes");
    for (let boot = 0; boot < 3; boot++) {
      await restart(root, () => nativeFile("My Notes", "a plain title.\n")).flush("wiki", "My Notes");
    }
    expect(readdirSync(root).sort()).toEqual(["My Notes.tid"]);
  });

  test("a collided pair survives a restart at ITS OWN count — the disk title proves ownership", async () => {
    const bodies: Record<string, string> = { "A/B": "slash.\n", "A_B": "underscore.\n" };
    const mk = (uri: string) => nativeFile(uri, bodies[uri]!);
    const { projector, root } = rig(mk);
    await projector.flush("wiki", "A/B");
    await projector.flush("wiki", "A_B");
    const before = readFileSync(join(root, "A_B_1.tid"), "utf8");
    const second = restart(root, mk);
    await second.flush("wiki", "A_B");
    await second.flush("wiki", "A/B");
    expect(readdirSync(root).sort()).toEqual(["A_B.tid", "A_B_1.tid"]);
    expect(readFileSync(join(root, "A_B_1.tid"), "utf8")).toBe(before);
  });

  test("a `.meta` sidecar proves ownership for a content filetype", async () => {
    const mk = (uri: string): CarrierFile => ({
      ext: ".png",
      body: "AAAA",
      metaBody: `title: ${uri}\ntype: image/png\n`,
      defaultRelPath: `${uri.replace(/\//g, "_")}.png`,
    });
    const { projector, root } = rig(mk);
    await projector.flush("wiki", "a/shot");
    await projector.flush("wiki", "a_shot");
    expect(readdirSync(root).sort()).toEqual(["a_shot.png", "a_shot.png.meta", "a_shot_1.png", "a_shot_1.png.meta"]);
    await restart(root, mk).flush("wiki", "a/shot");
    expect(readdirSync(root).sort()).toEqual(["a_shot.png", "a_shot.png.meta", "a_shot_1.png", "a_shot_1.png.meta"]);
  });

  test("★ nothing on disk can prove ownership → the write REFUSES, it never clobbers ★", async () => {
    const refusals: string[] = [];
    const { projector, root } = rig(() => ({ ext: ".mem", body: "mine\n", defaultRelPath: "loose meme.mem" }), refusals);
    writeFileSync(join(root, "loose meme.mem"), "someone else's bytes\n", "utf8");
    await projector.flush("wiki", "loose meme");
    expect(readFileSync(join(root, "loose meme.mem"), "utf8")).toBe("someone else's bytes\n");
    expect(refusals).toHaveLength(1);
    expect(refusals[0]).toContain("ownership");
  });

  test("an unprovable format still writes when the candidate is FREE", async () => {
    const { projector, root } = rig(() => ({ ext: ".mem", body: "mine\n", defaultRelPath: "loose meme.mem" }));
    await projector.flush("wiki", "loose meme");
    expect(readFileSync(join(root, "loose meme.mem"), "utf8")).toBe("mine\n");
  });

  test("a delete unlinks at the uniquified siting", async () => {
    const bodies: Record<string, string> = { "A/B": "slash.\n", "A_B": "underscore.\n" };
    const { projector, root } = rig((uri) => nativeFile(uri, bodies[uri]!));
    await projector.flush("wiki", "A/B");
    await projector.flush("wiki", "A_B");
    await projector._scheduleUnlinkByTitle("A_B");
    expect(readdirSync(root).sort()).toEqual(["A_B.tid"]);
    expect(readFileSync(join(root, "A_B.tid"), "utf8")).toContain("slash.");
  });
});

describe("foreign-title projection — the CONTROLs", () => {
  const LAR = "lar:///ha.ka.ba/lares/parity/note";

  test("★ CONTROL — a `lar:` carrier sites byte-identically at its uri-path ★", async () => {
    const { projector, root } = rig(() => ({
      ext: ".mem",
      body: "# note",
      // the flattened default rides now, and the address siting rule MUST still win
      defaultRelPath: "lar___ha.ka.ba_lares_parity_note.mem",
    }));
    await projector.flush("wiki", LAR);
    expect(readFileSync(join(root, "ha.ka.ba/lares/parity/note.mem"), "utf8")).toBe("# note");
    expect(existsSync(join(root, "lar___ha.ka.ba_lares_parity_note.mem"))).toBe(false);
  });

  test("CONTROL — a cascade rule still wins over the flattened default", async () => {
    const { projector, root } = rig(() => ({
      ext: ".md", body: "# note", metaBody: "type: text/markdown\n",
      relPath: "notes/note.md", defaultRelPath: "My Notes.md",
    }));
    await projector.flush("wiki", "My Notes");
    expect(existsSync(join(root, "notes/note.md"))).toBe(true);
    expect(existsSync(join(root, "My Notes.md"))).toBe(false);
  });

  test("★ CONTROL — a `lar:` name the LOCI law refuses never falls through to the flatten ★", async () => {
    // A fragment owns no file (its carrier root does) and a bag manifest belongs to the declare verb.
    // Both are deliberate refusals, so the flattened default must not resurrect them.
    const { projector, root } = rig((uri) => ({
      ext: ".mem", body: "x", defaultRelPath: `${uri.replace(/[:/]/g, "_")}.mem`,
    }));
    await projector.flush("wiki", "lar:///ha.ka.ba/lares/parity/note#slot");
    await projector.flush("wiki", "lar:///ha.ka.ba/bags/lares");
    expect(readdirSync(root)).toEqual([]);
  });

  test("CONTROL — a carrier with neither rule, loci, nor default sites nowhere", async () => {
    const { projector, root } = rig(() => ({ ext: ".tid", body: "x" }));
    await projector.flush("wiki", "My Notes");
    expect(readdirSync(root)).toEqual([]);
  });

  test("★ CONTROL — the residency bar, not the title's form, decides: a volatile-plane title never projects ★", async () => {
    // The volatile plane never persists (island-adaptor refuses it), so nothing there ever carries
    // an `$origin-bag` naming a mirror. Reconcile reads that stamp and drops what no mirror holds —
    // the same drop a `$:/state/…` tiddler routed to the unmirrored temp bag takes.
    const seen: string[] = [];
    root = mkdtempSync(join(tmpdir(), "lar-foreign-title-"));
    const tiddlers: Record<string, Record<string, string>> = {
      "lar:///lararium.local.vm/verb/act": { title: "lar:///lararium.local.vm/verb/act" },   // volatile: no stamp
      "$:/state/tab":                      { title: "$:/state/tab", "$origin-bag": "temp" }, // unmirrored bag
      "My Notes":                          { title: "My Notes", "$origin-bag": "wiki" },     // mirrored
    };
    const projector = new LarDiskProjector({
      mirrors: [{ bagId: "wiki", mirrorRoot: root }],
      carrierFileFn: async (uri) => { seen.push(uri); return nativeFile(uri, "x\n"); },
    });
    (projector as unknown as { _tw5: unknown })._tw5 = {
      $tw: { wiki: { getTiddler: (t: string) => (tiddlers[t] ? { fields: tiddlers[t] } : undefined) } },
    };
    const reconcile = (projector as unknown as { reconcile: (u: string) => Promise<void> }).reconcile.bind(projector);
    for (const t of Object.keys(tiddlers)) await reconcile(t);
    expect(seen).toEqual(["My Notes"]);
    expect(readdirSync(root).sort()).toEqual(["My Notes.tid"]);
  });

  test("CONTROL — a flattened path that escapes the mirror is refused by the disk ward", async () => {
    const refusals: string[] = [];
    const { projector, root } = rig(() => ({ ext: ".tid", body: "x", defaultRelPath: "../escape.tid" }), refusals);
    await projector.flush("wiki", "escape");
    expect(refusals.length).toBeGreaterThan(0);
    expect(existsSync(join(root, "..", "escape.tid"))).toBe(false);
  });
});

test("a recovery mirror projects a held draft even when the wiki view shadows it; an ungranted bag stays off disk", async () => {
  root = mkdtempSync(join(tmpdir(), "lar-recovery-projection-"));
  const title = "Draft of 'Note'";
  const recovery = join(root, "recovery");
  const bytes = `title: ${title}\ndraft.of: Note\nlar-draft-base-bag: working\nlar-draft-base-heads: abc\n\nunsaved words`;
  const projector = new LarDiskProjector({
    mirrors: [{ bagId: "draft", mirrorRoot: recovery, mirrorClass: "recovery" }],
    bagsHolding: async (uri) => uri === title ? ["draft", "temp"] : ["temp"],
    carrierFileFn: async (uri) => ({ ext: ".tid", body: uri === title ? bytes : tidBody(uri, "private"), defaultRelPath: `${uri}.tid` }),
  });
  (projector as unknown as { _tw5: unknown })._tw5 = { $tw: { wiki: { getTiddler: (uri: string) => ({ fields: { title: uri, "$origin-bag": "temp" } }) } } };
  const reconcile = (projector as unknown as { reconcile: (uri: string) => Promise<void> }).reconcile.bind(projector);
  await reconcile("temp-only");
  expect(existsSync(recovery)).toBe(false);
  await reconcile(title);
  expect(existsSync(recovery)).toBe(true);
  const files = readdirSync(recovery);
  expect(files).toHaveLength(1);
  expect(readFileSync(join(recovery, files[0]!), "utf8")).toBe(bytes);
});

test("initial scan finds a shadowed recovery draft", async () => {
  root = mkdtempSync(join(tmpdir(), "lar-recovery-scan-"));
  const recovery = join(root, "recovery");
  const title = "Draft of 'Note'";
  const projector = new LarDiskProjector({
    mirrors: [{ bagId: "draft", mirrorRoot: recovery, mirrorClass: "recovery" }],
    bagsHolding: async (uri) => uri === title ? ["draft", "temp"] : ["temp"],
    carrierFileFn: async (uri) => nativeFile(uri, uri === title ? "draft bytes" : "private"),
  });
  const wiki = {
    allTitles: () => [title, "temp-only"],
    getTiddler: (uri: string) => ({ fields: { title: uri, "$origin-bag": "temp" } }),
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  const stop = projector.start({ $tw: { wiki } } as never);
  try {
    await projector.idle();
    expect(existsSync(recovery)).toBe(true);
    const files = readdirSync(recovery);
    expect(files).toHaveLength(1);
    expect(readFileSync(join(recovery, files[0]!), "utf8")).toContain("draft bytes");
  } finally {
    await stop();
  }
});

test("CONTROL — initial scan leaves a title held only by an ungranted bag off disk", async () => {
  root = mkdtempSync(join(tmpdir(), "lar-recovery-scan-control-"));
  const recovery = join(root, "recovery");
  const projector = new LarDiskProjector({
    mirrors: [{ bagId: "draft", mirrorRoot: recovery, mirrorClass: "recovery" }],
    bagsHolding: async () => ["temp"],
    carrierFileFn: async (uri) => nativeFile(uri, "private"),
  });
  const wiki = {
    allTitles: () => ["temp-only"],
    getTiddler: (uri: string) => ({ fields: { title: uri, "$origin-bag": "temp" } }),
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  const stop = projector.start({ $tw: { wiki } } as never);
  try {
    await projector.idle();
    expect(existsSync(recovery)).toBe(false);
  } finally {
    await stop();
  }
});

test("recovery mount reads the draft bag's fields despite a shadow, and keeps other bags isolated", async () => {
  const { CompositeStore } = await import("@lararium/mesh");
  const { MemoryTiddlerStore } = await import("../../lararium-tw5/src/memory-store.js");
  const { TW5Engine } = await import("../../lararium-tw5/src/tw5-vm.js");
  const { TW5_CORE_DIR, TW5_CORE_SCRIPT_FILENAME } = await import("../../lararium-tw5/src/generated-tw5-version.js");
  const { mountDiskProjection, mountedDiskProjector } = await import("../src/island-behaviors.js");
  root = mkdtempSync(join(tmpdir(), "lar-recovery-record-"));
  const recovery = join(root, "recovery");
  const workingRoot = join(root, "working");
  const draft = new MemoryTiddlerStore("draft");
  const temp = new MemoryTiddlerStore("temp");
  const working = new MemoryTiddlerStore("working");
  const composite = new CompositeStore();
  composite.addLayer({ bagId: "working", store: working, writable: true });
  composite.addLayer({ bagId: "draft", store: draft, writable: true });
  composite.addLayer({ bagId: "temp", store: temp, writable: true });
  const origin = { kind: "operator-import", sessionId: "test" } as const;
  const title = "Draft of 'Note'";
  await draft.put({ tiddler: { title, text: "recovery words", "draft.of": "Note", "lar-draft-base-bag": "working", "lar-draft-base-heads": "abc" } }, origin);
  await temp.put({ tiddler: { title, text: "shadow secret" } }, origin);
  await temp.put({ tiddler: { title: "temp-only", text: "private secret" } }, origin);
  await working.put({ tiddler: { title: "Working note", text: "ordinary words" } }, origin);
  const engine = new TW5Engine();
  await engine.boot(new Uint8Array(readFileSync(join(TW5_CORE_DIR, TW5_CORE_SCRIPT_FILENAME))));
  const tw = engine.$tw;
  tw.wiki.addTiddler(new tw.Tiddler({ title, text: "shadow secret", "$origin-bag": "temp" }));
  tw.wiki.addTiddler(new tw.Tiddler({ title: "temp-only", text: "private secret", "$origin-bag": "temp" }));
  tw.wiki.addTiddler(new tw.Tiddler({ title: "Working note", text: "ordinary words", "$origin-bag": "working" }));
  const stop = mountDiskProjection({ diskMirrors: [
    { bagId: "draft", mirrorRoot: recovery, scope: "draft", mirrorClass: "recovery" },
    { bagId: "working", mirrorRoot: workingRoot, scope: "working" },
  ] } as never, { tw5: engine, composite, post: () => {}, wikiUri: "test" } as never)!;
  try {
    await mountedDiskProjector()!.idle();
    const ordinary = readdirSync(workingRoot).map((f) => readFileSync(join(workingRoot, f), "utf8"));
    expect(ordinary.join("\n")).toContain("ordinary words");
    expect(ordinary.join("\n")).not.toContain("secret");
    expect(existsSync(recovery)).toBe(true);
    const files = readdirSync(recovery).map((f) => readFileSync(join(recovery, f), "utf8"));
    expect(files).toHaveLength(1);
    expect(files[0]).toContain("recovery words");
    expect(files[0]).toContain("lar-draft-base-bag: working");
    expect(files[0]).toContain("lar-draft-base-heads: abc");
    expect(files[0]).not.toContain("secret");
    await temp.put({ tiddler: { title, text: "new shadow secret" } }, origin);
    await draft.put({ tiddler: { title, text: "updated recovery", "draft.of": "Note", "lar-draft-base-bag": "working", "lar-draft-base-heads": "def" } }, origin);
    await mountedDiskProjector()!.idle();
    const updated = readdirSync(recovery).map((f) => readFileSync(join(recovery, f), "utf8"));
    expect(updated).toHaveLength(1);
    expect(updated[0]).toContain("updated recovery");
    expect(updated[0]).toContain("lar-draft-base-heads: def");
    expect(updated[0]).not.toContain("secret");
  } finally { await stop(); }
}, 60_000);

test("recovery restart removes a tombstoned draft even when a different bag shadows its title", async () => {
  const { MemoryTiddlerStore } = await import("../../lararium-tw5/src/memory-store.js");
  root = mkdtempSync(join(tmpdir(), "lar-recovery-tombstone-restart-"));
  const recovery = join(root, "recovery");
  const bases = join(root, "bases");
  const draft = new MemoryTiddlerStore("draft");
  const origin = { kind: "operator-import", sessionId: "test" } as const;
  const deleted = "Draft of 'Deleted'";
  const retained = "Draft of 'Retained'";
  await draft.put({ tiddler: { title: deleted, text: "remove me" } }, origin);
  await draft.put({ tiddler: { title: retained, text: "keep me" } }, origin);
  const wiki = {
    allTitles: () => [deleted, retained],
    getTiddler: (title: string) => ({ fields: { title, "$origin-bag": "temp" } }),
    addEventListener: () => {}, removeEventListener: () => {},
  };
  const mount = () => new LarDiskProjector({
    mirrors: [{ bagId: "draft", mirrorRoot: recovery, mirrorClass: "recovery" }],
    recoveryStore: () => draft,
    recoveryFileFn: async (fields) => nativeFile(fields.title as string, fields.text as string),
    carrierFileFn: async () => null,
    bagsHolding: async (title) => (await draft.get(title))?.meta?.deleted ? ["temp"] : ["draft", "temp"],
    syncedTree: new SyncedTree(bases),
  });
  const first = mount();
  const stopFirst = first.start({ $tw: { wiki } } as never);
  await first.idle();
  expect(readdirSync(recovery).sort()).toEqual([`${deleted}.tid`, `${retained}.tid`].sort());
  await stopFirst();
  await draft.tombstone(deleted, origin);
  const second = mount();
  const stopSecond = second.start({ $tw: { wiki } } as never);
  try {
    await second.idle();
    expect(readdirSync(recovery)).toEqual([`${retained}.tid`]);
    expect(readFileSync(join(recovery, `${retained}.tid`), "utf8")).toContain("keep me");
  } finally { await stopSecond(); }
});

test("multi-bag cleanup preserves co-rooted and live drafts across shadow and absent views", async () => {
  const { MemoryTiddlerStore } = await import("../../lararium-tw5/src/memory-store.js");
  root = mkdtempSync(join(tmpdir(), "lar-recovery-multi-cleanup-"));
  const shared = join(root, "shared");
  const separate = join(root, "separate");
  const ordinary = join(root, "ordinary");
  const stores = new Map(["draft-a", "draft-b", "draft-c"].map((bag) => [bag, new MemoryTiddlerStore(bag)]));
  const origin = { kind: "operator-import", sessionId: "test" } as const;
  const title = "lar:///test.multi.draft/shadow";
  const absent = "lar:///test.multi.draft/absent";
  for (const bag of ["draft-a", "draft-b", "draft-c"]) {
    await stores.get(bag)!.put({ tiddler: { title, text: "shared words" } }, origin);
  }
  await stores.get("draft-c")!.put({ tiddler: { title: absent, text: "live absent-view draft" } }, origin);
  let shadow = true;
  let workingHeld = true;
  const wiki = {
    allTitles: () => [title, absent],
    getTiddler: (uri: string) => shadow && uri === title ? { fields: { title: uri, "$origin-bag": "temp" } }
      : workingHeld && uri === absent ? { fields: { title: uri, "$origin-bag": "working" } } : undefined,
    addEventListener: () => {}, removeEventListener: () => {},
  };
  const projector = new LarDiskProjector({
    mirrors: [
      { bagId: "draft-a", mirrorRoot: shared, mirrorClass: "recovery" },
      { bagId: "draft-b", mirrorRoot: shared, mirrorClass: "recovery" },
      { bagId: "draft-c", mirrorRoot: separate, mirrorClass: "recovery" },
      { bagId: "working", mirrorRoot: ordinary },
    ],
    recoveryStore: (bag) => stores.get(bag) ?? null,
    recoveryFileFn: async (fields) => nativeFile(fields.title as string, fields.text as string),
    carrierFileFn: async (uri) => nativeFile(uri, "ordinary words"),
    bagsHolding: async (uri) => {
      const held: string[] = [];
      for (const [bag, store] of stores) {
        const record = await store.get(uri);
        if (record && !record.meta?.deleted) held.push(bag);
      }
      if (shadow && uri === title) held.push("temp");
      if (workingHeld && uri === absent) held.push("working");
      return held;
    },
    syncedTree: new SyncedTree(join(root, "bases")),
  });
  const stop = projector.start({ $tw: { wiki } } as never);
  try {
    await projector.idle();
    const sharedFile = join(shared, "test.multi.draft", "shadow.tid");
    const separateFile = join(separate, "test.multi.draft", "shadow.tid");
    const absentFile = join(separate, "test.multi.draft", "absent.tid");
    const ordinaryFile = join(ordinary, "test.multi.draft", "absent.tid");
    expect(readFileSync(sharedFile, "utf8")).toContain("shared words");
    expect(readFileSync(separateFile, "utf8")).toContain("shared words");
    expect(readFileSync(absentFile, "utf8")).toContain("live absent-view draft");
    expect(readFileSync(ordinaryFile, "utf8")).toContain("ordinary words");
    await stores.get("draft-a")!.tombstone(title, origin);
    await projector.idle();
    expect(readFileSync(sharedFile, "utf8")).toContain("shared words");
    expect(readFileSync(separateFile, "utf8")).toContain("shared words");
    await stores.get("draft-b")!.tombstone(title, origin);
    await projector.idle();
    expect(existsSync(sharedFile)).toBe(false);
    expect(readFileSync(separateFile, "utf8")).toContain("shared words");
    shadow = false;
    workingHeld = false;
    await projector.sense([title, absent]);
    expect(readFileSync(separateFile, "utf8")).toContain("shared words");
    expect(readFileSync(absentFile, "utf8")).toContain("live absent-view draft");
    expect(existsSync(ordinaryFile)).toBe(false);
  } finally { await stop(); }
});

test.each([false, true])("recovery grant gates a drain even without a receipt capability (grant=%s)", async (grant) => {
  root = mkdtempSync(join(tmpdir(), "lar-recovery-no-receipt-"));
  const r = await shoreRig();
  await r.adaptor.armSeedCheckpoint();
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  let checks = 0;
  const projector = new LarDiskProjector({
    mirrors: grant ? [{ bagId: draftBag, mirrorRoot: root, mirrorClass: "recovery" }] : [],
    carrierFileFn: async () => null,
    recoveryStore: (bag) => bag === draftBag ? r.draft : null,
    recoveryFileFn: async (fields) => nativeFile(String(fields.title), String(fields.text)),
  });
  const stop = projector.start(r.engine);
  r.adaptor.recoveryAtRest = async (bag, title, fields) => {
    if (grant) { checks++; await held; }
    await projector.recoveryAtRest(bag, title, fields);
  };
  try {
    const title = openDraft(r, "No door", "first");
    await afterDispatch(); await turns(30);
    typeInto(r, title, "second");
    await afterDispatch(); await turns(30);
    const writes = () => r.calls.filter((call) => call.bag === draftBag && call.puts.includes(title)).length;
    expect(writes(), "the granted file receipt holds the next write without a receipt capability").toBe(grant ? 1 : 2);
    if (grant) expect(checks).toBe(1);
  } finally {
    release(); r.adaptor.recoveryAtRest = null;
    await stop(); await r.stop();
  }
}, 60_000);

test("a record superseding the written snapshot before receipt capture cannot acknowledge it", async () => {
  root = mkdtempSync(join(tmpdir(), "lar-recovery-supersede-"));
  const r = await shoreRig();
  await r.adaptor.armSeedCheckpoint();
  const projector = new LarDiskProjector({
    mirrors: [{ bagId: draftBag, mirrorRoot: root, mirrorClass: "recovery" }],
    carrierFileFn: async () => null,
    recoveryStore: (bag) => bag === draftBag ? r.draft : null,
    recoveryFileFn: async (fields) => nativeFile(String(fields.title), String(fields.text)),
  });
  const stop = projector.start(r.engine);
  const asks: Array<{ requestId: string }> = [];
  const capability = makeReceiptCapability({ post: (m) => { if (m.type === "receipt:request") asks.push(m); }, handles: () => new Map(Object.entries(r.handles)), mintId: () => `supersede-${asks.length}` });
  r.adaptor.caps.receipt = capability;
  let receiptDone!: () => void;
  const receipt = new Promise<void>((resolve) => { receiptDone = resolve; });
  r.adaptor.recoveryAtRest = async (bag, title, fields) => {
    const written = await r.draft.get(title);
    if (!written) throw new Error("missing written snapshot");
    await r.draft.put({ ...written, tiddler: { ...written.tiddler, text: "external successor" } }, { kind: "crdt-remote", edgeIsland: "other" });
    try { await projector.recoveryAtRest(bag, title, fields); } finally { receiptDone(); }
  };
  try {
    const title = openDraft(r, "Superseded", "written snapshot");
    await afterDispatch();
    await expect.poll(() => asks.length).toBe(1);
    capability.answer({ type: "receipt:issued", requestId: asks[0]!.requestId, issued: true });
    await receipt; await turns(30); await projector.idle();
    expect(readFileSync(join(root, `${title}.tid`), "utf8")).toContain("external successor");
    expect(r.adaptor.pendingTitles(), "the successor cannot prove the earlier write").toContain(title);
  } finally {
    capability.close(); r.adaptor.caps.receipt = null; r.adaptor.recoveryAtRest = null;
    await stop(); await r.stop();
  }
}, 60_000);

test("recovery receipt verifies bytes and refuses render faults and teardown", async () => {
  root = mkdtempSync(join(tmpdir(), "lar-recovery-receipt-"));
  const r = await shoreRig();
  await r.adaptor.armSeedCheckpoint();
  let renderFault = false;
  const projector = new LarDiskProjector({
    mirrors: [{ bagId: draftBag, mirrorRoot: root, mirrorClass: "recovery" }],
    carrierFileFn: async () => null,
    recoveryStore: (bag) => bag === draftBag ? r.draft : null,
    recoveryFileFn: async (fields) => {
      if (renderFault) throw new Error("render fault");
      return nativeFile(String(fields.title), String(fields.text));
    },
  });
  const stop = projector.start(r.engine);
  let stopped = false;
  try {
    const title = openDraft(r, "Receipt", "written");
    await afterDispatch(); await turns(30); await projector.idle();
    const fields = (await r.draft.get(title))!.tiddler;
    await expect(projector.recoveryAtRest(draftBag, title, fields)).resolves.toBeUndefined();
    renderFault = true;
    await expect(projector.recoveryAtRest(draftBag, title, fields)).rejects.toThrow("render fault");
    renderFault = false;
    writeFileSync(join(root, `${title}.tid`), tidBody(title, "tampered"));
    await expect(projector.recoveryAtRest(draftBag, title, fields)).rejects.toThrow(/conflicting|not written/);
    await stop(); stopped = true;
    await expect(projector.recoveryAtRest(draftBag, title, fields)).rejects.toThrow(/unavailable|stopped/);
  } finally {
    if (!stopped) await stop();
    await r.stop();
  }
}, 60_000);

test("a recovery mirror write fault cannot produce a file receipt", async () => {
  root = mkdtempSync(join(tmpdir(), "lar-recovery-write-fault-"));
  const blocked = join(root, "not-a-directory");
  writeFileSync(blocked, "blocks mkdir");
  const r = await shoreRig();
  await r.adaptor.armSeedCheckpoint();
  const projector = new LarDiskProjector({
    mirrors: [{ bagId: draftBag, mirrorRoot: blocked, mirrorClass: "recovery" }],
    carrierFileFn: async () => null,
    recoveryStore: (bag) => bag === draftBag ? r.draft : null,
    recoveryFileFn: async (fields) => nativeFile(String(fields.title), String(fields.text)),
  });
  const stop = projector.start(r.engine);
  try {
    const title = openDraft(r, "Write fault", "written");
    await afterDispatch(); await turns(30); await projector.idle();
    await expect(projector.recoveryAtRest(draftBag, title, (await r.draft.get(title))!.tiddler)).rejects.toThrow();
    expect(readFileSync(blocked, "utf8")).toBe("blocks mkdir");
  } finally { await stop(); await r.stop(); }
}, 60_000);


test.each(["storage", "projection"] as const)("real storage and recovery file both gate the next drain (hold %s)", async (hold) => {
  root = mkdtempSync(join(tmpdir(), "recovery-homed-"));
  const storage = join(root, "store");
  const mirror = join(root, "mirror");
  const r = await shoreRig();
  const vessel = restingRepo(storage, { saveDebounceRate: 60_000 });
  const channel = new MessageChannel();
  let ready!: (peer: string) => void;
  const leg = new Promise<string>((resolve) => { ready = resolve; });
  attachMessageChannelSync(r.repo as never, channel.port1 as unknown as MessagePort);
  attachMessageChannelSync(vessel, channel.port2 as unknown as MessagePort, ready);
  await leg;
  await r.adaptor.armSeedCheckpoint();
  let release!: () => void;
  let started!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  const reached = new Promise<void>((resolve) => { started = resolve; });
  let firstStorage = true;
  let firstRender = true;
  const vesselCaps: CapabilityRecord = {};
  vesselCaps.receipt = async (ids, heads) => {
    if (hold === "storage" && firstStorage) { firstStorage = false; started(); await held; }
    await receiptInStore(vessel, ids, { ready: leg, onClose: () => () => {} }, heads);
  };
  const projector = new LarDiskProjector({
    mirrors: [{ bagId: draftBag, mirrorRoot: mirror, mirrorClass: "recovery" }],
    carrierFileFn: async () => null,
    recoveryStore: (bag) => bag === draftBag ? r.draft : null,
    recoveryFileFn: async (fields) => {
      if (hold === "projection" && firstRender) { firstRender = false; started(); await held; }
      return nativeFile(String(fields.title), String(fields.text));
    },
  });
  const stopProjector = projector.start(r.engine);
  r.adaptor.recoveryAtRest = (bag, title, fields) => projector.recoveryAtRest(bag, title, fields);
  let storedReplies = 0;
  const capability = makeReceiptCapability({
    post: (message) => { if (message.type === "receipt:request") void answerReceipt(vesselCaps, message).then((reply) => { if (reply.issued) storedReplies++; capability.answer(reply); }); },
    handles: () => new Map(Object.entries(r.handles)),
  });
  r.adaptor.caps.receipt = capability;
  try {
    const title = openDraft(r, "Homed proof", "first");
    await afterDispatch();
    await reached;
    await turns(40);
    typeInto(r, title, "latest");
    await afterDispatch(); await turns(40);
    const count = () => r.calls.filter((call) => call.bag === draftBag && call.puts.includes(title)).length;
    expect(count(), "the held receipt prevents the next drain").toBe(1);
    release();
    for (let i = 0; i < 200 && count() < 2; i++) await new Promise<void>((resolve) => setTimeout(resolve, 5));
    expect(count()).toBe(2);
    await turns(50);
    r.adaptor.requestDrain(); // A superseded projection receipt waits for the next explicit request.
    for (let i = 0; i < 200; i++) {
      await projector.idle();
      const path = join(mirror, `${title}.tid`);
      if (existsSync(path) && readFileSync(path, "utf8") === tidBody(title, "latest") && storedReplies >= 2 && !r.adaptor.pendingTitles().includes(title)) break;
      await new Promise<void>((resolve) => setTimeout(resolve, 5));
    }
    expect(readFileSync(join(mirror, `${title}.tid`), "utf8")).toBe(tidBody(title, "latest"));
    expect(storedReplies, "both generations reached the storage-backed receipt capability").toBeGreaterThanOrEqual(2);
    expect((await new DurableNodeFSStorageAdapter(storage).loadRange([r.draftHandle.documentId])).length).toBeGreaterThan(0);
    expect(r.adaptor.pendingTitles()).not.toContain(title);
  } finally {
    release(); capability.close(); r.adaptor.caps.receipt = null; r.adaptor.recoveryAtRest = null; delete vesselCaps.receipt;
    await stopProjector(); await r.stop(); channel.port1.close(); channel.port2.close(); await restEvery();
  }
}, 60_000);

test.each([false, true])("deletion waits for the recovery file to clear and retries a conflicting file (conflict=%s)", async (conflict) => {
  root = mkdtempSync(join(tmpdir(), "recovery-delete-receipt-"));
  const r = await shoreRig();
  await r.adaptor.armSeedCheckpoint();
  const projector = new LarDiskProjector({
    mirrors: [{ bagId: draftBag, mirrorRoot: root, mirrorClass: "recovery" }],
    carrierFileFn: async () => null,
    recoveryStore: (bag) => bag === draftBag ? r.draft : null,
    recoveryFileFn: async (fields) => nativeFile(String(fields.title), String(fields.text)),
  });
  const stopProjector = projector.start(r.engine);
  let checks = 0;
  r.adaptor.recoveryAtRest = (bag, title, fields) => { checks++; return projector.recoveryAtRest(bag, title, fields); };
  try {
    const title = openDraft(r, "Delete receipt", "first");
    const path = join(root, `${title}.tid`);
    await afterDispatch();
    for (let i = 0; i < 200 && !existsSync(path); i++) await new Promise<void>((resolve) => setTimeout(resolve, 5));
    await projector.idle(); await turns(40);
    expect(readFileSync(path, "utf8")).toBe(tidBody(title, "first"));
    const before = checks;
    if (conflict) writeFileSync(path, tidBody(title, "independent disk edit"));
    r.wiki.deleteTiddler(title);
    await afterDispatch(); await turns(60); await projector.idle(); await turns(30);
    if (conflict) {
      expect(readFileSync(path, "utf8")).toBe(tidBody(title, "independent disk edit"));
      expect.soft(r.adaptor.pendingTitles(), "a retained file keeps the deletion receipt owed").toContain(title);
      r.adaptor.requestDrain(); await turns(50);
      expect.soft(checks, "retry rechecks the deletion receipt").toBeGreaterThan(before + 1);
      expect.soft(r.adaptor.pendingTitles()).toContain(title);
    } else {
      expect(existsSync(path), "CONTROL: the agreed file clears").toBe(false);
      expect(r.adaptor.pendingTitles()).not.toContain(title);
    }
  } finally {
    r.adaptor.recoveryAtRest = null; await stopProjector(); await r.stop();
  }
}, 60_000);
