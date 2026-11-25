/**
 * ingest-scan — THE DRAIN LIVES IN THE NODE (tideline-surface #/seam point 1; face-pools W1, W2). The scan, the candidates, the
 * deletions, the standing helpers, the settle and the siting call stand in `@lararium/node`, behind a SUBMIT PORT the caller
 * fills: the CLI's `lares ingest`/`lares ingest --watch` fill it with the verb socket, the vessel with its daemon island's INGEST verb.
 * So the vessel's watch over the worn face's pool lands an edit as an UNATTENDED INGEST wave by itself, with no `take-disk`.
 *
 *   I1 a vessel-side caller scans a face pool, builds candidates, and submits one unattended INGEST wave per granted plane
 *      through the port: a plain-title edit under `wikis/daemon/` lands in the daemon working bag, a loci `.mem` edit under `bags/daemon/`
 *      in the face's canon bag; each landed carrier pins its base, so the next wave over the same bytes submits nothing
 *   I2 a carrier that stands off (both moved) submits once and then goes to the shore's sense by name: it stays a stand-off
 *   I3 a vanished file tombstones nothing: no deletion rides, and the shore's whole look runs (it stands pending there)
 *   I4 a personal-layer file rides no daemon wave: the shore senses its title, as before
 *   I5 the watch core's wave, armed with the pool's ingest ports, lands a pool edit by itself
 *   I6 the island submit maps the daemon island's answer onto the settle's result: done carries the summary, a refusal errors
 *   I7 the port's INGEST args: source under the plane, the bag, unattended, each carrier inline with its hashes
 *   I8 no cycle: the node never imports the CLI, and the vessel's after-live arms the watch with the ingest ports
 *   I9 a `derived` row (a render the island answered on its gradient) fails no wave: it reads accounted for, pins no base, and
 *      a row that warns gets named with its words
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

describe("I2 — a stand-off stays at the shore", () => {
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
  test("an edit under wikis/daemon/ reaches the island as an unattended INGEST wave, no take-disk", async () => {
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
