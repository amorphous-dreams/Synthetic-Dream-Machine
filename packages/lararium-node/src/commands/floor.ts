/**
 * floor — `lares floor status|accept`: the node vessel's binding of the ONE floor pin seam (`@lararium/mesh` `floor-pin`).
 *
 * The vessel pins the floor (operator ruling 2026-11-11): one pin per (vessel, Nexus), resting in the vessel's control home,
 * moved only by this vessel's own accept along `prior`. The decisions (status, the accept, the remount) live in the mesh;
 * this module binds the node's substrate to the capability-named ports alone:
 *
 *   · `home`     — the vessel's control document (`readControlHome`: it fails closed on a locked vessel by name);
 *   · `rows`     — the Nexus's publication board, as this vessel's replica carries it (a member holding the charter reads it);
 *   · `fetchCas` — this vessel's own CAS, then a porch where the person names one (`--porch <origin>`: `<origin>/cas/<cid>`);
 *   · `stage`    — this vessel's own CAS, so the next island boot resolves the accepted floor locally;
 *   · `mount`    — no node island swaps its `@oracle` read-face live today, so an accept raises the reboot-pending alert in
 *                  every live wiki through the standing vessel (`floorAlert`); a direct act holds no live wiki and says so.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/w26-floor-lane#/the-vessel-pin
 */
import { readFileSync } from "node:fs";
import type { AutomergeUrl, Repo } from "@automerge/automerge-repo";
import {
  BAG_IDS, DAEMON_BAG_ID, acceptFloorRelease, floorReleaseRowsFromBoard, genesisFloorCidOf, materializeSharedLarDoc, nexusAidOf,
  ownEntry, publicationDocUrl, readControlHome, readFloorStatus, sha256HexBytesSync,
  type FloorAcceptOutcome, type FloorPinPorts, type FloorRemount, type FloorStatus, type LarDoc,
} from "@lararium/mesh";
import { readNexusDoc } from "../nexus-doc.js";
import { charterHomeFor } from "../carried-set.js";
import { readVerifiedCasBlobFromFs, writeCasEntriesFs } from "../node-cas.js";
import { loadVesselVerifyingKey } from "../node-vessel-identity.js";
import { nodeNexusIsland } from "../nexus-standing.js";
import { larBootstrapPath } from "../vessel-paths.js";

/** A floor door refused by name. */
export class FloorRefused extends Error {
  readonly refusal: string;
  constructor(refusal: string, message: string) { super(message); this.name = "FloorRefused"; this.refusal = refusal; }
}

type BootEntries = Readonly<Record<string, { text?: string }>>;

function bootstrapEntries(): BootEntries {
  let text: string;
  try { text = readFileSync(larBootstrapPath(), "utf8"); } catch { throw new FloorRefused("floor-no-vessel", "this place holds no bootstrap, so no vessel pins a floor here: found the place first"); }
  const plugin = JSON.parse(text) as { text?: string };
  return (JSON.parse(plugin.text ?? "{}") as { tiddlers?: Record<string, { text?: string }> }).tiddlers ?? {};
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
  const entries = bootstrapEntries();
  const daemonUrl = ownEntry(entries, DAEMON_BAG_ID)?.text;
  const islandUrl = ownEntry(entries, BAG_IDS.oracle)?.text;
  if (!daemonUrl || !islandUrl) throw new FloorRefused("floor-no-vessel", "the bootstrap names no daemon or island document");
  const islandDoc = (await opts.repo.find<LarDoc>(islandUrl as AutomergeUrl)).doc();
  const genesisManifest = genesisFloorCidOf(islandDoc);
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
    rows: async () => floorReleaseRowsFromBoard(board.doc()),
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

/** `lares floor status`. */
export async function runFloorStatus(opts: NodeFloorOptions): Promise<FloorStatus> {
  return readFloorStatus(await nodeFloorPorts(opts));
}

/** `lares floor accept [<release-cid>]`: the outcome, and the live wikis the alert reached. */
export async function runFloorAccept(opts: NodeFloorOptions & { readonly target?: string }): Promise<FloorAcceptOutcome & { readonly alerted: readonly string[] }> {
  const ports = await nodeFloorPorts(opts);
  const out = await acceptFloorRelease(ports, opts.target);
  return { ...out, alerted: ports.alerted };
}
