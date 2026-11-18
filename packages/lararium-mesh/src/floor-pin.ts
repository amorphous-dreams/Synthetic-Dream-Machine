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
 * floor once at boot raises the reboot-pending alert, naming why. Neither host's island declares the swap today.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/w26-floor-lane#/the-vessel-pin
 */
import { tiddlerText, type LarDoc } from "./base-doc.js";
import { CONTROL_HOME_ID } from "./lar-uris.js";
import { storedLarRecord } from "./stored-record.js";
import { ownEntry, plainRecordOrNull } from "./stored-value.js";
import { GENESIS_FLOOR_TIDDLER, floorBlobCids, resolveFloor } from "./floor-manifest.js";
import { foldFloorReleases, type FloorRelease, type FloorReleaseRefused, type FloorReleaseStanding } from "./floor-release.js";

/** The pin record's shape name: a reader tells a pin by `kind`, never by a counter. */
import { FLOOR_PIN_KIND } from "./wire-names.js";
export { FLOOR_PIN_KIND };
/** Where the pins rest in the vessel's control document: one row per Nexus, keyed by its AID. */
export const FLOOR_PIN_PREFIX = `${CONTROL_HOME_ID}/floor-pin/` as const;

const HEX64 = /^[0-9a-f]{64}$/;
const PIN_KEYS = ["kind", "nexus", "release", "manifest"] as const;

/** One vessel's pin at one Nexus: the release it accepted (null at genesis) and that release's floor manifest CID. */
export interface FloorPin {
  readonly kind:     typeof FLOOR_PIN_KIND;
  readonly nexus:    string;
  readonly release:  string | null;
  readonly manifest: string;
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
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).length !== PIN_KEYS.length || !PIN_KEYS.every((k) => Object.hasOwn(v, k))) return null;
  if (v["kind"] !== FLOOR_PIN_KIND || v["nexus"] !== nexus) return null;
  if (v["release"] !== null && (typeof v["release"] !== "string" || !HEX64.test(v["release"]))) return null;
  if (typeof v["manifest"] !== "string" || !HEX64.test(v["manifest"])) return null;
  return Object.freeze({ kind: FLOOR_PIN_KIND, nexus, release: v["release"] as string | null, manifest: v["manifest"] });
}

/** The pin's canonical text: fixed key order, so the same pin always writes the same bytes. */
function pinText(pin: FloorPin): string {
  return JSON.stringify({ kind: pin.kind, nexus: pin.nexus, release: pin.release, manifest: pin.manifest });
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
  "floor-bytes-absent",     // the release's floor does not stand whole in reach (manifest and snapshots, each re-hashed)
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
  if (target === pin.release) return { ok: true, moved: false, prior: pin, pin, path: [], release: countedMap(standing).get(target) ?? null };
  const counted = countedMap(standing);
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
  const floor = await resolveFloor(decision.pin.manifest, async (cid) => {
    const bytes = await ports.fetchCas(cid).catch(() => null);
    if (bytes) blobs.set(cid, bytes);
    return bytes;
  });
  if ("refusal" in floor) return { ok: false, refusal: "floor-bytes-absent", detail: `${floor.refusal}: ${floor.reason}` };
  const staged = floorBlobCids(decision.pin.manifest, floor.manifest);
  await ports.stage(staged.map((cid) => ({ cid, bytes: blobs.get(cid)! })));
  ports.home.change((draft) => { writeFloorPin(draft, decision.pin); });
  const remount = floorRemountDecision({ floorSwap: ports.mount.floorSwap === true && ports.mount.swap !== undefined }, decision.pin.manifest);
  if (remount.act === "swap-live" && ports.mount.swap) await ports.mount.swap(decision.pin.manifest);
  else if (remount.act === "alert") await ports.mount.alert(remount);
  return { ...decision, staged, remount };
}

/**
 * The floor manifest a vessel's next island mounts, or null where it stands on genesis (the island then reads its seed's
 * own witness). Both hosts bind this one read into the pool (`VesselIslandPoolCoreOptions.floorCid`); a control document
 * that will not stand (a locked vessel) mounts genesis. No Nexus is named: the vessel's sole pin moves its mount, and two
 * pins naming different floors mount genesis (`floorCidToMount`).
 */
export async function vesselFloorCid(args: {
  readonly control:   () => Promise<{ doc(): LarDoc | undefined } | null>;
  readonly islandDoc: () => LarDoc | null | undefined;
}): Promise<string | null> {
  let controlDoc: LarDoc | undefined;
  try { controlDoc = (await args.control())?.doc(); } catch { return null; }
  const pick = floorCidToMount({ controlDoc, nexus: null, genesis: genesisFloorCidOf(args.islandDoc()) });
  if (pick.note) console.info(`[floor] ${pick.note}`);
  return pick.source === "pin" ? pick.cid : null;
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
