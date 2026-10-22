/**
 * vessel-assembly-system-canon — W26 slice 3: the keel mounts the live `lares` and `lararium` documents only from what
 * the shore NAMES (`keel.systemCanon`, the Kahu realm's registrations), and from nothing else.
 *
 * Proven: documents the shore names mount as writable canon layers (and ride the assembly); a shore that names none
 * mounts none; a stale catalog pointer row for either bag mounts nothing (the rows retire: no second home); a
 * naming of one bag alone mounts that bag alone.
 */
import { describe, expect, test } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { assembleVessel, type VesselKeel } from "../src/open-vessel-core.js";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";
import { storedLarRecord } from "../src/stored-record.js";
import { BAG_IDS, LARES_DOC_URI, LARARIUM_DOC_URI } from "../src/lar-uris.js";

type Docs = { readonly lares: string; readonly lararium: string };

function rig(naming?: (docs: Docs) => { lares?: string; lararium?: string }, staleRows = false) {
  const repo = new Repo();
  const daemon = repo.create<LarDoc>(emptyLarDoc());
  const lares = repo.create<LarDoc>(emptyLarDoc());
  const lararium = repo.create<LarDoc>(emptyLarDoc());
  const catalog = repo.create<LarDoc>(emptyLarDoc());
  if (staleRows) catalog.change((d) => {
    d.tiddlers[LARES_DOC_URI] = storedLarRecord(LARES_DOC_URI, { text: lares.url, kind: "oracle" }, "stale");
    d.tiddlers[LARARIUM_DOC_URI] = storedLarRecord(LARARIUM_DOC_URI, { text: lararium.url, kind: "oracle" }, "stale");
  });
  const keel = {
    repo, catalogHandle: catalog,
    waitHandle: async <T>(url: string) => repo.find(url as never) as unknown as Promise<T>,
    loadGenesis: async () => ({ islandHandle: repo.create<LarDoc>(emptyLarDoc()), coreHash: "core", bootstrap: { daemonUrl: daemon.url, personaPlanes: [] } }),
    tempStore: () => ({}) as never,
    ...(naming ? { systemCanon: async () => naming({ lares: lares.url, lararium: lararium.url }) } : {}),
  } as unknown as VesselKeel;
  return { keel, lares, lararium };
}

describe("the keel mounts system canon from what the shore names", () => {
  test("the named documents mount as writable canon layers and ride the assembly", async () => {
    const r = rig((docs) => docs);
    const assembly = await assembleVessel(r.keel);
    expect(assembly.composite.hasWritableBag(BAG_IDS.lares)).toBe(true);
    expect(assembly.composite.hasWritableBag(BAG_IDS.lararium)).toBe(true);
    expect(assembly.laresHandle?.url).toBe(r.lares.url);
    expect(assembly.larariumHandle?.url).toBe(r.lararium.url);
  });

  test("CONTROLS: a shore that names none, a shore with no system canon, and a stale catalog row each mount none", async () => {
    for (const naming of [() => ({}), undefined] as const) {
      const r = rig(naming, true);                                                 // the stale rows ride beside it
      const assembly = await assembleVessel(r.keel);
      expect(assembly.composite.hasWritableBag(BAG_IDS.lares)).toBe(false);
      expect(assembly.composite.hasWritableBag(BAG_IDS.lararium)).toBe(false);
      expect(assembly.laresHandle).toBeNull();
      expect(assembly.larariumHandle).toBeNull();
    }
  });

  test("a naming of one bag alone mounts that bag alone", async () => {
    const r = rig((docs) => ({ lararium: docs.lararium }));
    const assembly = await assembleVessel(r.keel);
    expect(assembly.composite.hasWritableBag(BAG_IDS.lararium)).toBe(true);
    expect(assembly.composite.hasWritableBag(BAG_IDS.lares)).toBe(false);
    expect(assembly.laresHandle).toBeNull();
  });
});
