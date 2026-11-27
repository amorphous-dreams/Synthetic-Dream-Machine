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
 *   HANDBACK <ticket> [body=<n>] [· <words…>]                   the lane's body handed this sha back (the landing span opens)
 *   OWES  <ticket> <verb> · <suites…>                           the ticket the seam fold computed (`tools/floor-owes.mjs`)
 *   MISS  <ticket> <words…>                                     a hand names a red this ticket's green missed, seen elsewhere
 *   LAND  <ticket> <merge-sha>                                  the lane's branch landed on develop at that merge
 *
 * A LANE NAMES A SPIRIT, never one of its bodies: `<lane>` carries the spirit's pet name, and every body of that spirit
 * queues under it (`body=<n>` rides the HANDBACK row as a note). THE FLOOR SERVES LANES: the queue orders waiting tickets by
 * turn, a ticket's turn counting the tickets its own lane holds taken plus the lane's waiting tickets ahead of it, and
 * arrival breaks a tie. So a lane's second ticket waits behind every sibling lane's first, a lane holding a slot yields the
 * next slot to a lane holding none, and a floor with one lane waiting never idles.
 *
 * ORDER IS ARRIVAL within a lane and within a turn: the line's place in the log orders the queue, never a clock (an attacker
 * owns every clock). A ticket names itself `<lane>@<sha9>`; a QUEUE over a ticket that stands DONE or DROPped re-enters it at
 * the tail with its runs cleared, and a QUEUE over one still waiting or taken folds to nothing (the queue dedupes itself).
 * DEDUPE BY SHA: a waiting ticket whose sha already holds a GREEN verdict reads `skip`, never `waiting`.
 *
 * THE RATCHET ROWS, counted and never timed. A MISS: a sha that held a GREEN verdict and drew a RED verdict later in the log
 * (the green missed what a later run found), or a ticket a MISS row names; one per ticket. RUNS PER LANDING: the verdicts a
 * lane's branch drew between the opening of its landing span (its first HANDBACK or QUEUE after its last LAND) and its LAND,
 * beside the floor's turns in that span (every lane's verdicts): `<lane>@<merge9>=<runs>/<turns>`.
 */

export const FLOOR_LEDGER = "lar:///ha.ka.ba/kahua/memory/state/test-floor";
export const FLOOR_VERBS = ["QUEUE", "RUN", "WHY", "TAKE", "DONE", "DROP", "HANDBACK", "OWES", "MISS", "LAND"] as const;
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
  /** The log line index the ticket's verdict landed at: the order the budget ledger reads in. */
  settled: number;
  holder: string;
  cFree: string;
  verdict: FloorVerdict | null;
  wrote: string;
  cDrop: string;
  verdictLine: string;
  dropReason: string;
  /** The body of the lane's spirit that handed the sha back (`body=<n>` on its HANDBACK row), or empty. */
  body: string;
  /** The computed ticket (`<verb> · <suites>`), as the OWES row carries it. */
  owes: string;
}

/** One verdict as the log held it, kept past a ticket's re-entry: the ratchet rows read these. */
export interface FloorVerdictRow { readonly id: string; readonly lane: string; readonly branch: string; readonly sha: string; readonly verdict: FloorVerdict; readonly at: number }
/** One landing: the lane's branch on develop at `merge`, the span's own runs, and the floor's turns across the span. */
export interface FloorLanding { readonly id: string; readonly lane: string; readonly branch: string; readonly merge: string; readonly runs: number; readonly turns: number; readonly at: number }
/** The whole fold: the tickets in arrival order, then what the ratchet rows read. */
export interface FloorFold {
  readonly tickets: FloorTicket[];
  readonly verdicts: FloorVerdictRow[];
  readonly landings: FloorLanding[];
  /** ticket → the words a MISS row names it by. */
  readonly named: Map<string, string>;
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

/** Fold the whole log: tickets in arrival order, every verdict, every landing, every named miss. Lines the grammar does not read fold to nothing. */
export function foldFloor(text: string): FloorFold {
  const tickets = new Map<string, FloorTicket>();
  const verdicts: FloorVerdictRow[] = [];
  const landings: FloorLanding[] = [];
  const named = new Map<string, string>();
  /** `<lane> <branch>` → the log index its open landing span began at. */
  const span = new Map<string, number>();
  const open = (t: FloorTicket, index: number): void => { const key = `${t.lane} ${t.branch}`; if (!span.has(key)) span.set(key, index); };
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
      const t: FloorTicket = {
        id, lane, branch, sha: sha.toLowerCase(), runs: [], why: "", state: "waiting", arrived: index, settled: -1,
        holder: "", cFree: "", verdict: null, wrote: "", cDrop: "", verdictLine: "", dropReason: "", body: "", owes: "",
      };
      tickets.set(id, t);
      open(t, index);
      return;
    }
    if (!held) return;
    const tail = line.slice(line.indexOf(id) + id.length).trim();
    if (verb === "RUN") { if (held.state === "waiting" && tail) held.runs.push(tail); return; }
    if (verb === "WHY") { held.why = tail; return; }
    if (verb === "HANDBACK") { held.body = rest.map((w) => keyed(w, "body")).find((v) => v !== null) ?? held.body; open(held, index); return; }
    if (verb === "OWES") { held.owes = tail; return; }
    if (verb === "MISS") { if (!named.has(id)) named.set(id, tail || "named by hand"); return; }
    if (verb === "LAND") {
      const merge = (rest[0] ?? "").toLowerCase();
      if (!SHA.test(merge)) return;
      const key = `${held.lane} ${held.branch}`;
      const from = span.get(key) ?? held.arrived;
      const within = verdicts.filter((v) => v.at > from && v.at < index);
      landings.push({ id, lane: held.lane, branch: held.branch, merge, runs: within.filter((v) => v.lane === held.lane && v.branch === held.branch).length, turns: within.length, at: index });
      span.delete(key);
      return;
    }
    if (verb === "TAKE") {
      if (held.state !== "waiting") return;
      held.state = "taken"; held.holder = rest[0] ?? ""; held.cFree = rest.map((w) => keyed(w, "c-free")).find((v) => v !== null) ?? "";
      return;
    }
    if (verb === "DONE") {
      const verdict = rest[0] as FloorVerdict;
      if (!(FLOOR_VERDICTS as readonly string[]).includes(verdict)) return;
      const dot = tail.indexOf("·");
      held.state = "done"; held.verdict = verdict; held.settled = index;
      held.wrote = rest.map((w) => keyed(w, "wrote")).find((v) => v !== null) ?? "";
      held.cDrop = rest.map((w) => keyed(w, "c-drop")).find((v) => v !== null) ?? "";
      held.verdictLine = dot < 0 ? "" : tail.slice(dot + 1).trim();
      verdicts.push({ id, lane: held.lane, branch: held.branch, sha: held.sha, verdict, at: index });
      return;
    }
    if (verb === "DROP") { held.state = "dropped"; held.dropReason = tail; }
  });
  return { tickets: [...tickets.values()].sort((a, b) => a.arrived - b.arrived), verdicts, landings, named };
}

/** Fold the log into tickets, in arrival order. */
export function foldLedger(text: string): FloorTicket[] {
  return foldFloor(text).tickets;
}

/** True where any ticket carrying this sha holds a GREEN verdict. */
export function shaGreen(tickets: readonly FloorTicket[], sha: string): boolean {
  return tickets.some((t) => t.state === "done" && t.verdict === "GREEN" && sameSha(t.sha, sha));
}

/**
 * Waiting tickets whose sha no green verdict covers, in the order the floor serves them: by TURN (the tickets the ticket's
 * own lane holds taken, plus that lane's waiting tickets ahead of it), arrival breaking a tie. The floor serves lanes.
 */
export function waiting(tickets: readonly FloorTicket[]): FloorTicket[] {
  const taken = new Map<string, number>();
  for (const t of tickets) if (t.state === "taken") taken.set(t.lane, (taken.get(t.lane) ?? 0) + 1);
  const ahead = new Map<string, number>();
  const turns = tickets.filter((t) => t.state === "waiting" && !shaGreen(tickets, t.sha)).map((t) => {
    const n = ahead.get(t.lane) ?? 0;
    ahead.set(t.lane, n + 1);
    return { t, turn: (taken.get(t.lane) ?? 0) + n };
  });
  return turns.sort((a, b) => a.turn - b.turn || a.t.arrived - b.t.arrived).map((x) => x.t);
}

/** The lanes holding a waiting or taken ticket, in the order the floor serves them (lanes with nothing waiting last): `<lane>=<waiting>/<taken>`. */
export function laneRows(tickets: readonly FloorTicket[]): string[] {
  const order: string[] = [];
  const count = new Map<string, { waiting: number; taken: number }>();
  const at = (lane: string): { waiting: number; taken: number } => count.get(lane) ?? count.set(lane, { waiting: 0, taken: 0 }).get(lane)!;
  for (const t of waiting(tickets)) { if (!count.has(t.lane)) order.push(t.lane); at(t.lane).waiting++; }
  for (const t of tickets) if (t.state === "taken") { if (!count.has(t.lane)) order.push(t.lane); at(t.lane).taken++; }
  return order.map((lane) => `${lane}=${at(lane).waiting}/${at(lane).taken}`);
}

/** THE MISSES, one per ticket: a GREEN verdict whose sha drew a RED verdict later in the log, then every ticket a MISS row names. */
export function misses(fold: FloorFold): Map<string, string> {
  const out = new Map<string, string>();
  for (const g of fold.verdicts) {
    if (g.verdict !== "GREEN" || out.has(g.id)) continue;
    const red = fold.verdicts.find((r) => r.verdict === "RED" && r.at > g.at && sameSha(r.sha, g.sha));
    if (red) out.set(g.id, `red after green on ${g.sha.slice(0, 9)} (${red.id})`);
  }
  for (const [id, words] of fold.named) if (!out.has(id)) out.set(id, words);
  return out;
}

/** One token per landing, in log order, then the mean where any landing stands: `<lane>@<merge9>=<runs>/<turns>` · `mean=<runs per landing>`. */
export function landingRows(fold: FloorFold): string[] {
  if (fold.landings.length === 0) return [];
  const sum = fold.landings.reduce((n, l) => n + l.runs, 0);
  return [...fold.landings.map((l) => `${l.lane}@${l.merge.slice(0, 9)}=${l.runs}/${l.turns}`), `mean=${(sum / fold.landings.length).toFixed(2)}`];
}

/** The one-line ticket a hand-back and a floor row carry: `floor ticket <pet>[#<n>] · <branch>@<sha9> · <verb> · <suites>`. */
export function ticketLine(t: FloorTicket): string {
  return `floor ticket ${t.lane}${t.body ? `#${t.body}` : ""} · ${t.branch}@${t.sha.slice(0, 9)} · ${t.owes || "gate · the fold computed no ticket for this row"}`;
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
    ...(t.owes ? [`  owes:  ${t.owes}`] : []),
    ...(t.why ? [`  why:   ${t.why}`] : []),
  ].join("\n");
}

/** One byte-budget row per verdict: what each run wrote and what it took from C:. */
export function budgetRow(t: FloorTicket): string {
  return `${t.id} ${t.verdict ?? "?"} wrote=${t.wrote || "?"} c-drop=${t.cDrop || "?"}`;
}

export const FLOOR_VIEWS = ["waiting", "next", "skip", "taken", "green", "red", "stopped", "dropped", "budget", "ticket", "runs", "sha", "green-sha", "miss", "lane", "runs-per-landing", "line"] as const;
export type FloorView = (typeof FLOOR_VIEWS)[number];

/**
 * One view of the folded ledger, as the filter operator answers it. `arg` names the ticket (ticket, runs, sha, line), the sha
 * (green-sha) or the lane (lane: that lane's waiting tickets; with no lane, every lane in service order). The ratchet views
 * (`miss`, `runs-per-landing`) read the whole fold; handed tickets alone they answer empty. Every row but `ticket`, `line`
 * and `budget` holds no whitespace, so the host's one-line ask splits it whole.
 */
export function floorView(folded: FloorFold | readonly FloorTicket[], view: string, arg = ""): string[] {
  const fold: FloorFold = "tickets" in folded ? folded : { tickets: [...folded], verdicts: [], landings: [], named: new Map() };
  const tickets = fold.tickets;
  const byId = (): FloorTicket | undefined => tickets.find((t) => t.id === arg);
  switch (view) {
    case "miss": return [...misses(fold).keys()];
    case "lane": return arg ? waiting(tickets).filter((t) => t.lane === arg).map((t) => t.id) : laneRows(tickets);
    case "runs-per-landing": return landingRows(fold);
    case "line": { const t = byId(); return t ? [ticketLine(t)] : []; }
    case "": case "waiting": return waiting(tickets).map((t) => t.id);
    case "next": return waiting(tickets).slice(0, 1).map((t) => t.id);
    case "skip": return skippable(tickets).map((t) => t.id);
    case "taken": return tickets.filter((t) => t.state === "taken").map((t) => t.id);
    case "green": case "red": case "stopped":
      return tickets.filter((t) => t.state === "done" && t.verdict === view.toUpperCase()).map((t) => t.id);
    case "dropped": return tickets.filter((t) => t.state === "dropped").map((t) => t.id);
    case "budget": return tickets.filter((t) => t.state === "done").sort((a, b) => a.settled - b.settled).map(budgetRow);
    case "ticket": { const t = byId(); return t ? [ticketBlock(t)] : []; }
    case "runs": { const t = byId(); return t ? (t.runs.length ? [...t.runs] : [DEFAULT_RUN]) : []; }
    case "sha": { const t = byId(); return t ? [t.sha] : []; }
    case "green-sha": return SHA.test(arg) && shaGreen(tickets, arg) ? ["yes"] : [];
    default: throw new Error(`floor-queue: "${view}" names no view; views: ${FLOOR_VIEWS.join(" · ")}`);
  }
}
