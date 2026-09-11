/**
 * nonmeme-parity — a non-meme file round-trips through BOTH doors under the same `.meta` law.
 *
 *   note.md + note.md.meta    a lar: title, `type: text/markdown`
 *   photo.png + photo.png.meta a binary, `type: image/png`        (MEASURED only — where binaries
 *                                                                  belong under bags/ reads OPEN)
 *   pack.json                  two foreign-titled tiddlers
 *
 *   ENTER   server: the wiki folder's `tiddlers/` (`$tw.loadTiddlersFromPath` reads them at boot)
 *           island: `lares ingest --source <dir> --to lar:///ha.ka.ba/bags/lares --apply --yes`
 *   LEAVE   server: `tiddlywiki --savewikifolder` — the same `generateTiddlerFileInfo` +
 *                   `saveTiddlerToFileSync` law the filesystem adaptor writes through, under a
 *                   real `$:/config/FileSystemPaths` carrying the loci rule
 *           island: the projector into `<root>/bags/lares/…`
 *
 * The two trees agree file-for-file where the house rides TW5's law; where they DISAGREE the
 * finding is named here with file:line, cured on the house side when the house strayed, held as a
 * loud `test.fails` when the cure belongs to a file another spirit owns.
 *
 * Both doors are real; the witness skips LOUDLY when either cannot open.
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { targetInstance, stageDir, type LarInstance } from "../harness/instance.js";
import { bootForkServer, forkMissing, layWikiFolder, runFork, REPO_ROOT, type ForkServer } from "./parity-fork-server.js";

const CLI_BIN   = join(REPO_ROOT, "packages/lares-cli/dist/src/bin/lares.js");
const NODE_MAIN = join(REPO_ROOT, "packages/lararium-node/dist/src/main.js");

const BAG_URI  = "lar:///ha.ka.ba/bags/lares";
const REL_DIR  = "ha.ka.ba/lares/parity";
const NOTE_URI = `lar:///${REL_DIR}/note`;
const PHOTO_URI = `lar:///${REL_DIR}/photo`;
const PACK_MEMBERS = ["HelloParity", "SecondParity"] as const;

/** The siting rule both doors read: a `lar:///w.w.w/…` root sites at its uri-path. */
const LOCI_PATH_RULE = "[prefix[lar:///]regexp[^lar:///\\w+\\.\\w+\\.\\w+/(?:(?!#).)*$]removeprefix[lar:///]]";

const PNG_BYTES = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

/** The source files, byte-identical for both doors. The `.meta` fields ride UNSORTED on purpose: TW5's
 *  field serializer sorts them, so a sorted sidecar on disk afterwards proves the door WROTE it. */
const SOURCE: Record<string, string | Buffer> = {
  "note.md":        "# a parity note\n\nprose that projects to `.md`, fields to `.meta`.\n",
  "note.md.meta":   `type: text/markdown\ntitle: ${NOTE_URI}\ntags: parity\n`,
  "photo.png":      PNG_BYTES,
  "photo.png.meta": `type: image/png\ntitle: ${PHOTO_URI}\n`,
  "pack.json":      JSON.stringify(PACK_MEMBERS.map((title) => ({ title, text: `${title} rides in a pack`, type: "text/vnd.tiddlywiki" })), null, 4),
};

function missing(): string[] {
  const out: string[] = [...forkMissing()];
  if (!existsSync(CLI_BIN))   out.push(`built CLI at ${CLI_BIN} (pnpm --filter @lares/cli build)`);
  if (!existsSync(NODE_MAIN)) out.push(`built node vessel at ${NODE_MAIN} (pnpm --filter @lararium/node build)`);
  if (process.env["LAR_TARGET"] === "live") out.push("a STAGED target — this witness writes, and never writes to a live hearth");
  return out;
}
const gaps = missing();
if (gaps.length > 0) console.error(`nonmeme-parity: SKIPPED — missing ${gaps.join("; ")}`);

const said = (r: { stdout: string; stderr: string }): string => `${r.stdout}\n${r.stderr}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** `.meta` / `.tid` header fields, TW5's `key: value` lines. */
function fieldsOf(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

function laySource(dir: string): void {
  mkdirSync(dir, { recursive: true });
  for (const [name, bytes] of Object.entries(SOURCE)) writeFileSync(join(dir, name), bytes);
}

let lar: LarInstance;
let fork: ForkServer;
let islandDir = "";     // <root>/bags/lares/ha.ka.ba/lares/parity — source AND projection
let serverOut = "";     // <fork root>/out/tiddlers/ha.ka.ba/lares/parity
let serverPaths: Record<string, string> = {};
let islandRepack: { count: number; text: string } = { count: 0, text: "" };

describe.skipIf(gaps.length > 0)("★ NON-MEME PARITY — one file, two doors, one .meta law ★", () => {
  beforeAll(async () => {
    // ── the server door ───────────────────────────────────────────────────────────────────────
    const forkRoot = mkdtempSync(join(stageDir(), "nonmeme-parity-fork-"));
    const wiki = layWikiFolder(forkRoot, {
      "filesystem-paths.tid": `title: $:/config/FileSystemPaths\n\n${LOCI_PATH_RULE}`,
    });
    laySource(join(wiki, "tiddlers", REL_DIR));
    fork = await bootForkServer(forkRoot, wiki);
    const paths = await fork.http("GET", `/recipes/default/tiddlers/${encodeURIComponent("$:/config/OriginalTiddlerPaths")}`);
    serverPaths = JSON.parse((JSON.parse(paths.body) as { text: string }).text) as Record<string, string>;
    await fork.stop();
    // The LEAVE door: every record this witness laid, written back through TW5's own file-info law.
    const out = join(forkRoot, "out");
    const filter = `[prefix[lar:///${REL_DIR}/]] ${PACK_MEMBERS.map((t) => `[[${t}]]`).join(" ")}`;
    runFork(wiki, ["--savewikifolder", out, `filter=${filter}`, "explodePlugins=no"]);
    serverOut = join(out, "tiddlers", REL_DIR);

    // ── the island door ───────────────────────────────────────────────────────────────────────
    lar = await targetInstance();
    islandDir = join(lar.root, "bags/lares", REL_DIR);
    laySource(islandDir);
    const r = await lar.cli(["ingest", "--source", islandDir, "--to", BAG_URI, "--apply", "--yes", "--json"]);
    if (r.json?.["ok"] !== true) throw new Error(`ingest failed: ${said(r)}`);
    // Settle: the projector rewrites the sidecar in TW5's sorted field order once the record lands.
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      const meta = existsSync(join(islandDir, "note.md.meta")) ? readFileSync(join(islandDir, "note.md.meta"), "utf8") : "";
      if (meta && !meta.startsWith("type:")) break;
      await sleep(500);
    }
    await sleep(3_000);
    const repack = await lar.cli(["act", "REPACK", "--source", join(islandDir, "pack.json"), "--from", BAG_URI, "--out", join(lar.root, "repack.json"), "--json"]);
    if (repack.json?.["ok"] === true) {
      islandRepack = { count: Number((repack.json["data"] as Record<string, unknown>)["count"]), text: readFileSync(join(lar.root, "repack.json"), "utf8") };
    } else {
      console.error(`REPACK did not answer: ${said(repack)}`);
    }
  }, 300_000);

  afterAll(async () => {
    if (fork) fork.remove();
    if (lar) await lar.stop();
  });

  test("★ the island WROTE the sidecar back (sorted fields) — the projection is measured, not assumed ★", () => {
    const meta = readFileSync(join(islandDir, "note.md.meta"), "utf8");
    const keys = Object.keys(fieldsOf(meta));
    expect(keys, `the projector never rewrote note.md.meta:\n${meta}`).toEqual([...keys].sort());
    expect(keys[0], "the source laid `type` first").not.toBe("type");
  });

  test("★ note.md: identical bytes on both trees ★", () => {
    expect(readFileSync(join(islandDir, "note.md"))).toEqual(readFileSync(join(serverOut, "note.md")));
    expect(readFileSync(join(islandDir, "note.md"), "utf8")).toBe(SOURCE["note.md"]);
  });

  test("★ note.md.meta: the same FIELDS on both trees — no house stamp reaches disk ★", () => {
    const island = fieldsOf(readFileSync(join(islandDir, "note.md.meta"), "utf8"));
    const server = fieldsOf(readFileSync(join(serverOut, "note.md.meta"), "utf8"));
    expect(island["title"]).toBe(NOTE_URI);
    expect(server["title"]).toBe(NOTE_URI);
    expect(island["tags"]).toBe(server["tags"]);
    expect(Object.keys(island).sort(), "the island's sidecar carries a field the server's does not (a house stamp)").toEqual(Object.keys(server).sort());
  });

  /**
   * RED — held until the Layer-Setter's `action-handler.ts` applies the `.meta` fields OVER the
   * deserialized record. TW5's folder loader merges the sidecar AFTER the deserialize
   * (boot.js:1961 `extend({}, tiddlers[0], metadata)`), so `type: text/markdown` in the sidecar
   * wins; the island seeds the sidecar BEFORE the deserialize (action-handler.ts:870-873) and the
   * `text/plain` deserializer overwrites `type` with the extension's registered type
   * (`text/x-markdown`, boot.js:1736). Same file, two types, one door strayed from TW5's law.
   */
  test("★ the sidecar's `type` wins over the extension's, as TW5's loader rules ★", () => {
    const island = fieldsOf(readFileSync(join(islandDir, "note.md.meta"), "utf8"));
    const server = fieldsOf(readFileSync(join(serverOut, "note.md.meta"), "utf8"));
    expect(server["type"]).toBe("text/markdown");
    expect(island["type"]).toBe(server["type"]);
  });

  /**
   * MEASURED, not cured — where a binary belongs under bags/ reads OPEN (the operator wants
   * talk-story first). The server keeps `photo.png` + `photo.png.meta` whole; the island's ingest
   * moves the bytes to the `cid/` CAS tier and projects a SKINNY HANDLE `photo.tid`
   * (`_canonical_uri` + `_integrity`, no body), then sweeps the `.png` as a straggler.
   */
  test("MEASURED (OPEN): the server keeps photo.png whole; the island projects a skinny handle photo.tid", () => {
    expect(readFileSync(join(serverOut, "photo.png")).equals(PNG_BYTES)).toBe(true);
    expect(fieldsOf(readFileSync(join(serverOut, "photo.png.meta"), "utf8"))["type"]).toBe("image/png");
    const handle = fieldsOf(readFileSync(join(islandDir, "photo.tid"), "utf8"));
    expect(handle["_canonical_uri"]).toMatch(/^lar:\/\/\/ha\.ka\.ba\/cid\//);
    expect(handle["_integrity"]).toMatch(/^ni:\/\/\/sha-256;/);
    expect(existsSync(join(islandDir, "photo.png"))).toBe(false);
  });

  test("the pack: both doors keep the membership aside in $:/config/OriginalTiddlerPaths", () => {
    for (const t of PACK_MEMBERS) expect(serverPaths[t], `server: ${t}`).toMatch(/pack\.json$/);
    expect(islandRepack.count).toBe(PACK_MEMBERS.length);
    const members = (JSON.parse(islandRepack.text) as { title: string }[]).map((m) => m.title).sort();
    expect(members).toEqual([...PACK_MEMBERS].sort());
  });

  /**
   * NAMED DIVERGENCE — the pack leaves by two laws. `--savewikifolder` writes every member as its
   * own `<title>.tid` at the tiddlers root (savewikifolder.js:186-200 runs `generateTiddlerFileInfo`
   * per tiddler; a foreign title has no loci path, so TW5's flattened-title default sites it); the
   * island sites a foreign title nowhere (`bag-paths.ts` `carrierBaseRelPath` → null) and
   * re-renders the pack whole by REPACK (action-handler.ts, the `$:/config/OriginalTiddlerPaths`
   * aside). On purpose: a foreign-titled member owns no file of its own on the island
   * (disk-projection#/projection-routing rule 2).
   */
  test("NAMED: the server explodes the pack into per-member .tid files; the island keeps it packed", () => {
    for (const t of PACK_MEMBERS) {
      expect(existsSync(join(serverOut, "../../..", `${t}.tid`)), `server: tiddlers/${t}.tid`).toBe(true);
      expect(walk(join(lar.root, "bags/lares")).some((f) => f.endsWith(`${t}.tid`)), `island: ${t}.tid must not exist`).toBe(false);
    }
    expect(existsSync(join(islandDir, "pack.json"))).toBe(true);
  });

  test("file-for-file: under the loci path the trees agree, minus the two named divergences", () => {
    const serverFiles = walk(serverOut).map((f) => relative(serverOut, f)).sort();
    const islandFiles = walk(islandDir).map((f) => relative(islandDir, f)).sort();
    expect(serverFiles).toEqual(["note.md", "note.md.meta", "photo.png", "photo.png.meta"]);
    expect(islandFiles).toEqual(["note.md", "note.md.meta", "pack.json", "photo.tid"]);
  });
});
