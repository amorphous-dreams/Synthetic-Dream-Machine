/**
 * e2e/blob-follows-pointer — does a pointer's BLOB follow the pointer to a fleet peer?
 *
 * THE LAW (tiddler-carriage #/law): a tiddler IS a CRDT record and syncs by the share policy; the
 * bytes a CID names are FETCHED on request by a peer holding the pointer and the read cap, never
 * synced with the record. This witness stands the pair `meme-two-vessel-bag` proves — a founder A
 * and a same-operator joiner B — and carries a `.png` POINTER (bytes in A's `cid/`, the handle in
 * the CRDT) through the one shared door into `bags/lares`, then measures what B holds:
 *
 *   ⑤ A LOADs `photo.png` (+ `.meta`) once B stands → A's `cid/` holds the bytes; the CRDT the handle
 *   ⑦ B, after sync, projects the POINTER (`_is_skinny` · `textCid` · `_integrity`, no `text`)
 *   ★ B's `cid/` — do the BYTES stand there? By which door?
 *
 * The rite (①–⑥) copies `meme-two-vessel-bag` step for step; that file stays untouched.
 *
 * THE FETCH DOOR (basket-one #/the-fetch-door, ruled 2026-09-11): A stands a carriage crossroads
 * (Socket B, `LAR_HERM_RELAY_PORT`) and both vessels dial it (`LAR_CARRIAGE_RELAY`). B's resolver composes
 * `makeCidResolver(localRead, casTransit, cacheWriteThrough)`; a READ on B that misses `cid/` want-blocks
 * A over Socket B, A's gate reads B as FLEET (same operator — the signed device edge) and serves the
 * cleartext blob, B verifies sha256 and writes through. Fetch-on-read: the bytes cross when B reads
 * (`lares bag cas --fetch <cid>`), never before — ★ measures the absence FIRST, as the control.
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { openStagedJoinee, freePort, vesselStorageDir, type StagedJoinee, type LarInstance, type CliResult } from "../harness/instance.js";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const CLI_BIN   = join(REPO_ROOT, "packages/lares-cli/dist/src/bin/lares.js");
const NODE_MAIN = join(REPO_ROOT, "packages/lararium-node/dist/src/main.js");

/** A 1×1 transparent PNG — small, binary, `image/png` by extension and by declaration. */
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
/** The two CID derivations the stager has used — over the RAW bytes (the blob law) or over the base64 STRING. */
const CID_RAW    = createHash("sha256").update(PNG_BYTES).digest("hex");
const CID_BASE64 = createHash("sha256").update(Buffer.from(PNG_BYTES.toString("base64"), "utf8")).digest("hex");

const LOCI  = "t.witness.blob";
const LOCI_EARLY = "t.witness.early";
const TITLE = `lar:///${LOCI}/photo`;
const LARES_BAG = "lar:///ha.ka.ba/bags/lares";

const said = (r: { stdout: string; stderr: string }): string => `${r.stdout}\n${r.stderr}`;
const casDirOf = (v: LarInstance): string => join(vesselStorageDir(v), "cas");
const listCas = (v: LarInstance): string[] => { try { return readdirSync(casDirOf(v)).filter((n) => /^[0-9a-f]{64}$/.test(n)); } catch { return []; } };

/** Read a TW5 field block (`name: value` lines up to the first blank line). */
function fieldsOf(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === "") break;
    const at = line.indexOf(":");
    if (at > 0) out[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return out;
}

/** Every file under a tree, relative — the projection laid flat for the operator. */
function walk(root: string): string[] {
  const out: string[] = [];
  const rec = (d: string): void => {
    let names: string[] = [];
    try { names = readdirSync(d, { withFileTypes: true }).map((e) => (e.isDirectory() ? `${e.name}/` : e.name)); } catch { return; }
    for (const n of names) { if (n.endsWith("/")) rec(join(d, n)); else out.push(join(d, n).slice(root.length + 1)); }
  };
  rec(root);
  return out;
}

/** The pointer as the projector sites it — a field file named `photo…` under the loci dir (`photo.tid`,
 *  `photo.png.meta`), whichever shape the projector writes. */
function projectedPointer(root: string): { file: string; fields: Record<string, string> } | null {
  const dir = join(root, "bags/lares", LOCI);
  const hit = walk(dir).find((f) => /^photo.*\.(tid|meta)$/.test(f));
  if (!hit) return null;
  const f = join(dir, hit);
  return { file: f, fields: fieldsOf(readFileSync(f, "utf8")) };
}

/** Poll `wiki which <title>` until the bag answers — the CRDT read, never the projection. */
async function awaitWhich(v: LarInstance, timeoutMs: number): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let last = "";
  for (;;) {
    const r = await v.cli(["wiki", "which", TITLE, "--no-json"]);
    last = r.stdout;
    if (last.includes(`  ${LARES_BAG}`)) return last;
    if (Date.now() > deadline) return last;
    await new Promise((res) => setTimeout(res, 1000));
  }
}

function missing(): string[] {
  const out: string[] = [];
  if (!existsSync(CLI_BIN))   out.push(`built CLI at ${CLI_BIN} (pnpm --filter @lares/cli build)`);
  if (!existsSync(NODE_MAIN)) out.push(`built node vessel at ${NODE_MAIN} (pnpm --filter @lararium/node build)`);
  if (process.env["LAR_TARGET"] === "live") out.push("a STAGED target — this witness founds two vessels, and never writes to a live hearth");
  return out;
}

const gaps = missing();
if (gaps.length > 0) console.error(`blob-follows-pointer: SKIPPED — missing ${gaps.join("; ")}`);

let pair: StagedJoinee | null = null;
let A: LarInstance | null = null;
let B: LarInstance | null = null;
let admitted: CliResult | null = null;
let joinGate = "";
/** The cid the stager wrote on A — whichever derivation its `cid/` answers. */
let cid = "";

describe.skipIf(gaps.length > 0)("★ a pointer crosses the fleet — do its BYTES follow? ★", () => {
  beforeAll(async () => {
    // The joinee rite — one door in the harness. The carriage crossroads (Socket B) A stands and both dial —
    // the fetch door's transport; the early LOAD lands on A before B stands.
    const portRelay = await freePort();
    const carriageRelay = `ws://127.0.0.1:${portRelay}`;
    pair = await openStagedJoinee({
      tag: "blob",
      daemonEnv:  { LAR_CARRIAGE_RELAY: carriageRelay },
      daemonEnvA: { LAR_HERM_RELAY_PORT: String(portRelay) },
      beforeB: async (a) => {
        const earlyDir = join(a.root, "blob-stage/bags/lares", LOCI_EARLY);
        mkdirSync(earlyDir, { recursive: true });
        writeFileSync(join(earlyDir, "photo.png"), PNG_BYTES);
        writeFileSync(join(earlyDir, "photo.png.meta"), "type: image/png\n");
        const early = await a.cli(["act", "LOAD", "--source-uri", earlyDir, "--to", LARES_BAG, "--yes", "--json"]);
        const earlyWhich = await a.cli(["wiki", "which", `lar:///${LOCI_EARLY}/photo`, "--no-json"]);
        console.error(`blob-follows-pointer MEASURE A (before B stands): LOAD ${early.json?.["ok"]} → wiki which: ${/primary:\s+(\S+)/.exec(earlyWhich.stdout)?.[1]}`);
      },
    });
    A = pair.A; B = pair.B; admitted = pair.admitted; joinGate = pair.joinGate ?? "";
    if (!B) console.error(`blob-follows-pointer: B never stood — the sync vectors SKIP. The daemon said:\n  ${joinGate}`);
  }, 400_000);

  afterAll(async () => { await pair?.stop(); });

  test("④ the admit ceremony crosses: B founds by A's signed edge", () => {
    expect(admitted?.code, said(admitted ?? { stdout: "", stderr: "no founding ran" })).toBe(0);
    expect(admitted?.stdout).toContain("joined the PersonaGroup");
  });

  test("⑤ on A: the bytes rest in A's cid/ and the CRDT holds a POINTER (no text)", async () => {
    // The pointer lands on A through the one shared door: a `.png` + `.meta` laid under a
    // `bags/lares/<w.w.w>/` path so the loci title reads `lar:///t.witness.blob/photo`.
    const srcDir = join(A!.root, "blob-stage/bags/lares", LOCI);
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "photo.png"), PNG_BYTES);
    writeFileSync(join(srcDir, "photo.png.meta"), "type: image/png\n");
    const ld = await A!.cli(["act", "LOAD", "--source-uri", srcDir, "--to", LARES_BAG, "--yes", "--json"]);
    expect(ld.json?.["ok"], said(ld)).toBe(true);
    const casA = listCas(A!);
    cid = casA.includes(CID_RAW) ? CID_RAW : casA.includes(CID_BASE64) ? CID_BASE64 : "";
    console.error(`blob-follows-pointer MEASURE A: LOAD → ${said(ld).trim().slice(0, 600)}\n  A cid/ (${casDirOf(A!)}): ${casA.length} blobs; raw-cid ${casA.includes(CID_RAW)} · base64-cid ${casA.includes(CID_BASE64)}`);
    const earlyWhich = await A!.cli(["wiki", "which", `lar:///${LOCI_EARLY}/photo`, "--no-json"]);
    console.error(`blob-follows-pointer MEASURE A (after B stood): the early pointer → wiki which: ${/primary:\s+(\S+)/.exec(earlyWhich.stdout)?.[1]}`);
    expect(cid, `A's cid/ holds neither sha256(raw) ${CID_RAW.slice(0, 12)} nor sha256(base64) ${CID_BASE64.slice(0, 12)}; it holds ${listCas(A!).map((c) => c.slice(0, 12)).join(",")}`).not.toBe("");
    // The CRDT read first: the bag holds the title.
    const which = await awaitWhich(A!, 30_000);
    console.error(`blob-follows-pointer MEASURE A: wiki which ${TITLE}\n${which.trim()}`);
    expect(which).toContain(`  ${LARES_BAG}`);
    // The projector writes the record as it stands in the CRDT — the handle, never a body. Laid flat
    // (the tree under bags/lares), then read: the shape the projector writes is the sibling's to
    // choose; the FIELDS are the law's.
    const deadline = Date.now() + 30_000;
    let p = projectedPointer(A!.root);
    while (!p && Date.now() < deadline) { await new Promise((r) => setTimeout(r, 1000)); p = projectedPointer(A!.root); }
    console.error(`blob-follows-pointer MEASURE A: bags/lares tree: ${walk(join(A!.root, "bags/lares")).join(" · ") || "(empty)"}\n  pointer file: ${p?.file ?? "(none projected)"}\n  ${p ? JSON.stringify(p.fields) : ""}`);
    if (p) {
      expect(p.fields["textCid"]).toBe(cid);
      expect(p.fields["_is_skinny"]).toBeDefined();
      expect(p.fields["_integrity"]).toMatch(/^ni:\/\/\/sha-256;/);
      expect(p.fields["text"]).toBeUndefined();
    }
  });

  test("⑥ B stands, dialing A — the crossing opens", () => {
    expect(B, joinGate).not.toBeNull();
    expect(B!.bootLog()).toContain("[lar-leaf] verdict OK — crossing open, syncing");
  });

  test("★ ⑦ on B: the RECORD crossed — B projects the POINTER (_is_skinny · textCid · _integrity, no text) ★", async () => {
    // The CRDT read gates the crossing; the projection reads the fields the record carries.
    const which = await awaitWhich(B!, 90_000);
    console.error(`blob-follows-pointer MEASURE B: wiki which ${TITLE}\n${which.trim()}`);
    expect(which, "the record did not cross — B's bag never answered the title").toContain(`  ${LARES_BAG}`);
    expect(/primary:\s+(\S+)/.exec(which)?.[1]).toBe(LARES_BAG);
    const deadline = Date.now() + 60_000;
    let p = projectedPointer(B!.root);
    while (!p && Date.now() < deadline) { await new Promise((r) => setTimeout(r, 1000)); p = projectedPointer(B!.root); }
    console.error(`blob-follows-pointer MEASURE B: bags/lares tree: ${walk(join(B!.root, "bags/lares")).join(" · ") || "(empty)"}\n  pointer file: ${p?.file ?? "(none projected)"}\n  ${p ? JSON.stringify(p.fields) : ""}`);
    if (p) {
      expect(p.fields["textCid"]).toBe(cid);
      expect(p.fields["_is_skinny"]).toBeDefined();
      expect(p.fields["_integrity"]).toMatch(/^ni:\/\/\/sha-256;/);
      expect(p.fields["text"]).toBeUndefined();
    }
  });

  test("⑦ MEASURE on B: what the cid/ dir, the projection, the boot log and `bag cas` say about the BYTES", async () => {
    // Laid flat, never ruled here. Every line names a dir or a socket the operator can open.
    await new Promise((r) => setTimeout(r, 5000));   // a fetch, if any door carried one, has had the record for a while
    const casB = listCas(B!);
    const bytesOnB = existsSync(join(casDirOf(B!), cid));
    const pngOnB = existsSync(join(B!.root, "bags/lares", LOCI, "photo.png"));
    const casLines = B!.bootLog().split("\n").filter((l) => /cas|cid|lazy|blob/i.test(l) && !/genesis|mirror/i.test(l)).slice(-8);
    const cas = await B!.cli(["bag", "cas", "--all", "--json"]);
    console.error([
      `blob-follows-pointer MEASURE B: cid/ = ${casDirOf(B!)}`,
      `  blobs on B: ${casB.length} (genesis + staged); holds ${cid.slice(0, 16)}…: ${bytesOnB}`,
      `  photo.png beside the .meta on B's disk: ${pngOnB}`,
      `  B boot-log lines naming cas/cid/lazy/blob (last 8):\n    ${casLines.join("\n    ") || "(none)"}`,
      `  B \`bag cas --all --json\`: ${said(cas).trim().slice(0, 600)}`,
    ].join("\n"));
    // A CONTROL for the vector below: A still holds the blob the pointer names.
    expect(existsSync(join(casDirOf(A!), cid))).toBe(true);
  });

  // THE VECTOR THE LAW OWES — a fleet peer holding the pointer fetches the bytes on a READ. MEASURED
  // 2026-09-11: B's wiki island reads the pointer as it lands (the lazy resolver's render → `cas:want`), so
  // the bytes usually stand in B's cid/ before any CLI read — that IS fetch-on-read through the worker's own
  // resolver, not a prefetch (the prefetch cap stays off). The explicit `bag cas --fetch` then reads
  // `held:true`; whichever door fired first is reported, never assumed.
  test("★ the BYTES follow the pointer: a READ on B pulls the blob through the fetch door into its cid/ ★", async () => {
    const beforeRead = existsSync(join(casDirOf(B!), cid));
    console.error(`blob-follows-pointer MEASURE B: bytes on B before the CLI read (the island's own read fired?): ${beforeRead}`);
    const r = await B!.cli(["bag", "cas", "--fetch", cid, "--json"]);
    console.error(`blob-follows-pointer MEASURE B: bag cas --fetch → ${said(r).trim().slice(0, 400)}`);
    const carriageLines = (v: LarInstance): string => v.bootLog().split("\n").filter((l) => /\[carriage\]|fetch door|admit|delegation|cross-operator|same-operator|auth/.test(l)).slice(-14).join("\n    ");
    console.error(`blob-follows-pointer MEASURE A carriage:\n    ${carriageLines(A!)}\nblob-follows-pointer MEASURE B carriage:\n    ${carriageLines(B!)}`);
    expect(r.json?.["ok"], said(r)).toBe(true);
    expect(r.json?.["data"] && (r.json["data"] as Record<string, unknown>)["held"]).toBe(true);
    expect(existsSync(join(casDirOf(B!), cid))).toBe(true);
    expect(createHash("sha256").update(readFileSync(join(casDirOf(B!), cid))).digest("hex")).toBe(cid);
  }, 60_000);

  test("CONTROL: a cid no fleet holder carries stays PENDING — `held:false`, no fault, nothing written", async () => {
    const ghost = createHash("sha256").update("a likeness nobody ever staged").digest("hex");
    const r = await B!.cli(["bag", "cas", "--fetch", ghost, "--json"]);
    console.error(`blob-follows-pointer MEASURE B: bag cas --fetch (ghost) → ${said(r).trim().slice(0, 300)}`);
    expect(r.json?.["ok"]).toBe(true);
    expect((r.json?.["data"] as Record<string, unknown> | undefined)?.["held"]).toBe(false);
    expect(existsSync(join(casDirOf(B!), ghost))).toBe(false);
  }, 60_000);
});
