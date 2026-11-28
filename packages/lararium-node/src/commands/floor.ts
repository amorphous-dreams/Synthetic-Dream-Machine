/**
 * floor — `lares vessel floor status|accept`: the node vessel's binding of the ONE floor pin seam (`@lararium/mesh` `floor-pin`).
 *
 * The vessel pins the floor (operator ruling 2026-11-11): one pin per (vessel, Nexus), resting in the vessel's fixed-title state,
 * moved only by this vessel's own accept along `prior`. The decisions (status, the accept, the remount) live in the mesh;
 * this module binds the node's substrate to the capability-named ports alone:
 *
 *   · `home`     — the vessel's fixed-title state (`vessel-state`: its secret home, `openVesselSecretHome`), opened through the
 *                  vessel's custody: a locked custody refuses by name;
 *   · `genesis`  — the oracle island at its deterministic address (`oracleGenesisDocUrl`, the address the boot materializes it
 *                  under): no file names it, so this door reads the same source the standing vessel's composition reads;
 *   · `rows`     — the Nexus's publication board, as this vessel's replica carries it (a member holding the charter reads it);
 *   · `fetchCas` — this vessel's own CAS, then a porch where the person names one (`--porch <origin>`: `<origin>/cas/<cid>`);
 *   · `stage`    — this vessel's own CAS, so the next island boot resolves the accepted floor locally;
 *   · `mount`    — no node island swaps its `@oracle` read-face live today, so an accept raises the reboot-pending alert in
 *                  every live wiki through the standing vessel (`floorAlert`); a direct act holds no live wiki and says so.
 *
 * THE STATUS NAMES BOTH TRUTHS, CHARTER-FREE (D1, shore recommendation 8). Beside the Nexus part, `status` reads the
 * founding record (the stored genesis island) against the seed (offered) on disk and against the floor pin, ratchet by
 * ratchet (`genesis-truths`). A place in no Nexus charter still answers that part and refuses only the Nexus part, by name
 * (`nexusRefused`); a place whose store holds no island refuses whole, as before.
 *
 * THE STATUS NAMES THE FLOOR'S DRIFT (`floorDrift`, `@lararium/mesh` floor-drift): each live public-canon carrier the floor this
 * vessel serves misses or serves with older bytes, counted by carrier. The default recipe reads house canon through that floor
 * alone, so a carrier laid after the cut answers nowhere there until a release moves the pin; the lay's lag never sees it.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/w26-floor-lane#/the-vessel-pin
 */
import type { DocHandle, Repo } from "@automerge/automerge-repo";
import {
  acceptFloorRelease,
  genesisFloorCidOf,
  readFloorStatus,
  type FloorAcceptOutcome,
  type FloorPinPorts,
  type FloorRemount,
  type FloorStatus,
} from "@lararium/mesh/floor-pin";
import { floorReleaseEntriesFromBoard } from "@lararium/mesh/floor-release";
import { floorRequiredBlobIds, readFloorOffering } from "@lararium/mesh/floor-offering";
import { materializeSharedLarDoc, publicationDocUrl } from "@lararium/mesh/deterministic-doc";
import { nexusAidOf } from "@lararium/mesh/nexus-seal-seed";
import { oracleGenesisDocUrl } from "@lararium/mesh/genesis-doc";
import { openVesselSecretHome } from "../secret-home-store.js";
import { readFloorDriftReading, type FloorDrift, type FloorDriftReading } from "@lararium/mesh/floor-drift";
import { readFloorManifest } from "@lararium/mesh/floor-manifest";
import { resolveBootDoc } from "@lararium/mesh/boot-resolver";
import { sha256HexBytesSync } from "@lararium/mesh/crypto";
import { type FloorShadowTally } from "@lararium/mesh/floor-shadow";
import { type FloorPinLike } from "@lararium/mesh/genesis-compare";
import { type LarDoc } from "@lararium/mesh/base-doc";
import { bootDaemonUrl } from "../boot-face-planes.js";
import { readBootTiddlers } from "../vessel-private.js";
import { readNexusDoc } from "../nexus-doc.js";
import { charterHomeFor } from "../carried-set.js";
import { readVerifiedCasBlobFromFs, writeCasEntriesFs } from "../node-cas.js";
import { loadVesselVerifyingKey } from "../node-vessel-identity.js";
import { nodeNexusIsland } from "../nexus-standing.js";
import { larBootstrapPath } from "../vessel-paths.js";
import { daemonGenesisDir } from "../lares-config.js";
import { foundingRecordLine, readFoundingRecordTruths, type FoundingRecordTruths } from "../genesis-truths.js";
import { nodeCanonDocUrl, nodeCanonRows } from "./canon-rows.js";
import { readFloorDrifts, type FloorDriftRow } from "../floor-card.js";
import { readFloorShadowFileTold } from "../floor-shadow-file.js";
import { adoptFloorSeed, settleLocalFloor, type FloorAdoptOutcome, type FloorLocalAct, type FloorPin } from "@lararium/mesh/floor-pin";

/** A floor door refused by name. */
export class FloorRefused extends Error {
  readonly refusal: string;
  constructor(refusal: string, message: string) { super(message); this.name = "FloorRefused"; this.refusal = refusal; }
}

/** The daemon document this vessel's bootstrap names: the one address the floor doors read off the bootstrap. */
function bootstrapDaemonUrl(): string {
  const entries = readBootTiddlers(larBootstrapPath());
  if (entries === null) throw new FloorRefused("floor-no-vessel", "this place holds no bootstrap, so no vessel pins a floor here: found the place first");
  const daemonUrl = bootDaemonUrl(entries);
  if (!daemonUrl) throw new FloorRefused("floor-no-vessel", "the bootstrap names no daemon document, so this door finds no vessel: found the place first");
  return daemonUrl;
}

/**
 * The oracle island this store holds, at its deterministic address. A store no boot has materialized it into refuses by name:
 * the founding stands the social planes, and the vessel's first boot stands the island from the genesis seed.
 */
async function storedGenesisIsland(repo: Repo): Promise<DocHandle<LarDoc>> {
  try { return await resolveBootDoc<LarDoc>(repo, oracleGenesisDocUrl(), { tideline: "hearth-private", label: "floor (@oracle)" }); }
  catch { throw new FloorRefused("floor-no-genesis", "this vessel's store holds no oracle island yet, so no genesis floor reads here: stand the vessel once (`lares up`), and its boot materializes the island from the genesis seed"); }
}

export interface NodeFloorOptions {
  readonly repo:     Repo;
  readonly sealHome: string;
  readonly casDir:   string;
  /** The Nexus the pin keys on; absent, the charter this vessel stands in. */
  readonly aid?:     string;
  /** A porch origin to fetch floor bytes from where this vessel's CAS lacks them. */
  readonly porch?:   string;
  /** The standing vessel's alert delivery; absent on a direct act (no live wiki to alert). */
  readonly floorAlert?: (remount: Extract<FloorRemount, { act: "alert" }>) => Promise<readonly string[]>;
  readonly fetchFn?: typeof fetch;
  /** The genesis dir whose seed reads as the offer; absent, the daemon's own resolution (`daemonGenesisDir`). */
  readonly genesisDir?: string;
  /** The catalog the held store names (`StoreDoorDeps.catalogUrl`), where the live canon documents the floor drift weighs resolve;
   *  absent, no live canon reads and the drift answers null. */
  readonly catalogUrl?: string | undefined;
  /** The vessel store dir whose floor shadow tally the shadow row reads; absent, the row reads no tally. */
  readonly storageDir?: string | undefined;
}

/** Bind the node's substrate to the floor pin ports. */
export async function nodeFloorPorts(opts: NodeFloorOptions): Promise<FloorPinPorts & { readonly alerted: string[] }> {
  let home = opts.sealHome;
  if (opts.aid !== undefined) {
    const held = charterHomeFor(opts.sealHome, opts.aid.trim().toLowerCase());
    if (held === null) throw new FloorRefused("floor-no-charter", `this vessel holds no charter for ${opts.aid.slice(0, 18)}…, so it reads no board for that Nexus`);
    home = held;
  }
  const nexus = nexusAidOf(readNexusDoc(home));
  if (nexus === null) throw new FloorRefused("floor-no-charter", "this vessel stands in no Nexus charter, so it holds no floor pin past genesis");
  // A place with no bootstrap holds no vessel to pin a floor: it refuses `floor-no-vessel` before any read.
  bootstrapDaemonUrl();
  const island = (await storedGenesisIsland(opts.repo)).doc();
  const genesisManifest = genesisFloorCidOf(island);
  if (genesisManifest === null) throw new FloorRefused("floor-no-genesis", "this vessel's genesis seed names no floor");
  let state;
  try { state = (await openVesselSecretHome(opts.repo)).handle; }
  catch (e) { throw new FloorRefused("floor-state-unread", `the vessel's fixed-title state reads unread: ${e instanceof Error ? e.message : String(e)}`); }
  const board = await materializeSharedLarDoc(opts.repo, publicationDocUrl(nodeNexusIsland({ ownVesselKey: await loadVesselVerifyingKey(), sealHome: home })), "board:publication");
  const doFetch = opts.fetchFn ?? globalThis.fetch.bind(globalThis);
  const alerted: string[] = [];
  return {
    alerted,
    home: state, nexus, genesisManifest,
    requiredBlobIds: floorRequiredBlobIds(island?.blobs),
    rows: async () => floorReleaseEntriesFromBoard(board.doc()),
    fetchCas: async (cid) => {
      const local = readVerifiedCasBlobFromFs(cid, opts.casDir);
      if (local) return local;
      if (opts.porch === undefined) return null;
      const res = await doFetch(`${opts.porch.replace(/\/+$/, "")}/cas/${cid}`).catch(() => null);
      if (!res?.ok) return null;
      const bytes = new Uint8Array(await res.arrayBuffer());
      return sha256HexBytesSync(bytes) === cid ? bytes : null;
    },
    stage: async (blobs) => { writeCasEntriesFs(blobs.map((b) => ({ cid: b.cid, bytes: b.bytes })), opts.casDir); },
    mount: {
      floorSwap: false,
      alert: async (remount) => { if (opts.floorAlert) alerted.push(...await opts.floorAlert(remount)); },
    },
  };
}

/** What `lares vessel floor status` answers: the Nexus part where a charter stands, and both truths always. */
export type FloorStatusRead = Partial<FloorStatus> & {
  /** The founding record beside the seed (offered) and the floor pin, ratchet by ratchet, and its one line. */
  readonly genesis: FoundingRecordTruths & { readonly line: string };
  /** The Nexus part's refusal, by name, where this place stands in no charter. */
  readonly nexusRefused?: { readonly refusal: string; readonly message: string };
  /** How far the floor this vessel serves trails live public canon, by carrier (`readFloorDriftReading`); null where it does not read. */
  readonly floorDrift: FloorDrift | null;
  /** Why `floorDrift` reads null, by name; absent where it reads. */
  readonly floorDriftWhy?: string;
  /** The five drifts, each by its own word (`floor-card`): the lay's lag rows read at the CLI, which holds the disk. */
  readonly drifts: readonly FloorDriftRow[];
  /** The floor shadow tally the vessel's boots kept; null where none stands. */
  readonly floorShadow: FloorShadowTally | null;
  /** Why the tally reads nowhere where its file stands corrupt; absent where it reads or no file stands. */
  readonly floorShadowWhy?: string;
};

/**
 * THE FLOOR'S DRIFT behind live public canon: the floor this vessel serves (the pin, else the genesis floor) against each canon
 * document the catalog names. A read; it writes nothing. Where it does not read, it answers null WITH the reason, by name: no
 * catalog here, a floor blob this CAS cannot answer, no live canon document, or the fault a read threw. The drift never takes the
 * status down with it, and never reads as a zero it did not count.
 */
async function nodeFloorDrift(opts: NodeFloorOptions, manifestCid: string | null): Promise<FloorDriftReading> {
  if (manifestCid === null) return { drift: null, why: "this vessel names no floor manifest (no pin and no genesis floor)" };
  if (!opts.catalogUrl) return { drift: null, why: "no catalog names live canon beside this store, so no live canon reads here" };
  try {
    const docUrlOf = await nodeCanonDocUrl(opts.repo, opts.catalogUrl);
    return await readFloorDriftReading({
      manifestCid,
      blob: async (cid) => readVerifiedCasBlobFromFs(cid, opts.casDir),
      canonRows: (slug) => nodeCanonRows(opts.repo, docUrlOf, slug),
    });
  } catch (e) {
    return { drift: null, why: `the drift read faulted: ${(e instanceof Error ? e.message : String(e)).replace(/[\r\n]+/g, " ").trim()}` };
  }
}

/**
 * The pinned floor's manifest from this vessel's own CAS (an accept stages it there), or null where it does not read, with its
 * plugins offering where that reads too (null where it does not: grammar and plugins then read absent, never same).
 */
function pinnedFloorOf(manifestCid: string, casDir: string): FloorPinLike | null {
  const bytes = readVerifiedCasBlobFromFs(manifestCid, casDir);
  if (!bytes) return null;
  const read = readFloorManifest(bytes);
  if (!("manifest" in read)) return null;
  const offeringBytes = readVerifiedCasBlobFromFs(read.manifest.plugins, casDir);
  const offering = offeringBytes ? readFloorOffering(offeringBytes, read.manifest.plugins) : null;
  return { manifestCid, manifest: read.manifest, offering: offering && "offering" in offering ? offering.offering : null };
}

/** `lares vessel floor status`: both truths for every place, and the Nexus part where a charter stands. */
export async function runFloorStatus(opts: NodeFloorOptions): Promise<FloorStatusRead> {
  let status: FloorStatus | null = null;
  let nexusRefused: FloorRefused | null = null;
  try { status = await readFloorStatus(await nodeFloorPorts(opts)); }
  catch (e) { if (!(e instanceof FloorRefused && e.refusal === "floor-no-charter")) throw e; nexusRefused = e; }
  // A store with no island has no founding record to read: the Nexus refusal (where one stands) names the place first.
  let island: LarDoc | undefined;
  try { island = (await storedGenesisIsland(opts.repo)).doc(); }
  catch (e) { throw nexusRefused ?? e; }
  if (!island) throw nexusRefused ?? new FloorRefused("floor-no-genesis", "this vessel's oracle island reads empty");
  const floorPin = status ? pinnedFloorOf(status.pinned.manifest, opts.casDir) : null;
  const truths = readFoundingRecordTruths({ record: island, genesisDir: opts.genesisDir ?? daemonGenesisDir(), floorPin });
  const pinNote = nexusRefused
    ? "none — this vessel stands in no Nexus charter, so the founding record's genesis floor serves"
    : `${status?.pinned.manifest ?? "?"} does not read from this vessel's CAS`;
  const genesis = { ...truths, line: foundingRecordLine(truths, { pinNote }) };
  const reading = await nodeFloorDrift(opts, status?.pinned.manifest ?? genesisFloorCidOf(island));
  const drift = { floorDrift: reading.drift, ...(reading.why !== undefined ? { floorDriftWhy: reading.why } : {}) };
  const shadowRead = opts.storageDir !== undefined ? readFloorShadowFileTold(opts.storageDir) : { tally: null };
  const floorShadow = shadowRead.tally;
  const drifts = readFloorDrifts({
    canon: { drift: reading.drift, ...(reading.why !== undefined ? { why: reading.why } : {}) },
    seed: truths.seed, ...(truths.unread !== undefined ? { seedWhy: `the founding record reads unread here (${truths.unread})` } : {}),
    shadow: floorShadow, ...("corrupt" in shadowRead && shadowRead.corrupt ? { shadowWhy: shadowRead.corrupt } : {}), lag: undefined,
  });
  return nexusRefused
    ? { genesis, nexusRefused: { refusal: nexusRefused.refusal, message: nexusRefused.message }, ...drift, drifts, floorShadow, ...("corrupt" in shadowRead && shadowRead.corrupt ? { floorShadowWhy: shadowRead.corrupt } : {}) }
    : { ...status!, genesis, ...drift, drifts, floorShadow, ...("corrupt" in shadowRead && shadowRead.corrupt ? { floorShadowWhy: shadowRead.corrupt } : {}) };
}

/** `lares vessel floor accept [<release-cid>]`: the outcome, and the live wikis the alert reached. */
export async function runFloorAccept(opts: NodeFloorOptions & { readonly target?: string }): Promise<FloorAcceptOutcome & { readonly alerted: readonly string[] }> {
  const ports = await nodeFloorPorts(opts);
  const out = await acceptFloorRelease(ports, opts.target);
  return { ...out, alerted: ports.alerted };
}

/**
 * `lares vessel floor adopt [--apply | --commit | --revert]` (3d, follow-lei S2): the seed the genesis dir offers, adopted over the
 * pin's base as a local floor. `seedFloor` names the seed's floor manifest (its genesis witness) and `seedCid` the receipt; the
 * vessel reads both floors from its own CAS (the boot mirrors a newer seed's blobs there). Bare it previews; `apply` lands it.
 */
export async function runFloorAdopt(opts: NodeFloorOptions & { readonly seedCid: string; readonly seedFloor: string; readonly apply: boolean }): Promise<FloorAdoptOutcome & { readonly alerted: readonly string[] }> {
  const ports = await nodeFloorPorts(opts);
  const out = await adoptFloorSeed(ports, { seedCid: opts.seedCid, seedFloor: opts.seedFloor, apply: opts.apply });
  return { ...out, alerted: ports.alerted };
}

/** `floor adopt --commit | --revert`: the local floor settles by the hand's act, a forward row either way. */
export async function runFloorSettle(opts: NodeFloorOptions & { readonly act: "commit" | "revert" }): Promise<FloorLocalAct & { readonly prior?: FloorPin }> {
  const ports = await nodeFloorPorts(opts);
  return settleLocalFloor(ports, opts.act);
}
