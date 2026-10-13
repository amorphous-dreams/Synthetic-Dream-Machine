/**
 * archive-trails-the-act probe — what a creator keeps of a document it created AFTER its last Archive left.
 *
 * A vessel exports its Archive at a boot and creates documents for the rest of that session. The next stand
 * restores the Archive the boot took and replays every cap event since. A probe measures; each row carries its
 * control.
 *
 *   ARCHIVE BEFORE THE ACT + EVENTS   the later document's CGKA initialises from the replay, because the Archive
 *                                     already holds the prekey secret the creator's leaf got keyed to: the
 *                                     creator seals and opens what it sealed before.
 *   EVENTS ALONE (control)            the same replay with no Archive leaves the CGKA empty.
 *
 * NOT A ROW HERE, because it reads by chance: a contact card minted AFTER the Archive left and BEFORE the act mints
 * a prekey the Archive never held, and the later document may key its creator to that prekey. `probes/FINDINGS.md`
 * carries the measured counts. So an Archive serves every act up to the next card its holder mints, and no further.
 */
import { describe, expect, test } from "vitest";
import { KeyhiveProvider, InMemoryEventStore } from "../src/index.js";

const CREATOR = new Uint8Array(32).fill(0x71);
const BAG = "lar:///probe.trails.bag";

async function session() {
  const store = new InMemoryEventStore();
  const creator = new KeyhiveProvider();
  await creator.init({ seed: CREATOR, eventStore: store });
  await creator.settleEvents();
  const archiveAtBoot = await creator.exportArchive();
  const { docId } = await creator.registerBag(BAG);
  const sealed = await creator.encryptContent(BAG, new TextEncoder().encode("sealed after the archive left"));
  await creator.settleEvents();
  const events = await store.list();
  await creator.dispose();
  return { archiveAtBoot, docId, sealed, events };
}

async function restand(f: Awaited<ReturnType<typeof session>>, withArchive: boolean): Promise<KeyhiveProvider> {
  const store = new InMemoryEventStore();
  for (const r of f.events) await store.put(r);
  const p = new KeyhiveProvider();
  await p.init({ seed: CREATOR, eventStore: store, ...(withArchive ? { archiveBytes: f.archiveAtBoot } : {}) });
  await p.hydrateFromEventStore();
  p.adoptBag(BAG, f.docId);
  return p;
}

describe("a document created after the creator's last Archive left", () => {
  test("ARCHIVE BEFORE THE ACT + EVENTS: the creator seals and opens the later document", async () => {
    const f = await session();
    const p = await restand(f, true);
    expect(new TextDecoder().decode(await p.decryptContent(BAG, f.sealed))).toBe("sealed after the archive left");
    expect((await p.encryptContent(BAG, new Uint8Array([1]))).byteLength).toBeGreaterThan(0);
    await p.dispose();
  });

  test("EVENTS ALONE (control): the same replay with no Archive leaves the creator's hand empty", async () => {
    const f = await session();
    const p = await restand(f, false);
    await expect(p.encryptContent(BAG, new Uint8Array([1]))).rejects.toThrow(/Cgka is not initialized/);
    await p.dispose();
  });
});
