import { expect, test } from "vitest";
import { AutomergeDocStore, CompositeStore, didFromVerifyingKey, emptyLarDoc, storedLarRecord, wikiSlotUri, wikiWorkingFloorKey, type LarDoc } from "@lararium/mesh";
import { FACE_GRANT_PREFIX } from "../src/face-grant-record.js";
import { makeFaceSeat } from "../src/face-seat.js";
import { liftVesselOnlyIntoFace } from "../src/anon-lift.js";

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
  const seat = makeFaceSeat({ group: "group", leasePrefix: "lease/", selfVerifyingKey: "self", personaRootDid: "root", personaKel: { prefix: "root", chain: [] },
    knowsAgent: async () => seated, grants: async () => grant ? [{ title: `${FACE_GRANT_PREFIX}group/self`, record: { sig: "sig", capEvents: [] } as never }] : [],
    readLease: async () => ({ kind: "epoch", n: 0 }), verify: async () => ({ ok: true }), ingest: async () => { seated = true; },
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
