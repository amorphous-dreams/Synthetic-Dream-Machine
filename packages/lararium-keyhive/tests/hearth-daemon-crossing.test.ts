/**
 * hearth-daemon-crossing (road row `L4f`) — a leaf at its own hearth mounts the hearth's daemon working document as its
 * daemon wiki's working slot.
 *
 * The vessel hands the resolver the document its worn face's signed log names for this device at its own hearth
 * (`hearthWorking`). Reds: the working device slot answers that document, the control row names it, the vessel's sealed map
 * hears it first, and no document mints; a leaf that already stood a slot of its own turns to the hearth's. Controls: the
 * draft and personal slots stay this device's own; a resolver handed no hearth document mints its own working slot.
 */
import { describe, expect, test } from "vitest";
import { CompositeStore } from "@lararium/mesh/composite-store";
import { CONTROL_HOME_ID } from "@lararium/mesh/lar-uris";
import { didFromVerifyingKey } from "@lararium/mesh/lar-did";
import { makeIslandRepo } from "@lararium/mesh/island-repo-door";
import { MemoryTiddlerStore } from "@lararium/tw5";
import { makeSlotDocResolver } from "../src/slot-doc-resolver.js";

const VERIFYING_KEY = "ab".repeat(32);
const DID = didFromVerifyingKey(VERIFYING_KEY);
const HEARTH = "automerge:2ARFJdpz2HKbLsTDVVSnPkKjTpWD";
const row = (kind: string) => `${CONTROL_HOME_ID}/daemon-slot/${kind}/face`;

function rig(hearthWorking?: () => string | null) {
  const repo = makeIslandRepo({ syncPort: new MessageChannel().port1 });
  const control = new CompositeStore();
  control.addLayer({ bagId: CONTROL_HOME_ID, store: new MemoryTiddlerStore(CONTROL_HOME_ID), writable: true, defaultWritable: true });
  const events: string[] = [];
  const minter = {
    create: (v: never) => { events.push("create"); return repo.create(v); },
    import: (bytes: Uint8Array, args: { docId: never }) => { events.push("import"); return repo.import(bytes, args as never); },
    flush: (ids?: string[]) => repo.flush(ids as never),
  };
  const resolver = makeSlotDocResolver({ repo: minter as never, daemonStore: control, control, catalog: null, vesselDid: () => DID, mintedByHex: () => VERIFYING_KEY,
    personaGroupId: "face", faceSeated: async () => true, faceDoor: { mint: async () => {} } as never, deviceScoped: (slug) => slug === "daemon",
    announceDevice: (kind, documentId) => { events.push(`announce:${kind}:${documentId}`); },
    ...(hearthWorking ? { hearthWorking } : {}) });
  const named = async (kind: string) => (await control.get(row(kind)))?.tiddler.text;
  return { repo, resolver, events, named };
}

describe("the daemon wiki's working slot at the leaf's own hearth", () => {
  test("RED: the working slot answers the hearth's document, its control row names it, the sealed map hears it, and nothing mints", async () => {
    const r = rig(() => HEARTH);
    const slot = await r.resolver.slotDoc("daemon", "working");
    expect(slot?.url).toBe(HEARTH);
    expect(await r.named("working")).toBe(HEARTH);
    expect(r.events).toEqual([`announce:working:${HEARTH.replace(/^automerge:/, "")}`]);
    expect((await r.resolver.slotDoc("daemon", "working", { mint: false }))?.url).toBe(HEARTH);
    await r.repo.shutdown();
  });

  test("RED: a leaf that stood a working slot of its own turns to the hearth's document once its face's log names one", async () => {
    let hearth: string | null = null;
    const r = rig(() => hearth);
    const own = await r.resolver.slotDoc("daemon", "working");
    expect(own?.url).not.toBe(HEARTH);
    hearth = HEARTH;
    expect((await r.resolver.slotDoc("daemon", "working"))?.url).toBe(HEARTH);
    expect(await r.named("working")).toBe(HEARTH);
    await r.repo.shutdown();
  });

  test("CONTROL: the draft and personal slots stay this device's own, and a resolver handed no hearth document mints its own working slot", async () => {
    const r = rig(() => HEARTH);
    for (const kind of ["draft", "personal"] as const) {
      const slot = await r.resolver.slotDoc("daemon", kind);
      expect(slot?.url, kind).not.toBe(HEARTH);
      expect(await r.named(kind), kind).toBe(slot?.url);
    }
    const bare = rig();
    const own = await bare.resolver.slotDoc("daemon", "working");
    expect(own?.url).toBeTruthy();
    expect(own?.url).not.toBe(HEARTH);
    expect(bare.events).toContain("import");
    await r.repo.shutdown(); await bare.repo.shutdown();
  });
});
