import { placeSeed } from "./browser-place-seed.fixture.js";
/**
 * BROWSER CUSTODY: a passphrase seals the device seed and the Keyhive Archives the keystore keeps, and a mistyped
 * passphrase destroys nothing.
 *
 * Everything runs for real over the page's IndexedDB and WebCrypto; each vector stands on its own disposable store
 * (a fresh random idbName). `foundHalted()` founds a real vessel through `openBrowserVessel` and halts it at the
 * catalog, as the Archive vectors do. A "locked" keystore models a fresh page: `lockBrowserCustody` drops the key
 * from this page's memory. A census reads every keystore row (key -> bytes or JSON) so a refusal can prove it wrote
 * nothing.
 *
 *   BC1  THE ROW LAW: `isCustodyRow` names device, Archive, root and roster rows;
 *        `sealedCarrierOf` names the keystore carrier and its `sealed/` path.
 *   BC2  THE SEAL: one slot binds, every custody row moves to `sealed/<row>` under the house magic and its clear row
 *        leaves; `catalog-url` and every other row stand as they stood; the page stays unlocked. The status reads
 *        clear before (the control), sealed after; a second seal refuses `already-sealed`.
 *   BC3  an EMPTY keystore seals: the slot stands before any mint, and a mint made after it rests sealed.
 *   BC4  SEALED AND LOCKED: every reader refuses `sealed-locked` by name and nothing mints (the census stands);
 *        every writer refuses the same way and the sealed row stays byte-identical. Control: unlocked, they read.
 *   BC5  THE REFUSAL: a wrong passphrase answers `no-slot-opens` and the census stands identical; the right one then
 *        opens the slot the seal bound (the control: the refusal measured the passphrase).
 *   BC6  a clear with a wrong passphrase answers `no-slot-opens`, never asks through the confirm door, and the
 *        census stands identical.
 *   BC7  THE CONFIRM DOOR: the first ask parks and the act abandons with nothing written; the confirmed re-run
 *        clears, and every clear row comes back equal. Control: an answer of "no" leaves the keystore sealed.
 *   BC8  WHILE UNLOCKED a save re-seals: the sealed row changes, still opens to the new bytes after a lock and an
 *        unlock, and no clear row appears.
 *   BC9  a clear custody row beside the tree refuses `unsettled` naming the row; nothing is deleted.
 *   BC10 SLOTS: a second slot binds while unlocked and either passphrase opens; unbinding the first answers a
 *        rotation offer and its passphrase then opens nothing; the last slot never unbinds; a bind while locked
 *        refuses `sealed-locked`.
 *   BC11 THE SIDECAR LAW through the port: `browserKeystoreCustodyIo` is a mesh `CustodyIo` over the keystore. A
 *        sidecar that does not read back lands nothing (control: the same write through the honest port lands and
 *        opens), and the carrier the mesh writer sealed reads back through the browser reader once unlocked.
 *   BC12 THE REOPEN: a founded vessel seals and locks, its boot refuses `sealed-locked` before the catalog with the
 *        keystore untouched; unlocked, every reader returns the captured bytes and the same boot reaches the catalog
 *        with no clear custody row returned.
 *   BC13 THE SETTLE ARMS: a clear row beside the tree EQUAL to its sealed value settles on the next unlock and leaves;
 *        a DIFFERENT one stays unsettled with its why, and both rows stand byte-identical. Control: before the
 *        unlock, the reader names the planted row unsettled.
 *   BC14 a locked keystore sealed EMPTY refuses the seed read and the mint `sealed-locked`; the census and the
 *        continuity marker stand. Control: unlocked, the same mint lands.
 *   BC15 THE REFUSAL READINGS: a sealed row with no tree reads `torn-without-tree` (status `unreadable`); a garbage
 *        tree reads `tree-unreadable`; another vessel's frame in a sealed row reads `row-unopened`. Each writes
 *        nothing. Controls: each keystore read clear or opened before its fault was planted.
 *   BC16 A PAPER ROUTE: a 2-of-3 paper slot seals; any two sheets open; one sheet, or a passphrase, does not.
 *   BC17 THE DOOR'S LITERAL TRUE: a door answering a truthy non-boolean parks, writing nothing. Control: literal
 *        true clears.
 *   BC18 A NEWER SEAL BETWEEN PARK AND CONFIRM: the confirmed clear re-opens and carries the newer Archive into the
 *        clear. The newer value lands between passes through the confirm door.
 *   BC19 THE ACT LOCK: a confirmed clear holds row doors through each clear/sealed handoff; a burst of readers
 *        answers the device seed and Archive while the writer pauses before removing the first sealed carrier.
 *   BC20 THE STANDING CARRIER: a torn replacement sidecar leaves the sealed bytes intact and the old value opens.
 *   BC21 THE FREE QUESTION: the clear asks its confirm door with the act lock free, so a waiting person holds no row door.
 *   BC22 a persona-root mint without a slot refuses and writes no row; the device-key mint remains open.
 *   BC23 a bound slot seals the root and its roster; neither rests in the clear.
 *   BC24 a locked root read refuses before any row read; unlock returns the same seed.
 *   BC25 a confirmed clear returns the root and roster to clear rows and removes their carriers.
 *   BC27 a fresh schema stands the present stores and rests no worn-face pointer.
 *   BC28 the worn face is session state of one tab: it rests in no store, and a reload asks again.
 *
 * Meme: lar:///ha.ka.ba/lararium/browser/browser-custody
 */
import { describe, expect, test, vi } from "vitest";
import {
  bindSlot, commitSlotTree, confirmPaperPin, decodeSlotTree, draftPaperPin, mintTreeKey, openSealedCarrier, writeSealedCarrier, SEALING_SUFFIX,
  type CustodyIo,
} from "@lararium/mesh";
import { BootHalted } from "./wire-vessel-rig.js";
import { openBrowserVessel, type BrowserVesselOptions } from "../src/open-browser-vessel.js";
import {
  browserIdentityContinuityKey, generateOrLoadBrowserVesselIdentity, generateOrLoadBrowserPersonaRoot,
  loadBrowserPersonaRootSeed, listBrowserPersonaRoots, openVesselIdb, idbGet, idbPut, idbKeys, makeBrowserIdbPersonaVault, forgetWornFaceOfTab,
} from "../src/browser-vessel-identity.js";
import {
  loadBrowserVeilArchive, saveBrowserVeilArchive,
} from "../src/browser-keyhive-archive.js";
import { vesselLockName } from "../src/vessel-lock.js";
import {
  BrowserCustodyRefused, CLEAR_CUSTODY_QUESTION, CUSTODY_TREE_ROW, SEALED_ROW_PREFIX,
  bindBrowserCustodySlot, browserKeystoreCustodyIo, clearBrowserCustody, isCustodyRow, lockBrowserCustody,
  readBrowserCustody, readKeystoreRow, sealBrowserKeystore, sealedCarrierOf, unbindBrowserCustodySlot, unlockBrowserCustody,
  withCustodyRows, writeKeystoreRow,
  type BrowserCustodyRefusalReading, type ConfirmDoor,
} from "../src/browser-custody.js";

const STORE = "keystore";
const MAGIC = new TextEncoder().encode("lares-s-seal");
const PASS = { kind: "passphrase", passphrase: "the hearth keeps its fire" } as const;
const WRONG = { kind: "passphrase", passphrase: "wrong" } as const;
const loadMainArchive = (idbName: string) => loadBrowserVeilArchive(idbName, "group-main");
const saveMainArchive = (idbName: string, bytes: Uint8Array) => saveBrowserVeilArchive(idbName, "group-main", bytes);
const requireMainArchive = async (idbName: string) => {
  const held = await loadMainArchive(idbName);
  if (!held) throw new Error("main veil Archive absent");
  return held;
};
const CUSTODY_ROWS = ["veil-archive-ggroup-a", "veil-archive-ggroup-main", "vessel-key"] as const;
const SLOW = 120_000;

interface PersistedKey { readonly verifyingKey: string; readonly signingKey: string }

const hex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const randomBytes = (n: number): Uint8Array => crypto.getRandomValues(new Uint8Array(n));
const startsWithMagic = (v: unknown): boolean =>
  v instanceof Uint8Array && v.byteLength > MAGIC.byteLength && MAGIC.every((b, i) => v[i] === b);

async function rowOf(idbName: string, row: string): Promise<unknown> {
  const idb = await openVesselIdb(idbName);
  try { return await idbGet<unknown>(idb, STORE, row); } finally { idb.close(); }
}

async function plant(idbName: string, row: string, value: unknown): Promise<void> {
  const idb = await openVesselIdb(idbName);
  try { await idbPut(idb, STORE, row, value); } finally { idb.close(); }
}

/** Every keystore row as it rests: key -> `bytes:<hex>` for bytes, its JSON otherwise. */
async function census(idbName: string): Promise<Record<string, string>> {
  const idb = await openVesselIdb(idbName);
  try {
    const out: Record<string, string> = {};
    for (const key of (await idbKeys(idb, STORE)).sort()) {
      const v = await idbGet<unknown>(idb, STORE, key);
      out[key] = v instanceof Uint8Array ? `bytes:${hex(v)}` : `json:${JSON.stringify(v)}`;
    }
    return out;
  } finally { idb.close(); }
}

/** What a promise settles to: its refusal, or null when it resolved. */
const settleOf = (p: Promise<unknown>): Promise<unknown> => p.then(() => null, (e: unknown) => e);

async function expectRefused(p: Promise<unknown>, reading: BrowserCustodyRefusalReading, row?: string): Promise<void> {
  const e = await settleOf(p);
  expect(e, `expected BrowserCustodyRefused(${reading}); got ${String(e)}`).toBeInstanceOf(BrowserCustodyRefused);
  expect((e as BrowserCustodyRefused).reading, String(e)).toBe(reading);
  if (row !== undefined) expect((e as BrowserCustodyRefused).row, String(e)).toBe(row);
}

/** A custody-only store: a place key, two face veil rows, and a public catalog row. */
async function plantedVessel(tag: string) {
  const idbName = `custody-${tag}-${crypto.randomUUID()}`;
  await generateOrLoadBrowserVesselIdentity(idbName);
  const archive = randomBytes(96);
  const veil = randomBytes(80);
  await saveMainArchive(idbName, archive);
  await saveBrowserVeilArchive(idbName, "group-a", veil);
  await plant(idbName, "catalog-url", "automerge:planted-catalog");
  const key = (await rowOf(idbName, "vessel-key")) as PersistedKey;
  const seed = await placeSeed(idbName);
  return { idbName, archive, veil, key, seed };
}

async function foundedGroup(idbName: string): Promise<string> {
  const db = await openVesselIdb(idbName);
  try { return (await (async () => {
    const keys = await idbKeys(db, "keystore");
    const row = keys.find((k) => /^(?:sealed\/)?face-atom\//.test(k));
    return row!.replace(/^(?:sealed\/)?face-atom\//, "");
  })()); }
  finally { db.close(); }
}

/** Bind a founding slot, then found a browser vessel and halt once its catalog stands. */
async function foundHalted(): Promise<string> {
  const idbName = `custody-found-${crypto.randomUUID()}`;
  await generateOrLoadBrowserVesselIdentity(idbName);
  await sealBrowserKeystore(idbName, PASS);
  const opts = {
    idbName,
    onPhase: (phase: string) => { if (phase === "catalog-ready") throw new BootHalted(); },
  } as BrowserVesselOptions;
  await expect(openBrowserVessel(opts)).rejects.toBeInstanceOf(BootHalted);
  return idbName;
}

/**
 * A fresh page lets go of the vessel's Web Lock. A halted boot holds it for this page's life, so the test hands it
 * back by taking it over and releasing it at once; the vessel code under test never steals.
 *
 * This covers a PRE-EXISTING leak, owned by another lane: a refused or halted boot keeps the vessel Web Lock for the
 * page's life (`open-browser-vessel.ts` takes it through `holdVesselLock` and never releases it on a throw).
 */
async function pageLetsGo(idbName: string): Promise<void> {
  await navigator.locks.request(vesselLockName(idbName), { steal: true }, async () => { /* released at once */ });
}

/**
 * TiddlyWiki's `$tw.utils.confirm`, parked. The first ask parks (returns false). Once answered yes, the next ask
 * returns true once; once answered no, the next ask records the refusal and withdraws the question (returns false).
 * `outcomes` records what each ask met, so a "no" is told apart from a fresh park.
 */
function parkedDoor() {
  const asked: string[] = [];
  const outcomes: ("parked" | "yes" | "no")[] = [];
  let answer: boolean | null = null;
  const door: ConfirmDoor = (question) => {
    asked.push(question);
    if (answer === true) { answer = null; outcomes.push("yes"); return true; }
    if (answer === false) { answer = null; outcomes.push("no"); return false; }
    outcomes.push("parked");
    return false;
  };
  return { door, asked, outcomes, answerYes: () => { answer = true; }, answerNo: () => { answer = false; } };
}

describe("browser custody seals the keystore's device seed and Keyhive Archives", () => {
  test("BC29 every face-secret family takes a slot, seals and refuses a locked read", async () => {
    const idbName = `custody-secret-families-${crypto.randomUUID()}`;
    const pending = { offer: { kind: "fleet-join-offer" }, request: { kind: "fleet-join-request" }, sealSecret: "ab".repeat(32) };
    const values: Array<[string, unknown]> = [
      ["nexus-key/h0/nexus.synthetic", randomBytes(32)],
      ["vessel-face-key/nexus.synthetic|" + "ab".repeat(32), randomBytes(32)],
      ["fleet-join-secret/group", randomBytes(32)],
      ["fleet-join-pending/group", pending],
      ["walk/" + "cd".repeat(32), { nexusAid: "nexus.synthetic" }],
    ];
    for (const [row, value] of values) {
      await expectRefused(writeKeystoreRow(idbName, row, value), "no-custody-slot", row);
      expect(await rowOf(idbName, row)).toBeUndefined();
    }
    // CONTROL: a device seed row still stands clear before the slot binds.
    const seed = { verifyingKey: "ab".repeat(32), signingKey: "cd".repeat(32) };
    await writeKeystoreRow(idbName, "vessel-key", seed);
    expect(await readKeystoreRow(idbName, "vessel-key")).toEqual(seed);
    await sealBrowserKeystore(idbName, PASS);
    for (const [row, value] of values) {
      await writeKeystoreRow(idbName, row, value);
      expect(await readKeystoreRow(idbName, row)).toEqual(value);
      expect(await rowOf(idbName, row)).toBeUndefined();
      expect(startsWithMagic(await rowOf(idbName, `sealed/${row}`))).toBe(true);
    }
    lockBrowserCustody(idbName);
    for (const [row] of values) await expectRefused(readKeystoreRow(idbName, row), "sealed-locked", row);
    expect((await unlockBrowserCustody(idbName, [PASS])).reading).toBe("opens");
    for (const [row, value] of values) expect(await readKeystoreRow(idbName, row)).toEqual(value);
  }, SLOW);

  test("BC30 one custody act reads, decides and writes two rows; a thrown decision leaves its second row unwritten", async () => {
    const idbName = `custody-many-rows-${crypto.randomUUID()}`;
    await sealBrowserKeystore(idbName, PASS);
    const a = "nexus-key/h0/one.synthetic";
    const b = "nexus-key/h0/two.synthetic";
    const c = "nexus-key/h0/three.synthetic";
    const d = "nexus-key/h0/four.synthetic";
    const first = randomBytes(32);
    await withCustodyRows(idbName, async (rows) => {
      expect(await rows.read(a)).toBeUndefined();
      await rows.write(a, first);
      expect(await rows.read(b)).toBeUndefined();
      await rows.write(b, randomBytes(32));
    });
    expect(await readKeystoreRow(idbName, a)).toEqual(first);
    expect(await readKeystoreRow(idbName, b)).toBeInstanceOf(Uint8Array);
    // CONTROL: the first write in a body reaches its carrier before a later decision throws.
    await expect(withCustodyRows(idbName, async (rows) => {
      await rows.write(c, randomBytes(32));
      if ((await rows.read(c)) instanceof Uint8Array) throw new Error("decision refused");
      await rows.write(d, randomBytes(32));
    })).rejects.toThrow("decision refused");
    expect(await readKeystoreRow(idbName, c)).toBeInstanceOf(Uint8Array);
    expect(await readKeystoreRow(idbName, d)).toBeUndefined();
  }, SLOW);

  test("BC1 the row law: each custody shape has its sealed carrier", () => {
    for (const row of ["vessel-key", "veil-archive-ggroup-main", "veil-archive-ggroup-a", "veil-archive-ggroup-b", "persona-root-h0", "persona-root-h12", "persona-root-roster", "face-anchor/group-a"]) {
      expect(isCustodyRow(row), row).toBe(true);
    }
    for (const row of ["catalog-url", "veil-archive-h0", "veil-archive-g", "persona-root-hx", "sealed/vessel-key", "custody-slots", "vessel-key2", ""]) {
      expect(isCustodyRow(row), row).toBe(false);
    }
    expect(sealedCarrierOf("veil-archive-ggroup-main")).toEqual({ name: "browser-keystore/veil-archive-ggroup-main", path: "sealed/veil-archive-ggroup-main" });
    expect(sealedCarrierOf("vessel-key").path).toBe(`${SEALED_ROW_PREFIX}vessel-key`);
  });

  test("BC2 the seal moves every custody row into its sealed carrier and leaves the rest standing", async () => {
    const v = await plantedVessel("seal");
    await plant(v.idbName, "other-row", { kept: true });
    // CONTROL: before any seal the keystore reads clear and every custody row stands in the clear.
    expect(await readBrowserCustody(v.idbName)).toEqual({ reading: "clear" });
    const before = await census(v.idbName);
    for (const row of CUSTODY_ROWS) expect(before[row], row).toBeDefined();

    const { slot, sealed } = await sealBrowserKeystore(v.idbName, PASS);
    expect(typeof slot).toBe("string");
    expect([...sealed].sort()).toEqual([...CUSTODY_ROWS]);

    const after = await census(v.idbName);
    for (const row of CUSTODY_ROWS) {
      expect(after[row], `the clear ${row} row left`).toBeUndefined();
      expect(startsWithMagic(await rowOf(v.idbName, `sealed/${row}`)), `sealed/${row} bears the house magic`).toBe(true);
    }
    const tree = await rowOf(v.idbName, CUSTODY_TREE_ROW);
    expect(tree).toBeInstanceOf(Uint8Array);
    const reading = decodeSlotTree(tree as Uint8Array);
    expect(reading.reading).toBe("readable");
    if (reading.reading === "readable") expect(reading.tree.slots.map((s) => s.id)).toEqual([slot]);
    expect(after["catalog-url"]).toBe(before["catalog-url"]);
    expect(after["other-row"]).toBe(before["other-row"]);
    expect(Object.keys(after).sort()).toEqual(
      ["catalog-url", CUSTODY_TREE_ROW, "other-row", ...CUSTODY_ROWS.map((r) => `sealed/${r}`)].sort(),
    );

    // The page stays unlocked: the readers answer the bytes they held.
    expect(await readBrowserCustody(v.idbName)).toEqual({ reading: "sealed", unlocked: true, slots: [{ id: slot, t: 1, kinds: ["passphrase"] }] });
    expect(hex(await placeSeed(v.idbName))).toBe(hex(v.seed));
    expect(hex((await loadMainArchive(v.idbName))!)).toBe(hex(v.archive));

    await expectRefused(sealBrowserKeystore(v.idbName, PASS), "already-sealed");
    expect(await census(v.idbName), "a refused second seal writes nothing").toEqual(after);

    lockBrowserCustody(v.idbName);
    expect(await readBrowserCustody(v.idbName)).toEqual({ reading: "sealed", unlocked: false, slots: [{ id: slot, t: 1, kinds: ["passphrase"] }] });
  });

  test("BC3 an empty keystore seals, and a mint made after it rests sealed", async () => {
    const idbName = `custody-empty-${crypto.randomUUID()}`;
    expect(await readBrowserCustody(idbName)).toEqual({ reading: "clear" });
    const { slot, sealed } = await sealBrowserKeystore(idbName, PASS);
    expect(sealed).toEqual([]);
    expect(Object.keys(await census(idbName))).toEqual([CUSTODY_TREE_ROW]);
    expect(await readBrowserCustody(idbName)).toEqual({ reading: "sealed", unlocked: true, slots: [{ id: slot, t: 1, kinds: ["passphrase"] }] });

    // The slot stood before the mint, so the mint lands sealed.
    await generateOrLoadBrowserVesselIdentity(idbName);
    expect(await rowOf(idbName, "vessel-key"), "no clear device key").toBeUndefined();
    expect(startsWithMagic(await rowOf(idbName, "sealed/vessel-key"))).toBe(true);
    const seed = await placeSeed(idbName);
    expect(seed.byteLength).toBe(32);
    lockBrowserCustody(idbName);
    expect(await unlockBrowserCustody(idbName, [PASS])).toMatchObject({ reading: "opens", slot });
    expect(hex(await placeSeed(idbName))).toBe(hex(seed));
  });

  test("BC4 sealed and locked, every reader and writer refuses sealed-locked and nothing mints or moves", async () => {
    const v = await plantedVessel("locked");
    await sealBrowserKeystore(v.idbName, PASS);
    // CONTROL: unlocked, the same readers read.
    expect(hex(await placeSeed(v.idbName))).toBe(hex(v.seed));
    expect(hex((await loadBrowserVeilArchive(v.idbName, "group-a"))!)).toBe(hex(v.veil));

    lockBrowserCustody(v.idbName);
    const before = await census(v.idbName);
    await expectRefused(placeSeed(v.idbName), "sealed-locked");
    await expectRefused(loadMainArchive(v.idbName), "sealed-locked");
    await expectRefused(loadBrowserVeilArchive(v.idbName, "group-a"), "sealed-locked");
    await expectRefused(requireMainArchive(v.idbName), "sealed-locked");
    await expectRefused(generateOrLoadBrowserVesselIdentity(v.idbName), "sealed-locked");
    expect(await census(v.idbName), "no reader minted or wrote").toEqual(before);

    await expectRefused(saveMainArchive(v.idbName, randomBytes(32)), "sealed-locked");
    await expectRefused(saveBrowserVeilArchive(v.idbName, "group-a", randomBytes(32)), "sealed-locked");
    const after = await census(v.idbName);
    expect(after["sealed/veil-archive-ggroup-main"]).toBe(before["sealed/veil-archive-ggroup-main"]);
    expect(after["sealed/veil-archive-ggroup-a"]).toBe(before["sealed/veil-archive-ggroup-a"]);
    expect(after, "no writer landed a row").toEqual(before);
  });

  test("BC5 THE REFUSAL: a wrong passphrase opens nothing and destroys nothing; the right one opens", async () => {
    const v = await plantedVessel("refusal");
    const { slot } = await sealBrowserKeystore(v.idbName, PASS);
    lockBrowserCustody(v.idbName);
    const before = await census(v.idbName);

    expect(await unlockBrowserCustody(v.idbName, [WRONG])).toMatchObject({ reading: "no-slot-opens" });
    expect(await census(v.idbName), "the wrong passphrase destroyed nothing").toEqual(before);
    await expectRefused(loadMainArchive(v.idbName), "sealed-locked");

    // CONTROL: the right passphrase opens the slot the seal bound, so the refusal measured the passphrase.
    expect(await unlockBrowserCustody(v.idbName, [PASS])).toMatchObject({ reading: "opens", slot });
    expect(hex((await loadMainArchive(v.idbName))!)).toBe(hex(v.archive));
    expect(hex(await placeSeed(v.idbName))).toBe(hex(v.seed));
    expect(await census(v.idbName)).toEqual(before);
  }, SLOW);

  test("BC6 a clear with a wrong passphrase opens nothing, asks nothing and writes nothing", async () => {
    const v = await plantedVessel("clear-wrong");
    await sealBrowserKeystore(v.idbName, PASS);
    lockBrowserCustody(v.idbName);
    const before = await census(v.idbName);
    let asks = 0;
    const door: ConfirmDoor = () => { asks += 1; return true; };
    expect(await clearBrowserCustody(v.idbName, [WRONG], door)).toMatchObject({ reading: "no-slot-opens" });
    expect(asks, "the door never asked").toBe(0);
    expect(await census(v.idbName)).toEqual(before);
    expect((await readBrowserCustody(v.idbName)).reading).toBe("sealed");
  }, SLOW);

  test("BC7 THE CONFIRM DOOR: the first ask parks and abandons; the confirmed re-run clears every row back", async () => {
    const v = await plantedVessel("clear");
    await sealBrowserKeystore(v.idbName, PASS);
    lockBrowserCustody(v.idbName);
    const sealedCensus = await census(v.idbName);

    // CONTROL: the human answers "no"; the door keeps returning false and the keystore stays sealed.
    const refused = parkedDoor();
    expect(await clearBrowserCustody(v.idbName, [PASS], refused.door)).toEqual({ reading: "asks", question: CLEAR_CUSTODY_QUESTION });
    refused.answerNo();
    expect(await clearBrowserCustody(v.idbName, [PASS], refused.door)).toEqual({ reading: "asks", question: CLEAR_CUSTODY_QUESTION });
    expect(refused.outcomes, "the second ask met the person's no, not a fresh park").toEqual(["parked", "no"]);
    expect(await census(v.idbName), "a refused clear writes nothing").toEqual(sealedCensus);
    expect((await readBrowserCustody(v.idbName)).reading).toBe("sealed");

    // The first ask parks: the act abandons and writes nothing.
    const door = parkedDoor();
    expect(await clearBrowserCustody(v.idbName, [PASS], door.door)).toEqual({ reading: "asks", question: CLEAR_CUSTODY_QUESTION });
    expect(door.asked).toEqual([CLEAR_CUSTODY_QUESTION]);
    expect(await census(v.idbName), "the parked ask wrote nothing").toEqual(sealedCensus);
    expect((await readBrowserCustody(v.idbName)).reading).toBe("sealed");

    // The human answers yes; the handler runs again and the door returns true once.
    door.answerYes();
    const cleared = await clearBrowserCustody(v.idbName, [PASS], door.door);
    expect(door.outcomes).toEqual(["parked", "yes"]);
    expect(cleared.reading).toBe("cleared");
    if (cleared.reading === "cleared") expect([...cleared.cleared].sort()).toEqual([...CUSTODY_ROWS]);

    const after = await census(v.idbName);
    expect(after[CUSTODY_TREE_ROW], "the slot tree left").toBeUndefined();
    expect(Object.keys(after).filter((k) => k.startsWith(SEALED_ROW_PREFIX)), "no sealed row stands").toEqual([]);
    expect(await rowOf(v.idbName, "vessel-key")).toEqual(v.key);
    expect(hex((await rowOf(v.idbName, "veil-archive-ggroup-main")) as Uint8Array)).toBe(hex(v.archive));
    expect(hex((await rowOf(v.idbName, "veil-archive-ggroup-a")) as Uint8Array)).toBe(hex(v.veil));
    expect(after["catalog-url"]).toBe(sealedCensus["catalog-url"]);
    expect(await readBrowserCustody(v.idbName)).toEqual({ reading: "clear" });
    expect(hex(await placeSeed(v.idbName))).toBe(hex(v.seed));
  }, SLOW);

  test("BC8 while unlocked a save re-seals, opens to the new bytes, and lands no clear row", async () => {
    const v = await plantedVessel("reseal");
    await sealBrowserKeystore(v.idbName, PASS);
    const standing = (await census(v.idbName))["sealed/veil-archive-ggroup-main"];
    const next = randomBytes(120);
    await saveMainArchive(v.idbName, next);
    const after = await census(v.idbName);
    expect(after["sealed/veil-archive-ggroup-main"], "the sealed row moved").not.toBe(standing);
    expect(startsWithMagic(await rowOf(v.idbName, "sealed/veil-archive-ggroup-main"))).toBe(true);
    expect(after["veil-archive-ggroup-main"], "no clear row appeared").toBeUndefined();
    expect(hex((await loadMainArchive(v.idbName))!)).toBe(hex(next));

    // The new bytes rest under the key, not in this page's memory: a fresh unlock reads them.
    lockBrowserCustody(v.idbName);
    await unlockBrowserCustody(v.idbName, [PASS]);
    expect(hex((await loadMainArchive(v.idbName))!)).toBe(hex(next));
  }, SLOW);

  test("BC9 a clear custody row beside the tree refuses unsettled by name and nothing is deleted", async () => {
    const v = await plantedVessel("unsettled");
    await sealBrowserKeystore(v.idbName, PASS);
    // CONTROL: settled, the reader reads.
    expect(hex((await loadMainArchive(v.idbName))!)).toBe(hex(v.archive));

    await plant(v.idbName, "veil-archive-ggroup-main", randomBytes(40));
    const before = await census(v.idbName);
    await expectRefused(loadMainArchive(v.idbName), "unsettled", "veil-archive-ggroup-main");
    expect(await census(v.idbName), "nothing was deleted").toEqual(before);
  });

  test("BC10 slots bind and unbind: either passphrase opens, an unbound one opens nothing, the last one stays", async () => {
    const v = await plantedVessel("slots");
    const second = { kind: "passphrase", passphrase: "second" } as const;
    const { slot: first } = await sealBrowserKeystore(v.idbName, PASS);

    lockBrowserCustody(v.idbName);
    await expectRefused(bindBrowserCustodySlot(v.idbName, second), "sealed-locked");
    const lockedStatus = await readBrowserCustody(v.idbName);
    expect(lockedStatus.reading === "sealed" ? lockedStatus.slots.length : -1, "a refused bind bound nothing").toBe(1);
    expect(await unlockBrowserCustody(v.idbName, [PASS])).toMatchObject({ reading: "opens", slot: first });

    const { slot: other } = await bindBrowserCustodySlot(v.idbName, second);
    expect(other).not.toBe(first);
    const both = await readBrowserCustody(v.idbName);
    expect(both.reading === "sealed" ? both.slots.map((s) => s.id).sort() : []).toEqual([first, other].sort());

    lockBrowserCustody(v.idbName);
    expect(await unlockBrowserCustody(v.idbName, [second])).toMatchObject({ reading: "opens", slot: other });
    lockBrowserCustody(v.idbName);
    expect(await unlockBrowserCustody(v.idbName, [PASS])).toMatchObject({ reading: "opens", slot: first });
    expect(hex((await loadMainArchive(v.idbName))!)).toBe(hex(v.archive));

    const { rotationOffer } = await unbindBrowserCustodySlot(v.idbName, first);
    expect(typeof rotationOffer).toBe("string");
    expect(rotationOffer.length).toBeGreaterThan(0);
    lockBrowserCustody(v.idbName);
    expect(await unlockBrowserCustody(v.idbName, [PASS])).toMatchObject({ reading: "no-slot-opens" });
    expect(await unlockBrowserCustody(v.idbName, [second])).toMatchObject({ reading: "opens", slot: other });

    await expect(unbindBrowserCustodySlot(v.idbName, other)).rejects.toThrow();
    const last = await readBrowserCustody(v.idbName);
    expect(last.reading === "sealed" ? last.slots.map((s) => s.id) : []).toEqual([other]);
    lockBrowserCustody(v.idbName);
    expect(await unlockBrowserCustody(v.idbName, [second]), "the last slot still opens").toMatchObject({ reading: "opens", slot: other });
    expect(hex(await placeSeed(v.idbName))).toBe(hex(v.seed));
  }, SLOW);

  test("BC11 the sidecar law through the keystore port: a sidecar that does not read back lands nothing", async () => {
    const idbName = `custody-port-${crypto.randomUUID()}`;
    const io = browserKeystoreCustodyIo(idbName);

    // The port's own shape over the keystore.
    expect(await io.read("port-probe")).toBeNull();
    await io.write("port-probe", Uint8Array.of(1, 2, 3));
    expect(Array.from((await io.read("port-probe"))!)).toEqual([1, 2, 3]);
    await io.rename("port-probe", "port-probe-moved");
    expect(await io.read("port-probe")).toBeNull();
    expect((await io.list())).toContain("port-probe-moved");
    await io.remove("port-probe-moved");
    await io.remove("port-probe-moved");   // nothing standing is no fault
    expect(await io.read("port-probe-moved")).toBeNull();
    expect(await io.exclusive(async () => 7)).toBe(7);

    // A tree key of the test's own, bound under a tree the mesh writer commits through the port. The vessel's own tree key is
    // unreachable from the public surface, and none is needed: the law under test is the port's.
    const treeKey = mintTreeKey();
    const tree = bindSlot(null, treeKey, { t: 1, pins: [{ kind: "passphrase", passphrase: "port" }] });
    const carrier = sealedCarrierOf("veil-archive-ggroup-main");
    await commitSlotTree({ io, path: CUSTODY_TREE_ROW, expected: null, treeKey, tree, carriers: [carrier] });
    expect(await rowOf(idbName, CUSTODY_TREE_ROW)).toBeInstanceOf(Uint8Array);

    const flipping: CustodyIo = {
      read: (p) => io.read(p), rename: (a, b) => io.rename(a, b), remove: (p) => io.remove(p),
      list: () => io.list(), exclusive: (fn) => io.exclusive(fn),
      write: (p, bytes) => {
        if (!p.endsWith(SEALING_SUFFIX)) return io.write(p, bytes);
        const torn = new Uint8Array(bytes);
        torn[torn.length - 1] = torn[torn.length - 1]! ^ 0xff;
        return io.write(p, torn);
      },
    };
    const plaintext = randomBytes(64);
    await expect(writeSealedCarrier({ io: flipping, treeKey, treePath: CUSTODY_TREE_ROW, carrier, plaintext }))
      .rejects.toThrow(/did not read back/);
    expect(await io.read(carrier.path), "nothing landed at the carrier").toBeNull();
    expect(await io.read(`${carrier.path}${SEALING_SUFFIX}`), "the torn sidecar left").toBeNull();
    expect(await rowOf(idbName, "veil-archive-ggroup-main"), "no clear row either").toBeUndefined();

    // CONTROL: the same write through the honest port lands, at the keystore row the carrier names, and opens.
    await writeSealedCarrier({ io, treeKey, treePath: CUSTODY_TREE_ROW, carrier, plaintext });
    expect(startsWithMagic(await rowOf(idbName, carrier.path))).toBe(true);
    const opened = await openSealedCarrier({ io, treeKey, carrier });
    expect(opened.reading).toBe("opens");
    if (opened.reading === "opens") expect(hex(opened.plaintext)).toBe(hex(plaintext));

    // The browser reader opens what the mesh writer sealed, once its passphrase unlocks this page.
    await expectRefused(loadMainArchive(idbName), "sealed-locked");
    expect(await unlockBrowserCustody(idbName, [{ kind: "passphrase", passphrase: "port" }])).toMatchObject({ reading: "opens" });
    expect(hex((await loadMainArchive(idbName))!)).toBe(hex(plaintext));
  }, SLOW);

  test("BC12 THE REOPEN: a sealed, locked vessel refuses its boot; unlocked, it reads its bytes and boots", async () => {
    const idbName = await foundHalted();
    const seed = await placeSeed(idbName);
    const group = await foundedGroup(idbName);
    const archive = (await loadBrowserVeilArchive(idbName, group))!;
    const veil = archive;
    expect(veil.byteLength).toBeGreaterThan(0);

    const standing = await readBrowserCustody(idbName);
    expect(standing.reading).toBe("sealed");
    const slot = standing.reading === "sealed" ? standing.slots[0]!.id : "";
    lockBrowserCustody(idbName);
    const lockedCensus = await census(idbName);

    // The locked boot refuses before its catalog and writes nothing into the keystore.
    await pageLetsGo(idbName);
    const lockedPhases: string[] = [];
    await expectRefused(
      openBrowserVessel({ idbName, onPhase: (p: string) => { lockedPhases.push(p); if (p === "catalog-ready") throw new BootHalted(); } } as BrowserVesselOptions),
      "sealed-locked",
    );
    expect(lockedPhases, "the refusal lands before the catalog").not.toContain("catalog-ready");
    expect(await census(idbName), "the refused boot minted and wrote nothing").toEqual(lockedCensus);

    expect(await unlockBrowserCustody(idbName, [PASS])).toMatchObject({ reading: "opens", slot });
    expect(hex(await placeSeed(idbName))).toBe(hex(seed));
    expect(hex((await loadBrowserVeilArchive(idbName, group))!)).toBe(hex(archive));
    expect(hex((await loadBrowserVeilArchive(idbName, await foundedGroup(idbName)))!)).toBe(hex(veil));
    expect(hex((await loadBrowserVeilArchive(idbName, group))!)).toBe(hex(archive));

    // The same boot, unlocked, reaches its catalog again.
    await pageLetsGo(idbName);
    const phases: string[] = [];
    await expect(openBrowserVessel({
      idbName, onPhase: (p: string) => { phases.push(p); if (p === "catalog-ready") throw new BootHalted(); },
    } as BrowserVesselOptions)).rejects.toBeInstanceOf(BootHalted);
    expect(phases).toContain("catalog-ready");

    const after = await census(idbName);
    expect(Object.keys(after).filter((k) => k === "vessel-key" || k === "veil-archive-ggroup-main" || /^veil-archive-g.+$/.test(k)), "no clear custody row came back").toEqual([]);
    const founded = await foundedGroup(idbName);
    for (const row of [`veil-archive-g${founded}`, "vessel-key"]) expect(startsWithMagic(await rowOf(idbName, `sealed/${row}`)), `sealed/${row}`).toBe(true);
    expect(hex(await placeSeed(idbName)), "the same identity stood").toBe(hex(seed));
  }, SLOW);

  test("BC13 the settle arms: an equal clear row settles on unlock; a different one stays unsettled, both rows intact", async () => {
    const v = await plantedVessel("settle");
    await sealBrowserKeystore(v.idbName, PASS);
    lockBrowserCustody(v.idbName);
    const sealedArchive = (await census(v.idbName))["sealed/veil-archive-ggroup-main"];

    // EQUAL: the clear rows match what the seal holds.
    await plant(v.idbName, "veil-archive-ggroup-main", new Uint8Array(v.archive));
    await plant(v.idbName, "vessel-key", { ...v.key });
    await expectRefused(loadMainArchive(v.idbName), "unsettled", "veil-archive-ggroup-main");   // CONTROL: the plant is seen
    const eq = await unlockBrowserCustody(v.idbName, [PASS]);
    expect(eq.reading).toBe("opens");
    if (eq.reading === "opens") {
      expect([...eq.settled].sort()).toEqual(["veil-archive-ggroup-main", "vessel-key"]);
      expect(eq.unsettled).toEqual([]);
    }
    expect(await rowOf(v.idbName, "veil-archive-ggroup-main"), "the equal clear row left").toBeUndefined();
    expect(await rowOf(v.idbName, "vessel-key"), "the equal device key row left").toBeUndefined();
    expect((await census(v.idbName))["sealed/veil-archive-ggroup-main"], "the seal it met stays").toBe(sealedArchive);
    expect(hex((await loadMainArchive(v.idbName))!)).toBe(hex(v.archive));

    // DIFFERENT: nothing chooses between two values.
    lockBrowserCustody(v.idbName);
    await plant(v.idbName, "veil-archive-ggroup-main", randomBytes(48));
    const before = await census(v.idbName);
    const diff = await unlockBrowserCustody(v.idbName, [PASS]);
    expect(diff.reading).toBe("opens");
    if (diff.reading === "opens") {
      expect(diff.settled).toEqual([]);
      expect(diff.unsettled.map((u) => u.row)).toEqual(["veil-archive-ggroup-main"]);
      expect(typeof diff.unsettled[0]!.why).toBe("string");
      expect(diff.unsettled[0]!.why.length).toBeGreaterThan(0);
    }
    expect(await census(v.idbName), "both rows stand byte-identical").toEqual(before);
    await expectRefused(loadMainArchive(v.idbName), "unsettled", "veil-archive-ggroup-main");
  }, SLOW);

  test("BC14 a locked, empty-sealed keystore refuses the seed read and the mint; nothing moves", async () => {
    const idbName = `custody-empty-locked-${crypto.randomUUID()}`;
    const marker = browserIdentityContinuityKey(idbName);
    expect(marker).toBe(`lares:vessel:continuity:${idbName}`);
    await sealBrowserKeystore(idbName, PASS);
    lockBrowserCustody(idbName);
    const before = await census(idbName);
    const markerBefore = localStorage.getItem(marker);

    await expectRefused(placeSeed(idbName), "sealed-locked");
    await expectRefused(generateOrLoadBrowserVesselIdentity(idbName), "sealed-locked");
    expect(await census(idbName), "no mint landed").toEqual(before);
    expect(localStorage.getItem(marker), "the continuity marker stands").toBe(markerBefore);

    // CONTROL: unlocked, the same mint lands, sealed.
    await unlockBrowserCustody(idbName, [PASS]);
    await generateOrLoadBrowserVesselIdentity(idbName);
    expect(startsWithMagic(await rowOf(idbName, "sealed/vessel-key"))).toBe(true);
    expect(localStorage.getItem(marker)).toBe("founded");
  }, SLOW);

  test("BC15 the refusal readings: torn-without-tree, tree-unreadable, row-unopened, each writing nothing", async () => {
    const other = await plantedVessel("other");
    await sealBrowserKeystore(other.idbName, { kind: "passphrase", passphrase: "another vessel" });
    const foreignFrame = (await rowOf(other.idbName, "sealed/veil-archive-ggroup-main")) as Uint8Array;
    expect(startsWithMagic(foreignFrame)).toBe(true);

    // torn-without-tree: a sealed row and no tree.
    const torn = `custody-torn-${crypto.randomUUID()}`;
    expect(await loadMainArchive(torn)).toBeUndefined();   // CONTROL: before the plant, it reads absent
    expect(await readBrowserCustody(torn)).toEqual({ reading: "clear" });
    await plant(torn, "sealed/veil-archive-ggroup-main", new Uint8Array(foreignFrame));
    const tornBefore = await census(torn);
    await expectRefused(loadMainArchive(torn), "torn-without-tree", "veil-archive-ggroup-main");
    await expectRefused(saveMainArchive(torn, randomBytes(16)), "torn-without-tree", "veil-archive-ggroup-main");
    expect((await readBrowserCustody(torn)).reading).toBe("unreadable");
    expect(await census(torn)).toEqual(tornBefore);

    // tree-unreadable: garbage bytes at the tree row.
    const garbage = `custody-garbage-${crypto.randomUUID()}`;
    expect(await readBrowserCustody(garbage)).toEqual({ reading: "clear" });   // CONTROL
    await plant(garbage, CUSTODY_TREE_ROW, Uint8Array.of(0xde, 0xad, 0xbe, 0xef));
    const garbageBefore = await census(garbage);
    await expectRefused(loadMainArchive(garbage), "tree-unreadable");
    await expectRefused(placeSeed(garbage), "tree-unreadable");
    await expectRefused(saveMainArchive(garbage, randomBytes(16)), "tree-unreadable");
    expect((await readBrowserCustody(garbage)).reading).toBe("unreadable");
    expect(await census(garbage)).toEqual(garbageBefore);

    // row-unopened: another vessel's frame in this vessel's sealed row, read while unlocked.
    const v = await plantedVessel("unopened");
    await sealBrowserKeystore(v.idbName, PASS);
    expect(hex((await loadMainArchive(v.idbName))!)).toBe(hex(v.archive));   // CONTROL: its own frame opens
    await plant(v.idbName, "sealed/veil-archive-ggroup-main", new Uint8Array(foreignFrame));
    const unopenedBefore = await census(v.idbName);
    await expectRefused(loadMainArchive(v.idbName), "row-unopened", "veil-archive-ggroup-main");
    expect(await census(v.idbName)).toEqual(unopenedBefore);
    expect(hex((await loadBrowserVeilArchive(v.idbName, "group-a"))!), "the other rows still open").toBe(hex(v.veil));
  }, SLOW);

  test("BC16 a paper route: two of three sheets open the slot; one sheet or a passphrase does not", async () => {
    const v = await plantedVessel("paper");
    const draft = draftPaperPin({ threshold: 2, count: 3 });
    confirmPaperPin(draft, draft.sheets);   // the person types every sheet back
    const [a, b, c] = draft.sheets as [string, string, string];
    const { slot } = await sealBrowserKeystore(v.idbName, { kind: "paper", sheets: [a, b] });
    expect(await readBrowserCustody(v.idbName)).toEqual({ reading: "sealed", unlocked: true, slots: [{ id: slot, t: 1, kinds: ["paper"] }] });
    lockBrowserCustody(v.idbName);
    const before = await census(v.idbName);

    expect(await unlockBrowserCustody(v.idbName, [WRONG])).toMatchObject({ reading: "no-slot-opens" });
    expect(await unlockBrowserCustody(v.idbName, [{ kind: "paper", sheets: [c] }])).toMatchObject({ reading: "no-slot-opens" });
    expect(await census(v.idbName)).toEqual(before);
    await expectRefused(placeSeed(v.idbName), "sealed-locked");

    expect(await unlockBrowserCustody(v.idbName, [{ kind: "paper", sheets: [b, c] }])).toMatchObject({ reading: "opens", slot });
    expect(hex(await placeSeed(v.idbName))).toBe(hex(v.seed));
    expect(hex((await loadMainArchive(v.idbName))!)).toBe(hex(v.archive));
  }, SLOW);

  test("BC17 the door's literal true: a truthy non-boolean parks and writes nothing", async () => {
    const v = await plantedVessel("truthy");
    await sealBrowserKeystore(v.idbName, PASS);
    lockBrowserCustody(v.idbName);
    const before = await census(v.idbName);
    for (const truthy of [1, "yes", {}, Promise.resolve(true)]) {
      const door = (() => truthy) as unknown as ConfirmDoor;
      expect(await clearBrowserCustody(v.idbName, [PASS], door), String(truthy)).toEqual({ reading: "asks", question: CLEAR_CUSTODY_QUESTION });
      expect(await census(v.idbName), `${String(truthy)} wrote nothing`).toEqual(before);
    }
    expect((await readBrowserCustody(v.idbName)).reading).toBe("sealed");

    // CONTROL: literal true clears.
    expect((await clearBrowserCustody(v.idbName, [PASS], () => true)).reading).toBe("cleared");
    expect(await readBrowserCustody(v.idbName)).toEqual({ reading: "clear" });
  }, SLOW);

  test("BC18 a newer seal between the park and the confirm: the clear carries the newer bytes", async () => {
    const v = await plantedVessel("newer");
    await sealBrowserKeystore(v.idbName, PASS);   // the page stays unlocked
    const door = parkedDoor();
    expect(await clearBrowserCustody(v.idbName, [PASS], door.door)).toEqual({ reading: "asks", question: CLEAR_CUSTODY_QUESTION });

    // While the question parks, this page re-seals a newer Archive.
    const newer = randomBytes(72);
    await saveMainArchive(v.idbName, newer);
    expect(hex((await loadMainArchive(v.idbName))!)).toBe(hex(newer));

    door.answerYes();
    const cleared = await clearBrowserCustody(v.idbName, [PASS], door.door);
    expect(cleared.reading).toBe("cleared");
    expect(hex((await rowOf(v.idbName, "veil-archive-ggroup-main")) as Uint8Array), "the newer bytes rest in the clear").toBe(hex(newer));
    expect(hex((await rowOf(v.idbName, "veil-archive-ggroup-a")) as Uint8Array)).toBe(hex(v.veil));
    expect(await readBrowserCustody(v.idbName)).toEqual({ reading: "clear" });
  }, SLOW);

  test("BC19 a clear holds the row doors until each value rests in the clear", async () => {
    const v = await plantedVessel("clear-race");
    await sealBrowserKeystore(v.idbName, PASS);
    await unlockBrowserCustody(v.idbName, [PASS]);

    // Hold the mesh writer at the first removal after the clear row lands. Readers meet the handoff while it stands.
    const request = navigator.locks.request.bind(navigator.locks);
    let release!: () => void;
    let reached!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const parked = new Promise<void>((resolve) => { reached = resolve; });
    let held = false;
    const spy = vi.spyOn(navigator.locks, "request").mockImplementation((async (
      name: string, options: LockOptions, callback: (lock: Lock | null) => unknown,
    ) => {
      if (!held && name === `lares:custody:${v.idbName}` && await rowOf(v.idbName, "veil-archive-ggroup-main") !== undefined) {
        held = true;
        reached();
        await gate;
      }
      return request(name, options, callback);
    }) as LockManager["request"]);

    let clearing: Promise<unknown> | undefined;
    try {
      clearing = clearBrowserCustody(v.idbName, [PASS], () => true);
      await parked;
      const reads: Promise<unknown>[] = [];
      let settledEarly = 0;
      const track = (read: Promise<unknown>) => { read.then(() => { settledEarly++; }, () => { settledEarly++; }); return read; };
      for (let i = 0; i < 25; i++) {
        reads.push(track(readKeystoreRow(v.idbName, "vessel-key")));
        reads.push(track(readKeystoreRow(v.idbName, "veil-archive-ggroup-main")));
        if (i % 5 === 4) await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      // The readers WAIT: none settles while the clear stands midway.
      expect(settledEarly, "a read settled while the clear stood midway").toBe(0);
      release();
      expect(await clearing).toMatchObject({ reading: "cleared" });
      const answers = await Promise.allSettled(reads);
      for (let i = 0; i < answers.length; i++) {
        const answer = answers[i]!;
        expect(answer.status, `read ${i} refused during the clear`).toBe("fulfilled");
        if (answer.status === "fulfilled") expect(answer.value).toEqual(i % 2 === 0 ? v.key : v.archive);
      }
    } finally {
      release();
      spy.mockRestore();
      await clearing?.catch(() => undefined);
    }
  }, SLOW);

  test("BC20 a torn replacement sidecar leaves the standing sealed value byte-identical", async () => {
    const idbName = `custody-replace-${crypto.randomUUID()}`;
    const io = browserKeystoreCustodyIo(idbName);
    const treeKey = mintTreeKey();
    const tree = bindSlot(null, treeKey, { t: 1, pins: [{ kind: "passphrase", passphrase: "replace" }] });
    const carrier = sealedCarrierOf("veil-archive-ggroup-main");
    await commitSlotTree({ io, path: CUSTODY_TREE_ROW, expected: null, treeKey, tree, carriers: [carrier] });
    const a = randomBytes(64);
    await writeSealedCarrier({ io, treeKey, treePath: CUSTODY_TREE_ROW, carrier, plaintext: a });
    const before = (await io.read(carrier.path))!;

    const flipping: CustodyIo = {
      read: (p) => io.read(p), rename: (a, b) => io.rename(a, b), remove: (p) => io.remove(p),
      list: () => io.list(), exclusive: (fn) => io.exclusive(fn),
      write: (p, bytes) => {
        if (!p.endsWith(SEALING_SUFFIX)) return io.write(p, bytes);
        const torn = new Uint8Array(bytes);
        torn[torn.length - 1] = torn[torn.length - 1]! ^ 0xff;
        return io.write(p, torn);
      },
    };
    const b = randomBytes(72);
    await expect(writeSealedCarrier({ io: flipping, treeKey, treePath: CUSTODY_TREE_ROW, carrier, plaintext: b }))
      .rejects.toThrow(/did not read back/);
    expect(hex((await io.read(carrier.path))!), "the standing seal keeps its exact bytes").toBe(hex(before));
    expect(await io.read(`${carrier.path}${SEALING_SUFFIX}`), "the torn sidecar left").toBeNull();
    expect(await unlockBrowserCustody(idbName, [{ kind: "passphrase", passphrase: "replace" }])).toMatchObject({ reading: "opens" });
    expect(await readKeystoreRow(idbName, "veil-archive-ggroup-main")).toEqual(a);
  }, SLOW);

  test("BC21 the clear asks its question with the act lock free", async () => {
    const v = await plantedVessel("clear-question");
    await sealBrowserKeystore(v.idbName, PASS);
    await unlockBrowserCustody(v.idbName, [PASS]);
    let free: Promise<boolean> | undefined;
    const door: ConfirmDoor = () => {
      // A door that waits on a person must hold no other tab's row doors: the act lock stands free while it asks.
      free = navigator.locks.request(`lares:custody-act:${v.idbName}`, { mode: "exclusive", ifAvailable: true }, (lock) => lock !== null) as Promise<boolean>;
      return true;
    };
    expect(await clearBrowserCustody(v.idbName, [PASS], door)).toMatchObject({ reading: "cleared" });
    expect(await free, "the act lock stood free while the door asked").toBe(true);
    // CONTROL: the same probe from inside a held act lock reads it taken.
    const taken = await navigator.locks.request(`lares:custody-act:${v.idbName}`, { mode: "exclusive" }, () =>
      navigator.locks.request(`lares:custody-act:${v.idbName}`, { mode: "exclusive", ifAvailable: true }, (lock) => lock !== null));
    expect(taken).toBe(false);
  }, SLOW);

  test("BC22 a root mint needs a slot and changes no keystore byte", async () => {
    const v = await plantedVessel("root-no-slot");
    // CONTROL: the device key minted before any slot was bound.
    expect(v.key.signingKey).toBeDefined();
    const before = await census(v.idbName);
    await expectRefused(generateOrLoadBrowserPersonaRoot(v.idbName, 0), "no-custody-slot", "persona-root-h0");
    expect(await census(v.idbName)).toEqual(before);
    expect(await listBrowserPersonaRoots(v.idbName)).toEqual([]);
  }, SLOW);

  test("BC23 a bound slot keeps the root and roster only in sealed carriers", async () => {
    const v = await plantedVessel("root-sealed");
    await sealBrowserKeystore(v.idbName, PASS);
    // CONTROL: an unlocked slot already opens the device seed.
    expect(await placeSeed(v.idbName)).toEqual(v.seed);
    expect((await generateOrLoadBrowserPersonaRoot(v.idbName, 0)).created).toBe(true);
    expect(await listBrowserPersonaRoots(v.idbName)).toEqual([0]);
    for (const row of ["persona-root-h0", "persona-root-roster"]) {
      expect(await rowOf(v.idbName, row)).toBeUndefined();
      expect(startsWithMagic(await rowOf(v.idbName, `sealed/${row}`))).toBe(true);
    }
  }, SLOW);

  test("BC24 a locked root refuses before reading and unlock returns its seed", async () => {
    const v = await plantedVessel("root-locked");
    await sealBrowserKeystore(v.idbName, PASS);
    await generateOrLoadBrowserPersonaRoot(v.idbName, 0);
    const seed = await loadBrowserPersonaRootSeed(v.idbName, 0);
    // CONTROL: the unlocked root reads the same seed twice.
    expect(await loadBrowserPersonaRootSeed(v.idbName, 0)).toEqual(seed);
    lockBrowserCustody(v.idbName);
    const before = await census(v.idbName);
    await expectRefused(loadBrowserPersonaRootSeed(v.idbName, 0), "sealed-locked", "persona-root-h0");
    expect(await census(v.idbName)).toEqual(before);
    expect((await unlockBrowserCustody(v.idbName, [PASS])).reading).toBe("opens");
    expect(await loadBrowserPersonaRootSeed(v.idbName, 0)).toEqual(seed);
  }, SLOW);

  test("BC25 a confirmed clear returns the root and roster to clear rows", async () => {
    const v = await plantedVessel("root-clear");
    await sealBrowserKeystore(v.idbName, PASS);
    await generateOrLoadBrowserPersonaRoot(v.idbName, 0);
    const seed = await loadBrowserPersonaRootSeed(v.idbName, 0);
    // CONTROL: before clear both rows stand sealed.
    expect(startsWithMagic(await rowOf(v.idbName, "sealed/persona-root-h0"))).toBe(true);
    expect(startsWithMagic(await rowOf(v.idbName, "sealed/persona-root-roster"))).toBe(true);
    expect((await clearBrowserCustody(v.idbName, [PASS], () => true)).reading).toBe("cleared");
    expect(await rowOf(v.idbName, "persona-root-h0")).toMatchObject({ signingKey: hex(seed) });
    expect(await rowOf(v.idbName, "persona-root-roster")).toEqual({ roots: [0] });
    expect(await rowOf(v.idbName, "sealed/persona-root-h0")).toBeUndefined();
    expect(await rowOf(v.idbName, "sealed/persona-root-roster")).toBeUndefined();
    expect(await loadBrowserPersonaRootSeed(v.idbName, 0)).toEqual(seed);
  }, SLOW);

  test("BC27 a fresh schema stands the present stores and rests no worn-face pointer", async () => {
    const idbName = `custody-schema-${crypto.randomUUID()}`;
    const db = await openVesselIdb(idbName);
    try {
      for (const store of ["keystore", "bootstrap", "anchors", "anchor-roster", "fleet-join"]) expect(db.objectStoreNames.contains(store)).toBe(true);   // CONTROL
      expect(db.objectStoreNames.contains("active-persona")).toBe(false);
    } finally { db.close(); }
  });

  test("BC28 the worn face is session state of one tab: it rests in no store, and a reload asks again", async () => {
    const v = await plantedVessel("worn-session");
    await sealBrowserKeystore(v.idbName, PASS);
    await generateOrLoadBrowserPersonaRoot(v.idbName, 0);
    await generateOrLoadBrowserPersonaRoot(v.idbName, 1);
    const vault = await makeBrowserIdbPersonaVault(v.idbName);
    expect(await vault.selector.load()).toBeUndefined();                       // two roots held and none chosen: no inference
    await vault.selector.save(1);
    expect(await vault.selector.load()).toBe(1);
    const db = await openVesselIdb(v.idbName);
    try { expect(db.objectStoreNames.contains("active-persona")).toBe(false); } finally { db.close(); }
    forgetWornFaceOfTab(v.idbName);                                            // the tab reloads
    expect(await vault.selector.load()).toBeUndefined();
  }, SLOW);

  test("BC28b CONTROL: one root held is the face worn", async () => {
    const v = await plantedVessel("worn-one-root");
    await sealBrowserKeystore(v.idbName, PASS);
    await generateOrLoadBrowserPersonaRoot(v.idbName, 0);
    expect(await (await makeBrowserIdbPersonaVault(v.idbName)).selector.load()).toBe(0);
  }, SLOW);
});
