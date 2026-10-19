/**
 * K15 step 2b follow-up — the face door records a bag's Document only after the face's group holds its grant.
 * A mint interrupted between the record and the grant would leave a ledger entry whose Document the group never
 * reached; the next boot adopts it and never re-checks. The law: the ledger names a Document only when the
 * group's grant stands.
 */
import { describe, expect, test } from "vitest";
import { InMemoryEventStore, KeyhiveProvider, makeFaceBagDoor, registerBagsDurably } from "../src/index.js";
import type { BagDocLedger } from "../src/index.js";

const BAG = "lar:///k15.door-order/owned-bag";

async function stand(fill: number, store: InMemoryEventStore, archiveBytes?: Uint8Array): Promise<KeyhiveProvider> {
  const provider = new KeyhiveProvider();
  await provider.init({ seed: new Uint8Array(32).fill(fill), eventStore: store, ...(archiveBytes ? { archiveBytes } : {}) });
  await provider.hydrateFromEventStore();
  return provider;
}

function mapLedger(): BagDocLedger & { readonly rows: Map<string, string> } {
  const rows = new Map<string, string>();
  return { rows, get: async (bag) => rows.get(bag) ?? null, put: async (bag, docId) => { rows.set(bag, docId); } };
}

/** The face with its next delegate dying, as a crash between two awaits would. */
function crashingOnDelegate(face: KeyhiveProvider, state: { armed: boolean }): KeyhiveProvider {
  return new Proxy(face, {
    get(target, key, receiver) {
      if (key === "delegate") {
        return async (...args: Parameters<KeyhiveProvider["delegate"]>) => {
          if (state.armed) { state.armed = false; throw new Error("crash between the mint's steps"); }
          return target.delegate(...args);
        };
      }
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

describe("K15 step 2b: the face door grants before it records", () => {
  test("law — a mint that dies before its grant leaves no ledger entry, and the next boot's mint reaches the group's member", { timeout: 90_000 }, async () => {
    const faceStore = new InMemoryEventStore();
    const host = await stand(0x62, new InMemoryEventStore());
    let face = await stand(0x61, faceStore);
    try {
      const { id: hostId } = await face.receiveContactCard(await host.contactCard());
      const group = await face.createGroup();
      await face.addGroupMember(hostId, group.groupId);
      const ledger = mapLedger();

      const state = { armed: true };
      const doomed = makeFaceBagDoor({ face: crashingOnDelegate(face, state), groupId: group.groupId, ledger });
      await expect(doomed.mint(BAG, "admin")).rejects.toThrow(/crash/);
      expect(ledger.rows.has(BAG), "no ledger entry names a Document the group was never granted").toBe(false);

      const archive = await face.exportArchiveAfterTheCard();
      await face.dispose();
      face = await stand(0x61, faceStore, archive);
      await face.receiveContactCard(await host.contactCard());
      await registerBagsDurably({ provider: face, bags: [BAG], ledger });
      await makeFaceBagDoor({ face, groupId: group.groupId, ledger }).mint(BAG, "admin");

      expect((await face.verify({ bagUrl: BAG, presenter: hostId, access: "read" })).ok, "the group's member reads the bag").toBe(true);
      expect(ledger.rows.get(BAG)).toBe(face.docIdOfBag(BAG));
    } finally {
      await face.dispose();
      await host.dispose();
    }
  });

  test("control — a completed mint records its Document and the group's member reads", { timeout: 90_000 }, async () => {
    const face = await stand(0x63, new InMemoryEventStore());
    const host = await stand(0x64, new InMemoryEventStore());
    try {
      const { id: hostId } = await face.receiveContactCard(await host.contactCard());
      const group = await face.createGroup();
      await face.addGroupMember(hostId, group.groupId);
      const ledger = mapLedger();
      await makeFaceBagDoor({ face, groupId: group.groupId, ledger }).mint(BAG, "admin");
      expect(ledger.rows.get(BAG)).toBe(face.docIdOfBag(BAG));
      expect((await face.verify({ bagUrl: BAG, presenter: hostId, access: "read" })).ok).toBe(true);
    } finally {
      await face.dispose();
      await host.dispose();
    }
  });
});
