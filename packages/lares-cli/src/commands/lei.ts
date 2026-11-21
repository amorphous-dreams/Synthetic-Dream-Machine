/**
 * `lares lei show | kui | unstring | restring | land | terms` — the lei door on the CLI.
 *
 * A lei grants one rite (`push` · `kukulu` · `keep`) at one branch under one reach. Each sub-verb plans one row of the store door and the
 * args it carries (`leiPlan`); the row runs in the vessel, where the hand-only gate, the ward and the co-sign stand:
 *
 *   show       `swarm-show`          reads the board; with `--rite --branch [--head]` it also reads one rite's standing lei (`data.lei`);
 *                                    naming no face with several faces open, it reads every open face's line (`data.faces`)
 *   kui        `swarm-lei-kui`       strings a lei: wide by default (`--returns <n>`), or `--reach head --head <h>` to pin one head;
 *                                    with no `--after` it follows the line's own tip (the first on an empty line);
 *                                    a named `--after` that is no tip refuses as forked, before any route or signature; more than
 *                                    twelve returns asks `--yes`. `--all` (push, kukulu) strings one lei for EVERY open face under
 *                                    ONE route: each face's own record by its own hand, at its own line's tip; `data.faces` names
 *                                    each face's cid (`lei`). A lei stays one face's record; only the act gathers them
 *   unstring   `swarm-lei-unstring`  revokes a lei that still holds returns (`--lei <cid>`): a signed record, nothing deleted
 *   restring   `swarm-lei-restring`  supersedes the standing lei with a newer one; the door fills `after` from the line's tip
 *   land       `swarm-lei-kui` · `swarm-lei-unstring` with `signed`: lands a record the hand signed at the pūlama's hand door
 *                                    (`pulama-main.js lei …`), where a vessel under a pūlama sends its lei acts: the line names the
 *                                    pūlama's printed answer (its record and face) or a bare record with `--face`. A lei (a kui,
 *                                    or a restring after the tip it names) rides the kui row, an unstring the unstring row; the
 *                                    vessel verifies the record and asks no route. An answer for every face (`faces`) lands each
 *                                    face's record by its own face, and names where the pūlama's signing stopped (`stopped`)
 *   terms      no row written:       prints ONE stdout line, the terms JSON the pūlama's `lei kui|restring|unstring` takes (the
 *                                    pūlama opens no document, so the host hands it what the vessel knows): `face` from
 *                                    `--face`, else for a keep the keep's face (the face whose keep lei stands, else h0), else
 *                                    the daemon mount; a restring's `after` from the line's tip (`swarm-show`'s `data.lei`).
 *                                    `kui --all` prints `{ "faces": [ … ] }`, one terms object per open face at its own tip.
 *                                    It writes nothing and asks no route
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { helpLines } from "../command-help.js";
import type { ParsedArgs } from "../parse-args.js";
import { emit, emitAnswer, exitFor, refuseUsage } from "../render.js";
import { storeFailure, storeVerb } from "../store-door.js";
import { sealedAct } from "../sealed-act-door.js";
import { houseFaces } from "../custody-door.js";
import { gatherWardRoute } from "../ward-door.js";
import { keepFaceOf, lineHeld, type HouseFaces } from "../rite-keep.js";
import type { RiteVerbAnswer } from "../rite-kukulu.js";
import { execLeiBranch } from "@lararium/mesh";

export class LeiUsage extends Error {}
/** A terms line the vessel's own reading refuses, by name: no lei to restring, a forked line, a keep lei standing unseen. */
export class LeiTermsRefused extends Error { constructor(readonly code: string, message: string) { super(message); } }

export type LeiVerb = "swarm-show" | "swarm-lei-kui" | "swarm-lei-unstring" | "swarm-lei-restring";
export interface LeiPlan { readonly verb: LeiVerb; readonly args: Record<string, unknown> }

const ACTS: Readonly<Record<string, LeiVerb>> = { show: "swarm-show", kui: "swarm-lei-kui", unstring: "swarm-lei-unstring", restring: "swarm-lei-restring" };

/** One pūlama answer's (or a bare record's) row: the record as `signed`, and the face the answer or the line names. */
function landRow(r: Record<string, unknown>, named: number | undefined): LeiPlan {
  // THE PŪLAMA'S ANSWER carries the record and its face; a bare record carries neither answer nor face.
  const answer = r["op"] === "lei";
  const record = (answer ? r["record"] : r) as Record<string, unknown> | undefined;
  const act = (record?.["body"] as { act?: unknown } | undefined)?.act;
  const verb: LeiVerb | null = act === "lei" ? "swarm-lei-kui" : act === "lei-unstrung" ? "swarm-lei-unstring" : null;
  if (verb === null) throw new LeiUsage("land's record names no lei and no unstring");
  const carried = answer && typeof r["face"] === "number" ? r["face"] as number : undefined;
  if (named !== undefined && carried !== undefined && named !== carried) throw new LeiUsage(`the pūlama signed for h${carried}, and the line names h${named}`);
  const face = carried ?? named;
  return { verb, args: { signed: record, ...(face !== undefined ? { face } : {}) } };
}

/** Where a signing for every face stopped: the face that refused, and its reading. */
export interface LeiLandStop { readonly face?: number; readonly reading: string; readonly detail?: string }

/**
 * `land`: the rows the hand's records land by. One answer (or a bare record) lands one row; the answer of one stringing for every
 * face (`faces`) lands one row per face that signed, each by its own face, and names where the signing stopped (`stopped`).
 * An answer that signed nothing lands nothing and refuses by usage.
 */
export function leiLandPlans(args: ParsedArgs): { readonly plans: readonly LeiPlan[]; readonly stopped?: LeiLandStop } {
  if (args.positional.length !== 2) throw new LeiUsage("land names one record: the pūlama's answer, or a bare record with --face N");
  let read: unknown;
  try { read = JSON.parse(args.positional[1]!); } catch { throw new LeiUsage("land's record reads as no JSON"); }
  if (typeof read !== "object" || read === null || Array.isArray(read)) throw new LeiUsage("land's record reads as no object");
  const r = read as Record<string, unknown>;
  const raw = args.options["face"];
  const named = raw === undefined ? undefined : /^(?:0|[1-9][0-9]*)$/.test(raw.trim()) ? Number(raw.trim()) : NaN;
  if (named !== undefined && !Number.isSafeInteger(named)) throw new LeiUsage("--face takes a whole count from 0");
  if (r["op"] === "lei" && Array.isArray(r["faces"])) {
    if (named !== undefined) throw new LeiUsage("an answer for every face names each record's face; land it with no --face");
    const each = (r["faces"] as unknown[]).filter((f): f is Record<string, unknown> => typeof f === "object" && f !== null && !Array.isArray(f));
    const signed = each.filter((f) => f["reading"] === "signed");
    const stop = each.find((f) => f["reading"] !== "signed");
    if (signed.length === 0) throw new LeiUsage(`the pūlama signed nothing (${String(r["reading"])}), so nothing lands`);
    return { plans: signed.map((f) => landRow(f, undefined)),
      ...(stop ? { stopped: { ...(typeof stop["face"] === "number" ? { face: stop["face"] } : {}), reading: String(stop["reading"]), ...(typeof stop["detail"] === "string" ? { detail: stop["detail"] } : {}) } } : {}) };
  }
  // A refusal the pūlama answered signed nothing to land.
  if (r["op"] === "lei" && r["reading"] !== "signed") throw new LeiUsage(`the pūlama signed nothing (${String(r["reading"])}), so nothing lands`);
  return { plans: [landRow(r, named)] };
}

/** One sub-verb's store row and args, or a `LeiUsage` naming what the line lacks. The vessel's door judges the values. */
export function leiPlan(args: ParsedArgs): LeiPlan {
  const sub = args.positional[0];
  const verb = sub === undefined ? undefined : ACTS[sub];
  if (verb === undefined) throw new LeiUsage("name a sub-verb: show, kui, unstring, restring, land or terms");
  // Each flag reads by its own literal name, so the accepts law walks them.
  const word = (raw: string | undefined): string | undefined => (typeof raw === "string" && raw.trim() !== "" ? raw.trim() : undefined);
  const count = (name: string, raw: string | undefined, from: number): number | undefined => {
    if (raw === undefined) return undefined;
    if (!/^(?:0|[1-9][0-9]*)$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) < from) throw new LeiUsage(`--${name} takes a whole count from ${from}`);
    return Number(raw);
  };
  const out: Record<string, unknown> = {};
  const rite = word(args.options["rite"]);
  // AN EXEC LEI'S SCOPE (`--scope '<json>'`: its wiki, the writer, and a title set or one class): the branch derives from the wiki.
  const scopeRaw = word(args.options["scope"]);
  let scope: Record<string, unknown> | undefined;
  if (scopeRaw !== undefined) {
    if (rite !== "exec") throw new LeiUsage("only an exec lei names a --scope");
    try { scope = JSON.parse(scopeRaw) as Record<string, unknown>; } catch { throw new LeiUsage("--scope takes one JSON object: {\"wiki\":…,\"writer\":…, \"titles\":[…] | \"class\":…}"); }
    if (typeof scope !== "object" || scope === null || Array.isArray(scope) || typeof scope["wiki"] !== "string") throw new LeiUsage("--scope names its wiki, the writer, and a title set or one class");
  } else if (rite === "exec" && args.positional[0] !== "show" && args.positional[0] !== "unstring") throw new LeiUsage("an exec lei names its --scope '<json>' (wiki, writer, titles or class)");
  const branch = word(args.options["branch"]) ?? (scope ? execLeiBranch(scope["wiki"] as string) : undefined);
  const head = word(args.options["head"]);
  const face = count("face", word(args.options["face"]), 0);
  // ONE STRINGING FOR EVERY FACE (`--all`): a kui alone, each open face's lei by its own hand at its own line's tip, so it names
  // no face and no `after`; a keep stands one per house and an exec lei names one writer, so neither strings that way.
  const all = args.flags["all"] === true;
  if (all) {
    if (sub !== "kui") throw new LeiUsage("only a kui strings for every open face (--all)");
    if (face !== undefined) throw new LeiUsage("--all strings for every open face; it names no --face");
    if (word(args.options["after"]) !== undefined) throw new LeiUsage("--all follows each face's own line's tip; it names no --after");
    if (rite === "keep" || rite === "exec") throw new LeiUsage(`a ${rite} lei names one face, so it strings with no --all`);
  }
  if (sub === "show") {
    // The board reads with no line named; one rite's line reads by rite and branch, and a head rides along to ask after one head.
    if ([rite, branch, head].some((x) => x !== undefined)) {
      if (rite === undefined || branch === undefined) throw new LeiUsage("show reads one rite's line by --rite and --branch together (--head asks after one head)");
      Object.assign(out, { rite, branch, ...(head !== undefined ? { head } : {}) });
    }
  } else {
    if (rite === undefined) throw new LeiUsage("name the lei's rite: --rite push | kukulu | keep | exec");
    if (branch === undefined) throw new LeiUsage("name the lei's branch: --branch <name>");
    Object.assign(out, { rite, branch, ...(scope !== undefined && (sub === "kui" || sub === "restring") ? { scope } : {}) });
    if (sub === "unstring") {
      const lei = word(args.options["lei"]);
      if (lei === undefined) throw new LeiUsage("name the lei to unstring by its cid: --lei <cid>");
      out["lei"] = lei;
    } else if (sub === "kui" || sub === "restring") {
      const reach = word(args.options["reach"]);
      const returns = count("returns", word(args.options["returns"]), 1);
      if (reach !== undefined) out["reach"] = reach;
      if (returns !== undefined) out["returns"] = returns;
      if (head !== undefined) out["head"] = head;
      const after = word(args.options["after"]);
      if (sub === "restring") { if (after !== undefined) throw new LeiUsage("a restring follows the line's tip; it names no --after"); }
      else if (all) out["all"] = true;
      else out["after"] = after ?? null;
      // A count above twelve strings only with the hand's explicit confirm (`--yes`).
      if (args.flags["yes"] === true) out["confirm"] = true;
    }
  }
  if (face !== undefined) out["face"] = face;
  return { verb, args: out };
}

/** What the terms read from the vessel: one rite's line at a face, the faces the house holds, the daemon mount. */
export interface LeiTermsPorts {
  show(rite: string, branch: string, face: number): Promise<RiteVerbAnswer>;
  houseFaces(): Promise<HouseFaces>;
  mountFace(): Promise<number>;
}

/** The flags each pūlama act takes beside `--rite`, `--branch` and `--face`; any other lei flag refuses. */
const TERMS_TAKES: Readonly<Record<string, readonly string[]>> = {
  kui: ["returns", "reach", "head", "after", "yes", "scope", "all"],
  restring: ["returns", "reach", "head", "yes", "scope"],
  unstring: ["lei"],
};
const LEI_FLAGS = ["rite", "branch", "face", "returns", "reach", "head", "after", "lei", "yes", "scope", "all"] as const;

/** One face's terms object, in the pūlama's order: `face`, `rite`, `branch`, then the act's own. */
function termsAt(act: string, a: Readonly<Record<string, unknown>>, face: number, after: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = { face, rite: a["rite"], branch: a["branch"] };
  for (const key of ["reach", "returns", "head", "scope"] as const) if (a[key] !== undefined) out[key] = a[key];
  if (act !== "unstring") out["after"] = after ?? null;
  if (a["confirm"] === true) out["confirm"] = true;
  if (a["lei"] !== undefined) out["lei"] = a["lei"];
  return out;
}

/**
 * EVERY OPEN FACE'S TERMS (`kui --all`): one object per face the house holds open, ascending, each following its own line's tip
 * (`swarm-show`'s `data.lei.after`, null where the line holds none). A forked line on any face refuses by name before anything signs.
 */
async function everyFaceTerms(a: Readonly<Record<string, unknown>>, ports: LeiTermsPorts): Promise<Record<string, unknown>[]> {
  const open = [...(await ports.houseFaces()).open].sort((x, y) => x - y);
  if (open.length === 0) throw new LeiTermsRefused("face-none-open", "no face stands open to string a lei for: open one (`lares vault unlock`)");
  const rite = String(a["rite"]), branch = String(a["branch"]);
  const out: Record<string, unknown>[] = [];
  for (const face of open) {
    const line = await ports.show(rite, branch, face);
    if (!line.ok) throw new LeiTermsRefused(line.code, `h${face}: ${line.message}`);
    const lei = (line.output["lei"] ?? {}) as { after?: unknown; forks?: unknown };
    if (Array.isArray(lei.forks) && lei.forks.length > 1) throw new LeiTermsRefused("swarm-lei-forked", `the ${rite} line at "${branch}" forks for h${face} (${lei.forks.join(", ")}); name one tip with a kui --after --face ${face}`);
    out.push(termsAt("kui", a, face, typeof lei.after === "string" && lei.after !== "" ? lei.after : null));
  }
  return out;
}

/**
 * The `after` a kui follows, read off the line (`swarm-show`'s `data.lei`): the line's one tip when none is named (null where the line
 * holds none); a named `after` that is no tip of the line refuses by the door's own names (`swarm-lei-forked`, or
 * `swarm-lei-after-moved` where the line holds no lei), so the vessel predicts what its door would refuse.
 */
export function kuiAfter(line: RiteVerbAnswer, rite: string, branch: string, face: number, named: string | undefined): string | null {
  if (!line.ok) throw new LeiTermsRefused(line.code, line.message);
  const lei = (line.output["lei"] ?? {}) as { after?: unknown; forks?: unknown };
  const forks = Array.isArray(lei.forks) && lei.forks.length > 1 ? lei.forks.map(String) : [];
  const tip = typeof lei.after === "string" && lei.after !== "" ? lei.after : null;
  if (forks.length > 0) {
    if (named !== undefined && forks.includes(named)) return named;
    throw new LeiTermsRefused("swarm-lei-forked", `the ${rite} line at "${branch}" forks for h${face} (${forks.join(", ")}); name one tip with --after`);
  }
  if (named === undefined) return tip;
  if (named === tip) return tip;
  if (tip === null) throw new LeiTermsRefused("swarm-lei-after-moved", `no lei stands on the ${rite} line at "${branch}" for h${face}; a kui strings its first with no --after`);
  throw new LeiTermsRefused("swarm-lei-forked", `a lei at "${branch}" already follows ${named}; name the chain's tip ${tip}`);
}

/**
 * `terms`: the one JSON object the pūlama's `lei <act>` takes, in its order (`face`, `rite`, `branch`, then `reach` ·
 * `returns` · `head` · `after` · `confirm` · `lei` as the act carries them). It reads and writes nothing else.
 */
export async function leiTerms(args: ParsedArgs, ports: LeiTermsPorts): Promise<Record<string, unknown>> {
  const act = args.positional[1];
  if (args.positional.length !== 2 || act === undefined || !(act in TERMS_TAKES)) throw new LeiUsage("terms names one pūlama act: kui, restring or unstring");
  const takes = new Set(["rite", "branch", "face", ...TERMS_TAKES[act]!]);
  const stray = [...Object.keys(args.options), ...Object.keys(args.flags)].find((n) => (LEI_FLAGS as readonly string[]).includes(n) && !takes.has(n));
  if (stray !== undefined) throw new LeiUsage(`a ${act} takes no --${stray}`);
  // The values read as the vessel's own acts read them (`leiPlan`), so a terms line and a direct act agree.
  const plan = leiPlan({ ...args, positional: [act] });
  const a = plan.args;
  if (a["all"] === true) return { faces: await everyFaceTerms(a, ports) };
  let line: RiteVerbAnswer | null = null;
  let face: number;
  if (typeof a["face"] === "number") face = a["face"];
  else if (a["rite"] === "keep") {
    // THE KEEP'S FACE, ONE PER HOUSE: the face whose keep lei stands, else h0 (`keepFaceOf`); a lei that may stand on a face
    // shut or unread refuses, as the keep itself refuses, so no second keep line strings beside it.
    const house = await ports.houseFaces();
    const keep = await keepFaceOf((at) => ports.show(String(a["rite"]), String(a["branch"]), at), house.open);
    face = keep.face;
    line = keep.line;
    const unread = keep.unread.filter((f) => f !== keep.face);
    if (!lineHeld(keep.line) && (house.shut.length > 0 || unread.length > 0)) {
      const where = [...(house.shut.length > 0 ? [`a face not open (${house.shut.map((f) => `h${f}`).join(", ")})`] : []),
        ...(unread.length > 0 ? [`a face not read (${unread.map((f) => `h${f}`).join(", ")})`] : [])].join(" or ");
      throw new LeiTermsRefused("keep-lei-unseen", `no keep lei read standing at "${String(a["branch"])}", and one may stand on ${where}: open that face, or name it with --face N`);
    }
  } else face = await ports.mountFace();
  let after: unknown = a["after"];
  if (act === "kui") {
    // A KUI NAMES THE LINE'S TIP ITSELF: unnamed, it follows the tip the line stands at (null for a line's first); a named `after`
    // that is no tip refuses here, before the pūlama asks the hand to sign what the vessel would refuse.
    line ??= await ports.show(String(a["rite"]), String(a["branch"]), face);
    after = kuiAfter(line, String(a["rite"]), String(a["branch"]), face, args.options["after"]?.trim() || undefined);
  }
  if (act === "restring") {
    // THE LINE'S TIP, as `lares lei show --rite --branch` reads it (`data.lei.after`): the lei the restring follows.
    line ??= await ports.show(String(a["rite"]), String(a["branch"]), face);
    if (!line.ok) throw new LeiTermsRefused(line.code, line.message);
    const lei = (line.output["lei"] ?? {}) as { after?: unknown; forks?: unknown };
    if (Array.isArray(lei.forks) && lei.forks.length > 1) throw new LeiTermsRefused("swarm-lei-forked", `the ${String(a["rite"])} line at "${String(a["branch"])}" forks (${lei.forks.join(", ")}); name one tip with a kui --after`);
    if (typeof lei.after !== "string" || lei.after === "") throw new LeiTermsRefused("swarm-lei-nothing-to-restring", `no lei stands on the ${String(a["rite"])} line at "${String(a["branch"])}" for h${face}; a kui strings its first`);
    after = lei.after;
  }
  return termsAt(act, a, face, after);
}

/** The terms' live ports: the swarm-show row through the store door, the custody door's census, the face the vessel wears. */
const TERMS_PORTS: LeiTermsPorts = {
  show: async (rite, branch, face) => {
    try { return { ok: true, output: (await storeVerb("swarm-show", { rite, branch, face })).output }; }
    catch (err) { const failure = storeFailure(err); return { ok: false, code: failure.code, message: failure.message }; }
  },
  houseFaces: async () => houseFaces(),
  // THE DAEMON MOUNT: the one face open, or with several open the face the daemon island mounts (`face.resolve` worn).
  mountFace: async () => (await sealedAct<{ face: number }>("face.resolve", { worn: true })).face,
};

/**
 * THE TERMS LINE RIDES BARE: the host shim captures stdout through a pipe, where every other door answers its JSON
 * envelope, so the terms print as the one line the pūlama takes, and a refusal prints on stderr alone (nothing on stdout,
 * a non-zero exit). Only an explicit `--json` asks the envelope.
 */
async function cmdLeiTerms(line: ParsedArgs): Promise<number> {
  const args: ParsedArgs = { ...line, flags: { ...line.flags, json: line.flags["json"] === true } };
  try {
    const terms = await leiTerms(args, TERMS_PORTS);
    emit(args, { ok: true, data: terms, human: () => console.log(JSON.stringify(terms)) });
    return 0;
  } catch (err) {
    if (err instanceof LeiUsage) return refuseUsage(args, "lei", helpLines("lei"), err.message);
    const failure = err instanceof LeiTermsRefused ? { code: err.code, message: err.message } : storeFailure(err);
    emitAnswer(args, { ok: false, error: failure, human: () => console.error(`lares lei: ${failure.message}`) }, `lares lei: ${failure.message}`);
    return exitFor(failure.code);
  }
}

/** A line that answers one row per face: each face's answer, and where the line stopped (the face, by its refusal). */
async function perFace(args: ParsedArgs, head: Record<string, unknown>, rows: ReadonlyArray<{ readonly face?: number; run(): Promise<Record<string, unknown>> }>, stopped?: LeiLandStop): Promise<number> {
  const faces: Record<string, unknown>[] = [];
  for (const row of rows) {
    try { faces.push({ ...(row.face !== undefined ? { face: row.face } : {}), ...await row.run() }); }
    catch (err) {
      const failure = storeFailure(err);
      const at = row.face !== undefined ? `h${row.face}: ` : "";
      emitAnswer(args, { ok: false, data: { ...head, faces }, error: { code: failure.code, message: `${at}${failure.message}` }, human: () => { console.log(JSON.stringify({ ...head, faces })); console.error(`lares lei: ${at}${failure.message}`); } }, `lares lei: ${at}${failure.message}`);
      return exitFor(failure.code);
    }
  }
  const data = { ...head, faces, ...(stopped ? { stopped } : {}) };
  if (stopped) {
    const message = `the pūlama stopped at ${stopped.face !== undefined ? `h${stopped.face}` : "a face"} (${stopped.reading}); the faces it signed before landed`;
    emitAnswer(args, { ok: false, data, error: { code: stopped.reading, message }, human: () => { console.log(JSON.stringify(data)); console.error(`lares lei: ${message}`); } }, `lares lei: ${message}`);
    return exitFor(stopped.reading);
  }
  emitAnswer(args, { ok: true, data, human: () => console.log(JSON.stringify(data)) }, `lares lei: ${faces.length} face${faces.length === 1 ? "" : "s"} answered`);
  return 0;
}

export async function cmdLei(args: ParsedArgs): Promise<number> {
  if (args.positional[0] === "terms") return cmdLeiTerms(args);
  let plan: LeiPlan;
  let landing: ReturnType<typeof leiLandPlans> | null = null;
  try {
    if (args.positional[0] === "land") { landing = leiLandPlans(args); plan = landing.plans[0]!; }
    else plan = leiPlan(args);
  }
  catch (err) {
    if (err instanceof LeiUsage) return refuseUsage(args, "lei", helpLines("lei"), err.message);
    throw err;
  }
  const run = (p: LeiPlan, route?: Parameters<typeof storeVerb>[4]) => async () => (await storeVerb(p.verb, p.args, undefined, undefined, route)).output;
  // THE ANSWER OF ONE STRINGING FOR EVERY FACE lands each face's record by its own face.
  if (landing !== null && (landing.plans.length > 1 || landing.stopped !== undefined)) {
    return perFace(args, {}, landing.plans.map((p) => ({ ...(typeof p.args["face"] === "number" ? { face: p.args["face"] } : {}), run: run(p) })), landing.stopped);
  }
  const { all, ...rowArgs } = plan.args;
  const line = { rite: plan.args["rite"], branch: plan.args["branch"] };
  try {
    // ONE STRINGING FOR EVERY FACE (no pūlama): ONE route for every open face, each face's kui by its own hand at its own line's tip.
    if (all === true) {
      const every = await everyFaceTerms(rowArgs, TERMS_PORTS);
      const route = await gatherWardRoute(`lares lei kui --all (${every.map((t) => `h${String(t["face"])}`).join(", ")})`);
      return await perFace(args, line, every.map((t) => ({ face: t["face"] as number, run: run({ verb: "swarm-lei-kui", args: t }, route) })));
    }
    // ONE LINE NAMING NO FACE with several faces open reads every open face's line.
    if (plan.verb === "swarm-show" && plan.args["rite"] !== undefined && plan.args["face"] === undefined) {
      const open = [...(await houseFaces()).open].sort((x, y) => x - y);
      if (open.length > 1) return await perFace(args, line, open.map((face) => ({ face, run: run({ verb: "swarm-show", args: { ...plan.args, face } }) })));
    }
    // A KUI WITH NO PŪLAMA NAMES THE LINE'S TIP ITSELF, as `terms` does: one read of the line (and a refusal the vessel predicts, before
    // any route is asked), then the row at that face and tip.
    let row = plan;
    if (landing === null && plan.verb === "swarm-lei-kui") {
      const read = await leiTerms({ ...args, positional: ["terms", "kui"] }, TERMS_PORTS);
      row = { verb: plan.verb, args: { ...rowArgs, face: read["face"], after: read["after"] } };
    }
    const output = await run(row)();
    emitAnswer(args, { ok: true, data: output, human: () => console.log(JSON.stringify(output)) }, `lares lei ${String(args.positional[0])}: done`);
    return 0;
  } catch (err) {
    const failure = err instanceof LeiTermsRefused ? { code: err.code, message: err.message } : storeFailure(err);
    emitAnswer(args, { ok: false, error: failure, human: () => console.error(`lares lei: ${failure.message}`) }, `lares lei: ${failure.message}`);
    return exitFor(failure.code);
  }
}
