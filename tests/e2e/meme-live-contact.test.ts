/**
 * e2e/meme-live-contact — a meme family through the call door over ONE vessel's own rendezvous, every seat of the family.
 *
 * `bag-is-user-space` and `place-meme` read the placement law in one process over a memory store. This
 * witness reads the same law where an operator's hands reach it: a fresh root founded by the CLI, its
 * daemon bound to a socket derived from that root, and the built `lares` binary driven against it.
 *
 *   get (no container)   → reads the daemon wiki (`recipe=default`): not-found, never a `no-container` refusal
 *   get (absent)         → not-found, nothing lands (`recipe=lares`)
 *   put bag=lares        → refuses: a placement never shadows up (CONTROL)
 *   put (framed)         → put; the root and `#/a` landed (a root text put founds the family)
 *   get mu=assert        → the same bytes back, with the canonical hash as `base` (`recipe=lares`)
 *   put base= (fresh)    → put; the slot the text omits stays (`kept`) until `cut-slot` names it (`tombstoned`)
 *   put base= (stale)    → conflict; nothing moves  (the CONTROL — a door only shown saying yes is no door)
 *   delete family=true   → the family leaves; a slot's own delete lands as the cut of its parent
 *   project --to md      → the submission pair beside `--out`
 *   project --to mem     → refuses (the carrier reads through `get mu=assert`, the CONTROL)
 *   project --to html    → a document, rendered from the explicit daemon wiki recipe
 *
 * THE SHARED TREE STAYS STILL. A staged boot bakes its genesis INTO ITS ROOT from the plugin that
 * stands; it never rebuilds the plugin beside a parallel writer. The suite snapshots `git status` over
 * the plugin package and the sealed `genesis/` before the vessel stands and reads it back after.
 *
 * SKIPS LOUDLY: a witness that cannot spawn its vessel names what is missing on stderr and skips. It
 * never passes on silence. Staged only — a live hearth is never written to by a test.
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { targetInstance, awaitRendezvous, daemonWikiDir, type LarInstance } from "../harness/instance.js";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const CLI_BIN   = join(REPO_ROOT, "packages/lares-cli/dist/src/bin/lares.js");
const NODE_MAIN = join(REPO_ROOT, "packages/lararium-node/dist/src/main.js");

/**
 * THE CONTAINER EVERY CALL NAMES: an edit AS the hearth's own wiki, in that wiki's own engine, landing in the
 * face's write layer of it. Measured on a fresh vessel:
 *   · `recipe=lares`    reaches the placement law (this seat)
 *   · `bag=daemon`      reaches it too — the daemon bag is a mounted writable layer
 *   · `bag=lares`       refuses — the bag holds no writable layer here and a placement never shadows up
 *   · `recipe=default`  names the daemon wiki's anchor route, and a call naming no container reads it too.
 */
const WIKI = ["recipe=lares"] as const;
/** The same wiki as `lares meme project` names it: that verb keeps its flags. */
const MEME_WIKI = ["recipe=lares"] as const;
const DAEMON_WORKING = "lar:///ha.ka.ba/wikis/daemon/working";
const CROSSROADS_URI = "lar:///ha.ka.ba/bags/crossroads";

const PATH = "t/witness/npc";
const URI  = `lar:///${PATH}`;

/** A framed witness meme whose body holds the named ahu slots. */
const meme = (slots: readonly string[]): string =>
  `<<^ code=\`&#x0001;\` from=\`?\` to=\`${URI}\`>>\n<<^ code=\`&#x0002;\`>>\n\n\`\`\`toml meta\nuri-path = "${PATH}"\n\`\`\`\n\n` +
  slots.map((s) => `<<~ ahu slot=\`#/${s}\`>>\n\n! ${s}\n\n<<~/ahu>>\n`).join("\n") +
  `\n<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`;

/** What the witness needs before it can stand a vessel; empty when everything is in place. */
function missing(): string[] {
  const out: string[] = [];
  if (!existsSync(CLI_BIN))   out.push(`built CLI at ${CLI_BIN} (pnpm --filter @lares/cli build)`);
  if (!existsSync(NODE_MAIN)) out.push(`built node vessel at ${NODE_MAIN} (pnpm --filter @lararium/node build)`);
  if (process.env["LAR_TARGET"] === "live") out.push("a STAGED target — this witness writes, and never writes to a live hearth");
  return out;
}

/** What a call answered, both streams — `json=true` carries the refusal on stdout. */
const said = (r: { stdout: string; stderr: string }): string => `${r.stdout}\n${r.stderr}`;

/** Poll a path until it reaches the wanted existence state (or timeout). */
async function awaitFileState(path: string, want: boolean, timeoutMs = 30_000): Promise<boolean> {
  const start = Date.now();
  for (;;) {
    if (existsSync(path) === want) return true;
    if (Date.now() - start > timeoutMs) return false;
    await new Promise((r) => setTimeout(r, 500));
  }
}

/** What the shared tree reads as, over the paths a staged boot must never touch — tracked and untracked alike. */
const sharedTree = (): string =>
  execFileSync("git", ["status", "--short", "--untracked-files=all", "--", "packages/lararium-tw5", "genesis"], { cwd: REPO_ROOT, encoding: "utf8" });

const gaps = missing();
if (gaps.length > 0) console.error(`meme-live-contact: SKIPPED — missing ${gaps.join("; ")}`);

let lar: LarInstance;
let scratch = "";
const treeBefore = gaps.length > 0 ? "" : sharedTree();

describe.skipIf(gaps.length > 0)("★ a meme family through the call door over a live rendezvous ★", () => {
  beforeAll(async () => {
    lar = await targetInstance();
    scratch = join(lar.root, "witness");
    mkdirSync(scratch, { recursive: true });
    writeFileSync(join(scratch, "ab.mem"), meme(["a", "b"]));
    writeFileSync(join(scratch, "ac.mem"), meme(["a", "c"]));
    const bound = await awaitRendezvous(lar);
    if (!bound) throw new Error(`the staged daemon reached live but bound no rendezvous:\n${lar.bootLog().slice(-800)}`);
  }, 150_000);
  afterAll(async () => { if (lar) await lar.stop(); });

  let base = "";

  test("★ a call naming no container reads the daemon wiki (recipe=default) — not-found there, never a no-container refusal ★", async () => {
    const r = await lar.cli(["get", `title=${URI}`, "mu=assert", "json=true"]);
    const err = r.json?.["error"] as Record<string, unknown> | undefined;
    expect(err?.["code"], said(r)).not.toBe("no-container");
    expect(err?.["code"], said(r)).toBe("not-found");
    expect(r.code).toBe(3);
  });

  test("CONTROL: `bag=lares` refuses a put — the bag holds no writable layer and a placement never shadows up", async () => {
    const r = await lar.cli(["put", `title=${URI}`, "bag=lares", `file=${join(scratch, "ab.mem")}`, "json=true"]);
    expect(r.json?.["ok"]).toBe(false);
    expect((r.json?.["error"] as Record<string, unknown>)?.["message"], said(r)).toMatch(/holds no writable layer/);
    expect(r.code).toBe(4);
  });

  test("get of an absent meme → not-found", async () => {
    const r = await lar.cli(["get", `title=${URI}`, ...WIKI, "mu=assert", "json=true"]);
    expect(r.json?.["ok"]).toBe(false);
    expect((r.json?.["error"] as Record<string, unknown>)?.["code"], said(r)).toBe("not-found");
    expect(r.code).toBe(3);
  });

  test("put of a framed meme → put; the root and `#/a` landed", async () => {
    const r = await lar.cli(["put", `title=${URI}`, ...WIKI, `file=${join(scratch, "ab.mem")}`, "json=true"]);
    expect(r.json?.["ok"], said(r)).toBe(true);
    const d = r.json?.["data"] as Record<string, unknown>;
    expect(d["decision"]).toBe("put");
    expect(d["position"]).toBe("root");
    expect((d["landed"] as string[]).sort()).toEqual([URI, `${URI}#/a`, `${URI}#/b`]);
    expect(d["tombstoned"]).toEqual([]);
    expect(typeof d["canonicalHash"]).toBe("string");
  });

  test("get → the same bytes back, with the canonical hash", async () => {
    const r = await lar.cli(["get", `title=${URI}`, ...WIKI, "mu=assert", "json=true"]);
    expect(r.json?.["ok"], said(r)).toBe(true);
    const d = (r.json?.["data"] as Record<string, unknown>)["meme"] as Record<string, unknown>;
    const text = String(d["text"]);
    // The read hands back the CANONICAL carrier: the framing normalized, the block check stamped, the
    // body whole. Framed as sent, the two slots and the address read back verbatim.
    expect(text).toContain(`uri-path = "${PATH}"`);
    expect(text).toContain("<<~ ahu slot=`#/a`>>\n\n! a\n\n<<~/ahu>>");
    expect(text).toContain("<<~ ahu slot=`#/b`>>\n\n! b\n\n<<~/ahu>>");
    base = String(d["canonicalHash"]);
    // The base IS the digest of the bytes handed back — collided here, never assumed.
    expect(base).toBe(`sha256:${createHash("sha256").update(text).digest("hex")}`);
    // The prose seat writes the text alone to stdout, so `lares get title=<uri> mu=assert > file` carries the meme;
    // the prose seat is asked for by name.
    const human = await lar.cli(["get", `title=${URI}`, ...WIKI, "mu=assert", "json=false"]);
    expect(human.stdout).toBe(text);
    expect(human.stderr).toContain(`base: ${base}`);
  });

  test("put base= (fresh) with a changed slot and a cut → put; `#/b` tombstoned by name, `#/c` born", async () => {
    const r = await lar.cli(["put", `title=${URI}`, ...WIKI, `base=${base}`, "cut-slot=#/b", `file=${join(scratch, "ac.mem")}`, "json=true"]);
    expect(r.json?.["ok"], said(r)).toBe(true);
    const d = r.json?.["data"] as Record<string, unknown>;
    expect(d["decision"]).toBe("put");
    expect(d["kept"]).toEqual([]);
    expect(d["tombstoned"]).toEqual([`${URI}#/b`]);
    expect(d["landed"]).toContain(`${URI}#/c`);
    expect(d["canonicalHash"]).not.toBe(base);
  });

  test("CONTROL: put base= (stale) → conflict; nothing moves", async () => {
    const before = await lar.cli(["get", `title=${URI}`, ...WIKI, "mu=assert", "json=true"]);
    const r = await lar.cli(["put", `title=${URI}`, ...WIKI, `base=${base}`, `file=${join(scratch, "ab.mem")}`, "json=true"]);
    expect(r.json?.["ok"]).toBe(false);
    expect((r.json?.["error"] as Record<string, unknown>)?.["code"]).toBe("conflict");
    expect(r.code).toBe(4);
    const after = await lar.cli(["get", `title=${URI}`, ...WIKI, "mu=assert", "json=true"]);
    const afterText = String(((after.json?.["data"] as Record<string, unknown>)["meme"] as Record<string, unknown>)["text"]);
    expect(afterText).toBe(String(((before.json?.["data"] as Record<string, unknown>)["meme"] as Record<string, unknown>)["text"]));
    expect(afterText).toContain("<<~ ahu slot=`#/c`>>");
    expect(afterText).not.toContain("<<~ ahu slot=`#/b`>>");
  });

  test("project --to md → text + a `.meta` beside --out", async () => {
    const out = join(scratch, "npc.md");
    const r = await lar.cli(["meme", "project", URI, ...MEME_WIKI, "to=md", `out=${out}`, "json=true"]);
    expect(r.json?.["ok"], said(r)).toBe(true);
    expect(existsSync(out)).toBe(true);
    expect(existsSync(`${out}.meta`)).toBe(true);
    const md = readFileSync(out, "utf8");
    expect(md.length).toBeGreaterThan(0);
    expect(md).toContain("a");
    const meta = readFileSync(`${out}.meta`, "utf8");
    expect(meta).toContain(PATH);
  });

  test("CONTROL: project --to mem left the verb — the carrier itself reads through the one door, and the usage names the targets", async () => {
    const r = await lar.cli(["meme", "project", URI, ...MEME_WIKI, "to=mem", "json=false"]);
    expect(r.code, said(r)).toBe(2);
    expect(r.stderr).toMatch(/md · html · tid · json/);
    const got = await lar.cli(["get", `title=${URI}`, ...WIKI, "mu=assert", "json=false"]);
    expect(got.code, said(got)).toBe(0);
    expect(got.stdout).toContain(`uri-path = "${PATH}"`);
  });

  test("list → the root stands with its canonical hash; tree=true nests its slots (the daemon registers meme-list)", async () => {
    const r = await lar.cli(["get", "meme=true", ...WIKI, "tree=true", "json=true"]);
    expect(r.code, said(r)).toBe(0);
    const roots = (r.json?.["data"] as { roots: { uri: string; canonicalHash: string; slots?: { slot: string }[] }[] }).roots;
    const mine = roots.find((x) => x.uri === URI);
    expect(mine, `the root never listed — ${said(r)}`).toBeDefined();
    expect(mine!.canonicalHash).toMatch(/^sha256:/);
    expect(mine!.slots?.map((x) => x.slot)).toContain("#/a");
  });

  test("a slot's own delete lands as the cut of its parent; delete family=true → 0 and the group leaves; get answers not-found", async () => {
    const cut = await lar.cli(["delete", `title=${URI}#/c`, ...WIKI, "json=true"]);
    expect(cut.code, said(cut)).toBe(0);
    expect(cut.json?.["data"]).toMatchObject({ decision: "removed", mode: "cut", tombstoned: [`${URI}#/c`], parent: URI });
    const r = await lar.cli(["delete", `title=${URI}`, ...WIKI, "family=true", "json=true"]);
    expect(r.code, said(r)).toBe(0);
    const got = await lar.cli(["get", `title=${URI}`, ...WIKI, "mu=assert", "json=true"]);
    const err = got.json?.["error"] as Record<string, unknown> | undefined;
    expect(err?.["code"] ?? got.json?.["code"], said(got)).toBe("not-found");
    // CONTROL: a delete of what no longer stands answers not-found, never a second removal.
    const again = await lar.cli(["delete", `title=${URI}`, ...WIKI, "family=true", "json=true"]);
    expect(again.code, said(again)).not.toBe(0);
  });

  test("project --to html from the anchor → a document through the house template, inside the island", async () => {
    // html renders from the daemon wiki when explicitly targeted, so the meme lands there first.
    const put = await lar.cli(["put", `title=${URI}`, "recipe=default", `file=${join(scratch, "ab.mem")}`, "json=true"]);
    expect(put.code, said(put)).toBe(0);
    const r = await lar.cli(["meme", "project", URI, "recipe=default", "to=html", "json=false"]);
    expect(r.code, said(r)).toBe(0);
    expect(r.stdout.trimStart().toLowerCase().startsWith("<!doctype html")).toBe(true);
    expect(r.stdout).toContain("tc-story-river");
    expect(r.stdout).toMatch(/<h1[^>]*>a<\/h1>/);
  });

  /**
   * THE RESIDENCY DOOR OUT OF THE DAEMON WIKI. The daemon holds `wikis/daemon/working` by ruling
   * (working layers for all wikis); a carrier placed there leaves for a public system bag by the
   * shore-law MOVE, the same verb every promotion rides. `crossroads` is the public plane the daemon
   * splices in as a library (`daemon-vm-core.ts`), so it names the destination.
   */
  test("★ act MOVE --from wikis/daemon/working --to bags/crossroads — the residency verb carries a daemon-wiki carrier out ★", async () => {
    const MOVE_PATH = "ha.ka.ba/t/witness/move";
    const MOVE_URI  = `lar:///${MOVE_PATH}`;
    writeFileSync(join(scratch, "move.mem"), meme(["a"]).replaceAll(URI, MOVE_URI).replaceAll(PATH, MOVE_PATH));
    const put = await lar.cli(["put", `title=${MOVE_URI}`, `bag=${DAEMON_WORKING}`, `file=${join(scratch, "move.mem")}`, "json=true"]);
    expect(put.json?.["ok"], said(put)).toBe(true);
    const r = await lar.cli(["lar:///carriage.bag.moves", `title=${MOVE_URI}`, `from=${DAEMON_WORKING}`, `to=${CROSSROADS_URI}`, "yes=true", "json=true"]);
    expect(r.json?.["ok"], `the MOVE out of the daemon wiki refused — ${said(r)}`).toBe(true);
    const gone = await lar.cli(["get", `title=${MOVE_URI}`, `bag=${DAEMON_WORKING}`, "mu=assert", "json=true"]);
    expect((gone.json?.["error"] as Record<string, unknown>)?.["code"], `the carrier still stands in the daemon's working layer — ${said(gone)}`).toBe("not-found");
    const there = await lar.cli(["get", `title=${MOVE_URI}`, `bag=${CROSSROADS_URI}`, "mu=assert", "json=true"]);
    expect(there.json?.["ok"], `the carrier never reached crossroads — ${said(there)}`).toBe(true);
  });

  /**
   * The disk leg of that MOVE. `bags/crossroads/` stands as a GRANT on the node's disk-mirror list
   * (authority) but no recipe DESIGNATES it (`vessel-steps.ts` PRIMARY_MIRROR_BAGS names lares and
   * lararium alone), so `resolveDiskMirrors` yields no crossroads mirror on any island, and the daemon
   * island mounts no projector at all. The carrier moves in the CRDT and publishes nowhere.
   */
  test("★ the daemon designates crossroads: the MOVE publishes under bags/crossroads/ and leaves wikis/daemon/ ★", async () => {
    const MOVE_PATH = "ha.ka.ba/t/witness/move";
    const landed = join(lar.root, "projections/bags", "crossroads", `${MOVE_PATH}.mem`);
    expect(await awaitFileState(landed, true, 15_000), `the MOVE never published under ${landed}`).toBe(true);
    expect(existsSync(join(daemonWikiDir(lar.root), `${MOVE_PATH}.mem`))).toBe(false);
  });

  /**
   * RESIDENCY MOVES A BINARY BETWEEN STORE STYLES (blob-carriage.mem, RULED). A `.png` + `.meta`
   * LOADed into the daemon's working layer lands a POINTER (bytes in cid/, hashed RAW). `act MOVE`
   * carries the pointer WHOLE — the CID stays, `_integrity` stays, the bytes stay in cid/ — and the
   * destination mirror projects `photo.png` + `photo.png.meta` from them while the source unlinks.
   */
  test("★ act MOVE of a png POINTER from wikis/daemon/working to bags/crossroads — photo.png + .meta appear there, wikis/daemon/ unlinks ★", async () => {
    const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
    const CID = createHash("sha256").update(PNG).digest("hex");
    const NI  = `ni:///sha-256;${Buffer.from(CID, "hex").toString("base64url")}`;
    const BLOB_PATH = "ha.ka.ba/t/witness/photo";
    const BLOB_URI  = `lar:///${BLOB_PATH}`;
    // THE SOURCE ENTERS BESIDE THE MIRROR, NEVER INSIDE IT. A hand-laid sidecar under the mirror says less
    // than the pointer's records, and `act LOAD` pins no base, so the projector would write nothing over
    // it and the pair would stand off for a person (`disk-projection#/projection-law`, no base and a real
    // difference). This witness measures what the daemon's mirror WRITES and then unlinks, so the hand
    // lays its files in a holding tree shaped as a wiki's own (LOAD derives the loci title from the path)
    // and the projector lays every file fresh under the daemon wiki's folder (`faces/<pet name>/wikis/daemon/`).
    const HAND_META = "type: image/png\ntags: witness\n";
    const holding = join(scratch, "wikis", "holding", "ha.ka.ba/t/witness");
    mkdirSync(holding, { recursive: true });
    writeFileSync(join(holding, "photo.png"), PNG);
    writeFileSync(join(holding, "photo.png.meta"), HAND_META);
    const ld = await lar.cli(["lar:///carriage.bag.loads", `source-uri=${holding}`, `to=${DAEMON_WORKING}`, "yes=true", "json=true"]);
    expect(ld.json?.["ok"], `the LOAD refused — ${said(ld)}`).toBe(true);
    // the pointer landed: the CID over the RAW bytes, the projected sidecar carries it
    const srcDir  = join(daemonWikiDir(lar.root), "ha.ka.ba/t/witness");
    const srcMeta = join(srcDir, "photo.png.meta");
    const projected = (): string => (existsSync(srcMeta) ? readFileSync(srcMeta, "utf8") : "");
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline && !projected().includes("_is_skinny")) await new Promise((r) => setTimeout(r, 500));
    expect(projected(), `the daemon's mirror never projected ${srcMeta}`).toContain(`textCid: ${CID}`);
    expect(await awaitFileState(join(srcDir, "photo.png"), true, 30_000), "the daemon's mirror never projected the pointer's bytes").toBe(true);
    expect(readFileSync(join(srcDir, "photo.png")).equals(PNG)).toBe(true);
    // CONTROL: the hand's own files stand as laid; the island wrote nothing back into the holding tree.
    expect(readFileSync(join(holding, "photo.png")).equals(PNG)).toBe(true);
    expect(readFileSync(join(holding, "photo.png.meta"), "utf8")).toBe(HAND_META);

    const mv = await lar.cli(["lar:///carriage.bag.moves", `title=${BLOB_URI}`, `from=${DAEMON_WORKING}`, `to=${CROSSROADS_URI}`, "yes=true", "json=true"]);
    expect(mv.json?.["ok"], `the MOVE of the pointer refused — ${said(mv)}`).toBe(true);
    const landedPng  = join(lar.root, "projections/bags", "crossroads", `${BLOB_PATH}.png`);
    const landedMeta = `${landedPng}.meta`;
    expect(await awaitFileState(landedPng, true, 30_000), `the MOVE never published the bytes under ${landedPng}`).toBe(true);
    expect(await awaitFileState(landedMeta, true, 15_000)).toBe(true);
    expect(readFileSync(landedPng).equals(PNG)).toBe(true);
    const meta = readFileSync(landedMeta, "utf8");
    expect(meta).toContain(`textCid: ${CID}`);
    expect(meta).toContain(`_integrity: ${NI}`);
    expect(meta).toContain("tags: witness");
    expect(meta).not.toContain("_canonical_uri");
    expect(await awaitFileState(join(srcDir, "photo.png"), false, 30_000), "the daemon wiki folder kept the moved photo.png").toBe(true);
    expect(existsSync(srcMeta)).toBe(false);
    // barrier: the photo's projection under the daemon wiki folder settled above (awaitFileState), so the projector has run
    expect(existsSync(join(lar.root, "projections/wikis", "daemon")), "an untagged daemon folder appeared").toBe(false);
  }, 120_000);

  test("★ the staged boot wrote nothing into the shared tree — its genesis baked into its own root ★", () => {
    expect(existsSync(join(lar.root, "genesis", "seed.json"))).toBe(true);
    expect(sharedTree()).toBe(treeBefore);
  });
});
