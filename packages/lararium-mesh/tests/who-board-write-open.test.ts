/**
 * who-board-write-open.test.ts — the WHO board admits anyone; standing arrives as a READ verdict.
 *
 * THE LAW THIS FENCES: **WRITE-OPEN, READ-CERTIFIED.** `writeHandleAnnounce` gates nothing — it lands a card
 * at its key for any nym whatever, one standing in no PersonaGroup, no cabal, no book, no membership anywhere.
 * `readHandleAnnounces` gates nothing either: it filters SHAPE and certifies nothing. The recogniser
 * (`verifyHandleCard` / `HandleBook`) decides standing, alone, off the card's own chain.
 *
 * A FUTURE MEMBERSHIP GATE ON THE WRITE PATH READS AS A REGRESSION, NEVER A HARDENING. To refuse a stranger's
 * card at write time, the writer must consult a set of who-may-announce — and that set IS the compiled
 * registry the registry-filter law rejects (lar:///ha.ka.ba/lararium/mesh/handle-card#/public-by-design). A
 * write-side gate would therefore compile a roster while wearing the face of a security fix, and it would buy
 * nothing: an unrecognised card already fails the read, and a recognised one needs no permission to travel.
 * Whoever arrives here to "tighten" the write path meets this test first, and the reason with it.
 *
 * The CONTROLs prove the other half holds: the recogniser still refuses a forged signature and a nym that
 * does not match its chain, so the openness of the board costs no assurance.
 */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { from, save, load, change, type Doc } from "@automerge/automerge";
import { signHandleCard, verifyHandleCard, type HandleCard } from "../src/handle-card.js";
import { mintHandleInception, type HandleKelEvent } from "../src/handle-kel.js";
import { HandleBook } from "../src/handle-book.js";
import {
  writeHandleAnnounce, readHandleAnnounces, ingestAnnounceDoc, handleAnnounceKey,
} from "../src/handle-announce.js";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";
import { hex } from "../src/crypto.js";

/** A seed belonging to NOBODY — it founded no PersonaGroup, joined no cabal, sits in no recogniser's book. */
const STRANGER_SEED = new Uint8Array(32).fill(77);
const RECOVERY = "cd".repeat(32);

const signer = (seed: Uint8Array) => (bytes: Uint8Array) => ed.signAsync(bytes, seed).then(hex);
const rawPub = (seed: Uint8Array) => ed.getPublicKeyAsync(seed).then(hex);
function chainOf(pub: string): HandleKelEvent[] { const d = `0x${pub}`; return [mintHandleInception(d, d, RECOVERY)]; }

async function strangerCard(over: Partial<HandleCard> = {}): Promise<HandleCard> {
  const chain = chainOf(await rawPub(STRANGER_SEED));
  return signHandleCard({
    nym: chain[0]!.prefix, chain, glamour: "Nobody At All", version: 1, prev: null,
    expiry: 4_000_000_000_000, standing: null, ...over,
  }, signer(STRANGER_SEED));
}

/** The sync hop a relay actually performs — serialise and reload, so the claim stands on the real transport. */
function overTheWire(doc: Doc<LarDoc>): Doc<LarDoc> { return load<LarDoc>(save(doc)); }

describe("the WHO board writes open and certifies on read", () => {
  test("the board admits a card whose nym stands in no membership anywhere", async () => {
    const card = await strangerCard();

    // No group, no cabal, no roster consulted — the writer takes the draft and the card, and nothing else.
    let doc = from<LarDoc>(emptyLarDoc());
    doc = change(doc, (d) => writeHandleAnnounce(d, card));

    const landed = overTheWire(doc);
    expect(landed.tiddlers[handleAnnounceKey(card.nym)]).toBeDefined();
    expect(readHandleAnnounces(landed).map((c) => c.nym)).toEqual([card.nym]);

    // The gate cannot hide in a parameter: the writer's whole input IS (draft, card). A membership argument
    // appearing here would raise the arity and turn this red — deliberately, per the module's law.
    expect(writeHandleAnnounce.length).toBe(2);
  });

  test("the read path certifies nothing on its own — a forgery rides the board and dies at the recogniser", async () => {
    const genuine = await strangerCard();
    const forged: HandleCard = { ...genuine, glamour: "Somebody Important" };  // sig now covers other bytes

    let doc = from<LarDoc>(emptyLarDoc());
    doc = change(doc, (d) => writeHandleAnnounce(d, forged));

    // READ passes it through — the shape filter holds no opinion about authenticity.
    const read = readHandleAnnounces(overTheWire(doc));
    expect(read).toHaveLength(1);
    expect(read[0]!.glamour).toBe("Somebody Important");

    // CONTROL — the recogniser refuses it, naming why.
    expect((await verifyHandleCard(read[0]!)).reject).toBe("bad-signature");
    const book = new HandleBook();
    expect((await ingestAnnounceDoc(book, overTheWire(doc))).get(forged.nym)?.ok).toBe(false);
    expect(book.get(forged.nym)).toBeUndefined();          // nothing entered the held face
  });

  test("CONTROL — a nym that does not match its own chain rides the board and the recogniser refuses it", async () => {
    const genuine = await strangerCard();
    const mismatched: HandleCard = { ...genuine, nym: `${"0".repeat(2)}${genuine.nym.slice(2)}` };

    let doc = from<LarDoc>(emptyLarDoc());
    doc = change(doc, (d) => writeHandleAnnounce(d, mismatched));
    expect(readHandleAnnounces(overTheWire(doc))).toHaveLength(1);   // the board carried it without complaint

    const verdict = await verifyHandleCard(mismatched);
    expect(verdict.ok).toBe(false);
    expect(["nym-mismatch", "malformed"]).toContain(verdict.reject);
  });

  test("CONTROL — the stranger's GENUINE card earns standing off its own chain, membership nowhere in it", async () => {
    const card = await strangerCard();
    let doc = from<LarDoc>(emptyLarDoc());
    doc = change(doc, (d) => writeHandleAnnounce(d, card));

    const book = new HandleBook();
    const verdicts = await ingestAnnounceDoc(book, overTheWire(doc));
    expect(verdicts.get(card.nym)?.ok).toBe(true);
    expect(verdicts.get(card.nym)?.tier).toBe(1);          // self-contained — no board, no resolver, no roster
    expect(book.get(card.nym)?.card.glamour).toBe("Nobody At All");
  });
});
