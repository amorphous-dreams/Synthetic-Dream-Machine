/**
 * vessel-sessions — each page port opens a session the tab admits by its OWN unlock, and the face's last admitted session
 * closing returns the vessel to its floor (browser-vessel-lift slice 3 part i; session-contract#/how-a-session-ends).
 *
 *   VS1 RED: of two tabs, B with no unlock reads no sealed row and signs nothing (`session-unadmitted`).
 *       CONTROL: A, admitted by its own unlock, reaches the lit vessel.
 *   VS2 RED: B admits by its OWN unlock (the house asks B though A's unlock already holds the key); B closes and A still
 *       works; A then closes and the lock runs: the act in flight ends (`lock-ended`), the vessel flushes and comes down,
 *       the content-key holder locks, the tree key gets overwritten, no key stands (the census reads none), the floor reads
 *       `floor`, a sealed row refuses `sealed-locked`, and a reopened tab asks again.
 *   VS3 RED: an abrupt tab loss (its worker killed, no close) still drops its session through the lifetime lock, and the
 *       last one's drop runs the lock. CONTROL: a tab that stays keeps its session.
 *       RED: the house's own liveness budget drops a silent session after its sweeps; CONTROL: a heard one stays.
 *   VS4 RED: a second vessel worker over a held store refuses `store-owned`. CONTROL: once the first gives the store back,
 *       a worker stands over it.
 *   VS5 RED: a respawned house mints a fresh `ownerEpoch` and fresh ids, and refuses an earlier greeting by name
 *       (`stale-owner-epoch`; a session it never minted reads `unknown-session`).
 *
 * THE COST. A passphrase pin derives with scrypt at N=2^17 (about half a second alone, several in a loaded worker); VS2 derives
 * four times (the seal, A, B, the reopened tab), VS1 twice. The other tests stand on a clear keystore and derive nothing.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift
 */
import { afterEach, describe, expect, test } from "vitest";
import { readyWorker } from "./fixtures/ready-worker.js";
import { generateOrLoadBrowserVesselIdentity } from "../src/browser-vessel-identity.js";
import { lockBrowserCustody, readBrowserCustody, readKeystoreRow, sealBrowserKeystore } from "../src/browser-custody.js";
import { sessionLifetimeLock, standVesselHouse, type LitVessel, type VesselHouse } from "../src/vessel-sessions.js";
import type { CustodyAsk } from "../src/browser-boot-custody.js";

const SLOW = 180_000;
const PASS = { kind: "passphrase", passphrase: "the hearth keeps its fire" } as const;

const houses: VesselHouse[] = [];
const workers: Worker[] = [];
afterEach(async () => {
  for (const w of workers.splice(0)) w.terminate();
  for (const h of houses.splice(0)) await h.release().catch(() => undefined);
});

function fakeVessel() {
  const v = { lit: 0, flushed: 0, closed: 0, keys: 2 };
  const make = (): LitVessel => {
    v.lit++;
    return {
      flush: async () => { v.flushed++; },
      close: async () => { v.closed++; },
      keyHolders: [{ lock: () => { v.keys = 0; }, held: () => v.keys }],
    };
  };
  return { v, light: () => Promise.resolve(make()) };
}

/** A tab's ceremony: it answers each ask with the route and counts what it was asked. */
function tab(route: typeof PASS | null = PASS) {
  const asked: CustodyAsk["kind"][] = [];
  return { asked, ask: (q: CustodyAsk) => { asked.push(q.kind); return Promise.resolve(route); } };
}

async function clearVessel(tag: string): Promise<string> {
  const idbName = `vessel-sessions-${tag}-${crypto.randomUUID()}`;
  await generateOrLoadBrowserVesselIdentity(idbName);
  return idbName;
}
async function sealedVessel(tag: string): Promise<string> {
  const idbName = await clearVessel(tag);
  await sealBrowserKeystore(idbName, PASS);
  lockBrowserCustody(idbName);   // a fresh vessel worker starts locked
  return idbName;
}
async function stand(idbName: string, light: () => Promise<LitVessel>, extra: Partial<Parameters<typeof standVesselHouse>[0]> = {}): Promise<VesselHouse> {
  const house = await standVesselHouse({ idbName, light, ...extra });
  houses.push(house);
  return house;
}
async function houseWorker(): Promise<Worker> {
  const w = await readyWorker(new URL("./fixtures/vessel-house.worker.ts", import.meta.url));
  workers.push(w);
  return w;
}
function ask<T>(w: Worker, msg: Record<string, unknown>): Promise<T> {
  return new Promise((resolve, reject) => {
    const onMessage = (e: MessageEvent): void => {
      if ((e.data as { op?: string }).op !== msg["op"]) return;
      w.removeEventListener("message", onMessage);
      if ((e.data as { error?: string }).error) reject(new Error(String((e.data as { error: string }).error))); else resolve(e.data as T);
    };
    w.addEventListener("message", onMessage);
    w.postMessage(msg);
  });
}
async function until(what: string, test: () => boolean, ms = 10_000): Promise<void> {
  const end = performance.now() + ms;
  while (!test()) {
    if (performance.now() > end) throw new Error(`waited ${String(ms)}ms for ${what}`);
    await new Promise((r) => setTimeout(r, 25));
  }
}

describe("each tab admits its own session", () => {
  test("VS1 of two tabs, B with no unlock reads no sealed row and signs nothing — CONTROL: A, admitted by its own unlock, reaches the vessel", async () => {
    const idbName = await sealedVessel("two-tabs");
    const { v, light } = fakeVessel();
    const house = await stand(idbName, light);
    const a = house.open({ tabId: "tab-a" }), b = house.open({ tabId: "tab-b" });
    const ta = tab();
    await house.admit(a.sessionId, { ask: ta.ask });
    expect(ta.asked).toEqual(["unlock"]);
    expect(house.require(a.sessionId), "CONTROL: A reaches the lit vessel").toBeTruthy();
    expect(v.lit).toBe(1);

    expect(() => house.require(b.sessionId)).toThrow(/session-unadmitted/);
    let ran = false;
    await expect(house.act(b.sessionId, async () => { ran = true; return readKeystoreRow(idbName, "vessel-key"); })).rejects.toMatchObject({ refusal: "session-unadmitted" });
    expect(ran, "B's act never runs, so it reads no sealed row and signs nothing").toBe(false);
    expect(b.admission).toBe("unadmitted");
    expect(house.census()).toMatchObject({ floor: "lit", sessions: 2, admitted: 1 });
  }, SLOW);

  test("VS2 B admits by its own unlock; B closes and A works; A closes, the lock runs, no key stands, the floor reads floor, and a reopened tab asks again", async () => {
    const idbName = await sealedVessel("last-tab");
    const { v, light } = fakeVessel();
    const house = await stand(idbName, light);
    const a = house.open({ tabId: "tab-a" });
    await house.admit(a.sessionId, { ask: tab().ask });
    expect(house.census().treeKeys).toBeGreaterThanOrEqual(1);

    // THE HOUSE ASKS B, though A's unlock already holds the key: no unlock passes between tabs.
    const b = house.open({ tabId: "tab-b" });
    const tb = tab();
    await house.admit(b.sessionId, { ask: tb.ask });
    expect(tb.asked).toEqual(["unlock"]);
    expect(b.admittedBy).toBe("unlock");
    expect(v.lit, "one vessel lights for the face").toBe(1);

    expect(await house.close(b.sessionId, "pagehide")).toBeNull();
    expect(house.require(a.sessionId), "A still works after B closes").toBeTruthy();
    expect((await readBrowserCustody(idbName))).toMatchObject({ unlocked: true });

    const inFlight = house.act(a.sessionId, () => new Promise<never>(() => { /* an act that never answers */ })).then(() => null, (e: unknown) => e);
    const report = await house.close(a.sessionId, "pagehide");
    expect(await inFlight, "the act in flight ends by name").toMatchObject({ refusal: "lock-ended" });
    expect(report).toMatchObject({ treeKeysOverwritten: 1, contentKeyHolders: 1, vesselDown: true, why: "pagehide" });
    expect(report!.actsEnded).toBeGreaterThanOrEqual(1);
    expect(v).toMatchObject({ flushed: 1, closed: 1, keys: 0 });
    expect(house.census(), "no tree key and no content key stands in the vessel").toEqual({ floor: "floor", sessions: 0, admitted: 0, treeKeys: 0, contentKeys: 0 });
    expect(await readBrowserCustody(idbName)).toMatchObject({ reading: "sealed", unlocked: false });
    await expect(readKeystoreRow(idbName, "vessel-key")).rejects.toMatchObject({ reading: "sealed-locked" });

    // A REOPENED TAB ASKS AGAIN, and the floor answers no signer meanwhile.
    const c = house.open({ tabId: "tab-c" });
    expect(() => house.require(c.sessionId)).toThrow(/session-unadmitted/);
    const tc = tab();
    await house.admit(c.sessionId, { ask: tc.ask });
    expect(tc.asked).toEqual(["unlock"]);
    expect(v.lit, "the vessel lights afresh").toBe(2);
  }, SLOW);
});

describe("an abrupt loss and the house's own clock", () => {
  test("VS3 a tab's worker killed with no close drops its session, and the last one's drop runs the lock — CONTROL: a tab that stays keeps its session", async () => {
    const idbName = await clearVessel("port-loss");
    const { v, light } = fakeVessel();
    const house = await stand(idbName, light);
    const a = house.open({ tabId: "tab-a" }), b = house.open({ tabId: "tab-b" });
    await house.admit(a.sessionId, { ask: tab().ask });
    expect(a.admittedBy, "a keystore with no slot admits by its clear reading").toBe("clear");
    const tabA = await houseWorker(), tabB = await houseWorker();
    await ask(tabA, { op: "hold-lock", lock: sessionLifetimeLock(a.sessionId) });
    await ask(tabB, { op: "hold-lock", lock: sessionLifetimeLock(b.sessionId) });
    house.watch(a.sessionId, sessionLifetimeLock(a.sessionId));
    house.watch(b.sessionId, sessionLifetimeLock(b.sessionId));
    await new Promise((r) => setTimeout(r, 200));
    expect(house.census().sessions, "CONTROL: both tabs live, both sessions stand").toBe(2);

    tabA.terminate();
    await until("A's session to drop", () => house.census().sessions === 1);
    await until("the lock to run", () => house.floor() === "floor" && v.closed === 1);
    expect(house.census()).toMatchObject({ floor: "floor", sessions: 1, admitted: 0, contentKeys: 0 });
    expect(house.session(b.sessionId).admission, "CONTROL: B's tab stays, and so does its session").toBe("unadmitted");
  }, SLOW);

  test("VS3b the house's liveness budget drops a silent session on its own clock — CONTROL: a heard one stays", async () => {
    const idbName = await clearVessel("liveness");
    let t = 0;
    const house = await stand(idbName, fakeVessel().light, { now: () => t, livenessBudgetMs: 1_000 });
    const heard = house.open({ tabId: "heard" }), silent = house.open({ tabId: "silent" });
    t = 5_000;
    for (let sweep = 0; sweep < 2; sweep++) { house.heard(heard.sessionId); expect(await house.sweep()).toEqual([]); }
    house.heard(heard.sessionId);
    expect(await house.sweep(), "the third sweep past its budget drops the silent session").toEqual([silent.sessionId]);
    expect(house.census().sessions).toBe(1);
    expect(house.session(heard.sessionId).admission).toBe("unadmitted");
    expect(() => house.session(silent.sessionId)).toThrow(/unknown-session/);
  });
});

describe("one owner per store, and a respawn mints afresh", () => {
  test("VS4 a second vessel worker over a held store refuses store-owned — CONTROL: once the first gives it back, a worker stands", async () => {
    const idbName = await clearVessel("owned");
    const house = await stand(idbName, fakeVessel().light);
    const second = await houseWorker();
    expect(await ask(second, { op: "stand", idbName })).toMatchObject({ refused: "store-owned" });
    await house.release();
    expect(await ask(second, { op: "stand", idbName })).toMatchObject({ refused: null });
  }, SLOW);

  test("VS5 a respawned house reissues ownerEpoch and fresh session ids, and refuses an earlier greeting by name", async () => {
    const idbName = await clearVessel("respawn");
    const first = await stand(idbName, fakeVessel().light);
    const s1 = first.open({ tabId: "tab" });
    const greeting = { ownerEpoch: s1.ownerEpoch, sessionId: s1.sessionId };
    expect(first.open({ tabId: "tab", resume: greeting }).sessionId, "CONTROL: the house that minted it reads its own greeting").not.toBe(s1.sessionId);
    await first.release();

    const respawned = await stand(idbName, fakeVessel().light);
    expect(respawned.ownerEpoch).not.toBe(first.ownerEpoch);
    expect(() => respawned.open({ tabId: "tab", resume: greeting })).toThrow(/stale-owner-epoch/);
    expect(() => respawned.open({ tabId: "tab", resume: { ownerEpoch: respawned.ownerEpoch, sessionId: s1.sessionId } })).toThrow(/unknown-session/);
    const fresh = respawned.open({ tabId: "tab" });
    expect(fresh.sessionId).not.toBe(s1.sessionId);
    expect(fresh.admission).toBe("unadmitted");
  });
});
