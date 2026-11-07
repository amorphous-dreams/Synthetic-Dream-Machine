import { expect, test } from "vitest";
import { AutomergeDocStore, CompositeStore, didFromVerifyingKey, emptyLarDoc, storedLarRecord, wikiSlotUri, wikiWorkingFloorKey, type LarDoc } from "@lararium/mesh";
import { FACE_GRANT_PREFIX } from "../src/face-grant-record.js";
import { makeFaceSeat } from "../src/face-seat.js";
import { liftVesselOnlyIntoFace } from "../src/anon-lift.js";

test("retry after a failed flush in the SAME process (one Repo) does not restore a title removed from the rebound working store", async () => {
  const anchor = { kind: "place", aid: "Etest" } as const;
  const key = wikiWorkingFloorKey("daemon", anchor);
  const bag = wikiSlotUri("daemon", "working");
  const docs = new Map<string, LarDoc>([
    ["floor", emptyLarDoc()],
    ["face", emptyLarDoc()],
    ["catalog", emptyLarDoc()],
  ]);
  function handle(url: string) {
    const state = docs.get(url)!;
    return {
      url,
      documentId: url,
      doc: () => state,
      heads: () => [],
      on: () => () => {},
      change: (fn: (d: LarDoc) => void) => fn(state),
      remove: () => {},
    };
  }
  const floor = handle("floor"), face = handle("face"), catalog = handle("catalog");
  floor.change(d => {
    d.tiddlers.moved = storedLarRecord("moved", { text: "old" }, "test");
    d.tiddlers.kept = storedLarRecord("kept", { text: "keep" }, "test");
  });
  catalog.change(d => { d.tiddlers[key] = storedLarRecord(key, { text: "floor", "face-reach": "vessel-only", "minted-by": "vessel" }, "test"); });
  let failFlush = true;
  // ONE Repo across the retry: the same process, the same repo instance, so the in-memory carry skips survive into the retry. The reopened
  // Repo (a restart that lost the half-written destination) is anon-veil-lift's O3 test: it carries everything again and burns nothing.
  const repo = {
    find: async () => handle("floor"),
    create: () => { throw Error("unexpected create"); },
    flush: async (ids?: string[]) => { if (failFlush && ids?.includes("face")) throw new Error("flush failed"); },
    delete: () => handle("floor").remove(),
  };
  const openArgs = () => {
    const floorHandle = handle("floor");
    const faceHandle = handle("face");
    const catalogHandle = handle("catalog");
    const composite = new CompositeStore();
    composite.addLayer({ bagId: bag, store: new AutomergeDocStore(floorHandle as never, bag), writable: true });
    return {
      composite,
      args: {
        repo: repo as never,
        daemonStore: composite,
        catalog: { handle: async () => catalogHandle } as never,
        faceDoor: { mint: async () => ({ docId: "face" }) } as never,
        mintedByHex: "vessel",
        vesselDid: didFromVerifyingKey("ab".repeat(32)),
        traceOf: async () => null,
        working: {
          anchor,
          urlOf: async () => "face",
          open: async () => faceHandle,
          rebind: () => {
            const at = composite.layerIndexOf(bag);
            composite.removeLayer(bag);
            composite.addLayer({ bagId: bag, store: new AutomergeDocStore(faceHandle as never, bag), writable: true }, at);
          },
        },
      } as never,
    };
  };
  const first = openArgs();
  await expect(liftVesselOnlyIntoFace(first.args)).rejects.toThrow("flush failed");
  const skipOnly = floor.doc().tiddlers["$:/lares/anon-lift/working-carried-to"]?.tiddler as Record<string, unknown> | undefined;
  expect(skipOnly?.text, "a failed destination flush records skip history but no carried destination marker").toBeUndefined();
  expect(first.composite.layerIndexOf(bag)).toBeGreaterThanOrEqual(0);
  face.change(d => { delete d.tiddlers.moved; }); // MOVE hard-removes its source.
  failFlush = false;
  const restarted = openArgs();
  await liftVesselOnlyIntoFace(restarted.args);
  expect(Object.keys(face.doc().tiddlers)).toEqual(["kept"]);
});

test("a pending grant, working attach and lift leave subsequent writes on the face", async () => {
  const anchor = { kind: "place", aid: "Etest" } as const;
  const key = wikiWorkingFloorKey("daemon", anchor);
  const bag = wikiSlotUri("daemon", "working");
  const docs = new Map<string, ReturnType<typeof handle>>();
  function handle(url: string) {
    const state = emptyLarDoc(); let deleted = false;
    return { url, documentId: url, doc: () => state, heads: () => [], on: () => () => {},
      change: (fn: (d: LarDoc) => void) => { if (deleted) throw new Error("deleted handle"); fn(state); },
      remove: () => { deleted = true; } };
  }
  const floor = handle("floor"), face = handle("face"), catalog = handle("catalog");
  docs.set("floor", floor); docs.set("face", face);
  catalog.change(d => { d.tiddlers[key] = storedLarRecord(key, { text: "floor", "face-reach": "vessel-only", "minted-by": "vessel" }, "test"); });
  const composite = new CompositeStore();
  const repo = { find: async (url: string) => docs.get(url)!, create: () => { throw Error("unexpected create"); }, flush: async () => {}, delete: (url: string) => docs.get(url)!.remove() };
  let seated = false, grant = false, liftError: unknown;
  let done!: () => void;
  const lifted = new Promise<void>(resolve => { done = resolve; });
  const seat = makeFaceSeat({ group: "group", selfVerifyingKey: "self", personaRootDid: "root", personaKel: { prefix: "root", chain: [] },
    knowsAgent: async () => seated, grants: async () => grant ? [{ title: `${FACE_GRANT_PREFIX}group/self`, record: { sig: "sig", capEvents: [], founderEdge: { deviceVerifyingKey: "f0" } } as never }] : [],
    founderStanding: async () => "clear", verify: async () => ({ ok: true }), ingest: async () => { seated = true; },
    lift: async () => { try { await liftVesselOnlyIntoFace({ repo: repo as never, daemonStore: composite, catalog: { handle: async () => catalog } as never,
      faceDoor: { mint: async () => ({ docId: "face" }) } as never, mintedByHex: "vessel", vesselDid: didFromVerifyingKey("ab".repeat(32)),
      traceOf: async () => null, working: { anchor, urlOf: async () => "face", open: async () => face,
        rebind: (slug: string, oldUrl: string, newUrl: string) => { if (slug === "daemon" && oldUrl === "floor" && newUrl === "face") {
          const at = composite.layerIndexOf(bag); composite.removeLayer(bag); composite.addLayer({ bagId: bag, store: new AutomergeDocStore(face as never, bag), writable: true }, at);
        } },
      },
    } as never); } catch (error) { liftError = error; } finally { done(); } }, log: () => {} });
  expect(await seat.run()).toBe(false);
  composite.addLayer({ bagId: bag, store: new AutomergeDocStore(floor as never, bag), writable: true });
  grant = true; await seat.run(); await lifted;
  expect(liftError).toBeUndefined();
  await expect(composite.put({ tiddler: { title: "after", text: "landed" } }, { kind: "test" })).resolves.toBeUndefined();
  expect(face.doc().tiddlers.after).toBeDefined();
});

test("destination flush completes before marker, and a marker fault permits a safe retry", async () => {
  const anchor = { kind: "place", aid: "Etest" } as const;
  const key = wikiWorkingFloorKey("daemon", anchor);
  const marker = "$:/lares/anon-lift/working-carried-to";
  let destinationFlushed = false, markerAttempted = false, fault = true;
  const events: string[] = [];
  function handle(url: string) {
    const state = emptyLarDoc();
    return { url, documentId: url, doc: () => state, heads: () => [], on: () => () => {}, remove: () => {},
      change: (fn: (d: LarDoc) => void) => {
        if (url === "floor" && destinationFlushed && !markerAttempted) {
          markerAttempted = true; events.push("marker");
          if (fault) throw new Error("marker fault");
        }
        fn(state);
      } };
  }
  const floor = handle("floor"), face = handle("face"), catalog = handle("catalog");
  floor.change(d => { d.tiddlers.saved = storedLarRecord("saved", { text: "content" }, "test"); });
  catalog.change(d => { d.tiddlers[key] = storedLarRecord(key, { text: "floor", "face-reach": "vessel-only", "minted-by": "vessel" }, "test"); });
  const composite = new CompositeStore();
  const repo = { find: async () => floor, create: () => { throw Error("unexpected"); }, delete: () => {},
    flush: async (ids?: string[]) => { if (ids?.includes("face")) {
      events.push("destination flush");
      const mark = floor.doc().tiddlers[marker]?.tiddler as Record<string, unknown> | undefined;
      expect(mark?.text, "destination flush runs before a durable carried-destination marker is set").toBeUndefined();
      destinationFlushed = true;
    } } };
  const args = { repo: repo as never, daemonStore: composite, catalog: { handle: async () => catalog } as never,
    faceDoor: { mint: async () => ({ docId: "face" }) } as never, mintedByHex: "vessel", vesselDid: didFromVerifyingKey("ab".repeat(32)),
    traceOf: async () => null, working: { anchor, urlOf: async () => "face", open: async () => face } } as never;
  await expect(liftVesselOnlyIntoFace(args)).rejects.toThrow("marker fault");
  expect(events).toEqual(["destination flush", "marker"]);
  const retryMark = floor.doc().tiddlers[marker]?.tiddler as Record<string, unknown> | undefined;
  expect(retryMark?.text, "a marker fault leaves skip history only, not a carried destination marker").toBeUndefined();
  fault = false;
  await liftVesselOnlyIntoFace(args);
  expect(Object.keys(face.doc().tiddlers)).toEqual(["saved"]);
  expect(String(face.doc().tiddlers.saved.tiddler.text)).toBe("content");
});

test("a STALLED destination flush names the DESTINATION as waiting on rest, so the seat does not re-lift every bound — CONTROL: a pending SOURCE names itself as waiting on arrival, and its arrival wakes exactly one more lift", async () => {
  const anchor = { kind: "place", aid: "Etest" } as const;
  const key = wikiWorkingFloorKey("daemon", anchor);
  const bag = wikiSlotUri("daemon", "working");
  const docs = new Map<string, LarDoc>([["floor", emptyLarDoc()], ["face", emptyLarDoc()], ["catalog", emptyLarDoc()]]);
  let floorArrives: (() => void) | null = null;
  const floorReady = new Promise<void>((resolve) => { floorArrives = resolve; });
  const handle = (url: string) => {
    const state = docs.get(url)!;
    return { url, documentId: url, doc: () => state, heads: () => [], on: () => () => {}, change: (fn: (d: LarDoc) => void) => fn(state), remove: () => {},
      whenReady: async () => { if (url === "floor" && floorArrives) await floorReady; } };
  };
  handle("floor").change(d => { d.tiddlers.kept = storedLarRecord("kept", { text: "keep" }, "test"); });
  handle("catalog").change(d => { d.tiddlers[key] = storedLarRecord(key, { text: "floor", "face-reach": "vessel-only", "minted-by": "vessel" }, "test"); });
  let stallFaceFlush = true;
  const repo = {
    find: async (u: string) => handle(u), create: () => { throw Error("unexpected create"); },
    flush: (ids?: string[]) => stallFaceFlush && ids?.includes("face") ? new Promise<void>(() => {}) : Promise.resolve(), delete: () => {},
  };
  const composite = new CompositeStore();
  composite.addLayer({ bagId: bag, store: new AutomergeDocStore(handle("floor") as never, bag), writable: true });
  const args = {
    repo, daemonStore: composite, catalog: { handle: async () => handle("catalog") }, faceDoor: { mint: async () => ({ docId: "face" }) },
    mintedByHex: "vessel", vesselDid: didFromVerifyingKey("ab".repeat(32)), traceOf: async () => null, readBoundMs: 20,
    working: { anchor, urlOf: async () => "face", open: async () => handle("face"), rebind: () => {} },
  } as never;
  const warn = console.warn; console.warn = () => {};
  try {
    let lifts = 0;
    const results: Array<{ url: string; waits: string }[]> = [];
    // The daemon's mapping: an arrival waits on `whenReady`, a rest waits on a flush of the document.
    const seat = makeFaceSeat({
      group: "g", selfVerifyingKey: "self", personaRootDid: "root",
      knowsAgent: async () => true, grants: async () => [], founderStanding: async () => "clear", verify: async () => ({ ok: true }), ingest: async () => {},
      lift: async () => {
        lifts++;
        const r = await liftVesselOnlyIntoFace(args);
        results.push(r.skippedDocs.map(({ url, waits }) => ({ url, waits })));
        return { skipped: r.skipped.length, arrivals: r.skippedDocs.map(({ url, waits }) => repo.find(url).then((h) => waits === "arrival" ? h.whenReady() : repo.flush([h.documentId]))) };
      },
      log: () => {},
    } as never);
    // CONTROL: the floor (source) has not arrived: the skip names the SOURCE, waiting on arrival; nothing re-lifts until it arrives.
    await seat.run();
    await new Promise(r => setTimeout(r, 150));
    expect(results[0]).toEqual([{ url: "floor", waits: "arrival" }]);
    expect(lifts, "a pending source wakes nothing on its own").toBe(1);
    floorArrives!(); floorArrives = null;
    await new Promise(r => setTimeout(r, 150));
    expect(lifts, "the source's arrival wakes exactly one more lift").toBe(2);
    // RED: that lift read the source and stalled on the DESTINATION flush: the skip names the destination, waiting on rest (never the ready source).
    expect(results[1]).toEqual([{ url: "face", waits: "rest" }]);
    await new Promise(r => setTimeout(r, 300));
    expect(lifts, "a stalled destination flush never re-lifts by itself (the old code re-lifted every bound)").toBe(2);
    // The destination rests: its flush wakes one more pass, which carries the floor through.
    stallFaceFlush = false;
    await new Promise(r => setTimeout(r, 200));
    expect(lifts).toBeGreaterThanOrEqual(2);
  } finally { console.warn = warn; }
});
