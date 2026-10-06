/**
 * nexus-dial-presentation.test.ts — what a dial PRESENTS: the dialed island's admit only, and one face per socket.
 *
 * Proven:
 *   · with TWO carried Nexuses whose boards both hold an admit for this vessel's leaves, the dial presents the
 *     DIALED island's admit (the primary charter's, resolved as the admit writer resolves it) and never the other;
 *   · CONTROL: a dialed board holding no admit presents nothing, though another carried board holds one;
 *   · a dial that presents a leaf admit carries no root-signed edge in either slot — and the wire would refuse one;
 *   · CONTROL: with no admit, the self edge presents as before (contract slot for a held root, fleet slot otherwise);
 *   · `presentationKey` moves when the admit moves, so re-presentation fires on a board change and only then.
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ed from "@noble/ed25519";
import {
  NEXUS_DOC_DOMAIN, hex, hexToBytes, genesisSealEpochCid, realmIdOfCharter, signCarriageQuorum, signCarriageContract,
  carriageEntryActCid, carriageDocUrl, writeCarriageEntry, emptyLarDoc, buildAuthResponse,
  type NexusDoc, type CarriageEntry, type LarDoc, type LeafIdentity, type DeviceDelegationTiddler,
} from "@lararium/mesh";
import { dialPresentation, dialIdentityFor, presentationKey } from "../src/nexus-carriage.js";
import { writeNexusDoc } from "../src/nexus-doc.js";
import { carriedCharterHome } from "../src/carried-set.js";
import type { NexusLeaf } from "../src/nexus-leaf.js";

const pubOf    = (seed: Uint8Array) => ed.getPublicKeyAsync(seed).then(hex);
const signerOf = (seed: Uint8Array) => (bytes: Uint8Array) => ed.signAsync(bytes, seed).then(hex);
const seed = (n: number) => new Uint8Array(32).fill(n);

async function charter(kahuSeeds: Uint8Array[]): Promise<NexusDoc> {
  const keys = await Promise.all(kahuSeeds.map(pubOf));
  return {
    kind: NEXUS_DOC_DOMAIN, threshold: 2, sealEpochCid: genesisSealEpochCid(keys, 2),
    kahu: keys.map((k, i) => ({ displayName: `Kahu ${i}`, verifyingKey: k })),
  };
}

async function admitOn(doc: NexusDoc, kahuSeeds: Uint8Array[], leafSeed: Uint8Array, parents: string[] = []): Promise<CarriageEntry> {
  const nym = await pubOf(leafSeed);
  const epoch = doc.sealEpochCid!;
  const quorum = await Promise.all(kahuSeeds.slice(0, 2).map(async (s) => ({ signer: await pubOf(s), sign: signerOf(s) })));
  return signCarriageQuorum({ nym, action: "admit", parents, sealEpochCid: epoch }, quorum, await signCarriageContract(nym, epoch, signerOf(leafSeed)));
}

function boardOf(entries: CarriageEntry[]): LarDoc {
  const doc = emptyLarDoc();
  for (const e of entries) writeCarriageEntry(doc, e);
  return doc;
}

describe("the dial presents the DIALED island's admit only", () => {
  let root: string;
  let prior: string | undefined;
  let priorGate: string | undefined;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lares-dial-presentation-"));
    prior = process.env["LAR_ROOT"]; priorGate = process.env["LAR_JOIN_GATE"];
    process.env["LAR_ROOT"] = root; delete process.env["LAR_JOIN_GATE"];
  });
  afterEach(() => {
    if (prior === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior;
    if (priorGate !== undefined) process.env["LAR_JOIN_GATE"] = priorGate;
    rmSync(root, { recursive: true, force: true });
  });

  const P_KAHU = [seed(1), seed(2), seed(3)];
  const C_KAHU = [seed(4), seed(5), seed(6)];
  const LEAF_AT = new Map<string, Uint8Array>();

  async function stand(opts: { primaryAdmit: boolean }) {
    const sealHome = join(root, "nexus");
    const primary = await charter(P_KAHU);
    const carried = await charter(C_KAHU);
    const aidP = realmIdOfCharter(primary)!;
    const aidC = realmIdOfCharter(carried)!;
    writeNexusDoc(sealHome, primary);
    writeNexusDoc(carriedCharterHome(sealHome, aidC), carried);
    // One leaf per Nexus — a held persona presents a DIFFERENT key to each.
    LEAF_AT.set(aidP, seed(21));
    LEAF_AT.set(aidC, seed(22));
    const leaves = async (aid: string): Promise<readonly NexusLeaf[]> => {
      const s = LEAF_AT.get(aid);
      return s ? [{ handleIndex: 0, verifyingKey: await pubOf(s), seed: s }] : [];
    };
    const admitP = await admitOn(primary, P_KAHU, seed(21));
    const admitC = await admitOn(carried, C_KAHU, seed(22));
    // The islands are the charters' genesis epochs: each board keys on its own Nexus.
    const boards = new Map<string, LarDoc>([
      [carriageDocUrl(aidP), boardOf(opts.primaryAdmit ? [admitP] : [])],
      [carriageDocUrl(aidC), boardOf([admitC])],
    ]);
    const asked: string[] = [];
    const open = async (url: string) => { asked.push(url); return boards.get(url); };
    return { sealHome, aidP, aidC, admitP, admitC, leaves, open, asked };
  }

  test("with two carried Nexuses, the presentation names only the dialed one's admit", async () => {
    const w = await stand({ primaryAdmit: true });
    const p = await dialPresentation({ sealHome: w.sealHome, ownVesselKey: "ab".repeat(32), open: w.open, leaves: w.leaves });
    expect(p).not.toBeNull();
    expect(p!.aid).toBe(w.aidP);
    expect(carriageEntryActCid(p!.admit)).toBe(carriageEntryActCid(w.admitP));
    expect(carriageEntryActCid(p!.admit)).not.toBe(carriageEntryActCid(w.admitC));
    expect(w.asked).toEqual([carriageDocUrl(w.aidP)]);                 // the other carried board is never read
  });

  test("CONTROL: the dialed board holds no admit → nothing presents, though another carried board holds one", async () => {
    const w = await stand({ primaryAdmit: false });
    expect(await dialPresentation({ sealHome: w.sealHome, ownVesselKey: "ab".repeat(32), open: w.open, leaves: w.leaves })).toBeNull();
  });

  test("presentationKey moves when the admit moves, and only then", async () => {
    const w = await stand({ primaryAdmit: true });
    const p = await dialPresentation({ sealHome: w.sealHome, ownVesselKey: "ab".repeat(32), open: w.open, leaves: w.leaves });
    const again = await dialPresentation({ sealHome: w.sealHome, ownVesselKey: "ab".repeat(32), open: w.open, leaves: w.leaves });
    expect(presentationKey(p)).toBe(presentationKey(again));
    expect(presentationKey(null)).toBe("");
    expect(presentationKey(p)).not.toBe("");
  });
});

describe("one face per socket — a dial that presents an admit carries no root-signed edge", () => {
  const base: LeafIdentity = { contactCard: "{}", peerPubKey: "cd".repeat(32), sign: signerOf(seed(30)) };
  const selfEdge = { kind: "self-edge" } as unknown as DeviceDelegationTiddler;

  async function presented() {
    const doc = await charter([seed(1), seed(2), seed(3)]);
    const admit = await admitOn(doc, [seed(1), seed(2), seed(3)], seed(21));
    return {
      admit, lineage: [], aid: realmIdOfCharter(doc)!, island: realmIdOfCharter(doc)!,
      leaf: { handleIndex: 0, verifyingKey: await pubOf(seed(21)), seed: seed(21) },
    };
  }

  test("with an admit: no contractEdge, no fleet edge — whatever self edge the vessel holds", async () => {
    const p = await presented();
    for (const selfSigned of [true, false]) {
      const id = dialIdentityFor(base, p, { edge: selfEdge, selfSigned });
      expect(id.contractEdge).toBeUndefined();
      expect(id.edge).toBeUndefined();
      expect(id.presentedAdmit?.admit).toBe(p.admit);
      expect(typeof id.leafSign).toBe("function");
      // The wire accepts it — and the leaf signer is the admit's own key.
      const msg = await buildAuthResponse({ contactCard: id.contactCard, nonce: "00".repeat(32), gatePubKey: "ee".repeat(32),
        peerPubKey: id.peerPubKey, aud: "lar:///x", ts: "2026-10-06T00:00:00.000Z", sign: id.sign, presentedAdmit: id.presentedAdmit! });
      expect(msg.contractEdge).toBeUndefined();
      const sig = await id.leafSign!(new Uint8Array([1, 2, 3]));
      expect(await ed.verifyAsync(hexToBytes(sig), new Uint8Array([1, 2, 3]), hexToBytes(p.leaf.verifyingKey))).toBe(true);
    }
  });

  test("CONTROL: with no admit, the self edge presents as before", () => {
    expect(dialIdentityFor(base, null, { edge: selfEdge, selfSigned: true }).contractEdge).toBe(selfEdge);
    expect(dialIdentityFor(base, null, { edge: selfEdge, selfSigned: false }).edge).toBe(selfEdge);
    expect(dialIdentityFor(base, null, null)).toBe(base);
  });
});
