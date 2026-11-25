/**
 * floor-ledger — THE TEST FLOOR'S QUEUE, folded inside the wiki that holds it (mandate/floor-gate-1, the placement law: what
 * CAN live in the wiki VM MUST). The pure core the `floor-queue` filter operator reads through; it touches no engine.
 *
 * The ledger stands as one record, `lar:///ha.ka.ba/kahua/memory/state/test-floor`, its text an append log. Host tools append
 * lines through the tiddler door (`lares tiddler put … --append -`, two appends at once both land) or, while the doors stand
 * dark, to the flat mirror `<passwd home>/.lares-scratch/.floor/queue.log` that the familiar folds back in. A line the grammar
 * does not read (the older CLAIM habit, a note) stays in the log and folds to nothing.
 *
 *   QUEUE <ticket> <lane> <branch> <sha>                        a spirit's hand-back enters the queue
 *   RUN   <ticket> <command…>                                   one command the ticket runs (in order; none reads as bench-gate)
 *   WHY   <ticket> <words…>                                     which red proves what
 *   TAKE  <ticket> <holder> c-free=<G>                          the familiar holds the floor for it
 *   DONE  <ticket> <GREEN|RED|STOPPED> wrote=<G> c-drop=<G> · <verdict line…>   the bench gate's verdict and the byte rows
 *   DROP  <ticket> <reason…>                                    set down unrun (a sha already green, a lane withdrawn)
 *
 * ORDER IS ARRIVAL: the line's place in the log orders the queue, never a clock (an attacker owns every clock). A ticket names
 * itself `<lane>@<sha9>`; a QUEUE over a ticket that stands DONE or DROPped re-enters it at the tail with its runs cleared, and
 * a QUEUE over one still waiting or taken folds to nothing (the queue dedupes itself). DEDUPE BY SHA: a waiting ticket whose sha
 * already holds a GREEN verdict reads `skip`, never `waiting`.
 */

export const FLOOR_LEDGER = "lar:///ha.ka.ba/kahua/memory/state/test-floor";
export const FLOOR_VERBS = ["QUEUE", "RUN", "WHY", "TAKE", "DONE", "DROP"] as const;
export const FLOOR_VERDICTS = ["GREEN", "RED", "STOPPED"] as const;
export type FloorVerdict = (typeof FLOOR_VERDICTS)[number];
export type FloorState = "waiting" | "taken" | "done" | "dropped";

/** The ticket body a hand-back carries when it names no command: the bench gate over the sum. */
export const DEFAULT_RUN = "node tools/bench-gate.mjs";

export interface FloorTicket {
  readonly id: string;
  lane: string;
  branch: string;
  sha: string;
  runs: string[];
  why: string;
  state: FloorState;
  /** The log line index the ticket (last) entered the queue at: arrival order. */
  arrived: number;
  holder: string;
  cFree: string;
  verdict: FloorVerdict | null;
  wrote: string;
  cDrop: string;
  verdictLine: string;
  dropReason: string;
}

const SHA = /^[0-9a-f]{7,40}$/i;
const TICKET = /^[A-Za-z0-9._/-]+@[0-9a-f]{7,40}$/i;

/** The ticket id a lane and sha mint: `<lane>@<first nine hex>`. */
export function ticketId(lane: string, sha: string): string {
  return `${lane}@${sha.toLowerCase().slice(0, 9)}`;
}

/** Two shas name one commit where the shorter (seven hex at least) prefixes the longer. */
export function sameSha(a: string, b: string): boolean {
  const x = a.toLowerCase(), y = b.toLowerCase();
  if (!SHA.test(x) || !SHA.test(y)) return false;
  return x.length <= y.length ? y.startsWith(x) : x.startsWith(y);
}

const keyed = (word: string, key: string): string | null => (word.startsWith(`${key}=`) ? word.slice(key.length + 1) : null);

/** Fold the log into tickets, in arrival order. Lines the grammar does not read fold to nothing. */
export function foldLedger(text: string): FloorTicket[] {
  const tickets = new Map<string, FloorTicket>();
  const lines = String(text).split("\n");
  lines.forEach((raw, index) => {
    const line = raw.trim();
    const [verb, id, ...rest] = line.split(/\s+/);
    if (!verb || !id || !(FLOOR_VERBS as readonly string[]).includes(verb) || !TICKET.test(id)) return;
    const held = tickets.get(id);
    if (verb === "QUEUE") {
      const [lane, branch, sha] = rest;
      if (!lane || !branch || !sha || !SHA.test(sha)) return;
      if (held && (held.state === "waiting" || held.state === "taken")) return;
      tickets.delete(id);
      tickets.set(id, {
        id, lane, branch, sha: sha.toLowerCase(), runs: [], why: "", state: "waiting", arrived: index,
        holder: "", cFree: "", verdict: null, wrote: "", cDrop: "", verdictLine: "", dropReason: "",
      });
      return;
    }
    if (!held) return;
    const tail = line.slice(line.indexOf(id) + id.length).trim();
    if (verb === "RUN") { if (held.state === "waiting" && tail) held.runs.push(tail); return; }
    if (verb === "WHY") { held.why = tail; return; }
    if (verb === "TAKE") {
      if (held.state !== "waiting") return;
      held.state = "taken"; held.holder = rest[0] ?? ""; held.cFree = rest.map((w) => keyed(w, "c-free")).find((v) => v !== null) ?? "";
      return;
    }
    if (verb === "DONE") {
      const verdict = rest[0] as FloorVerdict;
      if (!(FLOOR_VERDICTS as readonly string[]).includes(verdict)) return;
      const dot = tail.indexOf("·");
      held.state = "done"; held.verdict = verdict;
      held.wrote = rest.map((w) => keyed(w, "wrote")).find((v) => v !== null) ?? "";
      held.cDrop = rest.map((w) => keyed(w, "c-drop")).find((v) => v !== null) ?? "";
      held.verdictLine = dot < 0 ? "" : tail.slice(dot + 1).trim();
      return;
    }
    if (verb === "DROP") { held.state = "dropped"; held.dropReason = tail; }
  });
  return [...tickets.values()].sort((a, b) => a.arrived - b.arrived);
}

/** True where any ticket carrying this sha holds a GREEN verdict. */
export function shaGreen(tickets: readonly FloorTicket[], sha: string): boolean {
  return tickets.some((t) => t.state === "done" && t.verdict === "GREEN" && sameSha(t.sha, sha));
}

/** Waiting tickets whose sha no green verdict covers, in arrival order: the queue the familiar drains. */
export function waiting(tickets: readonly FloorTicket[]): FloorTicket[] {
  return tickets.filter((t) => t.state === "waiting" && !shaGreen(tickets, t.sha));
}

/** Waiting tickets a green verdict already covers: the familiar DROPs them unrun. */
export function skippable(tickets: readonly FloorTicket[]): FloorTicket[] {
  return tickets.filter((t) => t.state === "waiting" && shaGreen(tickets, t.sha));
}

/** The ticket as a hand-back carries it, one copy-pasteable block. */
export function ticketBlock(t: FloorTicket): string {
  const runs = t.runs.length ? t.runs : [DEFAULT_RUN];
  return [
    `FLOOR TICKET ${t.lane} ${t.branch} ${t.sha}`,
    `  bench: familiar`,
    ...runs.map((r) => `  run:   ${r}`),
    ...(t.why ? [`  why:   ${t.why}`] : []),
  ].join("\n");
}

/** One byte-budget row per verdict: what each run wrote and what it took from C:. */
export function budgetRow(t: FloorTicket): string {
  return `${t.id} ${t.verdict ?? "?"} wrote=${t.wrote || "?"} c-drop=${t.cDrop || "?"}`;
}

export const FLOOR_VIEWS = ["waiting", "next", "skip", "taken", "green", "red", "stopped", "dropped", "budget", "ticket", "runs", "sha", "green-sha"] as const;
export type FloorView = (typeof FLOOR_VIEWS)[number];

/** One view of the folded ledger, as the filter operator answers it. `arg` names the ticket (ticket, runs, sha) or sha (green-sha). */
export function floorView(tickets: readonly FloorTicket[], view: string, arg = ""): string[] {
  const byId = (): FloorTicket | undefined => tickets.find((t) => t.id === arg);
  switch (view) {
    case "": case "waiting": return waiting(tickets).map((t) => t.id);
    case "next": return waiting(tickets).slice(0, 1).map((t) => t.id);
    case "skip": return skippable(tickets).map((t) => t.id);
    case "taken": return tickets.filter((t) => t.state === "taken").map((t) => t.id);
    case "green": case "red": case "stopped":
      return tickets.filter((t) => t.state === "done" && t.verdict === view.toUpperCase()).map((t) => t.id);
    case "dropped": return tickets.filter((t) => t.state === "dropped").map((t) => t.id);
    case "budget": return tickets.filter((t) => t.state === "done").map(budgetRow);
    case "ticket": { const t = byId(); return t ? [ticketBlock(t)] : []; }
    case "runs": { const t = byId(); return t ? (t.runs.length ? [...t.runs] : [DEFAULT_RUN]) : []; }
    case "sha": { const t = byId(); return t ? [t.sha] : []; }
    case "green-sha": return SHA.test(arg) && shaGreen(tickets, arg) ? ["yes"] : [];
    default: throw new Error(`floor-queue: "${view}" names no view; views: ${FLOOR_VIEWS.join(" · ")}`);
  }
}
