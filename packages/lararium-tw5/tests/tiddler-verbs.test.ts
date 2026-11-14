/**
 * TIDDLER VERBS — `wiki-filter` · `tiddler-get` · `wiki-render` · `tiddler-put` · `tiddler-delete` · `wiki-status`,
 * the tiddler door on the anchor (`recipe: "default"`, the worn face's daemon wiki), through the island's own engine.
 *
 * Each red names its row in lar:///ha.ka.ba/lares/docs/pono/wiki-surface-scout #/a-lean, each beside a control.
 * A real engine boots here (`bootTestWiki`), so a filter, a backlink and a render answer as TiddlyWiki answers them.
 */
import { describe, test, expect } from "vitest";
import { CompositeStore, bagUri } from "@lararium/mesh";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { placeMeme, wikiMemeSink } from "../src/place-meme.js";
import {
  makeWikiFilterReactor, makeTiddlerGetReactor, makeWikiRenderReactor, makeTiddlerPutReactor, makeTiddlerDeleteReactor,
  makeWikiStatusReactor, pageFilterAnswer, WIKI_FILTER_ROWS, type FilterPage, type TiddlerVerbOptions,
} from "../src/tiddler-verbs.js";
import { AUDIT_ARRAY_CAP, boundOutcomeOutput } from "../src/verb-vm.js";
import type { VerbContext } from "../src/verb-dispatcher.js";
import { bootTestWiki, skipNote, wikiSkip } from "./test-wiki.js";

const DAEMON = bagUri("daemon");
const CANON = bagUri("lares");
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

async function rig() {
  const engine = await bootTestWiki({ tiddlers: [
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
  const opts: TiddlerVerbOptions = { composite, tw5: engine };
  return { engine, opts, composite };
}
const A = { recipe: "default" } as const;

describe.skipIf(wikiSkip)(`the tiddler door on the anchor${skipNote}`, () => {
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

  test("tiddler-get: a plain tiddler answers its fields (today's meme get drops them); fields-only leaves the text home", async () => {
    const r = await rig();
    const get = makeTiddlerGetReactor(r.opts);
    const whole = await get({ ...A, title: "Note 02" }, ctx());
    expect(whole).toMatchObject({ recipe: "default", title: "Note 02", tiddler: {
      fields: { title: "Note 02", tags: "memory", priority: "low", type: "text/vnd.tiddlywiki", text: "see [[Note 01]] and note 2" }, position: "plain" } });
    const t = whole["tiddler"] as { hash: string; textHash: string };
    expect(t.hash).toMatch(/^sha256-[0-9a-f]{64}$/);
    expect(t.textHash).toMatch(/^sha256-[0-9a-f]{64}$/);
    const skinny = await get({ ...A, title: "Note 02", text: false }, ctx());
    const s = skinny["tiddler"] as { fields: Record<string, string>; hash: string; textHash: string; omitted: string[] };
    expect(s.fields).toEqual({ title: "Note 02", tags: "memory", priority: "low", type: "text/vnd.tiddlywiki" });
    expect(s.omitted).toEqual(["text"]);
    expect(s.hash).toBe(t.hash);
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

  test("tiddler-put stale base refuses: a moved record answers conflict with the live hash and nothing lands; CONTROL: the live base lands", async () => {
    const r = await rig();
    const put = makeTiddlerPutReactor(r.opts);
    const live = ((await makeTiddlerGetReactor(r.opts)({ ...A, title: "Note 04" }, ctx()))["tiddler"] as { hash: string }).hash;
    const stale = await put({ ...A, title: "Note 04", fields: { status: "done" }, base: "sha256-" + "0".repeat(64) }, ctx());
    expect(stale).toMatchObject({ decision: "conflict", hash: live });
    expect(r.engine.wiki.getTiddler("Note 04")?.fields["status"]).toBeUndefined();
    expect(await put({ ...A, title: "Note 04", fields: { status: "done" }, base: live }, ctx())).toMatchObject({ decision: "put" });
  });

  test("tiddler-put fences: the face's write cap decides, a family member's text stays at the meme door, code-bearing shapes refuse by name", async () => {
    const r = await rig();
    await placeMeme({ uri: MEME, text: memeText(["a"]) }, wikiMemeSink(r.engine.wiki));
    const put = makeTiddlerPutReactor(r.opts);
    await expect(put({ ...A, title: "Note 05", fields: { status: "x" } }, ctx(reader))).rejects.toThrow(/cap-denied: admin on .*daemon/);
    await expect(put({ ...A, title: MEME, text: "bare" }, ctx())).rejects.toMatchObject({ reason: "tiddler-put-in-a-family" });
    await expect(put({ ...A, title: `${MEME}#/a`, text: "bare" }, ctx())).rejects.toMatchObject({ reason: "tiddler-put-in-a-family" });
    expect(await put({ ...A, title: MEME, fields: { status: "ripe" }, tagsAdd: "memory" }, ctx())).toMatchObject({ decision: "put", position: "root" });
    for (const bad of [
      { title: "$:/config/x", text: "y" }, { title: "Mod", fields: { "module-type": "startup" } }, { title: "Js", fields: { type: "application/javascript" } },
      { title: "Tagged", tagsAdd: "$:/tags/StartupAction" }, { title: "Tagged", fields: { tags: "$:/tags/Global" } }, { title: "$:/temp/lares/secret", text: "y" },
    ]) await expect(put({ ...A, ...bad }, ctx())).rejects.toMatchObject({ reason: expect.stringMatching(/^(tiddler-put-code-class|tiddler-withheld)$/) });
    await expect(put({ ...A, title: "lar:///ha.ka.ba/kahua/memory/feedback/x", text: "y" }, ctx())).rejects.toMatchObject({ reason: "row-key-missing" });
    expect(await put({ ...A, title: "lar:///ha.ka.ba/kahua/memory/feedback/x", text: "y", fields: { "row-key": "feedback/x" } }, ctx())).toMatchObject({ decision: "put" });
  });

  test("tiddler-delete: a meme root or slot refuses toward the meme door; a plain tiddler leaves with its consequence named; a stale base moves nothing", async () => {
    const r = await rig();
    await placeMeme({ uri: MEME, text: memeText(["a"]) }, wikiMemeSink(r.engine.wiki));
    const del = makeTiddlerDeleteReactor(r.opts);
    await expect(del({ ...A, title: MEME }, ctx())).rejects.toMatchObject({ reason: "tiddler-delete-in-a-family", message: expect.stringContaining("use the meme door") });
    await expect(del({ ...A, title: `${MEME}#/a` }, ctx())).rejects.toMatchObject({ reason: "tiddler-delete-in-a-family" });
    expect(r.engine.wiki.tiddlerExists(MEME)).toBe(true);
    expect(await del({ ...A, title: "Other", base: "sha256-" + "0".repeat(64) }, ctx())).toMatchObject({ decision: "conflict" });
    expect(r.engine.wiki.tiddlerExists("Other")).toBe(true);
    await expect(del({ ...A, title: "Other" }, ctx(reader))).rejects.toThrow(/cap-denied/);
    expect(await del({ ...A, title: "Other" }, ctx())).toMatchObject({ decision: "removed", tombstoned: ["Other"],
      consequence: { position: "plain", family: null, acts: [{ title: "Other", act: "tombstone", bag: DAEMON }], leaves: [], orphans: [], refusals: [] } });
    expect(r.engine.wiki.tiddlerExists("Other")).toBe(false);
    expect(await del({ ...A, title: "Other" }, ctx())).toMatchObject({ decision: "absent", tombstoned: [] });
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

  test("the caller's face decides reach: a face with no read on the anchor refuses every read; a named wiki waits on the relay by name", async () => {
    const r = await rig();
    await expect(makeWikiFilterReactor(r.opts)({ ...A, filter: "[tag[memory]]" }, ctx(stranger))).rejects.toThrow(/cap-denied: read/);
    await expect(makeTiddlerGetReactor(r.opts)({ ...A, title: "Note 01" }, ctx(stranger))).rejects.toThrow(/cap-denied: read/);
    await expect(makeWikiRenderReactor(r.opts)({ ...A, title: "Note 01" }, ctx(stranger))).rejects.toThrow(/cap-denied: read/);
    await expect(makeWikiFilterReactor(r.opts)({ filter: "[tag[memory]]" }, ctx())).rejects.toMatchObject({ reason: "no-container" });
    await expect(makeWikiFilterReactor(r.opts)({ recipe: "lares", filter: "[tag[memory]]" }, ctx())).rejects.toMatchObject({ reason: "wiki-not-anchored" });
    await expect(makeTiddlerPutReactor(r.opts)({ bag: "lares", title: "x", text: "y" }, ctx())).rejects.toMatchObject({ reason: "wiki-not-anchored" });
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
