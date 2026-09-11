/**
 * e2e/meme-live-contact — `lares meme` over ONE vessel's own rendezvous, every seat of the family.
 *
 * `bag-is-user-space` and `place-meme` read the placement law in one process over a memory store. This
 * witness reads the same law where an operator's hands reach it: a fresh root founded by the CLI, its
 * daemon bound to a socket derived from that root, and the built `lares` binary driven against it.
 *
 *   get (absent)         → not-found, nothing lands
 *   put --bag lares      → refuses: a placement never shadows up (CONTROL)
 *   put (framed)         → ingest; the root and `#/a` landed
 *   get                  → the same bytes back, with the canonical hash as `base`
 *   put --base (fresh)   → ingest; the dropped slot tombstoned
 *   put --base (stale)   → conflict; nothing moves  (the CONTROL — a door only shown saying yes is no door)
 *   project --to md      → the submission pair beside `--out`
 *   project --to mem     → the canonical carrier, byte-equal to `get`
 *   project --to html    → RED CONTRACT: the core static template reaches `window` inside the island VM
 *
 * SKIPS LOUDLY: a witness that cannot spawn its vessel names what is missing on stderr and skips. It
 * never passes on silence. Staged only — a live hearth is never written to by a test.
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { targetInstance, awaitRendezvous, type LarInstance } from "../harness/instance.js";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const CLI_BIN   = join(REPO_ROOT, "packages/lares-cli/dist/src/bin/lares.js");
const NODE_MAIN = join(REPO_ROOT, "packages/lararium-node/dist/src/main.js");

/**
 * THE CONTAINER EVERY CALL NAMES: an edit AS the hearth's own wiki. Its recipe designates the `lares`
 * bag, which the island reaches by access across the registry planes. Measured on a fresh vessel:
 *   · `--recipe lares`  reaches the placement law (this seat)
 *   · `--bag daemon`    reaches it too — the daemon bag is a mounted writable layer
 *   · `--bag lares`     refuses — the bag holds no writable layer here and a placement never shadows up
 *   · no container      the ANCHOR resolves to `lar:///ha.ka.ba/wikis/daemon/temp`, which the cap gate
 *                       holds no registration for, so every anchor call refuses `cap-denied` before
 *                       the placement law is reached; `--to html` renders from the anchor alone
 * The two red-contract vectors below hold the anchor's gap: they flip loud the day it closes.
 */
const WIKI = ["--recipe", "lares"] as const;

const PATH = "t/witness/npc";
const URI  = `lar:///${PATH}`;

/** A framed witness meme whose body holds the named ahu slots. */
const meme = (slots: readonly string[]): string =>
  `<<^ code="&#x0001;" from=? -> to=${URI}>>\n\`\`\`toml meta\nuri-path = "${PATH}"\n\`\`\`\n\n` +
  `<<^ code="&#x0002;">>\n\n` +
  slots.map((s) => `<<~ ahu #/${s}>>\n\n! ${s}\n\n<<~/ahu>>\n`).join("\n") +
  `\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to=?>>\n`;

/** What the witness needs before it can stand a vessel; empty when everything is in place. */
function missing(): string[] {
  const out: string[] = [];
  if (!existsSync(CLI_BIN))   out.push(`built CLI at ${CLI_BIN} (pnpm --filter @lares/cli build)`);
  if (!existsSync(NODE_MAIN)) out.push(`built node vessel at ${NODE_MAIN} (pnpm --filter @lararium/node build)`);
  if (process.env["LAR_TARGET"] === "live") out.push("a STAGED target — this witness writes, and never writes to a live hearth");
  return out;
}

/** What a call answered, both streams — `--json` carries the refusal on stdout. */
const said = (r: { stdout: string; stderr: string }): string => `${r.stdout}\n${r.stderr}`;

const gaps = missing();
if (gaps.length > 0) console.error(`meme-live-contact: SKIPPED — missing ${gaps.join("; ")}`);

let lar: LarInstance;
let scratch = "";

describe.skipIf(gaps.length > 0)("★ lares meme over a live rendezvous ★", () => {
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

  test("★ the ANCHOR seat (no container) reaches the placement law — its cap seat is the bag the cascade lands in ★", async () => {
    const r = await lar.cli(["meme", "get", URI, "--json"]);
    expect((r.json?.["error"] as Record<string, unknown>)?.["code"], said(r)).not.toBe("cap-denied");
  });

  test("CONTROL: `--bag lares` refuses a put — the bag holds no writable layer and a placement never shadows up", async () => {
    const r = await lar.cli(["meme", "put", URI, "--bag", "lares", "--file", join(scratch, "ab.mem"), "--json"]);
    expect(r.json?.["ok"]).toBe(false);
    expect((r.json?.["error"] as Record<string, unknown>)?.["message"], said(r)).toMatch(/holds no writable layer/);
    expect(r.code).toBe(4);
  });

  test("get of an absent meme → not-found", async () => {
    const r = await lar.cli(["meme", "get", URI, ...WIKI, "--json"]);
    expect(r.json?.["ok"]).toBe(false);
    expect((r.json?.["error"] as Record<string, unknown>)?.["code"], said(r)).toBe("not-found");
    expect(r.code).toBe(3);
  });

  test("put of a framed meme → ingest; the root and `#/a` landed", async () => {
    const r = await lar.cli(["meme", "put", URI, ...WIKI, "--file", join(scratch, "ab.mem"), "--json"]);
    expect(r.json?.["ok"], said(r)).toBe(true);
    const d = r.json?.["data"] as Record<string, unknown>;
    expect(d["decision"]).toBe("ingest");
    expect((d["landed"] as string[]).sort()).toEqual([URI, `${URI}#/a`, `${URI}#/b`]);
    expect(d["tombstoned"]).toEqual([]);
    expect(typeof d["canonicalHash"]).toBe("string");
  });

  test("get → the same bytes back, with the canonical hash", async () => {
    const r = await lar.cli(["meme", "get", URI, ...WIKI, "--json"]);
    expect(r.json?.["ok"], said(r)).toBe(true);
    const d = r.json?.["data"] as Record<string, unknown>;
    const text = String(d["text"]);
    // The read hands back the CANONICAL carrier: the framing normalized, the block check stamped, the
    // body whole. Framed as sent, the two slots and the address read back verbatim.
    expect(text).toContain(`uri-path = "${PATH}"`);
    expect(text).toContain("<<~ ahu #/a>>\n\n! a\n\n<<~/ahu>>");
    expect(text).toContain("<<~ ahu #/b>>\n\n! b\n\n<<~/ahu>>");
    base = String(d["canonicalHash"]);
    // The base IS the digest of the bytes handed back — collided here, never assumed.
    expect(base).toBe(`sha256:${createHash("sha256").update(text).digest("hex")}`);
    // The prose seat writes the text alone to stdout, so `lares meme get <uri> > file` carries the meme;
    // a pipe implies `--json`, so the prose seat is asked for by name.
    const human = await lar.cli(["meme", "get", URI, ...WIKI, "--no-json"]);
    expect(human.stdout).toBe(text);
    expect(human.stderr).toContain(`base: ${base}`);
  });

  test("put --base (fresh) with a changed slot → ingest; `#/b` tombstoned, `#/c` born", async () => {
    const r = await lar.cli(["meme", "put", URI, ...WIKI, "--base", base, "--file", join(scratch, "ac.mem"), "--json"]);
    expect(r.json?.["ok"], said(r)).toBe(true);
    const d = r.json?.["data"] as Record<string, unknown>;
    expect(d["decision"]).toBe("ingest");
    expect(d["tombstoned"]).toEqual([`${URI}#/b`]);
    expect(d["landed"]).toContain(`${URI}#/c`);
    expect(d["canonicalHash"]).not.toBe(base);
  });

  test("CONTROL: put --base (stale) → conflict; nothing moves", async () => {
    const before = await lar.cli(["meme", "get", URI, ...WIKI, "--json"]);
    const r = await lar.cli(["meme", "put", URI, ...WIKI, "--base", base, "--file", join(scratch, "ab.mem"), "--json"]);
    expect(r.json?.["ok"]).toBe(false);
    expect((r.json?.["error"] as Record<string, unknown>)?.["code"]).toBe("conflict");
    expect(r.code).toBe(4);
    const after = await lar.cli(["meme", "get", URI, ...WIKI, "--json"]);
    const afterText = String((after.json?.["data"] as Record<string, unknown>)["text"]);
    expect(afterText).toBe(String((before.json?.["data"] as Record<string, unknown>)["text"]));
    expect(afterText).toContain("<<~ ahu #/c>>");
    expect(afterText).not.toContain("<<~ ahu #/b>>");
  });

  test("project --to md → text + a `.meta` beside --out", async () => {
    const out = join(scratch, "npc.md");
    const r = await lar.cli(["meme", "project", URI, ...WIKI, "--to", "md", "--out", out, "--json"]);
    expect(r.json?.["ok"], said(r)).toBe(true);
    expect(existsSync(out)).toBe(true);
    expect(existsSync(`${out}.meta`)).toBe(true);
    const md = readFileSync(out, "utf8");
    expect(md.length).toBeGreaterThan(0);
    expect(md).toContain("a");
    const meta = readFileSync(`${out}.meta`, "utf8");
    expect(meta).toContain(PATH);
  });

  test("project --to mem → the canonical carrier, byte-equal to `get`", async () => {
    const r = await lar.cli(["meme", "project", URI, ...WIKI, "--to", "mem", "--no-json"]);
    expect(r.code, said(r)).toBe(0);
    const got = await lar.cli(["meme", "get", URI, ...WIKI, "--no-json"]);
    expect(r.stdout).toBe(got.stdout);
  });

  test.fails("RED CONTRACT: project --to html from the anchor — TW5's static.tiddler.html template reaches `window` inside the island VM (renders on a plain server; needs a fake-DOM-safe house template in the island)", async () => {
    // html renders from the anchor alone, so the meme lands there first — the anchor's own put.
    const put = await lar.cli(["meme", "put", URI, "--file", join(scratch, "ab.mem"), "--json"]);
    expect(put.code, said(put)).toBe(0);
    const r = await lar.cli(["meme", "project", URI, "--to", "html", "--no-json"]);
    expect(r.code, said(r)).toBe(0);
    expect(r.stdout.trimStart().toLowerCase().startsWith("<!doctype html")).toBe(true);
  });
});
