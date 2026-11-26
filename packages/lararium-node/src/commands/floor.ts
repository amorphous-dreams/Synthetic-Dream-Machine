/**
 * floor — `lares vessel floor status|accept|adopt|rehome`: the node vessel's binding of the ONE floor accept seam
 * (`@lararium/mesh` `floor-accept`).
 *
 * The place accepts the floor (operator rulings 2026-11-11, 2026-11-26): one accept per (place, Nexus), resting in the place's
 * accept home under the floor's rest key, moved only by a hand's accept along `prior`. No face needs to stand: a faceless,
 * unlocked place accepts. The decisions (status, the accept, the remount) live in the mesh; this module binds the node's
 * substrate to the capability-named ports alone:
 *
 *   · `home`     — the place's accept home (`standFloorAcceptHome`), found through the daemon document the bootstrap names; a
 *                  floor key that does not stand refuses `floor-unavailable` by name (`vessel-locked`: `lares vault unlock`;
 *                  `floor-unkeyed`: a herm, which carries and accepts nothing);
 *   · `genesis`  — the oracle island at its deterministic address (`oracleGenesisDocUrl`, the address the boot materializes it
 *                  under): no file names it, so this door reads the same source the standing vessel's composition reads;
 *   · `rows`     — the Nexus's publication board, as this vessel's replica carries it (a member holding the charter reads it);
 *   · `fetchCas` — this vessel's own CAS, then a porch where the person names one (`--porch <origin>`: `<origin>/cas/<cid>`);
 *   · `stage`    — this vessel's own CAS, so the next island boot resolves the accepted floor locally;
 *   · `mount`    — no node island swaps its `@oracle` read-face live today, so an accept raises the reboot-pending alert in
 *                  every live wiki through the standing vessel (`floorAlert`); a direct act holds no live wiki and says so.
 *
 * THE STATUS NAMES BOTH TRUTHS, CHARTER-FREE (D1, shore recommendation 8). Beside the Nexus part, `status` reads the
 * founding record (the stored genesis island) against the seed (offered) on disk and against the floor accept, ratchet by
 * ratchet (`genesis-truths`). A place in no Nexus charter still answers that part and refuses only the Nexus part, by name
 * (`nexusRefused`); a place whose store holds no island refuses whole, as before.
 *
 * THE STATUS NAMES THE FLOOR'S DRIFT (`floorDrift`, `@lararium/mesh` floor-drift): each live public-canon carrier the floor this
 * vessel serves misses or serves with older bytes, counted by carrier. The default recipe reads house canon through that floor
 * alone, so a carrier laid after the cut answers nowhere there until a release moves the accept; the lay's lag never sees it.
 *
 * Meme: lar:///ha.ka.ba/lararium/api/residency-tiers#/floor-accept
 */
import type { AutomergeUrl, DocHandle, Repo } from "@automerge/automerge-repo";
import {
  acceptFloorRelease,
  boardHeadsOf,
  carriedFloorOf,
  genesisFloorCidOf,
  readFloorStatus,
  type CarriedFloor,
  type FloorAcceptOutcome,
  type FloorAcceptPorts,
  type FloorRemount,
  type FloorStatus,
} from "@lararium/mesh/floor-accept";
import { mintOnWrite, standFloorAcceptHome, type FloorKeyReading } from "@lararium/mesh/floor-accept-home";
import { FloorUnavailable, type FloorKeyRefusal } from "@lararium/mesh/floor-registry";
import { FLOOR_PIN_UNMOVED, FLOOR_REHOME_CURE, rehomeFloorRows, unmovedFloorRows, type FloorRehomeReceipt } from "@lararium/mesh/floor-rehome";
import { resolveFloorWhole } from "@lararium/mesh/floor-offering";
import { floorKeyStandsOn, secretHomeRestOf, standFloorKeyOn } from "@lararium/mesh/secret-home";
import { floorRestKey, type HeldRestKey } from "@lararium/mesh/held-rest-key";
import { CustodyLocked } from "../custody-holder.js";
import { custodyFloorKeyDoor } from "../custody-seat.js";
import { floorReleaseEntriesFromBoard } from "@lararium/mesh/floor-release";
import { floorRequiredBlobIds, readFloorOffering } from "@lararium/mesh/floor-offering";
import { materializeSharedLarDoc, publicationDocUrl } from "@lararium/mesh/deterministic-doc";
import { nexusAidOf } from "@lararium/mesh/nexus-seal-seed";
import { oracleGenesisDocUrl } from "@lararium/mesh/genesis-doc";
import { CONTROL_HOME_UNNAMED, ControlHomeUnavailable, readControlHome } from "@lararium/mesh/control-home";
import { readFloorDriftReading, type FloorDrift, type FloorDriftReading } from "@lararium/mesh/floor-drift";
import { readFloorManifest } from "@lararium/mesh/floor-manifest";
import { resolveBootDoc } from "@lararium/mesh/boot-resolver";
import { sha256HexBytesSync } from "@lararium/mesh/crypto";
import { type FloorShadowTally } from "@lararium/mesh/floor-shadow";
import { type FloorAcceptLike } from "@lararium/mesh/genesis-compare";
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
import { adoptFloorSeed, settleLocalFloor, type FloorAdoptOutcome, type FloorLocalAct, type FloorAccept } from "@lararium/mesh/floor-accept";

/** A floor door refused by name. */
export class FloorRefused extends Error {
  readonly refusal: string;
  constructor(refusal: string, message: string) { super(message); this.name = "FloorRefused"; this.refusal = refusal; }
}

/** The daemon document this vessel's bootstrap names: the one address the floor doors read off the bootstrap. */
function bootstrapDaemonUrl(): string {
  const entries = readBootTiddlers(larBootstrapPath());
  if (entries === null) throw new FloorRefused("floor-no-vessel", "this place holds no bootstrap, so no place accepts a floor here: found the place first");
  const daemonUrl = bootDaemonUrl(entries);
  if (!daemonUrl) throw new FloorRefused("floor-no-vessel", "the bootstrap names no daemon document, so this door finds no accept home: found the place first");
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
  /** The Nexus the accept keys on; absent, the charter this place stands in. */
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
  /** The standing vessel's floor key reading for this composition (`floorKeyGrant`); absent, a direct holder stands the key
   *  through its custody itself (`directFloorKey`). */
  readonly floorKey?: () => FloorKeyReading;
}

/**
 * THE FLOOR KEY, AS A DIRECT HOLDER STANDS IT: where the key already stands on this Repo's rest, it stands; else the holder
 * opens its custody where it can (the rest's own `standKey`, as the control document's stand does) and the custody's floor
 * door derives the key (one child of the custody root, no face needed) and stands it on the rest. A custody that stays shut
 * answers `vessel-locked`. A herm derives none on a standing vessel (`floor-unkeyed`), which hands its own reading instead.
 */
async function directFloorKey(repo: Repo): Promise<FloorKeyReading> {
  if (floorKeyStandsOn(repo)) return "stands";
  // A faceless place names no secret home, and its custody may still open: the refusal here never decides the floor key.
  try { await secretHomeRestOf(repo)?.standKey?.(); } catch { /* the floor door below answers for the custody */ }
  if (floorKeyStandsOn(repo)) return "stands";
  let key: HeldRestKey;
  try { key = floorRestKey(custodyFloorKeyDoor()); }
  catch (e) { if (e instanceof CustodyLocked) return "vessel-locked"; throw e; }
  try { standFloorKeyOn(repo, key); } finally { key.fill(0); }
  return floorKeyStandsOn(repo) ? "stands" : "vessel-locked";
}

/** The floor key's reading this door acts under: the standing vessel's, else the direct holder's own. */
async function floorKeyOf(opts: NodeFloorOptions): Promise<FloorKeyReading> {
  return opts.floorKey ? opts.floorKey() : directFloorKey(opts.repo);
}

/** An accept home that holds no row and takes no write: a read before any accept stands on genesis. */
const NO_ACCEPTS = Object.freeze({ doc: () => undefined, change: () => { throw new FloorRefused("floor-accept-home-unnamed", "no accept home stands named; a hand's accept mints it"); } });

/**
 * Bind the node's substrate to the floor accept ports. `mint`: a hand's act (accept, adopt, rehome) mints the accept home where
 * none stands named; a read (`status`, a preview) mints nothing and reads genesis. A floor key that does not stand refuses
 * `floor-unavailable` by name before any row moves.
 */
export async function nodeFloorPorts(opts: NodeFloorOptions & { readonly mint?: boolean; readonly unkeyed?: boolean }): Promise<FloorAcceptPorts & { readonly alerted: string[]; land(): Promise<void> }> {
  let home = opts.sealHome;
  if (opts.aid !== undefined) {
    const held = charterHomeFor(opts.sealHome, opts.aid.trim().toLowerCase());
    if (held === null) throw new FloorRefused("floor-no-charter", `this vessel holds no charter for ${opts.aid.slice(0, 18)}…, so it reads no board for that Nexus`);
    home = held;
  }
  const nexus = nexusAidOf(readNexusDoc(home));
  if (nexus === null) throw new FloorRefused("floor-no-charter", "this place stands in no Nexus charter, so it holds no floor accept past genesis");
  const daemonUrl = bootstrapDaemonUrl();
  const island = (await storedGenesisIsland(opts.repo)).doc();
  const genesisManifest = genesisFloorCidOf(island);
  if (genesisManifest === null) throw new FloorRefused("floor-no-genesis", "this vessel's genesis seed names no floor");
  // `unkeyed`: the status's board read where no floor key stands; it reads no accept and takes no write.
  const reading = opts.unkeyed === true ? null : await floorKeyOf(opts);
  const daemon = await opts.repo.find<LarDoc>(daemonUrl as AutomergeUrl);
  // The key's refusal names itself here, before any read or write; a standing home reads, and an act mints one only by writing.
  const standing = reading === null ? null : await standFloorAcceptHome(opts.repo, daemon, { mint: false, floorKey: () => reading });
  const minted = opts.mint === true && reading !== null ? mintOnWrite(standing, async () => {
    const acceptHome = await standFloorAcceptHome(opts.repo, daemon, { mint: true, floorKey: () => reading });
    if (acceptHome === null) throw new FloorRefused("floor-accept-home-unnamed", "the accept home did not mint");
    return acceptHome;
  }) : null;
  const board = await materializeSharedLarDoc(opts.repo, publicationDocUrl(nodeNexusIsland({ ownVesselKey: await loadVesselVerifyingKey(), sealHome: home })), "board:publication");
  const doFetch = opts.fetchFn ?? globalThis.fetch.bind(globalThis);
  const alerted: string[] = [];
  return {
    alerted,
    home: minted?.home ?? standing ?? NO_ACCEPTS, nexus, genesisManifest,
    land: async () => { await minted?.land(); },
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
  /** The founding record beside the seed (offered) and the floor accept, ratchet by ratchet, and its one line. */
  readonly genesis: FoundingRecordTruths & { readonly line: string };
  /** The Nexus part's refusal, by name, where this place stands in no charter. */
  readonly nexusRefused?: { readonly refusal: string; readonly message: string };
  /** What this place mounts at its home charter: a hand's accept, the genesis floor, or a carried head no hand accepted. */
  readonly standing?: "accepted" | "genesis" | "carried-unaccepted";
  /** Why no accept reads, by the floor key's name, where none stands (a herm `floor-unkeyed`, a locked hearth `vessel-locked`). */
  readonly unavailable?: FloorKeyRefusal;
  /** The carried showing where no floor key stands: the composed manifest (or none) and the heads it read. */
  readonly carried?: CarriedFloor;
  /** The Nexuses whose retired rows still wait in the control document, with the door that moves them. */
  readonly unmoved?: { readonly word: typeof FLOOR_PIN_UNMOVED; readonly nexuses: readonly string[]; readonly cure: typeof FLOOR_REHOME_CURE };
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
 * THE FLOOR'S DRIFT behind live public canon: the floor this vessel serves (the accept, else the genesis floor) against each canon
 * document the catalog names. A read; it writes nothing. Where it does not read, it answers null WITH the reason, by name: no
 * catalog here, a floor blob this CAS cannot answer, no live canon document, or the fault a read threw. The drift never takes the
 * status down with it, and never reads as a zero it did not count.
 */
async function nodeFloorDrift(opts: NodeFloorOptions, manifestCid: string | null): Promise<FloorDriftReading> {
  if (manifestCid === null) return { drift: null, why: "this vessel names no floor manifest (no accept and no genesis floor)" };
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
 * The accepted floor's manifest from this vessel's own CAS (an accept stages it there), or null where it does not read, with its
 * plugins offering where that reads too (null where it does not: grammar and plugins then read absent, never same).
 */
function acceptedFloorOf(manifestCid: string, casDir: string): FloorAcceptLike | null {
  const bytes = readVerifiedCasBlobFromFs(manifestCid, casDir);
  if (!bytes) return null;
  const read = readFloorManifest(bytes);
  if (!("manifest" in read)) return null;
  const offeringBytes = readVerifiedCasBlobFromFs(read.manifest.plugins, casDir);
  const offering = offeringBytes ? readFloorOffering(offeringBytes, read.manifest.plugins) : null;
  return { manifestCid, manifest: read.manifest, offering: offering && "offering" in offering ? offering.offering : null };
}

/** The retired rows still waiting in the control document, where the control document reads (a faceless place holds none). */
async function unmovedOf(opts: NodeFloorOptions): Promise<FloorStatusRead["unmoved"]> {
  let nexuses: string[];
  try { nexuses = unmovedFloorRows((await readControlHome(opts.repo, await opts.repo.find<LarDoc>(bootstrapDaemonUrl() as AutomergeUrl))).doc()); }
  catch { return undefined; }
  return nexuses.length > 0 ? { word: FLOOR_PIN_UNMOVED, nexuses, cure: FLOOR_REHOME_CURE } : undefined;
}

/**
 * The Nexus part of the status: the accept read through the accept home where the floor key stands; where it does not, the
 * board read against genesis with the carried showing beside it (`carried-unaccepted`), so a herm or a locked hearth still
 * answers what it carries and why it accepts none.
 */
async function nexusPartOf(opts: NodeFloorOptions): Promise<Pick<FloorStatusRead, "standing" | "unavailable" | "carried"> & { readonly status: FloorStatus }> {
  try {
    const status = await readFloorStatus(await nodeFloorPorts(opts));
    return { status, standing: status.acceptSource === "accepted" ? "accepted" : "genesis" };
  } catch (e) {
    if (!(e instanceof FloorUnavailable)) throw e;
    // No floor key: read the board against genesis through a home that holds nothing, and show what the place carries.
    const ports = await nodeFloorPorts({ ...opts, unkeyed: true });
    const status = await readFloorStatus(ports);
    const carried = await carriedFloorOf({
      rows: ports.rows, nexus: ports.nexus, genesisManifest: ports.genesisManifest, requiredBlobIds: ports.requiredBlobIds,
      fetchLocal: async (cid) => readVerifiedCasBlobFromFs(cid, opts.casDir), stage: ports.stage,
    });
    return { status, unavailable: e.refusal, ...(carried ? { carried } : {}), standing: carried?.cid ? "carried-unaccepted" : "genesis" };
  }
}

/** `lares vessel floor status`: both truths for every place, and the Nexus part where a charter stands. */
export async function runFloorStatus(opts: NodeFloorOptions): Promise<FloorStatusRead> {
  let part: Awaited<ReturnType<typeof nexusPartOf>> | null = null;
  let nexusRefused: FloorRefused | null = null;
  try { part = await nexusPartOf(opts); }
  catch (e) { if (!(e instanceof FloorRefused && e.refusal === "floor-no-charter")) throw e; nexusRefused = e; }
  const status = part?.status ?? null;
  // A store with no island has no founding record to read: the Nexus refusal (where one stands) names the place first.
  let island: LarDoc | undefined;
  try { island = (await storedGenesisIsland(opts.repo)).doc(); }
  catch (e) { throw nexusRefused ?? e; }
  if (!island) throw nexusRefused ?? new FloorRefused("floor-no-genesis", "this vessel's oracle island reads empty");
  const mounted = part?.standing === "carried-unaccepted" && part.carried?.cid ? part.carried.cid : status?.accepted.manifest ?? null;
  const floorAccept = mounted ? acceptedFloorOf(mounted, opts.casDir) : null;
  const truths = readFoundingRecordTruths({ record: island, genesisDir: opts.genesisDir ?? daemonGenesisDir(), floorAccept });
  const acceptNote = nexusRefused
    ? "none — this place stands in no Nexus charter, so the founding record's genesis floor serves"
    : `${mounted ?? "?"} does not read from this vessel's CAS`;
  const genesis = { ...truths, line: foundingRecordLine(truths, { acceptNote }) };
  const reading = await nodeFloorDrift(opts, mounted ?? genesisFloorCidOf(island));
  const drift = { floorDrift: reading.drift, ...(reading.why !== undefined ? { floorDriftWhy: reading.why } : {}) };
  const shadowRead = opts.storageDir !== undefined ? readFloorShadowFileTold(opts.storageDir) : { tally: null };
  const floorShadow = shadowRead.tally;
  const drifts = readFloorDrifts({
    canon: { drift: reading.drift, ...(reading.why !== undefined ? { why: reading.why } : {}) },
    seed: truths.seed, ...(truths.unread !== undefined ? { seedWhy: `the founding record reads unread here (${truths.unread})` } : {}),
    shadow: floorShadow, ...("corrupt" in shadowRead && shadowRead.corrupt ? { shadowWhy: shadowRead.corrupt } : {}), lag: undefined,
  });
  const unmoved = await unmovedOf(opts);
  const tail = { drifts, floorShadow, ...("corrupt" in shadowRead && shadowRead.corrupt ? { floorShadowWhy: shadowRead.corrupt } : {}), ...(unmoved ? { unmoved } : {}) };
  if (nexusRefused || part === null) return { genesis, nexusRefused: { refusal: nexusRefused?.refusal ?? "floor-no-charter", message: nexusRefused?.message ?? "" }, ...drift, ...tail };
  const standing = { ...(part.standing ? { standing: part.standing } : {}), ...(part.unavailable ? { unavailable: part.unavailable } : {}), ...(part.carried ? { carried: part.carried } : {}) };
  return { ...part.status, ...standing, genesis, ...drift, ...tail };
}

/**
 * `lares vessel floor rehome`: the hand moves each retired row out of the control document into the accept home, once, with
 * one receipt per Nexus (`floor-rehome`). The control document must open (a hand at an unlocked place) and the floor key must
 * stand; the accept home mints where none stood. A second run lands nothing. No boot runs this.
 */
export async function runFloorRehome(opts: NodeFloorOptions): Promise<{ readonly receipts: readonly FloorRehomeReceipt[] }> {
  const daemon = await opts.repo.find<LarDoc>(bootstrapDaemonUrl() as AutomergeUrl);
  let control: DocHandle<LarDoc>;
  try { control = await readControlHome(opts.repo, daemon); }
  catch (e) {
    // A place that names no control document holds no retired row: nothing waits, nothing moves.
    if (e instanceof ControlHomeUnavailable && e.refusal === CONTROL_HOME_UNNAMED) return { receipts: [] };
    throw new FloorRefused("floor-rehome-unread", `the control document holds the retired rows and reads unread (${e instanceof Error ? e.message : String(e)}); open it with \`lares vault unlock\`, then run \`${FLOOR_REHOME_CURE}\` again`); }
  if (unmovedFloorRows(control.doc()).length === 0) return { receipts: [] };
  const reading = await floorKeyOf(opts);
  const accepts = await standFloorAcceptHome(opts.repo, daemon, { mint: true, floorKey: () => reading });
  const island = (await storedGenesisIsland(opts.repo)).doc();
  const required = floorRequiredBlobIds(island?.blobs);
  const vesselKey = await loadVesselVerifyingKey();
  const receipts = await rehomeFloorRows({
    control, accepts: accepts!,
    heads: async (nexus) => {
      const home = charterHomeFor(opts.sealHome, nexus) ?? opts.sealHome;
      if (nexusAidOf(readNexusDoc(home)) !== nexus) return [];
      const board = await materializeSharedLarDoc(opts.repo, publicationDocUrl(nodeNexusIsland({ ownVesselKey: vesselKey, sealHome: home })), "board:publication");
      return boardHeadsOf({ nexus, rows: async () => floorReleaseEntriesFromBoard(board.doc()), fetchCas: async (cid) => readVerifiedCasBlobFromFs(cid, opts.casDir) });
    },
    whole: async (manifest) => {
      const whole = await resolveFloorWhole(manifest, async (cid) => readVerifiedCasBlobFromFs(cid, opts.casDir), { required });
      return "refusal" in whole ? `${whole.refusal}: ${whole.reason}` : null;
    },
  });
  return { receipts };
}

/** `lares vessel floor accept [<release-cid>]`: the outcome, and the live wikis the alert reached. */
export async function runFloorAccept(opts: NodeFloorOptions & { readonly target?: string }): Promise<FloorAcceptOutcome & { readonly alerted: readonly string[] }> {
  const ports = await nodeFloorPorts({ ...opts, mint: true });
  const out = await acceptFloorRelease(ports, opts.target);
  await ports.land();
  return { ...out, alerted: ports.alerted };
}

/**
 * `lares vessel floor adopt [--apply | --commit | --revert]` (3d, follow-lei S2): the seed the genesis dir offers, adopted over the
 * accept's base as a local floor. `seedFloor` names the seed's floor manifest (its genesis witness) and `seedCid` the receipt; the
 * vessel reads both floors from its own CAS (the boot mirrors a newer seed's blobs there). Bare it previews; `apply` lands it.
 */
export async function runFloorAdopt(opts: NodeFloorOptions & { readonly seedCid: string; readonly seedFloor: string; readonly apply: boolean }): Promise<FloorAdoptOutcome & { readonly alerted: readonly string[] }> {
  const ports = await nodeFloorPorts({ ...opts, mint: opts.apply });
  const out = await adoptFloorSeed(ports, { seedCid: opts.seedCid, seedFloor: opts.seedFloor, apply: opts.apply });
  await ports.land();
  return { ...out, alerted: ports.alerted };
}

/** `floor adopt --commit | --revert`: the local floor settles by the hand's act, a forward row either way. */
export async function runFloorSettle(opts: NodeFloorOptions & { readonly act: "commit" | "revert" }): Promise<FloorLocalAct & { readonly prior?: FloorAccept }> {
  const ports = await nodeFloorPorts(opts);
  return settleLocalFloor(ports, opts.act);
}
