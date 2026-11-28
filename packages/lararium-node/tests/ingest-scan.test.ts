/**
 * ingest-scan — THE DRAIN LIVES IN THE NODE (tideline-surface #/seam point 1; face-pools W1, W2). The scan, the candidates, the
 * deletions, the standing helpers, the settle and the siting call stand in `@lararium/node`, behind a SUBMIT PORT the caller
 * fills: the CLI's `lares ingest`/`lares ingest --watch` fill it with the verb socket, the vessel with its daemon island's INGEST verb.
 * So the vessel's watch over the worn face's pool lands an edit as an UNATTENDED INGEST wave by itself, with no hand act.
 *
 *   I1 a vessel-side caller scans a face pool, builds candidates, and submits one unattended INGEST wave per granted plane
 *      through the port: a plain-title edit under `wikis/daemon/` lands in the daemon working bag, a loci `.mem` edit under `bags/daemon/`
 *      in the face's canon bag; each landed carrier pins its base, so the next wave over the same bytes submits nothing
 *   I2 a carrier the island answers `conflict` (both moved) submits once and then goes to the shore's sense by name, where the projector reads it
 *   I3 a vanished file tombstones nothing: no deletion rides, and the shore's whole look runs (it stands pending there)
 *   I4 a personal-layer file rides no daemon wave: the shore senses its title, as before
 *   I5 the watch core's wave, armed with the pool's ingest ports, lands a pool edit by itself
 *   I6 the island submit maps the daemon island's answer onto the settle's result: done carries the summary, a refusal errors
 *   I7 the port's INGEST args: source under the plane, the bag, unattended, each carrier inline with its hashes
 *   I8 no cycle: the node never imports the CLI, and the vessel's after-live arms the watch with the ingest ports
 *   I9 a `derived` row (a render the island answered on its gradient) fails no wave: it reads accounted for, pins no base, and
 *      a row that warns gets named with its words
 *   I10 ONE OWNER OF PENDING STATE: a wave lands its bases through the island that PROJECTS their bag (`islandBaseDoor`, the
 *      shore's `base` act), in that island's own tree, and sends carriers and files alone: the island reads every hash, its
 *      document and its heads itself. THE WATCH ECHO: the projector's own write echoes as a pool wave over a fresh tree; the
 *      island answers it noop, and its base waits with the projector's pending pin, which lands only with its heads, only at
 *      rest. A stopped island blocks nothing; a file the island cannot read, or records that differ, pin nothing; a wave whose
 *      INGEST another island took routes to the projecting island; a door with no owner behind it (a fault, no shore, no
 *      projecting island, a seat's refusal) lands nothing and says so; a rename in a caller-owned tree keeps the history its
 *      source's base vouched for.
 */
import { describe, test, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { carrierHash } from "@lararium/mesh/crypto";
import { VERB_RESULT_KEY } from "@lararium/mesh/verb-tiddler";
import { SyncedTree, syncedTreeKey } from "../src/synced-tree.js";
import { armFacePoolWatch } from "../src/watch-core.js";
import { IslandVerbRefused } from "../src/island-verb-ask.js";

type IngestScan = typeof import("../src/ingest-scan.js");
const INGEST_SCAN = "../src/ingest-scan.js";
let loaded: IngestScan | null = null;
let loadFault: unknown = null;
beforeAll(async () => { try { loaded = await import(/* @vite-ignore */ INGEST_SCAN) as IngestScan; } catch (e) { loadFault = e; } });
const is = new Proxy({} as IngestScan, { get: (_t, k) => { if (loaded === null) throw loadFault; return loaded[k as keyof IngestScan]; } });

const WORKING = "lar:///ha.ka.ba/wikis/daemon/working";
const CANON = "lar:///ha.ka.ba/bags/daemon-11111111-1111-4111-8111-111111111111";

let house: string;
let pool: string;
let tree: SyncedTree;
beforeEach(() => {
  house = mkdtempSync(join(tmpdir(), "lar-ingest-scan-"));
  pool = join(house, "projections", "faces", "Heron");
  mkdirSync(pool, { recursive: true });
  tree = new SyncedTree(join(house, "tree"));
});
afterEach(() => { rmSync(house, { recursive: true, force: true }); });

const put = (rel: string, text: string): string => { const p = join(pool, ...rel.split("/")); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text); return p; };
const tid = (title: string, body = "a body"): string => `title: ${title}\ntype: text/vnd.tiddlywiki\n\n${body}\n`;
const mem = (title: string, body: string): string =>
  `<<!DOCTYPE type=\`memetic-wikitext+tiddlywiki\`>>\n\n\`\`\`toml meta\ntitle = "${title}"\ntype = "text/memetic-wikitext+tiddlywiki"\n\`\`\`\n\n${body}\n`;
/** The base a projection left: the file's old bytes agreed at its path. */
const agreed = (bag: string, uri: string, file: string, oldText: string): void => { const h = carrierHash(oldText); tree.set(syncedTreeKey(bag, uri), file, h, h); };

type Opts = Parameters<IngestScan["settleIngest"]>[0];
/** A daemon island that lands every carrier (or answers `decide` per carrier), as the INGEST verb's summary carries it. */
function island(decide: (uri: string) => string = () => "ingest") {
  const waves: Opts[] = [];
  const submit = async (o: Opts) => {
    waves.push(o);
    return {
      status: "done" as const, requestId: `r${waves.length}`,
      results: { [VERB_RESULT_KEY]: { ok: true, output: { carriers: o.candidates.map((c) => ({ uri: c.uri, decision: decide(c.uri), ...(decide(c.uri) === "ingest" ? { canonicalHash: c.diskHash } : {}) })) } } },
    };
  };
  return { waves, submit };
}
function shore() {
  const looks: Array<readonly string[] | undefined> = [];
  return { looks, sense: async (uris?: readonly string[]) => { looks.push(uris === undefined ? undefined : [...uris].sort()); return {}; } };
}

describe("I1 — a vessel-side caller lands pool edits through the submit port", () => {
  test("a plain-title wiki edit and a loci canon .mem edit each ride one unattended wave to their plane's bag, then pin", async () => {
    const plain = put("wikis/daemon/My Notes.tid", tid("My Notes", "the new words"));
    agreed(WORKING, "My Notes", plain, tid("My Notes", "the old words"));
    const pond = put("bags/daemon/ha.ka.ba/notes/pond.mem", mem("lar:///ha.ka.ba/notes/pond", "a heron stands"));
    agreed(CANON, "lar:///ha.ka.ba/notes/pond", pond, mem("lar:///ha.ka.ba/notes/pond", "the pond stood empty"));
    const { waves, submit } = island();
    const { looks, sense } = shore();
    const ports = is.poolIngestPorts({ pool, bags: { wiki: WORKING, canon: CANON }, submit, sense, did: "did:vessel", tree: () => tree, log: () => {} });

    await ports.wave([plain, pond]);
    expect(waves.map((w) => w.toBag).sort()).toEqual([CANON, WORKING].sort());
    const wiki = waves.find((w) => w.toBag === WORKING)!;
    const canon = waves.find((w) => w.toBag === CANON)!;
    expect(wiki.unattended).toBe(true);
    expect(canon.unattended).toBe(true);
    expect(wiki.source).toBe(join(pool, "wikis", "daemon"));
    expect(canon.source).toBe(join(pool, "bags", "daemon"));
    expect(wiki.candidates.map((c) => [c.uri, c.status])).toEqual([["My Notes", "changed"]]);
    expect(canon.candidates.map((c) => [c.uri, c.status])).toEqual([["lar:///ha.ka.ba/notes/pond", "changed"]]);
    expect(wiki.deletions ?? []).toEqual([]);
    // Each landed carrier pins its base at its file.
    expect(tree.baseAt(syncedTreeKey(WORKING, "My Notes"), plain)?.disk).toBe(carrierHash(readFileSync(plain, "utf8")));
    expect(tree.baseAt(syncedTreeKey(CANON, "lar:///ha.ka.ba/notes/pond"), pond)?.disk).toBe(carrierHash(readFileSync(pond, "utf8")));
    expect(looks).toEqual([]);

    // The second wave over the same bytes reads every carrier unchanged and submits nothing.
    await ports.wave([plain, pond]);
    expect(waves).toHaveLength(2);
  });
});

describe("I2 — a conflicting carrier goes to the shore", () => {
  test("a carrier the island answers `conflict` goes to the shore's sense by name and pins no base", async () => {
    const plain = put("wikis/daemon/My Notes.tid", tid("My Notes", "the disk's words"));
    agreed(WORKING, "My Notes", plain, tid("My Notes", "the old words"));
    const { waves, submit } = island(() => "conflict");
    const { looks, sense } = shore();
    await is.poolIngestPorts({ pool, bags: { wiki: WORKING }, submit, sense, did: "did:vessel", tree: () => tree, log: () => {} }).wave([plain]);
    expect(waves).toHaveLength(1);
    expect(looks).toEqual([["My Notes"]]);
    expect(tree.baseAt(syncedTreeKey(WORKING, "My Notes"), plain)?.disk).toBe(carrierHash(tid("My Notes", "the old words")));
  });
});

describe("I3 — a vanished file tombstones nothing", () => {
  test("no deletion rides; the shore's whole look runs", async () => {
    const gone = join(pool, "wikis", "daemon", "Gone Note.tid");
    agreed(WORKING, "Gone Note", gone, tid("Gone Note"));
    const { waves, submit } = island();
    const { looks, sense } = shore();
    await is.poolIngestPorts({ pool, bags: { wiki: WORKING }, submit, sense, did: "did:vessel", tree: () => tree, log: () => {} }).wave([gone]);
    expect(waves).toEqual([]);
    expect(looks).toEqual([undefined]);
  });
});

describe("I4 — a personal layer rides no daemon wave", () => {
  test("a personal-layer file's title goes to the shore's sense", async () => {
    const aside = put("personal/elyncia/Aside.tid", tid("Aside"));
    const { waves, submit } = island();
    const { looks, sense } = shore();
    await is.poolIngestPorts({ pool, bags: { wiki: WORKING }, submit, sense, did: "did:vessel", tree: () => tree, log: () => {} }).wave([aside]);
    expect(waves).toEqual([]);
    expect(looks).toEqual([["Aside"]]);
  });
});

/** A watcher the test drives: `fire(rel)` raises one change event as `fs.watch` would. */
function fakeWatch() {
  const watchers: Array<EventEmitter & { close(): void; closed: boolean }> = [];
  const watch = ((_dir: string, _opts: unknown, cb: (event: string, filename: string | null) => void) => {
    const w = Object.assign(new EventEmitter(), { closed: false, close() { this.closed = true; } });
    w.on("change", cb);
    watchers.push(w);
    return w;
  }) as unknown as NonNullable<Parameters<typeof armFacePoolWatch>[0]["watch"]>;
  return { watch, fire: (rel: string) => { for (const w of watchers) if (!w.closed) w.emit("change", "change", rel); } };
}

describe("I5 — the watch core's wave lands a pool edit by itself", () => {
  test("an edit under wikis/daemon/ reaches the island as an unattended INGEST wave, no hand act", async () => {
    const { waves, submit } = island();
    const { sense } = shore();
    const { watch, fire } = fakeWatch();
    const host = armFacePoolWatch({
      pool, watch, cookie: async () => true, settleMs: 5, log: () => {},
      ports: { ...is.poolIngestPorts({ pool, bags: { wiki: WORKING }, submit, sense, did: "did:vessel", tree: () => tree, log: () => {} }), commit: async () => ({ committed: false, why: "nothing-moved" }) },
    });
    expect(await host.armed).toBe("live");
    const plain = put("wikis/daemon/Fresh Note.tid", tid("Fresh Note", "typed in an editor"));
    fire("wikis/daemon/Fresh Note.tid");
    for (let i = 0; i < 50 && !waves.some((w) => w.candidates.some((c) => c.uri === "Fresh Note")); i++) await new Promise((r) => setTimeout(r, 10));
    const landed = waves.find((w) => w.candidates.some((c) => c.uri === "Fresh Note"));
    expect(landed?.unattended).toBe(true);
    expect(landed?.toBag).toBe(WORKING);
    expect(tree.baseAt(syncedTreeKey(WORKING, "Fresh Note"), plain)).not.toBeNull();
    await host.down("down");
  });
});

describe("I6 — the island submit answers the settle's result shape", () => {
  test("a done answer carries the summary; a refusal reads as an error with the island's words", async () => {
    const asked: Array<{ verb: string; args: Record<string, unknown> }> = [];
    const ok = is.islandIngestSubmit(async (verb, args) => { asked.push({ verb, args }); return { carriers: [] }; });
    const row = { file: join(pool, "wikis", "daemon", "A.tid"), uri: "A", text: tid("A"), diskHash: carrierHash(tid("A")), syncedHash: null, status: "new" as const, ext: ".tid" };
    const done = await ok({ source: join(pool, "wikis", "daemon"), toBag: WORKING, candidates: [row], did: "did:vessel", unattended: true });
    expect(done.status).toBe("done");
    expect(done.results?.[VERB_RESULT_KEY]?.output).toEqual({ carriers: [] });
    expect(asked[0]!.verb).toBe("INGEST");
    const refused = is.islandIngestSubmit(async () => { throw new IslandVerbRefused("INGEST", "disk-wave-placement: no mirror"); });
    const err = await refused({ source: join(pool, "wikis", "daemon"), toBag: WORKING, candidates: [row], did: "did:vessel" });
    expect(err.status).toBe("error");
    expect(err.errorMessage).toMatch(/disk-wave-placement/);
  });
});

describe("I9 — a derived render fails no wave", () => {
  test("a `derived` row reads accounted for: the verdict holds, nothing stays owed, no base pins, and a row that warns gets named with its words", async () => {
    const render = put("wikis/daemon/road.html", "<p>hand edit</p>");
    const quiet = put("wikis/daemon/echo.html", "<p>noted</p>");
    const warning = "\"road.html\" stands as the render of \"Road\"; this file's edit lands nothing: edit \"Road\"; this render follows";
    const rows = [render, quiet].map((file) => ({ file, uri: file.endsWith("road.html") ? "road.html" : "echo.html", text: readFileSync(file, "utf8"), diskHash: carrierHash(readFileSync(file, "utf8")), syncedHash: null, status: "new" as const, ext: ".html" }));
    const submit = async () => ({
      status: "done" as const, requestId: "r1",
      results: { [VERB_RESULT_KEY]: { ok: true, output: { carriers: [
        { uri: "road.html", decision: "derived", rung: "hand-edit", source: "Road", warnings: [warning] },
        { uri: "echo.html", decision: "derived", rung: "source-stands", source: "Road" },
      ] } } },
    });
    const settled = await is.settleIngest({ source: join(pool, "wikis", "daemon"), toBag: WORKING, candidates: rows, did: "did:vessel" }, tree, submit);
    expect(is.ingestVerdict(settled)).toEqual({ failed: false, message: null });
    expect(settled.unanswered).toEqual([]);
    expect([...settled.landed].sort()).toEqual(["echo.html", "road.html"]);
    expect(settled.refused).toEqual([]);
    expect(settled.derived).toEqual([{ uri: "road.html", file: render, decision: "derived", why: warning }]);
    expect(settled.tallies).toEqual({ derived: 2 });
    expect(settled.recorded).toBe(0);
    expect(tree.baseAt(syncedTreeKey(WORKING, "road.html"), render)).toBeNull();
    expect(is.standingAfterWave(is.NO_STANDING_ASKS, settled).owed.size).toBe(0);
  });
});

describe("I7 — the INGEST args the port sends", () => {
  test("source, bag, change id, unattended, and each carrier inline with its hashes", () => {
    const row = { file: join(pool, "wikis", "daemon", "A.tid"), uri: "A", text: tid("A"), diskHash: carrierHash(tid("A")), syncedHash: null, status: "new" as const, ext: ".tid" };
    const args = is.ingestWaveArgs({ source: join(pool, "wikis", "daemon"), toBag: WORKING, candidates: [row], did: "did:vessel", unattended: true, changeId: "c1" });
    expect(args["source-uri"]).toBe(join(pool, "wikis", "daemon"));
    expect(args["to-bag"]).toBe(WORKING);
    expect(args["change-id"]).toBe("c1");
    expect(args["unattended"]).toBe(true);
    expect(args["carriers"]).toEqual([{ uri: "A", file: row.file, size: Buffer.byteLength(row.text), diskHash: row.diskHash, syncedHash: null, ext: ".tid", text: row.text }]);
  });
});

describe("I8 — no cycle, and the vessel wires the port", () => {
  test("the node's package names no CLI dependency, and ingest-scan imports none", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { dependencies?: Record<string, string> };
    expect(Object.keys(pkg.dependencies ?? {})).not.toContain("@lares/cli");
    expect(readFileSync(new URL("../src/ingest-scan.ts", import.meta.url), "utf8")).not.toMatch(/lares-cli|@lares\/cli/);
  });

  test("after-live arms the watch with the pool's ingest ports over the daemon island's INGEST", () => {
    const vessel = readFileSync(new URL("../src/open-node-vessel.ts", import.meta.url), "utf8");
    const afterLive = vessel.slice(vessel.indexOf("const afterLive:"), vessel.indexOf("const orchestration:"));
    expect(afterLive).toMatch(/poolIngestPorts\(/);
    expect(afterLive).toMatch(/islandIngestSubmit\(/);
    expect(afterLive).not.toMatch(/shoreLookPorts\(/);
  });
});

/**
 * An island's shore `base` act, as the vessel's door reaches it, over the tree that island's projector owns. The rig reads
 * what the real act reads (`pinAgreement`, `disk-projector.ts`; its own vectors stand in shore-flush S7): it takes a carrier
 * and a file from the caller and NOTHING ELSE, hashes the file itself, compares its own records' render (`records`, the file's
 * own hash where the rig names none: the wave's INGEST just landed it), and pins under its own document and heads.
 */
function islandShore(owner: SyncedTree, o: { readonly doc: string; readonly heads?: readonly string[]; readonly projects?: (bag: string) => boolean; readonly records?: (uri: string) => string | null }) {
  const acts: Array<Record<string, unknown>> = [];
  const road = async (args: Record<string, unknown>): Promise<Record<string, unknown>> => {
    acts.push(args);
    const paths = is.basePathsNamed(args["bases"]);
    const bag = args["bag"];
    if (args["op"] !== "base" || typeof bag !== "string" || paths === null) return { ok: false, refusal: "shore-answer-incomplete", why: "the rig reads a base act alone" };
    if (o.projects?.(bag) === false) return { ok: false, refusal: "bag-unprojected", why: "this island's projector holds no mirror of the bag" };
    const tally = { recorded: 0, kept: 0, waiting: 0, unread: 0, differs: 0 };
    for (const path of paths) {
      let disk: string;
      try { disk = carrierHash(readFileSync(path.file, "utf8")); } catch { tally.unread += 1; continue; }
      const records = o.records ? o.records(path.uri) : disk;
      if (records !== disk) { tally.differs += 1; continue; }
      const key = syncedTreeKey(bag, path.uri);
      const standing = owner.baseAt(key, path.file);
      if (standing?.disk === disk && owner.pendingAt(key, path.file)) { owner.metWaiting(key, path.file); tally.waiting += 1; continue; }
      if (standing?.disk === disk) { tally.kept += 1; continue; }
      owner.set(key, path.file, disk, records, o.doc, o.heads);
      tally.recorded += 1;
    }
    await owner.settle();
    return { ok: true, op: "base", ...tally };
  };
  return { acts, road, door: (tree: SyncedTree) => is.islandBaseDoor(() => [road], tree) };
}

describe("I10 — one owner of pending state: a wave's bases land in the tree of the island that projects their bag", () => {
  test("THE WATCH ECHO: a projection write echoes as a wave over a fresh tree; its base waits with the island's pin, and the pin lands with its heads at rest", async () => {
    const dir = join(house, "tree");
    const text = tid("My Notes", "the projector's own render");
    const file = put("wikis/daemon/My Notes.tid", text);
    const key = syncedTreeKey(WORKING, "My Notes"), hash = carrierHash(text);
    // The projector, in its island, pins its write: its heads rest nowhere yet, so the pin waits in the island's memory.
    const sealed = { rested: false };
    const projectorTree = new SyncedTree(dir, { rests: async () => (sealed.rested ? "rested" as const : "waiting" as const) });
    projectorTree.set(key, file, hash, hash, "doc-working", ["h1"]);
    await projectorTree.settle();
    // The watch hears the write and folds a wave over the tree it opens afresh, which reads no pin: the island answers the echo
    // noop, and the wave names its carrier and file to the island.
    const { waves, submit } = island(() => "noop");
    const { sense } = shore();
    const lines: string[] = [];
    const owner = islandShore(projectorTree, { doc: "doc-working", heads: ["h1"] });
    await is.poolIngestPorts({ pool, bags: { wiki: WORKING }, submit, sense, did: "did:vessel", tree: () => new SyncedTree(dir), base: owner.door, log: (l) => lines.push(l) }).wave([file]);
    expect(waves).toHaveLength(1);
    // THE CALLER SENDS THE PATH SET ALONE: no hash, no heads, no document crosses the door.
    expect(owner.acts).toEqual([{ op: "base", bag: WORKING, bases: [{ uri: "My Notes", file }] }]);
    expect(new SyncedTree(dir).baseAt(key, file), "no headless row lands over the pending pin").toBeNull();
    expect(projectorTree.waitingBases, "the pin counts the base that waits with it").toBe(1);
    expect(lines.some((l) => /1 base\(s\) .* wait on the island's pending pin/.test(l)), "the wave names what waits").toBe(true);
    // The seal arrives: the projector's pin lands, with its heads.
    sealed.rested = true;
    expect(await projectorTree.settle()).toBe(1);
    expect(new SyncedTree(dir).baseAt(key, file)).toMatchObject({ disk: hash, doc: "doc-working", heads: ["h1"] });
    expect(projectorTree.waitingBases).toBe(0);
  });

  test("A STOPPED ISLAND LEAVES NOTHING BLOCKING: its pin left with it (same process), and the next boot's island lands the wave's base", async () => {
    const dir = join(house, "tree");
    const text = tid("My Notes", "the projector's own render");
    const file = put("wikis/daemon/My Notes.tid", text);
    const key = syncedTreeKey(WORKING, "My Notes"), hash = carrierHash(text);
    const stopped = new SyncedTree(dir, { rests: async () => "waiting" as const });
    stopped.set(key, file, hash, hash, "doc-working", ["h1"]);
    await stopped.settle();
    stopped.dispose();
    // The next boot: a fresh island tree over the same directory, whose rest answers. The echo's base lands through it.
    const next = new SyncedTree(dir, { rests: async () => "rested" as const });
    const { submit } = island(() => "noop");
    const { sense } = shore();
    await is.poolIngestPorts({ pool, bags: { wiki: WORKING }, submit, sense, did: "did:vessel", tree: () => new SyncedTree(dir), base: islandShore(next, { doc: "doc-working", heads: ["h2"] }).door, log: () => {} }).wave([file]);
    expect(new SyncedTree(dir).baseAt(key, file)).toMatchObject({ disk: hash, doc: "doc-working", heads: ["h2"] });
    // And the second wave over the same bytes reads the carrier unchanged.
    const again = island(() => "noop");
    await is.poolIngestPorts({ pool, bags: { wiki: WORKING }, submit: again.submit, sense, did: "did:vessel", tree: () => new SyncedTree(dir), base: islandShore(next, { doc: "doc-working" }).door, log: () => {} }).wave([file]);
    expect(again.waves).toHaveLength(0);
  });

  test("THE ISLAND NAMES ITS OWN DOCUMENT AND HEADS: whatever heads the wave's answer carried, the row holds the island's, and waits on their seal", async () => {
    const dir = join(house, "tree");
    const file = put("wikis/daemon/My Notes.tid", tid("My Notes", "a hand's new words"));
    const key = syncedTreeKey(WORKING, "My Notes");
    const sealed = { rested: false };
    const owner = new SyncedTree(dir, { rests: async () => (sealed.rested ? "rested" as const : "waiting" as const) });
    const submit = async (o: Opts) => ({
      status: "done" as const, requestId: "r1",
      results: { [VERB_RESULT_KEY]: { ok: true, output: { heads: ["w1", "w2"], carriers: o.candidates.map((c) => ({ uri: c.uri, decision: "ingest", canonicalHash: c.diskHash })) } } },
    });
    const { sense } = shore();
    await is.poolIngestPorts({ pool, bags: { wiki: WORKING }, submit, sense, did: "did:vessel", tree: () => new SyncedTree(dir), base: islandShore(owner, { doc: "doc-working", heads: ["i1"] }).door, log: () => {} }).wave([file]);
    expect(owner.baseAt(key, file)).toMatchObject({ doc: "doc-working", heads: ["i1"] });
    expect(new SyncedTree(dir).baseAt(key, file), "the row waits on its seal").toBeNull();
    sealed.rested = true;
    await owner.settle();
    expect(new SyncedTree(dir).baseAt(key, file)).toMatchObject({ doc: "doc-working", heads: ["i1"] });
  });

  test("NO CALLER'S HASH LANDS: an island that reads no file there, or reads records that differ, pins nothing, and the wave says so", async () => {
    const dir = join(house, "tree");
    const file = put("wikis/daemon/My Notes.tid", tid("My Notes", "a hand's new words"));
    const key = syncedTreeKey(WORKING, "My Notes");
    const owner = new SyncedTree(dir);
    // The island's own records render other words than the file holds (the hand's edit never reached them).
    const differing = islandShore(owner, { doc: "doc-working", records: () => carrierHash("the records' older words") });
    const { submit } = island();
    const { sense } = shore();
    const lines: string[] = [];
    await is.poolIngestPorts({ pool, bags: { wiki: WORKING }, submit, sense, did: "did:vessel", tree: () => new SyncedTree(dir), base: differing.door, log: (l) => lines.push(l) }).wave([file]);
    expect(new SyncedTree(dir).baseAt(key, file)).toBeNull();
    expect(lines.some((l) => /1 base\(s\) .* pinned nothing: .* read 1 carrier\(s\) whose file and records differ and 0 file\(s\) it could not read/.test(l))).toBe(true);
    // A door asked straight, with hashes a caller made up beside a file no island reads: the door sends the path alone, and nothing lands.
    const gone = join(pool, "wikis", "daemon", "Never Written.tid");
    const answer = await differing.door(new SyncedTree(dir)).land(WORKING, [{ uri: "Never Written", file: gone, disk: carrierHash("an edit"), records: carrierHash("anything"), heads: ["x"] }]);
    expect(answer).toMatchObject({ recorded: 0, kept: 0, waiting: 0, unread: 1, owed: 0 });
    expect(differing.acts.at(-1)).toEqual({ op: "base", bag: WORKING, bases: [{ uri: "Never Written", file: gone }] });
    expect(new SyncedTree(dir).size).toBe(0);
  });

  test("A CROSS-ISLAND WAVE ROUTES TO THE ISLAND THAT PROJECTS THE BAG: the island that took the INGEST holds no mirror of it and pins nothing; the projecting island's row lands sealed, with its document", async () => {
    const dir = join(house, "tree");
    const text = tid("My Notes", "a hand's new words");
    const file = put("wikis/daemon/My Notes.tid", text);
    const key = syncedTreeKey(WORKING, "My Notes");
    // Every island's tree rests in the one directory. The daemon island took the wave and projects another bag; the wiki
    // island projects this one, and its rest answers.
    const daemonTree = new SyncedTree(dir, { rests: async () => "rested" as const });
    const wikiTree = new SyncedTree(dir, { rests: async () => "rested" as const });
    const daemon = islandShore(daemonTree, { doc: "doc-daemon", heads: ["d1"], projects: () => false });
    const wiki = islandShore(wikiTree, { doc: "doc-wiki", heads: ["k1"] });
    const { submit } = island();
    const { sense } = shore();
    const routed = (tree: SyncedTree) => is.islandBaseDoor(() => [daemon.road, wiki.road], tree);
    await is.poolIngestPorts({ pool, bags: { wiki: WORKING }, submit, sense, did: "did:vessel", tree: () => new SyncedTree(dir), base: routed, log: () => {} }).wave([file]);
    expect(daemon.acts).toHaveLength(1);
    expect(daemonTree.baseAt(key, file), "the island that projects no mirror of the bag sets nothing").toBeNull();
    expect(new SyncedTree(dir).baseAt(key, file)).toEqual({ path: file, disk: carrierHash(text), records: carrierHash(text), doc: "doc-wiki", heads: ["k1"] });
  });

  test("A DOOR WITH NO OWNER BEHIND IT LANDS NOTHING: a fallen road, an island with no shore and a bag no island projects each count the bases owed, by name, and no row lands by the wave's own hand", async () => {
    const dir = join(house, "tree");
    const file = put("wikis/daemon/My Notes.tid", tid("My Notes", "a hand's new words"));
    const key = syncedTreeKey(WORKING, "My Notes");
    const { sense } = shore();
    const lines: string[] = [];
    const wave = (roads: Array<(args: Record<string, unknown>) => Promise<unknown>>) =>
      is.poolIngestPorts({ pool, bags: { wiki: WORKING }, submit: island().submit, sense, did: "did:vessel", tree: () => new SyncedTree(dir), base: (tree) => is.islandBaseDoor(() => roads, tree), log: (l) => lines.push(l) }).wave([file]);
    await wave([async () => { throw new Error("the island fell"); }]);
    expect(new SyncedTree(dir).baseAt(key, file)).toBeNull();
    expect(lines.some((l) => /1 base\(s\) .* reached no owner \(the island fell\)/.test(l))).toBe(true);
    await wave([async () => ({ ok: false, refusal: "no-disk-shore", why: "this island mounts no disk projection" }), async () => ({ ok: false, refusal: "bag-unprojected", why: "no mirror of the bag" })]);
    expect(new SyncedTree(dir).baseAt(key, file), "no doc-less row lands where no island projects the bag").toBeNull();
    expect(lines.some((l) => /1 base\(s\) .* reached no owner \(no island projects /.test(l))).toBe(true);
    // A seat's line refuses at the door by name, and that too lands nothing.
    await wave([async () => ({ ok: false, refusal: "hand-act-only", why: "a seat lands no base at the disk shore" })]);
    expect(new SyncedTree(dir).baseAt(key, file)).toBeNull();
    expect(lines.some((l) => /reached no owner \(hand-act-only: a seat lands no base/.test(l))).toBe(true);
    // A fallen road passes the ask on: the island that projects the bag stands behind it, and its pin lands.
    const behind = islandShore(new SyncedTree(dir), { doc: "doc-working" });
    await wave([async () => { throw new Error("the island fell"); }, behind.road]);
    expect(new SyncedTree(dir).baseAt(key, file)?.doc).toBe("doc-working");
  });

  test("A RENAME KEEPS ITS HISTORY: the moved carrier's base carries the document, the heads and the records side the source's base held", () => {
    const dir = join(house, "tree");
    const text = tid("New Name", "the same words");
    const moved = put("wikis/daemon/New Name.tid", text);
    const gone = join(pool, "wikis", "daemon", "Old Name.tid");
    const hash = carrierHash(text), rendered = carrierHash("the records' render");
    const owner = new SyncedTree(dir);
    owner.set(syncedTreeKey(WORKING, "Old Name"), gone, hash, rendered, "doc-working", ["h1"]);
    const row = { file: moved, uri: "New Name", text, diskHash: hash, syncedHash: null, status: "new" as const, ext: ".tid" };
    expect(is.applyConfirmedRenames(owner, WORKING, [row], { renames: [{ fromUri: "Old Name", toUri: "New Name" }] })).toBe(1);
    const fresh = new SyncedTree(dir);
    expect(fresh.baseAt(syncedTreeKey(WORKING, "New Name"), moved)).toEqual({ path: moved, disk: hash, records: rendered, doc: "doc-working", heads: ["h1"] });
    expect(fresh.bases(syncedTreeKey(WORKING, "Old Name")), "the source's base left with its file").toEqual([]);
  });

  test("A RENAME IN A TREE ITS CALLER OWNS: over a pin of the same agreement it waits with the pin, and lands no row of its own", async () => {
    const dir = join(house, "tree");
    const text = tid("New Name", "the same words");
    const moved = put("wikis/daemon/New Name.tid", text);
    const hash = carrierHash(text);
    const owner = new SyncedTree(dir, { rests: async () => "waiting" as const });
    // The island's projector already pinned the re-homed carrier at its new file, and that pin waits.
    owner.set(syncedTreeKey(WORKING, "New Name"), moved, hash, hash, "doc-working", ["h2"]);
    await owner.settle();
    const row = { file: moved, uri: "New Name", text, diskHash: hash, syncedHash: null, status: "new" as const, ext: ".tid" };
    const answer = is.landBases(owner, WORKING, is.renameBaseAsksOf([row], { renames: [{ fromUri: "Old Name", toUri: "New Name" }] }), "doc-working");
    expect(answer).toMatchObject({ recorded: 0, waiting: 1 });
    expect(owner.baseAt(syncedTreeKey(WORKING, "New Name"), moved)?.heads).toEqual(["h2"]);
    expect(new SyncedTree(dir).baseAt(syncedTreeKey(WORKING, "New Name"), moved)).toBeNull();
  });

  test("CONTROL: with no island door, the same noop echo records the base in the tree the wave holds, as it always did", async () => {
    const dir = join(house, "tree");
    const text = tid("My Notes", "a hand's words");
    const file = put("wikis/daemon/My Notes.tid", text);
    const { submit } = island(() => "noop");
    const { sense } = shore();
    await is.poolIngestPorts({ pool, bags: { wiki: WORKING }, submit, sense, did: "did:vessel", tree: () => new SyncedTree(dir), log: () => {} }).wave([file]);
    expect(new SyncedTree(dir).baseAt(syncedTreeKey(WORKING, "My Notes"), file)?.disk).toBe(carrierHash(text));
  });
});
