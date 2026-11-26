/**
 * standing-report — a verb's own exit carries the standing verdict to the host that holds the engine.
 *
 * THE HOST HOLDS THE ENGINE (`LAR_ENGINE=host`): its shim restarts a vessel whose standing reads `restand` (a face lit
 * after boot). The reading costs one connect and two file reads, and the process that ran the verb already stands inside
 * the vessel. So that process reads the verdict as it leaves and names it in its exit code: one CLI process serves one
 * call, and no second one starts to ask.
 *
 * The shim asks on the call itself (`--standing-report`, the last word of the exec's argv) and reads three codes, each of a verb that SUCCEEDED:
 *
 *   90  attach    the vessel stands as its state on disk implies; nothing to do
 *   91  restand   the standing asks for a re-stand; the reason rides stderr, and the shim restarts the vessel
 *   92  unread    no vessel answered the reading, or the reading faulted; the shim says so and exits non-zero
 *
 * A verb that failed keeps its own code and reads no standing. With no ask on the call nothing changes: every
 * other caller reads the verb's own code. The three codes stand clear of the CLI's own (0-6, 64, 78) and of the
 * engine's (125-127).
 */
import { existsSync, readFileSync } from "node:fs";
import { standingPath, standingVerdict } from "@lararium/mesh/rendezvous-path";
import { faceStandsOnDisk } from "./floor-cure.js";
import { larBootstrapPath, larDataDir } from "./env.js";
import { ASK_BUDGET_FLAG, askBudgetMs, udsAlive } from "./local-connector.js";

/** The flag the host shim asks by: the verdict rides the exit code of the one process that ran the verb. */
export const STANDING_REPORT_FLAG = "--standing-report";
/** The exit codes a succeeded verb names its standing verdict by. The shims hold the same three. */
export const STANDING_EXIT = { attach: 90, restand: 91, unread: 92 } as const;

/** The standing a running vessel published beside its socket, or null when it published none. */
export function readStandingMarker(): string | null {
  try { return readFileSync(standingPath({ root: larDataDir(), uid: process.getuid?.() ?? 0 }), "utf8"); }
  catch { return null; }
}

/** What a call asks of the entry itself, beside its verb: the standing verdict in the exit, and a budget on this process's wait. */
export interface EntryAsks {
  /** The argv the verb reads: every word but the entry's own two flags. */
  readonly argv:     string[];
  readonly standing: boolean;
  readonly budgetMs: number | null;
}

/**
 * Take the entry's own asks off the argv. THE ASKS NAME ONE CALL: they ride its argv and no environment, so a child this
 * verb spawns inherits neither (it would leave by 90 where its parent reads 0 for success, or under a budget nobody gave
 * it), and no verb's own parser meets them. The budget takes `--ask-budget-ms=<N>` or `--ask-budget-ms <N>`; a value that
 * names no positive whole number declares none.
 */
export function takeEntryAsks(argv: readonly string[]): EntryAsks {
  const kept: string[] = [];
  let standing = false;
  let budgetMs: number | null = null;
  for (let i = 0; i < argv.length; i += 1) {
    const word = argv[i]!;
    if (word === STANDING_REPORT_FLAG) standing = true;
    else if (word === ASK_BUDGET_FLAG) { budgetMs = askBudgetMs(argv[i + 1]); i += 1; }
    else if (word.startsWith(`${ASK_BUDGET_FLAG}=`)) budgetMs = askBudgetMs(word.slice(ASK_BUDGET_FLAG.length + 1));
    else kept.push(word);
  }
  return { argv: kept, standing, budgetMs };
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
  asked: boolean,
  readers: StandingReaders = OWN_READERS,
  say: (line: string) => void = (line) => { console.error(line); },
): Promise<number> {
  if (code !== 0 || !asked) return code;
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
