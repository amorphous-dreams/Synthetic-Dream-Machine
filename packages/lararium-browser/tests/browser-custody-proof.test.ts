/**
 * BROWSER CUSTODY PROOF: a locked store still answers whether a passphrase opens it, and the proof holds nothing
 * (lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift#/the-confirm-gate).
 *
 * Real IndexedDB, real scrypt, a disposable store per vector.
 *
 *   CP1 RED  THE FOUR STATES. A bare floor (no tree) reads `bare` and proves `unverifiable`; a place tree sealed and
 *            UNLOCKED on this thread proves the right passphrase `opens` and a wrong one `no-slot-opens`; the same store
 *            LOCKED answers the very same two readings (the proof never reads this thread's held keys); a store that holds
 *            a face's tree alone (a joined face, no place passphrase) proves by that face's own route.
 *            CONTROL: the locked store's own readers refuse `sealed-locked`, so the lock stood while the proof answered.
 *   CP2 RED  THE PROOF WRITES NOTHING AND UNLOCKS NOTHING: a census of every keystore row reads byte-identical across a
 *            wrong try and a right one, and the store's custody reads locked after both.
 *   CP3      TORN CUSTODY: a sealed row with no tree reads `torn`; a tree whose bytes do not decode counts as standing and
 *            unreadable, and proves `unverifiable` for any route. CONTROL: the same store read `held` and readable before
 *            the fault was planted.
 *   CP4      THE WELD: the proof module's row names equal the two custody modules' own.
 *   CP5      A DATABASE WITH NO KEYSTORE reads bare, and the read creates no store in it (the open names no version).
 */
import { expect, test } from "vitest";
import {
  BrowserCustodyRefused, CUSTODY_TREE_ROW, lockBrowserCustody, readBrowserCustody, readKeystoreRow, sealBrowserKeystore, SEALED_ROW_PREFIX,
} from "../src/browser-custody.js";
import { bindFirstFaceSlot, FACE_SEALED_PREFIX, FACE_TREE_PREFIX, lockFaceCustody } from "../src/browser-face-custody.js";
import {
  custodyStandingOf, PROOF_FACE_TREE_PREFIX, PROOF_KEYSTORE, PROOF_PLACE_TREE_ROW, PROOF_SEALED_PREFIXES, proveCustodyRoute, readCustodyStanding, readCustodyTrees,
} from "../src/browser-custody-proof.js";
import { openVesselIdb } from "../src/browser-vessel-identity.js";
import { WARD_ROW_PREFIX } from "../src/ward-core.js";

const RIGHT = { kind: "passphrase", passphrase: "the holder's own passphrase" } as const;
const WRONG = { kind: "passphrase", passphrase: "somebody else's guess" } as const;
const fresh = (): string => `lares:proof-${crypto.randomUUID()}`;

/** Every keystore row as its bytes or JSON, so a refusal can prove it wrote nothing. */
async function census(idbName: string): Promise<Record<string, string>> {
  const db = await openVesselIdb(idbName);
  try {
    const store = db.transaction("keystore", "readonly").objectStore("keystore");
    const keys = await new Promise<IDBValidKey[]>((resolve, reject) => { const r = store.getAllKeys(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const out: Record<string, string> = {};
    for (const key of keys) {
      const value = await new Promise<unknown>((resolve, reject) => { const r = store.get(key); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
      out[String(key)] = value instanceof Uint8Array ? [...value].join(",") : JSON.stringify(value);
    }
    return out;
  } finally { db.close(); }
}
async function put(idbName: string, row: string, value: Uint8Array): Promise<void> {
  const db = await openVesselIdb(idbName);
  try {
    const tx = db.transaction("keystore", "readwrite");
    tx.objectStore("keystore").put(value, row);
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
  } finally { db.close(); }
}

test("CP1 RED the four states: bare, sealed and unlocked, sealed and locked, a joined face alone; CONTROL: the lock stood while the proof answered", { timeout: 120_000 }, async () => {
  // A BARE FLOOR: the store stands, nothing sealed.
  const bare = fresh();
  (await openVesselIdb(bare)).close();
  expect(await readCustodyStanding(bare)).toEqual({ reading: "bare" });
  expect(await proveCustodyRoute(bare, [RIGHT])).toEqual({ reading: "unverifiable", trees: 0 });

  // CUSTODY STANDING AND UNLOCKED: the seal leaves this thread unlocked.
  const place = fresh();
  await sealBrowserKeystore(place, RIGHT);
  expect(await readBrowserCustody(place)).toMatchObject({ reading: "sealed", unlocked: true });
  expect(await readCustodyStanding(place)).toEqual({ reading: "held", trees: 1 });
  expect(await readCustodyTrees(place)).toEqual({ trees: 1, readable: 1 });
  const open = { right: await proveCustodyRoute(place, [RIGHT]), wrong: await proveCustodyRoute(place, [WRONG]) };
  expect(open).toEqual({ right: { reading: "opens", trees: 1 }, wrong: { reading: "no-slot-opens", trees: 1 } });

  // CUSTODY STANDING AND LOCKED: the same store, this thread's key dropped. The proof answers the very same readings.
  lockBrowserCustody(place);
  expect(await readBrowserCustody(place)).toMatchObject({ reading: "sealed", unlocked: false });
  // CONTROL: the lock stood. A reader of the sealed store refuses by name.
  const refused = await readKeystoreRow(place, "vessel-key").catch((e: unknown) => e);
  expect(refused).toBeInstanceOf(BrowserCustodyRefused);
  expect((refused as BrowserCustodyRefused).reading).toBe("sealed-locked");
  const locked = { right: await proveCustodyRoute(place, [RIGHT]), wrong: await proveCustodyRoute(place, [WRONG]) };
  expect(locked, "a locked store answers as an unlocked one does").toEqual(open);
  expect(await readBrowserCustody(place), "the proof unlocked nothing").toMatchObject({ reading: "sealed", unlocked: false });

  // A JOINED FACE ALONE: no place passphrase stands, one face's own tree does. Its route proves; the face stays locked.
  const joined = fresh();
  await bindFirstFaceSlot(joined, "persona-group-joined", RIGHT);
  lockFaceCustody(joined, "persona-group-joined");
  expect(await readBrowserCustody(joined)).toEqual({ reading: "clear" });
  expect(await readCustodyStanding(joined)).toEqual({ reading: "held", trees: 1 });
  expect(await proveCustodyRoute(joined, [RIGHT])).toEqual({ reading: "opens", trees: 1 });
  expect(await proveCustodyRoute(joined, [WRONG])).toEqual({ reading: "no-slot-opens", trees: 1 });
});

test("CP2 RED the proof writes nothing and unlocks nothing: the keystore reads byte-identical across a wrong try and a right one", { timeout: 120_000 }, async () => {
  const idbName = fresh();
  await sealBrowserKeystore(idbName, RIGHT);
  await bindFirstFaceSlot(idbName, "persona-group-a", { kind: "passphrase", passphrase: "the face's own route" });
  lockBrowserCustody(idbName);
  lockFaceCustody(idbName, "persona-group-a");
  const before = await census(idbName);
  expect(Object.keys(before)).toContain(CUSTODY_TREE_ROW);
  expect(await proveCustodyRoute(idbName, [WRONG])).toEqual({ reading: "no-slot-opens", trees: 2 });
  expect(await census(idbName), "a wrong try wrote nothing").toEqual(before);
  // Either tree's own route proves a holder: the place's, and the face's.
  expect(await proveCustodyRoute(idbName, [RIGHT])).toEqual({ reading: "opens", trees: 1 });
  expect(await proveCustodyRoute(idbName, [{ kind: "passphrase", passphrase: "the face's own route" }])).toEqual({ reading: "opens", trees: 2 });
  expect(await census(idbName), "a right try wrote nothing").toEqual(before);
  expect(await readBrowserCustody(idbName), "and unlocked nothing").toMatchObject({ reading: "sealed", unlocked: false });
});

test("CP3 torn custody: a sealed row with no tree reads torn; an undecodable tree stands unreadable and proves unverifiable; CONTROL: it read held and readable first", { timeout: 120_000 }, async () => {
  const torn = fresh();
  await put(torn, `${SEALED_ROW_PREFIX}vessel-key`, new Uint8Array([1, 2, 3]));
  expect(await readCustodyStanding(torn)).toEqual({ reading: "torn", rows: 1 });
  expect(await readCustodyTrees(torn)).toEqual({ trees: 0, readable: 0 });

  const idbName = fresh();
  await sealBrowserKeystore(idbName, RIGHT);
  // CONTROL: before the fault, the tree reads and the route opens.
  expect(await readCustodyTrees(idbName)).toEqual({ trees: 1, readable: 1 });
  expect((await proveCustodyRoute(idbName, [RIGHT])).reading).toBe("opens");
  await put(idbName, CUSTODY_TREE_ROW, new TextEncoder().encode("{ not a slot tree"));
  expect(await readCustodyStanding(idbName), "the row still stands").toEqual({ reading: "held", trees: 1 });
  expect(await readCustodyTrees(idbName)).toEqual({ trees: 1, readable: 0 });
  expect(await proveCustodyRoute(idbName, [RIGHT])).toEqual({ reading: "unverifiable", trees: 0 });
});

test("CP4 the weld: the proof's row names equal the custody modules' own", () => {
  expect(PROOF_PLACE_TREE_ROW).toBe(CUSTODY_TREE_ROW);
  expect(PROOF_FACE_TREE_PREFIX).toBe(FACE_TREE_PREFIX);
  expect([...PROOF_SEALED_PREFIXES].sort()).toEqual([SEALED_ROW_PREFIX, FACE_SEALED_PREFIX, WARD_ROW_PREFIX].sort());
  expect(PROOF_KEYSTORE).toBe("keystore");
  expect(custodyStandingOf(["catalog-url", "face-index"])).toEqual({ reading: "bare" });
  expect(custodyStandingOf(["catalog-url", `${FACE_TREE_PREFIX}00ff`, `${FACE_SEALED_PREFIX}00ff/anchor`])).toEqual({ reading: "held", trees: 1 });
  expect(custodyStandingOf([`${WARD_ROW_PREFIX}root/00ff/tree`])).toEqual({ reading: "torn", rows: 1 });
});

test("CP5 a database with no keystore reads bare, and the read creates no store in it", async () => {
  const other = `another-hand-${crypto.randomUUID()}`;
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(other, 3);
    request.onupgradeneeded = () => { request.result.createObjectStore("documents"); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  expect(await readCustodyStanding(other)).toEqual({ reading: "bare" });
  expect(await readCustodyTrees(other)).toEqual({ trees: 0, readable: 0 });
  expect(await proveCustodyRoute(other, [RIGHT])).toEqual({ reading: "unverifiable", trees: 0 });
  const again = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open(other); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
  expect({ version: again.version, stores: [...again.objectStoreNames] }, "the proof's open upgraded nothing").toEqual({ version: 3, stores: ["documents"] });
  again.close();
  indexedDB.deleteDatabase(other);
  // A name no database answers to mints none.
  const absent = `nobody-${crypto.randomUUID()}`;
  expect(await readCustodyStanding(absent)).toEqual({ reading: "bare" });
  if (typeof indexedDB.databases === "function") expect((await indexedDB.databases()).map((d) => d.name)).not.toContain(absent);
});
