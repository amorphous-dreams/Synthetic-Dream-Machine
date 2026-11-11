/**
 * lit-face-slots — THE LIT SET ON THE DAEMON ISLAND (sealed-store#/the-lit-set): every lit face resolves its own instance slots
 * under its OWN secret, group and door, and a face-named INGEST's target lands in THAT face's own document, the owner read off
 * the control document.
 *
 *   L1 — FIRST: a sibling's working slot resolves from its own secret and differs from the worn face's; the daemon wiki's device
 *        slots stand under each face's own group in the control document
 *   L2 — the target for a named sibling resolves that sibling's own device slot (minted under its group) and names it owner
 *   L3 — the worn face (or no face named) resolves the composite's own layer, owner the worn face
 *   L4 — a face outside the lit set resolves nothing; a canon bag resolves by the face's relation alone, never another's
 *
 * Written beside the cure (written, unrun here; CI runs it).
 */
import { describe, expect, test } from "vitest";
import { makeIslandRepo } from "@lararium/mesh";
import { CompositeStore, CONTROL_HOME_ID, AutomergeDocStore, daemonFaceCanonBag, emptyLarDoc, mutableLarRecord, wikiSlotUri, materializeFaceWorkingDoc, type LarDoc } from "@lararium/mesh";
import { MemoryTiddlerStore } from "@lararium/tw5";
import { litFaceSlotDocs } from "../src/slot-doc-resolver.js";
import { makeLitFaceTarget, type LitFace } from "../src/lit-face-target.js";

const WORKING = wikiSlotUri("daemon", "working");
const R0 = "11111111-1111-4111-8111-111111111110", R1 = "11111111-1111-4111-8111-111111111111";

function stand() {
  const repo = makeIslandRepo({ syncPort: new MessageChannel().port1 });
  const control = new CompositeStore();
  control.addLayer({ bagId: CONTROL_HOME_ID, store: new MemoryTiddlerStore(CONTROL_HOME_ID), writable: true, defaultWritable: true });
  const slots = litFaceSlotDocs({
    repo, daemonStore: control, control, catalog: null,
    deviceScoped: (slug) => slug === "daemon",
    faceWorkingDoc: (url, label) => materializeFaceWorkingDoc(repo, url as never, label),
  });
  return { repo, control, slots };
}

describe("every lit face resolves its own slots", () => {
  test("L1 — a sibling's working slot resolves from its own secret and differs from the worn face's; device slots stand under each group", async () => {
    const { control, slots } = stand();
    const worn = slots.of({ group: "group-h0", atomKey: "a0".repeat(32), secret: async () => new Uint8Array(32).fill(9), faceDoor: { mint: async () => {} } as never });
    const sibling = slots.of({ group: "group-h1", atomKey: "a1".repeat(32), secret: async () => new Uint8Array(32).fill(7), faceDoor: { mint: async () => {} } as never });
    const a = await worn.slotDoc("garden", "working", { mint: false });
    const b = await sibling.slotDoc("garden", "working", { mint: false });
    expect(a?.url).toMatch(/^automerge:/);
    expect(b?.url).toMatch(/^automerge:/);
    expect(b?.url).not.toBe(a?.url);
    expect((await sibling.slotDoc("garden", "working", { mint: false }))?.url).toBe(b?.url);
    const d0 = await worn.slotDoc("daemon", "working");
    const d1 = await sibling.slotDoc("daemon", "working");
    expect(d1?.url).not.toBe(d0?.url);
    expect((await control.get(`${CONTROL_HOME_ID}/daemon-slot/working/group-h0`))?.tiddler.text).toBe(d0?.url);
    expect((await control.get(`${CONTROL_HOME_ID}/daemon-slot/working/group-h1`))?.tiddler.text).toBe(d1?.url);
    // The cache answers one resolver per face; a drop forgets it.
    expect(slots.of({ group: "group-h1", atomKey: "a1".repeat(32), secret: async () => null })).toBe(sibling);
    slots.drop("group-h1");
    expect(slots.of({ group: "group-h1", atomKey: "a1".repeat(32), secret: async () => null })).not.toBe(sibling);
  });

  function targetRig() {
    const { repo, control, slots } = stand();
    const worn: LitFace = { handleIndex: 0, group: "group-h0", relation: R0 };
    const sib: LitFace = { handleIndex: 1, group: "group-h1", relation: R1 };
    const wornHandle = repo.create<LarDoc>(emptyLarDoc());
    const wornStore = new AutomergeDocStore(wornHandle, WORKING);
    const target = makeLitFaceTarget({
      worn: () => worn, siblings: () => [sib], control: () => control,
      wornStore: (bag) => (bag === WORKING ? wornStore : null),
      siblingSlot: async (face, kind) => (await slots.of({ group: face.group, atomKey: "a2".repeat(32), secret: async () => null, faceDoor: { mint: async () => {} } as never }).slotDoc("daemon", kind))?.url ?? null,
      storeOf: async (url, bag) => new AutomergeDocStore(await repo.find<LarDoc>(url as never), bag),
    });
    return { repo, control, worn, sib, wornHandle, wornStore, target };
  }

  test("L2 — a named sibling resolves its own device slot, minted under its group, and reads as its owner", async () => {
    const r = targetRig();
    await r.control.put(mutableLarRecord(`${CONTROL_HOME_ID}/daemon-slot/working/group-h0`, { text: r.wornHandle.url }, "test"), { kind: "lares-verb", requestId: "t" });
    const out = await r.target(1, WORKING);
    expect(out).not.toBeNull();
    expect(out!.owner).toBe(1);
    expect(out!.worn).toBe(0);
    expect((out!.store as unknown as { documentId: string }).documentId).not.toBe(r.wornHandle.documentId);
  });

  test("L3 — the worn face, named or not, resolves the composite's layer and reads as its owner", async () => {
    const r = targetRig();
    await r.control.put(mutableLarRecord(`${CONTROL_HOME_ID}/daemon-slot/working/group-h0`, { text: r.wornHandle.url }, "test"), { kind: "lares-verb", requestId: "t" });
    for (const face of [null, 0]) {
      const out = await r.target(face, WORKING);
      expect(out!.store).toBe(r.wornStore);
      expect(out!.owner).toBe(0);
    }
  });

  test("L4 — a face outside the set resolves nothing; a canon bag resolves by the face's own relation alone", async () => {
    const r = targetRig();
    expect(await r.target(2, WORKING)).toBeNull();
    expect(await r.target(1, "lar:///ha.ka.ba/bags/sdm")).toBeNull();
    const canon = r.repo.create<LarDoc>(emptyLarDoc());
    await r.control.put(mutableLarRecord(`${CONTROL_HOME_ID}/daemon-canon/${R1}`, { text: canon.url }, "test"), { kind: "lares-verb", requestId: "t" });
    const own = await r.target(1, daemonFaceCanonBag(R1));
    expect(own!.owner).toBe(1);
    expect(await r.target(1, daemonFaceCanonBag(R0))).toBeNull();
  });
});
