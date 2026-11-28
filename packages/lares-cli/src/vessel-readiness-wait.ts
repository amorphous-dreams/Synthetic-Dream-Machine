/**
 * vessel-readiness-wait — a door call after a stand follows the vessel's OWN readiness, never a fixed clock.
 *
 * A vessel that just stood may answer its doors late: a face daemon island loading a large control document holds the
 * vessel's main thread, and every door reads silent until it lets go (measured 2026-11-28: 83 s, door calls waiting up to
 * 390 s). A door's refusal of that kind (`WAITS_ON_READINESS`) sends the caller to the islands' BREATH, which each island's
 * own thread writes beside the vessel (`@lararium/node` `island-breath`) and `lares vessel breath` reads in a process apart
 * from the vessel's main thread.
 *
 *   the door answers                    → the answer returns, whatever it says
 *   a refusal readiness cannot explain  → it returns at once (a lock, a lei, a vessel's own named refusal)
 *   no breath reads                     → the door's refusal stands (an older image, or no island breathed)
 *   an island's breath names a fault    → `vessel-fault`, naming the island and the fault's words
 *   the breath stood still since the
 *     read before (`breathMoved`)       → `vessel-stalled`: no island advanced and the process spent no work
 *   it moved                            → the caller paces once, then asks the door again
 *
 * NO CLOCK DECIDES: the verdict reads the islands' state, phase and progress and the process's CPU work. `pace` spaces the
 * reads and judges nothing.
 */
import { breathMoved, type IslandBreathRecord } from "@lararium/mesh/island-breath-verdict";

/** The door refusals a vessel still booting answers: each waits on the breath instead of ending the caller. */
export const WAITS_ON_READINESS: ReadonlySet<string> = new Set(["vessel-silent", "vessel-composing", "daemon-unreachable", "store-door-timeout"]);

/** Say a progress line on the first waiting read and on every sixth after it (a count of reads, never a clock). */
const SAY_EVERY = 6;

export interface VesselReadinessWait {
  /** The islands' breath as `lares vessel breath` reads it; null where none reads. */
  readonly breath: () => Promise<readonly IslandBreathRecord[] | null>;
  /** PACING: space the next read; it decides nothing. */
  readonly pace: () => Promise<void>;
  readonly say: (line: string) => void;
  /** How the lines name the vessel (`the new vessel`). */
  readonly what: string;
  /** The prefix each line carries (`kūkulu`). */
  readonly voice?: string;
}

type Refusal = { readonly ok: false; readonly code: string; readonly message: string };

/** One line naming where the islands stand: each mounting island's phase and progress, or that every island stands ready. */
const standsAt = (records: readonly IslandBreathRecord[]): string => {
  const mounting = records.filter((r) => r.state === "mounting");
  const cpu = records.reduce((m, r) => Math.max(m, r.cpuUsec), 0);
  const where = mounting.length === 0 ? `${records.length} island(s) ready` : mounting.map((r) => `${r.wikiUri} at ${r.phase}#${r.progress}`).join(", ");
  return `${where}; ${(cpu / 1e6).toFixed(1)} s of CPU spent`;
};

export async function awaitVesselAnswer<T extends { readonly ok: boolean }>(read: () => Promise<T>, w: VesselReadinessWait): Promise<T | Refusal> {
  const voice = w.voice ?? "kūkulu";
  let before: readonly IslandBreathRecord[] | null = null;
  let rounds = 0;
  for (;;) {
    const answer = await read();
    if (answer.ok) return answer;
    const code = (answer as unknown as Refusal).code;
    if (!WAITS_ON_READINESS.has(code)) return answer;
    const now = await w.breath().catch(() => null);
    if (now === null || now.length === 0) return answer;
    const v = breathMoved(before, now);
    if (v.verdict === "fault") {
      const message = `${w.what}'s island ${v.wikiUri} faulted while its door answered ${code}: ${v.fault}; \`lares shore log\` and \`tools/lares-container.sh logs\` name the rest`;
      w.say(`${voice}: ${message}`);
      return { ok: false, code: "vessel-fault", message };
    }
    if (v.verdict === "still") {
      const message = `${w.what}'s breath stood still since the read before (${standsAt(now)}) while its door still answers ${code}: no island advanced and the process spent under a quarter second of work, so no boot carries it on; \`tools/lares-container.sh logs\` names where it rests`;
      w.say(`${voice}: ${message}`);
      return { ok: false, code: "vessel-stalled", message };
    }
    if (rounds++ % SAY_EVERY === 0) w.say(`${voice}: ${w.what} still works (its door answers ${code}; ${standsAt(now)}), so the rite waits on its own answer`);
    before = now;
    await w.pace();
  }
}

/** Read `lares vessel breath`'s answer (`{ breath }`); null where it names no breath. */
export function breathOf(output: Record<string, unknown> | null): IslandBreathRecord[] | null {
  const b = output?.["breath"];
  if (!Array.isArray(b)) return null;
  return b.filter((r): r is IslandBreathRecord => typeof r === "object" && r !== null && typeof (r as { wikiUri?: unknown }).wikiUri === "string"
    && ["mounting", "ready", "fault"].includes(String((r as { state?: unknown }).state)));
}
