/**
 * nexus-dial-presentation.test.ts — what a dial PRESENTS: the dialed island's admit only, and one face per socket.
 *
 * Proven:
 *   · with TWO carried Nexuses whose boards both hold an admit for this vessel's leaves, the dial presents the
 *     DIALED Nexus's admit — the one the kept bundle ties to the dialed gate key — and never reads the other board;
 *   · CONTROL: a kept bundle for the OTHER carried Nexus, dialed at this hearth, presents nothing;
 *   · `presentationKey` moves when the admit moves, so re-presentation fires on a board change and only then.
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ed from "@noble/ed25519";
import {
  hex, nexusAidOf, signCarriageQuorum, signCarriageContract, admitCarriageCommit,
  carriageEntryActCid, carriageDocUrl, writeCarriageEntry, emptyLarDoc,
  custodyRootDoor, deriveGateBundle, sovereignGateRoot, sovereignRoute, type GateBundlePin,
  type NexusDoc, type CarriageEntry, type LarDoc,
} from "@lararium/mesh";
import { dialPresentation, presentationKey } from "../src/nexus-carriage.js";
import { takeAdmitBundle } from "../src/admit-bundle.js";
import { writeNexusDoc } from "../src/nexus-doc.js";
import { carriedCharterHome } from "../src/carried-set.js";
import type { NexusLeaf } from "../src/nexus-leaf.js";
import { heldCharter } from "../../lararium-mesh/tests/charter-fixture.js";

const pubOf    = (seed: Uint8Array) => ed.getPublicKeyAsync(seed).then(hex);
const signerOf = (seed: Uint8Array) => (bytes: Uint8Array) => ed.signAsync(bytes, seed).then(hex);
const seed = (n: number) => new Uint8Array(32).fill(n);

async function charter(kahuSeeds: Uint8Array[]): Promise<NexusDoc> {
  const keys = await Promise.all(kahuSeeds.map(pubOf));
  return heldCharter({ keys, threshold: 2 }).doc({ labels: keys.map((_, i) => `Kahu ${i}`) });
}

/** An admit commits to the pin of the hearth its bundle names (face-proof#/the-gate-exchange, step 5), under a fixed test salt. */
const openingFor = (gatePin: GateBundlePin) => ({ carriage: { gatePin, canon: {} }, salt: "5a".repeat(32) });
/** The hearth's sovereign sync pin at one Nexus, from a test custody door filled with `tag`. */
const pinAt = (aid: string, tag: number): GateBundlePin => {
  const bundle = deriveGateBundle(sovereignGateRoot(custodyRootDoor({ derive: () => new Uint8Array(32).fill(tag) })), new TextEncoder().encode(aid), sovereignRoute("/ws"));
  try { return bundle.pin; } finally { bundle.drop(); }
};
async function admitOn(doc: NexusDoc, kahuSeeds: Uint8Array[], leafSeed: Uint8Array, parents: string[] = [], pin?: GateBundlePin): Promise<CarriageEntry> {
  const nym = await pubOf(leafSeed);
  const epoch = doc.sealEpochCid!;
  const quorum = await Promise.all(kahuSeeds.slice(0, 2).map(async (s) => ({ signer: await pubOf(s), sign: signerOf(s) })));
  return signCarriageQuorum({ nym, action: "admit", parents, sealEpochCid: epoch, carriageCommit: admitCarriageCommit(openingFor(pin ?? pinAt(nexusAidOf(doc)!, 1))) }, quorum,
    await signCarriageContract(nym, epoch, signerOf(leafSeed)));
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
    const aidP = nexusAidOf(primary)!;
    const aidC = nexusAidOf(carried)!;
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
    const gateP = pinAt(aidP, 1), gateC = pinAt(aidC, 3);
    const admitC = await admitOn(carried, C_KAHU, seed(22), [], gateC);
    // The islands are the charters' genesis epochs: each board keys on its own Nexus.
    const boards = new Map<string, LarDoc>([
      [carriageDocUrl(aidP), boardOf(opts.primaryAdmit ? [admitP] : [])],
      [carriageDocUrl(aidC), boardOf([admitC])],
    ]);
    const asked: string[] = [];
    const open = async (url: string) => { asked.push(url); return boards.get(url); };
    const take = (aid: string, gatePin: GateBundlePin, admit: CarriageEntry) =>
      takeAdmitBundle({ sealHome, raw: JSON.stringify({ aid, gatePubKey: gatePin.signingKey, admit, lineage: [], opening: openingFor(gatePin) }), leaves });
    return { sealHome, aidP, aidC, admitP, admitC, leaves, open, asked, take, gateP: gateP.signingKey, gateC: gateC.signingKey, pinP: gateP, pinC: gateC };
  }

  test("with two carried Nexuses, the presentation names only the dialed one's admit", async () => {
    const w = await stand({ primaryAdmit: true });
    await w.take(w.aidP, w.pinP, w.admitP);
    await w.take(w.aidC, w.pinC, w.admitC);
    const p = await dialPresentation({ sealHome: w.sealHome, ownVesselKey: "ab".repeat(32), gatePubKey: w.gateP, open: w.open, leaves: w.leaves });
    expect(p).not.toBeNull();
    expect(p!.aid).toBe(w.aidP);
    expect(carriageEntryActCid(p!.admit)).toBe(carriageEntryActCid(w.admitP));
    expect(carriageEntryActCid(p!.admit)).not.toBe(carriageEntryActCid(w.admitC));
    expect(w.asked).toEqual([carriageDocUrl(w.aidP)]);                 // the other carried board is never read
  });

  test("CONTROL: a kept bundle for the OTHER carried Nexus, dialed at this hearth, presents nothing", async () => {
    const w = await stand({ primaryAdmit: false });
    await w.take(w.aidC, w.pinC, w.admitC);
    expect(await dialPresentation({ sealHome: w.sealHome, ownVesselKey: "ab".repeat(32), gatePubKey: w.gateP, open: w.open, leaves: w.leaves })).toBeNull();
    expect(w.asked).toEqual([]);
  });

  test("presentationKey moves when the admit moves, and only then", async () => {
    const w = await stand({ primaryAdmit: true });
    await w.take(w.aidP, w.pinP, w.admitP);
    const p = await dialPresentation({ sealHome: w.sealHome, ownVesselKey: "ab".repeat(32), gatePubKey: w.gateP, open: w.open, leaves: w.leaves });
    const again = await dialPresentation({ sealHome: w.sealHome, ownVesselKey: "ab".repeat(32), gatePubKey: w.gateP, open: w.open, leaves: w.leaves });
    expect(presentationKey(p)).toBe(presentationKey(again));
    expect(presentationKey(null)).toBe("");
    expect(presentationKey(p)).not.toBe("");
  });
});

