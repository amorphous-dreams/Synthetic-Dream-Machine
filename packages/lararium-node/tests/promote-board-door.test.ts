/**
 * promote-board-door — the node's one door onto the face's promote board: the seat's prepare under the device atom, the hand's raise
 * and lower under the face's grant, the mint that only the founding act performs. A seat's raise refuses `kapae-needs-hand` before any
 * signing. A lower cites every standing head. Every red pairs with a CONTROL.
 * Meme: lar:///ha.ka.ba/lares/api/pono/kapae
 */
import { describe, expect, test } from "vitest";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, promoteBoardDocUrl, readPromoteBoard, PROMOTE_PLANE, type PromoteWho } from "@lararium/mesh";
import { promoteBoardDoor } from "../src/promote-board-door.js";

const GROUP = "face-group", W1 = "lar:///ha.ka.ba/wikis/field-notes", W2 = "lar:///ha.ka.ba/wikis/garden", D = "d".repeat(64);
const HAND: PromoteWho = { kind: "hand", id: "hand-1" }, SEAT: PromoteWho = { kind: "seat", id: "seat-1" };

async function door(opts: { grantHeld?: boolean; pinned?: boolean } = {}) {
  const root = { key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(1)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(1)) };
  const atom = { key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(2)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(2)) };
  const face = { group: GROUP, grant: (k: string) => k === root.key, device: (k: string) => k === atom.key };
  const acts: unknown[] = [];
  const d = promoteBoardDoor({
    group: GROUP, face, atom, epoch: () => 0,
    rootSigner: async () => { if (opts.grantHeld === false) throw new Error("no root in custody"); return root; },
    board: { records: async () => acts, land: async (a) => { acts.push(a); } },
    projection: () => ({ planes: opts.pinned === false ? {} : { [PROMOTE_PLANE]: promoteBoardDocUrl(GROUP) } }),
  });
  return { d, acts, read: () => readPromoteBoard(acts, face) };
}

describe("the hand's raise and lower", () => {
  test("RED: a seat's raise and lower refuse `kapae-needs-hand` and land nothing; CONTROL: the hand's raise shadows (wiki, digest) for the whole board", async () => {
    const { d, acts, read } = await door();
    await expect(d.kapae({ action: "raise", wiki: W1, digest: D, who: SEAT })).rejects.toMatchObject({ code: "kapae-needs-hand" });
    await expect(d.kapae({ action: "lower", wiki: W1, digest: D, who: SEAT })).rejects.toMatchObject({ code: "kapae-needs-hand" });
    expect(acts).toEqual([]);
    await d.kapae({ action: "raise", wiki: W1, digest: D, who: HAND });
    expect([...read().shadowed(W1)]).toEqual([D]);
    expect(read().shadowed(W2).size).toBe(0);
  });

  test("RED: a lower cites every standing head and lifts; a lower with nothing raised refuses `kapae-nothing-to-lower`; CONTROL: a second raise stacks and one lower still lifts both", async () => {
    const { d, read } = await door();
    await expect(d.kapae({ action: "lower", wiki: W1, digest: D, who: HAND })).rejects.toMatchObject({ code: "kapae-nothing-to-lower" });
    await d.kapae({ action: "raise", wiki: W1, digest: D, who: HAND });
    await d.kapae({ action: "raise", wiki: W1, digest: D, who: HAND, nonce: "second" });
    expect(read().kapaeHeads(W1, D).length).toBeGreaterThanOrEqual(1);
    await d.kapae({ action: "lower", wiki: W1, digest: D, who: HAND });
    expect(read().kapae(W1, D)).toBe("withdrawn");
  });

  test("RED: a hand without the grant in custody refuses `operator-grant-absent`; CONTROL: the held grant signs", async () => {
    const lost = await door({ grantHeld: false });
    await expect(lost.d.kapae({ action: "raise", wiki: W1, digest: D, who: HAND })).rejects.toMatchObject({ code: "operator-grant-absent" });
    expect(lost.acts).toEqual([]);
  });
});

describe("prepare and mint", () => {
  test("RED: a seat prepares under the device atom with a reason and the board reads it keyed by wiki; CONTROL: a blank reason refuses", async () => {
    const { d, read } = await door();
    await d.prepare({ wiki: W1, digest: D, title: "rites/a", classes: ["module-type"], why: "opens the field-notes macro" });
    expect(read().prepared(W1)).toHaveLength(1);
    expect(read().prepared(W2)).toEqual([]);
    await expect(d.prepare({ wiki: W1, digest: D, title: "rites/a", classes: [], why: " " })).rejects.toThrow(/shape/);
  });

  test("RED: a mint outside the founding act refuses `promote-mint-outside-founding`; CONTROL: a pinned face answers its url and signs nothing", async () => {
    const pinned = await door(), unpinned = await door({ pinned: false });
    expect(await pinned.d.mint()).toEqual({ url: promoteBoardDocUrl(GROUP), minted: false });
    await expect(unpinned.d.mint()).rejects.toMatchObject({ code: "promote-mint-outside-founding" });
    expect(unpinned.acts).toEqual([]);
  });
});
