/**
 * rendered-derives — only the renderer writes a rendered tiddler (backlog-awakens, "The rendered tiddler"). The tiddler
 * door (put and delete), `meme put`, and INGEST (which the watcher's read-back rides) refuse a write to a `rendered-from`
 * tiddler by name, `rendered-derives`, and the refusal names the cure: edit the source tiddlers.
 *
 * CONTROLS: the same doors land a write over the source; INGEST of a file the records already say reads `noop`, never a
 * refusal (the projector's own echo); a native file carrying no `rendered-from` lands.
 */
import { describe, test, expect } from "vitest";
import { CompositeStore, bagUri, isVerbRefusal, type Verb } from "@lararium/mesh";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { makeMemePutReactor, type MemeVerbOptions } from "../src/meme-verbs.js";
import { makeActionReactorFor, makeTw5Deserializer } from "../src/action-handler.js";
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

  test("RED: a tiddler put over a rendered tiddler, or one that would land carrying rendered-from, refuses rendered-derives and names the sources; CONTROL: a put over the source lands", async () => {
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

  test("RED: a tiddler delete of a rendered tiddler refuses rendered-derives; CONTROL: the render still stands", async () => {
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
    const put = (uri: string, text: string) => makeMemePutReactor(opts)({ uri, bag: "garden", text }, ctxOf(composite, "meme-put"));
    return { garden, put };
  }

  test("RED: a meme put over a standing rendered tiddler, or one whose record would carry rendered-from, refuses rendered-derives; CONTROL: a plain meme put lands", async () => {
    const r = memeRig();
    await r.garden.put({ tiddler: { title: RENDERED_URI, type: "text/plain", text: "noted", "rendered-from": "lar:///t/road" }, meta: {} }, { kind: "lares-verb", requestId: "seed" });
    expect((await refusalOf(() => r.put(RENDERED_URI, memeText(RENDERED_URI)))).reason).toBe("rendered-derives");
    expect((await r.garden.get(RENDERED_URI))!.tiddler["text"]).toBe("noted");
    const forged = "lar:///t/forged";
    expect((await refusalOf(() => r.put(forged, memeText(forged, `rendered-from = "lar:///t/road"\n`)))).reason).toBe("rendered-derives");
    expect(await r.garden.get(forged)).toBeNull();
    expect((await r.put("lar:///t/plain", memeText("lar:///t/plain")))["decision"]).toBe("ingest");
  });

  test("RED: INGEST of a hand-edited render (the watcher's read-back) refuses its carrier rendered-derives and lands nothing; CONTROL: the echo reads noop, and a file with no rendered-from lands", async () => {
    const engine = await bootTestWiki();
    const composite = new CompositeStore();
    const working = new MemoryTiddlerStore(WORKING);
    composite.addLayer({ bagId: WORKING, store: working, writable: true, defaultWritable: true });
    const ingest = (carriers: Array<Record<string, unknown>>) => makeActionReactorFor("INGEST", {
      composite, diskMirrors: [{ bagId: WORKING, mirrorRoot: SOURCE, scope: "garden" }], tw5: makeTw5Deserializer(engine),
    })({ "source-uri": SOURCE, "to-bag": WORKING, "change-id": `chg-${Math.random()}`, carriers }, ctxOf(composite, "INGEST")) as Promise<Record<string, unknown>>;
    const rowsOf = (out: Record<string, unknown>) => out["carriers"] as Array<Record<string, unknown>>;
    const meta = "rendered-from: Road\ntitle: road.html\ntype: text/html\n";
    const carrier = (uri: string, text: string, metaBody: string, synced: string | null = null) =>
      ({ uri, text, meta: metaBody, ext: ".html", diskHash: `sha256:${"a".repeat(64)}`, syncedHash: synced, file: `${SOURCE}/${uri}.html` });

    const forged = rowsOf(await ingest([carrier("road.html", "<p>hand edit</p>", meta)]))[0]!;
    expect(forged).toMatchObject({ uri: "road.html", decision: "refuse", code: "rendered-derives" });
    expect(String(forged["reason"])).toMatch(/edit the source tiddlers/);
    expect(await working.get("road.html")).toBeNull();

    // The render stands; a hand edit to its file refuses, and the projector's own echo reads noop.
    await working.put({ tiddler: { title: "road.html", type: "text/html", text: "<p>noted</p>", "rendered-from": "Road" }, meta: {} }, { kind: "lares-verb", requestId: "render" });
    const edited = rowsOf(await ingest([carrier("road.html", "<p>hand edit</p>", "title: road.html\ntype: text/html\n")]))[0]!;
    expect(edited).toMatchObject({ decision: "refuse", code: "rendered-derives" });
    expect((await working.get("road.html"))!.tiddler["text"]).toBe("<p>noted</p>");
    const echo = rowsOf(await ingest([carrier("road.html", "<p>noted</p>", meta, `sha256:${"a".repeat(64)}`)]))[0]!;
    expect(echo["decision"]).toBe("noop");

    const plain = rowsOf(await ingest([carrier("page.html", "<p>mine</p>", "title: page.html\ntype: text/html\n")]))[0]!;
    expect(plain["decision"]).toBe("ingest");
    expect((await working.get("page.html"))!.tiddler["text"]).toBe("<p>mine</p>");
  }, 60_000);
});
