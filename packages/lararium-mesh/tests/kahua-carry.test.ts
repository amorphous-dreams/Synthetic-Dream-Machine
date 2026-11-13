/**
 * kahua-carry — a root rotation drops the stage's earlier items from standing until the current root CARRIES them.
 *
 * Kahua acts carry no sequence, so a root the KEL rotated past could sign a lift naming its own old epoch at any later
 * time; no reader could tell it from one it signed before the rotation. So standing reads CURRENT-ONLY: an act stands
 * where its signer sits in the current roster, or where a `carry` act the current root signed at the current epoch
 * names its cid (a batch re-lift, the same deliberate choice the operator makes for one lift). Without a carry an
 * earlier item falls back to the history view (it verifies under the roster of the epoch it names), never to deletion.
 *
 * SECURITY CLASS: every red pairs with a CONTROL through the same fold.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { describe, expect, test } from "vitest";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../src/ed25519-door.js";
import * as stage from "../src/kahua-stage.js";
import { kahuaActCid, readKahuaStage, signKahuaLift, signKahuaWithdraw, type SignedKahuaAct } from "../src/kahua-stage.js";

const GROUP = "0x" + "c4".repeat(16);
const signer = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });
type Signer = Awaited<ReturnType<typeof signer>>;
// The carry door, read off the module so a missing export reds one test, never the file.
const signKahuaCarry = (parts: { group: string; epoch: number; carries: readonly string[] }, s: Signer): Promise<SignedKahuaAct> =>
  (stage as unknown as { signKahuaCarry: (p: typeof parts, s: Signer) => Promise<SignedKahuaAct> }).signKahuaCarry(parts, s);

async function fixture() {
  const old = await signer(31), next = await signer(32), third = await signer(33), atom = await signer(34);
  /** A face whose KEL stands at `rosters.length - 1`: epoch i seats `rosters[i]`. */
  const face = (...rosters: Signer[][]) => {
    const current = new Set(rosters[rosters.length - 1]!.map((s) => s.key));
    return { group: GROUP, grant: (k: string) => current.has(k), signedAt: (epoch: number, k: string) => rosters[epoch]?.some((s) => s.key === k) === true };
  };
  const lift = (by: Signer, epoch: number, title: string, text: string, parent: string | null = null) => signKahuaLift({
    group: GROUP, epoch, title, text, fields: {}, parent, origin: { seat: atom.key, device: atom.key, session: "s" }, taint: [], sources: [{ title: `daemon/${title}`, revision: "r" }],
  }, by);
  return { old, next, third, face, lift };
}
const titles = (r: ReturnType<typeof readKahuaStage>) => r.list().map((i) => i.title);

describe("a rotation and the carry", () => {
  test("RED: after a rotation the earlier items drop from standing and stay in history; CONTROL: before it they stand", async () => {
    const { old, next, face, lift } = await fixture();
    const a = await lift(old, 0, "a", "alpha"), b = await lift(old, 0, "b", "beta");
    expect(titles(readKahuaStage([a, b], face([old])))).toEqual(["a", "b"]);
    const rotated = readKahuaStage([a, b], face([old], [next]));
    expect(titles(rotated)).toEqual([]);
    expect(rotated.get("a")).toBeNull();
    expect(rotated.history("a").map((r) => [r.cid, r.standing, r.epoch])).toEqual([[kahuaActCid(a), false, 0]]);
    expect(rotated.revision(kahuaActCid(b))?.text).toBe("beta");
    expect(rotated.refused).toEqual([]);
  });

  test("RED: a carry the current root signs at the current epoch restores the items it names, and only those", async () => {
    const { old, next, face, lift } = await fixture();
    const a = await lift(old, 0, "a", "alpha"), b = await lift(old, 0, "b", "beta");
    const carry = await signKahuaCarry({ group: GROUP, epoch: 1, carries: [kahuaActCid(a)] }, next);
    const read = readKahuaStage([a, b, carry], face([old], [next]));
    expect(titles(read)).toEqual(["a"]);
    expect(read.get("a")?.heads.map((h) => [h.cid, h.standing, h.signer])).toEqual([[kahuaActCid(a), true, old.key]]);
    expect(read.history("b").map((r) => r.standing)).toEqual([false]);
  });

  test("RED: a backdated epoch-0 lift the old root signs after the carry still never stands; CONTROL: the carried revision keeps standing", async () => {
    const { old, next, face, lift } = await fixture();
    const a = await lift(old, 0, "a", "alpha");
    const carry = await signKahuaCarry({ group: GROUP, epoch: 1, carries: [kahuaActCid(a)] }, next);
    const backdatedChild = await lift(old, 0, "a", "rewritten by the rotated-out root", kahuaActCid(a));
    const backdatedNew = await lift(old, 0, "c", "planted by the rotated-out root");
    const read = readKahuaStage([a, carry, backdatedChild, backdatedNew], face([old], [next]));
    expect(read.get("a")?.heads.map((h) => h.text)).toEqual(["alpha"]);
    expect(read.get("c")).toBeNull();
    expect(titles(read)).toEqual(["a"]);
  });

  test("CONTROL: a carry from the rotated-out root, a carry at an epoch its signer never stood in, and a carry naming no held act restore nothing", async () => {
    const { old, next, face, lift } = await fixture();
    const a = await lift(old, 0, "a", "alpha");
    const byOld = await signKahuaCarry({ group: GROUP, epoch: 0, carries: [kahuaActCid(a)] }, old);
    const wrongEpoch = await signKahuaCarry({ group: GROUP, epoch: 0, carries: [kahuaActCid(a)] }, next);
    const stray = await signKahuaCarry({ group: GROUP, epoch: 1, carries: ["ab".repeat(32)] }, next);
    const read = readKahuaStage([a, byOld, wrongEpoch, stray], face([old], [next]));
    expect(titles(read)).toEqual([]);
    expect(read.refused.map((r) => r.refusal)).toEqual(["grant"]);
  });

  test("CONTROL: a carry stands only while its own root heads the lineage: a second rotation drops the carried items again until the next carry", async () => {
    const { old, next, third, face, lift } = await fixture();
    const a = await lift(old, 0, "a", "alpha");
    const carry1 = await signKahuaCarry({ group: GROUP, epoch: 1, carries: [kahuaActCid(a)] }, next);
    expect(titles(readKahuaStage([a, carry1], face([old], [next], [third])))).toEqual([]);
    const carry2 = await signKahuaCarry({ group: GROUP, epoch: 2, carries: [kahuaActCid(a)] }, third);
    expect(titles(readKahuaStage([a, carry1, carry2], face([old], [next], [third])))).toEqual(["a"]);
  });

  test("CONTROL: the current root supersedes and withdraws a carried revision as it would its own", async () => {
    const { old, next, face, lift } = await fixture();
    const a = await lift(old, 0, "a", "alpha"), b = await lift(old, 0, "b", "beta");
    const carry = await signKahuaCarry({ group: GROUP, epoch: 1, carries: [kahuaActCid(a), kahuaActCid(b)] }, next);
    const a2 = await lift(next, 1, "a", "alpha two", kahuaActCid(a));
    const wb = await signKahuaWithdraw({ group: GROUP, epoch: 1, target: kahuaActCid(b) }, next);
    const read = readKahuaStage([a, b, carry, a2, wb], face([old], [next]));
    expect(read.get("a")?.heads.map((h) => h.text)).toEqual(["alpha two"]);
    expect(read.get("b")).toBeNull();
    expect(read.history("b").map((r) => r.withdrawn)).toEqual([true]);
  });

  test("CONTROL: a carry refuses its shape where it names nothing, a malformed cid or one cid twice", async () => {
    const { next } = await fixture();
    await expect(signKahuaCarry({ group: GROUP, epoch: 1, carries: [] }, next)).rejects.toThrow(/kahua-act: shape/);
    await expect(signKahuaCarry({ group: GROUP, epoch: 1, carries: ["nope"] }, next)).rejects.toThrow(/kahua-act: shape/);
    await expect(signKahuaCarry({ group: GROUP, epoch: 1, carries: ["ab".repeat(32), "ab".repeat(32)] }, next)).rejects.toThrow(/kahua-act: shape/);
  });
});
