/**
 * browser-sealed-store — the browser island's rest for the sealed store, over IndexedDB.
 *
 * THE HOLDER LIVES BESIDE THE KEY SEAT. The browser's Keyhive identities stand in its daemon island, a thread the vessel
 * worker spawns, so the content-key holder stands there too (`operator-daemon-behavior` seats it where a shore names a
 * sealed store), and the island's start hands it this shore. No bare key crosses a port and none reaches IndexedDB.
 *
 * FOUR SHELVES, ONE DATABASE, as the node keeps four directories:
 *   rest     lockboxes, signed records and index rows, by `<kind>/<name>`: no secret, no name, no key in the clear.
 *   values   the sealed values themselves, by `blake3:` address; a value reads back only where its bytes still
 *            recompute to its address.
 *   staged   the cleartext-local tier a staged body reads from and an opened body lands in, by its plaintext's SHA-256.
 *   chunks   the Keyhive ciphertext each identity tracks per bag, by `<shelf>/<ref>`.
 *
 * A WRITE ANSWERS ONLY ONCE ITS TRANSACTION COMMITS, under strict durability, so a wrap that answered can open again
 * after a reload. A name that already rests keeps its bytes, for every kind but `own` (`@lararium/mesh`
 * `sealed-store-rest`): a name derives from the bytes it names, and an altered value gives way to bytes that hold it.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store · #/owed (the browser shore)
 */
import { isRestKind, isRestName, restNameHolds, sealedAddressOf, sha256HexBytesSync, type RestKind, type SealedStoreRest } from "@lararium/mesh";
import type { ProviderChunkRest } from "@lararium/keyhive";
import type { SealedStoreShore } from "@lararium/keyhive/operator-daemon-behavior";

const SHELVES = ["rest", "values", "staged", "chunks"] as const;
type Shelf = (typeof SHELVES)[number];

/** The sealed store's database for one vessel's face atom. */
export function sealedStoreDbName(atomKey: string): string {
  return `lares:sealed-store:${atomKey}`;
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
}

/** The IndexedDB shore the browser island hands its behaviour. */
export function idbSealedStoreShore(dbName: string): SealedStoreShore {
  let opened: Promise<IDBDatabase> | null = null;
  const db = (): Promise<IDBDatabase> => {
    opened ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = () => { for (const shelf of SHELVES) if (!req.result.objectStoreNames.contains(shelf)) req.result.createObjectStore(shelf); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { opened = null; reject(req.error); };
    });
    return opened;
  };
  const get = async (shelf: Shelf, key: string): Promise<Uint8Array | null> => {
    const got = await request((await db()).transaction(shelf, "readonly").objectStore(shelf).get(key));
    return got instanceof Uint8Array ? Uint8Array.from(got) : null;
  };
  const put = async (shelf: Shelf, key: string, bytes: Uint8Array): Promise<void> => {
    const tx = (await db()).transaction(shelf, "readwrite", { durability: "strict" });
    tx.objectStore(shelf).put(Uint8Array.from(bytes), key);
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = tx.onabort = () => reject(tx.error ?? new Error("browser-sealed-store: the write did not commit")); });
  };
  const keysUnder = async (shelf: Shelf, prefix: string): Promise<string[]> => {
    const keys = await request((await db()).transaction(shelf, "readonly").objectStore(shelf).getAllKeys());
    return keys.filter((key): key is string => typeof key === "string" && key.startsWith(prefix)).sort();
  };

  const rest: SealedStoreRest = {
    async put(kind, name, bytes) {
      if (!isRestKind(kind) || !isRestName(name)) throw new TypeError("browser-sealed-store: a rest kind and a name the store's own rule reads");
      if (kind !== "own") {
        const resting = await get("rest", `${kind}/${name}`);
        if (resting !== null && (restNameHolds(name, resting) || !restNameHolds(name, bytes))) return;
      }
      await put("rest", `${kind}/${name}`, bytes);
    },
    async get(kind: RestKind, name: string) {
      if (!isRestKind(kind) || !isRestName(name)) throw new TypeError("browser-sealed-store: a rest kind and a name the store's own rule reads");
      return get("rest", `${kind}/${name}`);
    },
    async list(kind, prefix = "") {
      if (!isRestKind(kind)) throw new TypeError("browser-sealed-store: an unknown rest kind names no shelf");
      return (await keysUnder("rest", `${kind}/`)).map((key) => key.slice(kind.length + 1)).filter((name) => isRestName(name) && name.startsWith(prefix));
    },
  };

  const chunks: ProviderChunkRest = {
    async put(shelf, refHex, ciphertext) { await put("chunks", `${hexName(shelf)}/${hexName(refHex)}`, ciphertext); },
    async list(shelf) {
      const out: { refHex: string; ciphertext: Uint8Array }[] = [];
      for (const key of await keysUnder("chunks", `${hexName(shelf)}/`)) {
        const ciphertext = await get("chunks", key);
        if (ciphertext !== null) out.push({ refHex: `0x${key.slice(key.indexOf("/") + 1)}`, ciphertext });
      }
      return out;
    },
    async drop(shelf) {
      const keys = await keysUnder("chunks", `${hexName(shelf)}/`);
      const tx = (await db()).transaction("chunks", "readwrite", { durability: "strict" });
      for (const key of keys) tx.objectStore("chunks").delete(key);
      await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = tx.onabort = () => reject(tx.error); });
    },
  };

  return {
    rest,
    chunks,
    values: {
      read: async (address) => {
        const bytes = await get("values", address);
        return bytes !== null && sealedAddressOf(bytes) === address ? bytes : null;
      },
      write: async (address, sealed) => {
        if (sealedAddressOf(sealed) !== address) throw new Error("browser-sealed-store: a sealed value rests only under the address its bytes hash to");
        await put("values", address, sealed);
      },
    },
    staged: {
      read: async (cid) => {
        const bytes = await get("staged", cid);
        return bytes !== null && sha256HexBytesSync(bytes) === cid ? bytes : null;
      },
      write: async (plaintext) => {
        const cid = sha256HexBytesSync(plaintext);
        await put("staged", cid, plaintext);
        return cid;
      },
    },
  };
}

const HEX = /^[0-9a-f]{1,128}$/;
/** A chunk shelf and a content reference read as hex alone, so no URL forms a key here. */
function hexName(id: string): string {
  const name = id.toLowerCase().replace(/^0x/, "");
  if (!HEX.test(name)) throw new TypeError("browser-sealed-store: a chunk shelf and a content reference read as hex alone");
  return name;
}
