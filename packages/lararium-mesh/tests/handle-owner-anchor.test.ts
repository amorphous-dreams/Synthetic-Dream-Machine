/**
 * handle-owner-anchor — K15-H: the Handle owner rides the sealed anchor through `readFace`'s door.
 *
 * Founding, burn and rotation take the owner Persona KEL prefix (and the head op-key that authorizes) from `readFaceOwner`:
 * the selected face's sealed anchor, checked against the verified chain beneath that prefix. A mutable daemon tiddler never
 * names the owner. THE HOLE (measured on the head before this lane): `publishHandleFromDaemonDoc` seated whatever prefix the
 * daemon doc carried, so a doc that named another face's prefix signed that face as the Handle's owner.
 */
import { describe, test, expect } from "vitest";
import * as ed25519 from "@noble/ed25519";
import { readFaceOwner, isFaceOwner } from "../src/face-reading.js";
import { mintFaceAnchor } from "../src/face-anchor.js";
import { mintPersonaInception, headOpKey, type PersonaKelEvent } from "../src/persona-kel.js";
import { publishHandleForFace } from "../src/handle-publish.js";
import { currentOwnerSet, type HandleKelEvent } from "../src/handle-kel.js";
import type { LarDoc } from "../src/base-doc.js";
import type { OwnPublicHandleStore, PersonaPublicHandleRecord } from "../src/persona-glamour.js";

const hexOf = (b: Uint8Array): string => Buffer.from(b).toString("hex");
async function faceOf(byte: number): Promise<{ chain: PersonaKelEvent[]; did: string; anchor: ReturnType<typeof mintFaceAnchor> }> {
  const did = "0x" + hexOf(await ed25519.getPublicKeyAsync(new Uint8Array(32).fill(byte)));
  const inception = mintPersonaInception(did, "recovery-" + byte.toString(16).padStart(2, "0").repeat(30));
  const anchor = mintFaceAnchor({ personaGroup: "group-" + byte, personaKelPrefix: inception.prefix, personaRootDid: did, edge: { e: byte }, leaseEpoch: 0 });
  return { chain: [inception], did, anchor };
}

const SEED = Uint8Array.from(Array.from({ length: 32 }, (_, i) => (i * 3 + 7) & 0xff));
function fakeBoard(): { doc(): LarDoc; change(fn: (d: LarDoc) => void): void } {
  const d: LarDoc = { tiddlers: {} } as LarDoc;
  return { doc: () => d, change: (fn) => fn(d) };
}
function store(): OwnPublicHandleStore {
  const m = new Map<number, PersonaPublicHandleRecord>();
  return { async load(i) { return m.get(i) ?? null; }, async save(r) { m.set(r.handleIndex, r); }, async list() { return [...m.keys()]; } };
}

describe("readFaceOwner — the selected face's sealed anchor names the owner", () => {
  test("★ the anchor's prefix, its verified chain and the head op-key come back as one issued owner ★", async () => {
    const a = await faceOf(0x41);
    const r = await readFaceOwner(a.chain, a.anchor);
    expect(r.ok, r.ok ? "" : r.reason).toBe(true);
    if (!r.ok) return;
    expect(r.owner.personaKelPrefix).toBe(a.anchor.personaKelPrefix);
    expect(r.owner.headOpKeyDid).toBe(await headOpKey(a.chain, { verifyQuorums: true }));
    expect(isFaceOwner(r.owner)).toBe(true);
  });

  test("★ CONTROL: another face's chain under this face's anchor refuses; no anchor, no chain, a forged owner refuse ★", async () => {
    const a = await faceOf(0x41), b = await faceOf(0x42);
    expect(a.anchor.personaKelPrefix).not.toBe(b.anchor.personaKelPrefix);
    const foreign = await readFaceOwner(b.chain, a.anchor);
    expect(foreign.ok).toBe(false);
    if (!foreign.ok) expect(foreign.reason).toMatch(/prefix/i);
    expect((await readFaceOwner(a.chain, null)).ok).toBe(false);
    expect((await readFaceOwner([], a.anchor)).ok).toBe(false);
    expect((await readFaceOwner(null, a.anchor)).ok).toBe(false);
    expect(isFaceOwner({ personaKelPrefix: a.anchor.personaKelPrefix, headOpKeyDid: a.did, reading: null })).toBe(false);
  });
});

describe("publishHandleForFace — the daemon tiddler never names the owner", () => {
  test("★ RED on the old door: a daemon doc naming another face's prefix cannot move the Handle's owner ★", async () => {
    const a = await faceOf(0x41), b = await faceOf(0x42);
    // The selected face is A. A daemon doc that names B's prefix exists in the world; the publish takes no daemon doc at all.
    const r = await readFaceOwner(a.chain, a.anchor);
    if (!r.ok) throw new Error(r.reason);
    const card = await publishHandleForFace({ owner: r.owner, board: fakeBoard() as never, seed: SEED, handleIndex: 1, glamour: "G", store: store() });
    const owners = currentOwnerSet(card.chain as HandleKelEvent[])!;
    expect(owners.members).toEqual([a.anchor.personaKelPrefix]);
    expect(owners.members).not.toContain(b.anchor.personaKelPrefix);
  });

  test("★ CONTROL: an owner the door never issued refuses; the face never self-owns ★", async () => {
    const a = await faceOf(0x41);
    await expect(publishHandleForFace({
      owner: { personaKelPrefix: a.anchor.personaKelPrefix, headOpKeyDid: a.did } as never,
      board: fakeBoard() as never, seed: SEED, handleIndex: 0, glamour: "G", store: store(),
    })).rejects.toThrow(/door|issued|owner/i);
  });
});
