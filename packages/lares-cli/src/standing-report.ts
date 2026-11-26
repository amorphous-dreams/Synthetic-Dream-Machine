/**
 * standing-report — a verb's own exit carries the standing verdict to the host that holds the engine.
 *
 * THE HOST HOLDS THE ENGINE (`LAR_ENGINE=host`): its shim restarts a vessel whose standing reads `restand` (a face lit
 * after boot). The reading costs one connect and two file reads, and the process that ran the verb already stands inside
 * the vessel. So that process reads the verdict as it leaves and names it in its exit code: one CLI process serves one
 * call, and no second one starts to ask.
 *
 * The shim asks by name (`LARES_STANDING_REPORT=exit` on the exec) and reads three codes, each of a verb that SUCCEEDED:
 *
 *   90  attach    the vessel stands as its state on disk implies; nothing to do
 *   91  restand   the standing asks for a re-stand; the reason rides stderr, and the shim restarts the vessel
 *   92  unread    no vessel answered the reading, or the reading faulted; the shim says so and exits non-zero
 *
 * A verb that failed keeps its own code and reads no standing. With no ask in the environment nothing changes: every
 * other caller reads the verb's own code. The three codes stand clear of the CLI's own (0-6, 64, 78) and of the
 * engine's (125-127).
 */
import { existsSync, readFileSync } from "node:fs";
import { standingPath, standingVerdict } from "@lararium/mesh/rendezvous-path";
import { faceStandsOnDisk } from "./floor-cure.js";
import { larBootstrapPath, larDataDir } from "./env.js";
import { udsAlive } from "./local-connector.js";

/** The environment name the host shim asks by; `exit` asks for the verdict in the exit code. */
export const STANDING_REPORT_ENV = "LARES_STANDING_REPORT";
/** The exit codes a succeeded verb names its standing verdict by. The shims hold the same three. */
export const STANDING_EXIT = { attach: 90, restand: 91, unread: 92 } as const;

/** The standing a running vessel published beside its socket, or null when it published none. */
export function readStandingMarker(): string | null {
  try { return readFileSync(standingPath({ root: larDataDir(), uid: process.getuid?.() ?? 0 }), "utf8"); }
  catch { return null; }
}

/**
 * Take the shim's ask out of this process's environment, and answer it. THE ASK NAMES ONE PROCESS: a child this verb
 * spawns would inherit it and leave by 90 where its parent reads 0 for success, so the entry takes it before any verb runs.
 */
export function takeStandingAsk(env: Record<string, string | undefined> = process.env): Readonly<Record<string, string | undefined>> {
  const asked = { [STANDING_REPORT_ENV]: env[STANDING_REPORT_ENV] };
  delete env[STANDING_REPORT_ENV];
  return asked;
}

/** What the verdict reads: whether a vessel answers, the standing it published, and whether a face stands on disk. */
export interface StandingReaders {
  readonly alive:      () => Promise<boolean>;
  readonly marker:     () => string | null;
  readonly faceOnDisk: () => boolean;
}

const OWN_READERS: StandingReaders = {
  alive:      () => udsAlive(),
  marker:     readStandingMarker,
  faceOnDisk: () => { const bootstrap = larBootstrapPath(); return existsSync(bootstrap) && faceStandsOnDisk(bootstrap); },
};

/**
 * The exit code this process leaves by: `code` itself, unless the shim asked for the standing and the verb succeeded.
 * A vessel that answers no connect names no standing (`unread`), as a reading that throws does: the shim then says the
 * check answered no verdict, and never reads silence as "no lift".
 */
export async function standingExit(
  code: number,
  env: Readonly<Record<string, string | undefined>>,
  readers: StandingReaders = OWN_READERS,
  say: (line: string) => void = (line) => { console.error(line); },
): Promise<number> {
  if (code !== 0 || env[STANDING_REPORT_ENV] !== "exit") return code;
  try {
    if (!(await readers.alive())) return STANDING_EXIT.unread;
    const verdict = standingVerdict({ marker: readers.marker(), faceOnDisk: readers.faceOnDisk() });
    if (verdict.act !== "restand") return STANDING_EXIT.attach;
    say(`lares: the standing asks for a re-stand: ${verdict.reason}`);
    return STANDING_EXIT.restand;
  } catch {
    return STANDING_EXIT.unread;
  }
}
