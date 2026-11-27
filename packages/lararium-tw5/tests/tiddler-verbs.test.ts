/**
 * TIDDLER VERBS — `wiki-filter` · `tiddler-get` · `wiki-render` · `tiddler-put` · `tiddler-delete` · `wiki-status`,
 * the tiddler door on the anchor (`recipe: "default"`, the worn face's daemon wiki), through the island's own engine.
 *
 * Each red names its row in lar:///ha.ka.ba/lares/docs/pono/wiki-surface-scout #/a-lean, each beside a control.
 * A real engine boots here (`bootTestWiki`), so a filter, a backlink and a render answer as TiddlyWiki answers them.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { SwarmRefused } from "@lararium/mesh/swarm-tiddlers";
import { sha256HexBytesSync, sha256HexSync } from "@lararium/mesh/crypto";
import { CompositeStore } from "@lararium/mesh/composite-store";
import { bagUri } from "@lararium/mesh/lar-uris";
import { wikiSlotUri } from "@lararium/mesh/wiki-recipe";
import { VERB_URI_PREFIX } from "@lararium/mesh/verb-tiddler";
import { buildEffectRecordTiddler, effectRecordUri, LARES_EFFECT_RECORD_TAG } from "@lararium/mesh/effect-record";
import { buildRetiredShellRecord, retiredShellUri, unionRetiredShell } from "@lararium/mesh/shell-leaving-record";
import { CARRIER_TYPE as CARRIER } from "@lararium/mesh/carrier-type";
import { retractsOf, tombstonesOf, type Consequence } from "@lararium/mesh/family";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { evaluateMeme, placeMeme, readMeme, wikiMemeSink } from "../src/place-meme.js";
import { stampCarrier, verifyBcc } from "@lararium/memetic-frame";
import {
  makeWikiFilterReactor, makeTiddlerGetReactor, makeWikiRenderReactor, makeWikiRenderOutReactor, makeTiddlerPutReactor, makeTiddlerDeleteReactor, makeTiddlerRenameReactor,
  makeWikiStatusReactor, makeWikiActionReactor, pageFilterAnswer, WIKI_FILTER_ROWS, SHORE_COLLAPSE_CONFIG_PREFIX, type FilterPage, type TiddlerVerbOptions,
} from "../src/tiddler-verbs.js";
import { AUDIT_ARRAY_CAP, boundOutcomeOutput, placeVerb, removeVerb } from "../src/verb-vm.js";
import type { VerbContext } from "../src/verb-dispatcher.js";
import { bootTestWiki, skipNote, wikiSkip } from "./test-wiki.js";

const DAEMON = bagUri("daemon");
const CANON = bagUri("lares");
const PERSONAL = "lar:///ha.ka.ba/wikis/daemon/personal";
const WORKING_POINTER = "lar:///ha.ka.ba/lararium/config/current-wiki-bag";
const MEME = "lar:///t/x";
const memeText = (slots: readonly string[]): string =>
  `<<^ code=\`&#x0001;\` from=\`?\` to=\`${MEME}\`>>\n` +
  `<<^ code=\`&#x0002;\`>>\n\n\`\`\`toml meta\nuri-path = "t/x"\n\`\`\`\n\n` +
  slots.map((s) => `<<~ ahu slot=\`#/${s}\`>>\n\n! ${s}\n\nbody of ${s}\n\n<<~/ahu>>\n`).join("\n") +
  `\n<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`;

type Cap = VerbContext["cap"];
const writer: Cap = async (access, bag) => (bag === DAEMON || access === "read" ? { ok: true } : { ok: false, reason: "no-grant" });
const reader: Cap = async (access) => (access === "read" ? { ok: true } : { ok: false, reason: "read-only-seat" });
const stranger: Cap = async () => ({ ok: false, reason: "no-grant" });
const ctx = (cap: Cap = writer): VerbContext => ({ daemon: {} as CompositeStore, invocation: { requestId: "r1" } as VerbContext["invocation"], cap });

/** The Relink offering's pinned plugin, read off the committed pack: a rig opts in with `relink`. */
const RELINK_PLUGIN = JSON.parse(readFileSync(new URL("../offerings/relink/relink-plugin.json", import.meta.url), "utf8")) as Record<string, unknown>;

async function rig(more: { personal?: boolean; relink?: boolean } = {}) {
  const engine = await bootTestWiki({ ...(more.relink ? { extraPlugins: [RELINK_PLUGIN] } : {}), tiddlers: [
    { title: WORKING_POINTER, text: DAEMON },
    ...Array.from({ length: 12 }, (_, i) => ({
      title: `Note ${String(i + 1).padStart(2, "0")}`, type: "text/vnd.tiddlywiki", tags: "memory", priority: i % 2 ? "low" : "high",
      text: i === 0 ? "the first note" : `see [[Note 01]] and note ${i + 1}`,
    })),
    { title: "Other", text: "untagged" },
    { title: "Handover", type: "text/vnd.tiddlywiki", text: "Tonight: {{Note 01}}" },
    { title: "$:/temp/lares/secret", text: "device-local" },
  ] });
  const composite = new CompositeStore();
  composite.addLayer({ bagId: CANON, store: new MemoryTiddlerStore(CANON), writable: false });
  composite.addLayer({ bagId: DAEMON, store: new MemoryTiddlerStore(DAEMON), writable: true });
  if (more.personal) composite.addLayer({ bagId: PERSONAL, store: new MemoryTiddlerStore(PERSONAL), writable: true });
  // THE SHORE, IN SMALL: a store change lands what the composition resolves for its title (the topmost layer holding
  // any record, a tombstone included), as the island adaptor lands it. Each landing settles before a test reads.
  const landings: Promise<void>[] = [];
  composite.subscribe((change) => {
    landings.push((async () => {
      const top = await composite.resolveLayered(change.title);
      if (top && !top.record.meta?.deleted) engine.wiki.addTiddler({ ...(top.record.tiddler as Record<string, unknown>), "$origin-bag": top.bagId });
      else if (engine.wiki.tiddlerExists(change.title)) engine.wiki.deleteTiddler(change.title);
    })());
  });
  const landed = async (): Promise<void> => { while (landings.length > 0) await landings.shift(); };
  /** Rest wiki records in a layer's store, as a hearth holds them: the door reads which layer holds a title. */
  const hold = async (bag: string, titles: readonly string[]): Promise<void> => {
    for (const title of titles) {
      const { "$origin-bag": _bag, ...fields } = engine.wiki.getTiddler(title)!.getFieldStrings();
      await composite.storeForBag(bag)!.put({ tiddler: { ...fields, title }, meta: {} }, { kind: "lares-verb", requestId: "seed" }, { bag: bag as never });
    }
    await landed();
  };
  const opts: TiddlerVerbOptions = { composite, tw5: engine };
  return { engine, opts, composite, hold, landed };
}
const A = { recipe: "default" } as const;

test("wiki action reactor stands as a separate admitted write door", () => {
  expect(typeof makeWikiActionReactor).toBe("function");
});

describe.skipIf(wikiSkip)(`the tiddler door on the anchor${skipNote}`, () => {
  test("wiki action refuses a caller action string before any write", async () => {
    const r = await rig();
    const act = makeWikiActionReactor(r.opts);
    await expect(act({ ...A, name: "sidebar-layout", expected: "fixed-fluid", resulting: "fluid-fixed", action: "<$action-setfield/>" }, ctx()))
      .rejects.toThrow(/action|parameter/);
  });

  test("wiki action invokes the floor shadow on an isolated view and lands one gated layout change", async () => {
    const r = await rig();
    const title = "$:/themes/tiddlywiki/vanilla/options/sidebarlayout";
    expect((r.engine.wiki as unknown as { getShadowSource(title: string): string }).getShadowSource("$:/core/ui/KeyboardShortcuts/change-sidebar-layout")).toBe("$:/core");
    r.engine.wiki.addTiddler({ title, text: "fixed-fluid" });
    await r.hold(DAEMON, [title]);
    const out = await makeWikiActionReactor(r.opts)({ ...A, name: "sidebar-layout", expected: "fixed-fluid", resulting: "fluid-fixed" }, ctx());
    await r.landed();
    expect(out).toMatchObject({ decision: "put", title, resulting: "fluid-fixed", receipt: "r1" });
    expect(r.engine.wiki.getTiddlerText(title)).toBe("fluid-fixed");
    expect(r.engine.wiki.tiddlerExists("$:/core/ui/KeyboardShortcuts/change-sidebar-layout")).toBe(false);
  });

  test("wiki action keeps a denied or stale layout unchanged", async () => {
    const r = await rig();
    const title = "$:/themes/tiddlywiki/vanilla/options/sidebarlayout";
    r.engine.wiki.addTiddler({ title, text: "fixed-fluid" });
    await r.hold(DAEMON, [title]);
    const act = makeWikiActionReactor(r.opts);
    const ask = { ...A, name: "sidebar-layout", expected: "fixed-fluid", resulting: "fluid-fixed" };
    await expect(act(ask, ctx(reader))).rejects.toThrow(/cap-denied/);
    expect(r.engine.wiki.getTiddlerText(title)).toBe("fixed-fluid");
    expect(await r.composite.storeForBag(DAEMON)!.get(title)).toMatchObject({ tiddler: { text: "fixed-fluid" } });
    expect(await act({ ...ask, expected: "fluid-fixed", resulting: "fixed-fluid" }, ctx())).toMatchObject({ decision: "conflict", observed: "fixed-fluid" });
    expect(r.engine.wiki.getTiddlerText(title)).toBe("fixed-fluid");
  });

  test("wiki action keeps the live wiki untouched when the put gate closes after native invocation", async () => {
    const r = await rig();
    const title = "$:/themes/tiddlywiki/vanilla/options/sidebarlayout";
    r.engine.wiki.addTiddler({ title, text: "fixed-fluid" });
    await r.hold(DAEMON, [title]);
    let adminAsks = 0;
    const cap: Cap = async (access) => access === "read" || ++adminAsks === 1 ? { ok: true } : { ok: false, reason: "closed" };
    await expect(makeWikiActionReactor(r.opts)({ ...A, name: "sidebar-layout", expected: "fixed-fluid", resulting: "fluid-fixed" }, ctx(cap)))
      .rejects.toThrow(/cap-denied/);
    await r.landed();
    expect(r.engine.wiki.getTiddlerText(title)).toBe("fixed-fluid");
    expect((await r.composite.storeForBag(DAEMON)!.get(title))?.tiddler["text"]).toBe("fixed-fluid");
  });

  test("wiki action refuses a runtime plugin shadow of the admitted action and writes nothing", async () => {
    const r = await rig();
    const target = "$:/themes/tiddlywiki/vanilla/options/sidebarlayout";
    r.engine.wiki.addTiddler({ title: target, text: "fixed-fluid" });
    await r.hold(DAEMON, [target]);
    const plugin = { tiddlers: { "$:/core/ui/KeyboardShortcuts/change-sidebar-layout": { title: "$:/core/ui/KeyboardShortcuts/change-sidebar-layout", text: "<$action-setfield $tiddler='Other' text='x'/>" } } };
    await r.composite.storeForBag(DAEMON)!.put({ tiddler: { title: "$:/plugins/x/y", type: "application/json", "plugin-type": "plugin", text: JSON.stringify(plugin) }, meta: {} }, { kind: "lares-verb", requestId: "plug" }, { bag: DAEMON as never });
    await r.landed();
    // A runtime plugin registers as the engine registers one: read its info, then unpack its shadows.
    const live = r.engine.wiki as unknown as { readPluginInfo(titles: string[]): void; registerPluginTiddlers(type: string, titles?: string[]): void; unpackPluginTiddlers(): void; getShadowSource(t: string): string | undefined };
    live.readPluginInfo(["$:/plugins/x/y"]);
    live.registerPluginTiddlers("plugin");
    live.unpackPluginTiddlers();
    expect(live.getShadowSource("$:/core/ui/KeyboardShortcuts/change-sidebar-layout")).not.toBe("$:/core");
    await expect(makeWikiActionReactor(r.opts)({ ...A, name: "sidebar-layout", expected: "fixed-fluid", resulting: "fluid-fixed" }, ctx()))
      .rejects.toThrow(/wiki-action-origin/);
    expect(r.engine.wiki.getTiddlerText(target)).toBe("fixed-fluid");
    expect(r.engine.wiki.getTiddlerText("Other")).toBe("untagged");
  });

  test("wiki action refuses names that only the prototype chain holds", async () => {
    const r = await rig();
    for (const name of ["constructor", "toString", "__proto__"])
      await expect(makeWikiActionReactor(r.opts)({ ...A, name, expected: "fixed-fluid", resulting: "fluid-fixed" }, ctx()))
        .rejects.toThrow(/wiki-action-unknown/);
  });

  test("wiki action refuses an ordinary override of the admitted floor shadow", async () => {
    const r = await rig();
    const title = "$:/core/ui/KeyboardShortcuts/change-sidebar-layout";
    r.engine.wiki.addTiddler({ title, text: "<$action-setfield $tiddler='Other' text='wrong'/>" });
    await expect(makeWikiActionReactor(r.opts)({ ...A, name: "sidebar-layout", expected: "fixed-fluid", resulting: "fluid-fixed" }, ctx()))
      .rejects.toThrow(/wiki-action-origin/);
  });
  test("wiki-filter-tag: a tag filter over a seeded daemon wiki answers its titles; CONTROL: an untagged title stays out", async () => {
    const r = await rig();
    const out = await makeWikiFilterReactor(r.opts)({ ...A, filter: "[tag[memory]sort[title]]" }, ctx());
    expect(out["titles"]).toHaveLength(12);
    expect((out["titles"] as string[])[0]).toBe("Note 01");
    expect(out["titles"]).not.toContain("Other");
    expect(out).toMatchObject({ recipe: "default", total: 12, next: null });
  });

  test("wiki-filter-bounded: a cap of 5 pages a 12-title answer by its cursor; CONTROL: a small filter answers whole with next null", async () => {
    const r = await rig();
    const filter = makeWikiFilterReactor(r.opts);
    const seen: string[] = [];
    let after: string | null = null;
    let pages = 0;
    for (;;) {
      const page: Record<string, unknown> = await filter({ ...A, filter: "[tag[memory]sort[title]]", limit: 5, ...(after ? { after } : {}) }, ctx());
      expect((page["titles"] as string[]).length).toBeLessThanOrEqual(5);
      seen.push(...(page["titles"] as string[]));
      pages++;
      if (page["next"] === null) break;
      after = page["next"] as string;
    }
    expect(pages).toBe(3);
    expect(seen).toEqual(Array.from({ length: 12 }, (_, i) => `Note ${String(i + 1).padStart(2, "0")}`));
    const small = await filter({ ...A, filter: "[[Other]]" }, ctx());
    expect(small).toMatchObject({ titles: ["Other"], next: null, total: 1 });
  });

  test("wiki-filter-bounded: the byte cap cuts a page short and the cursor continues; no page outruns the outcome's array cap", async () => {
    const r = await rig();
    const filter = makeWikiFilterReactor(r.opts);
    const page = await filter({ ...A, filter: "[tag[memory]sort[title]]", fields: ["text", "priority"], maxBytes: 300 }, ctx());
    const rows = page["rows"] as Array<{ title: string; fields: Record<string, string> }>;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(12);
    expect(new TextEncoder().encode(JSON.stringify(rows)).length).toBeLessThanOrEqual(300);
    expect(rows[0]).toEqual({ title: "Note 01", fields: { text: "the first note", priority: "high" } });
    expect(typeof page["next"]).toBe("string");
    expect(WIKI_FILTER_ROWS).toBeLessThanOrEqual(AUDIT_ARRAY_CAP);
    const wide = await filter({ ...A, filter: "[tag[memory]]", limit: 500 }, ctx());
    expect(boundOutcomeOutput(wide)["titles"]).toEqual(wide["titles"]);
  });

  test("wiki-filter-cursor-stale: a cursor from an answer the wiki moved past refuses by name; CONTROL: an unmoved wiki continues", async () => {
    const r = await rig();
    const filter = makeWikiFilterReactor(r.opts);
    const first = await filter({ ...A, filter: "[tag[memory]sort[title]]", limit: 5 }, ctx());
    await expect(filter({ ...A, filter: "[tag[memory]sort[title]]", limit: 5, after: first["next"] }, ctx())).resolves.toMatchObject({ total: 12 });
    r.engine.setTiddler({ title: "Note 00", tags: "memory", text: "arrived" });
    await expect(filter({ ...A, filter: "[tag[memory]sort[title]]", limit: 5, after: first["next"] }, ctx())).rejects.toMatchObject({ reason: "filter-cursor-stale" });
  });

  test("filter-pages-past-its-own-verb-trail: each call's own invocation record never moves the answer it pages; CONTROL: a foreign write between pages still refuses stale", async () => {
    const r = await rig();
    const seed = Array.from({ length: 40 }, (_, i) => `Plain ${String(i + 1).padStart(2, "0")}`);
    for (const title of seed) r.engine.setTiddler({ title, text: "plain" });
    const expected = r.engine.wiki.filterTiddlers("[!is[system]!has[uri-path]sort[]]");
    expect(expected).toEqual(expect.arrayContaining(seed));
    const filter = makeWikiFilterReactor(r.opts);
    // As the dispatcher calls it: the invocation rests in the daemon wiki at lar:///lararium.local.vm/verbs/<id> while
    // the reactor runs, and leaves when the outcome concludes.
    const call = async (args: Record<string, unknown>): Promise<Record<string, unknown>> => {
      const id = placeVerb(r.engine, { verb: "wiki-filter", args, requestedBy: "operator-test" });
      try { return await filter(args, ctx()); } finally { removeVerb(r.engine, `${VERB_URI_PREFIX}${id}`); }
    };
    const PLAIN = "[!is[system]!has[uri-path]]";
    const seen: string[] = [];
    let after: string | null = null;
    let pages = 0;
    for (;;) {
      const page: Record<string, unknown> = await call({ ...A, filter: PLAIN, ...(after ? { after } : {}) });
      seen.push(...(page["titles"] as string[]));
      pages++;
      if (page["next"] === null) break;
      after = page["next"] as string;
    }
    expect(pages).toBeGreaterThan(1);
    expect([...seen].sort()).toEqual([...expected].sort());
    expect(seen.some((t) => t.startsWith(VERB_URI_PREFIX))).toBe(false);
    // CONTROL: a real write from outside the walk between pages moves the answer, and the cursor says so.
    const first = await call({ ...A, filter: PLAIN });
    r.engine.setTiddler({ title: "Plain 00", text: "arrived mid-walk" });
    await expect(call({ ...A, filter: PLAIN, after: first["next"] })).rejects.toMatchObject({ reason: "filter-cursor-stale" });
  });

  test("wiki-filter-malformed-refuses-by-name; CONTROL: the well-formed filter answers", async () => {
    const r = await rig();
    const filter = makeWikiFilterReactor(r.opts);
    await expect(filter({ ...A, filter: "[tag[memory" }, ctx())).rejects.toMatchObject({ reason: "filter-malformed" });
    await expect(filter({ ...A, filter: ":nosuchprefix[tag[memory]]" }, ctx())).rejects.toMatchObject({ reason: "filter-malformed" });
    await expect(filter({ ...A, filter: "[tag[memory]limit[1]]" }, ctx())).resolves.toMatchObject({ total: 1 });
  });

  test("the link graph through filters: links, backlinks, transcludes, backtranscludes each answer over the seeded wiki", async () => {
    const r = await rig();
    const filter = makeWikiFilterReactor(r.opts);
    const titles = async (f: string) => (await filter({ ...A, filter: f }, ctx()))["titles"] as string[];
    expect(await titles("[[Note 02]links[]]")).toEqual(["Note 01"]);
    expect((await titles("[[Note 01]backlinks[]sort[title]]"))).toEqual(Array.from({ length: 11 }, (_, i) => `Note ${String(i + 2).padStart(2, "0")}`));
    expect(await titles("[[Handover]transcludes[]]")).toEqual(["Note 01"]);
    expect(await titles("[[Note 01]backtranscludes[]]")).toEqual(["Handover"]);
    expect(await titles("[[Other]backlinks[]]")).toEqual([]);
  });

  test("a withheld title never answers a filter, a get or a render: the temp namespace stays home", async () => {
    const r = await rig();
    // The reader's view holds no such record, so an iteration never meets it; a filter that NAMES the title outright
    // still answers it as a literal, and the answer gate drops and counts it.
    const iterated = await makeWikiFilterReactor(r.opts)({ ...A, filter: "[prefix[$:/temp/lares/]]" }, ctx());
    expect(iterated).toMatchObject({ titles: [], total: 0 });
    expect(iterated["withheld"]).toBeUndefined();
    const out = await makeWikiFilterReactor(r.opts)({ ...A, filter: "[[$:/temp/lares/secret]] [[Other]]" }, ctx());
    expect(out).toMatchObject({ titles: ["Other"], total: 1, withheld: 1 });
    await expect(makeTiddlerGetReactor(r.opts)({ ...A, title: "$:/temp/lares/secret" }, ctx())).rejects.toMatchObject({ reason: "tiddler-withheld" });
    await expect(makeWikiRenderReactor(r.opts)({ ...A, title: "$:/temp/lares/secret" }, ctx())).rejects.toMatchObject({ reason: "tiddler-withheld" });
  });

  // swarm-titles-stay-unreachable (offer-binder kāpae read, b9969f391): the kāpae read of unstring rows trusts that no seat writes
  // under `$:/lares/swarm/` (the control document's swarm wiki). The door holds that law by name, not by a header comment: a put,
  // a delete and a get at a swarm title refuse `tiddler-withheld`, so no wiki layer carries a row a swarm reader could mistake.
  test("RED: a swarm title takes no put, no delete and answers no get through the tiddler door; CONTROL: another $:/lares/ title lands", async () => {
    const r = await rig();
    const SWARM = "$:/lares/swarm/lei-unstrung/" + "c".repeat(64);
    await expect(makeTiddlerPutReactor(r.opts)({ ...A, title: SWARM, text: "{}" }, ctx())).rejects.toMatchObject({ reason: "tiddler-withheld" });
    await expect(makeTiddlerDeleteReactor(r.opts)({ ...A, title: SWARM }, ctx())).rejects.toMatchObject({ reason: "tiddler-withheld" });
    await expect(makeTiddlerGetReactor(r.opts)({ ...A, title: SWARM }, ctx())).rejects.toMatchObject({ reason: "tiddler-withheld" });
    expect(r.engine.wiki.tiddlerExists(SWARM)).toBe(false);
    expect(await makeTiddlerPutReactor(r.opts)({ ...A, title: "$:/lares/swarm-notes", text: "a note beside, not under" }, ctx())).toMatchObject({ decision: "put" });
  });

  test("RED: an alert the house raises (`$:/temp/lares/alert/…`) reads through the one door, a get, a filter and a render alike, and takes no write; CONTROL: every other temp title still stays home", async () => {
    const r = await rig();
    const ALERT = "$:/temp/lares/alert/refused/plugin-syncadaptor/$:/plugins/x/evil";
    r.engine.wiki.addTiddler({ title: ALERT, tags: "$:/tags/Alert", text: "Plugin refused: it would stand a syncer" });
    const got = await makeTiddlerGetReactor(r.opts)({ ...A, title: ALERT }, ctx());
    expect((got["tiddler"] as { fields: Record<string, string> }).fields).toMatchObject({ title: ALERT, text: "Plugin refused: it would stand a syncer" });
    const listed = await makeWikiFilterReactor(r.opts)({ ...A, filter: "[prefix[$:/temp/lares/alert/]]" }, ctx());
    expect(listed).toMatchObject({ titles: [ALERT], total: 1 });
    expect(String((await makeWikiRenderReactor(r.opts)({ ...A, title: ALERT }, ctx()))["text"] ?? "")).toContain("would stand a syncer");
    // The alert reads and never writes: the house raises and clears it, never a door.
    await expect(makeTiddlerPutReactor(r.opts)({ ...A, title: ALERT, text: "cleared" }, ctx())).rejects.toMatchObject({ reason: "tiddler-withheld" });
    await expect(makeTiddlerDeleteReactor(r.opts)({ ...A, title: ALERT }, ctx())).rejects.toMatchObject({ reason: "tiddler-withheld" });
    // CONTROL: the rest of the temp namespace stays home.
    await expect(makeTiddlerGetReactor(r.opts)({ ...A, title: "$:/temp/lares/secret" }, ctx())).rejects.toMatchObject({ reason: "tiddler-withheld" });
    expect((await makeWikiFilterReactor(r.opts)({ ...A, filter: "[prefix[$:/temp/lares/]]" }, ctx()))["titles"]).toEqual([ALERT]);
  });

  test("RED: a house alert carrying a secret-shaped string reads redacted through every read (get, filter, render), and only its kind's open fields leave; CONTROL: the engine keeps the alert as raised", async () => {
    const r = await rig();
    const TOKEN = "ghp_" + "Zx9".repeat(10);
    const PAT = "github_pat_" + "A1b2".repeat(8);
    const MINT = "ab".repeat(32);
    const ALERT = "$:/temp/lares/alert/engine-waiting";
    r.engine.wiki.addTiddler({ title: ALERT, tags: ["$:/tags/Alert", `tag ${TOKEN}`], text: `a fetch failed with token ${TOKEN}, ${PAT}, ticket ${MINT}, sha256:${MINT} and AKIAIOSFODNN7EXAMPLE`, detail: `retry with ${TOKEN}` });
    const fields = ((await makeTiddlerGetReactor(r.opts)({ ...A, title: ALERT }, ctx()))["tiddler"] as { fields: Record<string, unknown> }).fields;
    const said = JSON.stringify(fields);
    for (const secret of [TOKEN, PAT, ` ${MINT}`, "AKIAIOSFODNN7EXAMPLE"]) expect(said, secret).not.toContain(secret);
    expect(said, "a digest named by its scheme stands").toContain(`sha256:${MINT}`);
    expect(fields["detail"], "a field the kind does not open never leaves").toBeUndefined();
    expect(String(fields["tags"]), "a list field redacts element-wise").toContain("tag [redacted: secret-shaped]");
    expect(JSON.stringify(await makeWikiFilterReactor(r.opts)({ ...A, filter: `[[${ALERT}]get[text]]` }, ctx()))).not.toContain(TOKEN);
    expect(JSON.stringify(await makeWikiRenderReactor(r.opts)({ ...A, title: ALERT }, ctx()))).not.toContain(TOKEN);
    expect(r.engine.wiki.getTiddler(ALERT)!.fields["text"]).toContain(TOKEN);
    // A boot fault leaves as its component and one fixed line: a parse error's quoted record text never crosses the door.
    const FAULT = "$:/temp/lares/alert/boot-fault/1";
    r.engine.wiki.addTiddler({ title: FAULT, tags: "$:/tags/Alert", component: "island-boot", text: "SyntaxError: Unexpected token in JSON: {\"text\":\"a private note\"}" });
    const fault = ((await makeTiddlerGetReactor(r.opts)({ ...A, title: FAULT }, ctx()))["tiddler"] as { fields: Record<string, unknown> }).fields;
    expect(fault["component"]).toBe("island-boot");
    expect(JSON.stringify(fault)).not.toContain("a private note");
    // A refused plugin's digest leaves named by its scheme, so the strict hex rule keeps the one value a person compares.
    const DIGEST = "ef".repeat(32);
    const REFUSED = "$:/temp/lares/alert/refused/plugin-syncadaptor/$:/plugins/x/m";
    r.engine.wiki.addTiddler({ title: REFUSED, tags: "$:/tags/Alert", text: `plugin-syncadaptor: $:/plugins/x/m (sha256:${DIGEST}) would stand a syncer` });
    expect(JSON.stringify(await makeTiddlerGetReactor(r.opts)({ ...A, title: REFUSED }, ctx()))).toContain(`sha256:${DIGEST}`);
  });

  test("RED: an alert answers only a reader of the record it names: a reader without the bag reads the record cap-denied AND no alert about it; a parallel draft never opens; a dot-segment title opens nothing; the meme lens reads no alert; CONTROL: a reader with the bag reads the alert", async () => {
    const r = await rig({ personal: true });
    // The secret note rests in the personal layer; the alerts about it name it.
    await r.composite.storeForBag(PERSONAL)!.put({ tiddler: { title: "Secret note", text: "the words" }, meta: {} }, { kind: "lares-verb", requestId: "seed" }, { bag: PERSONAL as never });
    await r.landed();
    const UNSAVED = "$:/temp/lares/alert/unsaved/Secret note";
    const DRAFT = "$:/temp/lares/alert/parallel-draft/Draft of 'Secret note'";
    r.engine.wiki.addTiddler({ title: UNSAVED, tags: "$:/tags/Alert", text: "Secret note did not save" });
    r.engine.wiki.addTiddler({ title: DRAFT, tags: "$:/tags/Alert", text: "the draft's own words", "draft-text": "the draft's own words" });
    const blind: Cap = async (_access, bag) => (bag === PERSONAL ? { ok: false, reason: "no-grant" } : { ok: true });
    await expect(makeTiddlerGetReactor(r.opts)({ ...A, title: "Secret note" }, ctx(blind))).rejects.toThrow(/cap-denied/);
    expect(await makeTiddlerGetReactor(r.opts)({ ...A, title: UNSAVED }, ctx(blind))).toMatchObject({ tiddler: null });
    expect((await makeWikiFilterReactor(r.opts)({ ...A, filter: "[prefix[$:/temp/lares/alert/]]" }, ctx(blind)))["titles"]).toEqual([]);
    await expect(makeWikiRenderReactor(r.opts)({ ...A, title: UNSAVED }, ctx(blind))).rejects.toMatchObject({ reason: "tiddler-absent" });
    // A parallel draft holds the draft's own words: it never opens, whoever reads.
    await expect(makeTiddlerGetReactor(r.opts)({ ...A, title: DRAFT }, ctx())).rejects.toMatchObject({ reason: "tiddler-withheld" });
    await expect(makeTiddlerGetReactor(r.opts)({ ...A, title: "$:/temp/lares/alert/unsaved/../../secret" }, ctx())).rejects.toMatchObject({ reason: "tiddler-withheld" });
    await expect(makeTiddlerGetReactor(r.opts)({ ...A, title: UNSAVED, meme: true }, ctx())).rejects.toMatchObject({ reason: "tiddler-withheld" });
    // CONTROL: a reader of the personal layer reads the alert about its record.
    const seen = await makeTiddlerGetReactor(r.opts)({ ...A, title: UNSAVED }, ctx());
    expect((seen["tiddler"] as { fields: Record<string, string> }).fields["text"]).toBe("Secret note did not save");
    expect((await makeWikiFilterReactor(r.opts)({ ...A, filter: "[prefix[$:/temp/lares/alert/]]" }, ctx()))["titles"]).toEqual([UNSAVED]);
  });

  test("tiddler-get: a plain tiddler answers its fields (today's meme get drops them); fields-only leaves the text home", async () => {
    const r = await rig();
    const get = makeTiddlerGetReactor(r.opts);
    const whole = await get({ ...A, title: "Note 02" }, ctx());
    expect(whole).toMatchObject({ recipe: "default", title: "Note 02", tiddler: {
      fields: { title: "Note 02", tags: "memory", priority: "low", type: "text/vnd.tiddlywiki", text: "see [[Note 01]] and note 2" }, position: "plain" } });
    const t = whole["tiddler"] as { hash: string; textHash: string };
    expect(t.hash).toMatch(/^sha256-[0-9a-f]{64}$/);
    expect(t.textHash).toMatch(/^sha256-[0-9a-f]{64}$/);
    const skinny = await get({ ...A, title: "Note 02", grain: "skinny" }, ctx());
    const s = skinny["tiddler"] as { fields: Record<string, string>; hash: string; textHash: string; omitted: string[] };
    expect(s.fields).toEqual({ title: "Note 02", tags: "memory", priority: "low", type: "text/vnd.tiddlywiki" });
    expect(s.omitted).toEqual(["text"]);
    expect(s.hash, "a card names its base as the card's").toBe(`skinny:${t.hash}`);
    const named = await get({ ...A, title: "Note 02", fields: ["priority"] }, ctx());
    expect((named["tiddler"] as { fields: Record<string, string> }).fields).toEqual({ title: "Note 02", priority: "low" });
    expect(await get({ ...A, title: "Nowhere" }, ctx())).toMatchObject({ title: "Nowhere", tiddler: null });
  });

  test("tiddler-get slot-only: one slot of a meme answers alone and names its family; CONTROL: the root reads as a root", async () => {
    const r = await rig();
    expect((await placeMeme({ uri: MEME, text: memeText(["a", "b"]) }, wikiMemeSink(r.engine.wiki))).decision).toBe("ingest");
    const get = makeTiddlerGetReactor(r.opts);
    const slot = await get({ ...A, title: MEME, slot: "#/b" }, ctx());
    expect(slot).toMatchObject({ title: `${MEME}#/b`, tiddler: { position: "slot", family: MEME } });
    expect((slot["tiddler"] as { fields: Record<string, string> }).fields["text"]).toContain("body of b");
    expect((slot["tiddler"] as { fields: Record<string, string> }).fields["text"]).not.toContain("body of a");
    expect(await get({ ...A, title: MEME }, ctx())).toMatchObject({ tiddler: { position: "root", family: MEME } });
    expect(await get({ ...A, title: MEME, slot: "#/none" }, ctx())).toMatchObject({ title: `${MEME}#/none`, tiddler: null });
  });

  test("RED one-door-has: every answer leads with a `<<~ has …>>` line — provenance, the record's tags, the measure keys, base, a tagline — and echoes its grain", async () => {
    const r = await rig();
    r.engine.setTiddler({ title: "Card", tags: "road/kind/leap [[two words]]", type: "text/vnd.tiddlywiki", description: "One read door on a gradient", text: "small" });
    const got = await makeTiddlerGetReactor(r.opts)({ ...A, title: "Card" }, ctx());
    expect(Object.keys(got)[0]).toBe("has");
    const hash = (got["tiddler"] as { hash: string }).hash;
    expect(got["has"]).toBe(`<<~ has name=\`Card\` params=\`recipe/default road/kind/leap [[two words]] type/text/vnd.tiddlywiki position/plain bytes/5 base/${hash} ~ One read door on a gradient\`>>`);
    expect(got).toMatchObject({ lens: "record", grain: { asked: null, applied: "fat" }, next: null });
  });

  test("RED one-door-record-gradient: a record past one page answers skinny with next fat; --grain fat carries the text; an unknown grain refuses loudly", async () => {
    const r = await rig();
    r.engine.setTiddler({ title: "Big", text: "x".repeat(70_000) });
    const get = makeTiddlerGetReactor(r.opts);
    const thin = await get({ ...A, title: "Big" }, ctx());
    expect(thin).toMatchObject({ grain: { applied: "skinny" }, next: { grain: "fat" }, tiddler: { omitted: ["text"] } });
    expect((thin["tiddler"] as { fields: Record<string, string> }).fields["text"]).toBeUndefined();
    const fat = await get({ ...A, title: "Big", grain: "fat" }, ctx());
    expect((fat["tiddler"] as { fields: Record<string, string> }).fields["text"]).toHaveLength(70_000);
    expect(fat).toMatchObject({ grain: { asked: "fat", applied: "fat" }, next: null });
    await expect(get({ ...A, title: "Big", grain: "thin" }, ctx())).rejects.toMatchObject({ reason: "grain-unknown" });
  });

  test("RED one-door-pointer: a pointer answers its handle (the fields verbatim on the has line); resolved reads the local CAS by CID and verifies; a web2 address stays named, never fetched", async () => {
    const r = await rig();
    const body = new TextEncoder().encode("the body the handle names");
    const cid = sha256HexBytesSync(body);
    r.engine.setTiddler({ title: "Pointer", _is_skinny: "yes", textCid: cid, size: String(body.length), type: "text/plain" });
    r.engine.setTiddler({ title: "Web", _canonical_uri: "https://example.org/a.png", type: "image/png" });
    const fetched: string[] = [];
    const get = makeTiddlerGetReactor({ ...r.opts, resolveByCid: async (c) => { fetched.push(c); return c === cid ? body : null; } });
    const handle = await get({ ...A, title: "Pointer" }, ctx());
    expect(handle).toMatchObject({ grain: { applied: "handle" }, next: { grain: "resolved" } });
    expect(handle["has"]).toContain(`textCid/${cid}`);
    expect(handle["has"]).toContain(`size/${body.length}`);
    expect(fetched).toEqual([]);
    const resolved = await get({ ...A, title: "Pointer", grain: "resolved" }, ctx());
    expect(resolved).toMatchObject({ grain: { applied: "resolved" }, tiddler: { fields: { text: "the body the handle names" } } });
    // `whole` on a pointer (the CLI's `--all`) reads the body grain's whole: resolved.
    expect(await get({ ...A, title: "Pointer", grain: "whole" }, ctx())).toMatchObject({ grain: { asked: "whole", applied: "resolved" } });
    const web = await get({ ...A, title: "Web", grain: "resolved" }, ctx());
    expect(web).toMatchObject({ grain: { applied: "handle", why: expect.stringMatching(/never fetch/) }, next: null });
    expect(web["has"]).toContain("_canonical_uri/https://example.org/a.png");
    expect(fetched).toEqual([cid, cid]);
  });

  test("RED M2 base-from-skinny: a skinny answer's base names the card, so a text put against it refuses by name (naming --all); a field patch against it lands", async () => {
    const r = await rig();
    const get = makeTiddlerGetReactor(r.opts);
    const put = makeTiddlerPutReactor(r.opts);
    const card = (await get({ ...A, title: "Note 04", grain: "skinny" }, ctx()))["tiddler"] as { hash: string };
    expect(card.hash).toMatch(/^skinny:sha256-/);
    await expect(put({ ...A, title: "Note 04", text: "a blind rewrite", base: card.hash }, ctx())).rejects.toMatchObject({ reason: "base-from-skinny", message: expect.stringMatching(/--all/) });
    expect(await put({ ...A, title: "Note 04", fields: { status: "seen" }, base: card.hash }, ctx())).toMatchObject({ decision: "put" });
    // CONTROL: a fat answer's base authorizes the text write.
    const fat = (await get({ ...A, title: "Note 04" }, ctx()))["tiddler"] as { hash: string };
    expect(fat.hash).toMatch(/^sha256-/);
    expect(await put({ ...A, title: "Note 04", text: "a read rewrite", base: fat.hash }, ctx())).toMatchObject({ decision: "put" });
  });

  test("filter-collapse: a meme root's row carries the same slots and bytes the skinny get answers; a plain row carries its bytes alone; CONTROL: no collapse leaves the rows as they were", async () => {
    const r = await rig();
    expect((await placeMeme({ uri: MEME, text: memeText(["a", "b"]) }, wikiMemeSink(r.engine.wiki))).decision).toBe("ingest");
    const filter = makeWikiFilterReactor(r.opts);
    const get = makeTiddlerGetReactor(r.opts);
    const skinny = (await get({ ...A, title: MEME, meme: true, grain: "skinny" }, ctx()))["meme"] as { bytes: number; slots: Array<{ slot: string; bytes: number; first: string | null }> };
    const out = await filter({ ...A, filter: `[[${MEME}]] [[Other]]`, collapse: true }, ctx());
    const rows = out["rows"] as Array<{ title: string; bytes: number; slots?: unknown[] }>;
    expect(rows.map((x) => x.title)).toEqual([MEME, "Other"]);
    expect(rows[0]).toMatchObject({ bytes: skinny.bytes, slots: skinny.slots });
    expect(skinny.slots.map((s) => s.slot)).toEqual(["#/a", "#/b"]);
    expect(rows[1]!.bytes).toBe(8);
    expect(rows[1]!.slots, "a plain row carries no slots").toBeUndefined();
    const plain = await filter({ ...A, filter: `[[${MEME}]] [[Other]]` }, ctx());
    expect(plain["titles"]).toEqual([MEME, "Other"]);
    expect(plain["rows"]).toBeUndefined();
    const named = await filter({ ...A, filter: `[[${MEME}]]`, collapse: true, fields: ["description"] }, ctx());
    expect((named["rows"] as Array<Record<string, unknown>>)[0]).toMatchObject({ title: MEME, fields: {}, slots: skinny.slots });
  });

  test("filter-collapse: the page law counts the collapsed rows' bytes; a cap cuts the page short and the cursor continues", async () => {
    const r = await rig();
    expect((await placeMeme({ uri: MEME, text: memeText(["a", "b", "c", "d"]) }, wikiMemeSink(r.engine.wiki))).decision).toBe("ingest");
    const filter = makeWikiFilterReactor(r.opts);
    const first = await filter({ ...A, filter: `[[${MEME}]] [tag[memory]sort[title]]`, collapse: true, maxBytes: 400 }, ctx());
    const rows = first["rows"] as Array<{ title: string }>;
    expect(rows[0]!.title).toBe(MEME);
    expect(JSON.stringify(rows).length).toBeLessThanOrEqual(400);
    expect(first["next"]).not.toBeNull();
    expect(rows.length).toBeLessThan(first["total"] as number);
    const second = await filter({ ...A, filter: `[[${MEME}]] [tag[memory]sort[title]]`, collapse: true, maxBytes: 400, after: first["next"] }, ctx());
    expect((second["rows"] as Array<{ title: string }>)[0]!.title).not.toBe(MEME);
  });

  test("filter-collapse: a first row past the byte cap sheds its slots by name and keeps its bytes; the pages join with no title repeated or skipped", async () => {
    const r = await rig();
    const many = Array.from({ length: 24 }, (_, i) => `slot${i}`);
    expect((await placeMeme({ uri: MEME, text: memeText(many) }, wikiMemeSink(r.engine.wiki))).decision).toBe("ingest");
    const filter = makeWikiFilterReactor(r.opts);
    const get = makeTiddlerGetReactor(r.opts);
    const skinny = (await get({ ...A, title: MEME, meme: true, grain: "skinny" }, ctx()))["meme"] as { bytes: number; slots: unknown[] };
    expect(skinny.slots).toHaveLength(24);
    const cap = 160;
    const first = await filter({ ...A, filter: `[[${MEME}]] [tag[memory]sort[title]]`, collapse: true, maxBytes: cap }, ctx());
    const rows = first["rows"] as Array<{ title: string; bytes?: number; slots?: unknown[]; omitted?: string[] }>;
    expect(rows[0]).toMatchObject({ title: MEME, bytes: skinny.bytes });
    expect(rows[0]!.slots).toBeUndefined();
    expect(rows[0]!.omitted).toContain("slots");
    expect(JSON.stringify(rows).length).toBeLessThanOrEqual(cap);
    const seen: string[] = rows.map((x) => x.title);
    let after = first["next"] as string | null;
    while (after) {
      const page: Record<string, unknown> = await filter({ ...A, filter: `[[${MEME}]] [tag[memory]sort[title]]`, collapse: true, maxBytes: 4096, after }, ctx());
      seen.push(...(page["rows"] as Array<{ title: string }>).map((x) => x.title));
      after = page["next"] as string | null;
    }
    const whole = await filter({ ...A, filter: `[[${MEME}]] [tag[memory]sort[title]]`, limit: 32 }, ctx());
    expect(seen).toEqual(whole["titles"]);
  });

  test("filter-collapse: a meme root whose slot records rest in an unreadable layer carries withheld on its row, as the meme get names it; CONTROL: a readable family withholds none", async () => {
    const r = await rig();
    expect((await placeMeme({ uri: MEME, text: memeText(["a", "b"]) }, wikiMemeSink(r.engine.wiki))).decision).toBe("ingest");
    const filter = makeWikiFilterReactor(r.opts);
    const open = await filter({ ...A, filter: `[[${MEME}]]`, collapse: true }, ctx());
    expect((open["rows"] as Array<Record<string, unknown>>)[0]!["withheld"]).toBeUndefined();
    const SECRET = "lar:///ha.ka.ba/bags/secret";
    const held = r.engine.wiki.getTiddler(`${MEME}#/b`)!.getFieldStrings();
    r.engine.wiki.addTiddler({ ...held, "$origin-bag": SECRET });
    const partial: Cap = async (access, bag) => (bag === SECRET ? { ok: false, reason: "no-grant" } : access === "read" || bag === DAEMON ? { ok: true } : { ok: false, reason: "no-grant" });
    const out = await filter({ ...A, filter: `[[${MEME}]]`, collapse: true }, ctx(partial));
    const row = (out["rows"] as Array<{ withheld?: number; slots: Array<{ slot: string }> }>)[0]!;
    expect(row.withheld).toBe(1);
    expect(row.slots.map((x) => x.slot)).toEqual(["#/a"]);
  });

  test("RED L1: a word the lens or the grain does not read refuses by name, before anything reads", async () => {
    const r = await rig();
    expect((await placeMeme({ uri: MEME, text: memeText(["a", "b"]) }, wikiMemeSink(r.engine.wiki))).decision).toBe("ingest");
    const get = makeTiddlerGetReactor(r.opts);
    await expect(get({ ...A, title: "Note 02", after: "1.0123456789abcdef" }, ctx())).rejects.toMatchObject({ reason: "read-word-unread", message: expect.stringMatching(/after/) });
    await expect(get({ ...A, title: MEME, meme: true, fields: ["title"] }, ctx())).rejects.toMatchObject({ reason: "read-word-unread", message: expect.stringMatching(/fields/) });
    await expect(get({ ...A, title: MEME, meme: true, maxBytes: 4096 }, ctx())).rejects.toMatchObject({ reason: "read-word-unread", message: expect.stringMatching(/maxBytes/) });
    await expect(get({ ...A, title: MEME, meme: true, grain: "skinny", slot: "#/a" }, ctx())).rejects.toMatchObject({ reason: "read-word-unread", message: expect.stringMatching(/slot/) });
    await expect(get({ ...A, title: MEME, meme: true, grain: "whole", slot: "#/a" }, ctx())).rejects.toMatchObject({ reason: "read-word-unread" });
    await expect(get({ ...A, title: `${MEME}#/a`, meme: true, grain: "whole" }, ctx())).rejects.toMatchObject({ reason: "read-word-unread" });
    // CONTROL: the words each lens reads still answer.
    expect(await get({ ...A, title: MEME, meme: true, slot: "#/a" }, ctx())).toMatchObject({ grain: { applied: "slot" } });
    expect(await get({ ...A, title: "Note 02", fields: ["priority"] }, ctx())).toMatchObject({ lens: "record" });
  });

  test("RED L4: the echo names the grain that rode: named fields without the text read skinny; a pointer keeps its body grain under named fields", async () => {
    const r = await rig();
    r.engine.setTiddler({ title: "Handle2", _is_skinny: "yes", textCid: "cd".repeat(32), type: "text/plain" });
    const get = makeTiddlerGetReactor(r.opts);
    expect(await get({ ...A, title: "Note 02", fields: ["priority"] }, ctx())).toMatchObject({ grain: { applied: "skinny" } });
    expect(await get({ ...A, title: "Note 02", fields: ["text"] }, ctx())).toMatchObject({ grain: { applied: "fat" } });
    expect(await get({ ...A, title: "Handle2", fields: ["textCid"] }, ctx())).toMatchObject({ grain: { applied: "handle" } });
  });

  test("RED L3: a recomposition that leaves out slot children this face may not read says so (`withheld`), never a silent short carrier", async () => {
    const r = await rig();
    expect((await placeMeme({ uri: MEME, text: memeText(["a", "b"]) }, wikiMemeSink(r.engine.wiki))).decision).toBe("ingest");
    const SECRET = "lar:///ha.ka.ba/bags/secret";
    const held = r.engine.wiki.getTiddler(`${MEME}#/b`)!.getFieldStrings();
    r.engine.wiki.addTiddler({ ...held, "$origin-bag": SECRET });
    const partial: Cap = async (access, bag) => (bag === SECRET ? { ok: false, reason: "no-grant" } : access === "read" || bag === DAEMON ? { ok: true } : { ok: false, reason: "no-grant" });
    const got = await makeTiddlerGetReactor(r.opts)({ ...A, title: MEME, meme: true }, ctx(partial));
    expect(got).toMatchObject({ withheld: 1, note: expect.stringMatching(/1 slot record.*withheld/) });
    expect((got["meme"] as { text: string }).text).not.toContain("body of b");
  });

  test("RED L6: resolved verifies a tagged or uppercase CID through the house verify", async () => {
    const r = await rig();
    const body = new TextEncoder().encode("tagged body");
    const hex = sha256HexBytesSync(body);
    r.engine.setTiddler({ title: "Tagged", _is_skinny: "yes", textCid: `sha256:${hex.toUpperCase()}`, type: "text/plain" });
    const get = makeTiddlerGetReactor({ ...r.opts, resolveByCid: async () => body });
    expect(await get({ ...A, title: "Tagged", grain: "resolved" }, ctx())).toMatchObject({ grain: { applied: "resolved" }, tiddler: { fields: { text: "tagged body" } } });
  });

  test("RED M2b: a card's base moves no text by any path: `fields.text` and `unset text` refuse base-from-skinny like `text`", async () => {
    const r = await rig();
    const get = makeTiddlerGetReactor(r.opts);
    const put = makeTiddlerPutReactor(r.opts);
    const card = (await get({ ...A, title: "Note 05", grain: "skinny" }, ctx()))["tiddler"] as { hash: string };
    await expect(put({ ...A, title: "Note 05", fields: { text: "a blind rewrite" }, base: card.hash }, ctx())).rejects.toMatchObject({ reason: "base-from-skinny" });
    await expect(put({ ...A, title: "Note 05", unset: ["text"], base: card.hash }, ctx())).rejects.toMatchObject({ reason: "base-from-skinny" });
    // CONTROL: a field that is not the text still lands against the card.
    expect(await put({ ...A, title: "Note 05", fields: { status: "seen" }, base: card.hash }, ctx())).toMatchObject({ decision: "put" });
  });

  test("RED partial-base: a slot answer and a page short of the end hand a partial base, which a put takes within the span it read; the last page and the whole hand the bare base", async () => {
    const r = await rig();
    const big = (x: string): string => `body of ${x} ${"lorem ".repeat(5_000)}`;
    const text = memeText(["a", "b", "c"]).replace(/body of (\w)/g, (_m, x: string) => big(x));
    expect((await placeMeme({ uri: MEME, text }, wikiMemeSink(r.engine.wiki))).decision).toBe("ingest");
    const get = makeTiddlerGetReactor(r.opts);
    const slot = await get({ ...A, title: MEME, meme: true, slot: "#/a" }, ctx());
    expect((slot["meme"] as { canonicalHash: string }).canonicalHash).toMatch(/^partial:/);
    const first = await get({ ...A, title: MEME, meme: true, grain: "whole" }, ctx());
    expect((first["meme"] as { canonicalHash: string }).canonicalHash).toMatch(/^partial:/);
    let page = first;
    while ((page["next"] as { after?: string } | null)?.after) page = await get({ ...A, title: MEME, meme: true, grain: "whole", after: (page["next"] as { after: string }).after }, ctx());
    expect((page["meme"] as { canonicalHash: string }).canonicalHash).toMatch(/^sha256/);
  });

  test("RED fat-carries: an explicit fat or whole read of a record past the byte cap (a plugin-sized text) carries the text whole; a named --max-bytes still caps", async () => {
    const r = await rig();
    r.engine.setTiddler({ title: "lar:///ha.ka.ba/lararium/plugins/lares/big", type: "application/json", "plugin-type": "plugin", text: JSON.stringify({ tiddlers: { a: { text: "x".repeat(400_000) } } }) });
    const get = makeTiddlerGetReactor(r.opts);
    for (const grain of ["fat", "whole"]) {
      const got = await get({ ...A, title: "lar:///ha.ka.ba/lararium/plugins/lares/big", grain }, ctx());
      expect(got, grain).toMatchObject({ grain: { applied: "fat" } });
      expect(((got["tiddler"] as { fields: Record<string, string> }).fields["text"] ?? "").length, grain).toBeGreaterThan(400_000);
    }
    const capped = await get({ ...A, title: "lar:///ha.ka.ba/lararium/plugins/lares/big", grain: "fat", maxBytes: 4096 }, ctx());
    expect(capped).toMatchObject({ grain: { applied: "skinny" }, tiddler: { omitted: expect.arrayContaining(["text"]) } });
  });

  test("RED two-skinnies: `grain: skinny` (the CLI's --skinny) leaves a record's text home; `_is_skinny` marks a POINTER, which answers its handle, never the tiddler grain's card", async () => {
    const r = await rig();
    r.engine.setTiddler({ title: "Handle", _is_skinny: "yes", textCid: "ab".repeat(32), type: "text/plain" });
    const get = makeTiddlerGetReactor(r.opts);
    // The tiddler grain: the card, the text left home and named.
    const card = await get({ ...A, title: "Note 02", grain: "skinny" }, ctx());
    expect(card).toMatchObject({ grain: { asked: "skinny", applied: "skinny" }, tiddler: { omitted: ["text"] } });
    // The body grain: a record that names its body by CID answers its handle at either ask; the two words never merge.
    const handle = await get({ ...A, title: "Handle" }, ctx());
    expect(handle).toMatchObject({ grain: { asked: null, applied: "handle" } });
    const asked = await get({ ...A, title: "Handle", grain: "skinny" }, ctx());
    expect(asked).toMatchObject({ grain: { asked: "skinny", applied: "handle", why: expect.stringMatching(/tiddler grain reads no body/) } });
    expect((asked["tiddler"] as { omitted?: string[] }).omitted).toBeUndefined();
  });

  test("RED one-door-meme-lens: --meme on a meme within a page answers the whole carrier byte for byte, sealed, with base/ on its has line", async () => {
    const r = await rig();
    expect((await placeMeme({ uri: MEME, text: memeText(["a", "b"]) }, wikiMemeSink(r.engine.wiki))).decision).toBe("ingest");
    const whole = await readMeme(MEME, wikiMemeSink(r.engine.wiki));
    const got = await makeTiddlerGetReactor(r.opts)({ ...A, title: MEME, meme: true }, ctx());
    expect(got).toMatchObject({ lens: "meme", title: MEME, grain: { applied: "whole" }, next: null, meme: { uri: MEME, text: whole!.text, canonicalHash: whole!.canonicalHash } });
    expect(got["has"]).toMatch(new RegExp(`^<<~ has name=\`${MEME}\` params=\`recipe/default .*type/${CARRIER.replace(/[+/]/g, "\\$&")} position/root slots/2 bytes/\\d+ base/${whole!.canonicalHash}\``));
  });

  test("RED one-door-meme-gradient: past a page --meme answers the has-stack (root line plus one per slot); --all pages on slot boundaries and the pages join to the carrier", async () => {
    const r = await rig();
    const big = (s: string): string => `body of ${s} ${"lorem ".repeat(5_000)}`;
    const text = memeText(["a", "b", "c"]).replace(/body of (\w)/g, (_m, s: string) => big(s));
    expect((await placeMeme({ uri: MEME, text }, wikiMemeSink(r.engine.wiki))).decision).toBe("ingest");
    const whole = await readMeme(MEME, wikiMemeSink(r.engine.wiki));
    const get = makeTiddlerGetReactor(r.opts);
    const stack = await get({ ...A, title: MEME, meme: true }, ctx());
    expect(stack).toMatchObject({ grain: { applied: "skinny" }, next: { grain: "whole" } });
    expect((stack["meme"] as { text?: string }).text).toBeUndefined();
    const lines = String(stack["has"]).split("\n");
    expect(lines).toHaveLength(4);
    expect(lines.slice(1).map((l) => /name=`([^`]+)`/.exec(l)![1])).toEqual(["#/a", "#/b", "#/c"]);
    const pages: string[] = [];
    for (let page = await get({ ...A, title: MEME, meme: true, grain: "whole" }, ctx()); ; ) {
      pages.push((page["meme"] as { text: string }).text);
      const after = (page["next"] as { after?: string } | null)?.after;
      if (!after) break;
      page = await get({ ...A, title: MEME, meme: true, grain: "whole", after }, ctx());
    }
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.join("")).toBe(whole!.text);
    expect(pages.slice(1).every((p) => p.startsWith("<<~ ahu slot="))).toBe(true);
  });

  test("RED one-door-meme-edges: a slot child recomposes from its root and points at the slot; a record that holds no meme answers itself and says so", async () => {
    const r = await rig();
    expect((await placeMeme({ uri: MEME, text: memeText(["a", "b"]) }, wikiMemeSink(r.engine.wiki))).decision).toBe("ingest");
    const get = makeTiddlerGetReactor(r.opts);
    const slot = await get({ ...A, title: `${MEME}#/b`, meme: true }, ctx());
    expect(slot).toMatchObject({ lens: "meme", title: MEME, grain: { applied: "slot" }, meme: { uri: MEME, slot: "#/b" } });
    // L2: a slot's span rides `slotText`, a name no JSON reader mistakes for the whole carrier (`text`).
    expect((slot["meme"] as { text?: string }).text).toBeUndefined();
    expect((slot["meme"] as { slotText: string }).slotText).toMatch(/^<<~ ahu slot=`#\/b`>>[\s\S]*body of b[\s\S]*<<~\/ahu>>\n$/);
    expect((slot["meme"] as { slotText: string }).slotText).not.toContain("body of a");
    const named = await get({ ...A, title: MEME, meme: true, slot: "#/a" }, ctx());
    expect((named["meme"] as { slotText: string }).slotText).toContain("body of a");
    await expect(get({ ...A, title: MEME, meme: true, slot: "#/none" }, ctx())).rejects.toMatchObject({ reason: "slot-missing" });
    const plain = await get({ ...A, title: "Note 02", meme: true }, ctx());
    expect(plain).toMatchObject({ lens: "record", note: expect.stringMatching(/holds no meme/), tiddler: { fields: { text: "see [[Note 01]] and note 2" } } });
    expect(String(plain["has"])).toMatch(/^<<~ has name=`Note 02`/);
  });

  test("wiki-render-transclusion: a transcluding tiddler renders its transcluded text; CONTROL: a plain tiddler renders its own", async () => {
    const r = await rig();
    const render = makeWikiRenderReactor(r.opts);
    expect(await render({ ...A, title: "Handover" }, ctx())).toMatchObject({ title: "Handover", form: "text", text: "Tonight: the first note", truncated: false, next: null });
    expect((await render({ ...A, title: "Note 01" }, ctx()))["text"]).toBe("the first note");
    const html = await render({ ...A, title: "Handover", form: "html" }, ctx());
    expect(html["text"]).toBe("<p>Tonight: the first note</p>");
    r.engine.setTiddler({ title: "Headed", type: "text/vnd.tiddlywiki", text: "! A heading\n\nA paragraph." });
    expect((await render({ ...A, title: "Headed", form: "html" }, ctx()))["text"]).toBe('<h1 class="">A heading</h1><p>A paragraph.</p>');
  });

  test("wiki-render: a wikitext span renders through the same engine, and the byte cap truncates with a cursor", async () => {
    const r = await rig();
    const render = makeWikiRenderReactor(r.opts);
    expect((await render({ ...A, text: "''bold'' {{Note 01}} <$count filter='[tag[memory]]'/>", form: "html" }, ctx()))["text"]).toMatch(/<strong>bold<\/strong> the first note 12/);
    const cut = await render({ ...A, text: "abcdefghij".repeat(10), maxBytes: 30 }, ctx());
    expect(cut).toMatchObject({ truncated: true, bytes: 100 });
    expect((cut["text"] as string).length).toBe(30);
    const rest = await render({ ...A, text: "abcdefghij".repeat(10), maxBytes: 300, after: cut["next"] }, ctx());
    expect(rest).toMatchObject({ truncated: false, next: null });
    expect(`${cut["text"]}${rest["text"]}`).toBe("abcdefghij".repeat(10));
    await expect(render({ ...A }, ctx())).rejects.toThrow(/title.*text/);
    await expect(render({ ...A, title: "Nowhere" }, ctx())).rejects.toMatchObject({ reason: "tiddler-absent" });
  });

  test("tiddler-put field patch: a field and a tag land and the text's hash stays unmoved; CONTROL: a text put moves it and keeps the fields", async () => {
    const r = await rig();
    const get = makeTiddlerGetReactor(r.opts);
    const put = makeTiddlerPutReactor(r.opts);
    const before = (await get({ ...A, title: "Note 03" }, ctx()))["tiddler"] as { hash: string; textHash: string };
    const receipt = await put({ ...A, title: "Note 03", fields: { status: "done" }, tagsAdd: "reviewed [[two words]]", tagsRemove: "memory", base: before.hash }, ctx());
    expect(receipt).toMatchObject({ recipe: "default", title: "Note 03", decision: "put", bag: DAEMON, created: false, textHash: before.textHash });
    expect([...(receipt["changed"] as string[])].sort()).toEqual(["status", "tags"]);
    const after = (await get({ ...A, title: "Note 03" }, ctx()))["tiddler"] as { fields: Record<string, string>; hash: string; textHash: string };
    expect(after.fields).toMatchObject({ status: "done", tags: "reviewed [[two words]]", priority: "high", text: "see [[Note 01]] and note 3" });
    expect(after.textHash).toBe(before.textHash);
    expect(after.hash).not.toBe(before.hash);
    expect(after.hash).toBe(receipt["hash"]);
    const texted = await put({ ...A, title: "Note 03", text: "rewritten", unset: ["priority"] }, ctx());
    expect(texted["textHash"]).not.toBe(before.textHash);
    expect(((await get({ ...A, title: "Note 03" }, ctx()))["tiddler"] as { fields: Record<string, string> }).fields)
      .toEqual({ title: "Note 03", type: "text/vnd.tiddlywiki", tags: "reviewed [[two words]]", status: "done", text: "rewritten" });
    expect(await put({ ...A, title: "Note 03", fields: { status: "done" } }, ctx())).toMatchObject({ decision: "noop", changed: [] });
  });

  test("tiddler-door-plain-roundtrip: a new wikitext tiddler with tags and a custom field reads back as put", async () => {
    const r = await rig();
    const put = makeTiddlerPutReactor(r.opts);
    const made = await put({ ...A, title: "Room 4", create: true, text: "bed by the window", fields: { type: "text/vnd.tiddlywiki", tags: "room [[night shift]]", todo: "open" } }, ctx());
    expect(made).toMatchObject({ decision: "put", created: true });
    expect(((await makeTiddlerGetReactor(r.opts)({ ...A, title: "Room 4" }, ctx()))["tiddler"] as { fields: Record<string, string> }).fields)
      .toEqual({ title: "Room 4", type: "text/vnd.tiddlywiki", tags: "room [[night shift]]", todo: "open", text: "bed by the window" });
    expect(await put({ ...A, title: "Room 4", create: true, text: "again" }, ctx())).toMatchObject({ decision: "exists", hash: made["hash"] });
    expect(r.engine.wiki.getTiddlerText("Room 4")).toBe("bed by the window");
  });

  test("an append lands at the end with one joining newline, leads with its has line, and refuses a base, a text, a field patch or a missing title", async () => {
    const r = await rig();
    const put = makeTiddlerPutReactor(r.opts);
    await expect(put({ ...A, title: "Ledger", append: "one" }, ctx())).rejects.toMatchObject({ reason: "append-target-missing" });
    expect(r.engine.wiki.tiddlerExists("Ledger")).toBe(false);
    expect(await put({ ...A, title: "Ledger", append: "one", create: true }, ctx())).toMatchObject({ decision: "put", created: true });
    expect(r.engine.wiki.getTiddlerText("Ledger")).toBe("one");
    const receipt = await put({ ...A, title: "Ledger", append: "two\n" }, ctx());
    expect(String(receipt["has"])).toMatch(/^<<~ has name=`Ledger` params=`.*decision\/put hash\//);
    expect(Object.keys(receipt)[0]).toBe("has");
    await put({ ...A, title: "Ledger", append: "three", tagsAdd: "dated" }, ctx());
    expect(r.engine.wiki.getTiddlerText("Ledger")).toBe("one\ntwo\nthree");
    expect(r.engine.wiki.getTiddler("Ledger")!.fields["tags"]).toEqual(["dated"]);
    for (const crossed of [{ text: "x" }, { base: String(receipt["hash"]) }, { fields: { kind: "x" } }]) {
      await expect(put({ ...A, title: "Ledger", append: "four", ...crossed }, ctx())).rejects.toMatchObject({ reason: "append-alone" });
    }
    expect(r.engine.wiki.getTiddlerText("Ledger")).toBe("one\ntwo\nthree");
  });

  // S4, REPLACE IN PLACE (lar:///ha.ka.ba/kahua/memory/course/ai-surface-gestures #/stories): one exact span changes, the
  // rest of the text never crosses the wire, and the write rides the one put law (base, swap, family split).
  test("a replace changes one exact span: it refuses a span that occurs 0 or 2+ times by name with the count and the read that cures it, rides the base guard, and lands nothing on a refusal", async () => {
    const r = await rig();
    const put = makeTiddlerPutReactor(r.opts);
    const get = makeTiddlerGetReactor(r.opts);
    await expect(put({ ...A, title: "Errata", replace: "cat", with: "dog" }, ctx())).rejects.toMatchObject({ reason: "replace-target-missing" });
    await put({ ...A, title: "Errata", create: true, text: "the cat sat on the mat; the cat ran" }, ctx());
    const ambiguous = put({ ...A, title: "Errata", replace: "the cat", with: "a dog" }, ctx());
    await expect(ambiguous).rejects.toMatchObject({ reason: "replace-ambiguous" });
    await expect(ambiguous).rejects.toThrow(/occurs 2 times.*lares tiddler get "Errata" --recipe default/);
    // Overlaps count: `aa` in `aaa` reads twice, so the door never guesses which.
    await put({ ...A, title: "Overlap", create: true, text: "aaa" }, ctx());
    await expect(put({ ...A, title: "Overlap", replace: "aa", with: "b" }, ctx())).rejects.toMatchObject({ reason: "replace-ambiguous" });
    const absent = put({ ...A, title: "Errata", replace: "a bird", with: "a dog" }, ctx());
    await expect(absent).rejects.toMatchObject({ reason: "replace-absent" });
    await expect(absent).rejects.toThrow(/occurs 0 times/);
    expect(r.engine.wiki.getTiddlerText("Errata")).toBe("the cat sat on the mat; the cat ran");
    // A stale base answers conflict and lands nothing; the live base lands the one span, a tag patch beside it.
    const live = ((await get({ ...A, title: "Errata" }, ctx()))["tiddler"] as { hash: string }).hash;
    expect(await put({ ...A, title: "Errata", replace: "sat on the mat", with: "slept", base: "sha256-" + "0".repeat(64) }, ctx())).toMatchObject({ decision: "conflict", hash: live });
    expect(r.engine.wiki.getTiddlerText("Errata")).toBe("the cat sat on the mat; the cat ran");
    const landed = await put({ ...A, title: "Errata", replace: "sat on the mat", with: "slept", base: live, tagsAdd: "trued" }, ctx());
    expect(landed).toMatchObject({ decision: "put", created: false, replaced: { span: 14, with: 5 } });
    expect([...(landed["changed"] as string[])].sort()).toEqual(["tags", "text"]);
    expect(r.engine.wiki.getTiddlerText("Errata")).toBe("the cat slept; the cat ran");
    // An empty `with` removes the span; a whitespace span counts as it rides, never trimmed.
    await put({ ...A, title: "Errata", replace: "; the cat ran", with: "" }, ctx());
    expect(r.engine.wiki.getTiddlerText("Errata")).toBe("the cat slept");
    await expect(put({ ...A, title: "Errata", replace: " ", with: "_" }, ctx())).rejects.toMatchObject({ reason: "replace-ambiguous" });
  });

  test("a replace names its span and its words alone: another text source, a cut or create beside it refuses `replace-alone`; a missing span or `with` refuses by name", async () => {
    const r = await rig();
    const put = makeTiddlerPutReactor(r.opts);
    await put({ ...A, title: "Errata", create: true, text: "one two" }, ctx());
    for (const crossed of [{ text: "x" }, { append: "x" }, { create: true }, { cut: ["#/a"] }, { fields: { text: "x" } }, { unset: ["text"] }]) {
      await expect(put({ ...A, title: "Errata", replace: "one", with: "1", ...crossed }, ctx())).rejects.toMatchObject({ reason: "replace-alone" });
    }
    await expect(put({ ...A, title: "Errata", replace: "one" }, ctx())).rejects.toMatchObject({ reason: "replace-with-missing" });
    await expect(put({ ...A, title: "Errata", with: "1" }, ctx())).rejects.toMatchObject({ reason: "replace-span-missing" });
    await expect(put({ ...A, title: "Errata", replace: "", with: "1" }, ctx())).rejects.toMatchObject({ reason: "replace-span-missing" });
    expect(r.engine.wiki.getTiddlerText("Errata")).toBe("one two");
    // CONTROL: a field patch beside the replace rides, as beside any text put.
    expect(await put({ ...A, title: "Errata", replace: "one", with: "1", fields: { status: "trued" } }, ctx())).toMatchObject({ decision: "put" });
    expect(r.engine.wiki.getTiddler("Errata")!.fields).toMatchObject({ text: "1 two", status: "trued" });
  });

  test("concurrent appends retain both texts and a stale whole-text put refuses", async () => {
    const r = await rig();
    const put = makeTiddlerPutReactor(r.opts);
    const get = makeTiddlerGetReactor(r.opts);
    for (let i = 0; i < 20; i++) {
      const title = `Append race ${i}`;
      await put({ ...A, title, create: true, text: "start" }, ctx());
      const base = ((await get({ ...A, title }, ctx()))["tiddler"] as { hash: string }).hash;
      const receipts = await Promise.all(["first", "second"].map(append => put({ ...A, title, append }, ctx())));
      expect(receipts.map(x => x["decision"])).toEqual(["put", "put"]);
      const text = r.engine.wiki.getTiddlerText(title);
      expect(["start\nfirst\nsecond", "start\nsecond\nfirst"]).toContain(text);
      // The order the record took: the receipt that names the standing hash landed last, and its words close the text.
      const live = ((await get({ ...A, title }, ctx()))["tiddler"] as { hash: string }).hash;
      const last = receipts.findIndex(x => x["hash"] === live);
      expect(last).toBeGreaterThanOrEqual(0);
      expect(text!.endsWith(["first", "second"][last]!)).toBe(true);
      expect(await put({ ...A, title, text: "replacement", base }, ctx())).toMatchObject({ decision: "conflict" });
      expect(r.engine.wiki.getTiddlerText(title)).toBe(text);
    }
  });

  test("tiddler-put stale base refuses: a moved record answers conflict with the live hash and nothing lands; CONTROL: the live base lands", async () => {
    const r = await rig();
    const put = makeTiddlerPutReactor(r.opts);
    const live = ((await makeTiddlerGetReactor(r.opts)({ ...A, title: "Note 04" }, ctx()))["tiddler"] as { hash: string }).hash;
    const stale = await put({ ...A, title: "Note 04", fields: { status: "done" }, base: "sha256-" + "0".repeat(64) }, ctx());
    expect(stale).toMatchObject({ decision: "conflict", hash: live });
    expect(r.engine.wiki.getTiddler("Note 04")?.fields["status"]).toBeUndefined();
    expect(await put({ ...A, title: "Note 04", fields: { status: "done" }, base: live }, ctx())).toMatchObject({ decision: "put" });
  });

  test("tiddler-put fences: the face's write cap decides, a family member's text lands through the Confluence gate inside the put, a title that stays home refuses by name", async () => {
    const r = await rig();
    await placeMeme({ uri: MEME, text: memeText(["a"]) }, wikiMemeSink(r.engine.wiki));
    const put = makeTiddlerPutReactor(r.opts);
    await expect(put({ ...A, title: "Note 05", fields: { status: "x" } }, ctx(reader))).rejects.toThrow(/cap-denied: admin on .*daemon/);
    expect(await put({ ...A, title: MEME, fields: { status: "ripe" }, tagsAdd: "memory" }, ctx())).toMatchObject({ decision: "put", position: "root" });
    // A FAMILY READS AS TIDDLERS: a text put on a slot, then on the root, lands as the family; the carrier reads back whole and
    // sealed, and a slot the root's new text no longer calls leaves by the consequence the answer names.
    const sink = wikiMemeSink(r.engine.wiki);
    const coherent = async (): Promise<string> => {
      const now = (await readMeme(MEME, sink))!;
      expect(verifyBcc(now.text)).toMatch(/^(ok|head-unbound)$/);
      expect(await evaluateMeme({ uri: MEME, text: now.text, baseHash: now.canonicalHash }, sink)).toMatchObject({ decision: "noop", grade: "clean" });
      return now.text;
    };
    const slot = await put({ ...A, title: `${MEME}#/a`, text: "a slot's new words" }, ctx());
    expect(slot).toMatchObject({ decision: "put", position: "slot", family: MEME, created: false, landed: expect.arrayContaining([`${MEME}#/a`]) });
    expect(r.engine.wiki.getTiddlerText(`${MEME}#/a`)).toContain("a slot's new words");
    expect(slot["canonicalHash"]).toBe((await readMeme(MEME, sink))!.canonicalHash);
    expect(await coherent()).toContain("a slot's new words");
    // ABSENCE NEVER DELETES: a root text that names no slot keeps the slot standing, folded behind its `kahea` call.
    const root = await put({ ...A, title: MEME, text: "bare" }, ctx());
    expect(root).toMatchObject({ decision: "put", position: "root", kept: [`${MEME}#/a`], tombstoned: [] });
    expect(r.engine.wiki.getTiddlerText(`${MEME}#/a`)).toContain("a slot's new words");
    expect(r.engine.wiki.getTiddlerText(MEME)).toContain("bare");
    expect(r.engine.wiki.getTiddlerText(MEME)).toContain("<<~ kahea ahu slot=`#/a`>>");
    expect(r.engine.wiki.getTiddler(MEME)?.fields["status"]).toBe("ripe");
    expect(root["canonicalHash"]).toBe((await readMeme(MEME, sink))!.canonicalHash);
    const folded = await coherent();
    expect(folded).toContain("bare");
    expect(folded).toContain("a slot's new words");
    // A FOLDED HAND-BACK keeps too: the root's own text, call and all, put back changed lands with nothing kept or cut.
    const handBack = await put({ ...A, title: MEME, text: "bare, trued\n\n<<~ kahea ahu slot=`#/a`>>" }, ctx());
    expect(handBack).toMatchObject({ decision: "put", kept: [], tombstoned: [] });
    expect(r.engine.wiki.tiddlerExists(`${MEME}#/a`)).toBe(true);
    // A SLOT LEAVES BY NAME ALONE: a cut that names no standing omitted slot refuses and moves nothing; the cut that names
    // `#/a` takes its call out of the root's text and tombstones it.
    await expect(put({ ...A, title: MEME, cut: ["#/nope"] }, ctx())).rejects.toMatchObject({ reason: "cut-not-omitted" });
    await expect(put({ ...A, title: MEME, cut: ["a"] }, ctx())).rejects.toMatchObject({ reason: "cut-malformed" });
    await expect(put({ ...A, title: "Note 05", cut: ["#/a"] }, ctx())).rejects.toMatchObject({ reason: "cut-not-omitted" });
    expect(r.engine.wiki.tiddlerExists(`${MEME}#/a`)).toBe(true);
    const cut = await put({ ...A, title: MEME, cut: ["#/a"] }, ctx());
    expect(cut).toMatchObject({ decision: "put", position: "root", kept: [], tombstoned: expect.arrayContaining([`${MEME}#/a`]) });
    expect(r.engine.wiki.tiddlerExists(`${MEME}#/a`)).toBe(false);
    expect(r.engine.wiki.getTiddlerText(MEME)).not.toContain("kahea");
    const whole = await coherent();
    expect(whole).toContain("bare, trued");
    expect(whole).not.toContain("a slot's new words");
    // A WHOLE CARRIER ON THE ROOT speaks for the family: the same put re-splits it; a stale carrier base answers conflict.
    expect(await put({ ...A, title: MEME, text: memeText(["a", "b"]), base: "sha256:" + "0".repeat(64) }, ctx())).toMatchObject({ decision: "conflict" });
    expect(await put({ ...A, title: MEME, text: memeText(["a", "b"]), base: cut["canonicalHash"] as string }, ctx())).toMatchObject({ decision: "put", landed: expect.arrayContaining([`${MEME}#/a`, `${MEME}#/b`]) });
    expect(r.engine.wiki.getTiddlerText(`${MEME}#/b`)).toContain("body of b");
    await coherent();
    // A whole carrier that omits a standing slot keeps it as well; the same carrier with the cut named drops it.
    expect(await put({ ...A, title: MEME, text: memeText(["a"]) }, ctx())).toMatchObject({ decision: "put", kept: [`${MEME}#/b`], tombstoned: [] });
    expect((await coherent())).toContain("body of b");
    expect(await put({ ...A, title: MEME, text: memeText(["a"]), cut: ["#/b"] }, ctx())).toMatchObject({ decision: "put", kept: [], tombstoned: expect.arrayContaining([`${MEME}#/b`]) });
    expect((await coherent())).not.toContain("body of b");
    await expect(put({ ...A, title: "$:/temp/lares/secret", text: "y" }, ctx())).rejects.toMatchObject({ reason: "tiddler-withheld" });
    await expect(put({ ...A, title: "lar:///ha.ka.ba/kahua/memory/Feedback/x", text: "y" }, ctx())).rejects.toMatchObject({ reason: "stage-path-shape" });
    expect(await put({ ...A, title: "lar:///ha.ka.ba/kahua/memory/feedback/x", text: "y" }, ctx())).toMatchObject({ decision: "put" });
  });

  test("RED (#428 F1): a full-shape effect record forged through the tiddler door refuses `effect-ledger-house-only`; nothing lands, and no delete reaches a ledger row", async () => {
    const r = await rig();
    const put = makeTiddlerPutReactor(r.opts);
    const forged = effectRecordUri(DAEMON, "forged");
    const shape = { tags: LARES_EFFECT_RECORD_TAG, "event-id": "forged", "request-id": "r1", bag: DAEMON, actor: "lares", timestamp: "2026-11-21T00:00:00.000Z", "action-verb": "ADD", "archival-verb": "accession" };
    for (const asker of [undefined, "seat", "cli"] as const) {
      await expect(put({ ...A, title: forged, fields: shape, text: "my words, dressed as audit" }, { ...ctx(), ...(asker ? { asker } : {}) })).rejects.toMatchObject({ reason: "effect-ledger-house-only" });
    }
    expect(await r.composite.storeForBag(DAEMON)!.get(forged)).toBeNull();
    await r.composite.storeForBag(DAEMON)!.put(buildEffectRecordTiddler({ eventId: "real", archivalVerb: "accession", actionVerb: "ADD", requestId: "r0", bag: DAEMON, actor: "lares", timestamp: "2026-11-21T00:00:00.000Z" }), { kind: "lares-verb", requestId: "r0" });
    await r.landed();
    await expect(makeTiddlerDeleteReactor(r.opts)({ ...A, title: effectRecordUri(DAEMON, "real") }, ctx())).rejects.toMatchObject({ reason: "effect-ledger-house-only" });
    expect(await r.composite.storeForBag(DAEMON)!.get(effectRecordUri(DAEMON, "real"))).not.toBeNull();
  });

  test("RED (the record of leaving stays): the tiddler door neither writes nor deletes a shell's record of leaving, for any asker", async () => {
    const r = await rig();
    const put = makeTiddlerPutReactor(r.opts);
    const title = retiredShellUri("elyncia-referee");
    for (const asker of [undefined, "seat", "cli"] as const) {
      await expect(put({ ...A, title, text: "{}", fields: { type: "application/json" } }, { ...ctx(), ...(asker ? { asker } : {}) })).rejects.toMatchObject({ reason: "effect-ledger-house-only" });
    }
    expect(await r.composite.storeForBag(DAEMON)!.get(title)).toBeNull();
    const rec = buildRetiredShellRecord(unionRetiredShell("elyncia-referee", null, [], { face: "0xface", realmId: null, forced: false, authored: 0, carried: [] }));
    await r.composite.storeForBag(DAEMON)!.put(rec, { kind: "lares-verb", requestId: "retire-wiki" });
    await r.landed();
    await expect(makeTiddlerDeleteReactor(r.opts)({ ...A, title }, ctx())).rejects.toMatchObject({ reason: "effect-ledger-house-only" });
    expect(await r.composite.storeForBag(DAEMON)!.get(title)).not.toBeNull();
  });

  test("RED: the seat wall reads the one executable-class list: a seat-asked module, script type, plugin, startup action, global, view template and an unlisted system tag each offer (seat-startup-offer) and land nothing; CONTROL plain `$:/config` lands for a seat, and the operator's hand and no asker land every class natively", async () => {
    const r = await rig();
    const put = makeTiddlerPutReactor(r.opts);
    const as = (asker?: "seat" | "cli"): VerbContext => ({ ...ctx(), ...(asker ? { asker } : {}) });
    const classes = [
      { title: "Mod", fields: { "module-type": "startup" } }, { title: "Js", fields: { type: "application/javascript" } },
      { title: "Plug", fields: { "plugin-type": "plugin" } }, { title: "Glob", fields: { tags: "$:/tags/Global" } }, { title: "View", tagsAdd: "$:/tags/ViewTemplate" },
      { title: "Near", tagsAdd: "$:/tags/StartupActionX" }, { title: "Startup", tagsAdd: "$:/tags/StartupAction" },
      { title: "Browser", fields: { tags: "memory [[$:/tags/StartupAction/Browser]]" } },
    ];
    for (const [i, shape] of classes.entries()) {
      const title = `${shape.title} seat ${i}`;
      await expect(put({ ...A, ...shape, title }, as("seat")), `${title} offers`).rejects.toMatchObject({ reason: "seat-startup-offer" });
      expect(r.engine.wiki.getTiddler(title)).toBeUndefined();
    }
    for (const asker of ["seat", "cli", undefined] as const) {
      expect(await put({ ...A, title: `$:/config/x ${asker ?? "none"}`, text: "y" }, as(asker))).toMatchObject({ decision: "put" });
      expect(await put({ ...A, title: `Palette ${asker ?? "none"}`, text: "y", tagsAdd: "$:/tags/Palette" }, as(asker))).toMatchObject({ decision: "put" });
    }
    await expect(put({ ...A, title: "Note 06", tagsAdd: "$:/tags/StartupAction" }, as("seat"))).rejects.toMatchObject({ reason: "seat-startup-offer" });
    expect(r.engine.wiki.getTiddler("Note 06")?.fields["tags"]).toEqual(["memory"]);
    for (const asker of ["cli", undefined] as const) {
      for (const [i, shape] of classes.entries()) {
        const title = `${shape.title} ${asker ?? "none"} ${i}`;
        expect(await put({ ...A, ...shape, title }, as(asker)), `${title} lands natively`).toMatchObject({ decision: "put" });
      }
    }
  });

  test("RED: a seat's executable tiddler put lands under a standing exec lei and spends one return at the door; CONTROL: a lei that refuses leaves the offer standing", async () => {
    const r = await rig();
    const put = makeTiddlerPutReactor(r.opts);
    const spends: string[] = [];
    const execLei = { spend: async (land: { wiki: string; title: string; writer?: string }) => {
      if (land.title !== "Lei startup") throw new SwarmRefused("swarm-lei-out-of-scope", "the lei names no such title");
      spends.push(`${land.wiki}|${land.title}|${land.writer}`);
      return { lei: "c".repeat(64), n: spends.length };
    } };
    const seat: VerbContext = { ...ctx(), asker: "seat", execLei };
    expect(await put({ ...A, title: "Lei startup", tagsAdd: "$:/tags/StartupAction" }, seat)).toMatchObject({ decision: "put" });
    expect(spends).toEqual(["default|Lei startup|seat"]);
    await expect(put({ ...A, title: "Other startup", tagsAdd: "$:/tags/StartupAction" }, seat)).rejects.toMatchObject({ reason: "seat-startup-offer" });
    expect(r.engine.wiki.getTiddler("Other startup")).toBeUndefined();
  });

  test("racing seat appends to an executable record spend one exec-lei return each and both land", async () => {
    const r = await rig();
    const put = makeTiddlerPutReactor(r.opts);
    let left = 2;
    const execLei = { spend: async () => {
      if (left === 0) throw new SwarmRefused("swarm-lei-spent", "the lei holds no return");
      return { lei: "c".repeat(64), n: left-- };
    } };
    await put({ ...A, title: "Macro row", create: true, text: "\\define a() a", tagsAdd: "$:/tags/Macro" }, ctx());
    const seat: VerbContext = { ...ctx(), asker: "seat", execLei };
    const receipts = await Promise.all(["\\define b() b", "\\define c() c"].map((append) => put({ ...A, title: "Macro row", append }, seat)));
    expect(receipts.map((x) => x["decision"])).toEqual(["put", "put"]);
    expect(left).toBe(0);
    const text = r.engine.wiki.getTiddlerText("Macro row")!;
    for (const words of ["define b()", "define c()"]) expect(text).toContain(words);
  });

  test("a based whole-text put racing an append through admission refuses stale or lands beneath it, and the append survives", async () => {
    const r = await rig();
    const put = makeTiddlerPutReactor(r.opts);
    const get = makeTiddlerGetReactor(r.opts);
    for (let i = 0; i < 20; i++) {
      const title = `Based race ${i}`;
      await put({ ...A, title, create: true, text: "start" }, ctx());
      const base = ((await get({ ...A, title }, ctx()))["tiddler"] as { hash: string }).hash;
      const [appended, based] = await Promise.all([put({ ...A, title, append: "kept" }, ctx()), put({ ...A, title, text: "replacement", base }, ctx())]);
      expect(appended["decision"]).toBe("put");
      const text = r.engine.wiki.getTiddlerText(title);
      if (based["decision"] === "put") expect(text).toBe("replacement\nkept");
      else { expect(based["decision"]).toBe("conflict"); expect(text).toBe("start\nkept"); }
    }
  });

  test("★ slot-level-put witness: a tiddler put on a meme family's `#/slot` either refuses by name or leaves the carrier sealed; it never lands bytes the block check no longer covers ★", async () => {
    const r = await rig();
    const sealed = stampCarrier(memeText(["a", "b"]));
    expect(verifyBcc(sealed)).toMatch(/^(ok|head-unbound)$/);
    const placed = await placeMeme({ uri: MEME, text: sealed }, wikiMemeSink(r.engine.wiki));
    expect(placed.decision).toBe("ingest");
    const put = makeTiddlerPutReactor(r.opts);
    // SEALED, AND THE GATE'S OWN FIXED POINT: the render the meme door hands out verifies its block check (the render mints the
    // check over the bytes it frames), and that render put back under its own hash reads a clean noop at the Confluence gate.
    const sealedNow = async (): Promise<boolean> => {
      const now = (await readMeme(MEME, wikiMemeSink(r.engine.wiki)))!;
      const gate = await evaluateMeme({ uri: MEME, text: now.text, baseHash: now.canonicalHash }, wikiMemeSink(r.engine.wiki));
      return ["ok", "head-unbound"].includes(verifyBcc(now.text)) && gate.decision === "noop" && gate.grade === "clean";
    };
    expect(await sealedNow()).toBe(true);
    // The slot's carriage fields and its type derive from the text at each split: a put that names one refuses and nothing moves.
    for (const move of [{ fields: { "$slot": "#/z" } }, { fields: { type: "text/plain" } }, { text: "x", fields: { "$slot": "#/z" } }]) {
      await expect(put({ ...A, title: `${MEME}#/a`, ...move }, ctx())).rejects.toMatchObject({ reason: "family-carriage-derives" });
    }
    expect(r.engine.wiki.getTiddlerText(`${MEME}#/a`)).toContain("body of a");
    // A NEW slot title joins through its parent's text alone.
    await expect(put({ ...A, title: `${MEME}#/c`, text: "x", fields: { "$fragment-parent": MEME } }, ctx())).rejects.toMatchObject({ reason: "family-joins-by-text" });
    expect(await sealedNow()).toBe(true);
    // The slot's TEXT, through `text`, through `fields.text` and through an append: each lands through the gate, and after each
    // the carrier reads sealed and gate-clean, its sibling slot untouched.
    for (const move of [{ text: "a new body" }, { fields: { text: "a newer body" } }, { append: "and a line more" }]) {
      expect(await put({ ...A, title: `${MEME}#/a`, ...move }, ctx())).toMatchObject({ decision: "put", position: "slot", family: MEME });
      expect(await sealedNow()).toBe(true);
    }
    expect(r.engine.wiki.getTiddlerText(`${MEME}#/a`)).toContain("a newer body");
    expect(r.engine.wiki.getTiddlerText(`${MEME}#/a`)).toContain("and a line more");
    expect(r.engine.wiki.getTiddlerText(`${MEME}#/b`)).toContain("body of b");
    // A field or tag patch lands (a root field rides the render's meta block), and the carrier still reads sealed and gate-clean.
    expect(await put({ ...A, title: `${MEME}#/a`, fields: { status: "ripe" }, tagsAdd: "memory" }, ctx())).toMatchObject({ decision: "put", position: "slot" });
    expect(await sealedNow()).toBe(true);
    expect(await put({ ...A, title: MEME, fields: { status: "ripe" } }, ctx())).toMatchObject({ decision: "put", position: "root" });
    expect(await sealedNow()).toBe(true);
  });

  test("tiddler-delete: a meme root answers its consequence and refuses without the family flag; a slot leaves by the explicit cut of its parent; a plain tiddler leaves plainly with its consequence named; a stale base moves nothing", async () => {
    const r = await rig();
    await placeMeme({ uri: MEME, text: memeText(["a"]) }, wikiMemeSink(r.engine.wiki));
    const del = makeTiddlerDeleteReactor(r.opts);
    const root = await del({ ...A, title: MEME }, ctx());
    expect(root).toMatchObject({ decision: "refused", refusal: "tiddler-delete-in-a-family", tombstoned: [],
      consequence: { act: "delete", target: MEME, position: "root", family: MEME, refusals: [] } });
    expect(retractsOf(root["consequence"] as Consequence)).toEqual([MEME, `${MEME}#/a`]);
    expect(String(root["why"])).toMatch(/lares tiddler delete "lar:\/\/\/t\/x" --recipe default --family.*Nothing moved\.$/);
    expect(r.engine.wiki.tiddlerExists(MEME)).toBe(true);
    expect(r.engine.wiki.tiddlerExists(`${MEME}#/a`)).toBe(true);
    // A cut names no layer, so a mode refuses; a stale base on the slot's own record moves nothing.
    await expect(del({ ...A, title: `${MEME}#/a`, mode: "kapae" }, ctx())).rejects.toMatchObject({ reason: "delete-mode-unread" });
    expect(await del({ ...A, title: `${MEME}#/a`, base: "sha256-" + "0".repeat(64) }, ctx())).toMatchObject({ decision: "conflict", mode: "cut", tombstoned: [] });
    expect(r.engine.wiki.tiddlerExists(`${MEME}#/a`)).toBe(true);
    const cut = await del({ ...A, title: `${MEME}#/a` }, ctx());
    expect(cut).toMatchObject({ recipe: "default", decision: "removed", mode: "cut", parent: MEME, tombstoned: expect.arrayContaining([`${MEME}#/a`]), consequence: { position: "slot", family: MEME } });
    expect(String(cut["canonicalHash"])).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(r.engine.wiki.tiddlerExists(MEME)).toBe(true);
    expect(r.engine.wiki.tiddlerExists(`${MEME}#/a`)).toBe(false);
    expect(r.engine.wiki.getTiddlerText(MEME)).not.toContain("kahea");
    expect(await del({ ...A, title: "Other", base: "sha256-" + "0".repeat(64) }, ctx())).toMatchObject({ decision: "conflict" });
    expect(r.engine.wiki.tiddlerExists("Other")).toBe(true);
    await expect(del({ ...A, title: "Other" }, ctx(reader))).rejects.toThrow(/cap-denied/);
    expect(await del({ ...A, title: "Other" }, ctx())).toMatchObject({ decision: "removed", mode: "plain", tombstoned: [], retracted: ["Other"],
      consequence: { act: "delete", target: "Other", position: "plain", family: null, acts: [{ title: "Other", act: "retract", bag: DAEMON }], leaves: [], orphans: [], refusals: [] } });
    expect(r.engine.wiki.tiddlerExists("Other")).toBe(false);
    expect(await del({ ...A, title: "Other" }, ctx())).toMatchObject({ decision: "absent", tombstoned: [] });
  });

  // ── tiddler-rename ──
  /** Stamp wiki records as resting in a layer, as the shore stamps each record it lands. */
  const rest = (wiki: { getTiddler(title: string): { fields: Record<string, unknown> } | undefined; addTiddler(fields: Record<string, unknown>): void }, bag: string, titles: readonly string[]): void => {
    for (const title of titles) wiki.addTiddler({ ...wiki.getTiddler(title)!.fields, "$origin-bag": bag });
  };
  const HOME = { "$origin-bag": DAEMON } as const;
  test("tiddler-rename relinks: a tag and a list reference follow the new title through TiddlyWiki's own relink, the record moves with its fields; CONTROL: an unrelated reference stays", async () => {
    const r = await rig();
    const wiki = r.engine.wiki;
    wiki.addTiddler({ title: "Child", tags: "[[Note 01]] keep", ...HOME });
    wiki.addTiddler({ title: "Shelf", list: "[[Note 01]] Other", ...HOME });
    wiki.addTiddler({ title: "Bystander", tags: "keep", ...HOME });
    rest(wiki, DAEMON, ["Note 01"]);
    const before = wiki.getTiddler("Note 01")!.getFieldStrings();
    const out = await makeTiddlerRenameReactor(r.opts)({ ...A, title: "Note 01", to: "Note One" }, ctx());
    expect(out).toMatchObject({ recipe: "default", title: "Note 01", to: "Note One", decision: "renamed", forwarder: "Note 01" });
    expect([...(out["relinked"] as string[])].sort()).toEqual(["Child", "Shelf"]);
    const moved = wiki.getTiddler("Note One")!.getFieldStrings();
    expect(moved["text"]).toBe(before["text"]);
    expect(moved["tags"]).toBe(before["tags"]);
    expect(wiki.getTiddler("Child")!.fields["tags"]).toEqual(["Note One", "keep"]);
    expect(wiki.getTiddler("Shelf")!.fields["list"]).toEqual(["Note One", "Other"]);
    expect(wiki.getTiddler("Bystander")!.fields["tags"]).toEqual(["keep"]);
  });

  test("tiddler-rename forwarder: the title it leaves answers a pointer tiddler to the new one and renders the new content; CONTROL: the new title reads the moved record, no pointer", async () => {
    const r = await rig();
    rest(r.engine.wiki, DAEMON, ["Note 01"]);
    await makeTiddlerRenameReactor(r.opts)({ ...A, title: "Note 01", to: "Note One" }, ctx());
    const old = await makeTiddlerGetReactor(r.opts)({ ...A, title: "Note 01" }, ctx());
    expect((old["tiddler"] as { fields: Record<string, string> }).fields).toMatchObject({ title: "Note 01", "forward-to": "Note One" });
    const html = await makeWikiRenderReactor(r.opts)({ ...A, title: "Note 01", form: "text" }, ctx());
    expect(String(html["text"])).toContain("the first note");
    const fresh = await makeTiddlerGetReactor(r.opts)({ ...A, title: "Note One" }, ctx());
    expect((fresh["tiddler"] as { fields: Record<string, string> }).fields).not.toHaveProperty("forward-to");
  });

  test("tiddler-rename refuses with a cure: a standing target, a slot, a stale base, the same title, a withheld title, a read-only seat; nothing moves", async () => {
    const r = await rig();
    await placeMeme({ uri: MEME, text: memeText(["a"]) }, wikiMemeSink(r.engine.wiki));
    rest(r.engine.wiki, DAEMON, ["Note 01", "Note 02", MEME, `${MEME}#/a`]);
    const rename = makeTiddlerRenameReactor(r.opts);
    const onto = await rename({ ...A, title: "Note 01", to: "Other" }, ctx());
    expect(onto).toMatchObject({ decision: "refused", refusal: "rename-target-stands" });
    expect(String(onto["why"])).toMatch(/lares tiddler delete "Other"/);
    expect(r.engine.wiki.getTiddler("Note 01")!.fields["text"]).toBe("the first note");
    const slot = await rename({ ...A, title: `${MEME}#/a`, to: `${MEME}#/z` }, ctx());
    expect(slot).toMatchObject({ decision: "refused", refusal: "slot-without-root" });
    expect(String(slot["why"])).toContain(`lares tiddler rename "${MEME}"`);
    expect(await rename({ ...A, title: "Missing", to: "Else" }, ctx())).toMatchObject({ decision: "absent" });
    expect(await rename({ ...A, title: "Note 02", to: "Note Two", base: "sha256-" + "0".repeat(64) }, ctx())).toMatchObject({ decision: "conflict" });
    expect(r.engine.wiki.tiddlerExists("Note Two")).toBe(false);
    await expect(rename({ ...A, title: "$:/temp/lares/secret", to: "Leak" }, ctx())).rejects.toMatchObject({ reason: "tiddler-withheld" });
    await expect(rename({ ...A, title: "Note 02", to: "Note Two" }, ctx(reader))).rejects.toThrow(/cap-denied/);
    expect(await rename({ ...A, title: "Note 02", to: "Note 02" }, ctx())).toMatchObject({ decision: "refused", refusal: "rename-same-title" });
  });

  test("tiddler-rename of a meme root: the slots follow with their parent edges and a forwarder stands at the root it leaves; a slot standing at a new slot title refuses, nothing moves", async () => {
    const r = await rig();
    await placeMeme({ uri: MEME, text: memeText(["a"]) }, wikiMemeSink(r.engine.wiki));
    rest(r.engine.wiki, DAEMON, [MEME, `${MEME}#/a`]);
    const to = "lar:///t/y";
    r.engine.wiki.addTiddler({ title: `${to}#/a`, text: "squatter" });
    const blocked = await makeTiddlerRenameReactor(r.opts)({ ...A, title: MEME, to }, ctx());
    expect(blocked).toMatchObject({ decision: "refused", refusal: "rename-target-stands" });
    expect(r.engine.wiki.tiddlerExists(`${MEME}#/a`)).toBe(true);
    r.engine.wiki.deleteTiddler(`${to}#/a`);
    const out = await makeTiddlerRenameReactor(r.opts)({ ...A, title: MEME, to }, ctx());
    expect(out).toMatchObject({ decision: "renamed", consequence: { act: "rename", position: "root" } });
    expect(Object.keys(out["moved"] as object).sort()).toEqual([to, `${to}#/a`]);
    expect(String(r.engine.wiki.getTiddler(`${to}#/a`)!.fields["$fragment-parent"])).toBe(to);
    expect(r.engine.wiki.tiddlerExists(`${MEME}#/a`)).toBe(false);
    expect(r.engine.wiki.getTiddler(MEME)!.fields["forward-to"]).toBe(to);
  });

  test("RED (the guards put and delete keep): a rename onto or away from an effect-ledger title or a collapse rule refuses for the asker that may not write it; nothing lands", async () => {
    const r = await rig();
    const rename = makeTiddlerRenameReactor(r.opts);
    const ledger = effectRecordUri(DAEMON, "real");
    const RULE = `${SHORE_COLLAPSE_CONFIG_PREFIX}slot-disjoint`;
    for (const asker of [undefined, "seat", "cli"] as const) {
      const as = { ...ctx(), ...(asker ? { asker } : {}) };
      await expect(rename({ ...A, title: "Note 02", to: ledger }, as)).rejects.toMatchObject({ reason: "effect-ledger-house-only" });
      await expect(rename({ ...A, title: ledger, to: "Note Two" }, as)).rejects.toMatchObject({ reason: "effect-ledger-house-only" });
    }
    await expect(rename({ ...A, title: "Note 02", to: RULE }, { ...ctx(), asker: "seat" })).rejects.toMatchObject({ reason: "hand-act-only" });
    await expect(rename({ ...A, title: RULE, to: "Note Two" }, { ...ctx(), asker: "seat" })).rejects.toMatchObject({ reason: "hand-act-only" });
    await expect(rename({ ...A, title: "Note 02", to: RULE }, ctx())).rejects.toMatchObject({ reason: "hand-unattested" });
    expect(r.engine.wiki.tiddlerExists(RULE)).toBe(false);
    expect(r.engine.wiki.tiddlerExists("Note Two")).toBe(false);
  });

  test("RED (relink never crosses caps): a referrer resting in a layer this face cannot write refuses the rename with a COUNT and no title; nothing moves; CONTROL: working-layer referrers relink", async () => {
    const r = await rig();
    const wiki = r.engine.wiki;
    wiki.addTiddler({ title: "Mine", tags: "[[Note 01]]", ...HOME });
    wiki.addTiddler({ title: "Their Secret Child", tags: "[[Note 01]]", "$origin-bag": CANON });
    rest(wiki, DAEMON, ["Note 01"]);
    const out = await makeTiddlerRenameReactor(r.opts)({ ...A, title: "Note 01", to: "Note One" }, ctx());
    expect(out).toMatchObject({ decision: "refused", refusal: "rename-referrers-unreachable", unreachable: 1 });
    expect(JSON.stringify(out)).not.toContain("Their Secret Child");
    expect(wiki.tiddlerExists("Note One")).toBe(false);
    expect(wiki.getTiddler("Mine")!.fields["tags"]).toEqual(["Note 01"]);
    wiki.deleteTiddler("Their Secret Child");
    expect(await makeTiddlerRenameReactor(r.opts)({ ...A, title: "Note 01", to: "Note One" }, ctx())).toMatchObject({ decision: "renamed", relinked: ["Mine"] });
  });

  test("RED (relink impossible): with the Relink offering loaded, a referrer holding a link the new title cannot fit refuses rename-relink-impossible by name, counts the referrers this face cannot read, and nothing lands; CONTROL: a title that fits renames, and without the offering the rename stands as before", async () => {
    const r = await rig({ relink: true });
    const wiki = r.engine.wiki;
    // A list or tag field cannot quote a title holding `]]`: Relink marks that referrer impossible and leaves it stale, silently.
    const put = (w: typeof wiki, extra: Record<string, unknown>): void => {
      w.addTiddler({ title: "Hub", text: "the hub", ...HOME });
      w.addTiddler({ title: "Shelf", list: "[[Hub]]", ...HOME });
      w.addTiddler({ title: "Prose", type: "text/vnd.tiddlywiki", text: "see [[Hub]] here", ...HOME });
      for (const [name, fields] of Object.entries(extra)) w.addTiddler({ title: name, ...(fields as object) });
    };
    put(wiki, { "Their Secret Shelf": { tags: "[[Hub]]", "$origin-bag": CANON } });
    rest(wiki, DAEMON, ["Hub"]);
    const blind: Cap = async (access, bag) => (bag === DAEMON || (access === "read" && bag !== CANON) ? { ok: true } : { ok: false, reason: "no-grant" });
    const out = await makeTiddlerRenameReactor(r.opts)({ ...A, title: "Hub", to: "Hub ]] Two" }, ctx(blind));
    expect(out).toMatchObject({ decision: "refused", refusal: "rename-relink-impossible", impossible: 2 });
    expect(String(out["why"])).toContain('"Shelf"');
    expect(String(out["why"])).toContain("1 more held by records this face may not read");
    expect(String(out["why"])).toContain("edit the referrer by hand");
    expect(JSON.stringify(out)).not.toContain("Their Secret Shelf");
    expect(wiki.tiddlerExists("Hub ]] Two")).toBe(false);
    expect(wiki.getTiddler("Prose")!.fields["text"]).toBe("see [[Hub]] here");
    expect(wiki.getTiddler("Shelf")!.fields["list"]).toEqual(["Hub"]);
    // CONTROL: a title the links can hold renames, and the referrers follow.
    wiki.deleteTiddler("Their Secret Shelf");
    expect(await makeTiddlerRenameReactor(r.opts)({ ...A, title: "Hub", to: "Hub Two" }, ctx())).toMatchObject({ decision: "renamed", relinked: expect.arrayContaining(["Shelf", "Prose"]) });
    expect(wiki.getTiddler("Prose")!.fields["text"]).toBe("see [[Hub Two]] here");
    // CONTROL: a plugin quoting the title never refuses (no hand edits a plugin in place; Relink never rewrites one).
    const withPlugin = await rig({ relink: true });
    withPlugin.engine.wiki.addTiddler({ title: "Hub", text: "the hub", ...HOME });
    withPlugin.engine.wiki.addTiddler({ title: "Plug", "plugin-type": "plugin", tags: "[[Hub]]", ...HOME });
    rest(withPlugin.engine.wiki, DAEMON, ["Hub"]);
    expect(await makeTiddlerRenameReactor(withPlugin.opts)({ ...A, title: "Hub", to: "Hub ]] Two" }, ctx())).toMatchObject({ decision: "renamed" });
    // CONTROL: the offering absent, the door answers as it always did.
    const bare = await rig();
    put(bare.engine.wiki, {});
    rest(bare.engine.wiki, DAEMON, ["Hub"]);
    expect(await makeTiddlerRenameReactor(bare.opts)({ ...A, title: "Hub", to: "Hub ]] Two" }, ctx())).toMatchObject({ decision: "renamed" });
  });

  test("RED (no copy-up): a record resting in a layer other than the working layer refuses rename-source-layer and names that layer; the working copy of a family member elsewhere refuses too", async () => {
    const r = await rig();
    const wiki = r.engine.wiki;
    wiki.addTiddler({ title: "Canon Note", text: "canon words", "$origin-bag": CANON });
    const out = await makeTiddlerRenameReactor(r.opts)({ ...A, title: "Canon Note", to: "Mine Now" }, ctx());
    expect(out).toMatchObject({ decision: "refused", refusal: "rename-source-layer" });
    expect(String(out["why"])).toContain(CANON);
    expect(wiki.tiddlerExists("Mine Now")).toBe(false);
    await placeMeme({ uri: MEME, text: memeText(["a"]) }, wikiMemeSink(wiki));
    rest(wiki, DAEMON, [MEME]);
    rest(wiki, CANON, [`${MEME}#/a`]);
    expect(await makeTiddlerRenameReactor(r.opts)({ ...A, title: MEME, to: "lar:///t/y" }, ctx())).toMatchObject({ decision: "refused", refusal: "rename-source-layer" });
    expect(wiki.tiddlerExists("lar:///t/y")).toBe(false);
  });

  test("RED (hand-only over canon): a `lar:` title another layer holds too takes a hand alone; a seat refuses hand-act-only, the operator's line renames", async () => {
    const r = await rig();
    const lar = "lar:///t/note";
    r.engine.wiki.addTiddler({ title: lar, text: "words" });
    await r.hold(DAEMON, [lar]);
    await r.composite.storeForBag(CANON)!.put({ tiddler: { title: lar, text: "canon words" }, meta: {} }, { kind: "lares-verb", requestId: "seed" }, { bag: CANON as never });
    await r.landed();
    const rename = makeTiddlerRenameReactor(r.opts);
    await expect(rename({ ...A, title: lar, to: "lar:///t/moved" }, { ...ctx(), asker: "seat" })).rejects.toMatchObject({ reason: "hand-act-only" });
    expect(r.engine.wiki.tiddlerExists("lar:///t/moved")).toBe(false);
    expect(await rename({ ...A, title: lar, to: "lar:///t/moved" }, { ...ctx(), asker: "cli" })).toMatchObject({ decision: "renamed" });
  });

  test("RED (check-then-act): a record edited while the rename awaits is re-read; with a base the moved record answers conflict and nothing moves; without one the rename carries the newer record", async () => {
    for (const withBase of [true, false]) {
      const r = await rig();
      const lar = "lar:///t/race";
      r.engine.wiki.addTiddler({ title: lar, text: "first", ...HOME });
      const base = String(((await makeTiddlerGetReactor(r.opts)({ ...A, title: lar }, ctx()))["tiddler"] as { hash: string }).hash);
      const store = r.composite.storeForBag(CANON)!;
      const get = store.get.bind(store);
      let edited = false;
      store.get = (async (title: string) => {
        if (!edited && title === lar) { edited = true; r.engine.wiki.addTiddler({ title: lar, text: "second, written mid-rename", ...HOME }); }
        return get(title);
      }) as typeof store.get;
      const out = await makeTiddlerRenameReactor(r.opts)({ ...A, title: lar, to: "lar:///t/raced", ...(withBase ? { base } : {}) }, { ...ctx(), asker: "cli" });
      if (withBase) {
        expect(out).toMatchObject({ decision: "conflict" });
        expect(r.engine.wiki.tiddlerExists("lar:///t/raced")).toBe(false);
      } else {
        expect(out).toMatchObject({ decision: "renamed" });
        expect(r.engine.wiki.getTiddler("lar:///t/raced")!.fields["text"]).toBe("second, written mid-rename");
      }
    }
  });

  test("RED (system titles): a `$:/` title on either side refuses rename-system-title for a seat and for the operator's line, and names the put and the delete that move it by hand; no forwarder lands and no tag relinks onto a system tag, a padded title included; CONTROL: a plain tag renames and its tagged record follows", async () => {
    const r = await rig();
    const wiki = r.engine.wiki;
    wiki.addTiddler({ title: "$:/config/Thing", text: "yes", ...HOME });
    wiki.addTiddler({ title: "Plain", text: "a tag", ...HOME });
    wiki.addTiddler({ title: "Tagged", tags: "Plain", text: "<$action-setfield $tiddler='Other' text='x'/>", ...HOME });
    const rename = makeTiddlerRenameReactor(r.opts);
    for (const asker of ["seat", "cli"] as const) {
      const as = { ...ctx(), asker };
      await expect(rename({ ...A, title: "$:/config/Thing", to: "Thing" }, as)).rejects.toMatchObject({ reason: "rename-system-title" });
      await expect(rename({ ...A, title: "Plain", to: "$:/tags/StartupAction" }, as)).rejects.toMatchObject({ reason: "rename-system-title" });
    }
    await expect(rename({ ...A, title: "$:/config/Thing", to: "Thing" }, { ...ctx(), asker: "seat" })).rejects.toThrow(/lares tiddler put "Thing" --recipe default.*lares tiddler delete "\$:\/config\/Thing" --recipe default/s);
    // The engine's relink trims both titles, so a padded title would relink onto the title behind its padding.
    await expect(rename({ ...A, title: "Plain", to: " $:/tags/StartupAction" }, { ...ctx(), asker: "seat" })).rejects.toMatchObject({ reason: "fields-malformed" });
    await expect(rename({ ...A, title: "Plain", to: "Plainer " }, { ...ctx(), asker: "cli" })).rejects.toMatchObject({ reason: "fields-malformed" });
    expect(wiki.getTiddler("$:/config/Thing")!.fields["text"]).toBe("yes");
    expect(wiki.tiddlerExists("Thing")).toBe(false);
    expect(wiki.tiddlerExists("$:/tags/StartupAction")).toBe(false);
    expect(wiki.getTiddler("Tagged")!.fields["tags"]).toEqual(["Plain"]);
    expect(await rename({ ...A, title: "Plain", to: "Plainer" }, { ...ctx(), asker: "seat" })).toMatchObject({ decision: "renamed", relinked: ["Tagged"] });
    expect(wiki.getTiddler("Tagged")!.fields["tags"]).toEqual(["Plainer"]);
  });

  test("RED (a count, never a title): a rename's answer, renamed or refused, names no record the face may not read (a path child, a slot, a squatter on a slot's new title, a slot's root, a record holding the new title) and counts them `withheld`; CONTROL: the face that reads them gets each named cure", async () => {
    const sees: Cap = async (_access, bag) => (bag === DAEMON ? { ok: true } : { ok: false, reason: "no-grant" });
    const to = "lar:///t/y";
    const family = async () => {
      const r = await rig({ personal: true });
      await placeMeme({ uri: MEME, text: memeText(["a"]) }, wikiMemeSink(r.engine.wiki));
      rest(r.engine.wiki, DAEMON, [MEME, `${MEME}#/a`, "Note 01"]);
      return { r, wiki: r.engine.wiki, rename: makeTiddlerRenameReactor(r.opts) };
    };
    // A path child the face may not read stays behind unnamed, and the rename lands.
    {
      const { wiki, rename } = await family();
      wiki.addTiddler({ title: `${MEME}/hidden-child`, text: "theirs", "$origin-bag": PERSONAL });
      const out = await rename({ ...A, title: MEME, to }, ctx(sees));
      expect(out).toMatchObject({ decision: "renamed", withheld: 1 });
      expect(JSON.stringify(out)).not.toContain("hidden-child");
      expect(JSON.stringify(await (await family()).rename({ ...A, title: MEME, to }, ctx()))).not.toContain("withheld");
    }
    // A slot the face may not read refuses the family's move, unnamed.
    {
      const { wiki, rename } = await family();
      rest(wiki, PERSONAL, [`${MEME}#/a`]);
      const out = await rename({ ...A, title: MEME, to }, ctx(sees));
      expect(out).toMatchObject({ decision: "refused", refusal: "rename-source-layer", withheld: 1 });
      expect(JSON.stringify(out)).not.toContain("#/a");
      expect(wiki.tiddlerExists(to)).toBe(false);
    }
    // A hidden record on a slot's new title refuses with a count; the face that reads it gets the delete cure by name.
    {
      const { wiki, rename } = await family();
      wiki.addTiddler({ title: `${to}#/a`, text: "theirs", "$origin-bag": PERSONAL });
      const out = await rename({ ...A, title: MEME, to }, ctx(sees));
      expect(out).toMatchObject({ decision: "refused", refusal: "rename-target-stands", withheld: 1 });
      expect(String(out["why"])).not.toContain(`${to}#/a`);
      expect(String(out["why"])).toMatch(/1 title .*lares wiki status --recipe default/);
      expect(out["consequence"] as Consequence).toMatchObject({ refusals: [], versions: { [`${to}#/a`]: null } });
      expect(String((await rename({ ...A, title: MEME, to }, ctx()))["why"])).toContain(`lares tiddler delete "${to}#/a"`);
    }
    // A slot whose root the face may not read names no root and no rename of one.
    {
      const { wiki, rename } = await family();
      rest(wiki, PERSONAL, [MEME]);
      const out = await rename({ ...A, title: `${MEME}#/a`, to: `${MEME}#/z` }, ctx(sees));
      expect(out).toMatchObject({ decision: "refused", refusal: "slot-without-root" });
      expect(String(out["why"])).not.toContain("lares tiddler rename");
      expect(String(out["why"])).toContain(`lares tiddler get "${MEME}#/a" --recipe default`);
    }
    // A hidden record holding the new title itself: no delete cure and no bag name.
    {
      const { wiki, rename } = await family();
      wiki.addTiddler({ title: "Hidden Note", text: "theirs", "$origin-bag": PERSONAL });
      const out = await rename({ ...A, title: "Note 01", to: "Hidden Note" }, ctx(sees));
      expect(out).toMatchObject({ decision: "refused", refusal: "rename-target-stands" });
      expect(String(out["why"])).not.toContain("lares tiddler delete");
      expect(JSON.stringify(out)).not.toContain(PERSONAL);
      expect(wiki.getTiddler("Hidden Note")!.fields["text"]).toBe("theirs");
    }
  });

  test("RED (the relink follows the move): a slot tagged to its own root, and a record tagged to itself, land once under the new title carrying the relinked tag; no record stands again at a title the rename left", async () => {
    const r = await rig();
    const wiki = r.engine.wiki;
    await placeMeme({ uri: MEME, text: memeText(["a"]) }, wikiMemeSink(wiki));
    rest(wiki, DAEMON, [MEME, `${MEME}#/a`]);
    wiki.addTiddler({ ...wiki.getTiddler(`${MEME}#/a`)!.fields, tags: [MEME] });
    const to = "lar:///t/y";
    const out = await makeTiddlerRenameReactor(r.opts)({ ...A, title: MEME, to }, ctx());
    expect(out).toMatchObject({ decision: "renamed", relinked: [`${to}#/a`] });
    expect(wiki.allTitles().filter((t: string) => t.startsWith(`${MEME}#`))).toEqual([]);
    expect(wiki.getTiddler(`${to}#/a`)!.fields["tags"]).toEqual([to]);
    expect(String(wiki.getTiddler(`${to}#/a`)!.fields["$fragment-parent"])).toBe(to);
    expect(wiki.getTiddler(MEME)!.fields["forward-to"]).toBe(to);
    wiki.addTiddler({ title: "Self", tags: "Self keep", text: "names itself", ...HOME });
    expect(await makeTiddlerRenameReactor(r.opts)({ ...A, title: "Self", to: "Selfsame" }, ctx())).toMatchObject({ decision: "renamed", relinked: ["Selfsame"] });
    expect(wiki.getTiddler("Selfsame")!.fields).toMatchObject({ tags: ["Selfsame", "keep"], text: "names itself" });
    expect(wiki.getTiddler("Self")!.fields).toMatchObject({ "forward-to": "Selfsame" });
    expect(wiki.getTiddler("Self")!.fields["tags"]).toBeUndefined();
  });

  test("RED (no stamp, no guess): a record carrying no layer's stamp refuses rename-source-layer and names the read that shows its bag; an unstamped referrer counts unreachable; a stay-home referrer stays as it stood, counted `skipped` and unnamed; the wiki keeps its own addTiddler", async () => {
    const r = await rig();
    const wiki = r.engine.wiki;
    const rename = makeTiddlerRenameReactor(r.opts);
    const own = Object.getOwnPropertyDescriptor(wiki, "addTiddler");
    const loose = await rename({ ...A, title: "Note 01", to: "Note One" }, ctx());
    expect(loose).toMatchObject({ decision: "refused", refusal: "rename-source-layer" });
    expect(String(loose["why"])).toContain(`lares tiddler get "Note 01" --recipe default`);
    expect(wiki.tiddlerExists("Note One")).toBe(false);
    rest(wiki, DAEMON, ["Note 01"]);
    wiki.addTiddler({ title: "Loose", tags: "[[Note 01]]" });
    expect(await rename({ ...A, title: "Note 01", to: "Note One" }, ctx())).toMatchObject({ decision: "refused", refusal: "rename-referrers-unreachable", unreachable: 1 });
    expect(wiki.getTiddler("Loose")!.fields["tags"]).toEqual(["Note 01"]);
    wiki.deleteTiddler("Loose");
    wiki.addTiddler({ title: "$:/temp/lares/shelf", list: "[[Note 01]]" });
    const out = await rename({ ...A, title: "Note 01", to: "Note One" }, ctx());
    expect(out).toMatchObject({ decision: "renamed", relinked: [], skipped: 1 });
    expect(JSON.stringify(out)).not.toContain("$:/temp/lares/shelf");
    expect(wiki.getTiddler("$:/temp/lares/shelf")!.fields["list"]).toEqual(["Note 01"]);
    expect(Object.getOwnPropertyDescriptor(wiki, "addTiddler")).toEqual(own);
  });

  test("family-law-decides-position: a kahea-called slot with no parent edge reads slot, an orphan names its root address, a plain-typed parent by edge reads root; CONTROL: an edge-less `<root>#…` title nobody calls reads plain", async () => {
    const r = await rig();
    const wiki = r.engine.wiki;
    const ROOT = "lar:///t/fam";
    wiki.addTiddler({ title: ROOT, type: CARRIER, text: "head\n\n<<~ kahea ahu slot=`#/called`>>\n" });
    wiki.addTiddler({ title: `${ROOT}#/called`, type: CARRIER, text: "a part the root calls, with no parent field" });
    wiki.addTiddler({ title: `${ROOT}#/stray`, type: CARRIER, text: "no edge, no call" });
    wiki.addTiddler({ title: "lar:///t/gone#/a/b", type: CARRIER, text: "orphan", "$fragment-parent": "lar:///t/gone#/a" });
    wiki.addTiddler({ title: "Plain Parent", text: "a plain note that holds a part" });
    wiki.addTiddler({ title: "Plain Parent#/part", text: "its part", "$fragment-parent": "Plain Parent" });
    const get = makeTiddlerGetReactor(r.opts);
    const at = async (title: string) => (await get({ ...A, title }, ctx()))["tiddler"] as Record<string, unknown>;
    expect(await at(`${ROOT}#/called`)).toMatchObject({ position: "slot", family: ROOT });
    expect(await at("lar:///t/gone#/a/b")).toMatchObject({ position: "slot", family: "lar:///t/gone", orphan: true });
    expect(await at("Plain Parent")).toMatchObject({ position: "root", family: "Plain Parent" });
    const stray = await at(`${ROOT}#/stray`);
    expect(stray).toMatchObject({ position: "plain" });
    expect(stray["family"]).toBeUndefined();
    // The door that deletes reads the same law: the stray leaves as a plain tiddler, the called slot refuses.
    const del = makeTiddlerDeleteReactor(r.opts);
    expect(await del({ ...A, title: `${ROOT}#/called` }, ctx())).toMatchObject({ decision: "refused", refusal: "tiddler-delete-in-a-family" });
    expect(await del({ ...A, title: `${ROOT}#/stray` }, ctx())).toMatchObject({ decision: "removed", retracted: [`${ROOT}#/stray`] });
  });

  test("family-delete-lands-one-change: `family: true` on a root the working layer alone holds retracts the root and its slots in ONE store change, no tombstone raised; a path child and an inbound reference stay, named under leaves; CONTROL: without the flag nothing moves", async () => {
    const r = await rig();
    const wiki = r.engine.wiki;
    await placeMeme({ uri: MEME, text: memeText(["a", "b"]) }, wikiMemeSink(wiki));
    wiki.addTiddler({ title: `${MEME}/child`, type: CARRIER, text: "a path child, its own meme" });
    await r.hold(DAEMON, [MEME, `${MEME}#/a`, `${MEME}#/b`, `${MEME}/child`]);
    const calls: Array<{ tombstones: readonly string[]; retracts: readonly string[] | undefined; bag: unknown }> = [];
    const writeFamily = r.composite.writeFamily.bind(r.composite);
    r.composite.writeFamily = async (puts, tombstones, origin, options) => { calls.push({ tombstones, retracts: options?.retracts, bag: options?.bag }); return writeFamily(puts, tombstones, origin, options); };
    const del = makeTiddlerDeleteReactor(r.opts);
    expect(await del({ ...A, title: MEME }, ctx())).toMatchObject({ decision: "refused" });
    expect(calls).toHaveLength(0);
    const out = await del({ ...A, title: MEME, family: true }, ctx());
    expect(out).toMatchObject({ decision: "removed", retracted: [MEME, `${MEME}#/a`, `${MEME}#/b`], consequence: { position: "root", family: MEME, refusals: [] } });
    expect((out["consequence"] as Consequence).leaves).toContainEqual({ title: `${MEME}/child`, why: "path-child-stands-as-its-own-meme" });
    expect(calls).toEqual([{ tombstones: [], retracts: [MEME, `${MEME}#/a`, `${MEME}#/b`], bag: DAEMON }]);
    // The answer stays bounded: versions name the family and what it leaves, never the wiki's other dozen notes.
    expect(Object.keys((out["consequence"] as Consequence).versions).sort()).toEqual([MEME, `${MEME}#/a`, `${MEME}#/b`, `${MEME}/child`]);
    expect(out).toMatchObject({ mode: "plain", tombstoned: [] });
    for (const title of [MEME, `${MEME}#/a`, `${MEME}#/b`]) expect(await r.composite.storeForBag(DAEMON)!.get(title)).toBeNull();
    // The shore lands the store's change in the wiki (the rig's subscription stands in for the island adaptor).
    await r.landed();
    expect(wiki.tiddlerExists(MEME)).toBe(false);
    expect(wiki.tiddlerExists(`${MEME}#/a`)).toBe(false);
    expect(wiki.tiddlerExists(`${MEME}/child`)).toBe(true);
  });

  test("family-delete of a slot: an orphan subtree leaves as one change under the flag; a slot its parent calls leaves by the cut, the call going with it", async () => {
    const r = await rig();
    const wiki = r.engine.wiki;
    await placeMeme({ uri: MEME, text: memeText(["a"]) }, wikiMemeSink(wiki));
    wiki.addTiddler({ title: "lar:///t/gone#/a", type: CARRIER, text: "orphan", "$fragment-parent": "lar:///t/gone" });
    wiki.addTiddler({ title: "lar:///t/gone#/a/b", type: CARRIER, text: "orphan child", "$fragment-parent": "lar:///t/gone#/a" });
    const del = makeTiddlerDeleteReactor(r.opts);
    const called = await del({ ...A, title: `${MEME}#/a`, family: true }, ctx());
    expect(called).toMatchObject({ decision: "removed", mode: "cut", parent: MEME, tombstoned: expect.arrayContaining([`${MEME}#/a`]) });
    expect(wiki.tiddlerExists(`${MEME}#/a`)).toBe(false);
    expect(wiki.getTiddlerText(MEME)).not.toContain("kahea");
    expect(await del({ ...A, title: "lar:///t/gone#/a", family: true }, ctx())).toMatchObject({ decision: "removed", retracted: ["lar:///t/gone#/a", "lar:///t/gone#/a/b"] });
    await r.landed();
    expect(wiki.tiddlerExists("lar:///t/gone#/a/b")).toBe(false);
  });

  test("delete-names-its-meaning: a title standing in three layers. `reveal` retracts the top record and the wiki reads the middle layer's text; `kapae` reads not-found while both lower records still stand in their bags; CONTROL: an unknown mode refuses by name", async () => {
    const seed = async () => {
      const r = await rig({ personal: true });
      const o = { kind: "lares-verb", requestId: "seed" } as const;
      await r.composite.storeForBag(CANON)!.put({ tiddler: { title: "Tri", text: "canon words" }, meta: {} }, o);
      await r.composite.storeForBag(DAEMON)!.put({ tiddler: { title: "Tri", text: "working words" }, meta: {} }, o);
      await r.composite.storeForBag(PERSONAL)!.put({ tiddler: { title: "Tri", text: "personal words" }, meta: {} }, o);
      await r.landed();
      expect(r.engine.wiki.getTiddlerText("Tri")).toBe("personal words");
      return r;
    };
    const live = async (r: Awaited<ReturnType<typeof seed>>, bag: string) => { const rec = await r.composite.storeForBag(bag)!.get("Tri"); return rec && !rec.meta?.deleted ? (rec.tiddler as Record<string, unknown>)["text"] : rec ? "(kapae)" : null; };
    const both: Cap = async (access, bag) => (bag === DAEMON || bag === PERSONAL || access === "read" ? { ok: true } : { ok: false, reason: "no-grant" });

    // REVEAL: the top record retracts to absent; the working layer's record surfaces.
    const a = await seed();
    const revealed = await makeTiddlerDeleteReactor(a.opts)({ ...A, title: "Tri", mode: "reveal" }, ctx(both));
    expect(revealed).toMatchObject({ decision: "removed", mode: "reveal", tombstoned: [], retracted: ["Tri"],
      consequence: { acts: [{ title: "Tri", act: "retract", bag: PERSONAL, holds: [PERSONAL, DAEMON, CANON], reveals: DAEMON }] } });
    await a.landed();
    expect(a.engine.wiki.getTiddlerText("Tri")).toBe("working words");
    expect((await makeTiddlerGetReactor(a.opts)({ ...A, title: "Tri" }, ctx(both)))["tiddler"]).toMatchObject({ bag: DAEMON, fields: { text: "working words" } });
    expect([await live(a, PERSONAL), await live(a, DAEMON), await live(a, CANON)]).toEqual([null, "working words", "canon words"]);

    // NO MODE NAMED over a title lower layers hold: the delete refuses and names both meanings; nothing moves.
    const b = await seed();
    expect(await makeTiddlerDeleteReactor(b.opts)({ ...A, title: "Tri" }, ctx(both))).toMatchObject({ decision: "refused", refusal: "delete-mode-needed", tombstoned: [], retracted: [] });
    expect(b.engine.wiki.getTiddlerText("Tri")).toBe("personal words");
    // KĀPAE: a tombstone where the top record stands shadows both records beneath; they stay in their bags.
    const shadowed = await makeTiddlerDeleteReactor(b.opts)({ ...A, title: "Tri", mode: "kapae" }, ctx(both));
    expect(shadowed).toMatchObject({ decision: "removed", mode: "kapae", tombstoned: ["Tri"], retracted: [],
      consequence: { acts: [{ title: "Tri", act: "tombstone", bag: PERSONAL, holds: [PERSONAL, DAEMON, CANON], shadowed: [DAEMON, CANON] }] } });
    await b.landed();
    expect(b.engine.wiki.tiddlerExists("Tri")).toBe(false);
    expect((await makeTiddlerGetReactor(b.opts)({ ...A, title: "Tri" }, ctx(both)))["tiddler"]).toBeNull();
    expect([await live(b, PERSONAL), await live(b, DAEMON), await live(b, CANON)]).toEqual(["(kapae)", "working words", "canon words"]);

    // A face that writes the working layer alone: the kāpae lands there only where the top record rests beneath it; a
    // reveal of a record in a layer the face cannot write refuses by name and moves nothing.
    const c = await seed();
    const refused = await makeTiddlerDeleteReactor(c.opts)({ ...A, title: "Tri", mode: "reveal" }, ctx());
    expect(refused).toMatchObject({ decision: "refused", refusal: "reveal-top-unwritable", tombstoned: [], retracted: [] });
    expect(c.engine.wiki.getTiddlerText("Tri")).toBe("personal words");
    await expect(makeTiddlerDeleteReactor(c.opts)({ ...A, title: "Tri", mode: "burn" }, ctx(both))).rejects.toMatchObject({ reason: "delete-mode-unknown" });
  });

  test("a kāpae over a canon record lands in the working layer and names the layer it shadows; a reveal of it refuses, since no hand retracts canon here", async () => {
    const r = await rig();
    await r.composite.storeForBag(CANON)!.put({ tiddler: { title: "Canon Note", text: "house words" }, meta: {} }, { kind: "lares-verb", requestId: "seed" });
    await r.landed();
    const del = makeTiddlerDeleteReactor(r.opts);
    expect(await del({ ...A, title: "Canon Note", mode: "reveal" }, ctx())).toMatchObject({ decision: "refused", refusal: "reveal-top-unwritable" });
    expect(await del({ ...A, title: "Canon Note" }, ctx())).toMatchObject({ decision: "refused", refusal: "delete-mode-needed" });
    expect(await del({ ...A, title: "Canon Note", mode: "kapae" }, ctx())).toMatchObject({ decision: "removed", mode: "kapae",
      consequence: { acts: [{ title: "Canon Note", act: "tombstone", bag: DAEMON, shadows: CANON, holds: [CANON], shadowed: [CANON] }] } });
    await r.landed();
    expect(r.engine.wiki.tiddlerExists("Canon Note")).toBe(false);
    expect(((await r.composite.storeForBag(CANON)!.get("Canon Note"))!.tiddler as Record<string, unknown>)["text"]).toBe("house words");
  });

  test("delete-plain-by-default: a title the working layer alone holds leaves plainly. Its record retracts to absent and no tombstone rises in the store; CONTROL: a title a lower layer also holds refuses `delete-mode-needed` with no mode named, names both meanings, and moves nothing", async () => {
    const r = await rig();
    const o = { kind: "lares-verb", requestId: "seed" } as const;
    await r.composite.storeForBag(DAEMON)!.put({ tiddler: { title: "Solo", text: "mine alone" }, meta: {} }, o);
    await r.composite.storeForBag(CANON)!.put({ tiddler: { title: "Dup", text: "house words" }, meta: {} }, o);
    await r.composite.storeForBag(DAEMON)!.put({ tiddler: { title: "Dup", text: "my words" }, meta: {} }, o);
    await r.landed();
    const del = makeTiddlerDeleteReactor(r.opts);
    expect(await del({ ...A, title: "Solo" }, ctx())).toMatchObject({ decision: "removed", mode: "plain", tombstoned: [], retracted: ["Solo"],
      consequence: { acts: [{ title: "Solo", act: "retract", bag: DAEMON, holds: [DAEMON], reveals: null }] } });
    await r.landed();
    expect(r.engine.wiki.tiddlerExists("Solo")).toBe(false);
    expect(await r.composite.storeForBag(DAEMON)!.get("Solo")).toBeNull();
    const needed = await del({ ...A, title: "Dup" }, ctx());
    expect(needed).toMatchObject({ decision: "refused", refusal: "delete-mode-needed", tombstoned: [], retracted: [] });
    expect(String(needed["why"])).toContain("--mode kapae");
    expect(String(needed["why"])).toContain("--mode reveal");
    expect(String(needed["why"])).toContain(CANON);
    expect(r.engine.wiki.getTiddlerText("Dup")).toBe("my words");
    // A record that rests beneath the working layer alone (canon) leaves only by a kāpae: no mode named refuses toward it.
    await r.composite.storeForBag(CANON)!.put({ tiddler: { title: "Canon Only", text: "house words" }, meta: {} }, o);
    await r.landed();
    const canonOnly = await del({ ...A, title: "Canon Only" }, ctx());
    expect(canonOnly).toMatchObject({ decision: "refused", refusal: "delete-mode-needed" });
    expect(String(canonOnly["why"])).toContain("--mode kapae");
    expect(r.engine.wiki.tiddlerExists("Canon Only")).toBe(true);
  });

  test("unread-beneath-asks-the-mode: a recipe slot beneath the working layer the composer could not reach, or a stand-in for an unread document beneath it, counts as holding the title, so a plain delete refuses `delete-mode-needed` and a bare kāpae over it stays; CONTROL: an unread slot above the working layer leaves the plain delete and the bare retract plain", async () => {
    const UNREAD = "lar:///ha.ka.ba/bags/corpus/unread";
    const ABOVE = "lar:///ha.ka.ba/bags/corpus/above";
    const o = { kind: "lares-verb", requestId: "seed" } as const;
    const seed = async (r: Awaited<ReturnType<typeof rig>>): Promise<void> => {
      const working = r.composite.storeForBag(DAEMON)!;
      await working.put({ tiddler: { title: "Solo", text: "mine alone" }, meta: {} }, o);
      await working.put({ tiddler: { title: "Ghost", text: "gone" }, meta: {} }, o);
      await working.tombstone("Ghost", o);
      await r.landed();
    };
    // An unreached slot beneath the working layer (top-first order: working, the unread slot, canon).
    const r = await rig();
    await seed(r);
    r.composite.markUnreached([DAEMON, UNREAD, CANON], [UNREAD]);
    const del = makeTiddlerDeleteReactor(r.opts);
    const needed = await del({ ...A, title: "Solo" }, ctx());
    expect(needed).toMatchObject({ decision: "refused", refusal: "delete-mode-needed", tombstoned: [], retracted: [] });
    expect(String(needed["why"])).toContain("an unread layer");
    expect(r.engine.wiki.getTiddlerText("Solo")).toBe("mine alone");
    expect(await del({ ...A, title: "Ghost" }, ctx())).toMatchObject({ decision: "refused", refusal: "delete-mode-needed" });
    expect((await r.composite.storeForBag(DAEMON)!.get("Ghost"))?.meta?.deleted).toBeTruthy();
    expect(await del({ ...A, title: "Solo", mode: "kapae" }, ctx())).toMatchObject({ decision: "removed", mode: "kapae", tombstoned: ["Solo"] });

    // A mounted stand-in beneath the working layer reads unknown the same way.
    const s = await rig();
    const standIn = Object.assign(new MemoryTiddlerStore(UNREAD), { unknown: () => true });
    s.composite.addLayer({ bagId: UNREAD, store: standIn, writable: false }, 1);
    await seed(s);
    const sdel = makeTiddlerDeleteReactor(s.opts);
    expect(await sdel({ ...A, title: "Solo" }, ctx())).toMatchObject({ decision: "refused", refusal: "delete-mode-needed" });
    expect(await sdel({ ...A, title: "Ghost" }, ctx())).toMatchObject({ decision: "refused", refusal: "delete-mode-needed" });

    // CONTROL: the unread slot stands above the working layer, so nothing beneath stays unknown.
    const c = await rig();
    await seed(c);
    c.composite.markUnreached([ABOVE, DAEMON, CANON], [ABOVE]);
    const cdel = makeTiddlerDeleteReactor(c.opts);
    expect(await cdel({ ...A, title: "Solo" }, ctx())).toMatchObject({ decision: "removed", mode: "plain", retracted: ["Solo"] });
    expect(await cdel({ ...A, title: "Ghost" }, ctx())).toMatchObject({ decision: "removed", mode: "plain", retracted: ["Ghost"] });
  });

  test("retract-a-bare-kapae: a tombstone that shadows nothing retracts under a plain delete, leaving no record at all; a meme's tombstoned family retracts whole under `family`; CONTROL: a kāpae over a canon record refuses with no mode named, and `reveal` retracts it so canon surfaces", async () => {
    const r = await rig();
    const o = { kind: "lares-verb", requestId: "seed" } as const;
    const working = r.composite.storeForBag(DAEMON)!;
    await working.put({ tiddler: { title: "Ghost", text: "gone" }, meta: {} }, o);
    await working.tombstone("Ghost", o);
    for (const title of [MEME, `${MEME}#/a`]) { await working.put({ tiddler: { title, text: "x" }, meta: {} }, o); await working.tombstone(title, o); }
    await r.composite.storeForBag(CANON)!.put({ tiddler: { title: "Veiled", text: "house words" }, meta: {} }, o);
    await working.put({ tiddler: { title: "Veiled", text: "mine" }, meta: {} }, o);
    await working.tombstone("Veiled", o);
    await r.landed();
    expect(r.engine.wiki.tiddlerExists("Ghost")).toBe(false);
    const del = makeTiddlerDeleteReactor(r.opts);
    expect(await del({ ...A, title: "Ghost" }, ctx())).toMatchObject({ decision: "removed", mode: "plain", tombstoned: [], retracted: ["Ghost"] });
    expect(await working.get("Ghost")).toBeNull();
    // A tombstone that already stands answers a kāpae as absent: nothing moves.
    expect(await del({ ...A, title: MEME, mode: "kapae" }, ctx())).toMatchObject({ decision: "absent" });
    expect(await del({ ...A, title: MEME }, ctx())).toMatchObject({ decision: "refused", refusal: "tiddler-delete-in-a-family" });
    expect(await del({ ...A, title: MEME, family: true }, ctx())).toMatchObject({ decision: "removed", mode: "plain", retracted: [MEME, `${MEME}#/a`] });
    expect([await working.get(MEME), await working.get(`${MEME}#/a`)]).toEqual([null, null]);
    const veiled = await del({ ...A, title: "Veiled" }, ctx());
    expect(veiled).toMatchObject({ decision: "refused", refusal: "delete-mode-needed" });
    expect(String(veiled["why"])).toContain("--mode reveal");
    expect(r.engine.wiki.tiddlerExists("Veiled")).toBe(false);
    expect(await del({ ...A, title: "Veiled", mode: "reveal" }, ctx())).toMatchObject({ decision: "removed", mode: "reveal", retracted: ["Veiled"],
      consequence: { acts: [{ title: "Veiled", act: "retract", bag: DAEMON, reveals: CANON }] } });
    await r.landed();
    expect(r.engine.wiki.getTiddlerText("Veiled")).toBe("house words");
    // Nothing left to retract answers absent, as before.
    expect(await del({ ...A, title: "Ghost" }, ctx())).toMatchObject({ decision: "absent" });
  });

  test("a family reveal retracts the members this hand holds and keeps the rest: a working copy of a canon root retracts, the canon slots stay named under leaves, and the wiki reads canon's root again", async () => {
    const r = await rig();
    await placeMeme({ uri: MEME, text: memeText(["a"]) }, wikiMemeSink(r.engine.wiki));
    await r.hold(CANON, [MEME, `${MEME}#/a`]);
    const canonRoot = (await r.composite.storeForBag(CANON)!.get(MEME))!;
    await r.composite.storeForBag(DAEMON)!.put({ tiddler: { ...canonRoot.tiddler, status: "mine" }, meta: {} }, { kind: "lares-verb", requestId: "seed" });
    await r.landed();
    expect(r.engine.wiki.getTiddler(MEME)!.fields["status"]).toBe("mine");
    const out = await makeTiddlerDeleteReactor(r.opts)({ ...A, title: MEME, family: true, mode: "reveal" }, ctx());
    expect(out).toMatchObject({ decision: "removed", mode: "reveal", retracted: [MEME], tombstoned: [],
      consequence: { acts: [{ title: MEME, act: "retract", bag: DAEMON, holds: [DAEMON, CANON], reveals: CANON }] } });
    expect((out["consequence"] as Consequence).leaves).toContainEqual({ title: `${MEME}#/a`, why: `reveal-keeps:${CANON}` });
    await r.landed();
    expect(r.engine.wiki.tiddlerExists(MEME)).toBe(true);
    expect(r.engine.wiki.getTiddler(MEME)!.fields["status"]).toBeUndefined();
    expect(r.engine.wiki.tiddlerExists(`${MEME}#/a`)).toBe(true);
  });

  test("a hidden record never enters a consequence: a slot another bag answers stays out of a face that holds no read on that bag", async () => {
    const r = await rig();
    const wiki = r.engine.wiki;
    await placeMeme({ uri: MEME, text: memeText(["a"]) }, wikiMemeSink(wiki));
    wiki.addTiddler({ title: `${MEME}#/sealed`, type: CARRIER, text: "theirs", "$fragment-parent": MEME, "$origin-bag": bagUri("sealed") });
    const only: Cap = async (_access, bag) => (bag === DAEMON ? { ok: true } : { ok: false, reason: "no-grant" });
    const out = await makeTiddlerDeleteReactor(r.opts)({ ...A, title: MEME }, ctx(only));
    expect(JSON.stringify(out)).not.toContain("sealed");
    const whole = await makeTiddlerDeleteReactor(r.opts)({ ...A, title: MEME }, ctx());
    // The face that reads it names it: a plain delete cannot remove it from that bag, so it rides `leaves`, and the kāpae act would shadow it.
    expect((whole["consequence"] as Consequence).leaves).toContainEqual({ title: `${MEME}#/sealed`, why: `reveal-keeps:${bagUri("sealed")}` });
    const hidden = await makeTiddlerDeleteReactor(r.opts)({ ...A, title: MEME, mode: "kapae" }, ctx());
    expect(tombstonesOf(hidden["consequence"] as Consequence)).toContain(`${MEME}#/sealed`);
  });

  test("wiki-status-names-layers: a reader's face reads every layer read-only; a writer's names the working layer writable and canon read-only", async () => {
    const r = await rig();
    const status = makeWikiStatusReactor(r.opts);
    const asWriter = await status({ ...A }, ctx(writer));
    expect(asWriter).toMatchObject({ recipe: "default", working: DAEMON });
    expect(asWriter["layers"]).toEqual([
      { bag: CANON, mounted: "read-only", read: true, write: false },
      { bag: DAEMON, mounted: "writable", read: true, write: true, working: true },
    ]);
    const asReader = await status({ ...A }, ctx(reader));
    expect((asReader["layers"] as Array<{ write: boolean }>).every((l) => l.write === false)).toBe(true);
    expect((asReader["layers"] as Array<{ read: boolean }>).every((l) => l.read === true)).toBe(true);
  });

  test("RED: wiki-status reads a mounted canon layer promotion-only: a write reaches canon by action verb alone, so no lane write lands there; the working layer stays writable", async () => {
    const r = await rig();
    // A named wiki's engine mounts its canon bag writable (the routing, which `defaultWritable: false` keeps off canon); status must not call that a write door.
    const GARDEN = bagUri("garden");
    const composite = new CompositeStore();
    composite.addLayer({ bagId: GARDEN, store: new MemoryTiddlerStore(GARDEN), writable: true });
    composite.addLayer({ bagId: DAEMON, store: new MemoryTiddlerStore(DAEMON), writable: true, defaultWritable: true });
    const opts: TiddlerVerbOptions = { ...r.opts, composite, wiki: { slug: "lares", gate: GARDEN } };
    const asWriter = await makeWikiStatusReactor(opts)({ recipe: "lares" }, ctx(writer));
    expect(asWriter["layers"]).toEqual([
      { bag: GARDEN, mounted: "promotion-only", read: true, write: false },
      { bag: DAEMON, mounted: "writable", read: true, write: true, working: true },
    ]);
  });

  test("the caller's face decides reach: a face with no read on the anchor refuses every read; a wiki this island reaches no engine for refuses by name", async () => {
    const r = await rig();
    await expect(makeWikiFilterReactor(r.opts)({ ...A, filter: "[tag[memory]]" }, ctx(stranger))).rejects.toThrow(/cap-denied: read/);
    await expect(makeTiddlerGetReactor(r.opts)({ ...A, title: "Note 01" }, ctx(stranger))).rejects.toThrow(/cap-denied: read/);
    await expect(makeWikiRenderReactor(r.opts)({ ...A, title: "Note 01" }, ctx(stranger))).rejects.toThrow(/cap-denied: read/);
    await expect(makeWikiFilterReactor(r.opts)({ filter: "[tag[memory]]" }, ctx())).rejects.toMatchObject({ reason: "no-container" });
    await expect(makeWikiFilterReactor(r.opts)({ recipe: "lares", filter: "[tag[memory]]" }, ctx())).rejects.toMatchObject({ reason: "wiki-unreached" });
    await expect(makeWikiStatusReactor(r.opts)({ recipe: "lares" }, ctx())).rejects.toMatchObject({ reason: "wiki-unreached" });
    await expect(makeWikiStatusReactor(r.opts)({ bag: "lares" }, ctx())).rejects.toMatchObject({ reason: "wiki-not-anchored" });
  });

  test("RED: a named wiki answers in its own engine, never the anchor's: every verb asks the named wiki's door, and every answer names the wiki", async () => {
    const anchor = await rig();
    const named = await rig();
    named.engine.wiki.addTiddler({ title: "Only in lares", tags: "memory", text: "the named wiki's own" });
    const asked: Array<{ slug: string; write: boolean }> = [];
    const opts: TiddlerVerbOptions = { ...anchor.opts, wikis: { of: async (slug, need) => { asked.push({ slug, ...need }); return slug === "lares" ? { tw5: named.engine, composite: named.composite } : null; } } };
    const seen = await makeWikiFilterReactor(opts)({ recipe: "lares", filter: "[[Only in lares]] [[Other]]" }, ctx());
    expect(seen).toMatchObject({ recipe: "lares", titles: ["Only in lares", "Other"] });
    expect(await makeWikiFilterReactor(opts)({ ...A, filter: "[[Only in lares]is[tiddler]]" }, ctx()), "the anchor reads none of it").toMatchObject({ recipe: "default", titles: [] });
    const put = await makeTiddlerPutReactor(opts)({ recipe: "lares", title: "Landed in lares", text: "x" }, ctx());
    expect(put).toMatchObject({ recipe: "lares", decision: "put", bag: DAEMON });
    expect(named.engine.wiki.tiddlerExists("Landed in lares")).toBe(true);
    expect(anchor.engine.wiki.tiddlerExists("Landed in lares")).toBe(false);
    expect(await makeWikiStatusReactor(opts)({ recipe: "lares" }, ctx())).toMatchObject({ recipe: "lares", working: DAEMON });
    expect(asked).toEqual([{ slug: "lares", write: false }, { slug: "lares", write: true }, { slug: "lares", write: false }]);
    await expect(makeWikiFilterReactor(opts)({ recipe: "elsewhere", filter: "[all[]]" }, ctx())).rejects.toMatchObject({ reason: "wiki-unreached" });
    await expect(makeWikiFilterReactor(opts)({ recipe: "daemon", filter: "[all[]]" }, ctx()), "the daemon wiki answers to default alone").rejects.toMatchObject({ reason: "wiki-unreached" });
  });

  test("a record another bag answers stays out of a face that holds no read on that bag", async () => {
    const r = await rig();
    r.engine.wiki.addTiddler({ title: "Sealed", tags: "memory", text: "theirs", "$origin-bag": bagUri("sealed") });
    const only: Cap = async (_access, bag) => (bag === DAEMON ? { ok: true } : { ok: false, reason: "no-grant" });
    const out = await makeWikiFilterReactor(r.opts)({ ...A, filter: "[tag[memory]]" }, ctx(only));
    expect(out["titles"]).not.toContain("Sealed");
    expect(out).toMatchObject({ total: 12 });
    expect(await makeWikiFilterReactor(r.opts)({ ...A, filter: "[[Sealed]] [[Other]]" }, ctx(only))).toMatchObject({ titles: ["Other"], total: 1, withheld: 1 });
    await expect(makeTiddlerGetReactor(r.opts)({ ...A, title: "Sealed" }, ctx(only))).rejects.toThrow(/cap-denied: read on .*sealed/);
  });
});

describe.skipIf(wikiSkip)(`the reader's view: a filter and a render compute over what the face may read${skipNote}`, () => {
  test("native output selects per source, applies a template and variables, and skips empty filenames", async () => {
    const r = await rig();
    const WORKING = wikiSlotUri("notes", "working");
    r.engine.wiki.addTiddler({ title: WORKING_POINTER, text: WORKING });
    const templateText = "<$text text=<<label>>/>:<$text text=<<currentTiddler>>/>:<$text text=<<storyTiddler>>/>:{{Note 01}}";
    r.engine.wiki.addTiddler({ title: "ExportTemplate", type: "text/vnd.tiddlywiki", text: templateText });
    r.engine.wiki.addTiddler({ title: "Sealed", text: "private words", "$origin-bag": bagUri("sealed") });
    const output = makeWikiRenderOutReactor({ ...r.opts, wiki: { slug: "notes", gate: WORKING } });
    const writing: Cap = async (access, bag) => (access === "read" && bag !== bagUri("sealed")) || (access === "admin" && bag === WORKING) ? { ok: true } : { ok: false, reason: "no-grant" };
    const ask = { recipe: "notes", output: "workbench", filter: "[[Note 01]] [[Note 02]]", filename: "[is[tiddler]match[Note 01]addsuffix[.html]]", template: "ExportTemplate", variables: { label: "sent" } };
    const answer = await output(ask, ctx(writing));
    expect(answer).toMatchObject({ files: [{ name: "Note 01.html", source: "Note 01" }], skipped: ["Note 02"] });
    const native = r.engine.$tw.wiki as unknown as { parseTiddler(title: string): object; makeWidget(parser: object, options: { variables: Record<string, string> }): { render(container: object, sibling: null): void } };
    const container = r.engine.$tw.fakeDocument.createElement("div");
    native.makeWidget(native.parseTiddler("ExportTemplate"), { variables: { label: "sent", currentTiddler: "Note 01", storyTiddler: "Note 01" } }).render(container, null);
    expect((answer["files"] as Array<{ text: string }>)[0]!.text).toBe(container.innerHTML);
    r.engine.wiki.addTiddler({ title: "ExportTemplate", type: "text/vnd.tiddlywiki", text: `${templateText} {{Sealed}}` });
    const denied = await output(ask, ctx(writing));
    expect((denied["files"] as Array<{ text: string }>)[0]!.text).not.toContain("private words");
    expect(await output({ ...ask, filter: "[[Sealed]]", template: undefined }, ctx(writing))).toMatchObject({ files: [] });
    await expect(output({ ...ask, filter: "[[Note 01]]" }, ctx(reader))).rejects.toThrow(/render-output-grant-denied/);
  });
  test("the filename filter runs under the house widget over the reader's view: a house function resolves in it as in the selection", async () => {
    const r = await rig();
    const WORKING = wikiSlotUri("notes", "working");
    r.engine.wiki.addTiddler({ title: WORKING_POINTER, text: WORKING });
    r.engine.wiki.addTiddler({ title: "Road A", tags: "stage/road road/state/open", text: "open road" });
    const output = makeWikiRenderOutReactor({ ...r.opts, wiki: { slug: "notes", gate: WORKING } });
    const writing: Cap = async (access, bag) => access === "read" || (access === "admin" && bag === WORKING) ? { ok: true } : { ok: false, reason: "no-grant" };
    const answer = await output({ recipe: "notes", output: "workbench", filter: "[[Note 01]]", filename: "[is[tiddler]addsuffix[.html]] :filter[all[tiddlers]lares.road[open]count[]!match[0]]" }, ctx(writing));
    expect(await makeWikiFilterReactor(r.opts)({ ...A, filter: "[lares.road[open]]" }, ctx(writing)), "the selection resolves the same house function").toMatchObject({ titles: ["Road A"] });
    expect(answer).toMatchObject({ files: [{ name: "Note 01.html", source: "Note 01" }], skipped: [] });
  });
  test("reach-holds-inside-the-engine: a filter that reads a withheld title's text by name, or by iteration, answers none of it; CONTROL: a readable title's text answers", async () => {
    const r = await rig();
    const filter = makeWikiFilterReactor(r.opts);
    const titles = async (f: string, cap?: Cap) => (await filter({ ...A, filter: f }, ctx(cap)))["titles"] as string[];
    expect(await titles("[[Note 01]get[text]]")).toEqual(["the first note"]);
    expect(await titles("[[$:/temp/lares/secret]get[text]]")).toEqual([]);
    expect(await titles("[all[tiddlers]prefix[$:/temp/lares/]get[text]]")).toEqual([]);
    // A text reference to a hidden record reads exactly as one to a record that never stood.
    expect(await titles("[{$:/temp/lares/secret}]")).toEqual(await titles("[{Nowhere}]"));
    expect(await titles("[{$:/temp/lares/secret}]")).not.toContain("device-local");
    expect(await titles("[[$:/temp/lares/secret]is[tiddler]]")).toEqual([]);
    // A record another bag answers reads the same way to a face that holds no read on that bag.
    r.engine.wiki.addTiddler({ title: "Sealed", tags: "memory", text: "theirs", "$origin-bag": bagUri("sealed") });
    const only: Cap = async (_access, bag) => (bag === DAEMON ? { ok: true } : { ok: false, reason: "no-grant" });
    expect(await titles("[[Sealed]get[text]]", only)).toEqual([]);
    expect(await titles("[tag[memory]get[text]search[theirs]]", only)).toEqual([]);
    expect(await titles("[[Sealed]get[text]]")).toEqual(["theirs"]);
  });

  test("hidden citers never reach a target through the reader view", async () => {
    const r = await rig();
    const base = "lar:///ha.ka.ba/kahua/memory/state/";
    const target = `${base}target`, hidden = `${base}hidden`;
    r.engine.wiki.addTiddler({ title: target, text: "", "$origin-bag": DAEMON });
    r.engine.wiki.addTiddler({ title: hidden, text: `See ${target}`, "$origin-bag": bagUri("sealed") });
    const only: Cap = async (_access, bag) => bag === DAEMON ? { ok: true } : { ok: false, reason: "no-grant" };
    const filter = makeWikiFilterReactor(r.opts);
    const titles = async (f: string, cap: Cap) => (await filter({ ...A, filter: f }, ctx(cap)))["titles"] as string[];
    expect(await titles(`[[${target}]lar-refs:in[]]`, writer)).toContain(hidden);
    expect(await titles(`[[${target}]lar-refs:in[]]`, only)).not.toContain(hidden);
    expect(await titles("[lares.unreached[]]", only)).toContain(target);
    expect(await titles("[lares.unreached[]]", writer)).not.toContain(target);
  });

  test("reach-holds-inside-the-engine: a render transcludes nothing the face may not read; CONTROL: a readable transclusion renders, and the wiki itself stays whole", async () => {
    const r = await rig();
    r.engine.wiki.addTiddler({ title: "Sealed", text: "theirs", "$origin-bag": bagUri("sealed") });
    const only: Cap = async (_access, bag) => (bag === DAEMON ? { ok: true } : { ok: false, reason: "no-grant" });
    const render = makeWikiRenderReactor(r.opts);
    const span = "A:{{Note 01}} B:{{$:/temp/lares/secret}} C:{{Sealed}} D:<$count filter='[all[tiddlers]prefix[$:/temp/lares/]]'/>";
    expect((await render({ ...A, text: span }, ctx(only)))["text"]).toBe("A:the first note B: C: D:0");
    expect((await render({ ...A, text: span }, ctx()))["text"]).toBe("A:the first note B: C:theirs D:0");
    // The view hides nothing from the wiki's own engine: the records stand, and the engine's own filter still reads them.
    expect(r.engine.wiki.getTiddlerText("$:/temp/lares/secret")).toBe("device-local");
    expect(r.engine.wiki.filterTiddlers("[[$:/temp/lares/secret]get[text]]")).toEqual(["device-local"]);
  });

  test("a fold reads through the reader's view: a record in a bag the face may not read and a withheld title fold to nothing, no body, tagline or command; CONTROL: a reader of the bag reads the fold", async () => {
    const r = await rig();
    const SEALED = bagUri("sealed");
    const SHRINE = "lar:///ha.ka.ba/kahua/memory/spirit/sealed-pet";
    r.engine.wiki.addTiddler({ title: "Sealed report", description: "the sealed tagline", text: `sealed body ${"x".repeat(400)}`, "$origin-bag": SEALED });
    r.engine.wiki.addTiddler({ title: SHRINE, type: "text/memetic-wikitext+tiddlywiki", role: "the sealed role", text: "<<~ kahea ahu slot=`#/open`>>", "$origin-bag": SEALED });
    r.engine.wiki.addTiddler({ title: `${SHRINE}#/open`, type: "text/memetic-wikitext+tiddlywiki", "$fragment-parent": SHRINE, "$slot": "#/open", text: "!! Sealed loops\n\n* a sealed line", "$origin-bag": SEALED });
    const only: Cap = async (_access, bag) => (bag === DAEMON ? { ok: true } : { ok: false, reason: "no-grant" });
    const render = makeWikiRenderReactor(r.opts);
    const span = "A:<$text text={{{ [[Sealed report]meme-fold[]] }}}/> B:<$text text={{{ [[$:/temp/lares/secret]meme-fold[*]] }}}/> C:<$text text={{{ [[sealed-pet]spirit-fold[theme]] }}}/> D:<<spirit-unfold pet:\"sealed-pet\" aperture:\"pulse\">>";
    const blind = String((await render({ ...A, text: span }, ctx(only)))["text"]);
    expect(blind).toBe("A: B: C: D:");
    const seen = String((await render({ ...A, text: span }, ctx()))["text"]);
    expect(seen).toContain("the sealed tagline");
    expect(seen).toContain("`lares tiddler get 'Sealed report' --recipe default`");
    expect(seen).toContain("* a sealed line");
    expect(seen).toContain("the sealed role");
    expect(seen).not.toContain("device-local");
    expect(seen).toMatch(/B: C:/);
  });

  test("the view moves no behaviour for a readable wiki: paging, the link graph and a repeat call answer as before", async () => {
    const r = await rig();
    const filter = makeWikiFilterReactor(r.opts);
    const first = await filter({ ...A, filter: "[tag[memory]sort[title]]", limit: 5 }, ctx());
    const again = await filter({ ...A, filter: "[tag[memory]sort[title]]", limit: 5 }, ctx());
    expect(again).toEqual(first);
    r.engine.setTiddler({ title: "Note 13", tags: "memory", text: "see [[Note 02]]" });
    expect((await filter({ ...A, filter: "[[Note 02]backlinks[]]" }, ctx()))["titles"]).toEqual(["Note 13"]);
    expect((await filter({ ...A, filter: "[tag[memory]count[]]" }, ctx()))["titles"]).toEqual(["13"]);
  });
});

describe("pageFilterAnswer — the one page law the daemon verb and the record port share", () => {
  test("a cursor walks every title once, in order; a malformed cursor refuses by name", () => {
    const all = Array.from({ length: 70 }, (_, i) => `t${i}`);
    const seen: string[] = [];
    let after: string | null = null;
    for (;;) {
      const page: FilterPage = pageFilterAnswer(all, { after, limit: 32 });
      seen.push(...page.titles);
      if (page.next === null) break;
      after = page.next;
    }
    expect(seen).toEqual(all);
    expect(() => pageFilterAnswer(all, { after: "not-a-cursor" })).toThrow(/filter-cursor-malformed/);
  });
});

describe.skipIf(wikiSkip)(`a bag read through the tiddler door${skipNote}`, () => {
  const seed = async (r: Awaited<ReturnType<typeof rig>>): Promise<void> => {
    const store = r.composite.storeForBag(CANON)!;
    await store.put({ tiddler: { title: "Canon Note", text: "canon words", tags: ["law", "two words"], type: "text/vnd.tiddlywiki" }, meta: {} }, { kind: "lares-verb", requestId: "seed" }, { bag: CANON as never });
    await store.put({ tiddler: { title: "lar:///t/x", text: "root" }, meta: {} }, { kind: "lares-verb", requestId: "seed" }, { bag: CANON as never });
    await store.put({ tiddler: { title: "lar:///t/x#/a", text: "slot a" }, meta: {} }, { kind: "lares-verb", requestId: "seed" }, { bag: CANON as never });
  };

  test("RED: tiddler-get with `bag` reads that one bag's record, with its fields, hash, bag and position; CONTROL: the anchor still answers a recipe", async () => {
    const r = await rig();
    await seed(r);
    const get = makeTiddlerGetReactor(r.opts);
    const got = await get({ bag: "lares", title: "Canon Note" }, ctx());
    expect(got).toMatchObject({ title: "Canon Note", tiddler: { bag: CANON, position: "plain", fields: { text: "canon words", tags: "law [[two words]]" } } });
    expect((got["tiddler"] as { hash: string }).hash).toMatch(/^sha256-/);
    expect(await get({ bag: "lares", title: "lar:///t/x" }, ctx())).toMatchObject({ tiddler: { position: "root" } });
    expect(await get({ bag: "lares", title: "lar:///t/x#/a" }, ctx())).toMatchObject({ tiddler: { position: "slot", family: "lar:///t/x" } });
    expect(await get({ bag: "lares", title: "lar:///t/x", slot: "#/a" }, ctx())).toMatchObject({ tiddler: { fields: { text: "slot a" } } });
    expect(await get({ bag: "lares", title: "Canon Note", fields: ["tags"] }, ctx())).toMatchObject({ tiddler: { fields: { title: "Canon Note", tags: "law [[two words]]" } } });
    expect(await get({ bag: "lares", title: "Canon Note", grain: "skinny" }, ctx())).toMatchObject({ tiddler: { omitted: ["text"] } });
    const noMeme = await get({ bag: "lares", title: "lar:///t/x", meme: true }, ctx());
    expect(noMeme).toMatchObject({ bag: CANON, lens: "record", note: expect.stringMatching(/holds no meme/), tiddler: { fields: { text: "root" } } });
    expect(String(noMeme["has"])).toContain(`bag/${CANON}`);
    expect(await get({ ...A, title: "Note 01" }, ctx())).toMatchObject({ recipe: "default", tiddler: { fields: { text: "the first note" } } });
  });

  test("an absent title reads null; a face with no read on the bag refuses by name; a bag nothing reaches refuses by name; a stay-home title refuses", async () => {
    const r = await rig();
    await seed(r);
    const get = makeTiddlerGetReactor(r.opts);
    expect(await get({ bag: "lares", title: "Nowhere" }, ctx())).toMatchObject({ tiddler: null });
    await expect(get({ bag: "lares", title: "Canon Note" }, ctx(stranger))).rejects.toThrow(/cap-denied: read/);
    await expect(get({ bag: "nowhere", title: "x" }, ctx())).rejects.toThrow(/nothing reaches it/);
    await expect(get({ bag: "lares", title: "$:/temp/lares/secret" }, ctx())).rejects.toMatchObject({ reason: "tiddler-withheld" });
  });

  test("the engine verbs name the right door where a bag stands: a refusal that points at `tiddler get --bag`, `tiddler put --bag`, `tiddler delete --bag` and `tiddler get --meme --bag`; a put and a delete reach the bag's own store", async () => {
    const r = await rig();
    await expect(makeWikiFilterReactor(r.opts)({ bag: "lares", filter: "[all[]]" }, ctx())).rejects.toMatchObject({ reason: "wiki-not-anchored", message: expect.stringMatching(/runs in a wiki's own engine.*tiddler get <title> --bag.*tiddler get --meme --bag.*--recipe/s) });
    await expect(makeWikiRenderReactor(r.opts)({ bag: "lares", title: "x" }, ctx())).rejects.toMatchObject({ reason: "wiki-not-anchored" });
    await expect(makeWikiStatusReactor(r.opts)({ bag: "lares" }, ctx())).rejects.toMatchObject({ reason: "wiki-not-anchored" });
    await expect(makeWikiFilterReactor(r.opts)({ bag: "lares", filter: "[all[]]" }, ctx())).rejects.toMatchObject({ message: expect.stringMatching(/tiddler put <title> --bag <slug>.*tiddler delete <title> --bag <slug>.*tiddler delete <root> --bag <slug> --family/s) });
    // A bag the island mounts no writable layer for refuses a write by the bag's own name: nothing shadows up.
    await expect(makeTiddlerPutReactor(r.opts)({ bag: "lares", title: "x", text: "y" }, ctx())).rejects.toThrow(/bag "lar:\/\/\/ha\.ka\.ba\/bags\/lares" holds no writable layer/);
    await expect(makeTiddlerDeleteReactor(r.opts)({ bag: "lares", title: "x" }, ctx())).rejects.toThrow(/holds no writable layer/);
  });
});

describe.skipIf(wikiSkip)(`the person's collapse rules take a hand's write alone${skipNote}`, () => {
  const RULE = `${SHORE_COLLAPSE_CONFIG_PREFIX}slot-disjoint`;

  test("a seat's put or delete of a collapse rule refuses hand-act-only; a line no door read refuses hand-unattested; nothing lands", async () => {
    const r = await rig();
    const put = makeTiddlerPutReactor(r.opts);
    await expect(put({ ...A, title: RULE, create: true, bags: CANON }, { ...ctx(), asker: "seat" })).rejects.toMatchObject({ reason: "hand-act-only", message: expect.stringContaining(`lares tiddler put "${RULE}"`) });
    await expect(put({ ...A, title: RULE, create: true, bags: CANON }, ctx())).rejects.toMatchObject({ reason: "hand-unattested" });
    expect(r.engine.wiki.getTiddler(RULE)).toBeUndefined();
    await expect(makeTiddlerDeleteReactor(r.opts)({ ...A, title: RULE }, { ...ctx(), asker: "seat" })).rejects.toMatchObject({ reason: "hand-act-only" });
  });

  test("CONTROL: the operator's own line lands the rule", async () => {
    const r = await rig();
    expect(await makeTiddlerPutReactor(r.opts)({ ...A, title: RULE, create: true, text: "", fields: { bags: CANON } }, { ...ctx(), asker: "cli" })).toMatchObject({ decision: "put" });
  });
});

/** A carrier whose slot `#/a` nests a child and carries words after the child's close: the slot's `$postamble`. */
const nestedText = (tail: string): string =>
  `<<^ code=\`&#x0001;\` from=\`?\` to=\`${MEME}\`>>\n` +
  `<<^ code=\`&#x0002;\`>>\n\n\`\`\`toml meta\nuri-path = "t/x"\n\`\`\`\n\n` +
  `<<~ ahu slot=\`#/a\`>>\n\n! a\n\nbody of a\n\n<<~ ahu slot=\`#/a/z\`>>\n\nbody of z\n\n<<~/ahu>>\n\n${tail}\n\n<<~/ahu>>\n\n` +
  `<<~ ahu slot=\`#/b\`>>\n\n! b\n\nbody of b\n\n<<~/ahu>>\n` +
  `\n<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`;

describe.skipIf(wikiSkip)(`a family's slot moves by the plain put${skipNote}`, () => {
  const POST = `${MEME}#/a/$postamble`;

  test("a partial base guards a slot put within the span it read, refuses `base-outside-span` beyond it, and reads stale once the carrier moves; a put that speaks for the whole carrier refuses it", async () => {
    const r = await rig();
    await placeMeme({ uri: MEME, text: memeText(["a", "b"]) }, wikiMemeSink(r.engine.wiki));
    const get = makeTiddlerGetReactor(r.opts);
    const put = makeTiddlerPutReactor(r.opts);
    const base = ((await get({ ...A, title: MEME, meme: true, slot: "#/a" }, ctx()))["meme"] as { canonicalHash: string }).canonicalHash;
    expect(base).toMatch(/^partial:#\/a:sha256:/);
    await expect(put({ ...A, title: `${MEME}#/b`, text: "b moved", base }, ctx())).rejects.toMatchObject({ reason: "base-outside-span", message: expect.stringMatching(/lares tiddler get "lar:\/\/\/t\/x#\/b" --recipe default --meme.*Nothing moved\.$/) });
    await expect(put({ ...A, title: `${MEME}#/a`, text: "x", base: "partial:no-span" }, ctx())).rejects.toMatchObject({ reason: "base-outside-span" });
    await expect(put({ ...A, title: MEME, text: memeText(["a"]), base }, ctx())).rejects.toMatchObject({ reason: "base-from-partial" });
    expect(r.engine.wiki.getTiddlerText(`${MEME}#/a`)).toContain("body of a");
    expect(r.engine.wiki.getTiddlerText(`${MEME}#/b`)).toContain("body of b");
    const landed = await put({ ...A, title: `${MEME}#/a`, text: "a moved", base }, ctx());
    expect(landed).toMatchObject({ decision: "put", position: "slot", family: MEME, tombstoned: [] });
    expect(r.engine.wiki.getTiddlerText(`${MEME}#/a`)).toContain("a moved");
    // The carrier moved past the base: the gate answers conflict and names the hash the family reads now.
    expect(await put({ ...A, title: `${MEME}#/a`, text: "a moved again", base }, ctx())).toMatchObject({ decision: "conflict", canonicalHash: expect.stringMatching(/^sha256:[0-9a-f]{64}$/) });
    expect(r.engine.wiki.getTiddlerText(`${MEME}#/a`)).not.toContain("again");
    // A slot's text put needs no base.
    expect(await put({ ...A, title: `${MEME}#/a`, text: "a with no base" }, ctx())).toMatchObject({ decision: "put" });
  });

  test("an append on a slot joins its body's end: the postamble where one stands with text, the slot's own text otherwise, one blank line between; CONTROL: a root and a plain tiddler keep the plain join", async () => {
    const r = await rig();
    const sink = wikiMemeSink(r.engine.wiki);
    expect((await placeMeme({ uri: MEME, text: nestedText("a tail after the child") }, sink)).decision).toBe("ingest");
    expect(r.engine.wiki.getTiddlerText(POST)).toContain("a tail after the child");
    const put = makeTiddlerPutReactor(r.opts);
    const joined = await put({ ...A, title: `${MEME}#/a`, append: "\nwords at the end\n" }, ctx());
    expect(joined).toMatchObject({ decision: "put", position: "slot", family: MEME, appendedTo: POST, changed: [] });
    expect(r.engine.wiki.getTiddlerText(POST)).toMatch(/a tail after the child\n\nwords at the end/);
    expect(r.engine.wiki.getTiddlerText(`${MEME}#/a`)).not.toContain("words at the end");
    // No postamble stands under `#/b`: the words join the slot's own text.
    const own = await put({ ...A, title: `${MEME}#/b`, append: "a line for b" }, ctx());
    expect(own).toMatchObject({ decision: "put", appendedTo: `${MEME}#/b`, changed: ["text"] });
    expect(r.engine.wiki.getTiddlerText(`${MEME}#/b`)).toMatch(/body of b\n\na line for b/);
    expect((await readMeme(MEME, sink))!.text).toContain("words at the end");
    // CONTROL: the plain record join, one newline.
    const plain = await put({ ...A, title: "Other", append: "more" }, ctx());
    expect(plain).toMatchObject({ decision: "put" });
    expect(plain["appendedTo"]).toBeUndefined();
    expect(r.engine.wiki.getTiddlerText("Other")).toBe("untagged\nmore");
  });

  test("a slot's text put moves the slot's own record and leaves its standing postamble; a child the new text omits stays by reference", async () => {
    const r = await rig();
    const sink = wikiMemeSink(r.engine.wiki);
    await placeMeme({ uri: MEME, text: nestedText("a tail after the child") }, sink);
    const put = makeTiddlerPutReactor(r.opts);
    const swapped = await put({ ...A, title: `${MEME}#/a`, text: "a new body\n\n<<~ kahea ahu slot=`#/a/z`>>" }, ctx());
    expect(swapped).toMatchObject({ decision: "put", position: "slot", tombstoned: [] });
    expect(r.engine.wiki.getTiddlerText(`${MEME}#/a`)).toContain("a new body");
    expect(r.engine.wiki.getTiddlerText(POST)).toContain("a tail after the child");
    // The text that drops the child's call keeps the child (absence never deletes), and the tail's words still read.
    const dropped = await put({ ...A, title: `${MEME}#/a`, text: "a body with no call" }, ctx());
    expect(dropped).toMatchObject({ decision: "put", kept: expect.arrayContaining([`${MEME}#/a/z`]) });
    const whole = (await readMeme(MEME, sink))!.text;
    for (const words of ["a body with no call", "body of z", "a tail after the child", "body of b"]) expect(whole, words).toContain(words);
  });

  test("a replace on a slot lands as that slot's text: the span counts within the slot alone, the family recomposes and reseals, and its sibling slots stand", async () => {
    const r = await rig();
    const sink = wikiMemeSink(r.engine.wiki);
    await placeMeme({ uri: MEME, text: memeText(["a", "b"]) }, sink);
    const sealed = (await readMeme(MEME, sink))!.canonicalHash;
    const put = makeTiddlerPutReactor(r.opts);
    // `body of` reads twice in the carrier and once in `#/b`: the slot's own text answers the count.
    const trued = await put({ ...A, title: `${MEME}#/b`, replace: "body of b", with: "a trued body" }, ctx());
    expect(trued).toMatchObject({ decision: "put", position: "slot", family: MEME, replaced: { span: 9, with: 12 } });
    expect(r.engine.wiki.getTiddlerText(`${MEME}#/b`)).toContain("a trued body");
    const whole = (await readMeme(MEME, sink))!;
    expect(whole.text).toContain("a trued body");
    expect(whole.text).toContain("body of a");
    expect(whole.text).not.toContain("body of b");
    expect(whole.canonicalHash).not.toBe(sealed);
    expect(trued["canonicalHash"]).toBe(whole.canonicalHash);
    await expect(put({ ...A, title: `${MEME}#/a`, replace: "a", with: "z" }, ctx())).rejects.toMatchObject({ reason: "replace-ambiguous" });
    expect((await readMeme(MEME, sink))!.canonicalHash).toBe(whole.canonicalHash);
  });

  test("a put on a slot the family does not hold refuses `family-joins-by-text` and lands nothing; CONTROL: a fragment title under no meme root lands as a plain tiddler", async () => {
    const r = await rig();
    await placeMeme({ uri: MEME, text: memeText(["a"]) }, wikiMemeSink(r.engine.wiki));
    const put = makeTiddlerPutReactor(r.opts);
    await expect(put({ ...A, title: `${MEME}#/nope`, text: "x" }, ctx())).rejects.toMatchObject({ reason: "family-joins-by-text" });
    await expect(put({ ...A, title: `${MEME}#/nope`, append: "x" }, ctx())).rejects.toMatchObject({ reason: "append-target-missing" });
    expect(r.engine.wiki.tiddlerExists(`${MEME}#/nope`)).toBe(false);
    expect(await put({ ...A, title: "Note 01#/aside", text: "a plain aside" }, ctx())).toMatchObject({ decision: "put", position: "plain" });
  });

  test("a first record whose text frames a whole carrier founds its family with no type named", async () => {
    const r = await rig();
    const put = makeTiddlerPutReactor(r.opts);
    const founded = await put({ ...A, title: MEME, text: memeText(["a"]) }, ctx());
    expect(founded).toMatchObject({ decision: "put", created: true, position: "root", landed: expect.arrayContaining([MEME, `${MEME}#/a`]) });
    expect(r.engine.wiki.getTiddler(MEME)?.fields["type"]).toBe(CARRIER);
  });

  // THE MANDATE'S GROUND (`lares spirit mandate <pet>#<n> --file x.mem`, `@lararium/mesh/spirit-summons`): a carrier mandate
  // lands as the carrier alone and reads by the hash the family holds.
  test("a mandate's carrier founds its family by the put alone: its fields read off its own meta, a field beside it refuses `carrier-speaks-whole`, the same carrier put again answers `noop`, and the meme lens hashes the recompose, which a slot's move moves", async () => {
    const r = await rig();
    const put = makeTiddlerPutReactor(r.opts);
    const get = makeTiddlerGetReactor(r.opts);
    const URI = "lar:///ha.ka.ba/kahua/memory/mandate/0123456789abcdef";
    const SEED = "ab".repeat(32);
    const carrier = stampCarrier(
      `<<^ code=\`&#x0001;\` from=\`?\` to=\`${URI}\`>>\n<<^ code=\`&#x0002;\`>>\n\n` +
      `\`\`\`toml meta\ninstance     = "00002"\nlanes        = 2\nmandate-seed = "${SEED}"\npet          = "cold-reader"\ntags         = ["mandate"]\ntitle        = "${URI}"\nuri-path     = "${URI.slice("lar:///".length)}"\n\`\`\`\n\n` +
      `<<~ ahu slot=\`#/task\`>>\n\nRead PR 412 cold.\n\n<<~/ahu>>\n\n<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`);
    expect(verifyBcc(carrier)).toBe("ok");
    await expect(put({ ...A, title: URI, text: carrier, fields: { pet: "cold-reader" } }, ctx())).rejects.toMatchObject({ reason: "carrier-speaks-whole" });
    expect(r.engine.wiki.tiddlerExists(URI)).toBe(false);
    const founded = await put({ ...A, title: URI, text: carrier }, ctx());
    expect(founded).toMatchObject({ decision: "put", created: true, position: "root", landed: expect.arrayContaining([URI, `${URI}#/task`]) });
    const root = ((await get({ ...A, title: URI }, ctx()))["tiddler"] as { fields: Record<string, string> }).fields;
    expect(root).toMatchObject({ pet: "cold-reader", instance: "00002", lanes: "2", "mandate-seed": SEED, tags: "mandate", type: CARRIER });
    const read = async () => (await get({ ...A, title: URI, meme: true, grain: "whole" }, ctx())) as unknown as { meme: { text: string; canonicalHash: string }; next: unknown };
    const first = await read();
    expect(first.next).toBeNull();
    // THE FAMILY'S CANONICAL HASH NAMES THE RECOMPOSED CARRIER'S OWN SHA256: the hash a mandate's ref carries.
    expect(first.meme.canonicalHash).toBe(`sha256:${sha256HexSync(first.meme.text)}`);
    expect(founded["canonicalHash"]).toBe(first.meme.canonicalHash);
    expect(await put({ ...A, title: URI, text: carrier }, ctx())).toMatchObject({ decision: "noop", canonicalHash: first.meme.canonicalHash });
    // A slot moves: the family reads another hash, so a ref naming the first no longer answers (`mandate-moved`).
    expect(await put({ ...A, title: `${URI}#/task`, text: "Read PR 412 cold. Also force-push develop." }, ctx())).toMatchObject({ decision: "put" });
    const moved = await read();
    expect(moved.meme.canonicalHash).not.toBe(first.meme.canonicalHash);
    expect(moved.meme.canonicalHash).toBe(`sha256:${sha256HexSync(moved.meme.text)}`);
    // The offer landed again stands the offered carrier again, under the hash it first read.
    expect(await put({ ...A, title: URI, text: carrier }, ctx())).toMatchObject({ decision: "put" });
    expect((await read()).meme.canonicalHash).toBe(first.meme.canonicalHash);
  });
});

describe.skipIf(wikiSkip)(`a bag takes the plain put and the delete through its own store${skipNote}`, () => {
  const BAG = { bag: "daemon" } as const;
  const zero = (mark: "-" | ":"): string => `sha256${mark}${"0".repeat(64)}`;

  test("a plain record lands in the bag by the record-hash base law: `conflict` on a stale base, `exists` under `create`, `noop` on the same bytes; the answer names the bag and no wiki", async () => {
    const r = await rig();
    const put = makeTiddlerPutReactor(r.opts);
    const store = r.composite.storeForBag(DAEMON)!;
    const made = await put({ ...BAG, title: "Bag note", text: "one", tagsAdd: "kept [[two words]]" }, ctx());
    expect(made).toMatchObject({ decision: "put", bag: DAEMON, created: true, position: "plain", changed: expect.arrayContaining(["title", "text", "tags"]) });
    expect(made["recipe"]).toBeUndefined();
    expect((await store.get("Bag note"))?.tiddler).toMatchObject({ title: "Bag note", text: "one", tags: "kept [[two words]]" });
    // The hash the put hands back reads as the hash the bag's own get answers.
    const read = await makeTiddlerGetReactor(r.opts)({ ...BAG, title: "Bag note" }, ctx());
    expect((read["tiddler"] as { hash: string }).hash).toBe(made["hash"]);
    expect(await put({ ...BAG, title: "Bag note", text: "two", base: zero("-") }, ctx())).toMatchObject({ decision: "conflict", hash: made["hash"] });
    expect(await put({ ...BAG, title: "Bag note", text: "two", create: true }, ctx())).toMatchObject({ decision: "exists", hash: made["hash"] });
    expect(await put({ ...BAG, title: "Bag note", text: "one" }, ctx())).toMatchObject({ decision: "noop" });
    expect((await store.get("Bag note"))?.tiddler["text"]).toBe("one");
    expect(await put({ ...BAG, title: "Bag note", text: "two", base: made["hash"] as string }, ctx())).toMatchObject({ decision: "put", created: false, changed: ["text"] });
    expect(await put({ ...BAG, title: "Bag note", append: "three" }, ctx())).toMatchObject({ decision: "put", appended: 5 });
    expect((await store.get("Bag note"))?.tiddler["text"]).toBe("two\nthree");
  });

  test("the bag's gates stand: a bag with no writable layer refuses by name, a hand with no admin cap refuses, a stay-home title and a rendered tiddler refuse; nothing lands", async () => {
    const r = await rig();
    const put = makeTiddlerPutReactor(r.opts);
    const store = r.composite.storeForBag(DAEMON)!;
    await expect(put({ bag: "lares", title: "x", text: "y" }, ctx())).rejects.toThrow(/holds no writable layer/);
    await expect(put({ ...BAG, title: "x", text: "y" }, ctx(reader))).rejects.toThrow(/cap-denied: admin/);
    await expect(put({ ...BAG, title: "$:/temp/lares/secret", text: "y" }, ctx())).rejects.toMatchObject({ reason: "tiddler-withheld" });
    await expect(put({ ...BAG, title: "x", text: "y", fields: { "rendered-from": "lar:///t/road" } }, ctx())).rejects.toMatchObject({ reason: "rendered-derives" });
    await expect(put({ ...BAG, recipe: "default", title: "x", text: "y" }, ctx())).rejects.toMatchObject({ reason: "no-container" });
    expect(await store.get("x")).toBeNull();
  });

  test("a family's text lands in the bag through the Confluence gate: a framed root founds, a slot's text and append move it, a slot the text omits stays until `cut` names it, a stale carrier base answers `conflict`", async () => {
    const r = await rig();
    const put = makeTiddlerPutReactor(r.opts);
    const store = r.composite.storeForBag(DAEMON)!;
    const founded = await put({ ...BAG, title: MEME, text: memeText(["a", "b"]) }, ctx());
    expect(founded).toMatchObject({ decision: "put", bag: DAEMON, created: true, position: "root", landed: expect.arrayContaining([MEME, `${MEME}#/a`, `${MEME}#/b`]), kept: [], tombstoned: [] });
    expect(String(founded["canonicalHash"])).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect((await store.get(MEME))?.tiddler["type"]).toBe(CARRIER);
    expect(await put({ ...BAG, title: `${MEME}#/a`, text: "a in the bag" }, ctx())).toMatchObject({ decision: "put", position: "slot", family: MEME });
    expect(await put({ ...BAG, title: `${MEME}#/a`, append: "and a line" }, ctx())).toMatchObject({ decision: "put", appendedTo: `${MEME}#/a` });
    expect(String((await store.get(`${MEME}#/a`))?.tiddler["text"])).toMatch(/a in the bag\n\nand a line/);
    await expect(put({ ...BAG, title: `${MEME}#/a`, fields: { "$slot": "#/z" } }, ctx())).rejects.toMatchObject({ reason: "family-carriage-derives", message: expect.stringMatching(/--bag daemon/) });
    expect(await put({ ...BAG, title: MEME, text: memeText(["a", "b"]), base: zero(":") }, ctx())).toMatchObject({ decision: "conflict" });
    // ABSENCE NEVER DELETES: the carrier that omits `#/b` keeps it by reference; the cut names what leaves.
    expect(await put({ ...BAG, title: MEME, text: memeText(["a"]) }, ctx())).toMatchObject({ decision: "put", kept: [`${MEME}#/b`], tombstoned: [] });
    expect((await store.get(`${MEME}#/b`))?.meta?.deleted).not.toBe(true);
    expect(await put({ ...BAG, title: MEME, cut: ["#/b"] }, ctx())).toMatchObject({ decision: "put", kept: [], tombstoned: expect.arrayContaining([`${MEME}#/b`]) });
    const after = await makeTiddlerGetReactor(r.opts)({ ...BAG, title: MEME, meme: true, grain: "whole" }, ctx());
    expect(String((after["meme"] as { text: string }).text)).not.toContain("body of b");
  });

  test("a bag's delete: a plain record leaves its bag, a root refuses without the family act and leaves whole with it, a slot leaves by the cut of its parent, a mode refuses by name", async () => {
    const r = await rig();
    const put = makeTiddlerPutReactor(r.opts);
    const del = makeTiddlerDeleteReactor(r.opts);
    const store = r.composite.storeForBag(DAEMON)!;
    const live = async (title: string): Promise<boolean> => { const held = await store.get(title); return held !== null && held.meta?.deleted !== true; };
    const note = await put({ ...BAG, title: "Bag note", text: "one" }, ctx());
    await put({ ...BAG, title: MEME, text: memeText(["a", "b"]) }, ctx());
    // A plain record: a stale base moves nothing, then it leaves.
    expect(await del({ ...BAG, title: "Bag note", base: zero("-") }, ctx())).toMatchObject({ decision: "conflict", bag: DAEMON, hash: note["hash"] });
    expect(await live("Bag note")).toBe(true);
    const left = await del({ ...BAG, title: "Bag note", base: note["hash"] as string }, ctx());
    expect(left).toMatchObject({ decision: "removed", mode: "plain", bag: DAEMON });
    expect(left["recipe"]).toBeUndefined();
    expect([...(left["tombstoned"] as string[]), ...(left["retracted"] as string[])]).toEqual(["Bag note"]);
    expect(await live("Bag note")).toBe(false);
    expect(await del({ ...BAG, title: "Bag note" }, ctx())).toMatchObject({ decision: "absent" });
    // A root: the family act by name.
    const refused = await del({ ...BAG, title: MEME }, ctx());
    expect(refused).toMatchObject({ decision: "refused", refusal: "tiddler-delete-in-a-family", bag: DAEMON });
    expect(String(refused["why"])).toMatch(/lares tiddler delete "lar:\/\/\/t\/x" --bag daemon --family.*Nothing moved\.$/);
    expect(await live(MEME)).toBe(true);
    await expect(del({ ...BAG, title: MEME, family: true, mode: "kapae" }, ctx())).rejects.toMatchObject({ reason: "delete-mode-unread" });
    await expect(del({ ...BAG, title: MEME, family: true }, ctx(reader))).rejects.toThrow(/cap-denied: admin/);
    // A slot: the explicit cut, its answer naming what the cut tombstoned.
    const cut = await del({ ...BAG, title: `${MEME}#/b` }, ctx());
    expect(cut).toMatchObject({ decision: "removed", mode: "cut", bag: DAEMON, parent: MEME, tombstoned: expect.arrayContaining([`${MEME}#/b`]) });
    expect(await live(`${MEME}#/b`)).toBe(false);
    expect(await live(`${MEME}#/a`)).toBe(true);
    // The family: a stale carrier base moves nothing, then the root and its slots leave as one change.
    expect(await del({ ...BAG, title: MEME, family: true, base: zero(":") }, ctx())).toMatchObject({ decision: "conflict" });
    const gone = await del({ ...BAG, title: MEME, family: true }, ctx());
    expect(gone).toMatchObject({ decision: "removed", mode: "plain", bag: DAEMON });
    expect([...(gone["tombstoned"] as string[]), ...(gone["retracted"] as string[])].sort()).toEqual([MEME, `${MEME}#/a`]);
    expect(await live(MEME)).toBe(false);
    expect(await del({ ...BAG, title: MEME, family: true }, ctx())).toMatchObject({ decision: "absent" });
  });
});
