/**
 * browser-floor-pin — the browser vessel's binding of the ONE floor pin seam (`@lararium/mesh` `floor-pin`).
 *
 * The vessel pins the floor (w26-floor-lane#/the-vessel-pin): the browser reads the same pin, from the same control-home
 * row, and decides status and accept through the same mesh functions the node calls. Only the substrate forks:
 *
 *   · `home`     — the vessel's control document, as the boot stood it; none stood (a locked or faceless vessel) refuses
 *                  `floor-control-unread` by name, saying why;
 *   · `rows`     — the hearth's porch answer (`GET <origin>/floor/<AID>`), read by the mesh's own row reader;
 *   · `fetchCas` — this vessel's OPFS CAS, then the porch's (`<origin>/cas/<cid>`); every byte re-hashes in the mesh;
 *   · `stage`    — the OPFS CAS the wiki islands read, so the next island boot resolves the accepted floor;
 *   · `mount`    — no browser island swaps its `@oracle` read-face live, so an accept raises the reboot-pending alert in the
 *                  live wikis.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/w26-floor-lane#/the-vessel-pin
 */
import {
  acceptFloorRelease, floorAnswerRows, readFloorStatus, sha256HexBytesSync,
  type FloorAcceptOutcome, type FloorPinHome, type FloorPinPorts, type FloorRemount, type FloorStatus,
} from "@lararium/mesh";
import { OPFS_CAS_DIR, readCasBlobFromOpfs } from "./browser-genesis.js";
import { floorNexusOf, porchOriginOf } from "./browser-floor-read.js";

/** A floor door the browser cannot run, and why. */
export interface BrowserFloorRefusal {
  readonly ok: false;
  readonly refusal: "floor-no-nexus" | "floor-control-unread" | "floor-no-genesis" | "floor-porch-silent";
  readonly detail: string;
}

export interface BrowserFloorBinding {
  /** The control document the boot stood, or null where none stands. */
  readonly home:            () => FloorPinHome | null;
  /** The Nexus the page holds for this hearth, pin-spelled (hex of the AID's UTF-8). */
  readonly nexusPin:        string | null | undefined;
  readonly baseUrl:         string;
  readonly genesisManifest: string | null;
  readonly raiseAlert:      (remount: Extract<FloorRemount, { act: "alert" }>) => Promise<readonly string[]> | readonly string[];
  readonly fetchFn?:        typeof fetch;
  /** The local CAS: OPFS by default. */
  readonly readLocal?:      (cid: string) => Promise<Uint8Array | null>;
  readonly writeLocal?:     (blobs: ReadonlyArray<{ readonly cid: string; readonly bytes: Uint8Array }>) => Promise<void>;
}

/** Write blobs into the OPFS CAS the wiki islands read, each keyed by its CID. */
async function writeBlobsOpfs(blobs: ReadonlyArray<{ readonly cid: string; readonly bytes: Uint8Array }>): Promise<void> {
  const root = await navigator.storage.getDirectory();
  const cas = await root.getDirectoryHandle(OPFS_CAS_DIR, { create: true });
  for (const { cid, bytes } of blobs) {
    const fileH = await cas.getFileHandle(cid, { create: true }) as FileSystemFileHandle & { createWritable(): Promise<FileSystemWritableFileStream> };
    const w = await fileH.createWritable();
    await w.write(bytes.slice());
    await w.close();
  }
}

/** Bind the browser's substrate to the floor pin ports, or say why it cannot. */
export function browserFloorPorts(b: BrowserFloorBinding): (FloorPinPorts & { readonly alerted: string[] }) | BrowserFloorRefusal {
  const nexus = floorNexusOf(b.nexusPin);
  const origin = porchOriginOf(b.baseUrl);
  if (nexus === null || origin === null) return { ok: false, refusal: "floor-no-nexus", detail: "no Nexus AID is known for this hearth: the URL carries no floor card, and no face joined here names one" };
  const home = b.home();
  if (home === null) return { ok: false, refusal: "floor-control-unread", detail: "this vessel stood no control document: it stands locked, or wears no face, so it holds no pin to read or move" };
  if (b.genesisManifest === null) return { ok: false, refusal: "floor-no-genesis", detail: "this vessel's genesis seed names no floor" };
  const doFetch = b.fetchFn ?? globalThis.fetch.bind(globalThis);
  const readLocal = b.readLocal ?? readCasBlobFromOpfs;
  const alerted: string[] = [];
  return {
    alerted,
    home, nexus, genesisManifest: b.genesisManifest,
    rows: async () => {
      const res = await doFetch(`${origin}/floor/${nexus}`);
      if (!res.ok) throw new Error(`floor-porch-silent: the porch answered ${res.status}`);
      const opened = floorAnswerRows(await res.json(), nexus);
      if ("refusal" in opened) throw new Error(`floor-porch-silent: ${opened.refusal}`);
      return opened.rows;
    },
    fetchCas: async (cid) => {
      const local = await readLocal(cid).catch(() => null);
      if (local && sha256HexBytesSync(local) === cid) return local;
      const res = await doFetch(`${origin}/cas/${cid}`).catch(() => null);
      return res?.ok ? new Uint8Array(await res.arrayBuffer()) : null;
    },
    stage: async (blobs) => { await (b.writeLocal ?? writeBlobsOpfs)(blobs); },
    mount: { floorSwap: false, alert: async (remount) => { alerted.push(...await b.raiseAlert(remount)); } },
  };
}

/** `floor status` on the browser: the same mesh read the node runs. */
export async function browserFloorStatus(b: BrowserFloorBinding): Promise<({ readonly ok: true } & FloorStatus) | BrowserFloorRefusal> {
  const ports = browserFloorPorts(b);
  if ("refusal" in ports) return ports;
  try { return { ok: true, ...(await readFloorStatus(ports)) }; }
  catch (e) { return { ok: false, refusal: "floor-porch-silent", detail: e instanceof Error ? e.message : String(e) }; }
}

/** `floor accept` on the browser: the same mesh decision, the outcome and the live wikis the alert reached. */
export async function browserFloorAccept(b: BrowserFloorBinding, target?: string):
  Promise<(FloorAcceptOutcome & { readonly alerted: readonly string[] }) | BrowserFloorRefusal> {
  const ports = browserFloorPorts(b);
  if ("refusal" in ports) return ports;
  try { return { ...(await acceptFloorRelease(ports, target)), alerted: ports.alerted }; }
  catch (e) { return { ok: false, refusal: "floor-porch-silent", detail: e instanceof Error ? e.message : String(e) }; }
}
