/**
 * vessel-readiness-wait — a door call after a stand follows the vessel's OWN readiness, never a fixed clock.
 *
 * A vessel that just stood may answer its doors late: a face daemon island loading a large control document holds the
 * vessel's main thread, and every door reads silent until it lets go (measured 2026-11-28: 83 s, door calls waiting up to
 * 390 s). A door's refusal of that kind (`WAITS_ON_READINESS`) sends the caller to the vessel's PULSE: the container's state
 * and the CPU work its processes spent, a counter the vessel's own kernel keeps.
 *
 *   the door answers                    → the answer returns, whatever it says
 *   a refusal readiness cannot explain  → it returns at once (a lock, a lei, a vessel's own named refusal)
 *   the pulse reads nowhere             → the door's refusal stands (nothing here can judge the vessel's work)
 *   the vessel stopped                  → `vessel-fault`, naming its status and exit
 *   the vessel spent < WORK_USEC of CPU
 *     since the read before             → `vessel-stalled`: it stands running and idle, so no boot moves it on
 *   it worked                           → the caller paces once, then asks the door again
 *
 * NO CLOCK DECIDES: the verdict reads the vessel's CPU counter alone. `pace` spaces the reads and judges nothing, so a
 * slow pace and a fast one reach the same verdict over the same vessel.
 */

/** The vessel's pulse as the host reads it: the container's state and the cumulative CPU its processes spent (µs). */
export interface VesselPulse {
  /** The container's state: `running`, `exited`, `restarting`, `dead`, … (`absent` where no vessel container stands). */
  readonly status: string;
  /** The container's health as Docker reads it (`healthy`, `starting`, `unhealthy`, `none`); annotation alone. */
  readonly health: string;
  readonly exitCode: number | null;
  /** The cgroup's cumulative CPU usage in µs; null where the host reads none. */
  readonly cpuUsec: number | null;
}

/** The door refusals a vessel still booting answers: each waits on the pulse instead of ending the caller. */
export const WAITS_ON_READINESS: ReadonlySet<string> = new Set(["vessel-silent", "vessel-composing", "daemon-unreachable", "store-door-timeout"]);

/**
 * The least CPU work between two reads that counts as a vessel working: a quarter second. An idle node's timers spend a
 * few milliseconds per read; a load holding the main thread spends nearly the whole span. A work measure, never a time-out.
 */
export const WORK_USEC = 250_000;

/** Say a progress line on the first waiting read and on every sixth after it (a count of reads, never a clock). */
const SAY_EVERY = 6;

export interface VesselReadinessWait {
  readonly pulse: () => Promise<VesselPulse | null>;
  /** PACING: space the next read; it decides nothing. */
  readonly pace: () => Promise<void>;
  readonly say: (line: string) => void;
  /** How the lines name the vessel (`the new vessel`). */
  readonly what: string;
  /** The prefix each line carries (`kūkulu`). */
  readonly voice?: string;
}

type Refusal = { readonly ok: false; readonly code: string; readonly message: string };

export async function awaitVesselAnswer<T extends { readonly ok: boolean }>(read: () => Promise<T>, w: VesselReadinessWait): Promise<T | Refusal> {
  const voice = w.voice ?? "kūkulu";
  let lastCpu: number | null = null;
  let rounds = 0;
  for (;;) {
    const answer = await read();
    if (answer.ok) return answer;
    const code = (answer as unknown as Refusal).code;
    if (!WAITS_ON_READINESS.has(code)) return answer;
    const pulse = await w.pulse().catch(() => null);
    if (pulse === null) return answer;
    if (pulse.status !== "running") {
      const message = `${w.what} stopped (its container reads ${pulse.status}${pulse.exitCode === null ? "" : `, exit ${pulse.exitCode}`}) while its door answered ${code}; \`tools/lares-container.sh logs\` names why`;
      w.say(`${voice}: ${message}`);
      return { ok: false, code: "vessel-fault", message };
    }
    if (pulse.cpuUsec === null) return answer;
    if (lastCpu !== null && pulse.cpuUsec - lastCpu < WORK_USEC) {
      const message = `${w.what} stands running and spent ${((pulse.cpuUsec - lastCpu) / 1000).toFixed(0)} ms of work since the read before, while its door still answers ${code}: it rests idle, and no boot carries it on; \`tools/lares-container.sh logs\` names where it rests`;
      w.say(`${voice}: ${message}`);
      return { ok: false, code: "vessel-stalled", message };
    }
    if (rounds++ % SAY_EVERY === 0) {
      w.say(`${voice}: ${w.what} still works (its door answers ${code}; health ${pulse.health}; ${(pulse.cpuUsec / 1e6).toFixed(1)} s of CPU spent), so the rite waits on its own answer`);
    }
    lastCpu = pulse.cpuUsec;
    await w.pace();
  }
}

/** Read the shim's `vessel-pulse` line (one JSON object); null where it names no pulse. */
export function vesselPulseOf(line: string | null): VesselPulse | null {
  if (line === null) return null;
  try {
    const p = JSON.parse(line) as Record<string, unknown> | null;
    if (p === null || typeof p !== "object" || typeof p["status"] !== "string") return null;
    const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
    return { status: p["status"], health: typeof p["health"] === "string" ? p["health"] : "none", exitCode: num(p["exitCode"]), cpuUsec: num(p["cpuUsec"]) };
  } catch { return null; }
}
