/**
 * canon-ear — THE VESSEL HEARS THE CANON SOURCE (operator ruling 2026-11-26: "any change to a canon on-disk file ends up in
 * the working layer, and takes the human hand to promote"). The rig rides the workbench pool's own: a recording submit port
 * for the wiki island, a Synced tree the test owns, a fake watch backend, and real git over a scratch checkout.
 *
 *   CE1 a canon carrier a hand edits lands in the working layer of its bag's wiki (`wikis/<slug>/working`, in that wiki's
 *       island, unattended, `writer: disk`); canon takes no wave and its base stays; a file that stands as canon agreed, and
 *       one the working layer already took, ride nothing
 *   CE2 GIT MOVES STAND ASIDE: a checkout that rewrites fifty carriers lands none and the log names the stand-aside; a hand's
 *       edit after it lands alone; a git that still moves holds the wave's files for the next one
 *   CE3 a carrier an unsettled merge left (git holds it unmerged, or its bytes carry the marker lines) refuses by name
 *   CE4 the house's own write-back reads as an echo and rides nothing; a base canon caught up with (a promote) reads as spent
 *   CE5 the catch-up reads what git names moved, and nothing in a folder no checkout holds
 *   CE6 the seat over the canon source wakes on a bag folder's carriers alone, and its down commits nothing
 */
import { describe, test, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { carrierHash } from "@lararium/mesh/crypto";
import { VERB_RESULT_KEY } from "@lararium/mesh/verb-tiddler";
import { wikiBagUri, wikiSlotUri } from "@lararium/mesh/wiki-recipe";
import { SyncedTree, syncedTreeKey } from "../src/synced-tree.js";

type WatchCore = typeof import("../src/watch-core.js");
type IngestScan = typeof import("../src/ingest-scan.js");
type CanonEar = typeof import("../src/canon-ear.js");
let wcLoaded: WatchCore | null = null, ceLoaded: CanonEar | null = null;
beforeAll(async () => {
  wcLoaded = await import(/* @vite-ignore */ "../src/watch-core.js") as WatchCore;
  ceLoaded = await import(/* @vite-ignore */ "../src/canon-ear.js") as CanonEar;
});
const wc = new Proxy({} as WatchCore, { get: (_t, k) => wcLoaded![k as keyof WatchCore] });
const ce = new Proxy({} as CanonEar, { get: (_t, k) => ceLoaded![k as keyof CanonEar] });

const WORKING = wikiSlotUri("notes", "working");
const CANON = wikiBagUri("notes");

let house: string;
let checkout: string;
let bags: string;
let tree: SyncedTree;
beforeEach(() => {
  house = mkdtempSync(join(tmpdir(), "lar-canon-ear-"));
  checkout = join(house, "checkout");
  bags = join(checkout, "bags");
  mkdirSync(join(bags, "notes"), { recursive: true });
  tree = new SyncedTree(join(house, "tree"));
});
afterEach(() => { rmSync(house, { recursive: true, force: true }); });

const fileOf = (rel: string): string => join(bags, "notes", ...rel.split("/"));
const put = (rel: string, text: string): string => { const p = fileOf(rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text); return p; };
const tid = (title: string, body = "a body"): string => `title: ${title}\ntype: text/vnd.tiddlywiki\n\n${body}\n`;
const git = (...args: string[]): { code: number; out: string } => {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")));
  const r = spawnSync("git", args, { cwd: checkout, env, encoding: "utf8" });
  return { code: r.status ?? 1, out: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim() };
};
const initCheckout = (): void => {
  for (const args of [["init", "-q", "-b", "main"], ["config", "user.name", "ear"], ["config", "user.email", "ear@canon.invalid"], ["config", "commit.gpgsign", "false"]]) expect(git(...args).code).toBe(0);
};
const commitAll = (subject: string): void => { expect(git("add", "-A").code).toBe(0); expect(git("commit", "-q", "-m", subject).code).toBe(0); };
/** The house agreed these words with the canon file: the projecting leg's own base. */
const canonAgreed = (uri: string, file: string, text: string): void => { const h = carrierHash(text); tree.set(syncedTreeKey(CANON, uri), file, h, h); };

type Opts = Parameters<IngestScan["settleIngest"]>[0];
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
function ear(isl: ReturnType<typeof island>, more: Partial<Parameters<CanonEar["canonEarPorts"]>[0]> = {}) {
  const lines: string[] = [];
  const ports = ce.canonEarPorts({ canonBags: bags, slugs: ["notes"], submit: () => isl.submit, did: "0xworn", tree: () => tree, log: (l) => lines.push(l), ...more });
  return { ports, lines };
}
function fakeWatch() {
  const watchers: Array<EventEmitter & { close(): void; closed: boolean }> = [];
  const watch = ((_dir: string, _opts: unknown, cb: (event: string, filename: string | null) => void) => {
    const w = Object.assign(new EventEmitter(), { closed: false, close() { this.closed = true; } });
    w.on("change", cb);
    watchers.push(w);
    return w;
  }) as unknown as NonNullable<Parameters<WatchCore["armCanonSourceWatch"]>[0]["watch"]>;
  return { watch, fire: (rel: string) => { for (const w of watchers) if (!w.closed) w.emit("change", "change", rel); } };
}
const settle = (ms = 40): Promise<void> => new Promise((r) => setTimeout(r, ms));

describe("CE1 — a hand's edit to a canon carrier lands in the working layer, and canon stays", () => {
  test("RED: the edit rides one unattended wave into wikis/notes/working, in that wiki's island, writer: disk; canon takes none and its base stands", async () => {
    const file = put("My Notes.tid", tid("My Notes"));
    const still = put("Still.tid", tid("Still"));
    canonAgreed("My Notes", file, tid("My Notes"));
    canonAgreed("Still", still, tid("Still"));
    const canonBase = tree.baseAt(syncedTreeKey(CANON, "My Notes"), file)!.disk;
    const isl = island();
    const { ports, lines } = ear(isl);
    writeFileSync(file, tid("My Notes", "a hand's edit"));
    await ports.wave([file, still]);
    expect(isl.waves).toHaveLength(1);
    const wave = isl.waves[0]!;
    expect(wave).toMatchObject({ toBag: WORKING, source: join(bags, "notes"), inWiki: true, wiki: "notes", unattended: true, writer: "disk", did: "0xworn" });
    expect(wave.candidates.map((c) => c.uri)).toEqual(["My Notes"]);
    expect(isl.waves.some((w) => w.toBag === CANON)).toBe(false);
    // Canon's own agreement stands where it stood; the working layer's base now stands at the canon file.
    expect(tree.baseAt(syncedTreeKey(CANON, "My Notes"), file)!.disk).toBe(canonBase);
    expect(tree.baseAt(syncedTreeKey(WORKING, "My Notes"), file)!.disk).toBe(carrierHash(tid("My Notes", "a hand's edit")));
    expect(lines.some((l) => /lands 1 canon carrier\(s\) from bags\/notes\/ into .*working \(writer: disk\); canon stands unmoved until a hand promotes/.test(l))).toBe(true);
    // The same file again: the working layer already took those words.
    await ports.wave([file]);
    expect(isl.waves).toHaveLength(1);
  });

  test("a second edit lands against the working layer's base; a file under no heard bag folder rides nothing", async () => {
    const file = put("My Notes.tid", tid("My Notes"));
    canonAgreed("My Notes", file, tid("My Notes"));
    const isl = island();
    const { ports } = ear(isl);
    writeFileSync(file, tid("My Notes", "first"));
    await ports.wave([file]);
    writeFileSync(file, tid("My Notes", "second"));
    await ports.wave([file, join(bags, "other", "X.tid")]);
    expect(isl.waves).toHaveLength(2);
    expect(isl.waves[1]!.candidates[0]).toMatchObject({ uri: "My Notes", status: "changed", syncedHash: carrierHash(tid("My Notes", "first")) });
  });

  test("a stand-off (the working record and the file both moved) lands nothing and names the hand's command", async () => {
    const file = put("My Notes.tid", tid("My Notes", "edited"));
    const isl = island(() => "conflict");
    const { ports, lines } = ear(isl);
    await ports.wave([file]);
    expect(tree.baseAt(syncedTreeKey(WORKING, "My Notes"), file)).toBeNull();
    expect(lines.some((l) => /stands off: My Notes .*a hand picks; `lares ingest --source /.test(l))).toBe(true);
  });
});

describe("CE2 — git moves stand aside", () => {
  const FIFTY = Array.from({ length: 50 }, (_v, i) => `Carrier ${String(i).padStart(2, "0")}`);

  test("RED: a git checkout that rewrites fifty carriers lands none, and the log names the stand-aside; a hand's edit after it lands alone", async () => {
    initCheckout();
    const files = FIFTY.map((title) => put(`${title}.tid`, tid(title, "main")));
    commitAll("main");
    FIFTY.forEach((title, i) => canonAgreed(title, files[i]!, tid(title, "main")));
    expect(git("checkout", "-q", "-b", "other").code).toBe(0);
    FIFTY.forEach((title) => put(`${title}.tid`, tid(title, "other")));
    commitAll("other");
    expect(git("checkout", "-q", "main").code).toBe(0);
    // The house rests agreed at main; the source-control move rewrites all fifty.
    expect(git("checkout", "-q", "other").code).toBe(0);
    const isl = island();
    const { ports, lines } = ear(isl);
    await ports.wave(files);
    expect(isl.waves).toEqual([]);
    expect(lines.some((l) => /stands aside: 50 canon carrier\(s\) under bags\/notes\/ stand as git's index names them .*a source-control move and never a hand's edit; nothing lands/.test(l))).toBe(true);
    for (const title of FIFTY) expect(tree.base(syncedTreeKey(WORKING, title))).toBeNull();
    // A hand now edits one of them: that one lands, the forty-nine stay aside.
    writeFileSync(files[7]!, tid(FIFTY[7]!, "a hand's edit"));
    await ports.wave(files);
    expect(isl.waves).toHaveLength(1);
    expect(isl.waves[0]!.candidates.map((c) => c.uri)).toEqual([FIFTY[7]]);
  }, 60_000);

  test("RED: a git that still moves lands nothing and holds the wave's files; the next wave lands them once it rests", async () => {
    const file = put("My Notes.tid", tid("My Notes", "edited"));
    const isl = island();
    let moving = true;
    const reads: number[] = [];
    const { ports, lines } = ear(isl, {
      rest: { reads: 3, pause: async () => {} },
      git: (_dir, files) => { reads.push(files?.length ?? -1); return moving ? { kind: "moving", why: "git holds the index lock" } : { kind: "read", head: "abc", underWay: null, state: () => "hand", moved: [] }; },
    });
    await ports.wave([file]);
    expect(isl.waves).toEqual([]);
    expect(reads).toHaveLength(3);
    expect(lines.some((l) => /bags\/notes\/: stands aside while git moves \(git holds the index lock\); nothing lands, and 1 file\(s\) ride the next wave/.test(l))).toBe(true);
    moving = false;
    await ports.wave([]);
    expect(isl.waves).toHaveLength(1);
    expect(isl.waves[0]!.candidates.map((c) => c.uri)).toEqual(["My Notes"]);
  });

  test("a move that stands open (a rebase) holds even a dirty carrier aside; a checkout git cannot read lands nothing and says why", async () => {
    const file = put("My Notes.tid", tid("My Notes", "edited"));
    const isl = island();
    const open = ear(isl, { git: () => ({ kind: "read", head: "abc", underWay: "a rebase", state: () => "hand", moved: [] }) });
    await open.ports.wave([file]);
    expect(isl.waves).toEqual([]);
    expect(open.lines.some((l) => /stands aside: a rebase stands open in the checkout, so 1 canon carrier/.test(l))).toBe(true);
    const mute = ear(isl, { git: () => ({ kind: "unanswered", why: "git cannot run in this runtime (rev-parse)" }) });
    await mute.ports.wave([file]);
    expect(isl.waves).toEqual([]);
    expect(mute.lines.some((l) => /git cannot run in this runtime .*nothing lands\. `lares ingest --source/.test(l))).toBe(true);
  });
});

describe("CE3 — a conflict-marked carrier refuses by name", () => {
  test("RED: a carrier an unsettled merge left unmerged refuses by name, and the carrier the merge settled stands aside", async () => {
    initCheckout();
    const torn = put("Torn.tid", tid("Torn", "base"));
    const calm = put("Calm.tid", tid("Calm", "base"));
    commitAll("base");
    canonAgreed("Torn", torn, tid("Torn", "base"));
    canonAgreed("Calm", calm, tid("Calm", "base"));
    expect(git("checkout", "-q", "-b", "theirs").code).toBe(0);
    put("Torn.tid", tid("Torn", "theirs"));
    put("Calm.tid", tid("Calm", "theirs"));
    commitAll("theirs");
    expect(git("checkout", "-q", "main").code).toBe(0);
    put("Torn.tid", tid("Torn", "ours"));
    commitAll("ours");
    expect(git("merge", "theirs").code).not.toBe(0);
    const isl = island();
    const { ports, lines } = ear(isl);
    await ports.wave([torn, calm]);
    expect(isl.waves).toEqual([]);
    expect(lines.some((l) => /refuses: notes\/Torn\.tid \(conflict-markers-stand: git holds the path unmerged/.test(l))).toBe(true);
    expect(lines.some((l) => /stands aside: 1 canon carrier\(s\).*notes\/Calm\.tid/.test(l))).toBe(true);
  }, 60_000);

  test("RED: marker lines in a folder no checkout holds refuse the carrier by name; a carrier beside it lands", async () => {
    const torn = put("Torn.tid", `title: Torn\n\n<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> theirs\n`);
    const whole = put("Whole.tid", tid("Whole", "edited"));
    const isl = island();
    const { ports, lines } = ear(isl);
    await ports.wave([torn, whole]);
    expect(isl.waves).toHaveLength(1);
    expect(isl.waves[0]!.candidates.map((c) => c.uri)).toEqual(["Whole"]);
    expect(lines.some((l) => /refuses: notes\/Torn\.tid \(conflict-markers-stand: its bytes carry a conflict's marker lines/.test(l))).toBe(true);
  });
});

describe("CE4 — the house's own write and a spent base", () => {
  test("a file that says what the canon records say (the projecting leg's write-back) rides nothing", async () => {
    const echo = put("Echo.tid", tid("Echo", "promoted words"));
    const hand = put("Hand.tid", tid("Hand", "a hand's edit"));
    const isl = island();
    const asked: string[][] = [];
    const { ports } = ear(isl, { canonAgrees: async (_slug, bag, carriers) => { asked.push([bag, ...carriers.map((c) => c.uri)]); return new Set(["Echo"]); } });
    await ports.wave([echo, hand]);
    expect(asked).toEqual([[CANON, "Echo", "Hand"]]);
    expect(isl.waves).toHaveLength(1);
    expect(isl.waves[0]!.candidates.map((c) => c.uri)).toEqual(["Hand"]);
  });

  test("the island's count splits a mixed page until each carrier answers for itself", async () => {
    const agreeing = new Set(["B", "D"]);
    const road = async (args: Record<string, unknown>) => {
      const bases = args["bases"] as Array<{ uri: string }>;
      return { ok: true, recorded: bases.filter((b) => agreeing.has(b.uri)).length, kept: 0, waiting: 0, differs: bases.filter((b) => !agreeing.has(b.uri)).length };
    };
    const ask = ce.canonAgreementAsk(() => [async () => ({ ok: false, refusal: "bag-unprojected" }), road]);
    expect([...(await ask("notes", CANON, ["A", "B", "C", "D", "E"].map((uri) => ({ uri, file: `/x/${uri}.tid` }))))].sort()).toEqual(["B", "D"]);
    expect([...(await ce.canonAgreementAsk(() => [])("notes", CANON, [{ uri: "A", file: "/x/A.tid" }]))]).toEqual([]);
  });

  test("a working base canon has caught up with (a promote landed those words) reads as spent: the next edit rides with no base", async () => {
    const file = put("My Notes.tid", tid("My Notes", "promoted"));
    const promoted = carrierHash(tid("My Notes", "promoted"));
    tree.set(syncedTreeKey(WORKING, "My Notes"), file, promoted, promoted);
    canonAgreed("My Notes", file, tid("My Notes", "promoted"));
    const isl = island();
    const { ports } = ear(isl);
    await ports.wave([file]);
    expect(isl.waves).toEqual([]);
    writeFileSync(file, tid("My Notes", "a later edit"));
    await ports.wave([file]);
    expect(isl.waves[0]!.candidates[0]).toMatchObject({ uri: "My Notes", status: "new", syncedHash: null });
  });
});

describe("CE5 — the catch-up reads what git names moved", () => {
  test("an edit a hand left uncommitted while the house rested lands at the catch-up; committed carriers stand aside unread", async () => {
    initCheckout();
    const edited = put("Edited.tid", tid("Edited", "committed"));
    const still = put("Still.tid", tid("Still", "committed"));
    commitAll("canon");
    canonAgreed("Edited", edited, tid("Edited", "committed"));
    canonAgreed("Still", still, tid("Still", "committed"));
    writeFileSync(edited, tid("Edited", "left uncommitted"));
    const isl = island();
    const { ports } = ear(isl);
    await ports.catchUp();
    expect(isl.waves).toHaveLength(1);
    expect(isl.waves[0]!.candidates.map((c) => c.uri)).toEqual(["Edited"]);
  }, 60_000);

  test("a carrier no agreement ever named rides no catch-up; a folder no checkout holds reads none and says so once", async () => {
    initCheckout();
    put("Unagreed.tid", tid("Unagreed"));
    const isl = island();
    const inCheckout = ear(isl);
    await inCheckout.ports.catchUp();
    expect(isl.waves).toEqual([]);
    expect(inCheckout.lines.some((l) => /1 canon carrier\(s\) under bags\/notes\/ hold no agreement with the house yet, so the catch-up lands none/.test(l))).toBe(true);
    rmSync(join(checkout, ".git"), { recursive: true, force: true });
    const plain = ear(isl);
    await plain.ports.catchUp();
    await plain.ports.catchUp();
    expect(isl.waves).toEqual([]);
    expect(plain.lines.filter((l) => /no checkout holds it/.test(l))).toHaveLength(1);
  }, 60_000);
});

describe("CE6 — the seat over the canon source", () => {
  test("a bag folder's carrier wakes a wave; another top, a dotfile and a bare top-level file wake none; the down commits nothing", async () => {
    const { watch, fire } = fakeWatch();
    const waves: string[][] = [];
    const lines: string[] = [];
    const seat = wc.armCanonSourceWatch({
      canonBags: bags, slugs: ["notes"], watch, cookie: async () => true, settleMs: 5, log: (l) => lines.push(l),
      ports: { catchUp: async () => {}, wave: async (files) => { waves.push([...files]); } },
    });
    expect(await seat.armed).toBe("live");
    fire("notes/My Notes.tid");
    fire("elsewhere/Other.tid");
    fire("notes/.hidden");
    fire("README.md");
    await settle();
    expect(waves).toEqual([[join(bags, "notes", "My Notes.tid")]]);
    expect(await seat.down("lock")).toEqual({ committed: false, why: "nothing-moved" });
    expect(lines.some((l) => /the pool commits/.test(l))).toBe(false);
  });
});
