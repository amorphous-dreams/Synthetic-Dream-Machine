/**
 * realm-bag-kahu-reach — THE KAHU CANON CROSSES ONLY TO KAHU HANDS (road `P26`).
 *
 * The ruling (stable-founding-road #/rulings, 2026-10-16 and 2026-10-18): only each Nexus's Kahu cabal writes the
 * `lares` and `lararium` documents live; every other hand reads the floor by CID, and the live documents rest "held by
 * no vessel outside" the cabal. The Kahu bags register on the hearth's realm at CONTRACT tier, and `RealmBagGate`'s
 * Nexus lane opened every registered book to every member leaf of the Nexus. automerge-repo's access hook judges a
 * document per peer in BOTH directions, so a member that may read a book also lands its changes in the hearth's
 * replica: the member's record then mounts as canon on the hearth's keel.
 *
 * The cure closes the replica set over Kahu hands: a Kahu document (one the keel's steward-verified canon names, the
 * consult's own `docs`) answers to the Kahu reach consult ALONE, ahead of the base gate and every lane. Inside that
 * closed set every change comes from a hand that holds reach, so no change's actor id needs binding to a key.
 *
 * RED 1 (the mount): a Nexus member syncs a record into `@lares`; the hearth's replica carries it.
 * RED 2: the gate answers true for that member on the Kahu document.
 * RED 3: another hand's registration naming the Kahu document under a non-system bag opens nothing.
 * RED 4 (revised with Sol's read): a consult whose `docs` throws reads every document as Kahu (fail closed).
 * CONTROL 1: a Kahu hand that holds NO Nexus membership reads the document and its change lands (reach alone opens it).
 * CONTROL 2: a CONTRACT book that names no system bag still crosses to the Nexus member, as before.
 * CONTROL 3: the member shadow still shuts a Kahu hand out.
 * CONTROL 4 (Sol's read): a self-signed registration naming an ordinary book under `@lares` closes nothing: the
 *   registry, which any self-named steward seals, never names the canon.
 */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { Repo, interpretAsDocumentId, type AutomergeUrl, type DocumentId, type PeerId } from "@automerge/automerge-repo";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";
import { hex } from "../src/crypto.js";
import { RealmBagGate, signRealmBagRegistration, writeRealmBagRegistration } from "../src/realm-bag.js";
import { deterministicDocUrl } from "../src/deterministic-doc.js";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";
import { storedLarRecord } from "../src/stored-record.js";
import { shareConfigOf, type FederationGate, type NexusMembership } from "../src/federation-gate.js";
import { LARES_DOC_URI } from "../src/lar-uris.js";

const realm = "b".repeat(64);
const realmUrl = deterministicDocUrl("kahu-reach-realm");
const stewardSeed = new Uint8Array(32).fill(9), forgerSeed = new Uint8Array(32).fill(4);
const peer = (s: string) => s as PeerId;
const id = (url: string): DocumentId => interpretAsDocumentId(url as AutomergeUrl) as DocumentId;
const base: FederationGate = { mayFederate: async () => false };
const membership = (...members: string[]): NexusMembership => ({ holdsCarriagePeer: (p) => members.includes(p) });
const signerOf = async (seed: Uint8Array) => ({ signer: hex(await ed.getPublicKeyAsync(seed)), sign: (bytes: Uint8Array) => ed.signAsync(bytes, seed).then(hex) });

/** The options the cure reads; typed loosely so this file runs against the gate as it stood before the cure. */
type KahuOpts = ConstructorParameters<typeof RealmBagGate>[3] & {
  readonly kahuCanon?: { readonly docs: () => ReadonlySet<string>; readonly reach: (peerId: string) => boolean };
};
const gateOf = (members: NexusMembership, opts: KahuOpts): RealmBagGate =>
  new RealmBagGate(base, members, realmUrl, opts as ConstructorParameters<typeof RealmBagGate>[3]);

async function realmWith(rows: ReadonlyArray<{ bagUri: string; docUrl: string; seed: Uint8Array }>): Promise<LarDoc> {
  const doc = { tiddlers: {} } as LarDoc;
  for (const row of rows) {
    const rec = await signRealmBagRegistration({ realmId: realm, bagUri: row.bagUri, docUrl: row.docUrl, readTier: "contract" }, [await signerOf(row.seed)]);
    writeRealmBagRegistration(doc, rec);
  }
  return doc;
}

const settle = async <T,>(p: Promise<T>, ms: number): Promise<"ready" | "unavailable" | "timeout"> =>
  Promise.race([
    p.then(() => "ready" as const, () => "unavailable" as const),
    new Promise<"timeout">((r) => setTimeout(() => r("timeout"), ms)),
  ]);

/**
 * Write one record on a peer's replica and give the channel time to carry it; answer whether the hearth holds it.
 * The hearth mints the canon and folds its realm BEFORE the peer's channel attaches: a Repo judges a document for each
 * connected peer when the document arrives, so a verdict read ahead of the fold would decide the crossing.
 */
async function syncedWrite(gate: FederationGate, peerName: string, title: string): Promise<{ reached: string; landed: boolean }> {
  const hearth = new Repo({
    network: [], peerId: "hearth" as PeerId,
    shareConfig: shareConfigOf(async (peerId, documentId) => documentId !== undefined && gate.mayFederate(documentId, peerId)),
  });
  const canon = hearth.create<LarDoc>(emptyLarDoc());
  canon.change((d) => { d.tiddlers["$:/canon/standing"] = storedLarRecord("$:/canon/standing", { text: "the steward's" }, "kahu"); });
  kahuDocs.add(String(canon.documentId));
  await (gate as RealmBagGate).refold(await realmWith([{ bagUri: LARES_DOC_URI, docUrl: canon.url, seed: stewardSeed }]), realm);
  const { port1, port2 } = new MessageChannel();
  hearth.networkSubsystem.addNetworkAdapter(new MessageChannelNetworkAdapter(port1));
  const other = new Repo({ network: [new MessageChannelNetworkAdapter(port2)], peerId: peerName as PeerId });
  try {
    await Promise.all([hearth.networkSubsystem.whenReady(), other.networkSubsystem.whenReady()]);
    const reached = await settle(other.find<LarDoc>(canon.url).then((h) => h.doc()), 3_000);
    if (reached === "ready") {
      const theirs = await other.find<LarDoc>(canon.url);
      theirs.change((d) => { d.tiddlers[title] = storedLarRecord(title, { text: "a member's line" }, "member"); });
      // Wait on the hearth's own change, bounded: a landing write ends the wait at once; a refused one runs out the bound.
      await new Promise<void>((done) => {
        const timer = setTimeout(done, 3_000);
        canon.on("change", () => { if (canon.doc()?.tiddlers?.[title] !== undefined) { clearTimeout(timer); done(); } });
      });
    }
    return { reached, landed: canon.doc()?.tiddlers?.[title] !== undefined };
  } finally {
    kahuDocs.clear();
    port1.close(); port2.close();
    await Promise.allSettled([hearth.shutdown(), other.shutdown()]);
  }
}

const kahuDocs = new Set<string>();
const kahuCanon = (hands: readonly string[]) => ({ docs: () => kahuDocs, reach: (p: string) => hands.includes(p) });

describe("the Kahu canon crosses only to Kahu hands", () => {
  test("RED 1 — a Nexus member's synced change to @lares never lands in the hearth's replica", async () => {
    const gate = gateOf(membership("member"), { kahuCanon: kahuCanon(["steward-leaf"]) });
    const { reached, landed } = await syncedWrite(gate, "member", "$:/member/line");
    // Refused, never merely slow: the hearth answers the member's find unavailable inside the bound.
    expect(reached).toBe("unavailable");
    expect(landed).toBe(false);
  });

  test("RED 2 — the gate answers no for a Nexus member on a Kahu document", async () => {
    const canonUrl = deterministicDocUrl("kahu-lares-doc");
    kahuDocs.add(String(id(canonUrl)));
    try {
      const gate = gateOf(membership("member"), { kahuCanon: kahuCanon(["steward-leaf"]) });
      await gate.refold(await realmWith([{ bagUri: LARES_DOC_URI, docUrl: canonUrl, seed: stewardSeed }]), realm);
      expect(await gate.mayFederate(id(canonUrl), peer("member"))).toBe(false);
    } finally { kahuDocs.clear(); }
  });

  test("RED 3 — another hand's registration naming the Kahu document under its own bag opens nothing", async () => {
    const canonUrl = deterministicDocUrl("kahu-lares-doc-3");
    kahuDocs.add(String(id(canonUrl)));
    try {
      const gate = gateOf(membership("member"), { kahuCanon: kahuCanon([]) });
      await gate.refold(await realmWith([
        { bagUri: LARES_DOC_URI, docUrl: canonUrl, seed: stewardSeed },
        { bagUri: "lar:///ha.ka.ba/bags/forged", docUrl: canonUrl, seed: forgerSeed },
      ]), realm);
      expect(await gate.mayFederate(id(canonUrl), peer("member"))).toBe(false);
    } finally { kahuDocs.clear(); }
  });

  test("RED 4 — a consult whose docs throw reads every document as Kahu (fail closed)", async () => {
    const bookUrl = deterministicDocUrl("ordinary-book-4");
    const gate = gateOf(membership("member"), { kahuCanon: { docs: () => { throw new Error("canon unreadable"); }, reach: () => false } });
    await gate.refold(await realmWith([{ bagUri: "lar:///ha.ka.ba/bags/ordinary", docUrl: bookUrl, seed: stewardSeed }]), realm);
    expect(await gate.mayFederate(id(bookUrl), peer("member"))).toBe(false);
  });

  test("CONTROL 4 — a self-signed registration naming an ordinary book under @lares closes nothing", async () => {
    const bookUrl = deterministicDocUrl("ordinary-book-c4");
    const gate = gateOf(membership("member"), { kahuCanon: kahuCanon([]) });
    await gate.refold(await realmWith([{ bagUri: LARES_DOC_URI, docUrl: bookUrl, seed: forgerSeed }]), realm);
    expect(await gate.mayFederate(id(bookUrl), peer("member"))).toBe(true);
  });

  test("CONTROL 1 — a Kahu hand reads the document, and its synced change lands", async () => {
    // The Kahu hand stands in no Nexus membership: reach ALONE opens the document (revised with Luna's read).
    const gate = gateOf(membership(), { kahuCanon: kahuCanon(["steward-leaf"]) });
    const { reached, landed } = await syncedWrite(gate, "steward-leaf", "$:/steward/line");
    expect(reached).toBe("ready");
    expect(landed).toBe(true);
  });

  test("CONTROL 2 — a CONTRACT book that names no system bag still crosses to the Nexus member", async () => {
    const bookUrl = deterministicDocUrl("ordinary-contract-book");
    const gate = gateOf(membership("member"), { kahuCanon: kahuCanon([]) });
    await gate.refold(await realmWith([{ bagUri: "lar:///ha.ka.ba/bags/ordinary", docUrl: bookUrl, seed: stewardSeed }]), realm);
    expect(await gate.mayFederate(id(bookUrl), peer("member"))).toBe(true);
  });

  test("CONTROL 3 — the member shadow shuts a Kahu hand out of the Kahu document", async () => {
    const canonUrl = deterministicDocUrl("kahu-lares-doc-c3");
    kahuDocs.add(String(id(canonUrl)));
    try {
      const gate = gateOf(membership(), { kahuCanon: kahuCanon(["steward-leaf"]), memberAside: (p) => p === "steward-leaf" });
      await gate.refold(await realmWith([{ bagUri: LARES_DOC_URI, docUrl: canonUrl, seed: stewardSeed }]), realm);
      expect(await gate.mayFederate(id(canonUrl), peer("steward-leaf"))).toBe(false);
    } finally { kahuDocs.clear(); }
  });
});
