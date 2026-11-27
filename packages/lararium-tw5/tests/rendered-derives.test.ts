/**
 * rendered-derives — only the renderer writes a rendered tiddler (backlog-awakens, "The rendered tiddler"). The tiddler
 * door (put and delete, over a wiki and over a bag) refuses a write to a `rendered-from` tiddler by name, `rendered-derives`, and the
 * refusal names the cure: edit the source tiddlers.
 *
 * INGEST (which the watcher's read-back and the lay ride) lands no render either, and answers each render carrier on a
 * gradient, one answer per disk state whatever the wave's order: `derived` where its source stands in the house or the
 * same wave (`source-stands`, quiet), where it differs from the standing render (`hand-edit`, naming the cure), or where
 * its source stands nowhere (`awaits-source`); the last two raise one alert per (rung, render title).
 *
 * CONTROLS: the same doors land a write over the source; INGEST of a file the records already say reads `noop` (the
 * projector's own echo); a native file carrying no `rendered-from` lands.
 */
import { describe, test, expect } from "vitest";
import { CompositeStore } from "@lararium/mesh/composite-store";
import { bagUri } from "@lararium/mesh/lar-uris";
import { isVerbRefusal } from "@lararium/mesh/verb-refusal";
import { type Verb } from "@lararium/mesh/verb-tiddler";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { type MemeVerbOptions } from "../src/meme-verbs.js";
import { makeActionReactorFor, makeTw5Deserializer, type IngestAlert } from "../src/action-handler.js";
import { makeTiddlerPutReactor, makeTiddlerDeleteReactor } from "../src/tiddler-verbs.js";
import type { VerbContext } from "../src/verb-dispatcher.js";
import { bootTestWiki, skipNote, wikiSkip } from "./test-wiki.js";

const DAEMON = bagUri("daemon");
const GARDEN = bagUri("garden");
const WORKING = "lar:///ha.ka.ba/wikis/garden/working";
const SOURCE = "/lar/projections/wikis/garden";
const WORKING_POINTER = "lar:///ha.ka.ba/lararium/config/current-wiki-bag";
const RENDERED_URI = "lar:///t/road.rendered";

const ctxOf = (composite: CompositeStore, action: string): VerbContext => ({
  daemon: composite,
  invocation: { requestId: "r", title: "t", action, args: {}, targets: [], batchMode: "best-effort", status: "pending", requestedBy: "test", requestedAt: "" } as unknown as Verb,
  cap: async () => ({ ok: true }),
} as VerbContext);

const refusalOf = async (go: () => Promise<unknown>): Promise<{ reason: string | null; message: string }> => {
  try { await go(); return { reason: null, message: "" }; }
  catch (e) { return { reason: isVerbRefusal(e) ? e.reason : null, message: e instanceof Error ? e.message : String(e) }; }
};

const memeText = (uri: string, meta = ""): string =>
  `<<^ code=\`&#x0001;\` from=\`?\` to=\`${uri}\`>>\n<<^ code=\`&#x0002;\`>>\n\n` +
  `\`\`\`toml meta\n${meta}uri-path = "${uri.slice("lar:///".length)}"\n\`\`\`\n\nhand-written\n\n<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`;

describe.skipIf(wikiSkip)(`rendered-derives — only the renderer writes a rendered tiddler${skipNote}`, () => {
  async function doorRig() {
    const engine = await bootTestWiki({ tiddlers: [
      { title: WORKING_POINTER, text: DAEMON },
      { title: "Road", type: "text/vnd.tiddlywiki", projection: "rendered", text: "{{Note}}", "$origin-bag": DAEMON },
      { title: "Road.rendered", type: "text/plain", text: "noted", "rendered-from": "Road", "$origin-bag": DAEMON },
    ] });
    const composite = new CompositeStore();
    composite.addLayer({ bagId: DAEMON, store: new MemoryTiddlerStore(DAEMON), writable: true });
    const opts = { composite, tw5: engine };
    return { engine, put: makeTiddlerPutReactor(opts), del: makeTiddlerDeleteReactor(opts), ctx: ctxOf(composite, "tiddler-put") };
  }

  test("RED: a put over a rendered tiddler, or one that would land carrying rendered-from, refuses rendered-derives and names the sources; CONTROL: a put over the source lands", async () => {
    const r = await doorRig();
    const over = await refusalOf(() => r.put({ recipe: "default", title: "Road.rendered", text: "hand edit" }, r.ctx));
    expect(over.reason).toBe("rendered-derives");
    expect(over.message).toMatch(/edit the source tiddlers/);
    expect(String(r.engine.wiki.getTiddler("Road.rendered")!.fields["text"])).toBe("noted");
    const forged = await refusalOf(() => r.put({ recipe: "default", title: "Forged", text: "x", fields: { "rendered-from": "Road" } }, r.ctx));
    expect(forged.reason).toBe("rendered-derives");
    expect(r.engine.wiki.getTiddler("Forged")).toBeUndefined();
    expect((await r.put({ recipe: "default", title: "Road", text: "{{Note}} and more" }, r.ctx))["decision"]).toBe("put");
  }, 60_000);

  test("RED: a delete of a rendered tiddler refuses rendered-derives; CONTROL: the render still stands", async () => {
    const r = await doorRig();
    const out = await r.del({ recipe: "default", title: "Road.rendered" }, r.ctx);
    expect(out).toMatchObject({ decision: "refused", refusal: "rendered-derives" });
    expect(r.engine.wiki.getTiddler("Road.rendered")).toBeDefined();
  }, 60_000);

  function memeRig() {
    const composite = new CompositeStore();
    const garden = new MemoryTiddlerStore(GARDEN);
    composite.addLayer({ bagId: GARDEN, store: garden, writable: true, defaultWritable: true });
    const opts: MemeVerbOptions = { composite, tw5: { $tw: { wiki: { getTiddlerText: () => "" } } } as unknown as MemeVerbOptions["tw5"] };
    const put = (uri: string, text: string) => makeTiddlerPutReactor(opts)({ title: uri, bag: "garden", text }, ctxOf(composite, "tiddler-put"));
    return { garden, put };
  }

  test("RED: a bag put over a standing rendered tiddler, or one whose record would carry rendered-from, refuses rendered-derives; CONTROL: a plain family put lands", async () => {
    const r = memeRig();
    await r.garden.put({ tiddler: { title: RENDERED_URI, type: "text/plain", text: "noted", "rendered-from": "lar:///t/road" }, meta: {} }, { kind: "lares-verb", requestId: "seed" });
    expect((await refusalOf(() => r.put(RENDERED_URI, memeText(RENDERED_URI)))).reason).toBe("rendered-derives");
    expect((await r.garden.get(RENDERED_URI))!.tiddler["text"]).toBe("noted");
    const forged = "lar:///t/forged";
    expect((await refusalOf(() => r.put(forged, memeText(forged, `rendered-from = "lar:///t/road"\n`)))).reason).toBe("rendered-derives");
    expect(await r.garden.get(forged)).toBeNull();
    expect((await r.put("lar:///t/plain", memeText("lar:///t/plain")))["decision"]).toBe("put");
  });

  /** The INGEST rig: one working bag under a disk mirror, and the alerts the wave raises. */
  async function ingestRig() {
    const engine = await bootTestWiki();
    const composite = new CompositeStore();
    const working = new MemoryTiddlerStore(WORKING);
    composite.addLayer({ bagId: WORKING, store: working, writable: true, defaultWritable: true });
    const alerts: IngestAlert[] = [];
    const reactor = makeActionReactorFor("INGEST", {
      composite, diskMirrors: [{ bagId: WORKING, mirrorRoot: SOURCE, scope: "garden" }], tw5: makeTw5Deserializer(engine),
      alert: (alert) => { alerts.push(alert); },
    });
    const ingest = async (carriers: Array<Record<string, unknown>>) => (await reactor({ "source-uri": SOURCE, "to-bag": WORKING, "change-id": `chg-${Math.random()}`, carriers }, ctxOf(composite, "INGEST")) as Record<string, unknown>)["carriers"] as Array<Record<string, unknown>>;
    const stand = (tiddler: Record<string, unknown>) => working.put({ tiddler: tiddler as never, meta: {} }, { kind: "lares-verb", requestId: "stand" });
    return { working, alerts, ingest, stand };
  }
  const RENDER_META = "rendered-from: Road\ntitle: road.html\ntype: text/html\n";
  const carrier = (uri: string, text: string, metaBody: string, ext = ".html", synced: string | null = null) =>
    ({ uri, text, meta: metaBody, ext, diskHash: `sha256:${"a".repeat(64)}`, syncedHash: synced, file: `${SOURCE}/${uri}${ext}` });
  const sourceCarrier = () => carrier("Road", "title: Road\nprojection: rendered\ntype: text/vnd.tiddlywiki\n\n{{Note}}\n", "", ".tid");

  test("RED: a render whose source stands nowhere reads derived (awaits-source), lands nothing, warns and raises its alert; the wave goes on", async () => {
    const r = await ingestRig();
    const rows = await r.ingest([carrier("road.html", "<p>noted</p>", RENDER_META), carrier("page.html", "<p>mine</p>", "title: page.html\ntype: text/html\n")]);
    expect(rows[0]).toMatchObject({ uri: "road.html", decision: "derived", rung: "awaits-source", source: "Road" });
    expect(String((rows[0]!["warnings"] as string[])[0])).toMatch(/awaits its source "Road"/);
    expect(await r.working.get("road.html")).toBeNull();
    expect(rows[1]).toMatchObject({ uri: "page.html", decision: "ingest" });
    const raised = r.alerts.filter((a) => a.clear !== true);
    expect(raised).toHaveLength(1);
    expect(raised[0]).toMatchObject({ kind: "rendered-awaits-source" });
    expect(raised[0]!.key).toMatch(/^[0-9a-f]{8,64}$/);
    expect(raised[0]!.message).toMatch(/road\.html/);
    // The other rung's alert for the same render clears under the same key.
    expect(r.alerts.filter((a) => a.clear === true)).toEqual([expect.objectContaining({ kind: "rendered-hand-edit", key: raised[0]!.key })]);
  }, 60_000);

  test("RED: a render whose source arrives in the same wave reads derived (source-stands) and quiet, in either order; the source lands", async () => {
    for (const order of ["render-first", "source-first"] as const) {
      const r = await ingestRig();
      const render = carrier("road.html", "<p>noted</p>", RENDER_META);
      const rows = await r.ingest(order === "render-first" ? [render, sourceCarrier()] : [sourceCarrier(), render]);
      const row = rows.find((x) => x["uri"] === "road.html")!;
      expect(row).toMatchObject({ decision: "derived", rung: "source-stands", source: "Road" });
      expect(row["warnings"]).toBeUndefined();
      expect(await r.working.get("road.html")).toBeNull();
      expect(rows.find((x) => x["uri"] === "Road")).toMatchObject({ decision: "ingest" });
      expect(r.alerts.filter((a) => a.clear !== true)).toEqual([]);
    }
  }, 60_000);

  test("RED: a render whose source already stands in the house reads derived (source-stands) and quiet", async () => {
    const r = await ingestRig();
    await r.stand({ title: "Road", type: "text/vnd.tiddlywiki", projection: "rendered", text: "{{Note}}" });
    const rows = await r.ingest([carrier("road.html", "<p>noted</p>", RENDER_META)]);
    expect(rows[0]).toMatchObject({ decision: "derived", rung: "source-stands", source: "Road" });
    expect(rows[0]!["warnings"]).toBeUndefined();
    expect(await r.working.get("road.html")).toBeNull();
  }, 60_000);

  test("RED: a hand edit to a standing render reads derived (hand-edit), lands nothing, names the cure, and its alert coalesces across re-runs; CONTROL: the projector's echo reads noop", async () => {
    const r = await ingestRig();
    await r.stand({ title: "Road", type: "text/vnd.tiddlywiki", projection: "rendered", text: "{{Note}}" });
    await r.stand({ title: "road.html", type: "text/html", text: "<p>noted</p>", "rendered-from": "Road" });
    for (const metaBody of [RENDER_META, "title: road.html\ntype: text/html\n"]) {
      const row = (await r.ingest([carrier("road.html", "<p>hand edit</p>", metaBody)]))[0]!;
      expect(row).toMatchObject({ decision: "derived", rung: "hand-edit", source: "Road" });
      expect(String((row["warnings"] as string[])[0])).toMatch(/edit "Road"; this render follows/);
      expect((await r.working.get("road.html"))!.tiddler["text"]).toBe("<p>noted</p>");
    }
    const raised = r.alerts.filter((a) => a.clear !== true);
    expect(raised).toHaveLength(2);
    expect(raised.every((a) => a.kind === "rendered-hand-edit" && a.key === raised[0]!.key)).toBe(true);
    const echo = (await r.ingest([carrier("road.html", "<p>noted</p>", RENDER_META, ".html", `sha256:${"a".repeat(64)}`)]))[0]!;
    expect(echo["decision"]).toBe("noop");
  }, 60_000);

  test("CONTROL: a native file with no rendered-from lands", async () => {
    const r = await ingestRig();
    const plain = (await r.ingest([carrier("page.html", "<p>mine</p>", "title: page.html\ntype: text/html\n")]))[0]!;
    expect(plain["decision"]).toBe("ingest");
    expect((await r.working.get("page.html"))!.tiddler["text"]).toBe("<p>mine</p>");
    expect(r.alerts).toEqual([]);
  }, 60_000);
});
