/**
 * island-breath — the islands' boot breath, written off the vessel's main thread where a reader outside the vessel finds it.
 *
 * A mounting island breathes `phase#progress` to its vessel (the ea-breath law, `sovereign-kernel`): a breath at receipt, a
 * stage mark before each long stretch (`slot <name>`), progress on each tick and each inbound sync. That breath reaches the
 * vessel's MAIN thread, and a main thread held by a long load answers no door: measured 2026-11-28, a face daemon island spent
 * 83 s on the control document's slot while every door call read silent, and the kūkulu rite ended over a vessel that only
 * worked. So each island's own thread ALSO writes its breath, as it posts it, to one small record under the house's run dir
 * (`<LAR_ROOT>/run/breath/<key>.json`, one file per wiki the island mounts, the latest breath alone). No main thread rides the
 * write, so the record moves while the main thread holds.
 *
 * Each record carries the island's state (`mounting`, `ready` at its ea, `fault` with the fault's words), its last phase and
 * progress, and the PROCESS's CPU work (`process.cpuUsage()`, user + system µs: a whole-process counter, so a main thread busy
 * with a load moves it too).
 *
 * WHAT READS IT: `lares vessel breath` (a CLI process inside the vessel's container, standing apart from the vessel's main
 * thread), which the host's rite reaches through its bridge (`rite-kukulu` `afterStand`), and the vessel's healthcheck
 * (`breath-health`). Both judge by `breathMoved`: a breath MOVES where any island's state, phase or progress changed, a new
 * island breathed, or the process spent at least `BREATH_WORK_USEC` of CPU since the read before. NO CLOCK DECIDES: the
 * islands' own breath interval paces the writes, a reader's pace spaces its reads, and neither judges anything.
 *
 * `run/` stands a tmpfs inside the container, so no record outlives its boot; a remount of one wiki overwrites its record.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { threadId } from "node:worker_threads";
import type { IslandBreathRecord } from "@lararium/mesh/island-breath-verdict";

export { BREATH_WORK_USEC, breathFault, breathMoved, type BreathVerdict, type IslandBreathRecord } from "@lararium/mesh/island-breath-verdict";

/** The breath folder under the house's run dir. */
export const BREATH_DIR = "breath";

/** The breath dir the vessel hands its islands (`IslandCasData.breathDir`): `<LAR_ROOT>/run/breath`, null where no house root stands named. */
export function breathDirFromEnv(env: Readonly<Record<string, string | undefined>> = process.env): string | null {
  const root = (env["LAR_ROOT"] ?? "").trim();
  return root === "" ? null : join(root, "run", BREATH_DIR);
}

const processCpu = (): number => { const u = process.cpuUsage(); return u.user + u.system; };

/** The record's file name: a digest of the wiki's URI, so any URI names one plain file. */
const recordFile = (wikiUri: string): string => `${createHash("sha256").update(wikiUri).digest("hex").slice(0, 24)}.json`;

/**
 * The island side: a tap the island's host shore calls with every message it posts its vessel. A `breath` writes the record
 * (`mounting`), an `ea` marks it `ready`, a `fault` marks it `fault`; every other message passes untouched. A dir that refuses
 * a write stops the tap for this island (the breath to the vessel still flows); it never throws into the post.
 */
export function islandBreathTap(dir: string | null, cpu: () => number = processCpu): (msg: unknown) => void {
  if (dir === null) return () => {};
  let open = true;
  let made = false;
  const last = new Map<string, { phase: string; progress: number }>();
  const write = (rec: IslandBreathRecord): void => {
    if (!open) return;
    try {
      if (!made) { mkdirSync(dir, { recursive: true }); made = true; }
      const file = join(dir, recordFile(rec.wikiUri));
      const next = `${file}.${process.pid}.${threadId}.next`;
      writeFileSync(next, `${JSON.stringify(rec)}\n`);
      renameSync(next, file);
    } catch { open = false; }
  };
  return (msg) => {
    const m = msg as { type?: unknown; wikiUri?: unknown; phase?: unknown; progress?: unknown; error?: unknown } | null;
    if (m === null || typeof m !== "object" || typeof m.wikiUri !== "string") return;
    const wikiUri = m.wikiUri;
    if (m.type === "breath") {
      const at = { phase: typeof m.phase === "string" ? m.phase : "", progress: typeof m.progress === "number" ? m.progress : 0 };
      last.set(wikiUri, at);
      write({ wikiUri, state: "mounting", ...at, cpuUsec: cpu() });
    } else if (m.type === "ea" || m.type === "fault") {
      const at = last.get(wikiUri) ?? { phase: "", progress: 0 };
      write({ wikiUri, state: m.type === "ea" ? "ready" : "fault", ...at, cpuUsec: cpu(), ...(m.type === "fault" ? { fault: String(m.error ?? "the island faulted") } : {}) });
    }
  };
}

/** Every record the breath dir holds; null where the dir stands absent (an older image, or no island breathed yet). */
export function readIslandBreath(dir: string | null): IslandBreathRecord[] | null {
  if (dir === null) return null;
  let names: string[];
  try { names = readdirSync(dir).filter((n) => n.endsWith(".json")); } catch { return null; }
  const out: IslandBreathRecord[] = [];
  for (const n of names) {
    try {
      const r = JSON.parse(readFileSync(join(dir, n), "utf8")) as Partial<IslandBreathRecord>;
      if (typeof r.wikiUri !== "string" || (r.state !== "mounting" && r.state !== "ready" && r.state !== "fault")) continue;
      out.push({ wikiUri: r.wikiUri, state: r.state, phase: String(r.phase ?? ""), progress: Number(r.progress ?? 0), cpuUsec: Number(r.cpuUsec ?? 0), ...(typeof r.fault === "string" ? { fault: r.fault } : {}) });
    } catch { /* a record mid-rename or torn reads as absent this time */ }
  }
  return out.sort((a, b) => (a.wikiUri < b.wikiUri ? -1 : a.wikiUri > b.wikiUri ? 1 : 0));
}
