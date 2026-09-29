import { describe, expect, test } from "vitest";
import * as ed from "@noble/ed25519";
import { computePluginsCid } from "../src/genesis-doc.js";
import { hex } from "../src/crypto.js";
import {
  pluginOfferingCid,
  signPluginOffering,
  type OfferedBlob,
} from "../src/plugin-offering.js";
import {
  PLUGIN_OFFERING_ANNOUNCE_DOMAIN,
} from "../src/domains.js";
import {
  offeringAnnounceKey,
  offeringAnnouncesFromDoc,
  pluginOfferingAnnounceOf,
  verifiedPluginOfferingsFromDoc,
  writeOfferingAnnounce,
} from "../src/offering-announce.js";
import { emptyLarDoc, mutableLarRecord, type LarDoc } from "../src/base-doc.js";

const BLOBS: readonly OfferedBlob[] = [
  { id: "$:/plugins/alpha/a", version: "1.0.0", sha256: "aa".repeat(32) },
  { id: "$:/plugins/alpha/b", version: "1.0.0", sha256: "bb".repeat(32) },
];

const seedOf = (n: number) => new Uint8Array(32).fill(n);
const signerOf = (seed: Uint8Array) => (bytes: Uint8Array) => ed.signAsync(bytes, seed).then(hex);
const keyOf = (seed: Uint8Array) => ed.getPublicKeyAsync(seed).then(hex);
const emptyDoc = (): LarDoc => emptyLarDoc() as LarDoc;

async function offering(seed: Uint8Array, blobs: readonly OfferedBlob[] = BLOBS, pluginsCid = computePluginsCid(BLOBS)) {
  return signPluginOffering({ offeror: await keyOf(seed), pluginsCid, blobs }, signerOf(seed));
}

describe("immutable plugin offering announcement", () => {
  test("two offerors announcing the same collection keep distinct CID-keyed records", async () => {
    const a = await offering(seedOf(1));
    const b = await offering(seedOf(2));
    expect(a.pluginsCid).toBe(b.pluginsCid);
    expect(pluginOfferingCid(a)).not.toBe(pluginOfferingCid(b));

    const doc = emptyDoc();
    writeOfferingAnnounce(doc, a);
    writeOfferingAnnounce(doc, b);
    expect(offeringAnnouncesFromDoc(doc)).toHaveLength(2);
    expect(doc.tiddlers[offeringAnnounceKey(pluginOfferingCid(a))]).toBeDefined();
    expect(doc.tiddlers[offeringAnnounceKey(pluginOfferingCid(b))]).toBeDefined();
  });

  test("the consumer rejects a bad signature and a signed wrong-region fold", async () => {
    const honest = await offering(seedOf(3));
    const badSig = { ...honest, sig: "00".repeat(64) };
    const wrongFold = await offering(seedOf(4), [{ ...BLOBS[0]!, sha256: "cc".repeat(32) }, BLOBS[1]!], honest.pluginsCid);
    const doc = emptyDoc();
    writeOfferingAnnounce(doc, badSig);
    writeOfferingAnnounce(doc, wrongFold);
    expect(await verifiedPluginOfferingsFromDoc(doc)).toEqual([]);
  });

  test("malformed board records skip without throwing", async () => {
    const doc = emptyDoc();
    doc.tiddlers["foreign"] = mutableLarRecord("foreign", { text: JSON.stringify({ kind: "elsewhere" }) }, "test");
    doc.tiddlers[`${"lar:///ha.ka.ba/dreamnet/plugin-offering-announces/"}broken`] =
      mutableLarRecord("broken", { text: "{not-json" }, "test");
    doc.tiddlers[`${"lar:///ha.ka.ba/dreamnet/plugin-offering-announces/"}torn`] =
      mutableLarRecord("torn", { text: JSON.stringify({ kind: PLUGIN_OFFERING_ANNOUNCE_DOMAIN, offeringCid: "sha256:x" }) }, "test");
    expect(offeringAnnouncesFromDoc(doc)).toEqual([]);
  });

  test("matching-prefix records with empty or null tiddlers skip without throwing", async () => {
    const doc = emptyDoc();
    const prefix = "lar:///ha.ka.ba/dreamnet/plugin-offering-announces/";
    doc.tiddlers[`${prefix}empty`] = {} as never;
    doc.tiddlers[`${prefix}null`] = { tiddler: null } as never;

    expect(() => offeringAnnouncesFromDoc(doc)).not.toThrow();
    expect(offeringAnnouncesFromDoc(doc)).toEqual([]);
    await expect(verifiedPluginOfferingsFromDoc(doc)).resolves.toEqual([]);
  });

  test("a valid announcement under a mismatched arbitrary prefix is ignored", async () => {
    const original = await offering(seedOf(6));
    const announce = pluginOfferingAnnounceOf(original);
    const doc = emptyDoc();
    const wrongKey = `lar:///ha.ka.ba/dreamnet/plugin-offering-board/${encodeURIComponent(announce.offeringCid)}`;
    doc.tiddlers[wrongKey] = mutableLarRecord(wrongKey, { text: JSON.stringify(announce) }, "test");

    expect(offeringAnnouncesFromDoc(doc)).toEqual([]);
    await expect(verifiedPluginOfferingsFromDoc(doc)).resolves.toEqual([]);
  });

  test("duplicate physical records for one offering CID certify once", async () => {
    const original = await offering(seedOf(7));
    const announce = pluginOfferingAnnounceOf(original);
    const doc = emptyDoc();
    const key = offeringAnnounceKey(announce.offeringCid);
    doc.tiddlers[key] = mutableLarRecord(key, { text: JSON.stringify(announce) }, "test");
    const duplicateKey = `${key}/duplicate`;
    doc.tiddlers[duplicateKey] = mutableLarRecord(duplicateKey, { text: JSON.stringify(announce) }, "test");

    expect(offeringAnnouncesFromDoc(doc)).toEqual([announce]);
    await expect(verifiedPluginOfferingsFromDoc(doc)).resolves.toEqual([original]);
  });

  test("reannouncement preserves the same signed offering bytes and CID", async () => {
    const first = await offering(seedOf(5));
    const doc = emptyDoc();
    writeOfferingAnnounce(doc, first);
    const key = offeringAnnounceKey(pluginOfferingCid(first));
    const firstText = (doc.tiddlers[key]!.tiddler as { text: string }).text;

    writeOfferingAnnounce(doc, first);
    const secondText = (doc.tiddlers[key]!.tiddler as { text: string }).text;
    expect(secondText).toBe(firstText);
    expect(offeringAnnouncesFromDoc(doc)[0]).toEqual(pluginOfferingAnnounceOf(first));
  });
});
