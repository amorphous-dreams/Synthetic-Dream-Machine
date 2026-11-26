/**
 * glass-console-readings — the vessel's readings stand in the mirror's own engine as tab-local tiddlers (plan/full-glass-whole-page,
 * Land B): page-side writes, never a port write; a fresh mirror (the reload path) replays them whole.
 */
import { afterEach, beforeEach, expect, test } from "vitest";
import { standPageMirror } from "../src/page-mirror.js";
import { createReadings, PHASES_TITLE, READINGS_TITLE } from "../src/console-readings.js";
import { forgetEvidence, rig } from "./glass-rig.js";
import housePlugin from "../../lararium-tw5/plugins/lares-memetic-wikitext.json";
import larariumPlugin from "../../lararium-tw5/plugins/lares-lararium.json";
import { carrierRecords } from "@lararium/tw5/carrier-canonical";
import viewCarrier from "../../../bags/lararium/ha.ka.ba/lararium/tw5/ui/vessel-console.mem?raw";

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

const REFUSED = "$:/temp/lares/alert/refused/";
const tagsOf = (tw: any, title: string): string[] => [...(tw.wiki.getTiddler(title)?.fields.tags ?? [])];

test("RED: a held startup offer stands as a refusal with no $:/tags/Alert, so a visitor's first screen carries no house notice; the host still counts it", async () => {
  const r = await rig({ records: [{ title: "Held start", fields: { tags: "$:/tags/StartupAction", text: `<$action-setfield $tiddler="$:/temp/ran-held" text="yes"/>` } }] });
  try {
    const result = await standPageMirror({ port: r.port, host: r.host, actor: "a", surface: () => "notes", mirrorInputs: inputs,
      startupAdmit: async () => [] }, r.seams) as any;
    await result.settled;
    const title = `${REFUSED}startup-offer/Held start`;
    expect(result.tw.wiki.tiddlerExists(title)).toBe(true);
    expect(tagsOf(result.tw, title)).not.toContain("$:/tags/Alert");
    expect(r.host.getAttribute("data-lar-refused-plugins")).toBe("1");
    expect(r.host.shadowRoot!.querySelectorAll(".tc-alerts .tc-alert").length).toBe(0);
    result.unmount();
  } finally { r.host.remove(); }
});

test("CONTROL: an unattested skin keeps its loud alert", async () => {
  // A copy wears the house skin's title with bytes the vessel never attested.
  const r = await rig({ preloads: [housePlugin as Record<string, unknown>, { ...(larariumPlugin as Record<string, unknown>) }] });
  try {
    const result = await standPageMirror({ port: r.port, host: r.host, actor: "a", surface: () => "lares", mirrorInputs: inputs }, r.seams) as any;
    await result.settled;
    const title = `${REFUSED}skin-unattested/${String((larariumPlugin as Record<string, unknown>)["title"])}`;
    expect(result.tw.wiki.tiddlerExists(title)).toBe(true);
    expect(tagsOf(result.tw, title)).toContain("$:/tags/Alert");
    result.unmount();
  } finally { r.host.remove(); }
});

const VIEW = "lar:///ha.ka.ba/lararium/tw5/ui/vessel-console";
/** The view as the lararium bag lands it: the carrier's own records, read through the one memetic parse. */
const viewRecords = () => (carrierRecords(VIEW, viewCarrier) ?? []).map(({ title, ...fields }) => ({ title: String(title), fields: fields as Record<string, unknown> }));

test("RED: the vessel console view lists each reading, the phases and what the glass held back, with every value as text and never as wikitext", async () => {
  const records = viewRecords();
  expect(records.map(r => r.title)).toContain(VIEW);
  const readings = createReadings(() => 42);
  readings.set("status", "live — sovereign local island", "ok"); readings.set("relay", "<<danger>> {{$:/SiteTitle}} [[Link]]"); readings.phase("tw5-booted");
  const r = await rig({ records: [...records, { title: "Held start", fields: { tags: "$:/tags/StartupAction", text: "" } }] });
  try {
    const result = await standPageMirror({ port: r.port, host: r.host, actor: "a", surface: () => "notes", mirrorInputs: inputs, readings,
      startupAdmit: async () => [] }, r.seams) as any;
    await result.settled;
    const view = result.tw.wiki.getTiddler(VIEW);
    expect([...view.fields.tags]).toContain("$:/tags/MoreSideBar");
    expect(view.fields.caption).toBe("Vessel");
    expect(result.tw.wiki.filterTiddlers("[all[shadows+tiddlers]tag[$:/tags/MoreSideBar]]")).toContain(VIEW);
    const text = result.tw.wiki.renderTiddler("text/plain", VIEW) as string;
    expect(text).toContain("status");
    expect(text).toContain("live — sovereign local island");
    expect(text).toContain("<<danger>> {{$:/SiteTitle}} [[Link]]");      // the value stays text: no macro call, no transclusion, no link
    expect(text).toContain("tw5-booted");
    expect(text).toContain("42 ms");
    expect(text).toContain("startup-offer");
    expect(text).toContain("Held start");
    expect(text).toContain("Startup action offered, not run");
    const html = result.tw.wiki.renderTiddler("text/html", VIEW) as string;
    expect(html).toContain("lar-tone-ok");
    expect(html).not.toContain("<a ");                                   // the [[Link]] in a value draws no link
    result.unmount();
  } finally { r.host.remove(); }
});
