/**
 * `lares lei show | kui | unstring | restring | land | terms` — the lei door on the CLI.
 *
 * A lei grants one rite (`push` · `kukulu` · `keep`) at one branch under one reach. Each sub-verb plans one row of the store door and the
 * args it carries (`leiPlan`); the row runs in the vessel, where the hand-only gate, the ward and the co-sign stand:
 *
 *   show       `swarm-show`          reads the board; with `--rite --branch [--head]` it also reads one rite's standing lei (`data.lei`)
 *   kui        `swarm-lei-kui`       strings a lei: wide by default (`--returns <n>`), or `--reach head --head <h>` to pin one head;
 *                                    `--after <lei cid>` names the lei it follows, absent for the first on the line; more than
 *                                    twelve returns asks `--yes`
 *   unstring   `swarm-lei-unstring`  revokes a lei that still holds returns (`--lei <cid>`): a signed record, nothing deleted
 *   restring   `swarm-lei-restring`  supersedes the standing lei with a newer one; the door fills `after` from the line's tip
 *   land       `swarm-lei-kui` · `swarm-lei-unstring` with `signed`: lands a record the hand signed at the pūlama's hand door
 *                                    (`pulama-main.js lei …`), where a vessel under a pūlama sends its lei acts: the line names the
 *                                    pūlama's printed answer (its record and face) or a bare record with `--face`. A lei (a kui,
 *                                    or a restring after the tip it names) rides the kui row, an unstring the unstring row; the
 *                                    vessel verifies the record and asks no route
 *   terms      no row written:       prints ONE stdout line, the terms JSON the pūlama's `lei kui|restring|unstring` takes (the
 *                                    pūlama opens no document, so the host hands it what the vessel knows): `face` from
 *                                    `--face`, else for a keep the keep's face (the face whose keep lei stands, else h0), else
 *                                    the daemon mount; a restring's `after` from the line's tip (`swarm-show`'s `data.lei`).
 *                                    It writes nothing and asks no route
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { helpLines } from "../command-help.js";
import type { ParsedArgs } from "../parse-args.js";
import { emit, exitFor, refuseUsage } from "../render.js";
import { storeFailure, storeVerb } from "../store-door.js";
import { sealedAct } from "../sealed-act-door.js";
import { houseFaces } from "../custody-door.js";
import { keepFaceOf, lineHeld, type HouseFaces } from "../rite-keep.js";
import type { RiteVerbAnswer } from "../rite-kukulu.js";

export class LeiUsage extends Error {}
/** A terms line the vessel's own reading refuses, by name: no lei to restring, a forked line, a keep lei standing unseen. */
export class LeiTermsRefused extends Error { constructor(readonly code: string, message: string) { super(message); } }

export type LeiVerb = "swarm-show" | "swarm-lei-kui" | "swarm-lei-unstring" | "swarm-lei-restring";
export interface LeiPlan { readonly verb: LeiVerb; readonly args: Record<string, unknown> }

const ACTS: Readonly<Record<string, LeiVerb>> = { show: "swarm-show", kui: "swarm-lei-kui", unstring: "swarm-lei-unstring", restring: "swarm-lei-restring" };

/** One sub-verb's store row and args, or a `LeiUsage` naming what the line lacks. The vessel's door judges the values. */
/** `land`: the row a hand record lands by, its record as `signed`, and the face the pūlama's answer or the line names. */
function landPlan(args: ParsedArgs): LeiPlan {
  if (args.positional.length !== 2) throw new LeiUsage("land names one record: the pūlama's answer, or a bare record with --face N");
  let read: unknown;
  try { read = JSON.parse(args.positional[1]!); } catch { throw new LeiUsage("land's record reads as no JSON"); }
  if (typeof read !== "object" || read === null || Array.isArray(read)) throw new LeiUsage("land's record reads as no object");
  const r = read as Record<string, unknown>;
  // THE PŪLAMA'S ANSWER carries the record and its face; a refusal it answered signed nothing to land.
  const answer = r["op"] === "lei";
  if (answer && r["reading"] !== "signed") throw new LeiUsage(`the pūlama signed nothing (${String(r["reading"])}), so nothing lands`);
  const record = (answer ? r["record"] : r) as Record<string, unknown> | undefined;
  const act = (record?.["body"] as { act?: unknown } | undefined)?.act;
  const verb: LeiVerb | null = act === "lei" ? "swarm-lei-kui" : act === "lei-unstrung" ? "swarm-lei-unstring" : null;
  if (verb === null) throw new LeiUsage("land's record names no lei and no unstring");
  const raw = args.options["face"];
  const named = raw === undefined ? undefined : /^(?:0|[1-9][0-9]*)$/.test(raw.trim()) ? Number(raw.trim()) : NaN;
  if (named !== undefined && !Number.isSafeInteger(named)) throw new LeiUsage("--face takes a whole count from 0");
  const carried = answer && typeof r["face"] === "number" ? r["face"] as number : undefined;
  if (named !== undefined && carried !== undefined && named !== carried) throw new LeiUsage(`the pūlama signed for h${carried}, and the line names h${named}`);
  const face = carried ?? named;
  return { verb, args: { signed: record, ...(face !== undefined ? { face } : {}) } };
}

export function leiPlan(args: ParsedArgs): LeiPlan {
  const sub = args.positional[0];
  if (sub === "land") return landPlan(args);
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
  const rite = word(args.options["rite"]), branch = word(args.options["branch"]);
  const head = word(args.options["head"]);
  const face = count("face", word(args.options["face"]), 0);
  if (sub === "show") {
    // The board reads with no line named; one rite's line reads by rite and branch, and a head rides along to ask after one head.
    if ([rite, branch, head].some((x) => x !== undefined)) {
      if (rite === undefined || branch === undefined) throw new LeiUsage("show reads one rite's line by --rite and --branch together (--head asks after one head)");
      Object.assign(out, { rite, branch, ...(head !== undefined ? { head } : {}) });
    }
  } else {
    if (rite === undefined) throw new LeiUsage("name the lei's rite: --rite push | kukulu | keep");
    if (branch === undefined) throw new LeiUsage("name the lei's branch: --branch <name>");
    Object.assign(out, { rite, branch });
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
  kui: ["returns", "reach", "head", "after", "yes"],
  restring: ["returns", "reach", "head", "yes"],
  unstring: ["lei"],
};
const LEI_FLAGS = ["rite", "branch", "face", "returns", "reach", "head", "after", "lei", "yes"] as const;

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
  if (act === "restring") {
    // THE LINE'S TIP, as `lares lei show --rite --branch` reads it (`data.lei.after`): the lei the restring follows.
    line ??= await ports.show(String(a["rite"]), String(a["branch"]), face);
    if (!line.ok) throw new LeiTermsRefused(line.code, line.message);
    const lei = (line.output["lei"] ?? {}) as { after?: unknown; forks?: unknown };
    if (Array.isArray(lei.forks) && lei.forks.length > 1) throw new LeiTermsRefused("swarm-lei-forked", `the ${String(a["rite"])} line at "${String(a["branch"])}" forks (${lei.forks.join(", ")}); name one tip with a kui --after`);
    if (typeof lei.after !== "string" || lei.after === "") throw new LeiTermsRefused("swarm-lei-nothing-to-restring", `no lei stands on the ${String(a["rite"])} line at "${String(a["branch"])}" for h${face}; a kui strings its first`);
    after = lei.after;
  }
  const out: Record<string, unknown> = { face, rite: a["rite"], branch: a["branch"] };
  for (const key of ["reach", "returns", "head"] as const) if (a[key] !== undefined) out[key] = a[key];
  if (act !== "unstring") out["after"] = after ?? null;
  if (a["confirm"] === true) out["confirm"] = true;
  if (a["lei"] !== undefined) out["lei"] = a["lei"];
  return out;
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
    emit(args, { ok: false, error: failure, human: () => console.error(`lares lei: ${failure.message}`) });
    return exitFor(failure.code);
  }
}

export async function cmdLei(args: ParsedArgs): Promise<number> {
  if (args.positional[0] === "terms") return cmdLeiTerms(args);
  let plan: LeiPlan;
  try { plan = leiPlan(args); }
  catch (err) {
    if (err instanceof LeiUsage) return refuseUsage(args, "lei", helpLines("lei"), err.message);
    throw err;
  }
  try {
    const { output } = await storeVerb(plan.verb, plan.args);
    emit(args, { ok: true, data: output, human: () => console.log(JSON.stringify(output)) });
    return 0;
  } catch (err) {
    const failure = storeFailure(err);
    emit(args, { ok: false, error: failure, human: () => console.error(`lares lei: ${failure.message}`) });
    return exitFor(failure.code);
  }
}
