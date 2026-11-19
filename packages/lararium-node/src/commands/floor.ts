/**
 * floor — `lares floor status|accept`: the node vessel's binding of the ONE floor pin seam (`@lararium/mesh` `floor-pin`).
 *
 * The vessel pins the floor (operator ruling 2026-11-11): one pin per (vessel, Nexus), resting in the vessel's control home,
 * moved only by this vessel's own accept along `prior`. The decisions (status, the accept, the remount) live in the mesh;
 * this module binds the node's substrate to the capability-named ports alone:
 *
 *   · `home`     — the vessel's control document (`readControlHome`: it fails closed on a locked vessel by name), found through
 *                  the daemon document the bootstrap names (the bootstrap holds the social planes' address book, the daemon among them);
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
 * Meme: lar:///ha.ka.ba/lares/docs/pono/w26-floor-lane#/the-vessel-pin
 */
import type { AutomergeUrl, DocHandle, Repo } from "@automerge/automerge-repo";
import {
  acceptFloorRelease, floorReleaseEntriesFromBoard, floorRequiredBlobIds, genesisFloorCidOf, materializeSharedLarDoc, nexusAidOf,
  oracleGenesisDocUrl, publicationDocUrl, readControlHome, readFloorManifest, readFloorOffering, readFloorStatus, resolveBootDoc, sha256HexBytesSync,
  FLOOR_PREDATES_LINE, readFoundingFloorManifest,
  type FloorPinLike,
  type FloorAcceptOutcome, type FloorPinPorts, type FloorRemount, type FloorStatus, type LarDoc,
} from "@lararium/mesh";
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
  if (!daemonUrl) throw new FloorRefused("floor-no-vessel", "the bootstrap names no daemon document, so this door finds no control home: found the place first");
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
  const daemonUrl = bootstrapDaemonUrl();
  const island = (await storedGenesisIsland(opts.repo)).doc();
  const genesisManifest = genesisFloorCidOf(island);
  if (genesisManifest === null) throw new FloorRefused("floor-no-genesis", "this vessel's genesis seed names no floor");
  let control;
  try { control = await readControlHome(opts.repo, await opts.repo.find<LarDoc>(daemonUrl as AutomergeUrl)); }
  catch (e) { throw new FloorRefused("floor-control-unread", `the vessel's control home reads unread: ${e instanceof Error ? e.message : String(e)}`); }
  const board = await materializeSharedLarDoc(opts.repo, publicationDocUrl(nodeNexusIsland({ ownVesselKey: await loadVesselVerifyingKey(), sealHome: home })), "board:publication");
  const doFetch = opts.fetchFn ?? globalThis.fetch.bind(globalThis);
  const alerted: string[] = [];
  return {
    alerted,
    home: control, nexus, genesisManifest,
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

/** What `lares floor status` answers: the Nexus part where a charter stands, and both truths always. */
export type FloorStatusRead = Partial<FloorStatus> & {
  /** The founding record beside the seed (offered) and the floor pin, ratchet by ratchet, and its one line. */
  readonly genesis: FoundingRecordTruths & { readonly line: string };
  /** The Nexus part's refusal, by name, where this place stands in no charter. */
  readonly nexusRefused?: { readonly refusal: string; readonly message: string };
};

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

/** `lares floor status`: both truths for every place, and the Nexus part where a charter stands. */
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
  // The founding record's own floor may predate the floor format (`readFoundingFloorManifest`, KEEP): the line says so plainly.
  const foundingCid = genesisFloorCidOf(island);
  const foundingBytes = foundingCid ? readVerifiedCasBlobFromFs(foundingCid, opts.casDir) : null;
  const predates = foundingBytes !== null && "prior" in readFoundingFloorManifest(foundingBytes);
  const pinNote = nexusRefused
    ? `none — this vessel stands in no Nexus charter, so the founding record's genesis floor serves${predates ? `; ${FLOOR_PREDATES_LINE}` : ""}`
    : predates && status?.pinned.manifest === foundingCid
      ? `${foundingCid} — ${FLOOR_PREDATES_LINE}`
      : `${status?.pinned.manifest ?? "?"} does not read from this vessel's CAS`;
  const genesis = { ...truths, line: foundingRecordLine(truths, { pinNote }) };
  return nexusRefused
    ? { genesis, nexusRefused: { refusal: nexusRefused.refusal, message: nexusRefused.message } }
    : { ...status!, genesis };
}

/** `lares floor accept [<release-cid>]`: the outcome, and the live wikis the alert reached. */
export async function runFloorAccept(opts: NodeFloorOptions & { readonly target?: string }): Promise<FloorAcceptOutcome & { readonly alerted: readonly string[] }> {
  const ports = await nodeFloorPorts(opts);
  const out = await acceptFloorRelease(ports, opts.target);
  return { ...out, alerted: ports.alerted };
}
