/**
 * carried-set — the SET of Nexuses this vessel carries for, one contract-in each.
 *
 * A vessel founds at most one Nexus, and its charter stands at the PRIMARY path
 * (`<sealHome>/founding-roster.mem`) where the realm plane and the board climb read it. A vessel may
 * also carry for any number of partner Nexuses. Each partner charter lands BESIDE the primary, at
 * `<sealHome>/carried/<aid>/founding-roster.mem`, and this module never writes the primary path.
 *
 * THE AID NAMES THE NEXUS. `realmIdOfCharter(doc)` reads it: the genesis epoch, which a seal rotation leaves
 * fixed. The same AID keys the carried charter's directory, the kept consent, and the per-Nexus leaf.
 *
 * ── WHAT PUTS A NEXUS IN THE SET ────────────────────────────────────────────────────────────────
 *   · A VERIFIED CONSENT AT N's HELD HEAD. The kept contract-in at
 *     `<sealHome>/nexus/carriage-consent/<aid>.json` must verify under its nym, the nym must be a leaf one
 *     of this vessel's held personas presents to N, and its `sealEpochCid` must equal the head of the
 *     charter this vessel holds for N. Consent covers N's admits within that seal epoch; a rotation moves
 *     the head and the consent stops counting until the operator consents again.
 *   · A SEATED CHAIR. A held persona-root seated in N's verified roster carries for N with no consent
 *     record: the chair itself is the act of joining.
 *
 * ── A CARRIED CHARTER MOVES FORWARD ONLY ────────────────────────────────────────────────────────
 * This vessel learns of N's rotation when its operator re-imports N's charter. The re-import lands only
 * when the incoming lineage EXTENDS the held head: walking the incoming chain's `prevEpochCid` links back
 * from its head reaches the held head. A charter for a different Nexus has a different AID and lands in
 * its own directory; a charter that forks, rewinds, or tears is refused and the held bytes stay.
 *
 * The incoming bytes are read by `parseNexusDoc`, the same parser every other reader uses, so this
 * decision and every later read agree on what the file says.
 *
 * Nothing here grants capability. The set reads this vessel's own consents and seats, and nothing else.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-operator-contract
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { foundingRoster, realmIdOfCharter, verifyCarriageConsent, type NexusDoc } from "@lararium/mesh";
import { readNexusDoc, parseNexusDoc, nexusCharterDocRelPath } from "./nexus-doc.js";
import { heldNexusLeaves } from "./nexus-leaf.js";
import { listPersonaRoots, loadPersonaGroupRootVerifyingKey } from "./node-vessel-identity.js";

/** A refusal the CLI renders as a clean message. Nothing was written when one is thrown. */
export class CarriedCharterError extends Error {}

/** An AID addresses a directory, so only a plain token passes — never a separator or a dot-segment. */
const AID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function aidOrRefuse(aid: string): string {
  if (!AID_RE.test(aid) || aid.includes("..")) {
    throw new CarriedCharterError(`"${aid}" cannot name a Nexus here — an AID is a single path-safe token.`);
  }
  return aid;
}

/** The directory a partner charter lands in: `<sealHome>/carried/<aid>`. */
export function carriedCharterHome(sealHome: string, aid: string): string {
  return join(sealHome, "carried", aidOrRefuse(aid));
}

/** The kept consent for one Nexus: `<sealHome>/nexus/carriage-consent/<aid>.json`. */
export function carriageConsentPathFor(sealHome: string, aid: string): string {
  return join(sealHome, "nexus", "carriage-consent", `${aidOrRefuse(aid)}.json`);
}

/** The AID of the charter at the PRIMARY path, or null when none stands there. */
export function primaryNexusAid(sealHome: string): string | null {
  return realmIdOfCharter(readNexusDoc(sealHome));
}

/**
 * The seal home holding N's charter: the primary home when N is the primary charter's Nexus, the carried
 * directory when a partner charter for N stands there, and null when this vessel holds no charter for N.
 * Every reader that addresses N by AID resolves its home here, so a `readNexusDoc` on the answer reads
 * N's charter and nothing else.
 */
export function charterHomeFor(sealHome: string, aid: string): string | null {
  if (primaryNexusAid(sealHome) === aid) return sealHome;
  const home = carriedCharterHome(sealHome, aid);
  return realmIdOfCharter(readNexusDoc(home)) === aid ? home : null;
}

// ── import ────────────────────────────────────────────────────────────────────────────────────────

export interface CarriedImportResult {
  readonly aid:          string;
  /** The verified head the carried charter stands at. */
  readonly sealEpochCid: string;
  /** `landed` — first charter for this AID · `same` — the held head already · `extended` — moved forward. */
  readonly outcome:      "landed" | "same" | "extended";
  readonly path:         string;
}

/**
 * Whether `incoming`'s verified lineage reaches `heldHead` by walking back from its own head. Equal heads
 * extend trivially. A chain that does not name the held head, or names it only off the walk, does not.
 */
function lineageExtends(incoming: NexusDoc, incomingHead: string, heldHead: string): boolean {
  if (incomingHead === heldHead) return true;
  const byCid = new Map((incoming.sealLineage ?? []).map((e) => [e.epochCid, e] as const));
  const seen  = new Set<string>();
  let cursor: string | null = incomingHead;
  while (cursor !== null && !seen.has(cursor)) {
    if (cursor === heldHead) return true;
    seen.add(cursor);
    cursor = byCid.get(cursor)?.prevEpochCid ?? null;
  }
  return false;
}

/**
 * Land a partner charter beside the primary, at `<sealHome>/carried/<aid>/founding-roster.mem`.
 *
 * REFUSES, writing nothing, when the bytes parse to no verified roster head, name no AID, name the
 * primary charter's own Nexus, or — for an AID already held — carry a lineage that does not extend the
 * held head. The write goes through a sibling temp file and a rename, so a reader sees the old charter
 * or the new one and never a torn file.
 */
export function importCarriedCharter(sealHome: string, raw: string): CarriedImportResult {
  const doc  = parseNexusDoc(raw);
  const head = foundingRoster(doc).sealEpochCid;
  if (!doc || head.length === 0) {
    throw new CarriedCharterError(
      "the incoming charter carries no verified epoch head — a torn, unseated, or broken-lineage charter names no terms to consent to.",
    );
  }
  const aid = realmIdOfCharter(doc);
  if (!aid) throw new CarriedCharterError("the incoming charter names no genesis epoch, so it names no Nexus to carry for.");
  aidOrRefuse(aid);
  if (primaryNexusAid(sealHome) === aid) {
    throw new CarriedCharterError(
      `the incoming charter is this vessel's own Nexus (${aid.slice(0, 18)}…) — it already stands at the primary path, and a carried copy would split one Nexus across two files.`,
    );
  }

  const home = carriedCharterHome(sealHome, aid);
  const path = join(home, nexusCharterDocRelPath());
  let outcome: CarriedImportResult["outcome"] = "landed";
  if (existsSync(path)) {
    const heldHead = foundingRoster(readNexusDoc(home)).sealEpochCid;
    if (heldHead.length > 0) {
      if (!lineageExtends(doc, head, heldHead)) {
        throw new CarriedCharterError(
          `the incoming charter for ${aid.slice(0, 18)}… does not extend the held head (${heldHead.slice(0, 18)}…) — ` +
          "a carried charter moves forward along its own lineage only. The held charter stands unchanged.",
        );
      }
      outcome = head === heldHead ? "same" : "extended";
    }
  }

  mkdirSync(home, { recursive: true });
  const tmp = `${path}.incoming`;
  writeFileSync(tmp, raw, "utf8");
  renameSync(tmp, path);
  return { aid, sealEpochCid: head, outcome, path };
}

/** Every carried charter that parses and sits under its own AID, keyed by that AID. */
export function readCarriedCharters(sealHome: string): Map<string, NexusDoc> {
  const out  = new Map<string, NexusDoc>();
  const root = join(sealHome, "carried");
  let names: string[];
  try { names = readdirSync(root); } catch { return out; }
  for (const name of names.sort()) {
    if (!AID_RE.test(name) || name.includes("..")) continue;
    const doc = readNexusDoc(join(root, name));
    if (doc && realmIdOfCharter(doc) === name) out.set(name, doc);
  }
  return out;
}

// ── consent ───────────────────────────────────────────────────────────────────────────────────────

export interface CarriageConsent {
  /** The per-Nexus leaf nym this vessel signed as. */
  readonly nym:          string;
  /** The charter epoch the consent binds to — a consent rooted elsewhere does not carry here. */
  readonly sealEpochCid: string;
  /** The signature handed to the founding kahu, kept so the act is reconstructible from this side. */
  readonly contractSig:  string;
}

/** Keep this vessel's consent to N, replacing any earlier consent to N. */
export function writeConsent(sealHome: string, aid: string, consent: CarriageConsent): void {
  const path = carriageConsentPathFor(sealHome, aid);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(consent, null, 2), "utf8");
}

/** This vessel's kept consent to N, or null when it holds none that reads whole. */
export function readConsent(sealHome: string, aid: string): CarriageConsent | null {
  try {
    const raw = JSON.parse(readFileSync(carriageConsentPathFor(sealHome, aid), "utf8")) as Partial<CarriageConsent>;
    if (typeof raw.nym !== "string" || typeof raw.sealEpochCid !== "string" || typeof raw.contractSig !== "string") return null;
    if (raw.nym.length === 0 || raw.sealEpochCid.length === 0) return null;
    return { nym: raw.nym.toLowerCase(), sealEpochCid: raw.sealEpochCid, contractSig: raw.contractSig };
  } catch { return null; }
}

/**
 * Whether this vessel has CONTRACTED INTO the Nexus named by `aid`.
 *
 * THREE THINGS MUST HOLD, and the file satisfies none of them by sitting there. Disk is not a trust
 * boundary — `LAR_ROOT` names the whole seal home — so a reading that trusted the record's LOCATION
 * would report a Nexus this vessel never joined.
 *
 *   · THE HEAD MATCHES. The consent's epoch equals the verified head of the charter this vessel holds for
 *     N. No charter, an unseated one, or a head that has moved past the consent reads false.
 *   · THE SEAL IS REAL. The signature binds nym and epoch together and only the holder of that nym's
 *     seed can produce it, so a planted record fails.
 *   · THE NYM IS OURS. Another operator's genuine consent proves that SHE joined; copied here it would let
 *     this vessel claim her relation. The nym must be the leaf one of this vessel's held personas presents
 *     to N — a root nym, or another vessel's leaf, reads false.
 *
 * Grants nothing either way: it answers a reading for this vessel's own operator.
 */
export async function hasContractedInto(sealHome: string, aid: string): Promise<boolean> {
  const home = charterHomeFor(sealHome, aid);
  if (!home) return false;
  const consent = readConsent(sealHome, aid);
  if (!consent) return false;

  const head = foundingRoster(readNexusDoc(home)).sealEpochCid;
  if (head.length === 0 || head !== consent.sealEpochCid) return false;
  if (!(await verifyCarriageConsent(consent))) return false;
  return (await heldNexusLeaves(aid)).some((leaf) => leaf.verifyingKey === consent.nym);
}

// ── the set ───────────────────────────────────────────────────────────────────────────────────────

/** One Nexus this vessel holds a charter for, and why it does or does not stand in the carried set. */
export interface CarriedReading {
  readonly aid:          string;
  /** True for the charter at the primary path. */
  readonly primary:      boolean;
  /** The verified head of the held charter ("" when the roster reads inert). */
  readonly sealEpochCid: string;
  /** A kept consent verifies at that head under a held leaf. */
  readonly consented:    boolean;
  /** A held persona-root sits in the verified roster. */
  readonly seated:       boolean;
  readonly carried:      boolean;
}

/** The persona-root verifying keys this vessel holds, lowercased. */
async function heldRootKeys(): Promise<Set<string>> {
  const keys = new Set<string>();
  for (const i of await listPersonaRoots()) {
    const vk = await loadPersonaGroupRootVerifyingKey(i);
    if (vk) keys.add(vk.toLowerCase());
  }
  return keys;
}

/** A reading per held charter, primary first, then carried charters in AID order. */
export async function carriedReadings(sealHome: string): Promise<readonly CarriedReading[]> {
  const charters: Array<{ aid: string; doc: NexusDoc; primary: boolean }> = [];
  const primaryDoc = readNexusDoc(sealHome);
  const primaryAid = realmIdOfCharter(primaryDoc);
  if (primaryDoc && primaryAid) charters.push({ aid: primaryAid, doc: primaryDoc, primary: true });
  for (const [aid, doc] of readCarriedCharters(sealHome)) {
    if (aid !== primaryAid) charters.push({ aid, doc, primary: false });
  }

  const roots = await heldRootKeys();
  const out: CarriedReading[] = [];
  for (const { aid, doc, primary } of charters) {
    const roster    = foundingRoster(doc);
    const seated    = roster.sealEpochCid.length > 0 && roster.keys.some((k) => roots.has(k.toLowerCase()));
    const consented = await hasContractedInto(sealHome, aid);
    out.push({ aid, primary, sealEpochCid: roster.sealEpochCid, consented, seated, carried: consented || seated });
  }
  return out;
}

/** The AIDs this vessel carries for: a verified consent at N's held head, or a seated chair in N. */
export async function carriedSet(sealHome: string): Promise<ReadonlySet<string>> {
  return new Set((await carriedReadings(sealHome)).filter((r) => r.carried).map((r) => r.aid));
}
