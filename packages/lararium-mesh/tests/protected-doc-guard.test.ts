/**
 * protected-doc-guard — THE ONE GUARD for documents classed by identity, composed as a vessel composes it: ahead of the realm
 * gate on the share verdict (road `P26`; controller design ruling 2026-10-31).
 *
 * The ruling (stable-founding-road #/rulings, 2026-10-16 and 2026-10-18): the live `lares` and `lararium` documents rest held
 * by no vessel outside the Kahu cabal. automerge-repo's access hook judges a document per peer in BOTH directions, so a lane
 * that lets a member read the canon also lets its changes land. The guard classes the canon by id alone and withholds it
 * from every peer whose live decider does not hold, whatever lane, alias or registration would open it.
 *
 * RED 1 (the mount; first written against the realm gate in 7e276b2ae): a Nexus member's synced change never lands in the
 *   hearth's replica; the member's find is refused inside the bound, never merely slow.
 * RED 2: the member, whom the realm gate's Nexus lane opens, draws denial on the canon.
 * RED 3: another hand's registration naming the canon under its own bag opens nothing: the class rides the id.
 * RED 4: an id map that throws withholds every document (fail closed); a class with no decider withholds its documents.
 * CONTROL 1: a Kahu hand reads the canon and its synced change lands, through an ordinary lane, once the decider holds.
 * CONTROL 2: an ordinary CONTRACT book still crosses to the Nexus member.
 * CONTROL 3: a self-signed registration naming an ordinary book under `@lares` classes nothing: only the id map classes.
 */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { Repo, interpretAsDocumentId, type AutomergeUrl, type DocumentId, type PeerId } from "@automerge/automerge-repo";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";
import { hex } from "../src/crypto.js";
import { RealmBagGate, signRealmBagRegistration, writeRealmBagRegistration } from "../src/realm-bag.js";
import { protectedDocGuard, type ProtectedDocClass, type ProtectedDocGuard } from "../src/protected-doc-guard.js";
import { deterministicDocUrl } from "../src/deterministic-doc.js";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";
import { storedLarRecord } from "../src/stored-record.js";
import { shareConfigOf, type FederationGate, type NexusMembership } from "../src/federation-gate.js";
import { LARES_DOC_URI } from "../src/lar-uris.js";

const realm = "b".repeat(64);
const realmUrl = deterministicDocUrl("kahu-reach-realm");
const stewardSeed = new Uint8Array(32).fill(9), forgerSeed = new Uint8Array(32).fill(4);
const id = (url: string): string => String(interpretAsDocumentId(url as AutomergeUrl));
const base: FederationGate = { mayFederate: async () => false };
const membership = (...members: string[]): NexusMembership => ({ holdsCarriagePeer: (p) => members.includes(p) });
const signerOf = async (seed: Uint8Array) => ({ signer: hex(await ed.getPublicKeyAsync(seed)), sign: (bytes: Uint8Array) => ed.signAsync(bytes, seed).then(hex) });

async function realmWith(rows: ReadonlyArray<{ bagUri: string; docUrl: string; seed: Uint8Array }>): Promise<LarDoc> {
  const doc = { tiddlers: {} } as LarDoc;
  for (const row of rows) {
    const rec = await signRealmBagRegistration({ realmId: realm, bagUri: row.bagUri, docUrl: row.docUrl, readTier: "contract" }, [await signerOf(row.seed)]);
    writeRealmBagRegistration(doc, rec);
  }
  return doc;
}

/** The verdict as a vessel composes it: the guard first, then the realm gate's lanes. */
const composed = (guard: ProtectedDocGuard, gate: FederationGate): FederationGate => ({
  mayFederate: async (documentId, peerId) => !(await guard.withholds(peerId, documentId === undefined ? undefined : String(documentId))) && gate.mayFederate(documentId, peerId),
});
const guardOver = (ids: () => ReadonlyMap<string, ProtectedDocClass>, hands: readonly string[]) =>
  protectedDocGuard({ ids, decide: { "kahu-canon": (p) => hands.includes(p) } });

const settle = async <T,>(p: Promise<T>, ms: number): Promise<"ready" | "unavailable" | "timeout"> =>
  Promise.race([
    p.then(() => "ready" as const, () => "unavailable" as const),
    new Promise<"timeout">((r) => setTimeout(() => r("timeout"), ms)),
  ]);

/**
 * Write one record on a peer's replica and wait, bounded, for the hearth to carry it. The hearth mints the canon and folds
 * its realm BEFORE the peer's channel attaches: a Repo judges a document for each connected peer when it arrives.
 */
async function syncedWrite(members: NexusMembership, hands: readonly string[], peerName: string, title: string): Promise<{ reached: string; landed: boolean }> {
  const kahu = new Map<string, ProtectedDocClass>();
  const gate = new RealmBagGate(base, members, realmUrl);
  const verdict = composed(guardOver(() => kahu, hands), gate);
  const hearth = new Repo({
    network: [], peerId: "hearth" as PeerId,
    shareConfig: shareConfigOf(async (peerId, documentId) => documentId !== undefined && verdict.mayFederate(documentId, peerId)),
  });
  const canon = hearth.create<LarDoc>(emptyLarDoc());
  canon.change((d) => { d.tiddlers["$:/canon/standing"] = storedLarRecord("$:/canon/standing", { text: "the steward's" }, "kahu"); });
  kahu.set(String(canon.documentId), "kahu-canon");
  await gate.refold(await realmWith([{ bagUri: LARES_DOC_URI, docUrl: canon.url, seed: stewardSeed }]), realm);
  const { port1, port2 } = new MessageChannel();
  hearth.networkSubsystem.addNetworkAdapter(new MessageChannelNetworkAdapter(port1));
  const other = new Repo({ network: [new MessageChannelNetworkAdapter(port2)], peerId: peerName as PeerId });
  try {
    await Promise.all([hearth.networkSubsystem.whenReady(), other.networkSubsystem.whenReady()]);
    const reached = await settle(other.find<LarDoc>(canon.url).then((h) => h.doc()), 3_000);
    if (reached === "ready") {
      const theirs = await other.find<LarDoc>(canon.url);
      theirs.change((d) => { d.tiddlers[title] = storedLarRecord(title, { text: "a line" }, "peer"); });
      await new Promise<void>((done) => {
        const timer = setTimeout(done, 3_000);
        canon.on("change", () => { if (canon.doc()?.tiddlers?.[title] !== undefined) { clearTimeout(timer); done(); } });
      });
    }
    return { reached, landed: canon.doc()?.tiddlers?.[title] !== undefined };
  } finally {
    port1.close(); port2.close();
    await Promise.allSettled([hearth.shutdown(), other.shutdown()]);
  }
}

describe("the one guard: the Kahu canon crosses only to Kahu hands", () => {
  test("RED 1 — a Nexus member's synced change never lands in the hearth's replica", async () => {
    const { reached, landed } = await syncedWrite(membership("member"), ["steward-leaf"], "member", "$:/member/line");
    expect(reached).toBe("unavailable");
    expect(landed).toBe(false);
  });

  test("RED 2 — the member, whom the Nexus lane opens, draws denial on the canon", async () => {
    const canonUrl = deterministicDocUrl("kahu-lares-doc");
    const gate = new RealmBagGate(base, membership("member"), realmUrl);
    await gate.refold(await realmWith([{ bagUri: LARES_DOC_URI, docUrl: canonUrl, seed: stewardSeed }]), realm);
    expect(await gate.mayFederate(id(canonUrl) as DocumentId, "member" as PeerId), "the Nexus lane alone opens it").toBe(true);
    const verdict = composed(guardOver(() => new Map([[id(canonUrl), "kahu-canon"]]), ["steward-leaf"]), gate);
    expect(await verdict.mayFederate(id(canonUrl) as DocumentId, "member" as PeerId)).toBe(false);
  });

  test("RED 3 — another hand's registration naming the canon under its own bag opens nothing", async () => {
    const canonUrl = deterministicDocUrl("kahu-lares-doc-3");
    const gate = new RealmBagGate(base, membership("member"), realmUrl);
    await gate.refold(await realmWith([
      { bagUri: LARES_DOC_URI, docUrl: canonUrl, seed: stewardSeed },
      { bagUri: "lar:///ha.ka.ba/bags/forged", docUrl: canonUrl, seed: forgerSeed },
    ]), realm);
    const verdict = composed(guardOver(() => new Map([[id(canonUrl), "kahu-canon"]]), []), gate);
    expect(await verdict.mayFederate(id(canonUrl) as DocumentId, "member" as PeerId)).toBe(false);
  });

  test("RED 4 — an id map that throws withholds every document; a class with no decider withholds its documents", async () => {
    const book = id(deterministicDocUrl("ordinary-book-4"));
    const torn = protectedDocGuard({ ids: () => { throw new Error("canon unreadable"); }, decide: { "kahu-canon": () => true } });
    expect(await torn.withholds("member", book)).toBe(true);
    const undecided = protectedDocGuard({ ids: () => new Map([[book, "kahu-canon"]]), decide: {} });
    expect(await undecided.withholds("member", book)).toBe(true);
    expect(await undecided.withholds(undefined, book), "a classed ask with no peer").toBe(true);
  });

  test("CONTROL 1 — a Kahu hand reads the canon and its synced change lands, through an ordinary lane", async () => {
    const { reached, landed } = await syncedWrite(membership("steward-leaf"), ["steward-leaf"], "steward-leaf", "$:/steward/line");
    expect(reached).toBe("ready");
    expect(landed).toBe(true);
  });

  test("CONTROL 2 — an ordinary CONTRACT book still crosses to the Nexus member", async () => {
    const bookUrl = deterministicDocUrl("ordinary-contract-book");
    const gate = new RealmBagGate(base, membership("member"), realmUrl);
    await gate.refold(await realmWith([{ bagUri: "lar:///ha.ka.ba/bags/ordinary", docUrl: bookUrl, seed: stewardSeed }]), realm);
    const verdict = composed(guardOver(() => new Map([[id(deterministicDocUrl("the-canon")), "kahu-canon"]]), []), gate);
    expect(await verdict.mayFederate(id(bookUrl) as DocumentId, "member" as PeerId)).toBe(true);
  });

  test("CONTROL 3 — a self-signed registration naming an ordinary book under @lares classes nothing", async () => {
    const bookUrl = deterministicDocUrl("ordinary-book-c3");
    const gate = new RealmBagGate(base, membership("member"), realmUrl);
    await gate.refold(await realmWith([{ bagUri: LARES_DOC_URI, docUrl: bookUrl, seed: forgerSeed }]), realm);
    const verdict = composed(guardOver(() => new Map([[id(deterministicDocUrl("the-canon")), "kahu-canon"]]), []), gate);
    expect(await verdict.mayFederate(id(bookUrl) as DocumentId, "member" as PeerId)).toBe(true);
  });
});
