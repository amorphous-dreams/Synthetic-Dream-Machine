/**
 * handle-book-faces — the handle-book tags each record with the faces that recognised it, and one face's
 * snapshot carries that face's records alone, each under that face's own label.
 *
 * A vessel may hold several faces whose veils stand blind to one another. A face's backup bundle carries what
 * that face recognised and nothing another face did; a record no face tagged stays on its vessel.
 *
 * Synthetic names and keys. Canon: lar:///ha.ka.ba/lararium/mesh/custody#/the-table
 */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { signHandleCard, type HandleCard } from "../src/handle-card.js";
import { mintHandleInception, type HandleKelEvent } from "../src/handle-kel.js";
import { HandleBook } from "../src/handle-book.js";
import { composeFollow, type CircleStore } from "../src/compose-follow.js";
import { hex } from "../src/crypto.js";

async function cardOf(fill: number, glamour: string): Promise<HandleCard> {
  const seed = new Uint8Array(32).fill(fill);
  const did = `0x${await ed.getPublicKeyAsync(seed).then(hex)}`;
  const chain: HandleKelEvent[] = [mintHandleInception(did, did, "ab".repeat(32), `hkeynext-${"cd".repeat(32)}`)];
  return signHandleCard({ nym: chain[0]!.prefix, chain, glamour, parents: [], standing: null, fleetProof: null }, (b) => ed.signAsync(b, seed).then(hex));
}
const FACE_A = "a1".repeat(32);
const FACE_B = "b2".repeat(32);

describe("a record names the faces that recognised it", () => {
  test("a card taken under a face tags that face; taken under none, it tags nobody", async () => {
    const book = new HandleBook();
    const friend = await cardOf(11, "friend"), stranger = await cardOf(12, "stranger");
    expect((await book.ingest(friend, undefined, FACE_A)).ok).toBe(true);
    expect((await book.ingest(stranger)).ok).toBe(true);
    expect(book.get(friend.nym)?.recognisedBy).toEqual([{ face: FACE_A, petname: null }]);
    expect(book.get(stranger.nym)?.recognisedBy).toBeUndefined();
  });

  test("a card that refuses tags nothing", async () => {
    const book = new HandleBook();
    const friend = await cardOf(11, "friend");
    const forged = { ...friend, glamour: "forged" } as HandleCard;
    expect((await book.ingest(forged, undefined, FACE_A)).ok).toBe(false);
    expect(book.get(friend.nym)).toBeUndefined();
  });

  test("two faces recognise one nym under two labels, and each keeps its own", async () => {
    const book = new HandleBook();
    const friend = await cardOf(11, "friend");
    await book.ingest(friend, undefined, FACE_A);
    book.setPetname(friend.nym, "Ana", FACE_A);
    await book.ingest(friend, undefined, `0x${FACE_B.toUpperCase()}`);
    book.setPetname(friend.nym, "Bea", FACE_B);
    expect(book.get(friend.nym)?.recognisedBy).toEqual([{ face: FACE_A, petname: "Ana" }, { face: FACE_B, petname: "Bea" }]);
    // A second card under a face already named keeps that face's label.
    await book.ingest(friend, undefined, FACE_A);
    expect(book.get(friend.nym)?.recognisedBy?.[0]).toEqual({ face: FACE_A, petname: "Ana" });
  });

  test("a face spelled as no key refuses, and nothing lands", async () => {
    const book = new HandleBook();
    const friend = await cardOf(11, "friend");
    await expect(book.ingest(friend, undefined, "not-a-key")).rejects.toThrow(/64-hex root key/);
    expect(book.get(friend.nym)).toBeUndefined();
  });

  test("the tags survive a restore, and a tag of another shape drops", async () => {
    const book = new HandleBook();
    const friend = await cardOf(11, "friend");
    await book.ingest(friend, undefined, FACE_A);
    book.setPetname(friend.nym, "Ana", FACE_A);
    const snapshot = JSON.parse(JSON.stringify(book.snapshot())) as { records: Array<{ recognisedBy: unknown[] }> };
    snapshot.records[0]!.recognisedBy.push({ face: "zz", petname: "bent" }, { face: FACE_A, petname: "twice" });
    const again = await HandleBook.restore(snapshot);
    expect(again.get(friend.nym)?.recognisedBy).toEqual([{ face: FACE_A, petname: "Ana" }]);
  });
});

describe("one face's snapshot carries that face's records alone", () => {
  async function twoFaces() {
    const book = new HandleBook();
    const shared = await cardOf(11, "shared"), onlyA = await cardOf(12, "only-a"), onlyB = await cardOf(13, "only-b"), untagged = await cardOf(14, "untagged");
    await book.ingest(shared, undefined, FACE_A); book.setPetname(shared.nym, "Ana", FACE_A);
    await book.ingest(shared, undefined, FACE_B); book.setPetname(shared.nym, "Bea", FACE_B);
    await book.ingest(onlyA, undefined, FACE_A);
    await book.ingest(onlyB, undefined, FACE_B); book.setPetname(onlyB.nym, "secret-of-b", FACE_B);
    await book.ingest(untagged); book.setPetname(untagged.nym, "nobody's");
    return { book, shared, onlyA, onlyB, untagged };
  }

  test("face A's snapshot holds A's records under A's labels, and no word of face B's", async () => {
    const { book, shared, onlyA, onlyB, untagged } = await twoFaces();
    const mine = book.snapshotFor(FACE_A);
    expect(mine.records.map((r) => r.nym).sort()).toEqual([shared.nym, onlyA.nym].sort());
    expect(mine.records.find((r) => r.nym === shared.nym)?.petname).toBe("Ana");
    const text = JSON.stringify(mine);
    // CONTROL: the whole snapshot does carry the words the face's own must not.
    const whole = JSON.stringify(book.snapshot());
    for (const word of [FACE_B, "Bea", "secret-of-b", onlyB.nym, untagged.nym, "nobody's"]) {
      expect(whole.includes(word)).toBe(true);
      expect(text.includes(word)).toBe(false);
    }
  });

  test("an untagged record enters no face's snapshot", async () => {
    const { book, untagged } = await twoFaces();
    for (const face of [FACE_A, FACE_B]) expect(book.snapshotFor(face).records.some((r) => r.nym === untagged.nym)).toBe(false);
    // CONTROL: the vessel's own snapshot keeps it.
    expect(book.snapshot().records.some((r) => r.nym === untagged.nym)).toBe(true);
  });

  test("a face's records land additively on another book: a held nym keeps its label, a new one takes the face's", async () => {
    const { book, shared, onlyA } = await twoFaces();
    const fresh = new HandleBook();
    await fresh.ingest(shared); fresh.setPetname(shared.nym, "kept-here");
    const out = await fresh.landFor(FACE_A, JSON.parse(JSON.stringify(book.snapshotFor(FACE_A))));
    expect(out).toEqual({ landed: 1, kept: 1 });
    expect(fresh.get(shared.nym)?.petname).toBe("kept-here");
    expect(fresh.get(shared.nym)?.recognisedBy).toEqual([{ face: FACE_A, petname: "Ana" }]);
    expect(fresh.get(onlyA.nym)?.recognisedBy).toEqual([{ face: FACE_A, petname: null }]);
    expect(fresh.isRecognized(onlyA.nym)).toBe(true);
    // The same records a second time move nothing.
    expect(await fresh.landFor(FACE_A, JSON.parse(JSON.stringify(book.snapshotFor(FACE_A))))).toEqual({ landed: 0, kept: 2 });
    // A record whose card fails its own check lands nothing.
    const bent = JSON.parse(JSON.stringify(book.snapshotFor(FACE_B))) as { records: Array<{ accepted: Array<{ glamour: string }> }> };
    for (const r of bent.records) for (const c of r.accepted) c.glamour = "bent";
    expect(await new HandleBook().landFor(FACE_B, bent)).toEqual({ landed: 0, kept: 0 });
  });
});

describe("a follow tags the face that follows", () => {
  test("composeFollow hands its face to the card's ingest and to the label", async () => {
    const book = new HandleBook();
    const friend = await cardOf(11, "friend");
    const held = new Map<string, Set<string>>();
    const circles = {
      add: async (c: string, n: string) => { (held.get(c) ?? held.set(c, new Set()).get(c)!).add(n); },
      remove: async () => {}, members: async (c: string) => [...(held.get(c) ?? [])], circles: async () => [...held.keys()],
    } as unknown as CircleStore;
    await composeFollow({ book, circles, nym: friend.nym, circleId: "following", card: friend, petname: "Ana", by: FACE_A });
    expect(book.get(friend.nym)?.recognisedBy).toEqual([{ face: FACE_A, petname: "Ana" }]);
    // CONTROL: a follow that names no face tags nobody.
    const other = await cardOf(12, "other");
    await composeFollow({ book, circles, nym: other.nym, circleId: "following", card: other, petname: "Oto" });
    expect(book.get(other.nym)?.recognisedBy).toBeUndefined();
    expect(book.get(other.nym)?.petname).toBe("Oto");
  });
});
