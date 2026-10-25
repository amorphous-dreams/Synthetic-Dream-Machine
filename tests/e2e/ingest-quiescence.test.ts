/**
 * ingest-quiescence.test.ts — NEXT VECTOR build 3: the composed loop's
 * quiescence vectors (§6 CI law: an echo storm = a one-line test failure).
 *
 *   Q1 — project∘ingest = identity: a settled mirror scans all-unchanged
 *   Q2 — one-cycle convergence: a disk content edit ingests, re-projects
 *        canonical, and the NEXT scan reads unchanged (the gofmt-loop guard)
 *   Q3 — quiescence: zero writes after round N — the settled file's bytes
 *        hold once the island looked at the disk and drained its queue
 *   Q4 — the NFC membrane assertion: non-NFC bytes refuse loudly at the
 *        gesture, never entering the merge seat
 *
 * Staged-only (mutating). Rides the live CLI: feed one boot meme, then
 * drive `lares ingest` against the vessel's own mirror.
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { targetInstance, type LarInstance } from "../harness/instance.js";
import { promoteLoadedTitles } from "../harness/promote.js";
import { projectionDrained, settleWordOver } from "../harness/settle-word.js";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const BOOT_MEME = join(REPO_ROOT, "bags/lares/ha.ka.ba/lares/api/noosphere-boot.mem");
const BOOT_PROJ = "bags/lares/ha.ka.ba/lares/api/noosphere-boot.mem";
const LARES_URI = "lar:///ha.ka.ba/bags/lares";

let lar: LarInstance;
let projected = "";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function awaitProjection(timeoutMs = 60_000): Promise<void> {
  const start = Date.now();
  while (!existsSync(projected)) {
    if (Date.now() - start > timeoutMs) throw new Error("projection never landed");
    await sleep(500);
  }
}

function ingest(args: string[]): ReturnType<LarInstance["cli"]> {
  return lar.cli(["ingest", "--source", join(lar.root, "bags/lares"), "--to", LARES_URI, ...args, "--json"]);
}

beforeAll(async () => {
  lar = await targetInstance();
  if (lar.mode !== "staged") return;
  projected = join(lar.root, BOOT_PROJ);
  const r = await lar.cli(["act", "LOAD", "--source-uri", BOOT_MEME, "--to", "lar:///ha.ka.ba/wikis/lares/working", "--yes", "--json"]);
  if (r.json?.["ok"] !== true) throw new Error(`seed LOAD failed: ${JSON.stringify(r.json)}`);
  await promoteLoadedTitles(lar, ((r.json["data"] as { titles?: string[] }).titles ?? []), "lares");
  await awaitProjection();
  // The file stands; the island looks at the disk and drains its queue before any scan reads it.
  await projectionDrained(lar);
}, 120_000);
afterAll(async () => { await lar.stop(); });

describe("ingest quiescence — the composed loop holds still", () => {
  test("Q1 — project∘ingest = identity: the settled mirror scans all-unchanged", async () => {
    if (lar.mode !== "staged") return;
    const r = await ingest([]);
    const d = r.json?.["data"] as Record<string, unknown>;
    expect(d["changed"]).toBe(0);
    expect(d["new"]).toBe(0);
    expect(d["unchanged"]).toBe(1);
  }, 60_000);

  test("Q2 — a disk content edit converges in ONE cycle", async () => {
    if (lar.mode !== "staged") return;
    const before = readFileSync(projected, "utf8");
    // THE PROJECTION SPEAKS MEMETIC-WIKITEXT, never the carrier's source dialect. A markdown `#` heading
    // round-trips to `!`, and `#` at line start means an ORDERED LIST ITEM here — so hunting `# ` on this
    // file silently edits the wrong construct. Bind to the first `!` heading, whatever its prose says:
    // the wording belongs to the operator, the syntax to the canonical form.
    const edited = before.replace(/^(!\s+\S.*)$/m, "$1 (quiescence-edit)");
    expect(edited).not.toBe(before); // guard: a carrier with no heading fails loud, never a no-op edit
    writeFileSync(projected, edited);

    const r = await ingest(["--apply", "--yes"]);
    const d = r.json?.["data"] as Record<string, unknown>;
    const carriers = d["carriers"] as Array<Record<string, unknown>>;
    expect(carriers?.[0]?.["decision"]).toBe("ingest");

    // The projection wave re-renders the carrier canonical, edit preserved. THE SETTLE WORD: the apply
    // answers once that projection has run, so the file reads as it leaves it. No nap, no quiet-window poll.
    settleWordOver(r, { settledCount: 1 });
    const settled = readFileSync(projected, "utf8");
    expect(settled).toContain("(quiescence-edit)");

    // ONE cycle: the next scan reads the mirror as unchanged.
    const r2 = await ingest([]);
    const d2 = r2.json?.["data"] as Record<string, unknown>;
    expect(d2["changed"]).toBe(0);
    expect(d2["unchanged"]).toBe(1);
  }, 120_000);

  test("Q3 — quiescence: zero writes after round N", async () => {
    if (lar.mode !== "staged") return;
    // Q2's settle word ended round N: the file stands as the projection left it.
    const settled = readFileSync(projected, "utf8");
    // barrier: the island looked at the disk and drained its reconcile queue (`lares shore`), so a write an echo
    // would cause has landed by the time it answers. No standoff stands: disk and records say the same.
    const shore = await projectionDrained(lar);
    expect(shore).toEqual({ standoffs: 0, pending: 0 });
    expect(readFileSync(projected, "utf8")).toBe(settled);
  }, 60_000);

  test("Q4 — the NFC membrane assertion refuses foreign normal forms loudly", async () => {
    if (lar.mode !== "staged") return;
    const nfdPath = join(lar.root, "bags/lares/ha.ka.ba/lares/api/nfd-probe.mem");
    const body = readFileSync(projected, "utf8")
      .replace(/noosphere-boot/g, "nfd-probe")
      .replace("! Entry", "! Entrée".normalize("NFD"));   // é as e + combining accent (wikitext heading)
    writeFileSync(nfdPath, body);
    expect(body).not.toBe(body.normalize("NFC"));

    const r = await ingest([]);
    const d = r.json?.["data"] as Record<string, unknown>;
    const nonNfc = d["nonNfc"] as string[];
    expect(nonNfc).toContain("lar:///ha.ka.ba/lares/api/nfd-probe");
    expect(d["changed"]).toBe(0);
    expect(d["new"]).toBe(0);
  }, 60_000);
});
