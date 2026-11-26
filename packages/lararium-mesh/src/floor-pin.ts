/**
 * floor-pin — the VESSEL's pin on a Nexus's floor: one pin per (vessel, Nexus), moved only by the vessel's own accept.
 *
 * The operator's ruling (2026-11-11, "the vessel pins the floor"): a release gets CUT and published (`floor-release`); each
 * vessel ACCEPTS it, and acceptance moves its floor. Faces pin nothing; the engine keeps its own adoption at reboot, per
 * device. So the pin rests in the vessel's CONTROL HOME (`control-home`: the document no recipe mounts and no mirror names),
 * under `<control>/floor-pin/<Nexus AID>`, never in a face's store, and a face switch moves no pin.
 *
 * THE PIN STARTS AT GENESIS. A vessel that holds no pin row for a Nexus stands on the floor its genesis baked
 * (`GENESIS_FLOOR_TIDDLER`): the pin DERIVES (`release: null`, the genesis manifest) and nothing writes at boot, so a reboot
 * lands nothing.
 *
 * ORDER RIDES THE LINK, NEVER A COUNTER. A release descends from the pin where its `prior` chain, walked through the
 * releases that COUNT (`foldFloorReleases`: sealed by a seat, approved by the cabal over the manifest's exact bytes, its
 * lineage proving its epoch's roster, chained to the Nexus's first), reaches the pinned release, or reaches the chain's
 * opening where the pin stands at genesis (every counted chain opens below the genesis floor). No clock, epoch integer or
 * arrival order decides anything here.
 *
 * ONE DECISION, BOTH HOSTS. `floorStatusOf`, `decideFloorAccept`, `floorRemountDecision` and `floorCidToMount` hold the
 * whole logic; `readFloorStatus` and `acceptFloorRelease` compose them over capability-named ports (the board's rows, the
 * CAS fetch, the CAS stage, the mount), which the node vessel and the browser vessel each bind to their own substrate.
 *
 * THE ACCEPT. It fast-forwards along `prior` from the pin to the named release, or to the sole head where none is named.
 * It refuses a release that does not descend from the pin (`floor-not-descendant`, a rollback among them), refuses while two
 * heads stand (`floor-fork-unsettled`, naming both: recency never settles a fork), and stages the floor's manifest and
 * snapshots whole in the local CAS BEFORE the pin moves, so the next mount never meets an absent floor. A replayed accept
 * (the pin already names the release) lands nothing: no stage, no write, no remount. Nothing accepts by itself.
 *
 * THE REMOUNT, BY CAPABILITY. An island that can swap its `@oracle` read-face live (`floorSwap`) swaps; one that mounts its
 * floor once at boot raises the reboot-pending alert, naming why. Neither host's island declares the swap today. An adopt whose
 * vessel binds a restand (`mount.restand`: a pūlama holds its custody, so a raise wakes lit with no hand) asks the house to restand
 * itself at its next quiet point instead; the boot after it settles the staged floor (`settleFloorAtBoot`): par commits it, and
 * anything else reverts it to the prior floor, naming why, each under one receipt (`<control>/floor-settle/<Nexus AID>`).
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/w26-floor-lane#/the-vessel-pin
 */
import { tiddlerText, type LarDoc } from "./base-doc.js";
import { CONTROL_HOME_ID } from "./lar-uris.js";
import { storedLarRecord } from "./stored-record.js";
import { ownEntry, plainRecordOrNull } from "./stored-value.js";
import { GENESIS_FLOOR_TIDDLER, floorBlobCids, floorManifestBytes, readFloorManifest, type FloorManifest } from "./floor-manifest.js";
import { floorOfferingBlobsOf, resolveFloorOffering, resolveFloorWhole } from "./floor-offering.js";
import { sha256HexBytesSync } from "./crypto.js";
import { foldFloorReleases, type FloorRelease, type FloorReleaseRefused, type FloorReleaseStanding } from "./floor-release.js";

/** The pin record's shape name: a reader tells a pin by `kind`, never by a counter. */
import { FLOOR_PIN_KIND, FLOOR_SETTLE_KIND } from "./wire-names.js";
export { FLOOR_PIN_KIND, FLOOR_SETTLE_KIND };
/** Where the pins rest in the vessel's control document: one row per Nexus, keyed by its AID. */
export const FLOOR_PIN_PREFIX = `${CONTROL_HOME_ID}/floor-pin/` as const;

const HEX64 = /^[0-9a-f]{64}$/;
const PIN_KEYS = ["kind", "nexus", "release", "manifest"] as const;

/** The pin before an adoption, kept one adoption back: its release, the manifest it mounted, and its own base and receipt where it
 *  stood local (null where it stood plain). Its own prior drops: the house keeps one floor back, never a chain. */
export interface PriorFloorPin {
  readonly release:  string | null;
  readonly manifest: string;
  readonly base:     string | null;
  readonly receipt:  string | null;
}

/**
 * THE LOCAL FLOOR (3d, follow-lei S2): a pin adopted past its base. `base` names the manifest of the release (or genesis floor) the
 * descent walks from, and the place-claim and the cut read; `receipt` the seed whose plugins it adopted (a CID, never a clock);
 * `prior` the pin before it, kept alive so a red revert lands it back; `state` reads `staged` until the boot it stood on reads par.
 */
export interface LocalFloor {
  readonly base:    string;
  readonly receipt: string;
  readonly prior:   PriorFloorPin | null;
  readonly state:   "staged" | "committed";
}

/** One vessel's pin at one Nexus: the release it accepted (null at genesis), the floor manifest it mounts, and its local form
 *  where it adopted past that release's floor (`manifest` then names the local manifest, `local.base` the release's). */
export interface FloorPin {
  readonly kind:     typeof FLOOR_PIN_KIND;
  readonly nexus:    string;
  readonly release:  string | null;
  readonly manifest: string;
  readonly local?:   LocalFloor;
}

/** The manifest a pin's descent, cut and place-claim stand on: the local floor's base, else the pin's own manifest. */
export function floorPinBase(pin: FloorPin): string {
  return pin.local?.base ?? pin.manifest;
}

/** Where a pin read came from: a row the vessel's accept wrote, or genesis (no row, or a torn one, which the status names). */
export type FloorPinSource = "accepted" | "genesis" | "torn";

/** The pin row's title for a Nexus. */
export function floorPinTitle(nexus: string): string {
  return `${FLOOR_PIN_PREFIX}${nexus}`;
}

/** The genesis pin: the floor this vessel's genesis baked, no release accepted yet. THROWS on a manifest outside sha-256 hex. */
export function genesisFloorPin(nexus: string, genesisManifest: string): FloorPin {
  if (!HEX64.test(genesisManifest)) throw new Error("floor-pin refused: genesis-floor-unreadable");
  return Object.freeze({ kind: FLOOR_PIN_KIND, nexus, release: null, manifest: genesisManifest });
}

/** The genesis floor's manifest CID, as the island document's seed witness names it; null where the seed names none. */
export function genesisFloorCidOf(islandDoc: LarDoc | null | undefined): string | null {
  const cid = plainRecordOrNull(ownEntry(islandDoc?.tiddlers, GENESIS_FLOOR_TIDDLER))?.tiddler["cid"];
  return typeof cid === "string" && HEX64.test(cid) ? cid : null;
}

/** Coerce a value into a pin at its exact shape for `nexus`, or null. */
export function readFloorPin(value: unknown, nexus: string): FloorPin | null {
  if (!isPlain(value)) return null;
  const v = value;
  const keys = Object.hasOwn(v, "local") ? [...PIN_KEYS, "local"] : PIN_KEYS;
  if (!exactKeys(v, keys)) return null;
  if (v["kind"] !== FLOOR_PIN_KIND || v["nexus"] !== nexus) return null;
  if (!hexOrNull(v["release"]) || !hex64(v["manifest"])) return null;
  const pin = { kind: FLOOR_PIN_KIND, nexus, release: v["release"] as string | null, manifest: v["manifest"] as string };
  if (!Object.hasOwn(v, "local")) return Object.freeze(pin);
  const local = readLocalFloor(v["local"]);
  // A local floor keeps its prior on the same release: an adopt never moves the release, so a prior naming another reads torn.
  if (!local || (local.prior !== null && local.prior.release !== pin.release) || local.base === pin.manifest) return null;
  return Object.freeze({ ...pin, local });
}

const isPlain = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const exactKeys = (v: Record<string, unknown>, keys: readonly string[]): boolean => Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k));
const hex64 = (v: unknown): v is string => typeof v === "string" && HEX64.test(v);
const hexOrNull = (v: unknown): boolean => v === null || hex64(v);
const LOCAL_KEYS = ["base", "receipt", "prior", "state"] as const;
const PRIOR_KEYS = ["release", "manifest", "base", "receipt"] as const;

function readLocalFloor(value: unknown): LocalFloor | null {
  if (!isPlain(value) || !exactKeys(value, LOCAL_KEYS)) return null;
  if (!hex64(value["base"]) || !hex64(value["receipt"])) return null;
  if (value["state"] !== "staged" && value["state"] !== "committed") return null;
  let prior: PriorFloorPin | null = null;
  if (value["prior"] !== null) {
    const p = value["prior"];
    if (!isPlain(p) || !exactKeys(p, PRIOR_KEYS) || !hexOrNull(p["release"]) || !hex64(p["manifest"]) || !hexOrNull(p["base"]) || !hexOrNull(p["receipt"])) return null;
    if ((p["base"] === null) !== (p["receipt"] === null)) return null;
    prior = Object.freeze({ release: p["release"] as string | null, manifest: p["manifest"], base: p["base"] as string | null, receipt: p["receipt"] as string | null });
  }
  return Object.freeze({ base: value["base"], receipt: value["receipt"], prior, state: value["state"] });
}

/** The pin's canonical text: fixed key order, so the same pin always writes the same bytes. */
function pinText(pin: FloorPin): string {
  const plain = { kind: pin.kind, nexus: pin.nexus, release: pin.release, manifest: pin.manifest };
  if (!pin.local) return JSON.stringify(plain);
  const l = pin.local;
  const prior = l.prior === null ? null : { release: l.prior.release, manifest: l.prior.manifest, base: l.prior.base, receipt: l.prior.receipt };
  return JSON.stringify({ ...plain, local: { base: l.base, receipt: l.receipt, prior, state: l.state } });
}

/** The vessel's pin at `nexus` off its control document, or the genesis pin where it holds none (a torn row names itself). */
export function floorPinOf(controlDoc: LarDoc | null | undefined, nexus: string, genesisManifest: string):
  { readonly pin: FloorPin; readonly source: FloorPinSource } {
  const text = tiddlerText(ownEntry(controlDoc?.tiddlers, floorPinTitle(nexus)));
  if (text === null) return { pin: genesisFloorPin(nexus, genesisManifest), source: "genesis" };
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { parsed = null; }
  const pin = readFloorPin(parsed, nexus);
  return pin ? { pin, source: "accepted" } : { pin: genesisFloorPin(nexus, genesisManifest), source: "torn" };
}

/** Every pin the control document holds, one per Nexus; a torn row drops. */
export function floorPinsOf(controlDoc: LarDoc | null | undefined): FloorPin[] {
  const out: FloorPin[] = [];
  for (const [title, row] of Object.entries(controlDoc?.tiddlers ?? {})) {
    if (!title.startsWith(FLOOR_PIN_PREFIX)) continue;
    const text = tiddlerText(row);
    if (text === null) continue;
    try { const pin = readFloorPin(JSON.parse(text), title.slice(FLOOR_PIN_PREFIX.length)); if (pin) out.push(pin); } catch { continue; }
  }
  return out;
}

/** Land a pin on a control-document draft. Call INSIDE a `handle.change()` callback; the same pin writes nothing. */
export function writeFloorPin(draft: LarDoc, pin: FloorPin): boolean {
  const title = floorPinTitle(pin.nexus);
  const text = pinText(pin);
  if (tiddlerText(ownEntry(draft.tiddlers, title)) === text) return false;
  draft.tiddlers[title] = storedLarRecord(title, { text }, FLOOR_PIN_KIND);
  return true;
}

// ── descent ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * The releases from the pin (exclusive) to `target` (inclusive), oldest first, walked along `prior` through the counted
 * releases; null where the walk never meets the pin. A pin at genesis meets every counted chain at its opening.
 */
export function floorPathFromPin(pin: FloorPin, target: string, counted: ReadonlyMap<string, FloorRelease>): string[] | null {
  const path: string[] = [];
  const seen = new Set<string>();
  let at: string | null = target;
  while (at !== null) {
    if (at === pin.release) return path.reverse();
    if (seen.has(at)) return null;
    seen.add(at);
    const r = counted.get(at);
    if (r === undefined) return null;
    path.push(at);
    at = r.body.prior;
  }
  return pin.release === null ? path.reverse() : null;
}

const countedMap = (standing: FloorReleaseStanding): Map<string, FloorRelease> => new Map(standing.counted.map((r) => [r.cid, r]));
const headsOf = (standing: FloorReleaseStanding): readonly string[] =>
  standing.standing === "released" ? [standing.head.cid] : standing.standing === "unsettled" ? standing.heads : [];

// ── status ──────────────────────────────────────────────────────────────────────────────────────────

/** Where a vessel's pin stands against what its board shows. */
export interface FloorStatus {
  readonly nexus:       string;
  readonly pinned:      FloorPin;
  readonly pinSource:   FloorPinSource;
  /** The board's chain: no counted release, one head, or a fork. */
  readonly board:       FloorReleaseStanding["standing"];
  /** The sole head the board shows (the newest release seen), or null where none or two stand. */
  readonly newest:      string | null;
  /** Every head the board shows: one when released, two or more when forked. */
  readonly heads:       readonly string[];
  /** Whether the sole head descends from the pin; null where no sole head stands. */
  readonly descends:    boolean | null;
  /** Whether an accept would move the pin forward: the sole head descends and differs from the pin. */
  readonly fastForward: boolean;
  /** The releases an accept of the sole head walks, oldest first; empty where none. */
  readonly path:        readonly string[];
  /** The heads of a standing fork, or null. Named, never resolved. */
  readonly fork:        readonly string[] | null;
  readonly refused:     readonly FloorReleaseRefused[];
}

/** Read a pin against the board's standing. Pure. */
export function floorStatusOf(pinned: { readonly pin: FloorPin; readonly source: FloorPinSource }, standing: FloorReleaseStanding): FloorStatus {
  const heads = headsOf(standing);
  const newest = standing.standing === "released" ? standing.head.cid : null;
  const path = newest === null ? null : floorPathFromPin(pinned.pin, newest, countedMap(standing));
  return Object.freeze({
    nexus: pinned.pin.nexus, pinned: pinned.pin, pinSource: pinned.source,
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
  "floor-fork-unsettled",   // two heads stand on the board: the cabal settles the fork before any vessel accepts
  "floor-no-release",       // no release counts on the board, and none was named
  "floor-release-unknown",  // the named release counts nowhere on the board (absent, or refused by the fold)
  "floor-not-descendant",   // the named release does not descend from the pin (another branch, or a rollback)
  "floor-bytes-absent",     // the release's floor does not stand whole in reach (manifest, snapshots, plugins offering and its blobs, each re-hashed)
  "floor-offering-refused", // the release's plugins offering reads but does not verify (shape, provenance, signature or fold)
  "floor-offering-incomplete", // the release's plugins offering drops a blob every mount needs (the parser, the base seed)
] as const;
export type FloorAcceptRefusal = (typeof FLOOR_ACCEPT_REFUSALS)[number];

export type FloorAcceptDecision =
  | { readonly ok: true; readonly moved: boolean; readonly prior: FloorPin; readonly pin: FloorPin; readonly path: readonly string[]; readonly release: FloorRelease | null }
  | { readonly ok: false; readonly refusal: FloorAcceptRefusal; readonly detail: string; readonly heads?: readonly string[] };

/**
 * Decide an accept: which pin the vessel moves to, and the releases it walks. Pure. `target` names the release; absent,
 * the sole head. A target the pin already names decides `moved: false`, and the caller lands nothing.
 */
export function decideFloorAccept(args: { readonly pin: FloorPin; readonly standing: FloorReleaseStanding; readonly target?: string }): FloorAcceptDecision {
  const { pin, standing } = args;
  if (standing.standing === "unsettled") {
    return { ok: false, refusal: "floor-fork-unsettled", heads: standing.heads, detail: `two heads stand on the board (${standing.heads.join(", ")}); the cabal settles the fork before a vessel accepts either` };
  }
  const target = args.target ?? (standing.standing === "released" ? standing.head.cid : undefined);
  if (target === undefined) return { ok: false, refusal: "floor-no-release", detail: "no release counts on this Nexus's board" };
  const counted = countedMap(standing);
  if (target === pin.release) {
    // THE LET-GO (3d): a local floor over the release it already stands on accepts back onto that release's own floor, a move.
    const held = counted.get(target) ?? null;
    // A bare accept (no release named) never lets a local floor go: the hand names the release to leave the adoption behind.
    if (!pin.local || held === null || args.target === undefined) return { ok: true, moved: false, prior: pin, pin, path: [], release: held };
    return { ok: true, moved: true, prior: pin, pin: Object.freeze({ kind: FLOOR_PIN_KIND, nexus: pin.nexus, release: target, manifest: held.body.manifest }), path: [], release: held };
  }
  const release = counted.get(target);
  if (release === undefined) {
    const refusedRow = standing.refused.find((r) => r.keyCid === target);
    return { ok: false, refusal: "floor-release-unknown", detail: refusedRow ? `the board refused ${target}: ${refusedRow.reason}${refusedRow.detail ? ` (${refusedRow.detail})` : ""}` : `no counted release ${target} stands on the board` };
  }
  const path = floorPathFromPin(pin, target, counted);
  if (path === null) {
    return { ok: false, refusal: "floor-not-descendant", detail: `${target} does not descend from the pinned ${pin.release ?? "genesis floor"} along prior` };
  }
  const next: FloorPin = Object.freeze({ kind: FLOOR_PIN_KIND, nexus: pin.nexus, release: target, manifest: release.body.manifest });
  return { ok: true, moved: true, prior: pin, pin: next, path, release };
}

// ── the local floor: adopt, commit, revert (3d, follow-lei S2) ─────────────────────────────────────

export const FLOOR_ADOPT_REFUSALS = [
  "adopt-engine-held",   // the seed's floor names another engine: the engine stays behind its own cadence threshold, never adopted here
  "adopt-uncommitted",   // a staged adoption stands uncommitted: no second adoption stacks on it (commit at par, or revert)
  "adopt-none-local",    // commit or revert asked of a pin that stands on no local floor
  "adopt-no-prior",      // a revert asked of a local floor that kept no prior pin
  "adopt-many-floors",   // the vessel holds pins at more than one Nexus: a local floor at one would drop the mount to genesis
] as const;
export type FloorAdoptRefusal = (typeof FLOOR_ADOPT_REFUSALS)[number];

/** The ratchets a local manifest moves past its base: the floor's plugins offering carries grammar, lararium and plugins alike. */
export type FloorAdoptMove = "plugins";

export type FloorAdoptDecision =
  | { readonly ok: true; readonly moved: false; readonly pin: FloorPin; readonly why: string }
  | { readonly ok: true; readonly moved: true; readonly prior: FloorPin; readonly pin: FloorPin; readonly manifest: FloorManifest; readonly manifestBytes: Uint8Array; readonly moves: readonly FloorAdoptMove[] }
  | { readonly ok: false; readonly refusal: FloorAdoptRefusal; readonly detail: string };

const priorOf = (pin: FloorPin): PriorFloorPin => Object.freeze({ release: pin.release, manifest: pin.manifest, base: pin.local?.base ?? null, receipt: pin.local?.receipt ?? null });

/**
 * Decide an adopt: the local manifest over the pin's base (the base's engine and canon snapshots, the seed floor's plugins
 * offering), the receipt, the prior pin kept. Pure. The founding record never moves; the engine never adopts; an adoption never
 * stacks on an uncommitted one; a seed offering nothing past the pin lands nothing.
 */
export function decideFloorAdopt(args: { readonly pin: FloorPin; readonly base: FloorManifest; readonly seed: { readonly cid: string; readonly manifest: FloorManifest } }): FloorAdoptDecision {
  const { pin, base, seed } = args;
  if (seed.manifest.engine !== base.engine) {
    return { ok: false, refusal: "adopt-engine-held", detail: `the seed's floor names engine ${seed.manifest.engine}, the base ${base.engine}; the engine stays behind its own cadence threshold, so a re-found takes it today` };
  }
  if (pin.local?.state === "staged") {
    return { ok: false, refusal: "adopt-uncommitted", detail: `the adoption of seed ${pin.local.receipt} stands staged; commit it at par (\`lares vessel floor adopt --commit\`) or revert it (\`lares vessel floor adopt --revert\`) first` };
  }
  const manifest: FloorManifest = { format: base.format, engine: base.engine, plugins: seed.manifest.plugins, snapshots: base.snapshots };
  const manifestBytes = floorManifestBytes(manifest);
  const cid = sha256HexBytesSync(manifestBytes);
  const baseCid = floorPinBase(pin);
  if (cid === pin.manifest) return { ok: true, moved: false, pin, why: "the pin already mounts this seed's plugins over its base" };
  if (cid === baseCid || seed.manifest.plugins === base.plugins) return { ok: true, moved: false, pin, why: "the seed offers no plugins past the base" };
  const next: FloorPin = Object.freeze({ kind: FLOOR_PIN_KIND, nexus: pin.nexus, release: pin.release, manifest: cid,
    local: Object.freeze({ base: baseCid, receipt: seed.cid, prior: priorOf(pin), state: "staged" as const }) });
  return { ok: true, moved: true, prior: pin, pin: next, manifest, manifestBytes, moves: ["plugins"] };
}

export type FloorLocalAct = { readonly ok: true; readonly moved: boolean; readonly pin: FloorPin } | { readonly ok: false; readonly refusal: FloorAdoptRefusal; readonly detail: string };

/** Commit a staged local floor (the boot it stood on read par). A committed one answers unmoved. Pure. */
export function commitLocalFloor(pin: FloorPin): FloorLocalAct {
  if (!pin.local) return { ok: false, refusal: "adopt-none-local", detail: "this pin stands on no local floor, so nothing commits" };
  if (pin.local.state === "committed") return { ok: true, moved: false, pin };
  return { ok: true, moved: true, pin: Object.freeze({ ...pin, local: Object.freeze({ ...pin.local, state: "committed" as const }) }) };
}

/** Revert a local floor to the pin it kept (red, or the hand's word): a forward row that writes the prior back, never a deletion. Pure. */
export function revertLocalFloor(pin: FloorPin): FloorLocalAct {
  if (!pin.local) return { ok: false, refusal: "adopt-none-local", detail: "this pin stands on no local floor, so nothing reverts" };
  const p = pin.local.prior;
  if (p === null) return { ok: false, refusal: "adopt-no-prior", detail: "this local floor kept no prior pin" };
  const back: FloorPin = p.base === null || p.receipt === null
    ? Object.freeze({ kind: FLOOR_PIN_KIND, nexus: pin.nexus, release: p.release, manifest: p.manifest })
    : Object.freeze({ kind: FLOOR_PIN_KIND, nexus: pin.nexus, release: p.release, manifest: p.manifest, local: Object.freeze({ base: p.base, receipt: p.receipt, prior: null, state: "committed" as const }) });
  return { ok: true, moved: true, pin: back };
}

// ── the remount decision ────────────────────────────────────────────────────────────────────────────

/** What an island can do with its floor read-face. `floorSwap`: it swaps `@oracle` live, without a restart. `restand`: the
 *  vessel restands itself at a quiet point, its custody held outside it (a pūlama), so the raise wakes lit with no hand. */
export interface FloorMountCaps { readonly floorSwap: boolean; readonly restand?: boolean }

/** The alert kind the remount raises where no live swap stands: the existing reboot-pending alert. */
export const FLOOR_REMOUNT_ALERT_KIND = "reboot-pending" as const;

export type FloorRemount =
  | { readonly act: "swap-live" }
  | { readonly act: "restand"; readonly why: string }
  | { readonly act: "alert"; readonly kind: typeof FLOOR_REMOUNT_ALERT_KIND; readonly why: string };

/** Swap live where the island can; restand where the vessel can; raise the reboot-pending alert otherwise, naming why. By
 *  capability, never host. */
export function floorRemountDecision(caps: FloorMountCaps, manifest: string): FloorRemount {
  if (caps.floorSwap === true) return { act: "swap-live" };
  if (caps.restand === true) {
    return {
      act: "restand",
      why: `The floor moved to ${manifest.slice(0, 12)}…; the house restands itself at its next quiet point (no write in flight, the sealed rest empty, the shores flushed) to mount it, and the boot after commits it at par or reverts it to the prior floor, naming why.`,
    };
  }
  return {
    act: "alert", kind: FLOOR_REMOUNT_ALERT_KIND,
    why: `The floor moved to ${manifest.slice(0, 12)}…; this vessel's islands mount the floor read-face once at boot (no live floor swap), so the accepted floor mounts at the next boot.`,
  };
}

// ── the mount pick ──────────────────────────────────────────────────────────────────────────────────

/**
 * The floor manifest an island mounts: the pin at `nexus` where the vessel names its Nexus; else the one pin the vessel
 * holds; else genesis. Two pins naming different floors with no Nexus named mount genesis and say so: the pick never
 * chooses between two Nexuses by itself.
 */
export function floorCidToMount(args: { readonly controlDoc: LarDoc | null | undefined; readonly nexus: string | null; readonly genesis: string | null }):
  { readonly cid: string | null; readonly source: "pin" | "genesis"; readonly note?: string } {
  if (args.nexus !== null) {
    const text = tiddlerText(ownEntry(args.controlDoc?.tiddlers, floorPinTitle(args.nexus)));
    let pin: FloorPin | null = null;
    try { pin = text === null ? null : readFloorPin(JSON.parse(text), args.nexus); } catch { pin = null; }
    return pin ? { cid: pin.manifest, source: "pin" } : { cid: args.genesis, source: "genesis" };
  }
  const floors = [...new Set(floorPinsOf(args.controlDoc).map((p) => p.manifest))];
  if (floors.length === 1) return { cid: floors[0]!, source: "pin" };
  if (floors.length > 1) return { cid: args.genesis, source: "genesis", note: `pins at ${floors.length} Nexuses name different floors and no Nexus was named; the genesis floor mounts` };
  return { cid: args.genesis, source: "genesis" };
}

// ── the composed doors (ports bound per host) ───────────────────────────────────────────────────────

/** The control document as the pin doors need it: a DocHandle satisfies it. */
export interface FloorPinHome {
  doc(): LarDoc | undefined;
  change(fn: (draft: LarDoc) => void): void;
}

/** The capability-named ports one host binds. */
export interface FloorPinPorts {
  readonly home:            FloorPinHome;
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
    /** Ask the vessel to restand itself at its next quiet point (an adopt's remount alone); absent, the alert serves. */
    readonly restand?: (manifest: string) => Promise<void> | void;
    readonly alert:  (remount: Extract<FloorRemount, { act: "alert" }>) => Promise<void> | void;
  };
}

async function standingOf(ports: FloorPinPorts): Promise<FloorReleaseStanding> {
  const cache = new Map<string, Uint8Array | null>();
  const fetch = async (cid: string) => {
    if (!cache.has(cid)) cache.set(cid, await ports.fetchCas(cid).catch(() => null));
    return cache.get(cid) ?? null;
  };
  return foldFloorReleases({ rows: await ports.rows(), nexus: ports.nexus, manifestBytesOf: fetch });
}

/** `floor status`: the pin, the newest release seen, whether it descends (a fast-forward), and whether a fork stands. */
export async function readFloorStatus(ports: Pick<FloorPinPorts, "home" | "nexus" | "genesisManifest" | "rows" | "fetchCas">): Promise<FloorStatus> {
  const pinned = floorPinOf(ports.home.doc(), ports.nexus, ports.genesisManifest);
  return floorStatusOf(pinned, await standingOf(ports as FloorPinPorts));
}

export type FloorAcceptOutcome =
  | (Extract<FloorAcceptDecision, { ok: true }> & { readonly staged: readonly string[]; readonly remount: FloorRemount | null })
  | Extract<FloorAcceptDecision, { ok: false }>;

/**
 * `floor accept [<release>]`: decide, stage the floor whole, move the pin, then remount by capability. A replay lands
 * nothing; a refusal lands nothing.
 */
export async function acceptFloorRelease(ports: FloorPinPorts, target?: string): Promise<FloorAcceptOutcome> {
  const { pin } = floorPinOf(ports.home.doc(), ports.nexus, ports.genesisManifest);
  const decision = decideFloorAccept({ pin, standing: await standingOf(ports), ...(target !== undefined ? { target } : {}) });
  if (!decision.ok) return decision;
  if (!decision.moved) return { ...decision, staged: [], remount: null };
  const blobs = new Map<string, Uint8Array>();
  const floor = await resolveFloorWhole(decision.pin.manifest, async (cid) => {
    const bytes = await ports.fetchCas(cid).catch(() => null);
    if (bytes) blobs.set(cid, bytes);
    return bytes;
  }, { required: ports.requiredBlobIds });
  if ("refusal" in floor) {
    const refusal = floor.refusal === "floor-offering-refused" || floor.refusal === "floor-offering-incomplete" ? floor.refusal : "floor-bytes-absent";
    return { ok: false, refusal, detail: `${floor.refusal}: ${floor.reason}` };
  }
  const staged = floorBlobCids(decision.pin.manifest, floor.manifest, floor.offering);
  await ports.stage(staged.map((cid) => ({ cid, bytes: blobs.get(cid)! })));
  ports.home.change((draft) => { writeFloorPin(draft, decision.pin); });
  const remount = floorRemountDecision({ floorSwap: ports.mount.floorSwap === true && ports.mount.swap !== undefined }, decision.pin.manifest);
  if (remount.act === "swap-live" && ports.mount.swap) await ports.mount.swap(decision.pin.manifest);
  else if (remount.act === "alert") await ports.mount.alert(remount);
  return { ...decision, staged, remount };
}

export type FloorAdoptOutcome =
  | (Extract<FloorAdoptDecision, { ok: true; moved: false }> & { readonly applied: false })
  | (Extract<FloorAdoptDecision, { ok: true; moved: true }> & { readonly applied: boolean; readonly staged: readonly string[]; readonly remount: FloorRemount | null })
  | Extract<FloorAdoptDecision, { ok: false }>
  | { readonly ok: false; readonly refusal: "floor-bytes-absent" | "floor-offering-refused" | "floor-offering-incomplete"; readonly detail: string };

/**
 * `floor adopt`: the seed's floor (`seedFloor`, the manifest CID its genesis witness names; `seedCid`, the receipt) over the pin's
 * base, read from this vessel's CAS (the boot mirrors a newer seed's blobs there). The offering resolves whole for its plugins
 * before anything moves. Bare (`apply: false`) it previews and writes nothing; applied, it stages the local manifest, moves the pin,
 * and remounts by capability (the reboot alert today). Replays and refusals land nothing.
 */
export async function adoptFloorSeed(ports: FloorPinPorts, args: { readonly seedCid: string; readonly seedFloor: string; readonly apply: boolean }): Promise<FloorAdoptOutcome> {
  const { pin } = floorPinOf(ports.home.doc(), ports.nexus, ports.genesisManifest);
  const others = floorPinsOf(ports.home.doc()).filter((p) => p.nexus !== ports.nexus);
  if (others.length > 0) {
    return { ok: false, refusal: "adopt-many-floors", detail: `this vessel holds pins at ${others.length + 1} Nexuses; the mount reads a sole pin (\`floorCidToMount\`), so a local floor at one would drop every mount to the genesis floor` };
  }
  const readManifest = async (cid: string): Promise<FloorManifest | string> => {
    const bytes = await ports.fetchCas(cid).catch(() => null);
    if (!bytes) return `manifest bytes absent from this vessel's CAS: ${cid}`;
    if (sha256HexBytesSync(bytes) !== cid) return `manifest bytes differ from their CID: ${cid}`;
    const read = readFloorManifest(bytes);
    return "refusal" in read ? `${read.refusal}: ${read.reason}` : read.manifest;
  };
  const base = await readManifest(floorPinBase(pin));
  if (typeof base === "string") return { ok: false, refusal: "floor-bytes-absent", detail: `the pin's base: ${base}` };
  const seed = await readManifest(args.seedFloor);
  if (typeof seed === "string") return { ok: false, refusal: "floor-bytes-absent", detail: `the seed's floor: ${seed}` };
  const offered = await resolveFloorOffering(seed, async (cid) => ports.fetchCas(cid).catch(() => null), { required: ports.requiredBlobIds });
  if ("refusal" in offered) {
    return { ok: false, refusal: offered.refusal === "floor-absent" ? "floor-bytes-absent" : offered.refusal, detail: `${offered.refusal}: ${offered.reason}` };
  }
  const decision = decideFloorAdopt({ pin, base, seed: { cid: args.seedCid, manifest: seed } });
  if (!decision.ok) return decision;
  if (!decision.moved) return { ...decision, applied: false };
  const staged = [decision.pin.manifest, seed.plugins, ...floorOfferingBlobsOf(offered.offering).map((b) => b.sha256)];
  if (!args.apply) return { ...decision, applied: false, staged, remount: null };
  await ports.stage([{ cid: decision.pin.manifest, bytes: decision.manifestBytes }]);
  // The local manifest resolves whole (its base's snapshots, the offering and every blob) before the pin moves, as an accept's does.
  const whole = await resolveFloorWhole(decision.pin.manifest, async (cid) => ports.fetchCas(cid).catch(() => null), { required: ports.requiredBlobIds });
  if ("refusal" in whole) return { ok: false, refusal: whole.refusal === "floor-offering-refused" || whole.refusal === "floor-offering-incomplete" ? whole.refusal : "floor-bytes-absent", detail: `the local floor: ${whole.refusal}: ${whole.reason}` };
  ports.home.change((draft) => { writeFloorPin(draft, decision.pin); });
  const remount = floorRemountDecision({ floorSwap: ports.mount.floorSwap === true && ports.mount.swap !== undefined, restand: ports.mount.restand !== undefined }, decision.pin.manifest);
  if (remount.act === "swap-live" && ports.mount.swap) await ports.mount.swap(decision.pin.manifest);
  else if (remount.act === "restand" && ports.mount.restand) await ports.mount.restand(decision.pin.manifest);
  else if (remount.act === "alert") await ports.mount.alert(remount);
  return { ...decision, applied: true, staged, remount };
}

/** `floor adopt --commit | --revert`: move the local floor by its own act, a forward row either way. A refusal lands nothing. */
export async function settleLocalFloor(ports: Pick<FloorPinPorts, "home" | "nexus" | "genesisManifest">, act: "commit" | "revert"): Promise<FloorLocalAct & { readonly prior?: FloorPin }> {
  const { pin } = floorPinOf(ports.home.doc(), ports.nexus, ports.genesisManifest);
  const out = act === "commit" ? commitLocalFloor(pin) : revertLocalFloor(pin);
  if (out.ok && out.moved) ports.home.change((draft) => { writeFloorPin(draft, out.pin); });
  return out.ok ? { ...out, prior: pin } : out;
}

// ── the attempt guard: one boot tries a staged floor ──────────────────────────────────────────────────

/** Where a staged floor's attempt rests in the vessel's control document: one row per Nexus. */
export const FLOOR_ATTEMPT_PREFIX = `${CONTROL_HOME_ID}/floor-attempt/` as const;

/** One counted return on a staged floor, in the house's lei shape (`<boot nonce>:<count>`): the boot that spent it, and the count. */
export interface FloorAttempt { readonly floor: string; readonly nonce: string; readonly count: number }

/** The settle's cause where a staged floor's one attempt went spent with no settle (its boot faulted before par). */
export const STAGED_FLOOR_FAULTED_AT_BOOT = "staged-floor-faulted-at-boot" as const;

/** The attempt at `nexus` off the control document, or null where none rests (a torn row reads null). */
export function readFloorAttempt(controlDoc: LarDoc | null | undefined, nexus: string): FloorAttempt | null {
  const text = tiddlerText(ownEntry(controlDoc?.tiddlers, `${FLOOR_ATTEMPT_PREFIX}${nexus}`));
  if (text === null) return null;
  let v: unknown;
  try { v = JSON.parse(text); } catch { return null; }
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  const r = v as Record<string, unknown>;
  if (typeof r["floor"] !== "string" || typeof r["attempt"] !== "string") return null;
  const m = /^([0-9A-Za-z_-]+):([1-9][0-9]*)$/.exec(r["attempt"]);
  return m ? Object.freeze({ floor: r["floor"], nonce: m[1]!, count: Number(m[2]) }) : null;
}

export type FloorAttemptClaim =
  | { readonly act: "none" }
  | { readonly act: "claimed" | "held"; readonly floor: string; readonly attempt: FloorAttempt }
  | { readonly act: "spent"; readonly floor: string; readonly prior: string; readonly attempt: FloorAttempt };

/**
 * BEFORE A MOUNT READS A STAGED-BUT-UNSETTLED FLOOR, by counted events and never time: the boot that finds no attempt on that floor
 * spends its one return (`<nonce>:1`, `claimed`) and mounts it; the boot that spent it mounts it again (`held`); any other boot finds
 * the return spent (`spent`) and mounts the prior floor, so a floor whose mount faults the boot never loops. No staged floor: `none`.
 */
export function claimStagedFloorMount(home: FloorPinHome, nonce: string): FloorAttemptClaim {
  const staged = floorPinsOf(home.doc()).filter((p) => p.local?.state === "staged");
  if (staged.length !== 1) return { act: "none" };
  const pin = staged[0]!;
  const prior = pin.local!.prior;
  const held = readFloorAttempt(home.doc(), pin.nexus);
  if (held !== null && held.floor === pin.manifest) {
    if (held.nonce === nonce) return { act: "held", floor: pin.manifest, attempt: held };
    if (held.count >= 1 && prior !== null) return { act: "spent", floor: pin.manifest, prior: prior.manifest, attempt: held };
  }
  const attempt: FloorAttempt = Object.freeze({ floor: pin.manifest, nonce, count: 1 });
  const title = `${FLOOR_ATTEMPT_PREFIX}${pin.nexus}`;
  home.change((draft) => { draft.tiddlers[title] = storedLarRecord(title, { text: JSON.stringify({ floor: attempt.floor, attempt: `${nonce}:${attempt.count}` }) }, FLOOR_SETTLE_KIND); });
  return { act: "claimed", floor: pin.manifest, attempt };
}

// ── the boot's settle: par commits, anything else reverts ─────────────────────────────────────────────

/** Where a settle's receipt rests in the vessel's control document: one row per Nexus, the latest settle. */
export const FLOOR_SETTLE_PREFIX = `${CONTROL_HOME_ID}/floor-settle/` as const;

/** What this boot's mount read off the floor it stood on (the daemon island's plugin set): the floor itself served, or the
 *  founding record's boot set served and why; null where no mount reading reached the settle. */
export type FloorBootMount =
  | { readonly source: "floor"; readonly manifest: string }
  | { readonly source: "island"; readonly manifest: string | null; readonly why: string }
  | null;

/** The one receipt a settle rests: the floor it settled, the seed it adopted, and the par reading (`par`, else the cause). */
export interface FloorSettleReceipt {
  readonly kind:  typeof FLOOR_SETTLE_KIND;
  readonly nexus: string;
  readonly act:   "committed" | "reverted";
  readonly floor: string;
  readonly seed:  string;
  readonly par:   string;
  /** The manifest the pin stands on after the settle: the floor itself where it committed, the prior where it reverted. */
  readonly pinned: string;
}

export type FloorBootSettle =
  | { readonly act: "none" }
  | { readonly act: "committed"; readonly receipt: FloorSettleReceipt }
  | { readonly act: "reverted"; readonly receipt: FloorSettleReceipt; readonly cause: string }
  | { readonly act: "held"; readonly why: string };

/**
 * PAR, read off the boot itself: the boot's mount stood on the staged floor (the floor served its plugin set, on the staged
 * manifest). A mount that fell back to the founding record's set, stood on another floor, or named no mount reads not par,
 * by cause. Pure.
 */
export function floorParOf(pin: FloorPin, mount: FloorBootMount): { readonly par: true } | { readonly par: false; readonly cause: string } {
  if (mount === null) return { par: false, cause: "the boot named no floor mount for its daemon island" };
  if (mount.source === "island") return { par: false, cause: `the staged floor did not serve its plugin set (${mount.why}); the founding record's boot set served` };
  if (mount.manifest !== pin.manifest) return { par: false, cause: `the boot mounted ${mount.manifest.slice(0, 12)}…, never the staged ${pin.manifest.slice(0, 12)}…` };
  return { par: true };
}

/** The settle receipt at `nexus` off the control document, or null where none rests (a torn row reads null). */
export function readFloorSettle(controlDoc: LarDoc | null | undefined, nexus: string): FloorSettleReceipt | null {
  const text = tiddlerText(ownEntry(controlDoc?.tiddlers, `${FLOOR_SETTLE_PREFIX}${nexus}`));
  if (text === null) return null;
  let v: unknown;
  try { v = JSON.parse(text); } catch { return null; }
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  const r = v as Record<string, unknown>;
  if (r["kind"] !== FLOOR_SETTLE_KIND || r["nexus"] !== nexus || (r["act"] !== "committed" && r["act"] !== "reverted")) return null;
  for (const k of ["floor", "seed", "par", "pinned"] as const) if (typeof r[k] !== "string") return null;
  return Object.freeze({ kind: FLOOR_SETTLE_KIND, nexus, act: r["act"] as FloorSettleReceipt["act"], floor: r["floor"] as string, seed: r["seed"] as string, par: r["par"] as string, pinned: r["pinned"] as string });
}

/**
 * THE BOOT SETTLES A STAGED FLOOR by itself: par commits it, anything else reverts it to the prior floor and names why. The pin
 * and its one receipt land in one change; the reverted floor's bytes stay in the CAS and the receipt names it and its seed, so
 * the hand reads what stood staged. No staged floor lands nothing. The hand's `--commit` and `--revert` stay explicit acts beside it.
 */
export function settleFloorAtBoot(home: FloorPinHome, mount: FloorBootMount, bootNonce?: string): FloorBootSettle {
  const staged = floorPinsOf(home.doc()).filter((p) => p.local?.state === "staged");
  if (staged.length === 0) return { act: "none" };
  if (staged.length > 1) return { act: "held", why: `${staged.length} Nexuses hold a staged floor; the hand settles each (\`lares vessel floor adopt --commit\` or \`--revert\`)` };
  const pin = staged[0]!;
  // A return another boot spent, with no settle since: that boot faulted before par. This boot mounted the prior floor; it reverts.
  const attempt = readFloorAttempt(home.doc(), pin.nexus);
  const faulted = bootNonce !== undefined && attempt !== null && attempt.floor === pin.manifest && attempt.nonce !== bootNonce && attempt.count >= 1;
  const reading: ReturnType<typeof floorParOf> = faulted
    ? { par: false, cause: `${STAGED_FLOOR_FAULTED_AT_BOOT}: boot ${attempt!.nonce} spent the staged floor's one attempt (${attempt!.nonce}:${attempt!.count}) and never reached par` }
    : floorParOf(pin, mount);
  const out = reading.par ? commitLocalFloor(pin) : revertLocalFloor(pin);
  if (!out.ok) return { act: "held", why: `${out.refusal}: ${out.detail}` };
  const receipt: FloorSettleReceipt = Object.freeze({
    kind: FLOOR_SETTLE_KIND, nexus: pin.nexus, act: reading.par ? "committed" as const : "reverted" as const,
    floor: pin.manifest, seed: pin.local!.receipt, par: reading.par ? "par" : reading.cause, pinned: out.pin.manifest,
  });
  home.change((draft) => {
    writeFloorPin(draft, out.pin);
    // The settle spends the attempt: a later adopt claims afresh.
    const attemptTitle = `${FLOOR_ATTEMPT_PREFIX}${pin.nexus}`;
    if (Object.hasOwn(draft.tiddlers, attemptTitle)) delete draft.tiddlers[attemptTitle];
    const title = `${FLOOR_SETTLE_PREFIX}${pin.nexus}`;
    draft.tiddlers[title] = storedLarRecord(title, { text: JSON.stringify(receipt) }, FLOOR_SETTLE_KIND);
  });
  return reading.par ? { act: "committed", receipt } : { act: "reverted", receipt, cause: reading.cause };
}

/**
 * The floor manifest a vessel's next island mounts, or null where it stands on genesis (the island then reads its seed's
 * own witness). Both hosts bind this one read into the pool (`VesselIslandPoolCoreOptions.floorCid`); a control document
 * that will not stand (a locked vessel) mounts genesis. No Nexus is named: the vessel's sole pin moves its mount, and two
 * pins naming different floors mount genesis (`floorCidToMount`).
 */
export async function vesselFloorCid(args: {
  readonly control:   () => Promise<{ doc(): LarDoc | undefined; change?(fn: (draft: LarDoc) => void): void } | null>;
  readonly islandDoc: () => LarDoc | null | undefined;
  /** This boot's nonce: present, a staged-but-unsettled floor mounts under the attempt guard (`claimStagedFloorMount`). */
  readonly bootNonce?: string;
  /** Make the attempt durable before the mount reads the staged floor (the Repo's flush). */
  readonly flush?:     () => Promise<void>;
}): Promise<string | null> {
  let controlDoc: LarDoc | undefined;
  let handle: Awaited<ReturnType<typeof args.control>>;
  try { handle = await args.control(); controlDoc = handle?.doc(); } catch { return null; }
  // THE ATTEMPT GUARD: at most one boot ever tries a staged floor. A boot that finds its return spent mounts the prior floor.
  if (args.bootNonce !== undefined && handle?.change) {
    const claim = claimStagedFloorMount(handle as FloorPinHome, args.bootNonce);
    if (claim.act === "spent") {
      console.warn(`[floor] ${claim.floor.slice(0, 12)}… stands staged and unsettled, and boot ${claim.attempt.nonce} spent its one attempt; the prior floor ${claim.prior.slice(0, 12)}… mounts (staged-floor-faulted-at-boot)`);
      return claim.prior;
    }
    if (claim.act === "claimed" && args.flush) await args.flush();
    controlDoc = handle.doc();
  }
  const pick = floorCidToMount({ controlDoc, nexus: null, genesis: genesisFloorCidOf(args.islandDoc()) });
  if (pick.note) console.info(`[floor] ${pick.note}`);
  return pick.source === "pin" ? pick.cid : null;
}

/**
 * The floor a mount loads its plugin set from (the flip, 3c): the vessel's pin (`vesselFloorCid`), else the genesis floor the
 * founding record names; null where neither stands, and the founding record's own boot set serves.
 */
export async function vesselMountFloorCid(args: Parameters<typeof vesselFloorCid>[0]): Promise<string | null> {
  let island: LarDoc | null | undefined;
  try { island = args.islandDoc(); } catch { island = null; }
  // An island read that throws never fails the mount: the pick reads the one value read above, and no pin then mounts no floor.
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
