/**
 * lit-face-slots — THE LIT SET ON THE DAEMON ISLAND (sealed-store#/the-lit-set): every lit face resolves its own instance slots
 * under its OWN group, hive and door, and a face-named INGEST's target lands in THAT face's own document, the owner read off
 * the control document.
 *
 *   L1 — FIRST: each face's working slot answers through its OWN workbench port (cabal-realm#/the-workbench): the worn face,
 *        seated in the wiki's realm, reads the realm's workbench; a sibling its realm never seated reads none. The daemon wiki's
 *        device slots stand under each face's own group in the control document
 *   L2 — the target for a named sibling resolves that sibling's own device slot (minted under its group) and names it owner
 *   L3 — the worn face (or no face named) resolves the composite's own layer, owner the worn face
 *   L4 — a face outside the lit set resolves nothing; a canon bag resolves by the face's relation alone, never another's
 *
 * Written beside the cure (written, unrun here; CI runs it).
 */
import { describe, expect, test } from "vitest";
import { makeIslandRepo } from "@lararium/mesh";
import { CompositeStore, CONTROL_HOME_ID, AutomergeDocStore, daemonFaceCanonBag, emptyLarDoc, mutableLarRecord, wikiSlotUri, realmWorkbenchDocUrl, computeRecipeFingerprint, bagUri, type LarDoc } from "@lararium/mesh";
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
  });
  return { repo, control, slots };
}

describe("every lit face resolves its own slots", () => {
  test("L0 — a face that holds no writer's seat in a wiki's workbench writes its own personal layer, and its mount hears so", async () => {
    // The binding rows rest in the daemon document: this rig lays that bag beside the control home.
    const repo = makeIslandRepo({ syncPort: new MessageChannel().port1 });
    const home = new CompositeStore();
    home.addLayer({ bagId: CONTROL_HOME_ID, store: new MemoryTiddlerStore(CONTROL_HOME_ID), writable: true, defaultWritable: false });
    home.addLayer({ bagId: bagUri("daemon"), store: new MemoryTiddlerStore(bagUri("daemon")), writable: true, defaultWritable: true });
    const slots = litFaceSlotDocs({ repo, daemonStore: home, control: home, catalog: null, deviceScoped: (slug) => slug === "daemon" });
    const REALM = "e".repeat(64);
    const door = { mint: async () => ({ docId: `0x${"d".repeat(64)}` }) } as never;
    const writer = slots.of({ group: "group-h0", atomKey: "a0".repeat(32), faceDoor: door, workbenchRealm: async () => REALM, workbenchWrites: async () => true });
    const reader = slots.of({ group: "group-h1", atomKey: "a1".repeat(32), faceDoor: door, workbenchRealm: async () => REALM, workbenchWrites: async () => false });
    const unseated = slots.of({ group: "group-h2", atomKey: "a2".repeat(32), faceDoor: door, workbenchRealm: async () => null, workbenchWrites: async () => false });
    expect(await writer.writeSlot("garden"), "CONTROL: a writer's seat writes the workbench").toBe("working");
    expect(await reader.writeSlot("garden"), "a reader's seat writes personal").toBe("personal");
    expect(await unseated.writeSlot("garden"), "no seat writes personal").toBe("personal");
    const trace = { wikiDocId: "automerge:2ZcLTyZGscnNvcFcXGyuAuuXVpd6", libraryBagDocIds: [] as readonly string[] };
    const fingerprint = await computeRecipeFingerprint(trace);
    const w = await writer.bindings(fingerprint, trace, "garden");
    expect(w.workingUrl).toBe(realmWorkbenchDocUrl(REALM, "garden"));
    expect(w.writeSlot, "CONTROL: a writer's mount names no other write slot").toBeUndefined();
    const r = await reader.bindings(fingerprint, trace, "garden");
    expect(r.workingUrl, "a reader mounts the workbench it reads").toBe(realmWorkbenchDocUrl(REALM, "garden"));
    expect(r.writeSlot).toBe("personal");
    const u = await unseated.bindings(fingerprint, trace, "garden");
    expect(u.workingUrl, "a face no realm seats mounts no workbench, and the mount stands").toBeNull();
    expect(u.writeSlot).toBe("personal");
    expect(new Set([w.personalUrl, r.personalUrl, u.personalUrl]).size, "each face binds its own personal document").toBe(3);
  });

  test("L1 — each face's working slot answers through its own workbench port; device slots stand under each group", async () => {
    const { control, slots } = stand();
    const REALM = "e".repeat(64);
    // The worn face's hive holds a seat in the wiki's realm; the sibling's holds none (the realm never seated it).
    const worn = slots.of({ group: "group-h0", atomKey: "a0".repeat(32), faceDoor: { mint: async () => {} } as never, workbenchRealm: async () => REALM });
    const sibling = slots.of({ group: "group-h1", atomKey: "a1".repeat(32), faceDoor: { mint: async () => {} } as never, workbenchRealm: async () => null });
    const a = await worn.slotDoc("garden", "working", { mint: false });
    expect(a).toEqual({ url: realmWorkbenchDocUrl(REALM, "garden"), reach: "face" });
    expect(await sibling.slotDoc("garden", "working", { mint: false }), "a face the realm never seated reads no workbench").toBeNull();
    expect(await sibling.slotDoc("garden", "working"), "and a mint founds it none: another face of the vessel stands the wiki").toBeNull();
    const d0 = await worn.slotDoc("daemon", "working");
    const d1 = await sibling.slotDoc("daemon", "working");
    expect(d1?.url).not.toBe(d0?.url);
    expect((await control.get(`${CONTROL_HOME_ID}/daemon-slot/working/group-h0`))?.tiddler.text).toBe(d0?.url);
    expect((await control.get(`${CONTROL_HOME_ID}/daemon-slot/working/group-h1`))?.tiddler.text).toBe(d1?.url);
    // The cache answers one resolver per face; a drop forgets it.
    expect(slots.of({ group: "group-h1", atomKey: "a1".repeat(32) })).toBe(sibling);
    slots.drop("group-h1");
    expect(slots.of({ group: "group-h1", atomKey: "a1".repeat(32) })).not.toBe(sibling);
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
      siblingSlot: async (face, kind) => (await slots.of({ group: face.group, atomKey: "a2".repeat(32), faceDoor: { mint: async () => {} } as never }).slotDoc("daemon", kind))?.url ?? null,
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
