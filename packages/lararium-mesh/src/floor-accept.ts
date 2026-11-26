/**
 * floor-accept — a PLACE's accept of a Nexus's floor: one accept per (place, Nexus), moved only by a hand's act at that place.
 *
 * The floor belongs to the place (operator rulings 2026-11-11 "the vessel pins the floor", 2026-11-26 "the place signs the
 * herm/hearth wiki"): a release gets CUT and published (`floor-release`); a hand at the place ACCEPTS it, and the accept moves
 * the place's floor. Faces accept nothing, and no face needs to stand for an accept to land: the accepts rest in the place's
 * FLOOR ACCEPT HOME (`floor-accept-home`), one floor-filed document sealed under the floor's rest key (the key a place holds
 * with no face), under `<floor-accept bag>/accept/<Nexus AID>`. A face switch, a founding or a sibling's light moves no accept.
 *
 * THE ACCEPT STARTS AT GENESIS. A place that holds no accept for a Nexus stands on the floor its genesis baked
 * (`GENESIS_FLOOR_TIDDLER`): the accept DERIVES (`release: null`, the genesis manifest) and nothing writes at boot.
 *
 * ORDER RIDES THE LINK, NEVER A COUNTER. A release descends from the accept where its `prior` chain, walked through the
 * releases that COUNT (`foldFloorReleases`), reaches the accepted release, or reaches the chain's opening where the accept
 * stands at genesis. `took` names the heads the board showed when the hand accepted: a causal witness ("as of its last
 * sync"), never a time. No clock, epoch integer or arrival order decides anything here.
 *
 * ONE DECISION, BOTH HOSTS. `floorStatusOf`, `decideFloorAccept`, `floorRemountDecision` and `floorToMount` hold the whole
 * logic; `readFloorStatus` and `acceptFloorRelease` compose them over capability-named ports, which the node vessel and the
 * browser vessel each bind to their own substrate.
 *
 * EACH RECIPE MOUNTS ITS OWN REALM'S NEXUS (`floor-nexus`): the pool asks the floor per wiki, the host resolves slug -> realm
 * -> Nexus (the home charter where a realm names none), and `floorToMount` reads that Nexus's accept, never a sole pick
 * across Nexuses. A realm carrying two Nexus pins mounts genesis under `floor-realm-conflicted`.
 *
 * CARRIED, NEVER ACCEPTED. A place whose floor key does not stand (a herm: `floor-unkeyed`; a locked hearth: `vessel-locked`)
 * reads no accept. It shows the sole counted head its board carries, where those bytes rest whole in its own CAS, stamped
 * `carried-unaccepted`, and that showing carries the release's canon SNAPSHOTS over the genesis plugins and engine
 * (`carriedFloorOf`): no plugin code runs that no hand accepted (operator ruling, kaula Q1). The stamp moves with sync; an
 * accept never does.
 *
 * THE ACCEPT. It fast-forwards along `prior` to the named release, or to the sole head where none is named; refuses a
 * release that does not descend (`floor-not-descendant`), refuses while two heads stand (`floor-fork-unsettled`), and stages
 * the floor whole in the local CAS BEFORE the accept moves. A replayed accept lands nothing. Nothing accepts by itself.
 *
 * THE REMOUNT, BY CAPABILITY. An island that can swap its `@oracle` read-face live (`floorSwap`) swaps; one that mounts its
 * floor once at boot raises the reboot-pending alert, naming why.
 *
 * Meme: lar:///ha.ka.ba/lararium/api/residency-tiers#/floor-accept
 */
import { tiddlerText, type LarDoc } from "./base-doc.js";
import { FLOOR_ACCEPT_BAG } from "./lar-uris.js";
import type { FloorKeyRefusal } from "./floor-registry.js";
import { storedLarRecord } from "./stored-record.js";
import { ownEntry, plainRecordOrNull } from "./stored-value.js";
import { GENESIS_FLOOR_TIDDLER, floorBlobCids, floorManifestBytes, readFloorManifest, type FloorManifest } from "./floor-manifest.js";
import { floorOfferingBlobsOf, resolveFloorOffering, resolveFloorWhole } from "./floor-offering.js";
import { sha256HexBytesSync } from "./crypto.js";
import { foldFloorReleases, type FloorRelease, type FloorReleaseRefused, type FloorReleaseStanding } from "./floor-release.js";

/** The accept record's shape name: a reader tells an accept by `kind`, never by a counter. */
import { FLOOR_ACCEPT_KIND } from "./wire-names.js";
export { FLOOR_ACCEPT_KIND };
/** Where the accepts rest in the place's accept home: one row per Nexus, keyed by its AID. */
export const FLOOR_ACCEPT_PREFIX = `${FLOOR_ACCEPT_BAG}/accept/` as const;

const HEX64 = /^[0-9a-f]{64}$/;
const ACCEPT_KEYS = ["kind", "nexus", "release", "manifest", "took"] as const;

/** The accept before an adoption, kept one adoption back: its release, the manifest it mounted, and its own base and receipt
 *  where it stood local (null where it stood plain). Its own prior drops: the house keeps one floor back, never a chain. */
export interface PriorFloorAccept {
  readonly release:  string | null;
  readonly manifest: string;
  readonly base:     string | null;
  readonly receipt:  string | null;
}

/**
 * THE LOCAL FLOOR (3d, follow-lei S2): an accept adopted past its base. `base` names the manifest of the release (or genesis
 * floor) the descent walks from, and the place-claim and the cut read; `receipt` the seed whose plugins it adopted (a CID,
 * never a clock); `prior` the accept before it, kept alive so a red revert lands it back; `state` reads `staged` until the
 * boot it stood on reads par.
 */
export interface LocalFloor {
  readonly base:    string;
  readonly receipt: string;
  readonly prior:   PriorFloorAccept | null;
  readonly state:   "staged" | "committed";
}

/** One place's accept at one Nexus: the release it accepted (null at genesis), the floor manifest it mounts, the board heads it
 *  read when the hand accepted (`took`, sorted; empty at genesis), and its local form where it adopted past that release's
 *  floor (`manifest` then names the local manifest, `local.base` the release's). */
export interface FloorAccept {
  readonly kind:     typeof FLOOR_ACCEPT_KIND;
  readonly nexus:    string;
  readonly release:  string | null;
  readonly manifest: string;
  readonly took:     readonly string[];
  readonly local?:   LocalFloor;
}

/** The manifest an accept's descent, cut and place-claim stand on: the local floor's base, else the accept's own manifest. */
export function floorAcceptBase(accept: FloorAccept): string {
  return accept.local?.base ?? accept.manifest;
}

/** Where an accept read came from: a row a hand's accept wrote, or genesis (no row, or a torn one, which the status names). */
export type FloorAcceptSource = "accepted" | "genesis" | "torn";

/** The accept row's title for a Nexus. */
export function floorAcceptTitle(nexus: string): string {
  return `${FLOOR_ACCEPT_PREFIX}${nexus}`;
}

/** The genesis accept: the floor this place's genesis baked, no release accepted yet. THROWS on a manifest outside sha-256 hex. */
export function genesisFloorAccept(nexus: string, genesisManifest: string): FloorAccept {
  if (!HEX64.test(genesisManifest)) throw new Error("floor-accept refused: genesis-floor-unreadable");
  return Object.freeze({ kind: FLOOR_ACCEPT_KIND, nexus, release: null, manifest: genesisManifest, took: Object.freeze([]) });
}

/** The genesis floor's manifest CID, as the island document's seed witness names it; null where the seed names none. */
export function genesisFloorCidOf(islandDoc: LarDoc | null | undefined): string | null {
  const cid = plainRecordOrNull(ownEntry(islandDoc?.tiddlers, GENESIS_FLOOR_TIDDLER))?.tiddler["cid"];
  return typeof cid === "string" && HEX64.test(cid) ? cid : null;
}

/** The heads an accept took, in their one canonical order (sorted, each once). */
export function tookOf(heads: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(heads)].sort());
}

/** Coerce a value into an accept at its exact shape for `nexus`, or null. */
export function readFloorAccept(value: unknown, nexus: string): FloorAccept | null {
  if (!isPlain(value)) return null;
  const v = value;
  const keys = Object.hasOwn(v, "local") ? [...ACCEPT_KEYS, "local"] : ACCEPT_KEYS;
  if (!exactKeys(v, keys)) return null;
  if (v["kind"] !== FLOOR_ACCEPT_KIND || v["nexus"] !== nexus) return null;
  if (!hexOrNull(v["release"]) || !hex64(v["manifest"])) return null;
  const took = v["took"];
  if (!Array.isArray(took) || !took.every(hex64)) return null;
  const canonical = tookOf(took as string[]);
  if (canonical.length !== took.length || canonical.some((h, i) => h !== took[i])) return null;
  const accept = { kind: FLOOR_ACCEPT_KIND, nexus, release: v["release"] as string | null, manifest: v["manifest"] as string, took: canonical };
  if (!Object.hasOwn(v, "local")) return Object.freeze(accept);
  const local = readLocalFloor(v["local"]);
  // A local floor keeps its prior on the same release: an adopt never moves the release, so a prior naming another reads torn.
  if (!local || (local.prior !== null && local.prior.release !== accept.release) || local.base === accept.manifest) return null;
  return Object.freeze({ ...accept, local });
}

const isPlain = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const exactKeys = (v: Record<string, unknown>, keys: readonly string[]): boolean => Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k));
const hex64 = (v: unknown): v is string => typeof v === "string" && HEX64.test(v);
const hexOrNull = (v: unknown): boolean => v === null || hex64(v);
const LOCAL_KEYS = ["base", "receipt", "prior", "state"] as const;
const PRIOR_KEYS = ["release", "manifest", "base", "receipt"] as const;

/** A local floor at its exact shape, or null (the rehome door's old-row reader shares it). */
export function readLocalFloor(value: unknown): LocalFloor | null {
  if (!isPlain(value) || !exactKeys(value, LOCAL_KEYS)) return null;
  if (!hex64(value["base"]) || !hex64(value["receipt"])) return null;
  if (value["state"] !== "staged" && value["state"] !== "committed") return null;
  let prior: PriorFloorAccept | null = null;
  if (value["prior"] !== null) {
    const p = value["prior"];
    if (!isPlain(p) || !exactKeys(p, PRIOR_KEYS) || !hexOrNull(p["release"]) || !hex64(p["manifest"]) || !hexOrNull(p["base"]) || !hexOrNull(p["receipt"])) return null;
    if ((p["base"] === null) !== (p["receipt"] === null)) return null;
    prior = Object.freeze({ release: p["release"] as string | null, manifest: p["manifest"], base: p["base"] as string | null, receipt: p["receipt"] as string | null });
  }
  return Object.freeze({ base: value["base"], receipt: value["receipt"], prior, state: value["state"] });
}

/** The accept's canonical text: fixed key order, so the same accept always writes the same bytes. */
function acceptText(accept: FloorAccept): string {
  const plain = { kind: accept.kind, nexus: accept.nexus, release: accept.release, manifest: accept.manifest, took: tookOf(accept.took) };
  if (!accept.local) return JSON.stringify(plain);
  const l = accept.local;
  const prior = l.prior === null ? null : { release: l.prior.release, manifest: l.prior.manifest, base: l.prior.base, receipt: l.prior.receipt };
  return JSON.stringify({ ...plain, local: { base: l.base, receipt: l.receipt, prior, state: l.state } });
}

/** The row at `nexus` off the accept home: the accept, none, or a torn row (which names itself). */
function acceptRowOf(acceptsDoc: LarDoc | null | undefined, nexus: string): { readonly accept: FloorAccept } | "none" | "torn" {
  const text = tiddlerText(ownEntry(acceptsDoc?.tiddlers, floorAcceptTitle(nexus)));
  if (text === null) return "none";
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { parsed = null; }
  const accept = readFloorAccept(parsed, nexus);
  return accept ? { accept } : "torn";
}

/** The place's accept at `nexus` off its accept home, or the genesis accept where it holds none (a torn row names itself). */
export function floorAcceptOf(acceptsDoc: LarDoc | null | undefined, nexus: string, genesisManifest: string):
  { readonly accept: FloorAccept; readonly source: FloorAcceptSource } {
  const row = acceptRowOf(acceptsDoc, nexus);
  if (row === "none") return { accept: genesisFloorAccept(nexus, genesisManifest), source: "genesis" };
  if (row === "torn") return { accept: genesisFloorAccept(nexus, genesisManifest), source: "torn" };
  return { accept: row.accept, source: "accepted" };
}

/** Every accept the accept home holds, one per Nexus; a torn row drops. */
export function floorAcceptsOf(acceptsDoc: LarDoc | null | undefined): FloorAccept[] {
  const out: FloorAccept[] = [];
  for (const [title, row] of Object.entries(acceptsDoc?.tiddlers ?? {})) {
    if (!title.startsWith(FLOOR_ACCEPT_PREFIX)) continue;
    const text = tiddlerText(row);
    if (text === null) continue;
    try { const accept = readFloorAccept(JSON.parse(text), title.slice(FLOOR_ACCEPT_PREFIX.length)); if (accept) out.push(accept); } catch { continue; }
  }
  return out;
}

/** Land an accept on an accept-home draft. Call INSIDE a `handle.change()` callback; the same accept writes nothing. */
export function writeFloorAccept(draft: LarDoc, accept: FloorAccept): boolean {
  const title = floorAcceptTitle(accept.nexus);
  const text = acceptText(accept);
  if (tiddlerText(ownEntry(draft.tiddlers, title)) === text) return false;
  draft.tiddlers[title] = storedLarRecord(title, { text }, FLOOR_ACCEPT_KIND);
  return true;
}

// ── descent ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * The releases from the accept (exclusive) to `target` (inclusive), oldest first, walked along `prior` through the counted
 * releases; null where the walk never meets the accept. An accept at genesis meets every counted chain at its opening.
 */
export function floorPathFromAccept(accept: FloorAccept, target: string, counted: ReadonlyMap<string, FloorRelease>): string[] | null {
  const path: string[] = [];
  const seen = new Set<string>();
  let at: string | null = target;
  while (at !== null) {
    if (at === accept.release) return path.reverse();
    if (seen.has(at)) return null;
    seen.add(at);
    const r = counted.get(at);
    if (r === undefined) return null;
    path.push(at);
    at = r.body.prior;
  }
  return accept.release === null ? path.reverse() : null;
}

const countedMap = (standing: FloorReleaseStanding): Map<string, FloorRelease> => new Map(standing.counted.map((r) => [r.cid, r]));
const headsOf = (standing: FloorReleaseStanding): readonly string[] =>
  standing.standing === "released" ? [standing.head.cid] : standing.standing === "unsettled" ? standing.heads : [];

// ── status ──────────────────────────────────────────────────────────────────────────────────────────

/** Where a place's accept stands against what its board shows. */
export interface FloorStatus {
  readonly nexus:        string;
  readonly accepted:     FloorAccept;
  readonly acceptSource: FloorAcceptSource;
  /** The board's chain: no counted release, one head, or a fork. */
  readonly board:        FloorReleaseStanding["standing"];
  /** The sole head the board shows (the newest release seen), or null where none or two stand. */
  readonly newest:       string | null;
  /** Every head the board shows: one when released, two or more when forked. */
  readonly heads:        readonly string[];
  /** Whether the sole head descends from the accept; null where no sole head stands. */
  readonly descends:     boolean | null;
  /** Whether an accept would move forward: the sole head descends and differs from the accept. */
  readonly fastForward:  boolean;
  /** The releases an accept of the sole head walks, oldest first; empty where none. */
  readonly path:         readonly string[];
  /** The heads of a standing fork, or null. Named, never resolved. */
  readonly fork:         readonly string[] | null;
  readonly refused:      readonly FloorReleaseRefused[];
}

/** Read an accept against the board's standing. Pure. */
export function floorStatusOf(read: { readonly accept: FloorAccept; readonly source: FloorAcceptSource }, standing: FloorReleaseStanding): FloorStatus {
  const heads = headsOf(standing);
  const newest = standing.standing === "released" ? standing.head.cid : null;
  const path = newest === null ? null : floorPathFromAccept(read.accept, newest, countedMap(standing));
  return Object.freeze({
    nexus: read.accept.nexus, accepted: read.accept, acceptSource: read.source,
    board: standing.standing, newest, heads,
    descends: newest === null ? null : path !== null,
    fastForward: path !== null && path.length > 0,
    path: path ?? [],
    fork: standing.standing === "unsettled" ? standing.heads : null,
    refused: standing.refused,
  });
}

// ── the accept decision ─────────────────────────────────────────────────────────────────────────────

export const FLOOR_ACCEPT_REFUSALS = [
  "floor-fork-unsettled",   // two heads stand on the board: the cabal settles the fork before any place accepts
  "floor-no-release",       // no release counts on the board, and none was named
  "floor-release-unknown",  // the named release counts nowhere on the board (absent, or refused by the fold)
  "floor-not-descendant",   // the named release does not descend from the accept (another branch, or a rollback)
  "floor-bytes-absent",     // the release's floor does not stand whole in reach (manifest, snapshots, plugins offering and its blobs, each re-hashed)
  "floor-offering-refused", // the release's plugins offering reads but does not verify (shape, provenance, signature or fold)
  "floor-offering-incomplete", // the release's plugins offering drops a blob every mount needs (the parser, the base seed)
] as const;
export type FloorAcceptRefusal = (typeof FLOOR_ACCEPT_REFUSALS)[number];

export type FloorAcceptDecision =
  | { readonly ok: true; readonly moved: boolean; readonly prior: FloorAccept; readonly accept: FloorAccept; readonly path: readonly string[]; readonly release: FloorRelease | null }
  | { readonly ok: false; readonly refusal: FloorAcceptRefusal; readonly detail: string; readonly heads?: readonly string[] };

/**
 * Decide an accept: which accept the place moves to, and the releases it walks. Pure. `target` names the release; absent,
 * the sole head. A target the accept already names decides `moved: false`, and the caller lands nothing. The new accept
 * takes the heads the board shows now (`took`).
 */
export function decideFloorAccept(args: { readonly accept: FloorAccept; readonly standing: FloorReleaseStanding; readonly target?: string }): FloorAcceptDecision {
  const { accept, standing } = args;
  if (standing.standing === "unsettled") {
    return { ok: false, refusal: "floor-fork-unsettled", heads: standing.heads, detail: `two heads stand on the board (${standing.heads.join(", ")}); the cabal settles the fork before a place accepts either` };
  }
  const target = args.target ?? (standing.standing === "released" ? standing.head.cid : undefined);
  if (target === undefined) return { ok: false, refusal: "floor-no-release", detail: "no release counts on this Nexus's board" };
  const counted = countedMap(standing);
  const took = tookOf(headsOf(standing));
  if (target === accept.release) {
    // THE LET-GO (3d): a local floor over the release it already stands on accepts back onto that release's own floor, a move.
    const held = counted.get(target) ?? null;
    // A bare accept (no release named) never lets a local floor go: the hand names the release to leave the adoption behind.
    if (!accept.local || held === null || args.target === undefined) return { ok: true, moved: false, prior: accept, accept, path: [], release: held };
    return { ok: true, moved: true, prior: accept, accept: Object.freeze({ kind: FLOOR_ACCEPT_KIND, nexus: accept.nexus, release: target, manifest: held.body.manifest, took }), path: [], release: held };
  }
  const release = counted.get(target);
  if (release === undefined) {
    const refusedRow = standing.refused.find((r) => r.keyCid === target);
    return { ok: false, refusal: "floor-release-unknown", detail: refusedRow ? `the board refused ${target}: ${refusedRow.reason}${refusedRow.detail ? ` (${refusedRow.detail})` : ""}` : `no counted release ${target} stands on the board` };
  }
  const path = floorPathFromAccept(accept, target, counted);
  if (path === null) {
    return { ok: false, refusal: "floor-not-descendant", detail: `${target} does not descend from the accepted ${accept.release ?? "genesis floor"} along prior` };
  }
  const next: FloorAccept = Object.freeze({ kind: FLOOR_ACCEPT_KIND, nexus: accept.nexus, release: target, manifest: release.body.manifest, took });
  return { ok: true, moved: true, prior: accept, accept: next, path, release };
}

// ── the local floor: adopt, commit, revert (3d, follow-lei S2) ─────────────────────────────────────

export const FLOOR_ADOPT_REFUSALS = [
  "adopt-engine-held",   // the seed's floor names another engine: the engine stays behind its own cadence threshold, never adopted here
  "adopt-uncommitted",   // a staged adoption stands uncommitted: no second adoption stacks on it (commit at par, or revert)
  "adopt-none-local",    // commit or revert asked of an accept that stands on no local floor
  "adopt-no-prior",      // a revert asked of a local floor that kept no prior accept
] as const;
export type FloorAdoptRefusal = (typeof FLOOR_ADOPT_REFUSALS)[number];

/** The ratchets a local manifest moves past its base: the floor's plugins offering carries grammar, lararium and plugins alike. */
export type FloorAdoptMove = "plugins";

export type FloorAdoptDecision =
  | { readonly ok: true; readonly moved: false; readonly accept: FloorAccept; readonly why: string }
  | { readonly ok: true; readonly moved: true; readonly prior: FloorAccept; readonly accept: FloorAccept; readonly manifest: FloorManifest; readonly manifestBytes: Uint8Array; readonly moves: readonly FloorAdoptMove[] }
  | { readonly ok: false; readonly refusal: FloorAdoptRefusal; readonly detail: string };

const priorOf = (accept: FloorAccept): PriorFloorAccept => Object.freeze({ release: accept.release, manifest: accept.manifest, base: accept.local?.base ?? null, receipt: accept.local?.receipt ?? null });

/**
 * Decide an adopt: the local manifest over the accept's base (the base's engine and canon snapshots, the seed floor's plugins
 * offering), the receipt, the prior accept kept. Pure. The founding record never moves; the engine never adopts; an adoption
 * never stacks on an uncommitted one; a seed offering nothing past the accept lands nothing. An adopt keeps the heads the
 * accept took: it moves no release.
 */
export function decideFloorAdopt(args: { readonly accept: FloorAccept; readonly base: FloorManifest; readonly seed: { readonly cid: string; readonly manifest: FloorManifest } }): FloorAdoptDecision {
  const { accept, base, seed } = args;
  if (seed.manifest.engine !== base.engine) {
    return { ok: false, refusal: "adopt-engine-held", detail: `the seed's floor names engine ${seed.manifest.engine}, the base ${base.engine}; the engine stays behind its own cadence threshold, so a re-found takes it today` };
  }
  if (accept.local?.state === "staged") {
    return { ok: false, refusal: "adopt-uncommitted", detail: `the adoption of seed ${accept.local.receipt} stands staged; commit it at par (\`lares vessel floor adopt --commit\`) or revert it (\`lares vessel floor adopt --revert\`) first` };
  }
  const manifest: FloorManifest = { format: base.format, engine: base.engine, plugins: seed.manifest.plugins, snapshots: base.snapshots };
  const manifestBytes = floorManifestBytes(manifest);
  const cid = sha256HexBytesSync(manifestBytes);
  const baseCid = floorAcceptBase(accept);
  if (cid === accept.manifest) return { ok: true, moved: false, accept, why: "the accept already mounts this seed's plugins over its base" };
  if (cid === baseCid || seed.manifest.plugins === base.plugins) return { ok: true, moved: false, accept, why: "the seed offers no plugins past the base" };
  const next: FloorAccept = Object.freeze({ kind: FLOOR_ACCEPT_KIND, nexus: accept.nexus, release: accept.release, manifest: cid, took: accept.took,
    local: Object.freeze({ base: baseCid, receipt: seed.cid, prior: priorOf(accept), state: "staged" as const }) });
  return { ok: true, moved: true, prior: accept, accept: next, manifest, manifestBytes, moves: ["plugins"] };
}

export type FloorLocalAct = { readonly ok: true; readonly moved: boolean; readonly accept: FloorAccept } | { readonly ok: false; readonly refusal: FloorAdoptRefusal; readonly detail: string };

/** Commit a staged local floor (the boot it stood on read par). A committed one answers unmoved. Pure. */
export function commitLocalFloor(accept: FloorAccept): FloorLocalAct {
  if (!accept.local) return { ok: false, refusal: "adopt-none-local", detail: "this accept stands on no local floor, so nothing commits" };
  if (accept.local.state === "committed") return { ok: true, moved: false, accept };
  return { ok: true, moved: true, accept: Object.freeze({ ...accept, local: Object.freeze({ ...accept.local, state: "committed" as const }) }) };
}

/** Revert a local floor to the accept it kept (red, or the hand's word): a forward row that writes the prior back, never a deletion. Pure. */
export function revertLocalFloor(accept: FloorAccept): FloorLocalAct {
  if (!accept.local) return { ok: false, refusal: "adopt-none-local", detail: "this accept stands on no local floor, so nothing reverts" };
  const p = accept.local.prior;
  if (p === null) return { ok: false, refusal: "adopt-no-prior", detail: "this local floor kept no prior accept" };
  const back: FloorAccept = p.base === null || p.receipt === null
    ? Object.freeze({ kind: FLOOR_ACCEPT_KIND, nexus: accept.nexus, release: p.release, manifest: p.manifest, took: accept.took })
    : Object.freeze({ kind: FLOOR_ACCEPT_KIND, nexus: accept.nexus, release: p.release, manifest: p.manifest, took: accept.took, local: Object.freeze({ base: p.base, receipt: p.receipt, prior: null, state: "committed" as const }) });
  return { ok: true, moved: true, accept: back };
}

// ── the remount decision ────────────────────────────────────────────────────────────────────────────

/** What an island can do with its floor read-face. `floorSwap`: it swaps `@oracle` live, without a restart. */
export interface FloorMountCaps { readonly floorSwap: boolean }

/** The alert kind the remount raises where no live swap stands: the existing reboot-pending alert. */
export const FLOOR_REMOUNT_ALERT_KIND = "reboot-pending" as const;

export type FloorRemount =
  | { readonly act: "swap-live" }
  | { readonly act: "alert"; readonly kind: typeof FLOOR_REMOUNT_ALERT_KIND; readonly why: string };

/** Swap live where the island can; raise the reboot-pending alert where it cannot, naming why. By capability, never host. */
export function floorRemountDecision(caps: FloorMountCaps, manifest: string): FloorRemount {
  if (caps.floorSwap === true) return { act: "swap-live" };
  return {
    act: "alert", kind: FLOOR_REMOUNT_ALERT_KIND,
    why: `The floor moved to ${manifest.slice(0, 12)}…; this vessel's islands mount the floor read-face once at boot (no live floor swap), so the accepted floor mounts at the next boot.`,
  };
}

// ── the mount pick: each recipe reads its own realm's Nexus ─────────────────────────────────────────

/** A realm carrying two Nexus pins: the pick mounts genesis and never chooses between them. Cure: settle the realm's pin. */
export const FLOOR_REALM_CONFLICTED = "floor-realm-conflicted" as const;
/** An accept row that fails its exact shape: genesis mounts and the status names the row. */
export const FLOOR_ACCEPT_TORN = "floor-accept-torn" as const;
/** The standing a mount reads beside its CID: a hand's accept, the genesis floor, or a carried head no hand accepted. */
export type FloorStanding = "accepted" | "genesis" | "carried-unaccepted";

/** Which Nexus a mount reads (`floor-nexus` `recipeFloorNexusOf`): one, none (no charter at all), or a realm whose pins conflict. */
export type FloorNexusPick =
  | { readonly nexus: string | null }
  | { readonly conflicted: readonly string[] };

/** What a place shows where no floor key stands: the board's sole head composed as snapshots over genesis plugins
 *  (`carriedFloorOf`), or none (a fork, absent bytes, another engine), naming the heads it read either way. */
export interface CarriedFloor {
  readonly cid:   string | null;
  readonly heads: readonly string[];
  readonly why?:  string;
}

/** The accept home as a mount reads it: the home, a refusal because no floor key stands, or null where no home is named yet. */
export type FloorAcceptsRead = { doc(): LarDoc | undefined } | { readonly unavailable: FloorKeyRefusal } | null;

export interface FloorMountPick {
  readonly cid:      string | null;
  readonly standing: FloorStanding;
  readonly nexus:    string | null;
  /** The heads a carried showing read (the stamp names them, and moves with sync). */
  readonly heads?:   readonly string[];
  readonly note?:    string;
}

/**
 * THE FLOOR AN ISLAND MOUNTS, for ONE Nexus or an explicit none. Pure. Where the accept home stands, the accept at that Nexus
 * mounts (`accepted`); no accept, no Nexus, or a torn row mounts genesis (a torn row names itself). Where no floor key stands
 * (`unavailable`), the carried head shows (`carried-unaccepted`) where one composed whole, else genesis naming the heads.
 * A realm whose Nexus pins conflict mounts genesis under `floor-realm-conflicted`, whatever the home holds.
 */
export function floorToMount(args: {
  readonly accepts: LarDoc | null | undefined | { readonly unavailable: FloorKeyRefusal };
  readonly pick:    FloorNexusPick;
  readonly genesis: string | null;
  readonly carried?: CarriedFloor | null;
}): FloorMountPick {
  const genesis = (nexus: string | null, note?: string): FloorMountPick => ({ cid: args.genesis, standing: "genesis", nexus, ...(note ? { note } : {}) });
  if ("conflicted" in args.pick) return genesis(null, `${FLOOR_REALM_CONFLICTED}: the realm carries pins at ${args.pick.conflicted.length} Nexuses (${args.pick.conflicted.map((a) => `${a.slice(0, 12)}…`).join(", ")}); the genesis floor mounts until the person settles the realm's Nexus pin`);
  const nexus = args.pick.nexus;
  const accepts = args.accepts;
  if (accepts !== null && accepts !== undefined && "unavailable" in accepts) {
    const carried = args.carried ?? null;
    if (carried?.cid) return { cid: carried.cid, standing: "carried-unaccepted", nexus, heads: carried.heads, note: `carried-unaccepted: no floor key stands (${accepts.unavailable}), so no accept reads; the board's head ${carried.heads.map((h) => `${h.slice(0, 12)}…`).join(", ")} shows its canon snapshots over the genesis plugins, and the stamp moves with sync` };
    return genesis(nexus, carried ? `carried-unaccepted: no floor key stands (${accepts.unavailable}); the genesis floor mounts (${carried.why ?? `heads ${carried.heads.join(", ") || "none"}`})` : undefined);
  }
  if (nexus === null) return genesis(null);
  const row = acceptRowOf(accepts ?? null, nexus);
  if (row === "none") return genesis(nexus);
  if (row === "torn") return genesis(nexus, `${FLOOR_ACCEPT_TORN}: the accept at ${nexus.slice(0, 12)}… fails its exact shape; the genesis floor mounts and \`lares vessel floor status\` names the row`);
  return { cid: row.accept.manifest, standing: "accepted", nexus };
}

// ── the carried showing (a herm, a locked hearth) ───────────────────────────────────────────────────

/**
 * THE CARRIED SHOWING: the board's sole counted head, composed as its canon SNAPSHOTS over the genesis floor's engine and
 * plugins, so no plugin code runs that no hand accepted. Reads the local CAS alone (`fetchLocal`); the composed manifest
 * resolves whole before it stages there (`stage`, content-addressed, so a replay lands the same bytes). A fork, absent
 * bytes or another engine answer `cid: null`, naming the heads and why; no counted release answers null.
 */
export async function carriedFloorOf(args: {
  readonly rows:            () => Promise<ReadonlyArray<{ readonly keyCid: string; readonly record: unknown }>>;
  readonly nexus:           string;
  readonly genesisManifest: string;
  readonly requiredBlobIds: readonly string[];
  readonly fetchLocal:      (cid: string) => Promise<Uint8Array | null>;
  readonly stage:           (blobs: ReadonlyArray<{ readonly cid: string; readonly bytes: Uint8Array }>) => Promise<void>;
}): Promise<CarriedFloor | null> {
  const fetch = async (cid: string) => args.fetchLocal(cid).catch(() => null);
  const standing = await foldFloorReleases({ rows: await args.rows(), nexus: args.nexus, manifestBytesOf: fetch });
  if (standing.standing === "absent") return null;
  if (standing.standing === "unsettled") return { cid: null, heads: standing.heads, why: `two heads stand on the board (${standing.heads.join(", ")}): a fork shows the genesis floor` };
  const heads = [standing.head.cid];
  const read = async (cid: string): Promise<FloorManifest | null> => {
    const bytes = await fetch(cid);
    if (!bytes || sha256HexBytesSync(bytes) !== cid) return null;
    const m = readFloorManifest(bytes);
    return "refusal" in m ? null : m.manifest;
  };
  const head = await read(standing.head.body.manifest);
  const genesis = await read(args.genesisManifest);
  if (!head || !genesis) return { cid: null, heads, why: "the head's floor or the genesis floor does not rest whole in this place's CAS" };
  if (head.engine !== genesis.engine) return { cid: null, heads, why: `the head names engine ${head.engine}, the genesis floor ${genesis.engine}: a carried showing never moves the engine` };
  const manifest: FloorManifest = { format: genesis.format, engine: genesis.engine, plugins: genesis.plugins, snapshots: head.snapshots };
  const bytes = floorManifestBytes(manifest);
  const cid = sha256HexBytesSync(bytes);
  const whole = await resolveFloorWhole(cid, async (c) => c === cid ? bytes : fetch(c), { required: args.requiredBlobIds });
  if ("refusal" in whole) return { cid: null, heads, why: `the carried snapshots do not resolve whole here (${whole.refusal}: ${whole.reason})` };
  await args.stage([{ cid, bytes }]);
  return { cid, heads };
}

// ── the composed doors (ports bound per host) ───────────────────────────────────────────────────────

/** The accept home as the accept doors need it: a DocHandle satisfies it. */
export interface FloorAcceptHome {
  doc(): LarDoc | undefined;
  change(fn: (draft: LarDoc) => void): void;
}

/** The capability-named ports one host binds. */
export interface FloorAcceptPorts {
  readonly home:            FloorAcceptHome;
  readonly nexus:           string;
  /** The genesis floor's manifest CID (the island document's seed witness). */
  readonly genesisManifest: string;
  /** The blob ids every mount needs, off this vessel's island (`floorRequiredBlobIds`): an accepted floor's offering keeps each. */
  readonly requiredBlobIds: readonly string[];
  /** The release rows in reach: a board replica, or a porch answer. */
  readonly rows:            () => Promise<ReadonlyArray<{ readonly keyCid: string; readonly record: unknown }>>;
  /** Bytes by CID from wherever this host reaches them; the readers re-hash every byte. */
  readonly fetchCas:        (cid: string) => Promise<Uint8Array | null>;
  /** Keep blobs in this vessel's own CAS, so the next mount resolves them locally. */
  readonly stage:           (blobs: ReadonlyArray<{ readonly cid: string; readonly bytes: Uint8Array }>) => Promise<void>;
  readonly mount:           FloorMountCaps & {
    readonly swap?:  (manifest: string) => Promise<void>;
    readonly alert:  (remount: Extract<FloorRemount, { act: "alert" }>) => Promise<void> | void;
  };
}

async function standingOf(ports: Pick<FloorAcceptPorts, "rows" | "nexus" | "fetchCas">): Promise<FloorReleaseStanding> {
  const cache = new Map<string, Uint8Array | null>();
  const fetch = async (cid: string) => {
    if (!cache.has(cid)) cache.set(cid, await ports.fetchCas(cid).catch(() => null));
    return cache.get(cid) ?? null;
  };
  return foldFloorReleases({ rows: await ports.rows(), nexus: ports.nexus, manifestBytesOf: fetch });
}

/** `floor status`: the accept, the newest release seen, whether it descends (a fast-forward), and whether a fork stands. */
export async function readFloorStatus(ports: Pick<FloorAcceptPorts, "home" | "nexus" | "genesisManifest" | "rows" | "fetchCas">): Promise<FloorStatus> {
  const read = floorAcceptOf(ports.home.doc(), ports.nexus, ports.genesisManifest);
  return floorStatusOf(read, await standingOf(ports));
}

/** The heads the board shows now, in the order an accept takes them: what a rehome stamps as `took`. */
export async function boardHeadsOf(ports: Pick<FloorAcceptPorts, "rows" | "nexus" | "fetchCas">): Promise<readonly string[]> {
  return tookOf(headsOf(await standingOf(ports)));
}

export type FloorAcceptOutcome =
  | (Extract<FloorAcceptDecision, { ok: true }> & { readonly staged: readonly string[]; readonly remount: FloorRemount | null })
  | Extract<FloorAcceptDecision, { ok: false }>;

/**
 * `floor accept [<release>]`: decide, stage the floor whole, move the accept, then remount by capability. A replay lands
 * nothing; a refusal lands nothing.
 */
export async function acceptFloorRelease(ports: FloorAcceptPorts, target?: string): Promise<FloorAcceptOutcome> {
  const { accept } = floorAcceptOf(ports.home.doc(), ports.nexus, ports.genesisManifest);
  const decision = decideFloorAccept({ accept, standing: await standingOf(ports), ...(target !== undefined ? { target } : {}) });
  if (!decision.ok) return decision;
  if (!decision.moved) return { ...decision, staged: [], remount: null };
  const blobs = new Map<string, Uint8Array>();
  const floor = await resolveFloorWhole(decision.accept.manifest, async (cid) => {
    const bytes = await ports.fetchCas(cid).catch(() => null);
    if (bytes) blobs.set(cid, bytes);
    return bytes;
  }, { required: ports.requiredBlobIds });
  if ("refusal" in floor) {
    const refusal = floor.refusal === "floor-offering-refused" || floor.refusal === "floor-offering-incomplete" ? floor.refusal : "floor-bytes-absent";
    return { ok: false, refusal, detail: `${floor.refusal}: ${floor.reason}` };
  }
  const staged = floorBlobCids(decision.accept.manifest, floor.manifest, floor.offering);
  await ports.stage(staged.map((cid) => ({ cid, bytes: blobs.get(cid)! })));
  ports.home.change((draft) => { writeFloorAccept(draft, decision.accept); });
  const remount = floorRemountDecision({ floorSwap: ports.mount.floorSwap === true && ports.mount.swap !== undefined }, decision.accept.manifest);
  if (remount.act === "swap-live" && ports.mount.swap) await ports.mount.swap(decision.accept.manifest);
  else if (remount.act === "alert") await ports.mount.alert(remount);
  return { ...decision, staged, remount };
}

export type FloorAdoptOutcome =
  | (Extract<FloorAdoptDecision, { ok: true; moved: false }> & { readonly applied: false })
  | (Extract<FloorAdoptDecision, { ok: true; moved: true }> & { readonly applied: boolean; readonly staged: readonly string[]; readonly remount: FloorRemount | null })
  | Extract<FloorAdoptDecision, { ok: false }>
  | { readonly ok: false; readonly refusal: "floor-bytes-absent" | "floor-offering-refused" | "floor-offering-incomplete"; readonly detail: string };

/**
 * `floor adopt`: the seed's floor (`seedFloor`, the manifest CID its genesis witness names; `seedCid`, the receipt) over the
 * accept's base at THIS Nexus, read from this vessel's CAS. Each recipe mounts its own realm's Nexus, so an adopt at one
 * Nexus leaves every other Nexus's accept and mount where they stand. The offering resolves whole for its plugins before
 * anything moves. Bare (`apply: false`) it previews and writes nothing; applied, it stages the local manifest, moves the
 * accept, and remounts by capability. Replays and refusals land nothing.
 */
export async function adoptFloorSeed(ports: FloorAcceptPorts, args: { readonly seedCid: string; readonly seedFloor: string; readonly apply: boolean }): Promise<FloorAdoptOutcome> {
  const { accept } = floorAcceptOf(ports.home.doc(), ports.nexus, ports.genesisManifest);
  const readManifest = async (cid: string): Promise<FloorManifest | string> => {
    const bytes = await ports.fetchCas(cid).catch(() => null);
    if (!bytes) return `manifest bytes absent from this vessel's CAS: ${cid}`;
    if (sha256HexBytesSync(bytes) !== cid) return `manifest bytes differ from their CID: ${cid}`;
    const read = readFloorManifest(bytes);
    return "refusal" in read ? `${read.refusal}: ${read.reason}` : read.manifest;
  };
  const base = await readManifest(floorAcceptBase(accept));
  if (typeof base === "string") return { ok: false, refusal: "floor-bytes-absent", detail: `the accept's base: ${base}` };
  const seed = await readManifest(args.seedFloor);
  if (typeof seed === "string") return { ok: false, refusal: "floor-bytes-absent", detail: `the seed's floor: ${seed}` };
  const offered = await resolveFloorOffering(seed, async (cid) => ports.fetchCas(cid).catch(() => null), { required: ports.requiredBlobIds });
  if ("refusal" in offered) {
    return { ok: false, refusal: offered.refusal === "floor-absent" ? "floor-bytes-absent" : offered.refusal, detail: `${offered.refusal}: ${offered.reason}` };
  }
  const decision = decideFloorAdopt({ accept, base, seed: { cid: args.seedCid, manifest: seed } });
  if (!decision.ok) return decision;
  if (!decision.moved) return { ...decision, applied: false };
  const staged = [decision.accept.manifest, seed.plugins, ...floorOfferingBlobsOf(offered.offering).map((b) => b.sha256)];
  if (!args.apply) return { ...decision, applied: false, staged, remount: null };
  await ports.stage([{ cid: decision.accept.manifest, bytes: decision.manifestBytes }]);
  // The local manifest resolves whole (its base's snapshots, the offering and every blob) before the accept moves, as an accept's does.
  const whole = await resolveFloorWhole(decision.accept.manifest, async (cid) => ports.fetchCas(cid).catch(() => null), { required: ports.requiredBlobIds });
  if ("refusal" in whole) return { ok: false, refusal: whole.refusal === "floor-offering-refused" || whole.refusal === "floor-offering-incomplete" ? whole.refusal : "floor-bytes-absent", detail: `the local floor: ${whole.refusal}: ${whole.reason}` };
  ports.home.change((draft) => { writeFloorAccept(draft, decision.accept); });
  const remount = floorRemountDecision({ floorSwap: ports.mount.floorSwap === true && ports.mount.swap !== undefined }, decision.accept.manifest);
  if (remount.act === "swap-live" && ports.mount.swap) await ports.mount.swap(decision.accept.manifest);
  else if (remount.act === "alert") await ports.mount.alert(remount);
  return { ...decision, applied: true, staged, remount };
}

/** `floor adopt --commit | --revert`: move the local floor by its own act, a forward row either way. A refusal lands nothing. */
export async function settleLocalFloor(ports: Pick<FloorAcceptPorts, "home" | "nexus" | "genesisManifest">, act: "commit" | "revert"): Promise<FloorLocalAct & { readonly prior?: FloorAccept }> {
  const { accept } = floorAcceptOf(ports.home.doc(), ports.nexus, ports.genesisManifest);
  const out = act === "commit" ? commitLocalFloor(accept) : revertLocalFloor(accept);
  if (out.ok && out.moved) ports.home.change((draft) => { writeFloorAccept(draft, out.accept); });
  return out.ok ? { ...out, prior: accept } : out;
}

/**
 * The floor pick a vessel's next island mounts for one recipe: the accept home read (`accepts`), the recipe's Nexus (`pick`),
 * the genesis floor off the island document, and the carried showing where no floor key stands. An accept home that throws
 * on its read mounts genesis. Both hosts bind this one read into the pool (`VesselIslandPoolCoreOptions.floorCid`).
 */
export async function vesselFloorPick(args: {
  readonly accepts:   () => Promise<FloorAcceptsRead>;
  readonly pick:      FloorNexusPick;
  readonly islandDoc: () => LarDoc | null | undefined;
  readonly carried?:  () => Promise<CarriedFloor | null>;
}): Promise<FloorMountPick> {
  let island: LarDoc | null | undefined;
  try { island = args.islandDoc(); } catch { island = null; }
  const genesis = genesisFloorCidOf(island);
  let read: FloorAcceptsRead;
  try { read = await args.accepts(); } catch { read = null; }
  let accepts: LarDoc | null | undefined | { readonly unavailable: FloorKeyRefusal };
  if (read === null) accepts = null;
  else if ("unavailable" in read) accepts = read;
  else { try { accepts = read.doc(); } catch { accepts = null; } }
  const carried = accepts !== null && accepts !== undefined && "unavailable" in accepts && args.carried ? await args.carried().catch(() => null) : null;
  const pick = floorToMount({ accepts, pick: args.pick, genesis, carried });
  if (pick.note) console.info(`[floor] ${pick.note}`);
  return pick;
}

/**
 * The floor manifest a recipe's next island mounts, or null where it stands on genesis (the island then reads its seed's own
 * witness). A carried showing answers its composed manifest: the island mounts the carried snapshots over genesis plugins.
 */
export async function vesselFloorCid(args: Parameters<typeof vesselFloorPick>[0]): Promise<string | null> {
  const pick = await vesselFloorPick(args);
  return pick.standing === "genesis" ? null : pick.cid;
}

/**
 * The floor a mount loads its plugin set from (the flip, 3c): the recipe's accepted or carried floor (`vesselFloorCid`), else
 * the genesis floor the founding record names; null where neither stands, and the founding record's own boot set serves.
 */
export async function vesselMountFloorCid(args: Parameters<typeof vesselFloorPick>[0]): Promise<string | null> {
  let island: LarDoc | null | undefined;
  try { island = args.islandDoc(); } catch { island = null; }
  // An island read that throws never fails the mount: the pick reads the one value read above, and no accept then mounts no floor.
  return (await vesselFloorCid({ ...args, islandDoc: () => island })) ?? genesisFloorCidOf(island);
}

/** The pool doors the floor alert rides: the live islands outside any session, and a wiki verb's placement. */
export interface FloorAlertPool {
  inspect(): ReadonlyArray<{ readonly wikiId: string; readonly temperature: string }>;
  placeWikiVerb(wikiId: string, opts: { verb: string; args: Record<string, unknown>; requestedBy: string }): Promise<unknown>;
}

/**
 * Raise the reboot-pending alert in every live wiki island, naming why the accepted floor waits for the next boot. The
 * existing `system-alert` verb carries it into each island's own temp (volatile: the boot that mounts the floor clears it).
 * Both hosts bind this one delivery; a wiki that cools mid-way drops its alert (it boots on the accepted floor anyway).
 * Answers the wikis it reached.
 */
export async function raiseFloorAlert(pool: FloorAlertPool, remount: Extract<FloorRemount, { act: "alert" }>): Promise<string[]> {
  const reached: string[] = [];
  for (const { wikiId, temperature } of pool.inspect()) {
    if (temperature !== "wela") continue;
    try {
      await pool.placeWikiVerb(wikiId, { verb: "system-alert", args: { message: remount.why, cause: "floor-accept", kind: remount.kind }, requestedBy: "floor" });
      reached.push(wikiId);
    } catch { /* a wiki that cooled mid-way mounts the accepted floor at its next boot */ }
  }
  return reached;
}
