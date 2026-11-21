/**
 * swarm-board — the house cap and the lane shares as a sibling record family on the face-private promote board doc.
 *
 * The face's grant signs a cap or a share; each line (the cap, one lane's share) folds by causal heads and, where heads run concurrent,
 * takes the MINIMUM, so a fork can only tighten the swarm. A line missing a parent, a share set past the cap and an act from a key the
 * face never granted all fail closed. The family shares the doc with the promote acts and reads as none of them.
 * Every red pairs with a CONTROL. Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { describe, expect, test } from "vitest";
import type { LarDoc } from "../src/base-doc.js";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../src/ed25519-door.js";
import { promoteActRecords, signPromoteKapae, writePromoteAct } from "../src/promote-board.js";
import { readSwarmBoard, readSwarmBoardAct, signSwarmCap, signSwarmShare, swarmBoardActCid, swarmBoardRecords, swarmCapHead, writeSwarmBoardAct } from "../src/swarm-board.js";
import type { WardActRefusal } from "../src/ward-cosign.js";

const GROUP = "face-group";
const keyed = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(n)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(n)) });

async function fixture() {
  const root = await keyed(1), outsider = await keyed(3);
  // A face of one device: a cap reads on its own (the co-sign witness answers yes, as `wardActWitness` does for one device).
  const face = { group: GROUP, grant: (k: string) => k === root.key, ward: { accepts: () => true } };
  const cap = (value: number, parents: string[] = [], by = root) => signSwarmCap({ group: GROUP, epoch: 0, value, parents }, by);
  const share = (lane: string, value: number, parents: string[] = [], by = root) => signSwarmShare({ group: GROUP, epoch: 0, lane, value, parents }, by);
  const cid = swarmBoardActCid;
  return { root, outsider, face, cap, share, cid, read: (acts: unknown[]) => readSwarmBoard(acts, face) };
}

describe("one line folds by causal heads", () => {
  test("RED: a cap that cites its parent supersedes it; CONTROL: an empty board reads no cap and every share zero", async () => {
    const f = await fixture();
    const a = await f.cap(10), b = await f.cap(6, [f.cid(a)]);
    expect(f.read([a, b]).cap).toBe(6);
    const empty = f.read([]);
    expect(empty).toMatchObject({ cap: null, ok: true });
    expect(empty.shareOf("lane-a")).toBe(0);
  });

  test("RED: concurrent cap heads take the minimum, and a later act citing both settles the line; CONTROL: the order the records arrive in changes nothing", async () => {
    const f = await fixture();
    const base = await f.cap(10), hi = await f.cap(9, [f.cid(base)]), lo = await f.cap(4, [f.cid(base)]);
    expect(f.read([base, hi, lo]).cap).toBe(4);
    expect(f.read([lo, hi, base]).cap).toBe(4);
    const settled = await f.cap(8, [f.cid(hi), f.cid(lo)]);
    expect(f.read([base, hi, lo, settled]).cap).toBe(8);
  });

  test("RED: concurrent share heads take the minimum per lane; CONTROL: another lane's line stands apart", async () => {
    const f = await fixture();
    const cap = await f.cap(20), x = await f.share("a", 7), y = await f.share("a", 3), z = await f.share("b", 5);
    const r = f.read([cap, x, y, z]);
    expect(r.shareOf("a")).toBe(3);
    expect(r.shareOf("b")).toBe(5);
  });

  test("RED: an act citing a parent the line lacks (absent, or another line's act) closes that line to zero; CONTROL: the other line still reads", async () => {
    const f = await fixture();
    const cap = await f.cap(20), other = await f.share("b", 5);
    const orphan = await f.share("a", 9, ["e".repeat(64)]);
    const cross = await f.share("c", 2, [f.cid(other)]);
    const r = f.read([cap, orphan, cross, other]);
    expect(r.shareOf("a")).toBe(0);
    expect(r.shareOf("c")).toBe(0);
    expect(r.shareOf("b")).toBe(5);
    const unavailableCap = f.read([await f.cap(10, ["e".repeat(64)])]);
    expect(unavailableCap.cap).toBe(0);
  });
});

describe("the sum law fails closed", () => {
  test("RED: shares that sum past the cap (a cap lowered under them by a fork) close every share to zero and the reading says why; CONTROL: shares that sum to the cap stand", async () => {
    const f = await fixture();
    const cap = await f.cap(10), a = await f.share("a", 6), b = await f.share("b", 4);
    expect(f.read([cap, a, b])).toMatchObject({ ok: true });
    expect(f.read([cap, a, b]).shareOf("a")).toBe(6);
    const lowered = await f.cap(5, [f.cid(cap)]);
    const closed = f.read([cap, a, b, lowered]);
    expect(closed).toMatchObject({ ok: false, refusal: "swarm-shares-over-cap", cap: 5 });
    expect(closed.shareOf("a")).toBe(0);
    expect(closed.shareOf("b")).toBe(0);
  });
});

describe("only the face's grant signs, and only this family reads", () => {
  test("RED: an act from a key the face never granted, a forged signature, another group and a malformed value each refuse by name; CONTROL: the granted act reads", async () => {
    const f = await fixture();
    const good = await f.cap(10);
    expect(readSwarmBoardAct(good, f.face)).toMatchObject({ ok: true });
    expect(readSwarmBoardAct(await f.cap(10, [], f.outsider), f.face)).toEqual({ ok: false, refusal: "grant" });
    expect(readSwarmBoardAct({ ...good, body: { ...good.body, value: 99 } }, f.face)).toEqual({ ok: false, refusal: "signature" });
    expect(readSwarmBoardAct(good, { ...f.face, group: "other" })).toEqual({ ok: false, refusal: "group" });
    expect(readSwarmBoardAct({ ...good, body: { ...good.body, value: -1 } }, f.face)).toEqual({ ok: false, refusal: "shape" });
    expect(f.read([await f.cap(10, [], f.outsider), { junk: true }])).toMatchObject({ cap: null, refused: expect.arrayContaining([{ cid: expect.anything(), refusal: "grant" }, { cid: null, refusal: "shape" }]) });
  });

  test("RED: swarm acts share the doc with promote acts and neither family reads the other; CONTROL: each family lists its own", async () => {
    const f = await fixture();
    const doc = { tiddlers: {} } as LarDoc;
    const cap = await f.cap(10), kapae = await signPromoteKapae({ group: GROUP, epoch: 0, wiki: "w", digest: "d".repeat(64), raised: true, parents: [] }, f.root);
    writeSwarmBoardAct(doc, cap); writePromoteAct(doc, kapae);
    expect(swarmBoardRecords(doc, GROUP)).toHaveLength(1);
    expect(promoteActRecords(doc, GROUP)).toHaveLength(1);
    expect(f.read(promoteActRecords(doc, GROUP))).toMatchObject({ cap: null, refused: [{ refusal: "shape" }] });
    expect(f.read(swarmBoardRecords(doc, GROUP))).toMatchObject({ cap: 10 });
  });
});

describe("a refused cap tip fails toward the brake", () => {
  /** A face of two devices: the witness refuses the caps it names (an issuer the reader now reads aside), and stands the rest. */
  const asideFor = (f: Awaited<ReturnType<typeof fixture>>, refused: Map<string, WardActRefusal>) => {
    const face = { ...f.face, ward: { accepts: (act: { head: string }) => !refused.has(act.head), refusal: (act: { head: string }) => refused.get(act.head) ?? null } };
    return (acts: unknown[]) => readSwarmBoard(acts, face);
  };
  const headOf = (act: { body: { value: number; parents: readonly string[]; supersede?: true } }) => swarmCapHead(act.body);

  test("RED: a cap tightened 10 -> 5 under the co-sign whose issuer the reader then reads aside reads the looser 10; CONTROL: it reads 5, an untouched line reads its tip, and a refused LOOSER tip never loosens", async () => {
    const f = await fixture();
    const ten = await f.cap(10), five = await f.cap(5, [f.cid(ten)]);
    const refused = new Map<string, WardActRefusal>();
    const read = asideFor(f, refused);
    expect(read([ten, five]).cap, "the untouched line reads its tip").toBe(5);
    refused.set(headOf(five), "ward-issuer-aside");
    const r = read([ten, five]);
    expect(r.refused).toEqual([{ cid: f.cid(five), refusal: "ward-issuer-aside" }]);
    expect(r.cap, "a refused tip reads the tightest cap the line ever stood").toBe(5);
    refused.set(headOf(five), "ward-issuer-unknown");
    expect(read([ten, five]).cap).toBe(5);
    refused.set(headOf(five), "ward-act-uncosigned");
    expect(read([ten, five]).cap).toBe(5);
    // a refused tip that would LOOSEN the line moves nothing: the stood tip reads
    const loose = await f.cap(20, [f.cid(ten)]);
    refused.clear();
    refused.set(headOf(loose), "ward-issuer-aside");
    expect(read([ten, loose]).cap).toBe(10);
  });

  test("RED: a refused tip deep in a longer line still lets an older looser cap read; CONTROL: the minimum of every cap the line stood holds, and a hand's supersede citing the refused tip roots the line again", async () => {
    const f = await fixture();
    const twelve = await f.cap(12), eight = await f.cap(8, [f.cid(twelve)]), nine = await f.cap(9, [f.cid(eight)]), three = await f.cap(3, [f.cid(nine)]);
    const refused = new Map<string, WardActRefusal>([[headOf(three), "ward-issuer-aside"]]);
    const read = asideFor(f, refused);
    expect(read([twelve, eight, nine, three]).cap, "the tightest of 12, 8, 9 and the refused 3").toBe(3);
    const restart = await f.cap(15, [f.cid(three)]);
    const superseded = await signSwarmCap({ group: GROUP, epoch: 0, value: 15, parents: [f.cid(three)], supersede: true }, f.root);
    expect(read([twelve, eight, nine, three, restart]).cap, "an ordinary act citing the refused tip lacks its parent").toBe(0);
    expect(read([twelve, eight, nine, three, superseded]).cap, "the hand's supersede roots the line again").toBe(15);
  });

  test("CONTROL: a record refused by signature or grant moves nothing, so a stranger's zero cap brakes nothing", async () => {
    const f = await fixture();
    const ten = await f.cap(10);
    const forged = await f.cap(0, [f.cid(ten)], f.outsider);
    const read = asideFor(f, new Map());
    expect(read([ten, forged]).cap).toBe(10);
  });
});
