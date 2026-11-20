/**
 * reset-ceremony — THE RESET: THIS BROWSER VESSEL RETURNS TO ITS ANON FLOOR (browser-vessel-lift#/the-reset), in a real engine.
 *
 * The device's holder owns the return to the floor (dreamnet-rhizome#/the-ground: every vessel "MUST always return"). The
 * page's script burns nothing; the ceremony document takes the holder's confirmation through the confirm gate and burns the
 * place itself, and every tab of the origin hears it on one channel. Every burn here spends a pass the gate minted.
 *
 *   R1 RED   the burn reads its census first, tells every tab to stand down, then burns every database the origin names, the
 *            file system, the caches, the vessel's own storage keys and the service worker, and says `reset:burned` last.
 *            CONTROL: a storage key outside the vessel's prefix stays.
 *   R2 RED   at a bare floor the typed words decide (the confirm gate asks a passphrase where custody stands,
 *            `critical-gate.test.ts`): the phrase confirms in any case and spacing, any other words do not; the navigation's `#reset=<id>` names a reset ask and `#ask=<id>` never does. The reset ceremony stands
 *            with no secure context and no broker (no ward and no missing worker blocks the return), and refuses a frame and
 *            a policy out of force by name.
 *   R3 RED   over the engine's own IndexedDB, caches and storage: a database another context holds open blocks, the
 *            ceremony names the store it waits on (in words, and as the named `waits` state) and gives up on no clock, and the
 *            burn lands when that context lets go.
 *            Afterwards the origin names no such database, cache or key.
 *   R4 RED   A SECOND TAB: every tab hears the ceremony on the origin's reset channel. On `reset:stand-down` a tab stands
 *            its vessel down once and does not reload; on `reset:burned` it clears its own session keys and boots afresh;
 *            on `reset:declined` it takes the notice down and moves nothing else. CONTROL: a malformed signal moves nothing.
 *   R5       an engine that names no database list refuses `reset-census-absent` before any tab stands down or any byte burns.
 *   R6 RED   THE CEREMONY BURNS ONLY FOR AN ASK A PAGE OF THIS ORIGIN RAISED. The page records each reset ask it paints under
 *            the vessel's own storage prefix (`lares:reset-ask:<id>`); the ceremony refuses `reset-unasked` for an id the
 *            record does not name, at its stand and again at the burn, before the census reads, any tab stands down or any
 *            byte burns. The burn keeps the ask's record until every other surface burned (a burn that stops midway confirms
 *            again) and turns it to its burned receipt before it says `reset:burned`. A storage that withholds itself records
 *            nothing, so it reads unasked. CONTROL: the recorded id burns; a burned id and a forgotten id (declined,
 *            withdrawn) refuse again.
 *   R7 RED   A TAB HONOURS THE CHANNEL ONLY FOR A STANDING ASK. `reset:stand-down` for an id the origin's record does not
 *            name moves nothing; `reset:burned` moves nothing unless this tab stood down for that very id; `reset:declined`
 *            takes down only a reset ask this tab's page shows. CONTROL: R4 walks the standing id through all three.
 *   R7b RED  A LATE TAB: the channel keeps no order with the record. A tab whose words arrive only after the burn settled the
 *            record still stands down and reloads on the burned receipt, in either delivery order. CONTROL: another id moves nothing.
 *   R8 RED   EVERY STORAGE KEY THE PAGE WRITES RIDES THE VESSEL'S PREFIX, the mirror's two per-tab records among them, so
 *            the burn and each tab's own clearing reach them. A census of every `*_KEY` constant under `src/` reads the
 *            prefix. CONTROL: a tab's clearing removes the mirror's records and leaves another hand's key.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift
 */
import { expect, test } from "vitest";
import { RESET_CHANNEL, type ResetSignal } from "../src/ceremony-protocol.js";
import { askIdOf, resetAskOf } from "../src/ceremony/ceremony-core.js";
import { passCriticalGate, typedConfirms as phraseConfirms, type GatePass } from "../src/ceremony/critical-gate.js";
import {
  ambientResetEnv, burnPlace, clearOwnedKeys, forgetResetAsk, OWNED_STORAGE_PREFIX, recordResetAsk, RESET_PHRASE, RESET_PROCEDURE, resetAskBurned, resetAskKey, resetAskStands,
  ResetRefused, resetRefusal, type AskRecord, type ResetEnv,
} from "../src/ceremony/reset-core.js";
import { mirrorEvidenceKey, mirrorStandingKey } from "../src/glass/stand.js";
import { standResetTab } from "../src/reset-tab.js";

const ASK = "00000000-0000-4000-8000-0000000000aa";

/** A fresh pass through the confirm gate at a bare floor (`critical-gate.test.ts` reads the gate's own law): every burn here spends one. */
const passed = (): Promise<GatePass> => passCriticalGate(RESET_PROCEDURE, { census: async () => [], readable: async () => 0, prove: async () => "unverifiable" }, { value: RESET_PHRASE }, "typed-phrase");
const typedConfirms = (typed: string): boolean => phraseConfirms(typed, RESET_PHRASE);

/** A storage over a plain map, as the burn reads one. */
function storageOf(entries: Record<string, string>) {
  const map = new Map(Object.entries(entries));
  return { map, storage: {
    get length() { return map.size; }, key: (i: number) => [...map.keys()][i] ?? null, removeItem: (k: string) => { map.delete(k); },
    getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); },
  } };
}
/** The origin's record with `ASK` raised on it, as a page that painted the ask leaves it. */
const raised = (...ids: string[]) => storageOf(Object.fromEntries(ids.map((id) => [resetAskKey(id), "raised"])));

test("R1 RED the burn reads its census, stands every tab down, burns each surface in order and says burned last; CONTROL: a foreign key stays", async () => {
  const log: string[] = [];
  const local = storageOf({ "lares:floor-card:http://h": "card", "lares:floor-anchor:http://h": "aid", "tiddlywiki-theme": "dark", [resetAskKey(ASK)]: "raised" });
  const session = storageOf({ "lares:tab-face": "pg-1" });
  const env: ResetEnv = {
    databases: async () => { log.push("census"); return ["lares:vessel", "lares:continuity", "automerge-daemon"]; },
    deleteDatabase: async (name) => { log.push(`db ${name}`); },
    opfs: async () => ({ entries: async () => ["cas", "labels"], remove: async (name) => { log.push(`file ${name}`); } }),
    caches: { keys: async () => ["genesis"], delete: async (name) => { log.push(`cache ${name}`); return true; } },
    storages: [local.storage, session.storage], record: local.storage,
    workers: { getRegistrations: async () => [{ unregister: async () => { log.push("worker"); return true; } }] },
    signal: (msg) => { log.push(msg.t); },
    say: () => {},
  };
  const report = await burnPlace(env, ASK, await passed());
  expect(log).toEqual(["census", "reset:stand-down", "db automerge-daemon", "db lares:continuity", "db lares:vessel", "file cas", "file labels", "cache genesis", "worker", "reset:burned"]);
  expect(report).toEqual({ databases: ["automerge-daemon", "lares:continuity", "lares:vessel"], files: 2, caches: 1, storageKeys: 3, workers: 1 });
  expect([...session.map.keys()]).toEqual([]);
  // CONTROL: the reset removes the vessel's own keys and no other hand's; the ask's record stays as its burned receipt.
  expect(Object.fromEntries(local.map)).toEqual({ "tiddlywiki-theme": "dark", [resetAskKey(ASK)]: "burned" });
});

test("R2 RED the typed words decide; #reset names a reset ask; the reset ceremony stands with no secure context and no broker", () => {
  expect(typedConfirms(RESET_PHRASE)).toBe(true);
  expect(typedConfirms("  Reset  This Browser ")).toBe(true);
  for (const other of ["", "reset", "yes", "reset this browser now", "this face keeps its own fire"]) expect(typedConfirms(other), other).toBe(false);
  expect(resetAskOf(`#reset=${ASK}`)).toBe(ASK);
  expect(resetAskOf(`#ask=${ASK}`), "a vessel's ask never reads as a reset").toBeNull();
  expect(askIdOf(`#reset=${ASK}`), "a reset never reads as a vessel's ask").toBeNull();
  expect(resetAskOf("#reset=not-an-id")).toBeNull();
  // The return to the floor needs its clean document alone: neither a secure context nor a service worker stands before it.
  expect(resetRefusal({ framed: false, opened: false, evalRuns: false, asked: true })).toBeNull();
  expect(resetRefusal({ framed: false, opened: true, evalRuns: false, asked: true }), "an opener could read the gate's field").toBe("ceremony-has-opener");
  expect(resetRefusal({ framed: true, opened: false, evalRuns: false, asked: true })).toBe("ceremony-framed");
  expect(resetRefusal({ framed: false, opened: false, evalRuns: true, asked: true })).toBe("ceremony-csp-absent");
});

const openDb = (name: string): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open(name, 1);
  request.onupgradeneeded = () => { request.result.createObjectStore("keystore"); };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

test("R3 RED over the engine's own stores: a database another context holds blocks and names itself, then burns when that context lets go", async () => {
  if (typeof indexedDB.databases !== "function") return;   // R5 reads the engine that names no list
  const mine = `lares:reset-witness-${crypto.randomUUID()}`;
  const held = await openDb(mine);                          // "another tab": a connection the burn does not own
  held.onversionchange = () => { /* a tab that does not let go: it ignores the platform's word */ };
  const cacheName = `lares-reset-${crypto.randomUUID()}`;
  if (typeof caches !== "undefined") await (await caches.open(cacheName)).put("/reset-witness", new Response("held"));
  localStorage.setItem("lares:reset-witness", "kept"); localStorage.setItem("another-hand", "stays");
  expect(recordResetAsk(localStorage, ASK), "the page's record lands in the origin's own storage").toBe(true);
  const said: string[] = [], signals: ResetSignal[] = [];
  const waited: (string | null)[] = [];
  const env = { ...ambientResetEnv((msg) => { signals.push(msg); }, (words) => { said.push(words); }), waits: (db: string | null) => { waited.push(db); } };
  // This witness burns its own database alone, so a test file beside it keeps its stores.
  const scoped: ResetEnv = { ...env, databases: async () => [mine], workers: null, opfs: null, caches: env.caches ? { keys: async () => [cacheName], delete: (n) => env.caches!.delete(n) } : null };
  let landed = false;
  const burn = burnPlace(scoped, ASK, await passed()).then((report) => { landed = true; return report; });
  for (let i = 0; i < 200 && !said.some((w) => w.includes("still holds")); i++) await new Promise((r) => setTimeout(r, 25));
  expect(said.find((w) => w.includes("still holds")), "the ceremony names the store it waits on").toContain(mine);
  expect(landed, "the burn waits on the tab and gives up on no clock").toBe(false);
  expect(waited, "the blocked delete stands as a named state, never a silent stall").toEqual([mine]);
  expect(signals.map((s) => s.t)).toEqual(["reset:stand-down"]);
  held.close();                                             // the other tab closes
  const report = await burn;
  expect(report.databases).toEqual([mine]);
  expect((await indexedDB.databases()).map((db) => db.name)).not.toContain(mine);
  if (typeof caches !== "undefined") expect(await caches.has(cacheName)).toBe(false);
  expect(localStorage.getItem("lares:reset-witness")).toBeNull();
  expect(waited, "the named wait clears once the delete lands").toEqual([mine, null]);
  expect(resetAskStands(localStorage, ASK), "the burned ask stands no longer").toBe(false);
  expect(resetAskBurned(localStorage, ASK), "its record holds the burned receipt").toBe(true);
  forgetResetAsk(localStorage, ASK);
  expect(localStorage.getItem("another-hand")).toBe("stays");
  expect(signals.map((s) => s.t)).toEqual(["reset:stand-down", "reset:burned"]);
  localStorage.removeItem("another-hand");
});

test("R4 RED a second tab stands its vessel down on the ceremony's word, boots afresh once the place burned, and a decline moves nothing else", async () => {
  const ceremony = new BroadcastChannel(RESET_CHANNEL);
  const record = raised(ASK);
  const tabs = ["asking", "second"].map((name) => {
    const heard = new BroadcastChannel(RESET_CHANNEL);
    const session = storageOf({ "lares:tab-face": `pg-${name}`, "lares:found-face": "face", "wiki-scroll": "40" });
    const acts: string[] = [];
    const tab = standResetTab({
      listen: (listener) => heard.addEventListener("message", (e: MessageEvent) => listener(e.data)),
      standDown: () => { acts.push("stand-down"); }, reload: () => { acts.push("reload"); },
      session: session.storage, settle: (askId) => { acts.push(`settle ${askId}`); }, say: (words) => { acts.push(`say ${words.slice(0, 20)}`); },
      record: record.storage, shows: (askId) => name === "asking" && askId === ASK,
    });
    return { name, acts, session, tab, close: () => heard.close() };
  });
  const settled = async (what: string, ok: () => boolean): Promise<void> => { for (let i = 0; i < 200 && !ok(); i++) await new Promise((r) => setTimeout(r, 10)); expect(ok(), what).toBe(true); };

  // CONTROL: a malformed signal moves nothing.
  ceremony.postMessage({ t: "reset:burned" }); ceremony.postMessage("reset:stand-down"); ceremony.postMessage({ t: "reset:erase", askId: ASK });
  ceremony.postMessage({ t: "reset:declined", askId: ASK } satisfies ResetSignal);
  await settled("the asking tab settles the declined ask", () => tabs[0]!.acts.includes(`settle ${ASK}`));
  expect(tabs[0]!.acts, "asking: a decline and three malformed signals move nothing else").toEqual([`settle ${ASK}`]);
  expect(tabs[1]!.acts, "second: it shows no such ask, so nothing moves").toEqual([]);
  for (const t of tabs) expect(t.tab.stoodDown()).toBe(false);

  ceremony.postMessage({ t: "reset:stand-down", askId: ASK } satisfies ResetSignal);
  ceremony.postMessage({ t: "reset:stand-down", askId: ASK } satisfies ResetSignal);
  await settled("each tab stands down", () => tabs.every((t) => t.tab.stoodDown()));
  for (const t of tabs) {
    expect(t.acts.filter((a) => a === "stand-down"), `${t.name} stands its vessel down once`).toEqual(["stand-down"]);
    expect(t.acts, `${t.name} keeps standing as a page until the place burned`).not.toContain("reload");
    expect([...t.session.map.keys()], "nothing clears before the burn").toContain("lares:tab-face");
  }
  ceremony.postMessage({ t: "reset:burned", askId: ASK } satisfies ResetSignal);
  await settled("each tab boots afresh", () => tabs.every((t) => t.acts.includes("reload")));
  for (const t of tabs) expect([...t.session.map.keys()], `${t.name} clears its own session keys and no other hand's`).toEqual(["wiki-scroll"]);
  for (const t of tabs) t.close();
  ceremony.close();
});

test("R5 an engine that names no database list refuses reset-census-absent before any tab stands down or any byte burns", async () => {
  const log: string[] = [];
  const env: ResetEnv = { databases: null, deleteDatabase: async (n) => { log.push(n); }, opfs: null, caches: null, storages: [storageOf({ "lares:tab-face": "pg" }).storage], record: raised(ASK).storage, workers: null, signal: (m) => { log.push(m.t); }, say: () => {} };
  const refused = await burnPlace(env, ASK, await passed()).catch((e: unknown) => e);
  expect(refused).toBeInstanceOf(ResetRefused);
  expect((refused as ResetRefused).refusal).toBe("reset-census-absent");
  expect(log).toEqual([]);
});

const OTHER = "00000000-0000-4000-8000-0000000000bb";

test("R6 RED the ceremony burns only for an ask a page of this origin raised: an unrecorded id refuses reset-unasked before anything moves; CONTROL: the recorded id burns", async () => {
  // The ceremony's stand: its clean document, and an ask the origin's record names.
  expect(resetRefusal({ framed: false, opened: false, evalRuns: false, asked: false })).toBe("reset-unasked");
  expect(resetRefusal({ framed: true, opened: false, evalRuns: false, asked: false }), "a frame names itself first").toBe("ceremony-framed");
  // The record: a page's paint writes it, the ceremony reads it, a decline or a withdrawal forgets it.
  const origin = storageOf({});
  expect(resetAskStands(origin.storage, ASK)).toBe(false);
  expect(recordResetAsk(origin.storage, ASK)).toBe(true);
  expect([...origin.map.keys()], "the record rides the vessel's own prefix, one key per ask").toEqual([`lares:reset-ask:${ASK}`]);
  expect(resetAskStands(origin.storage, ASK)).toBe(true);
  expect(resetAskStands(origin.storage, OTHER), "one ask's record names no other id").toBe(false);
  // A storage that withholds itself records nothing, and reads unasked.
  const withheld: AskRecord = { getItem: () => { throw new Error("SecurityError"); }, setItem: () => { throw new Error("SecurityError"); }, removeItem: () => { throw new Error("SecurityError"); } };
  expect(recordResetAsk(withheld, ASK)).toBe(false);
  expect(recordResetAsk(null, ASK)).toBe(false);
  expect(resetAskStands(withheld, ASK)).toBe(false);
  expect(resetAskStands(null, ASK)).toBe(false);
  expect(() => forgetResetAsk(withheld, ASK)).not.toThrow();

  // THE BURN refuses an id the record does not name, before the census reads, a tab stands down or a byte burns.
  const log: string[] = [];
  const session = storageOf({ "lares:tab-face": "pg-1" });
  const env = (record: AskRecord): ResetEnv => ({
    databases: async () => { log.push("census"); return ["lares:vessel"]; },
    deleteDatabase: async (name) => { log.push(`db ${name}`); },
    opfs: null, caches: null, storages: [origin.storage, session.storage], record,
    workers: { getRegistrations: async () => [{ unregister: async () => { log.push(`worker (ask recorded: ${String(resetAskStands(record, ASK))})`); return true; } }] },
    signal: (msg) => { log.push(`${msg.t} (ask recorded: ${String(resetAskStands(record, msg.askId))})`); }, say: () => {},
  });
  const refused = await burnPlace(env(origin.storage), OTHER, await passed()).catch((e: unknown) => e);
  expect(refused, "a bare link's id burns nothing").toBeInstanceOf(ResetRefused);
  expect((refused as ResetRefused).refusal).toBe("reset-unasked");
  expect(log, "nothing read, signalled or burned").toEqual([]);
  expect([...session.map.keys()]).toEqual(["lares:tab-face"]);

  // CONTROL: the recorded id burns. Its record outlives every other surface, so a burn that stops midway confirms again,
  // and it leaves before the tabs hear `reset:burned`.
  await burnPlace(env(origin.storage), ASK, await passed());
  expect(log).toEqual(["census", "reset:stand-down (ask recorded: true)", "db lares:vessel", "worker (ask recorded: true)", "reset:burned (ask recorded: false)"]);
  expect(Object.fromEntries(origin.map), "the burn leaves the ask's burned receipt and no other record").toEqual({ [resetAskKey(ASK)]: "burned" });
  expect(resetAskStands(origin.storage, ASK), "a receipt stands no ceremony").toBe(false);
  // A burned id stands no second ceremony: its receipt reads unasked.
  log.length = 0;
  expect(((await burnPlace(env(origin.storage), ASK, await passed()).catch((e: unknown) => e)) as ResetRefused).refusal).toBe("reset-unasked");
  expect(log, "a settled id reads, signals and burns nothing").toEqual([]);
  // A forgotten id (the person declined, or withdrew the ask on the page) refuses again.
  log.length = 0;
  recordResetAsk(origin.storage, ASK); forgetResetAsk(origin.storage, ASK);
  expect(((await burnPlace(env(origin.storage), ASK, await passed()).catch((e: unknown) => e)) as ResetRefused).refusal).toBe("reset-unasked");
  expect(log).toEqual([]);
});

test("R7 RED a tab honours the reset channel only for a standing ask: an unrecorded stand-down, a burned it never stood down for and a decline it does not show move nothing", async () => {
  const acts: string[] = [];
  const record = raised(ASK);
  const session = storageOf({ "lares:tab-face": "pg-1", "wiki-scroll": "40" });
  let hear: (msg: unknown) => void = () => {};
  const tab = standResetTab({
    listen: (listener) => { hear = listener; },
    standDown: () => { acts.push("stand-down"); }, reload: () => { acts.push("reload"); },
    session: session.storage, settle: (askId) => { acts.push(`settle ${askId}`); }, say: () => {},
    record: record.storage, shows: (askId) => askId === ASK,
  });
  // An id no page raised: any script of the origin can say these words on the channel, and they move nothing.
  hear({ t: "reset:stand-down", askId: OTHER } satisfies ResetSignal);
  hear({ t: "reset:burned", askId: OTHER } satisfies ResetSignal);
  hear({ t: "reset:declined", askId: OTHER } satisfies ResetSignal);
  // The standing id's `burned` before this tab stood down for it: no reload, no cleared key.
  hear({ t: "reset:burned", askId: ASK } satisfies ResetSignal);
  expect(acts, "no signal for an unrecorded id, and no burned without its stand-down, moves this tab").toEqual([]);
  expect(tab.stoodDown()).toBe(false);
  expect([...session.map.keys()], "the tab keeps its session keys").toEqual(["lares:tab-face", "wiki-scroll"]);
  // CONTROL: the standing id walks through. The burn removed the record before `reset:burned`, and the tab still honours it.
  hear({ t: "reset:stand-down", askId: ASK } satisfies ResetSignal);
  expect(acts).toEqual(["stand-down"]);
  hear({ t: "reset:burned", askId: OTHER } satisfies ResetSignal);
  expect(acts, "another id's burned still moves nothing").toEqual(["stand-down"]);
  forgetResetAsk(record.storage, ASK);
  hear({ t: "reset:burned", askId: ASK } satisfies ResetSignal);
  expect(acts).toEqual(["stand-down", "reload"]);
  expect([...session.map.keys()]).toEqual(["wiki-scroll"]);
});

test("R7b RED A LATE TAB: the channel keeps no order with the record, so a tab that hears the ceremony only after the burn settled the record still stands down and boots afresh, in either delivery order; CONTROL: a prompt tab walks as before", async () => {
  const origin = raised(ASK);
  /** A tab whose channel words wait in a queue until the test hands them over, beside one that hears each word at once. */
  const standTab = (name: string) => {
    const acts: string[] = [];
    const queue: unknown[] = [];
    let hear: (msg: unknown) => void = () => {};
    const tab = standResetTab({
      listen: (listener) => { hear = listener; },
      standDown: () => { acts.push("stand-down"); }, reload: () => { acts.push("reload"); },
      session: storageOf({ "lares:tab-face": `pg-${name}` }).storage, settle: () => {}, say: () => {},
      record: origin.storage, shows: () => false,
    });
    return { acts, tab, queue, hear: (msg: unknown) => hear(msg) };
  };
  const prompt = standTab("prompt"), late = standTab("late"), reversed = standTab("reversed");
  const env: ResetEnv = {
    databases: async () => ["lares:vessel"], deleteDatabase: async () => {}, opfs: null, caches: null,
    storages: [origin.storage], record: origin.storage, workers: null, say: () => {},
    signal: (msg) => { prompt.hear(msg); late.queue.push(msg); reversed.queue.unshift(msg); },
  };
  await burnPlace(env, ASK, await passed());
  expect(prompt.acts, "CONTROL: a tab that hears each word at once stands down, then reloads").toEqual(["stand-down", "reload"]);
  expect(resetAskStands(origin.storage, ASK), "the burn settled the record before either late tab heard a word").toBe(false);
  expect(late.acts.length + reversed.acts.length, "nothing reached the late tabs yet").toBe(0);
  // The queued words land now, against the settled record: stand-down then burned, and burned before stand-down.
  for (const msg of late.queue) late.hear(msg);
  for (const msg of reversed.queue) reversed.hear(msg);
  expect(late.acts, "a late stand-down for a burned id stands down, and its burned reloads").toEqual(["stand-down", "reload"]);
  expect(reversed.acts[0], "a burned word that arrives first still boots the tab afresh").toBe("reload");
  expect(late.tab.stoodDown() && reversed.tab.stoodDown()).toBe(true);
  // CONTROL: the receipt names one id; another id's words still move nothing.
  const other = standTab("other");
  other.hear({ t: "reset:stand-down", askId: OTHER } satisfies ResetSignal);
  other.hear({ t: "reset:burned", askId: OTHER } satisfies ResetSignal);
  expect(other.acts).toEqual([]);
});

test("R8 RED every storage key the page writes rides the vessel's prefix, the mirror's per-tab records among them; CONTROL: another hand's key stays", () => {
  // THE CENSUS: every `*_KEY` constant under `src/` names a storage key, and each reads the vessel's own prefix.
  const sources = import.meta.glob("../src/**/*.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
  const keys = Object.entries(sources).flatMap(([file, src]) => [...src.matchAll(/const ([A-Z0-9_]+_KEY) = [`"]([^`"]*)[`"]/g)].map((m) => ({ file, name: m[1]!, key: m[2]! })));
  expect(keys.map((k) => k.name), "the census reads the page's, the port's and the mirror's keys (a zero would read nothing)").toEqual(expect.arrayContaining(["TAB_FACE_KEY", "FLOOR_CARD_KEY", "MIRROR_EVIDENCE_KEY", "MIRROR_STANDING_KEY", "RESET_ASK_KEY"]));
  expect(keys.filter((k) => !k.key.startsWith(OWNED_STORAGE_PREFIX)).map((k) => `${k.file} ${k.name}=${k.key}`), "storage keys outside the vessel's prefix").toEqual([]);
  // The mirror's two records, as a tab holds them, leave with the tab's own clearing.
  expect(mirrorEvidenceKey("wiki")).toBe("lares:mirror:began:wiki");
  expect(mirrorStandingKey("wiki")).toBe("lares:mirror:full-standing:wiki");
  const tab = storageOf({ [mirrorEvidenceKey("wiki")]: "began", [mirrorStandingKey("wiki")]: "standing", "lares:tab-face": "pg", "another-hand": "stays" });
  expect(clearOwnedKeys(tab.storage)).toBe(3);
  expect([...tab.map.keys()]).toEqual(["another-hand"]);
});
