/**
 * glass-console-readings — the vessel's readings stand in the mirror's own engine as tab-local tiddlers (plan/full-glass-whole-page,
 * Land B): page-side writes, never a port write; a fresh mirror (the reload path) replays them whole.
 */
import { afterEach, beforeEach, expect, test } from "vitest";
import { standPageMirror } from "../src/page-mirror.js";
import { createReadings, PHASES_TITLE, READINGS_TITLE } from "../src/console-readings.js";
import { forgetEvidence, rig } from "./glass-rig.js";

beforeEach(forgetEvidence); afterEach(forgetEvidence);
const inputs = async () => ({ coreCid: "0".repeat(64), pluginCids: [] as string[] });
const json = (tw: any, title: string) => JSON.parse(tw.wiki.getTiddlerText(title) ?? "null");
const settle = async () => { await new Promise<void>(resolve => queueMicrotask(resolve)); await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); };

test("RED: the readings stand in the mirror's wiki as ordered JSON and never leave as a port write; a change re-writes them; CONTROL no readings model, no tiddler", async () => {
  const readings = createReadings(() => 3);
  readings.set("status", "booting…"); readings.phase("boot");
  const r = await rig();
  try {
    const result = await standPageMirror({ port: r.port, host: r.host, actor: "a", surface: () => "lares", mirrorInputs: inputs, readings }, r.seams) as any;
    await result.settled;
    expect(result.tw.wiki.getTiddler(READINGS_TITLE)?.fields.type).toBe("application/json");
    expect(json(result.tw, READINGS_TITLE)).toEqual([{ k: "status", v: "booting…" }]);
    expect(json(result.tw, PHASES_TITLE)).toEqual([{ p: "boot", ms: 3 }]);
    readings.set("status", "live — sovereign local island", "ok"); readings.set("did", "did:key:zPublic"); readings.set("wiki doc", "automerge:capability");
    expect(json(result.tw, READINGS_TITLE)).toEqual([{ k: "status", v: "live — sovereign local island", tone: "ok" }, { k: "did", v: "did:key:zPublic" }, { k: "wiki doc", v: "standing" }]);
    await settle();
    expect(r.messages.filter(m => m.type === "port:write")).toEqual([]);
    expect(JSON.stringify(r.messages)).not.toContain("$:/temp/lares/vessel/");
    result.unmount();
  } finally { r.host.remove(); }
  forgetEvidence();
  const bare = await rig();
  try {
    const result = await standPageMirror({ port: bare.port, host: bare.host, actor: "a", surface: () => "lares", mirrorInputs: inputs }, bare.seams) as any;
    await result.settled;
    expect(result.tw.wiki.tiddlerExists(READINGS_TITLE)).toBe(false);
    result.unmount();
  } finally { bare.host.remove(); }
});

test("RED: a fresh mirror after an unmount (the reload path) replays every reading said before it", async () => {
  const readings = createReadings(() => 1);
  const first = await rig();
  try {
    const result = await standPageMirror({ port: first.port, host: first.host, actor: "a", surface: () => "lares", mirrorInputs: inputs, readings }, first.seams) as any;
    await result.settled;
    readings.set("relay", "wss://here/relay"); readings.phase("live");
    result.unmount();
  } finally { first.host.remove(); }
  readings.set("origin", "https://here");               // said while no mirror stands
  forgetEvidence();
  const again = await rig();
  try {
    const result = await standPageMirror({ port: again.port, host: again.host, actor: "a", surface: () => "lares", mirrorInputs: inputs, readings }, again.seams) as any;
    await result.settled;
    expect(json(result.tw, READINGS_TITLE)).toEqual([{ k: "relay", v: "wss://here/relay" }, { k: "origin", v: "https://here" }]);
    expect(json(result.tw, PHASES_TITLE)).toEqual([{ p: "live", ms: 1 }]);
    result.unmount();
  } finally { again.host.remove(); }
});
