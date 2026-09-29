import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { from, save, load, change, type Doc } from "@automerge/automerge";
import { signHandleCard, handleCardId, type HandleCard } from "../src/handle-card.js";
import { mintHandleInception, type HandleKelEvent } from "../src/handle-kel.js";
import { HandleBook } from "../src/handle-book.js";
import { writeHandleAnnounce, readHandleAnnounces, ingestAnnounceDoc, handleAnnounceKey } from "../src/handle-announce.js";
import { emptyLarDoc, mutableLarRecord, type LarDoc } from "../src/base-doc.js";
import { hex } from "../src/crypto.js";

const SEED = new Uint8Array(32).fill(9), signer = (b: Uint8Array) => ed.signAsync(b, SEED).then(hex);
async function publish(glamour: string, parents: readonly string[] = []): Promise<HandleCard> {
  const did = `0x${await ed.getPublicKeyAsync(SEED).then(hex)}`;
  const chain: HandleKelEvent[] = [mintHandleInception(did, did, "ab".repeat(32))];
  return signHandleCard({ nym: chain[0]!.prefix, chain, glamour, parents, standing: null, fleetProof: null }, signer);
}
function wire(doc: Doc<LarDoc>): Doc<LarDoc> { return load<LarDoc>(save(doc)); }

describe("CID-keyed Handle announcement board", () => {
  test("round-trips a card and retains concurrent acts", async () => {
    const root = await publish("root"), id = await handleCardId(root);
    const a = await publish("a", [id]), b = await publish("b", [id]);
    let doc = from<LarDoc>(emptyLarDoc());
    doc = change(doc, d => writeHandleAnnounce(d, root));
    doc = change(doc, d => { writeHandleAnnounce(d, a); writeHandleAnnounce(d, b); });
    const received = readHandleAnnounces(wire(doc));
    expect(received.map(c => c.actCid)).toEqual(expect.arrayContaining([root.actCid, a.actCid, b.actCid]));
    expect(received).toHaveLength(3);
    expect(doc.tiddlers[handleAnnounceKey(root.nym, a.actCid)]).toBeDefined();
  });

  test("book reads the board without arrival-order selection", async () => {
    const root = await publish("root"), id = await handleCardId(root);
    const a = await publish("a", [id]), b = await publish("b", [id]);
    let doc = from<LarDoc>(emptyLarDoc());
    doc = change(doc, d => { writeHandleAnnounce(d, root); writeHandleAnnounce(d, a); writeHandleAnnounce(d, b); });
    const book = new HandleBook();
    const verdicts = await ingestAnnounceDoc(book, wire(doc));
    expect(verdicts.size).toBe(1);
    expect(book.get(root.nym)?.heads).toHaveLength(2);
    expect(book.get(root.nym)?.card).toBeNull();
  });

  test("malformed board entries remain shape-skipped", async () => {
    const good = await publish("good"); let doc = from<LarDoc>(emptyLarDoc());
    doc = change(doc, d => {
      writeHandleAnnounce(d, good);
      const key = `${"lar:///ha.ka.ba/dreamnet/handles/"}${"f".repeat(64)}/bad`;
      d.tiddlers[key] = mutableLarRecord(key, { text: "{not-json" }, "attacker");
    });
    expect(readHandleAnnounces(wire(doc))).toHaveLength(1);
  });
});
