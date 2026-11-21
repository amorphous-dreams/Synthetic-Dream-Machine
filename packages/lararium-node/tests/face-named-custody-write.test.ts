/**
 * face-named-custody-write — the lift's custody writer over the real sealed row (`persistVeilArchive`), on a scratch custody
 * seat. The 2026-11-20 incident: with face h1 worn and h0, h2 lit beside it, a lit sibling's seat rested its Archive at the
 * vessel's stop, the write reached the vessel with no face named, and the vessel sealed it into the row of the face it held
 * as current, so h1's next boot refused `ArchiveIdentityMismatch`.
 *
 *   N1  after a re-compose (the mounted face moves from A to B), a faceless write refuses `face-not-named` and no row moves.
 *   N2  a sibling's Archive named for the worn face's row refuses `ArchiveIdentityMismatch`, the worn row's sealed bytes never
 *       move, and the refusal names the would-be writer's identity.
 *                                                                        control: named for its own row, it lands there
 *   N3  a face that stands shut (the face mounted before the re-compose) takes no write: `face-not-open`.
 *                                                                        control: the mounted face's own Archive lands
 */
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ArchiveIdentityMismatch, InMemoryEventStore, KeyhiveProvider } from "@lararium/keyhive";
import { ensureFaceCustodyOfGroup } from "../src/face-route.js";
import { standFaceAtom } from "../src/face-atom-store.js";
import { loadVeilArchive, persistVeilArchive, veilArchivePath } from "../src/identity-anchors.js";
import { faceNamedCustodyWrite } from "../src/face-named-custody-write.js";
import { seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";

vi.setConfig({ testTimeout: 120_000 });

let c: SeatedScratchCustody;
beforeEach(async () => { c = await seatScratchCustody("face-named-write"); });
afterEach(async () => { await c.drop(); });

/** One face's own Archive, off a fresh provider over that face's atom. */
async function faceArchive(group: string): Promise<{ bytes: Uint8Array }> {
  await ensureFaceCustodyOfGroup(group);
  const seed = await standFaceAtom(group);
  const provider = new KeyhiveProvider();
  try {
    await provider.init({ seed, eventStore: new InMemoryEventStore() });
    return { bytes: await provider.exportArchiveAfterTheCard() };
  } finally {
    seed.fill(0);
    await provider.dispose();
  }
}
const same = (a: Uint8Array | null, b: Uint8Array): boolean => a !== null && Buffer.from(a).equals(Buffer.from(b));

/** The vessel's shape: one mounted face that each composition names, and the lit siblings beside it. */
function vesselDoor() {
  const state = { mounted: "group-a" as string | null, siblings: new Set<string>() };
  const warned: string[] = [];
  const write = faceNamedCustodyWrite({
    opens: (face) => face === state.mounted || state.siblings.has(face),
    write: persistVeilArchive,
    warn: (line) => { warned.push(line); },
  });
  return { state, warned, write: write as (carrier: "veil", bytes: Uint8Array, face?: string) => Promise<void> };
}

describe("the lift's custody write names its face, over the real sealed row", () => {
  test("N1 after a re-compose a faceless write refuses `face-not-named` and no row moves", async () => {
    const door = vesselDoor();
    const a = await faceArchive("group-a");
    const b = await faceArchive("group-b");
    await door.write("veil", a.bytes, "group-a");
    door.state.mounted = "group-b";   // the wear: the next composition mounts B
    await door.write("veil", b.bytes, "group-b");
    const rowA = readFileSync(veilArchivePath("group-a"));
    const rowB = readFileSync(veilArchivePath("group-b"));
    await expect(door.write("veil", a.bytes)).rejects.toThrow(/^face-not-named/);
    await expect(door.write("veil", a.bytes, "")).rejects.toThrow(/^face-not-named/);
    expect(readFileSync(veilArchivePath("group-a")).equals(rowA)).toBe(true);
    expect(readFileSync(veilArchivePath("group-b")).equals(rowB), "the worn face's row never takes a faceless write").toBe(true);
  });

  test("N2 a sibling's Archive named for the worn face's row refuses by identity; the worn row never moves", async () => {
    const door = vesselDoor();
    door.state.mounted = "group-h1";
    door.state.siblings.add("group-h0");
    const worn = await faceArchive("group-h1");
    const sibling = await faceArchive("group-h0");
    await door.write("veil", worn.bytes, "group-h1");
    const standing = readFileSync(veilArchivePath("group-h1"));
    const refusal = await door.write("veil", sibling.bytes, "group-h1").catch((error: unknown) => error);
    expect(refusal).toBeInstanceOf(ArchiveIdentityMismatch);
    expect(readFileSync(veilArchivePath("group-h1")).equals(standing), "h1's sealed bytes never moved").toBe(true);
    expect(same(await loadVeilArchive("group-h1"), worn.bytes)).toBe(true);
    expect(door.warned.join("\n")).toContain(`restore identity ${(refusal as ArchiveIdentityMismatch).restored}`);
    // control: the sibling's Archive, named for its own row, lands there
    await door.write("veil", sibling.bytes, "group-h0");
    expect(same(await loadVeilArchive("group-h0"), sibling.bytes)).toBe(true);
    expect(readFileSync(veilArchivePath("group-h1")).equals(standing)).toBe(true);
  });

  test("N3 a face that stands shut takes no write; the mounted face's own Archive lands", async () => {
    const door = vesselDoor();
    const a = await faceArchive("group-a");
    door.state.mounted = "group-b";
    await expect(door.write("veil", a.bytes, "group-a")).rejects.toThrow(/^face-not-open/);
    expect(await loadVeilArchive("group-a")).toBeNull();
    const b = await faceArchive("group-b");
    await door.write("veil", b.bytes, "group-b");
    expect(same(await loadVeilArchive("group-b"), b.bytes)).toBe(true);
  });
});
