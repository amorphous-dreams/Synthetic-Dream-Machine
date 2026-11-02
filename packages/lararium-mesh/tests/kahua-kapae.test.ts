/**
 * kahua-kapae — the emergency cap: a hand on one device raises a kāpae over (face, digest) on the fleet-synced stage; every
 * device's promotion of that digest sits in the shadow until a frontier of lowers lifts it. The per-device ledger stays untouched.
 *
 * Remove-wins, no clock: a lower that cites every raise lifts; a racing lower leaves the shadow up. The AI seat prepares; a hand raises.
 * Every red pairs with a CONTROL.
 * Meme: lar:///ha.ka.ba/lares/api/pono/kapae
 */
import { describe, expect, test } from "vitest";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../src/ed25519-door.js";
import { kahuaActCid, readKahuaAct, readKahuaStage, signKahuaKapae } from "../src/kahua-stage.js";
import {
  EMPTY_KAPAE_LOCAL, EMPTY_LEDGER, assertKapaeHand, decodeKapaeLocal, encodeKapaeLocal, encodeLedger, kahuaPromotionDigest,
  kapaeBootSet, kapaeNoteArrival, kapaePrepare, ledgerCommit, promotedPreloads, verifyPromotionRows,
} from "../src/kahua-promote.js";

const GROUP = "face-group";
const signer = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });
const HAND = { kind: "hand", id: "hand-1" } as const;
const SEAT = { kind: "seat", id: "seat-1" } as const;
const rite = { title: "rites/a", text: "exports.startup = function(){}", fields: { "module-type": "startup" } };
const D = kahuaPromotionDigest(rite);
const other = { title: "rites/b", text: "plain", fields: {} };
const D2 = kahuaPromotionDigest(other);

async function stageFixture() {
  const root = await signer(1), outsider = await signer(3);
  const grant = (k: string) => k === root.key;
  const act = (digest: string, raised: boolean, parents: string[], by = root) => signKahuaKapae({ group: GROUP, epoch: 0, digest, raised, parents }, by);
  const read = (acts: Awaited<ReturnType<typeof act>>[]) => readKahuaStage(acts, { group: GROUP, grant });
  return { root, outsider, grant, act, read };
}

describe("the kāpae act on the stage", () => {
  test("RED: a raise shadows its digest at the next read, and a lower citing every raise lifts it; CONTROL: an edge no act names reads absent and shadows nothing", async () => {
    const { act, read } = await stageFixture();
    const raise = await act(D, true, []);
    expect([...read([raise]).shadowed()]).toEqual([D]);
    expect(read([raise]).kapae(D)).toBe("held");
    expect(read([raise]).kapae(D2)).toBeUndefined();
    expect(read([raise]).shadowed().has(D2)).toBe(false);
    const lower = await act(D, false, [kahuaActCid(raise)]);
    expect(read([raise, lower]).shadowed().size).toBe(0);
    expect(read([raise, lower]).kapae(D)).toBe("withdrawn");
    expect(read([lower, raise]).kapae(D)).toBe("withdrawn");
  });

  test("RED: a lower that races a raise (no causal order) leaves the shadow UP in either arrival order; CONTROL: a later act citing both heads settles it", async () => {
    const { act, read } = await stageFixture();
    const raise = await act(D, true, []);
    const racing = await act(D, false, []);
    for (const acts of [[raise, racing], [racing, raise]]) {
      expect(read(acts).kapae(D)).toBe("unsettled");
      expect(read(acts).shadowed().has(D)).toBe(true);
    }
    const settle = await act(D, false, [kahuaActCid(raise), kahuaActCid(racing)]);
    expect(read([raise, racing, settle]).shadowed().has(D)).toBe(false);
  });

  test("RED: a lower citing a parent the reader lacks proves no lift (the shadow stays up); CONTROL: the same lower with its parent present lifts", async () => {
    const { act, read } = await stageFixture();
    const raise = await act(D, true, []);
    const lower = await act(D, false, [kahuaActCid(raise)]);
    expect(read([lower]).shadowed().has(D)).toBe(true);
    expect(read([raise, lower]).shadowed().has(D)).toBe(false);
  });

  test("RED: an act signed outside the face's grant refuses `grant`, a non-digest refuses `shape`; CONTROL: the root's act reads", async () => {
    const { act, outsider, grant } = await stageFixture();
    expect(readKahuaAct(await act(D, true, [], outsider), { group: GROUP, grant })).toEqual({ ok: false, refusal: "grant" });
    await expect(act("not-a-digest", true, [])).rejects.toThrow(/shape/);
    expect(readKahuaAct(await act(D, true, []), { group: GROUP, grant }).ok).toBe(true);
  });
});

describe("what a device does with the shadow", () => {
  const ledgerWith = (...items: (typeof rite)[]) => items.reduce((l, i) => ledgerCommit(l, { digest: kahuaPromotionDigest(i), item: i, revision: "a".repeat(64) }, HAND), EMPTY_LEDGER);

  test("RED: a raise on another device unloads D from this device's preloads at its next read and restarts its running daemon; CONTROL: a raise over a digest this device never loaded restarts nothing, and D2 still preloads", async () => {
    const { act, read } = await stageFixture();
    const ledger = ledgerWith(rite, other);
    const verified = verifyPromotionRows(ledger.rows).verified;
    const raise = await act(D, true, []);
    const shadowed = read([raise]).shadowed();
    expect(promotedPreloads(verified, shadowed).map((e) => e["title"])).toEqual(["rites/b"]);
    const arrival = kapaeNoteArrival(EMPTY_KAPAE_LOCAL, shadowed, new Set([D, D2]));
    expect(arrival.restart).toBe(true);
    expect(arrival.local.shadowed).toEqual([D]);
    expect(kapaeNoteArrival(arrival.local, shadowed, new Set([D2])).restart).toBe(false);
    const unloaded = kapaeNoteArrival(EMPTY_KAPAE_LOCAL, read([await act(D2, true, [])]).shadowed(), new Set([D]));
    expect(unloaded.restart).toBe(false);
    expect(promotedPreloads(verified, new Set()).map((e) => e["title"]).sort()).toEqual(["rites/a", "rites/b"]);
  });

  test("RED: a re-promote on a device that was offline during the raise stays shadowed after merge; CONTROL: the lower restores it with no re-promotion", async () => {
    const { act, read } = await stageFixture();
    const raise = await act(D, true, []);
    const offlineLedger = ledgerWith(rite);
    const afterMerge = read([raise]).shadowed();
    expect(promotedPreloads(verifyPromotionRows(offlineLedger.rows).verified, afterMerge)).toEqual([]);
    const lowered = read([raise, await act(D, false, [kahuaActCid(raise)])]).shadowed();
    expect(promotedPreloads(verifyPromotionRows(offlineLedger.rows).verified, lowered)).toHaveLength(1);
  });

  test("RED: a raise and a lower leave every per-device ledger row byte-identical; CONTROL: the local cache bytes DO change", async () => {
    const { act, read } = await stageFixture();
    const ledger = ledgerWith(rite);
    const before = encodeLedger(ledger);
    const raise = await act(D, true, []);
    const raised = kapaeNoteArrival(EMPTY_KAPAE_LOCAL, read([raise]).shadowed(), new Set([D]));
    const lowered = kapaeNoteArrival(raised.local, read([raise, await act(D, false, [kahuaActCid(raise)])]).shadowed(), new Set([D]));
    expect(Buffer.from(encodeLedger(ledger)).equals(Buffer.from(before))).toBe(true);
    expect(lowered.local.shadowed).toEqual([]);
    expect(Buffer.from(encodeKapaeLocal(raised.local)).equals(Buffer.from(encodeKapaeLocal(EMPTY_KAPAE_LOCAL)))).toBe(false);
    expect(decodeKapaeLocal(encodeKapaeLocal(raised.local))).toEqual(raised.local);
    expect(() => decodeKapaeLocal(new TextEncoder().encode("{\"shadowed\":[1]}"))).toThrowError(expect.objectContaining({ code: "kapae-local-malformed" }));
  });

  test("RED: an offline boot with an unreadable stage honors the cached shadow; CONTROL: a readable stage wins over the cache (a lower is honored)", () => {
    const cached = { ...EMPTY_KAPAE_LOCAL, shadowed: [D] };
    expect([...kapaeBootSet(cached, null)]).toEqual([D]);
    expect([...kapaeBootSet(cached, new Set())]).toEqual([]);
    expect([...kapaeBootSet(cached, new Set([D2]))]).toEqual([D2]);
  });
});

describe("who raises", () => {
  test("RED: a seat's raise and lower refuse `kapae-needs-hand`; CONTROL: a hand's pass; the seat PREPARES with a reason and the queue commits nothing", () => {
    expect(() => assertKapaeHand("raise", SEAT)).toThrowError(expect.objectContaining({ code: "kapae-needs-hand" }));
    expect(() => assertKapaeHand("lower", SEAT)).toThrowError(expect.objectContaining({ code: "kapae-needs-hand" }));
    expect(() => assertKapaeHand("raise", HAND)).not.toThrow();
    expect(() => assertKapaeHand("lower", HAND)).not.toThrow();
    const q = kapaePrepare(EMPTY_KAPAE_LOCAL, { digest: D, why: "the macro leaks the field notes", seat: "seat-1" });
    expect(q.queue).toEqual([{ digest: D, why: "the macro leaks the field notes", seat: "seat-1" }]);
    expect(q.shadowed).toEqual([]);
    expect(kapaePrepare(q, { digest: D, why: "again", seat: "seat-1" }).queue).toHaveLength(1);
    expect(() => kapaePrepare(EMPTY_KAPAE_LOCAL, { digest: D, why: " ", seat: "seat-1" })).toThrowError(expect.objectContaining({ code: "kapae-why-missing" }));
    expect(() => kapaePrepare(EMPTY_KAPAE_LOCAL, { digest: "nope", why: "x", seat: "seat-1" })).toThrowError(expect.objectContaining({ code: "kapae-digest-malformed" }));
  });
});
