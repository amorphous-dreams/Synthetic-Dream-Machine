/**
 * browser-floor-accept — the browser vessel's binding of the ONE floor accept seam (`@lararium/mesh` `floor-accept`).
 *
 * The place accepts the floor (residency-tiers#/floor-accept): the browser reads the same accept, from the same accept-home
 * row, and decides status and accept through the same mesh functions the node calls. Only the substrate forks:
 *
 *   · `home`     — the place's accept home, sealed under the floor's rest key and needing no face; a floor key that does not
 *                  stand refuses `floor-unavailable` by its name (`vessel-locked`: unlock this browser), and a home not yet
 *                  named reads genesis and mints only where a hand's accept writes (`mintOnWrite`);
 *   · `rows`     — the hearth's porch answer (`GET <origin>/floor/<AID>`), read by the mesh's own row reader;
 *   · `fetchCas` — this vessel's OPFS CAS, then the porch's (`<origin>/cas/<cid>`); every byte re-hashes in the mesh;
 *   · `stage`    — the OPFS CAS the wiki islands read, so the next island boot resolves the accepted floor;
 *   · `mount`    — no browser island swaps its `@oracle` read-face live, so an accept raises the reboot-pending alert in the
 *                  live wikis.
 *
 * Meme: lar:///ha.ka.ba/lararium/api/residency-tiers#/floor-accept
 */
import {
  acceptFloorRelease,
  readFloorStatus,
  type FloorAcceptOutcome,
  type FloorAcceptHome,
  type FloorAcceptPorts,
  type FloorRemount,
  type FloorStatus,
} from "@lararium/mesh/floor-accept";
import { mintOnWrite } from "@lararium/mesh/floor-accept-home";
import type { FloorKeyRefusal } from "@lararium/mesh/floor-registry";
import { floorAnswerEntries } from "@lararium/mesh/floor-answer";
import { sha256HexBytesSync } from "@lararium/mesh/crypto";
import { OPFS_CAS_DIR, readCasBlobFromOpfs } from "./browser-genesis.js";
import { floorNexusOf, porchOriginOf } from "./browser-floor-read.js";

/** A floor door the browser cannot run, and why. */
export interface BrowserFloorRefusal {
  readonly ok: false;
  readonly refusal: "floor-no-nexus" | "floor-unavailable" | "floor-no-genesis" | "floor-porch-silent";
  readonly detail: string;
}

export interface BrowserFloorBinding {
  /** The place's accept home: the home, a refusal by the floor key's name, or null where none stands named yet. */
  readonly home:            () => Promise<FloorAcceptHome | { readonly unavailable: FloorKeyRefusal } | null>;
  /** Mint the accept home (enrolled under the floor key before its first byte): a hand's landed write alone calls it. */
  readonly mintHome:        () => Promise<FloorAcceptHome>;
  /** The Nexus the page holds for this hearth, pin-spelled (hex of the AID's UTF-8). */
  readonly nexusPin:        string | null | undefined;
  readonly baseUrl:         string;
  readonly genesisManifest: string | null;
  /** The blob ids every mount needs, off this vessel's island (`floorRequiredBlobIds`). */
  readonly requiredBlobIds: readonly string[];
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

const NO_ACCEPTS: FloorAcceptHome = Object.freeze({ doc: () => undefined, change: () => { throw new Error("floor-accept-home-unnamed: no accept home stands named; a hand's accept mints it"); } });

/** Bind the browser's substrate to the floor accept ports, or say why it cannot. `mint`: a hand's act mints the home on write. */
export async function browserFloorPorts(b: BrowserFloorBinding, opts: { readonly mint?: boolean } = {}): Promise<(FloorAcceptPorts & { readonly alerted: string[]; land(): Promise<void> }) | BrowserFloorRefusal> {
  const nexus = floorNexusOf(b.nexusPin);
  const origin = porchOriginOf(b.baseUrl);
  if (nexus === null || origin === null) return { ok: false, refusal: "floor-no-nexus", detail: "no Nexus AID is known for this hearth: the URL carries no floor card, and no face joined here names one" };
  const read = await b.home();
  if (read !== null && "unavailable" in read) {
    return { ok: false, refusal: "floor-unavailable", detail: read.unavailable === "vessel-locked"
      ? "vessel-locked: this browser's keystore stays shut, so the floor's rest key derives from nothing until it unlocks"
      : "floor-unkeyed: this place derives no floor key, so it carries the floor and accepts none" };
  }
  const minted = opts.mint === true ? mintOnWrite(read, b.mintHome) : null;
  const home = minted?.home ?? read ?? NO_ACCEPTS;
  if (b.genesisManifest === null) return { ok: false, refusal: "floor-no-genesis", detail: "this vessel's genesis seed names no floor" };
  const doFetch = b.fetchFn ?? globalThis.fetch.bind(globalThis);
  const readLocal = b.readLocal ?? readCasBlobFromOpfs;
  const alerted: string[] = [];
  return {
    alerted,
    land: async () => { await minted?.land(); },
    home, nexus, genesisManifest: b.genesisManifest, requiredBlobIds: b.requiredBlobIds,
    rows: async () => {
      const res = await doFetch(`${origin}/floor/${nexus}`);
      if (!res.ok) throw new Error(`floor-porch-silent: the porch answered ${res.status}`);
      const opened = floorAnswerEntries(await res.json(), nexus);
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
  const ports = await browserFloorPorts(b);
  if ("refusal" in ports) return ports;
  try { return { ok: true, ...(await readFloorStatus(ports)) }; }
  catch (e) { return { ok: false, refusal: "floor-porch-silent", detail: e instanceof Error ? e.message : String(e) }; }
}

/** `floor accept` on the browser: the same mesh decision, the outcome and the live wikis the alert reached. */
export async function browserFloorAccept(b: BrowserFloorBinding, target?: string):
  Promise<(FloorAcceptOutcome & { readonly alerted: readonly string[] }) | BrowserFloorRefusal> {
  const ports = await browserFloorPorts(b, { mint: true });
  if ("refusal" in ports) return ports;
  try {
    const out = await acceptFloorRelease(ports, target);
    await ports.land();
    return { ...out, alerted: ports.alerted };
  }
  catch (e) { return { ok: false, refusal: "floor-porch-silent", detail: e instanceof Error ? e.message : String(e) }; }
}
