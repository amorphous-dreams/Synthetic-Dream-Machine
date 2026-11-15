/**
 * vessel-host-reset-gate — THE CONFIRM GATE OVER REAL CUSTODY (browser-vessel-lift#/the-confirm-gate), in a real engine: a real
 * keystore sealed by `@lararium/browser`, the ceremony's own census over this engine's IndexedDB, and the ceremony's own proof
 * worker (`workers/custody-proof.worker.ts`), spawned as the ceremony document spawns it.
 *
 * (The file rides the `vessel-host` project for its wasm plugin and its `@lararium/browser` import; it stands no host.)
 *
 *   H1 RED   CUSTODY STANDING AND LOCKED: the gate reads `held`; the typed phrase and a wrong passphrase each refuse
 *            `no-slot-opens`, the store's every row reads byte-identical after both, and the database still stands; the right
 *            passphrase passes and its pass burns the store (the origin names it no longer).
 *            CONTROL: the store's own status read `sealed` and locked while the gate answered.
 *   H2       LOCKED AND UNLOCKED READ THE SAME: the same store, sealed and still unlocked on this thread, draws the same
 *            standing, the same refusal and the same pass. The gate's census and proof name nothing a session holds open.
 *   H3       A BARE FLOOR: a keystore with no tree reads `bare`, the typed phrase alone burns it, and no proof worker spawns.
 *   H4       A JOINED FACE ALONE (no place passphrase): the face's own passphrase passes; a wrong one refuses.
 *   H5       UNVERIFIABLE: a slot tree whose bytes do not read turns the standing `unverifiable`; the typed phrase passes
 *            under that name. CONTROL: the same store read `held` before the fault.
 *   H6       NO VERIFIER, NO PASS: where custody reads and the proof worker cannot stand (the spawn throws, or its script does
 *            not load), the gate refuses `gate-verifier-absent`, mints no pass and never falls back to typed words.
 *   H7       THE WELD: the gate's keystore names equal the proof module's, which `@lararium/browser`'s own suite welds to the
 *            custody modules.
 *   H8       NO SECRET IN ANY WORD: across H1's wrong and right tries no refusal, signal, said word, record value or console
 *            line of this page carries the passphrase.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift
 */
import { expect, test, vi } from "vitest";
import { bindFirstFaceSlot, lockBrowserCustody, lockFaceCustody, openVesselIdb, readBrowserCustody, sealBrowserKeystore } from "@lararium/browser";
import { PROOF_FACE_TREE_PREFIX, PROOF_KEYSTORE, PROOF_PLACE_TREE_ROW, PROOF_SEALED_PREFIXES } from "@lararium/browser/custody-proof";
import type { ResetSignal } from "../src/ceremony-protocol.js";
import {
  GATE_FACE_TREE_PREFIX, GATE_KEYSTORE, GATE_PLACE_TREE_ROW, GATE_SEALED_PREFIXES, gateDemandOf, GateRefused, passCriticalGate, readGateStanding, type GateEnv,
} from "../src/ceremony/critical-gate.js";
import { ambientGateEnv, spawnProofWorker } from "../src/ceremony/gate-ambient.js";
import { ambientResetEnv, burnPlace, recordResetAsk, RESET_PHRASE, RESET_PROCEDURE, resetAskKey, type ResetEnv } from "../src/ceremony/reset-core.js";

const PASSPHRASE = "the holder's own passphrase";
const ROUTE = { kind: "passphrase", passphrase: PASSPHRASE } as const;
const fresh = (): string => `lares:gate-${crypto.randomUUID()}`;
const refusalOf = async (work: Promise<unknown>): Promise<string> => { const e = await work.catch((err: unknown) => err); expect(e, String(e)).toBeInstanceOf(GateRefused); return (e as GateRefused).refusal; };

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
const stands = async (idbName: string): Promise<boolean> => (await indexedDB.databases()).some((db) => db.name === idbName);

/** The ceremony's own gate env, its census scoped to this witness's store, counting the proof workers it spawns. */
function gateOver(idbName: string) {
  let spawned = 0;
  const env = ambientGateEnv(() => { spawned++; return spawnProofWorker(); }, [idbName]);
  return { env, spawned: () => spawned };
}
/** The ceremony's own burn, scoped to this witness's store, under one raised ask. */
function burnOver(idbName: string) {
  const askId = crypto.randomUUID();
  const said: string[] = [], signals: ResetSignal[] = [];
  recordResetAsk(localStorage, askId);
  const ambient = ambientResetEnv((msg) => { signals.push(msg); }, (words) => { said.push(words); });
  const env: ResetEnv = { ...ambient, databases: async () => [idbName], workers: null, opfs: null, caches: null, storages: [] };
  return { env, askId, said, signals };
}

test("H1 RED custody standing and locked: the typed phrase and a wrong passphrase burn nothing, the right passphrase burns; H8 no word carries the secret", { timeout: 180_000 }, async () => {
  if (typeof indexedDB.databases !== "function") return;
  const idbName = fresh();
  await sealBrowserKeystore(idbName, ROUTE);
  lockBrowserCustody(idbName);
  // CONTROL: the store rests sealed and this thread holds no unlock.
  expect(await readBrowserCustody(idbName)).toMatchObject({ reading: "sealed", unlocked: false });
  const gate = gateOver(idbName);
  const burn = burnOver(idbName);
  const lines: string[] = [];
  const spies = (["log", "info", "warn", "error", "debug"] as const).map((level) => vi.spyOn(console, level).mockImplementation((...args: unknown[]) => { lines.push(args.map(String).join(" ")); }));
  expect(await readGateStanding(gate.env)).toEqual({ standing: "held", stores: [idbName] });
  const before = await census(idbName);

  const wrongGuess = "a wrong but secret guess";
  const refused = (work: Promise<unknown>): Promise<GateRefused> => work.then(() => { throw new Error("the gate passed"); }, (e: unknown) => e as GateRefused);
  const refusals = [
    await refused(passCriticalGate(RESET_PROCEDURE, gate.env, { value: RESET_PHRASE }, "passphrase")),
    await refused(passCriticalGate(RESET_PROCEDURE, gate.env, { value: wrongGuess }, "passphrase")),
  ];
  expect(refusals.map((r) => r.refusal)).toEqual(["no-slot-opens", "no-slot-opens"]);
  expect(await census(idbName), "neither refusal wrote a row").toEqual(before);
  expect(await stands(idbName), "nothing burned").toBe(true);
  expect(burn.signals, "no tab was told to stand down").toEqual([]);
  expect(await readBrowserCustody(idbName), "the gate unlocked nothing").toMatchObject({ reading: "sealed", unlocked: false });

  // THE RIGHT PASSPHRASE passes, and the pass burns the store.
  const field = { value: PASSPHRASE };
  const pass = await passCriticalGate(RESET_PROCEDURE, gate.env, field, "passphrase");
  expect(field.value).toBe("");
  expect(pass.by).toBe("passphrase");
  const report = await burnPlace(burn.env, burn.askId, pass);
  expect(report.databases).toEqual([idbName]);
  expect(await stands(idbName), "the right passphrase burned the store").toBe(false);
  expect(burn.signals.map((s) => s.t)).toEqual(["reset:stand-down", "reset:burned"]);
  for (const spy of spies) spy.mockRestore();

  // H8: no word this page read, said, signalled, recorded or logged carries either typed secret.
  const everything = JSON.stringify({ refusals: refusals.map((r) => [r.refusal, r.message, r.stack]), pass, report, said: burn.said, signals: burn.signals, record: localStorage.getItem(resetAskKey(burn.askId)), lines });
  for (const secret of [PASSPHRASE, wrongGuess]) expect(everything.includes(secret), everything).toBe(false);
  expect(everything, "CONTROL: the haystack holds the public words").toContain("no-slot-opens");
});

test("H2 locked and unlocked read the same: one store draws the same standing, refusal and pass whatever this thread holds open", { timeout: 180_000 }, async () => {
  if (typeof indexedDB.databases !== "function") return;
  const idbName = fresh();
  await sealBrowserKeystore(idbName, ROUTE);
  const answers = async () => {
    const gate = gateOver(idbName);
    return [
      await readGateStanding(gate.env),
      await refusalOf(passCriticalGate(RESET_PROCEDURE, gate.env, { value: "a guess" }, "passphrase")),
      await passCriticalGate(RESET_PROCEDURE, gate.env, { value: PASSPHRASE }, "passphrase"),
    ];
  };
  expect(await readBrowserCustody(idbName)).toMatchObject({ reading: "sealed", unlocked: true });
  const unlocked = await answers();
  lockBrowserCustody(idbName);
  expect(await readBrowserCustody(idbName)).toMatchObject({ reading: "sealed", unlocked: false });
  expect(await answers()).toEqual(unlocked);
  indexedDB.deleteDatabase(idbName);
});

test("H3 a bare floor: no tree reads bare, the typed phrase alone burns, and no proof worker spawns", { timeout: 60_000 }, async () => {
  if (typeof indexedDB.databases !== "function") return;
  const idbName = fresh();
  (await openVesselIdb(idbName)).close();
  const gate = gateOver(idbName);
  expect(await readGateStanding(gate.env)).toEqual({ standing: "bare", stores: [] });
  expect(await refusalOf(passCriticalGate(RESET_PROCEDURE, gate.env, { value: PASSPHRASE }, "typed-phrase"))).toBe("gate-words-differ");
  const burn = burnOver(idbName);
  await burnPlace(burn.env, burn.askId, await passCriticalGate(RESET_PROCEDURE, gate.env, { value: RESET_PHRASE }, "typed-phrase"));
  expect(await stands(idbName)).toBe(false);
  expect(gate.spawned(), "a bare floor needs no proof").toBe(0);
});

test("H4 a joined face alone: the face's own passphrase passes the gate, a wrong one refuses", { timeout: 180_000 }, async () => {
  if (typeof indexedDB.databases !== "function") return;
  const idbName = fresh();
  await bindFirstFaceSlot(idbName, "persona-group-joined", ROUTE);
  lockFaceCustody(idbName, "persona-group-joined");
  expect(await readBrowserCustody(idbName), "no place passphrase stands").toEqual({ reading: "clear" });
  const gate = gateOver(idbName);
  expect((await readGateStanding(gate.env)).standing).toBe("held");
  expect(await refusalOf(passCriticalGate(RESET_PROCEDURE, gate.env, { value: RESET_PHRASE }, "passphrase"))).toBe("no-slot-opens");
  expect((await passCriticalGate(RESET_PROCEDURE, gate.env, { value: PASSPHRASE }, "passphrase")).by).toBe("passphrase");
  indexedDB.deleteDatabase(idbName);
});

test("H5 unverifiable: a slot tree that does not read takes the typed phrase under its own name; CONTROL: it read held first", { timeout: 180_000 }, async () => {
  if (typeof indexedDB.databases !== "function") return;
  const idbName = fresh();
  await sealBrowserKeystore(idbName, ROUTE);
  lockBrowserCustody(idbName);
  const gate = gateOver(idbName);
  expect((await readGateStanding(gate.env)).standing, "CONTROL").toBe("held");
  const db = await openVesselIdb(idbName);
  const tx = db.transaction("keystore", "readwrite");
  tx.objectStore("keystore").put(new TextEncoder().encode("{ not a slot tree"), GATE_PLACE_TREE_ROW);
  await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
  db.close();
  const read = await readGateStanding(gate.env);
  expect(read.standing).toBe("unverifiable");
  expect(gateDemandOf(read.standing)).toBe("typed-phrase-unopened");
  // The form that still shows the passphrase ask learns the demand moved; the typed phrase then passes under its own name.
  expect(await refusalOf(passCriticalGate(RESET_PROCEDURE, gate.env, { value: PASSPHRASE }, "passphrase"))).toBe("gate-demand-moved");
  expect((await passCriticalGate(RESET_PROCEDURE, gate.env, { value: RESET_PHRASE }, "typed-phrase-unopened")).by).toBe("typed-phrase-unopened");
  indexedDB.deleteDatabase(idbName);
});

test("H6 no verifier, no pass: custody that reads and a proof that cannot stand refuse gate-verifier-absent, and typed words pass nothing", { timeout: 180_000 }, async () => {
  if (typeof indexedDB.databases !== "function") return;
  const idbName = fresh();
  await sealBrowserKeystore(idbName, ROUTE);
  lockBrowserCustody(idbName);
  const throwing: GateEnv = ambientGateEnv(() => { throw new Error("no workers here"); }, [idbName]);
  expect(await refusalOf(readGateStanding(throwing))).toBe("gate-verifier-absent");
  for (const painted of ["typed-phrase", "passphrase", "typed-phrase-unopened"] as const) {
    expect(await refusalOf(passCriticalGate(RESET_PROCEDURE, throwing, { value: RESET_PHRASE }, painted)), painted).toBe("gate-verifier-absent");
  }
  // A worker whose script does not load. Its address names a blob this document revoked, so no server answers it: a path
  // the dev server holds no file for comes back as the app's own index.html, whose module graph the server then loads,
  // optimizes afresh and reloads the test page under (the next file's iframe never stands).
  const revoked = URL.createObjectURL(new Blob(["postMessage(0)"], { type: "text/javascript" }));
  URL.revokeObjectURL(revoked);
  const unloaded: GateEnv = ambientGateEnv(() => new Worker(revoked, { type: "module" }), [idbName]);
  expect(await refusalOf(readGateStanding(unloaded))).toBe("gate-verifier-absent");
  expect(await stands(idbName)).toBe(true);
  indexedDB.deleteDatabase(idbName);
});

test("H7 the weld: the gate's keystore names equal the proof module's", () => {
  expect(GATE_KEYSTORE).toBe(PROOF_KEYSTORE);
  expect(GATE_PLACE_TREE_ROW).toBe(PROOF_PLACE_TREE_ROW);
  expect(GATE_FACE_TREE_PREFIX).toBe(PROOF_FACE_TREE_PREFIX);
  expect([...GATE_SEALED_PREFIXES]).toEqual([...PROOF_SEALED_PREFIXES]);
});
