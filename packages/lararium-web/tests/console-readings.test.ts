/**
 * console-readings — the vessel's readings as an ordered model the mirror reads as two tab-local JSON tiddlers
 * (plan/full-glass-whole-page, Land B). Pure of the DOM: the engine stands as the two calls the mount makes.
 */
import { describe, expect, test } from "vitest";
import { createReadings, mountReadings, PHASES_TITLE, READINGS_TITLE, SAFE_READING_KEYS, toneOfClass } from "../src/console-readings.js";

/** An engine of one map: the store the mount writes and the order each title last landed. */
const engine = () => {
  const store = new Map<string, Record<string, unknown>>();
  class Tiddler { constructor(readonly fields: Record<string, unknown>) {} }
  return { store, tw: { wiki: { addTiddler: (t: unknown) => { const f = (t as Tiddler).fields; store.set(String(f["title"]), f); } }, Tiddler },
    json: (title: string) => JSON.parse(String(store.get(title)?.["text"] ?? "null")) as unknown };
};

describe("the readings model", () => {
  test("keeps the order each key was first said, and a key said again keeps its place with the new value", () => {
    const m = createReadings();
    m.set("status", "booting…"); m.set("did", "did:key:z1"); m.set("origin", "https://here");
    m.set("status", "live — sovereign local island", "ok");
    expect(m.list()).toEqual([
      { k: "status", v: "live — sovereign local island", tone: "ok" }, { k: "did", v: "did:key:z1" }, { k: "origin", v: "https://here" },
    ]);
  });

  test("RED: refuses every key outside the safe rows; CONTROL each safe key lands", () => {
    const m = createReadings();
    for (const withheld of ["gate key", "data-gate-key", "admit", "floor card", "place AID", "askId", "phone seat", "vessel key"]) expect(m.set(withheld, "secret"), withheld).toBe(false);
    expect(m.list()).toEqual([]);
    for (const safe of SAFE_READING_KEYS) expect(m.set(safe, "x"), safe).toBe(true);
    expect(m.list().map((r) => r.k)).toEqual([...SAFE_READING_KEYS]);
  });

  test("RED: a document URL never lands, only whether one stands", () => {
    const m = createReadings();
    m.set("wiki doc", "automerge:4f9Secret"); m.set("oracle doc", null);
    expect(m.list()).toEqual([{ k: "wiki doc", v: "standing" }, { k: "oracle doc", v: "absent" }]);
    expect(JSON.stringify(m.list())).not.toContain("automerge:");
  });

  test("phases keep their order with the page clock's milliseconds, and a fresh boot starts them again", () => {
    let now = 10.4;
    const m = createReadings(() => now);
    m.phase("boot"); now = 7500; m.phase("corpus-ready"); m.phase("live", 74800);
    expect(m.phases()).toEqual([{ p: "boot", ms: 10 }, { p: "corpus-ready", ms: 7500 }, { p: "live", ms: 74800 }]);
    m.restartPhases();
    expect(m.phases()).toEqual([]);
  });

  test("a row class reads as its tone; an unnamed class carries none", () => {
    expect(toneOfClass("ok")).toBe("ok"); expect(toneOfClass(" warn")).toBe("warn"); expect(toneOfClass("")).toBeUndefined(); expect(toneOfClass("v")).toBeUndefined();
  });
});

describe("mountReadings", () => {
  test("writes both tiddlers as ordered JSON arrays at mount, and again on each change", () => {
    const m = createReadings(() => 5);
    m.set("status", "booting…"); m.phase("boot");
    const e = engine();
    const stop = mountReadings(e.tw, m);
    expect(e.store.get(READINGS_TITLE)?.["type"]).toBe("application/json");
    expect(e.json(READINGS_TITLE)).toEqual([{ k: "status", v: "booting…" }]);
    expect(e.json(PHASES_TITLE)).toEqual([{ p: "boot", ms: 5 }]);
    m.set("relay", "wss://here/relay");
    expect(e.json(READINGS_TITLE)).toEqual([{ k: "status", v: "booting…" }, { k: "relay", v: "wss://here/relay" }]);
    stop();
    m.set("did", "did:key:z2");
    expect(e.json(READINGS_TITLE)).toHaveLength(2);                 // unmounted: the engine hears no more
  });

  test("RED: a remount on a fresh engine (the reload path) replays every reading and phase said before it", () => {
    const m = createReadings(() => 1);
    const first = engine(); const stop = mountReadings(first.tw, m);
    m.set("status", "live — sovereign local island", "ok"); m.set("did", "did:key:z3"); m.phase("live");
    stop();
    const fresh = engine();
    mountReadings(fresh.tw, m);
    expect(fresh.json(READINGS_TITLE)).toEqual(first.json(READINGS_TITLE));
    expect(fresh.json(PHASES_TITLE)).toEqual([{ p: "live", ms: 1 }]);
  });

  test("a refused key writes nothing", () => {
    const m = createReadings(); const e = engine(); mountReadings(e.tw, m);
    let writes = 0; m.subscribe(() => { writes++; });
    m.set("data-gate-key", "k");
    expect(writes).toBe(0);
    expect(e.json(READINGS_TITLE)).toEqual([]);
  });
});
