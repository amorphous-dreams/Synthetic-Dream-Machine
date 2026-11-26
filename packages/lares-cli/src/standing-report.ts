/**
 * standing-report — a verb's own process REPORTS the standing verdict to the host that holds the engine; nothing asks for it.
 *
 * THE HOST HOLDS THE ENGINE (`LAR_ENGINE=host`): its shim restarts a vessel whose standing reads `restand` (a face lit
 * after boot). The reading costs one connect and two file reads, and the process that ran the verb already stands inside
 * the vessel, so that process reads the verdict as it leaves and one CLI process serves one call.
 *
 * EACH ISLAND OWNS ITS OWN CONTRACT. The image owns what its CLI reports; the shim owns only reading it. So the call
 * carries no word that asks (a word an older image refuses, and an older shim never sends), and the exit code stays the
 * verb's own (every caller shares that channel, so a verdict riding it changes what every caller reads). The report
 * rides a channel only the shim reads: a one-line file in the house's config bind, named by the call's own exec tag
 * (`LARES_EXEC_TAG`, which every shim exec already carries so its signal stop can find the process):
 *
 *     <LAR_ROOT>/config/standing-report.<tag>      attach | restand <reason> | unread
 *
 * The shim reads the file after a verb that succeeded and removes it; where none arrives (an image older than this
 * report), it takes one observe reading instead. ABSENCE OF THE REPORT IS THE CAPABILITY SIGNAL, so a skew between the
 * host shim and the image breaks no call in either direction. A verb that failed reports nothing: the shim follows a
 * success alone. A call with no tag (any caller but a shim) writes nothing and reads no standing.
 *
 * Why a file and not a stderr trailer: an attached exec runs on a pty, which merges stderr into the one interactive stream
 * the operator types into; a trailer there would need a filter in front of every prompt. The config bind already carries
 * the vessel's reports to the shim (`kukulu-offer.json`), so the report takes the road that stands.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { standingPath, standingVerdict } from "@lararium/mesh/rendezvous-path";
import { faceStandsOnDisk } from "./floor-cure.js";
import { larBootstrapPath, larDataDir, larRoot } from "./env.js";
import { ASK_BUDGET_FLAG, askBudgetMs } from "./ask-budget.js";
import { udsAlive } from "./local-connector.js";

/** The report file's name stem: `standing-report.<tag>` in the house's config bind. The shims read the same name. */
export const STANDING_REPORT_STEM = "standing-report.";
/**
 * THE RETIRED ASK. A shim from before the report appends this word to every followed exec. The entry takes it off and acts on
 * nothing (the exit stays the verb's own, so that shim reads a bare 0 and takes its own observe reading): a skew in that
 * direction breaks no call either. No shim of this house sends it any more.
 */
const RETIRED_STANDING_ASK = "--standing-report";
/** A shim's exec tag: eight random bytes in hex (both shims mint it so). Anything else names no report file. */
const EXEC_TAG = /^[0-9a-f]{16}$/;

/** The standing a running vessel published beside its socket, or null when it published none. */
export function readStandingMarker(): string | null {
  try { return readFileSync(standingPath({ root: larDataDir(), uid: process.getuid?.() ?? 0 }), "utf8"); }
  catch { return null; }
}

/** What a call declares to the entry itself, beside its verb: a budget on this process's wait. */
export interface EntryAsks {
  /** The argv the verb reads: every word but the entry's own budget flag. */
  readonly argv:     string[];
  readonly budgetMs: number | null;
  /** Set where the call carried the retired standing ask: a shim from before the report, which reads none, so none gets written. */
  readonly retiredAsk?: true;
}

/**
 * Take the entry's own word off the argv. A CALLER'S BUDGET STAYS A WORD: it declares the caller's own wait (an input
 * the CLI cannot read from anywhere else), so it rides the argv of the one call and no environment, and a child this verb
 * spawns never inherits it. It takes `--ask-budget-ms=<N>` or `--ask-budget-ms <N>`; a value that names no positive whole
 * number declares none. The retired standing ask comes off too and changes no exit; it only marks a shim that reads no report.
 */
export function takeEntryAsks(argv: readonly string[]): EntryAsks {
  const kept: string[] = [];
  let budgetMs: number | null = null;
  let retiredAsk = false;
  for (let i = 0; i < argv.length; i += 1) {
    const word = argv[i]!;
    if (word === RETIRED_STANDING_ASK) { retiredAsk = true; continue; }
    if (word === ASK_BUDGET_FLAG) { budgetMs = askBudgetMs(argv[i + 1]); i += 1; }
    else if (word.startsWith(`${ASK_BUDGET_FLAG}=`)) budgetMs = askBudgetMs(word.slice(ASK_BUDGET_FLAG.length + 1));
    else kept.push(word);
  }
  return retiredAsk ? { argv: kept, budgetMs, retiredAsk: true } : { argv: kept, budgetMs };
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
 * The report's one line. A vessel that answers no connect names no standing (`unread`), as a reading that throws does:
 * the shim then says the check answered no verdict, and never reads silence as "no lift".
 */
export async function standingLine(readers: StandingReaders = OWN_READERS): Promise<string> {
  try {
    if (!(await readers.alive())) return "unread";
    const verdict = standingVerdict({ marker: readers.marker(), faceOnDisk: readers.faceOnDisk() });
    if (verdict.act !== "restand") return "attach";
    return `restand ${verdict.reason.replace(/[\r\n]+/g, " ")}`;
  } catch {
    return "unread";
  }
}

/** Where this call's report rests, or null where the call carries no shim's tag or the house shows no config bind. */
export function standingReportPath(tag: string | undefined, root: () => string = larRoot): string | null {
  if (tag === undefined || !EXEC_TAG.test(tag)) return null;
  try {
    const config = join(root(), "config");
    return existsSync(config) ? join(config, `${STANDING_REPORT_STEM}${tag}`) : null;
  } catch { return null; }
}

/**
 * Report the standing as this process leaves, and never touch its exit code. A verb that failed reports nothing, a call no
 * shim tagged reports nothing, and a write that fails leaves no file, which the shim reads as an image that reports none
 * (one observe reading follows): the report never decides a call's outcome.
 */
export async function reportStanding(
  code: number,
  tag: string | undefined = process.env["LARES_EXEC_TAG"],
  readers: StandingReaders = OWN_READERS,
  at: (tag: string | undefined) => string | null = (t) => standingReportPath(t),
): Promise<void> {
  if (code !== 0) return;
  const path = at(tag);
  if (path === null) return;
  const line = await standingLine(readers);
  try { writeFileSync(path, `${line}\n`); } catch { /* no report: the shim's observe reading stands in */ }
}
