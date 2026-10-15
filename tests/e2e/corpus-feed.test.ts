/**
 * e2e/corpus-feed — vector 4's staged witness: the WHOLE lares corpus
 * (bags/lares/ha.ka.ba/lares, the hearth's content tree) rides one directory-batch LOAD
 * into a staged vessel, and the disk co-projection writes back carrier-whole.
 *
 * What this soaks (first contact at scale for the 2026-06-11 grain burn):
 *   F1 — the batch LOAD lands (one gesture, one change-id family)
 *   F2 — group routing at scale: one file per carrier root, NO fragment
 *        files, count parity with the distinct lares-bag root URIs
 *   F3 — the boot meme (corpus-canonical) projects byte-exact
 *
 * The live-hearth feed stays the operator's gesture; this vector proves the
 * shape so that gesture carries no surprises.
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { matchCarrierHead } from "../../packages/lararium-memetic-frame/src/head.js";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { execSync } from "node:child_process";
import { targetInstance, type LarInstance } from "../harness/instance.js";
import { memeticWikitextDeserializer, expandMemeRefs } from "../../packages/lararium-tw5/src/deserializer.js";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
// `@` marks a SURFACE (the bag), never a meme namespace — so the content tree inside the bag reads
// bare. `BOOT_PROJ` below already carried that; this constant is the one that needed to follow.
const CORPUS    = join(REPO_ROOT, "bags/lares/ha.ka.ba/lares");
const LARES_URI = "lar:///ha.ka.ba/bags/lares";
const BOOT_REL  = "api/noosphere-boot.mem";
// Projected (staged) siting under the full-path-inside-bag rule:
const BOOT_PROJ = "ha.ka.ba/lares/api/noosphere-boot.mem";
const BOOT_URI  = "lar:///ha.ka.ba/lares/api/noosphere-boot";

/** Canonical render of carrier text through the membrane. */
function renderOf(text: string): string {
  const records = memeticWikitextDeserializer(text, { title: BOOT_URI });
  const map = new Map(records.map((r) => [String(r.title), r] as const));
  return expandMemeRefs((t) => map.get(t), BOOT_URI) ?? "";
}

let lar: LarInstance;
let loadOk = false;
let loadCount = 0;

/** The projector's atomic-write staging name (`disk-projector.ts`): `<file>.lar-tmp-<pid>`, renamed into place. */
const PROJECTOR_TMP = /\.lar-tmp-\d+$/;

/**
 * Every projected file under `dir`, read WHILE the projector writes. The projector stages each file
 * under a `.lar-tmp-` name and renames it into place, so between the listing and the stat an entry can
 * vanish: a vanished entry is a rename, never a fault, and a staging name is never a projected file.
 */
function walkFiles(dir: string): string[] {
  let names: string[];
  try { names = readdirSync(dir); } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const out: string[] = [];
  for (const name of names) {
    if (PROJECTOR_TMP.test(name)) continue;
    const p = join(dir, name);
    let isDir: boolean;
    try { isDir = statSync(p).isDirectory(); } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw err;
    }
    if (isDir) out.push(...walkFiles(p));
    else out.push(p);
  }
  return out;
}

/** Distinct carrier-root URIs in the source corpus that mirror under the lares bag. */
function expectedRoots(): Set<string> {
  // THE CORPUS CARRIES `.mem`. This hunted `*.md` — the extension the carrier convention left behind —
  // so `find` returned nothing, the staged mirror stood empty, and every read below ENOENT'd on a boot
  // meme that was never copied. A zero-length find reads as "no corpus", never as "wrong glob".
  const files = execSync(`find ${CORPUS} -name '*.mem'`, { encoding: "utf8" }).trim().split("\n");
  const roots = new Set<string>();
  for (const f of files) {
    // THE SHORE ANSWERS. A finder with its own spelling of this question matched ONE carrier in 700
    // the day the corpus quoted its control values — and this suite runs under `test:e2e`, which
    // `pnpm -r test` skips by design, so nothing routine would have reported it.
    const uri = matchCarrierHead(readFileSync(f, "utf8"))?.uri;
    if (uri?.startsWith("lar:///ha.ka.ba/lares/")) roots.add(uri);
  }
  return roots;
}

/**
 * Poll the staged mirror until every expected corpus root stands and the file count holds still.
 *
 * ── THE CAP IS A MEASUREMENT, NOT A DEADLINE ────────────────────────────────────────────────────
 * A cap reached reads IDENTICALLY to a projector that sites a carrier nowhere: the caller gets a file
 * list, some expected name is absent, and the assertion names THAT carrier — the first one missing in
 * iteration order — as though a rule had refused it. It had not; the mirror was still being written.
 * So the cap reports its own trajectory: the counts it saw and the seconds between them, which is what
 * separates "still projecting" from "settled without it".
 */
/** What the mirror wait saw: the final listing, and the trajectory an assertion message carries (the CI report keeps no stdout). */
interface MirrorReading { readonly files: string[]; readonly measure: string }

async function awaitStableMirror(root: string, expected: ReadonlySet<string>, capMs = 300_000): Promise<MirrorReading> {
  const mirrorRoot = join(root, "bags/lares");
  const start = Date.now();
  const seconds = (): number => Math.round((Date.now() - start) / 1000);
  let last = -1;
  let stableSince = Date.now();
  let longestPause = 0;
  let pauseRead = "";
  const trail: string[] = [];
  const absentOf = (files: readonly string[]): number => {
    const have = new Set(files.map((f) => "lar:///" + relative(mirrorRoot, f).split(sep).join("/").replace(/\.mem$/, "")));
    let absent = 0;
    for (const uri of expected) if (!have.has(uri)) absent++;
    return absent;
  };
  for (;;) {
    const files = walkFiles(mirrorRoot);
    const n = files.length;
    const absent = absentOf(files);
    if (n !== last) {
      const paused = Date.now() - stableSince;
      if (last > 0 && paused > longestPause) { longestPause = paused; pauseRead = `${Math.round(paused / 1000)}s at ${last} file(s)`; }
      last = n; stableSince = Date.now(); trail.push(`${seconds()}s:${n}`);
    }
    // A QUIET STRETCH IS NOT THE END. The projection pauses while the island does other work, with some
    // files written and others owed; a count that held still for a few seconds read as "settled" there and
    // named the owed carriers as refused. The mirror has settled when every corpus root stands AND the
    // count has held still, so a late straggler still reaches the assertions below.
    if (absent === 0 && Date.now() - stableSince > 4_000) {
      const measure = `mirror settled at ${n} file(s) in ${seconds()}s · longest pause ${pauseRead || "none"} · ${trail.slice(-12).join(" ")}`;
      console.error(`corpus-feed MEASURE ${measure}`);
      return { files: walkFiles(mirrorRoot), measure };
    }
    if (Date.now() - start > capMs) {
      const measure = `mirror NEVER settled — cap ${capMs}ms reached at ${n} file(s), ${absent} corpus root(s) absent · longest pause ${pauseRead || "none"} · ${trail.slice(-16).join(" ")}`;
      console.error(`corpus-feed MEASURE ${measure}`);
      return { files: walkFiles(mirrorRoot), measure };
    }
    await new Promise((r) => setTimeout(r, 1_000));
  }
}

// ── THE BUDGET IS PART OF THE WITNESS ───────────────────────────────────────────────────────────
// This suite feeds the WHOLE corpus through a staged founding, and the corpus grows every week (376
// carriers at this reading). At a 180s hook the founding-plus-LOAD sat exactly ON the edge: it landed
// on a quiet machine and timed out beside any other suite, and a timed-out hook SKIPS all four vectors
// rather than failing one — so the suite reported nothing at all, in either direction. The budget is
// generous on purpose; a corpus-scale witness that must be run alone at a stopwatch is no witness.
beforeAll(async () => {
  lar = await targetInstance();
  if (lar.mode !== "staged") return;        // mutating, corpus-scale — staged only
  const at = Date.now();
  const r = await lar.cli(["act", "LOAD", "--source-uri", CORPUS, "--to", LARES_URI, "--yes", "--json"]);
  loadOk = r.json?.["ok"] === true;
  loadCount = Number((r.json?.["data"] as { count?: number } | undefined)?.count ?? 0);
  // NAME WHAT IT SAID. A bare count reads as "the corpus grew past the budget" whichever way the door
  // answered, and those are different faults with different cures.
  console.error(`corpus-feed MEASURE the LOAD landed ${loadCount} record(s) in ${Math.round((Date.now() - at) / 1000)}s · code ${r.code} · ${`${r.stdout}\n${r.stderr}`.trim().slice(-600)}`);
}, 600_000);
afterAll(async () => { await lar.stop(); });

describe("corpus feed — the whole hearth in one gesture (staged witness)", () => {
  test("F1 — the directory-batch LOAD lands", () => {
    if (lar.mode !== "staged") return;
    expect(loadOk).toBe(true);
    expect(loadCount).toBeGreaterThan(189);   // records ≥ carriers (children ride along)
  });

  test("F2 — group routing at scale: one file per carrier root, no fragments", async () => {
    if (lar.mode !== "staged") return;
    const roots = expectedRoots();
    const { files, measure } = await awaitStableMirror(lar.root, roots);
    // The projector's own diagnostic: each window of a second or longer between the last change event and
    // the first file write after it, with the `bagsHolding` lookups made inside it. A reading, no assertion.
    const projectorWindows = lar.bootLog().split("\n").filter((line) => line.includes("[disk-projector] MEASURE")).map((line) => line.slice(line.indexOf("MEASURE") + 8).trim());
    console.error(`corpus-feed MEASURE projector windows (${projectorWindows.length}): ${projectorWindows.slice(-6).join(" | ") || "none of a second or longer"}`);
    expect(files.filter((f) => f.includes("#") || /%23/.test(f))).toEqual([]);
    // Full-path-inside-bag ruling: the mirror carries EVERY name the bag
    // holds (lawful residents outside the corpus namespace included), so the
    // law reads as membership: every corpus root projects to exactly one
    // file at its full-name path; fragments never surface.
    const mirrorRoot = join(lar.root, "bags/lares");
    const fileUris = new Set(files.map((f) =>
      "lar:///" + relative(mirrorRoot, f).split(sep).join("/").replace(/\.mem$/, ""),
    ));
    // NAME THE WHOLE ABSENCE, never the first one. A per-root assertion stops at the first missing name
    // and reads as "the projector refuses THIS carrier" — the shape that sent a hand hunting one carrier's
    // meta when 40 names were absent and the mirror was simply still being written. The message carries
    // the wait's own trajectory and the daemon's last words, so a red names where the projection stood.
    const absent = [...roots].filter((r) => !fileUris.has(r));
    expect(
      absent,
      absent.length === 0 ? "" : `${absent.length} of ${roots.size} corpus root(s) never projected — first 8: ${absent.slice(0, 8).join(" · ")} · ${measure} · DAEMON LOG TAIL ${lar.bootLog().slice(-2500)}`,
    ).toEqual([]);
    expect(fileUris.size).toBe(files.length);   // one file, one name — no aliasing
  }, 360_000);

  test("F3 — the boot meme projects content-whole (iam framing normalizes once)", async () => {
    if (lar.mode !== "staged") return;
    const projected = join(lar.root, "bags/lares", BOOT_PROJ);
    expect(existsSync(projected)).toBe(true);
    const metaFence = /```toml meta\n[\s\S]*?```\n/g;
    const contentView = (s: string) => s.replace(metaFence, "```toml meta\n<normalized>\n```\n");
    expect(contentView(readFileSync(projected, "utf8")))
      // The law: projected == render(parse(source)) — robust to a source
      // file mid-edit under the other hand (tests witness laws, not WIP).
      .toBe(contentView(renderOf(readFileSync(join(CORPUS, BOOT_REL), "utf8"))));
  });

  test("F4 — pipeline idempotence: re-feeding a projection leaves it byte-stable", async () => {
    if (lar.mode !== "staged") return;
    const projected = join(lar.root, "bags/lares", BOOT_PROJ);
    const before = readFileSync(projected, "utf8");
    const r = await lar.cli(["act", "LOAD", "--source-uri", projected, "--to", LARES_URI, "--yes", "--json"]);
    let late = "";
    if (r.json?.["ok"] !== true) {
      // A verb that answered `outcome-unknown` may still be running: read its receipt once more after a
      // pause, so a slow landing and a never-landing read apart.
      const rid = String(r.json?.["requestId"] ?? "");
      await new Promise((res) => setTimeout(res, 30_000));
      const rr = await lar.cli(["receipt", rid, "--json"]);
      late = ` · LATE receipt code ${rr.code} ${`${rr.stdout}\n${rr.stderr}`.trim().slice(-700)} · DAEMON LOG TAIL ${lar.bootLog().slice(-3000)}`;
    }
    // NAME WHAT IT SAID: the CI report keeps no stdout, so the answer rides in the assertion message.
    expect(
      r.json?.["ok"],
      `re-feed LOAD answered code ${r.code} · json ${JSON.stringify(r.json ?? null).slice(0, 800)} · stderr ${String(r.stderr ?? "").trim().slice(-600)} · stdout ${String(r.stdout ?? "").trim().slice(-600)}${late}`,
    ).toBe(true);
    // allow a flush wave, then assert the canonical form held still
    await new Promise((res) => setTimeout(res, 8_000));
    expect(readFileSync(projected, "utf8")).toBe(before);
  }, 120_000);
});
