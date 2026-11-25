/**
 * doc-census-door — the vessel's own read of every document its stores hold (`lares vessel census --docs`).
 *
 * The vessel owns its hearth, so the census walks the stores from inside the vessel and never from the host: the root
 * store at the storage dir, and each island store beside it (a folder holding the two-character shards a store rests;
 * road (b) may leave none, and the census reads a house with or without them). Each document counts its bytes, its
 * clear and sealed chunks, its sync states and its stranded temps, and reads by the one census (`censusDocuments`):
 * a live handle's document first, then the clear chunks at rest, then the sealed rest under the worn session, bounded,
 * so a sealed document no session opens reads `sealed-unread` and never hangs the read.
 *
 * Read-only: it opens no file for writing, removes nothing, and hands no body out (`doc-census`).
 *
 * Canon: lar:///ha.ka.ba/kahua/memory/research/stable-house#/crud
 */
import { readdirSync, readFileSync, statSync, type Stats } from "node:fs";
import { join } from "node:path";
import { capMintsAll } from "@lararium/mesh/mint-census";
import {
  censusDocuments,
  decodeChunks,
  type DocCensusReading,
  type DocContent,
  type DocRef,
  type StoreDocRow,
} from "@lararium/mesh/doc-census";
import { derivedDocAddresses } from "@lararium/mesh/deterministic-doc";

/** The root store's name in every census row. */
export const ROOT_STORE = "(root)";
/** Automerge's chunk magic: a chunk that opens with it rests clear. */
const AUTOMERGE_MAGIC = [0x85, 0x6f, 0x4a, 0x83] as const;
/** How long the sealed rest may take to open one document before it reads `sealed-unread`. */
export const SEALED_OPEN_MS = 3_000;

const stat = (p: string): Stats | null => { try { return statSync(p); } catch { return null; } };
const list = (p: string): string[] => { try { return readdirSync(p); } catch { return []; } };
const isShard = (name: string): boolean => name.length === 2 && !name.startsWith(".");
const isTemp = (name: string): boolean => name.endsWith(".tmp");
const readsClear = (bytes: Uint8Array): boolean => AUTOMERGE_MAGIC.every((b, i) => bytes[i] === b);

/** Every store under `storageDir`: the root, then each folder that rests shards of its own. */
export function censusStores(storageDir: string): Array<{ readonly name: string; readonly dir: string }> {
  const stores = [{ name: ROOT_STORE, dir: storageDir }];
  for (const name of list(storageDir).sort()) {
    if (isShard(name) || name.startsWith(".")) continue;
    const dir = join(storageDir, name);
    if (!stat(dir)?.isDirectory()) continue;
    if (list(dir).some((s) => isShard(s) && stat(join(dir, s))?.isDirectory())) stores.push({ name, dir });
  }
  return stores;
}

/** One store's documents: counts and bytes per document, read off the files at rest. */
export function walkStore(name: string, dir: string): StoreDocRow[] {
  const rows: StoreDocRow[] = [];
  for (const a of list(dir).sort()) {
    if (!isShard(a) || !stat(join(dir, a))?.isDirectory()) continue;
    for (const b of list(join(dir, a)).sort()) {
      const docDir = join(dir, a, b);
      if (!stat(docDir)?.isDirectory()) continue;
      let bytes = 0, clearChunks = 0, sealedChunks = 0, syncStates = 0, temps = 0;
      for (const kind of list(docDir)) {
        const kindDir = join(docDir, kind);
        if (!stat(kindDir)?.isDirectory()) continue;
        for (const f of list(kindDir)) {
          const s = stat(join(kindDir, f));
          if (!s?.isFile()) continue;
          bytes += s.size;
          if (isTemp(f)) { temps++; continue; }
          if (kind === "sync-state") { syncStates++; continue; }
          let head: Uint8Array;
          try { head = readFileSync(join(kindDir, f)).subarray(0, 4); } catch { continue; }
          if (readsClear(head)) clearChunks++; else sealedChunks++;
        }
      }
      rows.push({ id: a + b, store: name, bytes, clearChunks, sealedChunks, syncStates, temps });
    }
  }
  return rows;
}

/** The clear chunks a document rests in one store, as bytes (snapshots and incrementals, temps passed over). */
export function clearChunksAt(dir: string, id: string): Uint8Array[] {
  const docDir = join(dir, id.slice(0, 2), id.slice(2));
  const out: Uint8Array[] = [];
  for (const kind of ["snapshot", "incremental"]) {
    for (const f of list(join(docDir, kind)).sort()) {
      if (isTemp(f)) continue;
      try { const bytes = readFileSync(join(docDir, kind, f)); if (readsClear(bytes)) out.push(bytes); } catch { /* gone mid-walk */ }
    }
  }
  return out;
}

/** What the live composition lends the census. */
export interface DocCensusDoor {
  readonly storageDir: string;
  /** The live Repo: its open handles and its cap mints name documents. */
  readonly repo: { readonly handles: Record<string, { isReady(): boolean; doc(): unknown } | undefined> };
  /** The roles the composition knows documents by (`catalog`, `control`, `daemon`), by document id. */
  readonly roles: () => ReadonlyMap<string, string>;
  /** The composition's pointer names beside its handles: the catalog pointer and kin, by document id. */
  readonly pointers?: () => ReadonlyArray<{ readonly id: string } & DocRef>;
  /** Open one sealed document under the worn session (the sealed rest's own read); absent, a sealed document reads unread. */
  readonly openSealed?: (id: string) => Promise<Uint8Array[]>;
  /** The bound on one sealed open. */
  readonly sealedOpenMs?: number;
}

const idOfUrl = (url: string): string => url.replace(/^automerge:/, "").split("#")[0]!;

function bounded<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((done) => {
    const timer = setTimeout(() => done(null), ms);
    p.then((v) => { clearTimeout(timer); done(v); }, () => { clearTimeout(timer); done(null); });
  });
}

/** Read the census through the live composition's door. */
export async function readDocCensus(door: DocCensusDoor): Promise<DocCensusReading> {
  const stores = censusStores(door.storageDir);
  const dirOf = new Map(stores.map((s) => [s.name, s.dir]));
  const rows = stores.flatMap((s) => walkStore(s.name, s.dir));
  const named: Array<{ id: string } & DocRef> = [...(door.pointers?.() ?? [])];
  for (const [url, label] of derivedDocAddresses()) named.push({ id: idOfUrl(url), kind: "derived", by: label });
  for (const m of capMintsAll(door.repo)) named.push({ id: idOfUrl(m.url), kind: "cap-mint", by: m.cap });
  for (const [id, handle] of Object.entries(door.repo.handles)) if (handle) named.push({ id, kind: "live-handle", by: "the live Repo" });
  const read = async (row: StoreDocRow): Promise<DocContent> => {
    const handle = door.repo.handles[row.id];
    if (handle?.isReady()) {
      try { return { doc: handle.doc() ?? null, read: row.sealedChunks > 0 ? "opened" : "clear" }; } catch { /* read the rest */ }
    }
    if (row.sealedChunks === 0) {
      const chunks = clearChunksAt(dirOf.get(row.store)!, row.id);
      return chunks.length > 0 ? { doc: decodeChunks(chunks), read: "clear" } : { read: "unreadable" };
    }
    const opened = door.openSealed ? await bounded(door.openSealed(row.id), door.sealedOpenMs ?? SEALED_OPEN_MS) : null;
    if (opened === null || opened.length === 0) return { read: "sealed-unread" };
    try { return { doc: decodeChunks(opened), read: "opened" }; } catch { return { read: "sealed-unread" }; }
  };
  return censusDocuments({ rows, rootStore: ROOT_STORE, stores: stores.map((s) => s.name), named, roles: door.roles(), read });
}
