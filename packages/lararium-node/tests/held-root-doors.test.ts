/**
 * held-root-doors.test.ts — THE HELD ROOT AT THE NODE'S DOORS.
 *
 * The carriage verifier checks an admit's epoch, its signatures and a root this vessel holds locally, and
 * refuses by name without that root. Each door hands the verifier a held root built from the charter the
 * vessel keeps (`heldNexusRoot`), and each names the one refusal `no-held-root` where it holds none.
 *
 *   N1 THE SEAT: a gated session that presents a quorum-signed admit under its proven face key, for a Nexus whose charter
 *      this vessel does not hold, reads `no-held-root`; the holder's `onRefuse` hears it once and the peer
 *      stays a stranger / with the root held, the same socket stands and `onRefuse` stays silent.
 *   N2 the seat names its other refusals: a face key off the head of the admitted line reads `admit-head-other`, a revoked admit reads
 *      `admit-denied:…` / the same admit unrevoked stands.
 *   N3 THE TAKE: a bundle for a Nexus this vessel keeps no charter for refuses `no-held-root (no-charter)` and
 *      writes nothing / with the charter kept, the same bundle lands.
 *   N4 the offline check reads a bundle against its OWN charter alone: no charter and another Nexus's charter
 *      each read false / its own charter reads true.
 *   N5 a carried reading reads as a held root: its `nexus` equals its `aid`, its roster stands at the charter's
 *      head, and its revision moves when a revoke lands on the deny board / it holds still when nothing moved.
 *   N6 THE WELD: across every package's sources, the held-root module alone NAMES `verifyPresentedAdmit`
 *      beside the file that declares it (a call, an import under another name and a re-export each name it) /
 *      the declaring file and the held-root module both get found, so the scan reads sources.
 *   N7 THE GATE'S ADMIT READER reads the root of its own Nexus alone (`gateHeldRoot`): an admit for another
 *      Nexus reads no held root / at that Nexus's own gate the same admit reads held.
 */
import { describe, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as ed from "@noble/ed25519";
import {
  hex, nexusAidOf, presentedAdmitReader, signCarriageQuorum, signCarriageContract, admitCarriageCommit, signCarrierContract, makeMultiSigQuorumVerifier,
  carriageEntryActCid, carriageDocUrl, writeCarriageEntry, emptyLarDoc, heldNexusRoot,
  custodyRootDoor, deriveGateBundle, sovereignGateRoot, sovereignRoute,
  type NexusDoc, type CarriageEntry, type LarDoc, type GateBundlePin,
} from "@lararium/mesh";
import { takeAdmitBundle, admitBundleHolds, admitBundlePathFor, AdmitBundleError, type AdmitBundle } from "../src/admit-bundle.js";
import {
  leafReadingFor, leafStandingFor, makeNexusMembership, gateHeldRoot, type CarriedNexusReading, type SocketBinding,
} from "../src/nexus-carriage.js";
import { placeCarriedNexuses } from "../src/vessel-raise.js";
import { nodeNexusIsland } from "../src/nexus-standing.js";
import { writeNexusDoc } from "../src/nexus-doc.js";
import type { NexusLeaf } from "../src/nexus-leaf.js";
import { heldCharter } from "../../lararium-mesh/tests/charter-fixture.js";
import { scratchRoot as root, test } from "./support/scratch-fixture.js";

const pubOf    = (s: Uint8Array) => ed.getPublicKeyAsync(s).then(hex);
const signerOf = (s: Uint8Array) => (bytes: Uint8Array) => ed.signAsync(bytes, s).then(hex);
const seed = (n: number) => new Uint8Array(32).fill(n);
const P_KAHU = [seed(1), seed(2), seed(3)];
const Q_KAHU = [seed(4), seed(5), seed(6)];
const LEAF = seed(21), OTHER_KEY = seed(22), PLACE = seed(31);
/** The hearth's sovereign sync pin at one Nexus, from a test custody door. */
const pinAt = (aid: string): GateBundlePin => {
  const bundle = deriveGateBundle(sovereignGateRoot(custodyRootDoor({ derive: () => new Uint8Array(32).fill(14) })), new TextEncoder().encode(aid), sovereignRoute("/ws"));
  try { return bundle.pin; } finally { bundle.drop(); }
};
/** The opening every admit at `aid` commits to: the pin its bundle names, under a fixed test salt. */
const openingAt = (aid: string) => ({ carriage: { gatePin: pinAt(aid), canon: {} }, salt: "5a".repeat(32) });

async function charter(kahu: Uint8Array[]): Promise<NexusDoc> {
  const keys = await Promise.all(kahu.map(pubOf));
  return heldCharter({ keys, threshold: 2 }).doc({ labels: keys.map((_, i) => `Kahu ${i}`) });
}
async function act(doc: NexusDoc, kahu: Uint8Array[], action: "admit" | "revoke", parents: string[] = []): Promise<CarriageEntry> {
  const nym = await pubOf(LEAF), epoch = doc.sealEpochCid!;
  const quorum = await Promise.all(kahu.slice(0, 2).map(async (s) => ({ signer: await pubOf(s), sign: signerOf(s) })));
  const consent = action === "admit" ? await signCarriageContract(nym, epoch, signerOf(LEAF)) : undefined;
  const carriage = action === "admit" ? { carriageCommit: admitCarriageCommit(openingAt(nexusAidOf(doc)!)) } : {};   // the pin its bundle names
  return signCarriageQuorum({ nym, action, parents, sealEpochCid: epoch, ...carriage }, quorum, consent);
}
/** A carried reading over a REAL held root: the charter filed under its own genesis, with a deny board. */
function readingOf(doc: NexusDoc, denyBoard: CarriageEntry[] = []): CarriedNexusReading {
  const aid = nexusAidOf(doc)!;
  const root = heldNexusRoot({ nexus: aid, charter: doc, denyBoard, antigen: [], antigenVerifier: makeMultiSigQuorumVerifier() });
  if ("absent" in root) throw new Error(`fixture: ${root.absent}`);
  return { ...root, sealLineage: root.sealLineage ?? [], aid, via: "consent", island: `island-${aid}`, posture: "private" };
}
/** A gated session's binding: the admit as it rode, under the face key the gate proved (the leaf's, by default). */
async function bind(admit: CarriageEntry, opts: { signer?: Uint8Array } = {}): Promise<SocketBinding> {
  return { presentedAdmit: { admit, lineage: [] }, faceKey: await pubOf(opts.signer ?? LEAF) };
}

describe("the held root at the socket seat", () => {
  test("N1 an admit for a Nexus this vessel holds no root for refuses no-held-root; control: with the root it stands", async () => {
    const P = await charter(P_KAHU), Q = await charter(Q_KAHU);
    const admitQ = await act(Q, Q_KAHU, "admit");             // well-formed, quorum-signed, for a Nexus this vessel lacks
    const binding = await bind(admitQ);
    expect(await leafReadingFor(binding, [readingOf(P)])).toEqual({ refusal: "no-held-root" });
    expect(await leafReadingFor(binding, [])).toEqual({ refusal: "no-held-root" });
    expect(await leafStandingFor(binding, [readingOf(P)])).toBeNull();
    const heard: Array<[string, string]> = [];
    const lacking = makeNexusMembership({ readCarried: async () => [readingOf(P)], onRefuse: (peer, refusal) => { heard.push([peer, refusal]); } });
    await lacking.refold();
    await lacking.present("peer-q", binding);
    expect(heard).toEqual([["peer-q", "no-held-root"]]);
    expect(lacking.membership.holdsCarriagePeer("peer-q")).toBe(false);
    await lacking.refold();                                    // a refold re-verifies quietly
    expect(heard).toHaveLength(1);
    // A callback that throws never decides the fold: a peer that stood, then presents a refused admit, falls.
    const admitP = await act(P, P_KAHU, "admit");
    const throwing = makeNexusMembership({ readCarried: async () => [readingOf(P)], onRefuse: () => { throw new Error("a log that fails"); } });
    await throwing.refold();
    await throwing.present("peer-p", await bind(admitP));
    expect(throwing.membership.holdsCarriagePeer("peer-p")).toBe(true);
    await throwing.present("peer-p", binding);
    expect(throwing.membership.holdsCarriagePeer("peer-p")).toBe(false);
    // CONTROL: the vessel holds Q's root too, and the same socket stands with nothing refused.
    const quiet: string[] = [];
    const holding = makeNexusMembership({ readCarried: async () => [readingOf(P), readingOf(Q)], onRefuse: (_p, refusal) => { quiet.push(refusal); } });
    await holding.refold();
    await holding.present("peer-q", binding);
    expect(holding.membership.holdsCarriagePeer("peer-q")).toBe(true);
    expect(quiet).toEqual([]);
    expect(await leafReadingFor(binding, [readingOf(P), readingOf(Q)])).toEqual({ standing: { nym: await pubOf(LEAF), aid: nexusAidOf(Q) } });
  });

  test("N2 the seat names its other refusals; control: the same admit unrevoked stands", async () => {
    const P = await charter(P_KAHU);
    const admit = await act(P, P_KAHU, "admit");
    expect(await leafReadingFor(await bind(admit, { signer: OTHER_KEY }), [readingOf(P)])).toEqual({ refusal: "admit-head-other" });
    const revoke = await act(P, P_KAHU, "revoke", [carriageEntryActCid(admit)]);
    const denied = await leafReadingFor(await bind(admit), [readingOf(P, [revoke])]);
    expect(denied).toMatchObject({ refusal: expect.stringMatching(/^admit-denied:/) });
    expect(await leafReadingFor(await bind(admit), [readingOf(P)])).toMatchObject({ standing: { nym: await pubOf(LEAF) } });
    // A presented admit of no readable shape reads by name too, and never throws.
    const torn = { presentedAdmit: { admit: null, lineage: [] }, faceKey: await pubOf(LEAF) } as unknown as SocketBinding;
    expect(await leafReadingFor({ presentedAdmit: { admit, lineage: [] }, faceKey: undefined } as unknown as SocketBinding, [readingOf(P)])).toEqual({ refusal: "admit-head-other" });
    expect(await leafReadingFor(torn, [readingOf(P)])).toMatchObject({ refusal: expect.any(String) });
  });
});

describe("the held root at the take, on a real seal home", () => {
  const leaves = async (): Promise<readonly NexusLeaf[]> => [{ handleIndex: 0, verifyingKey: await pubOf(LEAF), seed: LEAF }];

  test("N3 a bundle for a Nexus this vessel keeps no charter for refuses no-held-root and writes nothing; control: with the charter it lands", async () => {
    const sealHome = join(root, "nexus");
    const P = await charter(P_KAHU), Q = await charter(Q_KAHU);
    writeNexusDoc(sealHome, P);
    const aidQ = nexusAidOf(Q)!;
    const bundle: AdmitBundle = { aid: aidQ, gatePubKey: pinAt(aidQ).signingKey, opening: openingAt(aidQ), admit: await act(Q, Q_KAHU, "admit"), lineage: [] };
    const take = () => takeAdmitBundle({ sealHome, raw: JSON.stringify(bundle), leaves });
    await expect(take()).rejects.toThrow(AdmitBundleError);
    await expect(take()).rejects.toThrow(/^no-held-root \(no-charter\)/);
    expect(existsSync(admitBundlePathFor(sealHome, aidQ))).toBe(false);
    // CONTROL: the vessel keeps Q's charter at its primary path, and the same bundle lands.
    const home2 = join(root, "nexus-q");
    writeNexusDoc(home2, Q);
    const kept = await takeAdmitBundle({ sealHome: home2, raw: JSON.stringify(bundle), leaves });
    expect(kept.aid).toBe(aidQ);
    expect(existsSync(admitBundlePathFor(home2, aidQ))).toBe(true);
  });

  test("N4 the offline check reads a bundle against its own charter alone", async () => {
    const P = await charter(P_KAHU), Q = await charter(Q_KAHU);
    const bundle: AdmitBundle = { aid: nexusAidOf(Q)!, gatePubKey: pinAt(nexusAidOf(Q)!).signingKey, opening: openingAt(nexusAidOf(Q)!), admit: await act(Q, Q_KAHU, "admit"), lineage: [] };
    expect(await admitBundleHolds(bundle, null)).toBe(false);
    expect(await admitBundleHolds(bundle, undefined)).toBe(false);
    expect(await admitBundleHolds(bundle, P)).toBe(false);                      // another Nexus's charter
    expect(await admitBundleHolds({ ...bundle, aid: nexusAidOf(P)! }, P)).toBe(false);   // P's name, Q's quorum
    expect(await admitBundleHolds(bundle, Q)).toBe(true);                       // CONTROL
    // A bundle filed under ANOTHER name than the charter's own never holds, though P's quorum signed its admit.
    const ownP: AdmitBundle = { aid: nexusAidOf(P)!, gatePubKey: pinAt(nexusAidOf(P)!).signingKey, opening: openingAt(nexusAidOf(P)!), admit: await act(P, P_KAHU, "admit"), lineage: [] };
    expect(await admitBundleHolds(ownP, P)).toBe(true);                         // CONTROL
    expect(await admitBundleHolds({ ...ownP, aid: "a-borrowed-name" }, P)).toBe(false);
  });

  test("N5 a carried reading reads as a held root, and its revision moves with the deny board", async () => {
    const sealHome = join(root, "nexus");
    const P = await charter(P_KAHU);
    writeNexusDoc(sealHome, P);
    const place = await pubOf(PLACE);
    const epoch = P.sealEpochCid!;
    const quorum = await Promise.all(P_KAHU.slice(0, 2).map(async (s) => ({ signer: await pubOf(s), sign: signerOf(s) })));
    const carry = await signCarriageQuorum({ nym: place, action: "carry", parents: [], sealEpochCid: epoch }, quorum, await signCarrierContract(place, epoch, signerOf(PLACE)));
    const board: LarDoc = emptyLarDoc();
    writeCarriageEntry(board, carry);
    const island = nodeNexusIsland({ ownVesselKey: place, sealHome });
    const open = async (url: string) => (url === carriageDocUrl(island) ? board : undefined);
    const [first] = await placeCarriedNexuses({ sealHome, ownVesselKey: place, open });
    expect(first).toBeDefined();
    expect(first!.nexus).toBe(first!.aid);
    expect(first!.nexus).toBe(nexusAidOf(P));
    expect(first!.roster.sealEpochCid).toBe(epoch);
    const [again] = await placeCarriedNexuses({ sealHome, ownVesselKey: place, open });
    expect(again!.revision).toBe(first!.revision);                              // CONTROL: nothing moved
    const admit = await act(P, P_KAHU, "admit");
    writeCarriageEntry(board, await act(P, P_KAHU, "revoke", [carriageEntryActCid(admit)]));
    const [moved] = await placeCarriedNexuses({ sealHome, ownVesselKey: place, open });
    expect(moved!.revision).not.toBe(first!.revision);
  });
});

// ── N6 THE WELD ─────────────────────────────────────────────────────────────────────────────────────────────
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "dist" || entry.name === "node_modules") continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".ts")) out.push(path);
  }
  return out;
}
function withoutComments(text: string): string {
  return text.split("\n").filter((line) => {
    const trimmed = line.trim();
    return !trimmed.startsWith("*") && !trimmed.startsWith("//") && !trimmed.startsWith("/*");
  }).join("\n");
}

describe("the gate's admit reader", () => {
  test("N7 a gate reads the root of its own Nexus alone; control: at that Nexus's own gate the same admit reads held", async () => {
    const P = await charter(P_KAHU), Q = await charter(Q_KAHU);
    // The admit rides here without a carriage commitment: the gate's reader judges its quorum, epoch and line alone.
    const nym = await pubOf(LEAF), epoch = Q.sealEpochCid!;
    const quorum = await Promise.all(Q_KAHU.slice(0, 2).map(async (s) => ({ signer: await pubOf(s), sign: signerOf(s) })));
    const admitQ = await signCarriageQuorum({ nym, action: "admit", parents: [], sealEpochCid: epoch }, quorum, await signCarriageContract(nym, epoch, signerOf(LEAF)));
    const readings = async () => [readingOf(P), readingOf(Q)];
    expect(await gateHeldRoot(readings, "an-uncarried-nexus")()).toBeNull();
    const atP = await presentedAdmitReader(gateHeldRoot(readings, nexusAidOf(P)!)).read({ admit: admitQ, lineage: [] });
    expect("verdict" in atP && atP.verdict.state).not.toBe("held");
    const atQ = await presentedAdmitReader(gateHeldRoot(readings, nexusAidOf(Q)!.toUpperCase())).read({ admit: admitQ, lineage: [] });
    expect(atQ).toMatchObject({ verdict: { state: "held" }, nexus: nexusAidOf(Q), head: await pubOf(LEAF) });
  });
});

describe("the weld", () => {
  test("N6 the held-root module alone names the verifier, beside the file that declares it", () => {
    const callers = readdirSync(resolve(repoRoot, "packages"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((entry) => {
        const src = resolve(repoRoot, "packages", entry.name, "src");
        try { return sourceFiles(src); } catch { return []; }
      })
      .filter((path) => /\bverifyPresentedAdmit\b/.test(withoutComments(readFileSync(path, "utf8"))))
      .map((path) => path.slice(repoRoot.length + 1).replaceAll("\\", "/"))
      .sort();
    // CONTROL inside the reading: the declaring file and the one caller both get found, so the scan reads sources.
    expect(callers, `verifyPresentedAdmit call sites: ${callers.join(", ") || "none"}`).toEqual([
      "packages/lararium-mesh/src/carriage-registry.ts",
      "packages/lararium-mesh/src/held-nexus-root.ts",
    ]);
  });
});
