/**
 * admit-bundle — the CARRIED admit: a joinee's quorum-signed admit, delivered by hand, kept per Nexus, and
 * presented at the hearth that issued it.
 *
 * ── WHY IT TRAVELS BY HAND ────────────────────────────────────────────────────────────────────────
 * A dialer presents an admit it can read. Under a PRIVATE Nexus no board crosses to a stranger, so a joinee
 * whose admit was just written cannot read it off her own replica. The admit instead travels as the charter
 * and the contract token travel: out of band, as a file. `runNexusContract` emits the BUNDLE, and the joinee's
 * `lares nexus admit-take <file>` verifies and keeps it.
 *
 * ── WHAT A BUNDLE HOLDS — public bytes only ───────────────────────────────────────────────────────
 *   · `admit`      — the quorum-signed admit entry (the board's admit head for the nym, just written);
 *   · `lineage`    — its closed, tight causal lineage (`presentedAdmitFromBoard`), with the roll anchors
 *                    that carry it to the head when its epoch has rolled;
 *   · `aid`        — the Nexus the admit belongs to (the charter's genesis epoch);
 *   · `gatePubKey` — the gate key the bundle NAMES as the hearth that wrote it: the key the joinee's dial
 *                    commits its proof to, exactly as the admit payload's hearth pin carries it
 *                    (`hearth-dial-pin.ts`). Nothing in the bundle proves that hearth holds it; the take
 *                    trusts the operator's hand that carried the file for this one value.
 * Every byte already stands on the Nexus's board or on the wire at that hearth's challenge. No key travels.
 *
 * ── THE TAKE ──────────────────────────────────────────────────────────────────────────────────────
 * `takeAdmitBundle` refuses, writing nothing, unless all of these hold:
 *   · the bundle parses whole (`isPresentedAdmit` over admit + lineage, a path-safe AID, a 64-hex gate key);
 *   · this vessel holds a charter for the AID, and `verifyPresentedAdmit` reads the admit HELD against that
 *     charter's head roster and epoch lineage with an EMPTY deny board and antigen — the admit counts, its
 *     lineage chains, and it roots on the head epoch or on an ancestor its roll anchors carry to the head
 *     (offline: no board is consulted);
 *   · the admit's nym is one of this vessel's OWN leaves for that AID.
 * It then writes the bundle atomically at `<sealHome>/nexus/carriage-admit/<aid>.json`, beside the kept
 * consent. The write touches no sealed carrier.
 *
 * ── THE DIALED NEXUS (F2) ─────────────────────────────────────────────────────────────────────────
 * A dial presents an admit only for the Nexus POSITIVELY tied to the gate key it dials (`dialedNexusAid`).
 * Two records tie a gate key to an AID, and both are the operator's own out-of-band act:
 *   · a KEPT BUNDLE whose `gatePubKey` is the dialed gate key — the hearth that wrote the admit;
 *   · the HEARTH PIN, when it names the dialed gate key and a `charter` island whose scope is the AID.
 * The AID must name a charter this vessel holds. No tie, or ties naming two Nexuses → no Nexus, and the dial
 * presents no admit. The primary charter is never assumed: a vessel whose primary is P that dials Q's hearth
 * presents P's leaf to nobody.
 *
 * Nothing here grants capability. The take reads this vessel's own charters and leaves, and the gate that
 * receives a presentation judges it against its own deny board.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/two-maps
 */

import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  foundingRoster, isPresentedAdmit, verifyPresentedAdmit, makeMultiSigQuorumVerifier, carriageEntryActCid,
  realmIdOfCharter, type CarriageEntry, type KahuQuorumSeats, type PresentedLineageAct, type SealEpoch,
} from "@lararium/mesh";
import { atomicWriteFileSync } from "./fs-atomic.js";
import { readNexusDoc } from "./nexus-doc.js";
import { charterHomeFor } from "./carried-set.js";
import { heldNexusLeaves, type NexusLeaf } from "./nexus-leaf.js";
import { readHearthDialPin } from "./hearth-dial-pin.js";
import { larBootstrapPath } from "./vessel-paths.js";

/** A refusal the CLI renders as a clean message. Nothing was written when one is thrown. */
export class AdmitBundleError extends Error {}

/** One Nexus's admit, carried by hand from the hearth that wrote it. Public bytes only. */
export interface AdmitBundle {
  readonly aid:        string;
  readonly gatePubKey: string;
  readonly admit:      CarriageEntry;
  readonly lineage:    readonly PresentedLineageAct[];
}

/** An AID addresses a file, so only a plain token passes — never a separator or a dot-segment. */
const AID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const KEY_RE = /^[0-9a-f]{64}$/;

/** Shape only: a path-safe AID, a 64-hex gate key, and an admit with a lineage `isPresentedAdmit` accepts. */
export function isAdmitBundle(v: unknown): v is AdmitBundle {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const x = v as Record<string, unknown>;
  return typeof x["aid"] === "string" && AID_RE.test(x["aid"]) && !x["aid"].includes("..") &&
    typeof x["gatePubKey"] === "string" && KEY_RE.test(x["gatePubKey"].toLowerCase()) &&
    isPresentedAdmit({ admit: x["admit"], lineage: x["lineage"] });
}

/** Where the bundle for one Nexus is kept: `<sealHome>/nexus/carriage-admit/<aid>.json`, beside the consent. */
export function admitBundlePathFor(sealHome: string, aid: string): string {
  if (!AID_RE.test(aid) || aid.includes("..")) {
    throw new AdmitBundleError(`"${aid}" cannot name a Nexus here — an AID is a single path-safe token.`);
  }
  return join(sealHome, "nexus", "carriage-admit", `${aid}.json`);
}

/** The kept bundle for one Nexus, or null when none reads whole. Shape only — `admitBundleHolds` judges it. */
export function readKeptAdmitBundle(sealHome: string, aid: string): AdmitBundle | null {
  try {
    const raw = JSON.parse(readFileSync(admitBundlePathFor(sealHome, aid), "utf8")) as unknown;
    return isAdmitBundle(raw) && raw.aid === aid ? normalized(raw) : null;
  } catch { return null; }
}

/** Every kept bundle that reads whole under its own AID. */
export function readKeptAdmitBundles(sealHome: string): readonly AdmitBundle[] {
  let names: string[];
  try { names = readdirSync(join(sealHome, "nexus", "carriage-admit")); } catch { return []; }
  const out: AdmitBundle[] = [];
  for (const name of names.sort()) {
    if (!name.endsWith(".json")) continue;
    const kept = readKeptAdmitBundle(sealHome, name.slice(0, -".json".length));
    if (kept) out.push(kept);
  }
  return out;
}

function normalized(b: AdmitBundle): AdmitBundle {
  return { aid: b.aid, gatePubKey: b.gatePubKey.toLowerCase(), admit: b.admit, lineage: b.lineage };
}

/**
 * Does the bundle's admit hold at `roster` on its own: counted, its lineage closed and tight, rooted on the
 * head epoch or on an ancestor of it in `sealLineage` that its roll anchors carry to the head? Read with an
 * EMPTY deny board and antigen — an offline check of the act itself, never of any standing. Never throws.
 */
export async function admitBundleHolds(
  bundle: AdmitBundle, roster: KahuQuorumSeats, sealLineage: readonly SealEpoch[],
): Promise<boolean> {
  try {
    const verdict = await verifyPresentedAdmit({
      admit: bundle.admit, lineage: bundle.lineage, roster, sealLineage,
      denyBoard: [], antigen: [], antigenRoster: roster, antigenVerifier: makeMultiSigQuorumVerifier(),
    });
    return verdict.state === "held";
  } catch { return false; }
}

export interface AdmitTakeResult {
  readonly aid:        string;
  readonly nym:        string;
  readonly admitCid:   string;
  readonly gatePubKey: string;
  readonly lineage:    number;
  readonly path:       string;
}

/**
 * Verify a bundle offline and keep it for its Nexus, replacing any bundle kept for the same Nexus. REFUSES,
 * writing nothing, on a malformed bundle, an AID with no charter held, an admit that does not hold at that
 * charter's head, or a nym that is not one of this vessel's own leaves for the AID.
 */
export async function takeAdmitBundle(opts: {
  readonly sealHome: string;
  readonly raw:      string;
  /** The leaves this vessel's held personas present to a Nexus. Defaults to the persona vault's. */
  readonly leaves?:  (aid: string) => Promise<readonly NexusLeaf[]>;
}): Promise<AdmitTakeResult> {
  let parsed: unknown;
  try { parsed = JSON.parse(opts.raw); } catch {
    throw new AdmitBundleError("the bundle does not parse as JSON — take the file `lares nexus contract --json` wrote, whole.");
  }
  if (!isAdmitBundle(parsed)) {
    throw new AdmitBundleError("the bundle is malformed — it needs an `aid`, the issuing hearth's 64-hex `gatePubKey`, an admit entry and its lineage.");
  }
  const bundle = normalized(parsed);
  const home = charterHomeFor(opts.sealHome, bundle.aid);
  if (!home || realmIdOfCharter(readNexusDoc(home)) !== bundle.aid) {
    throw new AdmitBundleError(`this vessel holds no charter for ${bundle.aid.slice(0, 18)}… — import it (\`lares nexus seal import\`) before taking its admit.`);
  }
  const doc = readNexusDoc(home);
  const roster = foundingRoster(doc);
  if (roster.sealEpochCid.length === 0 || !(await admitBundleHolds(bundle, roster, doc?.sealLineage ?? []))) {
    throw new AdmitBundleError(
      "the admit does not hold at the charter this vessel holds — it does not count under the seated quorum, its " +
      "lineage does not chain, or it roots on an epoch no roll anchor it carries reaches the head from. Nothing was kept.",
    );
  }
  const nym = bundle.admit.nym.toLowerCase();
  const leaves = await (opts.leaves ?? heldNexusLeaves)(bundle.aid);
  if (!leaves.some((leaf) => leaf.verifyingKey.toLowerCase() === nym)) {
    throw new AdmitBundleError(
      `the admit names ${nym.slice(0, 16)}…, which is not a leaf any persona this vessel holds presents to ${bundle.aid.slice(0, 18)}… — ` +
      "another vessel's admit grants this one nothing. Nothing was kept.",
    );
  }
  const path = admitBundlePathFor(opts.sealHome, bundle.aid);
  try {
    mkdirSync(dirname(path), { recursive: true });
    atomicWriteFileSync(path, JSON.stringify(bundle, null, 2));
  } catch (err) {
    const why = (err as NodeJS.ErrnoException).code ?? (err instanceof Error ? err.message : String(err));
    throw new AdmitBundleError(`the bundle could not be kept (${why}) — nothing landed, and any kept bundle stands unchanged.`);
  }
  return {
    aid: bundle.aid, nym, admitCid: carriageEntryActCid(bundle.admit), gatePubKey: bundle.gatePubKey,
    lineage: bundle.lineage.length, path,
  };
}

/**
 * The Nexus a dial to `gatePubKey` presents for, or null. A kept bundle naming the gate key, or the hearth pin
 * naming the gate key with a `charter` island, ties the gate to an AID; the AID must name a charter this
 * vessel holds. No tie → null; ties to two different Nexuses → null (fail closed).
 */
export function dialedNexusAid(opts: {
  readonly sealHome:       string;
  readonly gatePubKey:     string | null | undefined;
  readonly bootstrapPath?: string;
}): string | null {
  const gate = (opts.gatePubKey ?? "").trim().toLowerCase();
  if (!KEY_RE.test(gate)) return null;
  const tied = new Set<string>();
  for (const kept of readKeptAdmitBundles(opts.sealHome)) {
    if (kept.gatePubKey === gate) tied.add(kept.aid);
  }
  const pin = readHearthDialPin(opts.bootstrapPath ?? larBootstrapPath());
  if (pin && pin.gatePubKey === gate && pin.islandKind === "charter" && pin.islandScope) tied.add(pin.islandScope);
  const held = [...tied].filter((aid) => charterHomeFor(opts.sealHome, aid) !== null);
  return held.length === 1 ? held[0]! : null;
}
