/**
 * shore-capture-converges — the incident of 2026-11-28, read as a red test: an island whose ordinary mirror holds a
 * carrier both sides moved, beside the wiki's draft and temp slots, drains its projection queue and rests.
 *
 * The cut it proves: the projector holds no held-carrier machine and no recovery-class pass. Before each write it reads the
 * file against the base at its path; a file a hand moved goes to the capture door (`disk-capture.ts`), whose words land
 * in the records where only the disk moved and stand as a parallel draft where both moved. The base moves to the
 * captured bytes, the next reading renders what the records say, and the draft layer projects the draft as a file of its
 * own. `projector.idle()` resolves, and a second idle reconciles nothing more: no carrier re-queues.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import type { CarrierFile } from "@lararium/tw5";
import { LarDiskProjector } from "../src/disk-projector.js";
import { SyncedTree } from "../src/synced-tree.js";
import { diskCapture } from "../src/disk-capture.js";

const CANON = "lar:///ha.ka.ba/bags/lararium";
const DRAFT = "lar:///ha.ka.ba/wikis/notes/draft";
const TEMP = "lar:///ha.ka.ba/wikis/notes/temp";
const URI = "lar:///ha.ka.ba/lararium/api/action-handler";
let scratch = "";
afterEach(() => { if (scratch) rmSync(scratch, { recursive: true, force: true }); scratch = ""; });

type Fields = Record<string, unknown>;

/** A wiki shaped as the projector and the capture read it: a title map, its change listeners, and a dispatch a turn after each write. */
class FakeWiki {
  readonly tiddlers = new Map<string, Fields>();
  private readonly listeners = new Set<(changes: Record<string, unknown>) => void>();
  /** Where a save of a title lands: a draft takes the draft layer, everything else the canon bag. */
  saveBag(title: string): string { return title.startsWith("Draft of ") ? DRAFT : CANON; }
  put(fields: Fields): void { this.tiddlers.set(String(fields["title"]), { ...fields, "$origin-bag": this.saveBag(String(fields["title"])) }); }
  dispatch(titles: string[]): void { const changes = Object.fromEntries(titles.map((t) => [t, {}])); setTimeout(() => { for (const l of this.listeners) l(changes); }, 0); }
  readonly engine = { $tw: { wiki: {
    getTiddler: (t: string) => { const f = this.tiddlers.get(t); return f ? { fields: f } : undefined; },
    allTitles: () => [...this.tiddlers.keys()],
    addEventListener: (_type: string, l: (c: Record<string, unknown>) => void) => { this.listeners.add(l); },
    removeEventListener: (_type: string, l: (c: Record<string, unknown>) => void) => { this.listeners.delete(l); },
  } } };
  readonly captureWiki = {
    get: (t: string) => this.tiddlers.get(t),
    titles: () => [...this.tiddlers.keys()],
    act: async (write: (put: (f: Fields) => void, del: (t: string) => void) => number) => {
      const touched: string[] = [];
      const n = write((f) => { this.put(f); touched.push(String(f["title"])); }, (t) => { this.tiddlers.delete(t); touched.push(t); });
      if (n > 0) { this.dispatch(touched); await new Promise((r) => setTimeout(r, 0)); }
    },
  };
}

/**
 * A carrier renders as its text alone, by the filetype its `ext` field names: `.mem` (the default for a `lar:` title), a
 * native `.tid` with its one header line, or a `.txt` body beside a `.meta` sidecar. A draft renders as a flattened `.tid`.
 */
function render(wiki: FakeWiki, uri: string): CarrierFile | null {
  const f = wiki.tiddlers.get(uri);
  if (!f) return null;
  const text = String(f["text"]);
  if (!uri.startsWith("lar:")) return { ext: ".tid", body: `title: ${uri}\n\n${text}`, defaultRelPath: `${encodeURIComponent(uri)}.tid` };
  if (f["ext"] === ".tid") return { ext: ".tid", body: `title: ${uri}\n\n${text}`, defaultRelPath: "x.tid" };
  if (f["ext"] === ".txt") return { ext: ".txt", body: text, metaBody: `title: ${uri}\ntype: text/plain\n`, defaultRelPath: "x.txt" };
  return { ext: ".mem", body: text, defaultRelPath: "x.mem" };
}

/** The native parse the stub door lands through: a `.tid` drops its header, a sidecar body reads as it stands. */
const parseNative = (uri: string, ext: string, body: string): { records: Fields[] } =>
  ({ records: [{ title: uri, text: ext === ".tid" ? body.slice(body.indexOf("\n\n") + 2) : body, ext }] });

type Door = (moved: Parameters<NonNullable<ConstructorParameters<typeof LarDiskProjector>[0]["capture"]>>[0]) => ReturnType<NonNullable<ConstructorParameters<typeof LarDiskProjector>[0]["capture"]>>;

function stand(wiki: FakeWiki, tree: SyncedTree, roots: { canon: string; draft: string; temp: string }, reconciles: Map<string, number>, withCapture = true, refusals: string[] = [], wrap: (door: Door) => Door = (d) => d): LarDiskProjector {
  const projector = new LarDiskProjector({
    mirrors: [
      { bagId: CANON, mirrorRoot: roots.canon },
      { bagId: DRAFT, mirrorRoot: roots.draft },
      { bagId: TEMP, mirrorRoot: roots.temp, tempLayer: true },
    ],
    carrierFileFn: async (uri) => render(wiki, uri),
    syncedTree: tree,
    bagsHolding: async (uri) => { const f = wiki.tiddlers.get(uri); return f ? [String(f["$origin-bag"])] : []; },
    onRefusal: (info) => { refusals.push(info.reason); },
    ...(withCapture ? { capture: wrap(diskCapture({
      wiki: wiki.captureWiki,
      land: (uri, text) => ({ records: [{ title: uri, text }] }),
      landNative: parseNative,
      saveBag: (title) => wiki.saveBag(title),
      grants: () => true,
    })) } : {}),
  });
  const own = (projector as unknown as { reconcile(root: string): Promise<void> }).reconcile.bind(projector);
  (projector as unknown as { reconcile(root: string): Promise<void> }).reconcile = async (root) => { reconciles.set(root, (reconciles.get(root) ?? 0) + 1); await own(root); };
  return projector;
}

function rig(): { wiki: FakeWiki; tree: SyncedTree; roots: { canon: string; draft: string; temp: string }; file: string } {
  scratch = mkdtempSync(join(tmpdir(), "shore-capture-"));
  const roots = { canon: join(scratch, "bags", "lararium"), draft: join(scratch, "faces", "f", "recovery", "notes"), temp: join(scratch, "faces", "f", "temp", "notes") };
  for (const r of Object.values(roots)) mkdirSync(r, { recursive: true });
  return { wiki: new FakeWiki(), tree: new SyncedTree(join(scratch, "state", "synced-tree.json")), roots, file: join(roots.canon, "ha.ka.ba", "lararium", "api", "action-handler.mem") };
}

const total = (m: Map<string, number>): number => [...m.values()].reduce((a, b) => a + b, 0);

test("RED: a both-moved carrier beside draft and temp slots drains: the queue rests, the records project, the hand's words stand as a parallel draft on disk", async () => {
  const { wiki, tree, roots, file } = rig();
  // The first sitting agrees with the file, and a temp record projects beside it.
  wiki.put({ title: URI, text: "records v0" });
  wiki.tiddlers.set("lar:///ha.ka.ba/t/notes/scratchpad", { title: "lar:///ha.ka.ba/t/notes/scratchpad", text: "temp words", "$origin-bag": TEMP });
  const first = stand(wiki, tree, roots, new Map());
  const stopFirst = first.start(wiki.engine as never);
  await first.idle();
  expect(readFileSync(file, "utf8")).toBe("records v0");
  expect(existsSync(join(roots.temp, "ha.ka.ba", "t", "notes", "scratchpad.mem"))).toBe(true);
  await stopFirst();

  // While the house rests, both sides move: a hand edits the file, and the records move on.
  writeFileSync(file, "the hand's words", "utf8");
  wiki.put({ title: URI, text: "records v1" });

  const reconciles = new Map<string, number>();
  const projector = stand(wiki, tree, roots, reconciles);
  const stop = projector.start(wiki.engine as never);
  await projector.idle();
  await projector.idle();

  // The records project over the captured file, and the hand's words stand as a parallel draft, projected by the draft layer.
  expect(readFileSync(file, "utf8")).toBe("records v1");
  const drafts = [...wiki.tiddlers.keys()].filter((t) => t === `Draft of '${URI}' by disk`);
  expect(drafts).toHaveLength(1);
  expect(wiki.tiddlers.get(drafts[0]!)?.["text"]).toBe("the hand's words");
  expect(wiki.tiddlers.get(drafts[0]!)?.["draft.of"]).toBe(URI);
  const draftFiles = readdirSync(roots.draft);
  expect(draftFiles).toHaveLength(1);
  expect(readFileSync(join(roots.draft, draftFiles[0]!), "utf8")).toContain("the hand's words");

  // NOTHING RE-QUEUES: a further idle reconciles nothing, and the carrier read a bounded number of times.
  const settled = total(reconciles);
  await projector.idle();
  expect(total(reconciles)).toBe(settled);
  expect(reconciles.get(URI)!).toBeLessThanOrEqual(3);
  await stop();
});

test("a hand's edit while only the disk moved lands in the records, and the file stays as the hand left it", async () => {
  const { wiki, tree, roots, file } = rig();
  wiki.put({ title: URI, text: "records v0" });
  const projector = stand(wiki, tree, roots, new Map());
  const stop = projector.start(wiki.engine as never);
  await projector.idle();
  writeFileSync(file, "the hand's words", "utf8");
  // A watcher (or a sense) nudges the carrier: the projector reads the file before it would write.
  await projector.sense([URI]);
  await projector.idle();
  expect(wiki.tiddlers.get(URI)?.["text"]).toBe("the hand's words");
  expect(readFileSync(file, "utf8")).toBe("the hand's words");
  expect([...wiki.tiddlers.keys()].some((t) => t.startsWith("Draft of "))).toBe(false);
  await stop();
});

test("with no capture door a moved file stays whole, its refusal speaks once per state of the file, and the queue still rests", async () => {
  const { wiki, tree, roots, file } = rig();
  wiki.put({ title: URI, text: "records v0" });
  mkdirSync(join(roots.canon, "ha.ka.ba", "lararium", "api"), { recursive: true });
  writeFileSync(file, "a file no agreement covers", "utf8");
  const reconciles = new Map<string, number>();
  const refusals: string[] = [];
  const projector = stand(wiki, tree, roots, reconciles, false, refusals);
  const stop = projector.start(wiki.engine as never);
  await projector.idle();
  expect(readFileSync(file, "utf8")).toBe("a file no agreement covers");
  expect(refusals).toHaveLength(1);
  const settled = total(reconciles);
  await projector.idle();
  expect(total(reconciles)).toBe(settled);
  // The same bytes read again refuse silently; a new edit speaks again.
  await projector.sense([URI]);
  expect(refusals).toHaveLength(1);
  writeFileSync(file, "another hand's words", "utf8");
  await projector.sense([URI]);
  expect(refusals).toHaveLength(2);
  await stop();
});

for (const kind of [
  { name: "a memetic carrier", ext: undefined, at: ["ha.ka.ba", "lararium", "api", "action-handler.mem"], edit: (t: string) => t },
  { name: "a native .tid", ext: ".tid", at: ["ha.ka.ba", "lararium", "api", "action-handler.tid"], edit: (t: string) => `title: ${URI}\n\n${t}` },
  { name: "a body beside its sidecar", ext: ".txt", at: ["ha.ka.ba", "lararium", "api", "action-handler.txt"], edit: (t: string) => t },
] as const) {
  test(`${kind.name}: a hand's edit captures and the re-read converges within two readings`, async () => {
    const { wiki, tree, roots } = rig();
    const at = join(roots.canon, ...kind.at);
    wiki.put({ title: URI, text: "records v0", ...(kind.ext ? { ext: kind.ext } : {}) });
    const reconciles = new Map<string, number>();
    const projector = stand(wiki, tree, roots, reconciles);
    const stop = projector.start(wiki.engine as never);
    await projector.idle();
    expect(existsSync(at)).toBe(true);
    if (kind.ext === ".txt") expect(existsSync(`${at}.meta`)).toBe(true);
    const before = reconciles.get(URI) ?? 0;
    writeFileSync(at, kind.edit("the hand's words"), "utf8");
    await projector.sense([URI]);
    await projector.idle();
    expect(wiki.tiddlers.get(URI)?.["text"]).toBe("the hand's words");
    expect(readFileSync(at, "utf8")).toBe(kind.edit("the hand's words"));
    // One reading captures, the next finds the file where the base names it: two, and the queue rests.
    expect((reconciles.get(URI) ?? 0) - before).toBeLessThanOrEqual(2);
    const settled = total(reconciles);
    await projector.idle();
    expect(total(reconciles)).toBe(settled);
    await stop();
  });
}

test("a file that changes between the projector's hash and the door's read refuses once, and its next change reads afresh", async () => {
  const { wiki, tree, roots, file } = rig();
  wiki.put({ title: URI, text: "records v0" });
  const refusals: string[] = [];
  let raced = false;
  // The first capture finds a second hand's write landing between the projector's hash and the door's read.
  const projector = stand(wiki, tree, roots, new Map(), true, refusals, (door) => async (moved) => {
    if (!raced) { raced = true; writeFileSync(file, "the second hand's words", "utf8"); }
    return door(moved);
  });
  const stop = projector.start(wiki.engine as never);
  await projector.idle();
  writeFileSync(file, "the first hand's words", "utf8");
  await projector.sense([URI]);
  await projector.idle();
  expect(refusals).toHaveLength(1);
  expect(wiki.tiddlers.get(URI)?.["text"]).toBe("records v0");
  expect(readFileSync(file, "utf8")).toBe("the second hand's words");
  // The next change (a watcher's hint, a sense) reads the file as it stands now, and its words land.
  await projector.sense([URI]);
  await projector.idle();
  expect(wiki.tiddlers.get(URI)?.["text"]).toBe("the second hand's words");
  expect(refusals).toHaveLength(1);
  await stop();
});

test("a landing never deletes: a slot the file no longer says stands as a removal draft beside its record", async () => {
  const { wiki, tree, roots, file } = rig();
  wiki.put({ title: URI, text: "records v0" });
  wiki.put({ title: `${URI}#notes`, text: "a slot" });
  const projector = stand(wiki, tree, roots, new Map());
  const stop = projector.start(wiki.engine as never);
  await projector.idle();
  writeFileSync(file, "the hand's words", "utf8");
  await projector.sense([URI]);
  await projector.idle();
  expect(wiki.tiddlers.get(URI)?.["text"]).toBe("the hand's words");
  expect(wiki.tiddlers.get(`${URI}#notes`)?.["text"]).toBe("a slot");
  expect(wiki.tiddlers.get(`Draft of '${URI}#notes' by disk`)?.["lar-conflict-removed"]).toBe("*");
  await stop();
});
