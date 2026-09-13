/**
 * carrier-lifecycle — the STAGE a governed carrier stands in, read off the mechanism TiddlyWiki runs.
 *
 * ── THE STAGE RIDES `tags`, AND THAT IS THE WHOLE POINT ─────────────────────────────────────────
 * A stage held in a meta key of its own reaches the reader of raw `.mem` bytes and nobody else — no
 * filter answers it, no template surfaces it, nothing renders. `tags` already carries a carrier's
 * bindings through TiddlyWiki's own indexes, so `[tag[lifecycle/designed]]` answers inside the wiki
 * the day the tag lands and the stage becomes something a reader can SEE rather than something a
 * spirit must open a file to learn.
 *
 * ── GOVERNED IS THE NARROW CASE ─────────────────────────────────────────────────────────────────
 * Measured over `bags/*.mem`: 726 carriers, 59 carrying any stage word at all. A reference table, a
 * library index, a fiction-canon concept, a law — none of them enters a lifecycle, and a gate that
 * read absence as a stage would fault the shelf entire. So a carrier carrying no `lifecycle/*` tag
 * stands UNGOVERNED and this reader enforces nothing new on it. The ladder stays cheap to decline.
 *
 * ── KIND IS A SECOND AXIS, NEVER A RUNG ─────────────────────────────────────────────────────────
 * `talk-story` and `hoike` stand as full canon and will never "advance", because nothing about them
 * awaits a build — a practice is convened, not built. Seating `rite` as a stage after `standing`
 * makes a completed practice read as a way-station, so a KIND rides `kind/*` beside the stage and a
 * `kind/rite` carrier that names no stage stays ungoverned.
 *
 * ── WHAT THIS READER CANNOT ANSWER ──────────────────────────────────────────────────────────────
 * `folded` and `retiring` both owe ZERO INBOUND EDGES, and inbound is a property of the SHELF rather
 * than of a file — no reader holding one carrier's bytes can see who names it. That half of the law
 * rides `lares meme check --edges` and `lares meme sitting`, which hold every carrier at once. This
 * module answers only what a single text can answer, and says so by answering nothing else.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/otakiage
 */

import { fencedSpans, inMask } from "./meme-ast/fence-mask.js";
import { META_OPEN_RE } from "./meta-fence.js";

/** The five standings a governed carrier holds, in order. */
export const LIFECYCLE_STAGES = ["designed", "standing", "folded", "harvest", "retiring"] as const;

export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

/**
 * The meta keys the stage replaced, sorted.
 *
 * `status` fused two axes into one key and no code ever read it; `retain` carried a disposition
 * office the tree never wired (measured: zero readers across `packages/(star)/src`). Both retire to ONE
 * SPELLING — the tag. `status-why` STAYS: the witness sentence is the half a tag cannot carry, and
 * `cacheable` STAYS because it instructs the API server behind the Lares rather than this house.
 */
export const RETIRED_META_KEYS = ["retain", "status"] as const;

/** Each retired key beside the sentence a normalize run hands the author who still writes it. */
export const RETIRED_KEY_NOTES: ReadonlyArray<readonly [string, string]> = [
  ["retain", "`retain` retired — the disposition rides the `lifecycle/*` tag"],
  ["status", "`status` retired — the stage rides `tags`"],
];

export interface CarrierLifecycle {
  /** The stage the carrier stands in, or `null` where it declines the ladder. */
  readonly stage: LifecycleStage | null;
  /** Every stage tag the carrier writes — more than one names a collision the check reports. */
  readonly stages: readonly LifecycleStage[];
  /** The `kind/*` tags, bare: `rite` · `build` · `reading` · `floor`. */
  readonly kinds: readonly string[];
  /** The living bag a `harvest` carrier folds into, as written. */
  readonly harvestTo: string | null;
  /** Which retired keys the carrier still writes. */
  readonly retiredKeys: readonly string[];
}

/** The toml meta fence body, or null where the carrier writes none. */
function metaBody(text: string): string | null {
  const open = new RegExp(META_OPEN_RE.source).exec(text);
  if (!open) return null;
  const from = open.index + open[0].length;
  const close = text.indexOf("\n```", from);
  return text.slice(from, close < 0 ? text.length : close);
}

/** One top-level toml value from a meta body, raw and unquoted. */
function metaValue(body: string, key: string): string | null {
  const m = new RegExp(String.raw`^[ \t]*${key}[ \t]*=[ \t]*(.*)$`, "m").exec(body);
  if (!m) return null;
  return m[1]!.trim().replace(/^"(.*)"$/, "$1");
}

/**
 * Every tag a carrier writes.
 *
 * The corpus spells `tags` as a one-line toml array in all but one carrier, and that one opens the
 * bracket and runs several lines. Reading from the opening bracket to the first `]` takes both
 * spellings without asking which the author used.
 */
export function readCarrierTags(text: string): string[] {
  const body = metaBody(text);
  if (!body) return [];
  const open = /^[ \t]*tags[ \t]*=[ \t]*\[/m.exec(body);
  if (!open) return [];
  const from = open.index + open[0].length;
  const close = body.indexOf("]", from);
  const inner = body.slice(from, close < 0 ? body.length : close);
  return [...inner.matchAll(/"([^"]*)"/g)].map((m) => m[1]!).filter(Boolean);
}

const STAGE_SET: ReadonlySet<string> = new Set(LIFECYCLE_STAGES);

/** The lifecycle a carrier declares, read from its tags and its meta. */
export function readCarrierLifecycle(text: string): CarrierLifecycle {
  const tags = readCarrierTags(text);
  const stages = tags
    .filter((t) => t.startsWith("lifecycle/"))
    .map((t) => t.slice("lifecycle/".length))
    .filter((s): s is LifecycleStage => STAGE_SET.has(s));
  const kinds = tags.filter((t) => t.startsWith("kind/")).map((t) => t.slice("kind/".length));
  const body = metaBody(text) ?? "";
  return {
    // ONE STAGE OR NONE. A carrier writing two stands in neither — the check names the collision and
    // this reader refuses to pick a winner, because picking one would hide the very fault.
    stage: stages.length === 1 ? stages[0]! : null,
    stages,
    kinds,
    harvestTo: metaValue(body, "harvest-to"),
    retiredKeys: RETIRED_META_KEYS.filter((k) => metaValue(body, k) !== null),
  };
}

/** One `<<~ ahu #/name>>` … `<<~/ahu>>` slot, with the text it holds. */
interface Slot { readonly name: string; readonly body: string }

/**
 * The top-level slots a carrier opens, read through the fence mask.
 *
 * A nested slot rides inside its parent's body, so a reader taking every open would count a child's
 * text twice and report a parent clean because its child pointed. Depth-tracked for that reason.
 */
function readSlots(text: string): Slot[] {
  const mask = fencedSpans(text);
  const out: Slot[] = [];
  const open = /^<<~ ?ahu #\/([a-z0-9/-]+)[^\n]*>>$/gim;
  const close = /^<<~\/ahu\s*>>$/gim;
  const marks: Array<{ at: number; end: number; name?: string }> = [];
  for (const m of text.matchAll(open)) {
    if (!inMask(mask, m.index)) marks.push({ at: m.index, end: m.index + m[0].length, name: m[1]! });
  }
  for (const m of text.matchAll(close)) {
    if (!inMask(mask, m.index)) marks.push({ at: m.index, end: m.index + m[0].length });
  }
  marks.sort((a, b) => a.at - b.at);
  const stack: Array<{ name: string; from: number }> = [];
  for (const mark of marks) {
    if (mark.name !== undefined) {
      stack.push({ name: mark.name, from: mark.end });
      continue;
    }
    const top = stack.pop();
    if (top && stack.length === 0) out.push({ name: top.name, body: text.slice(top.from, mark.at) });
  }
  return out;
}

/** An open lean — a bearing that reaches nothing, the mark a design writes and a ruling closes. */
const OPEN_LEAN = /`?->\s*\?`?/;

/** A slot that names where its content went. */
const FOLD_POINTER = /folded to\s+`?lar:\/\/\//i;

/**
 * A slot whose content is ADDRESSES rather than argument — it points by nature, so a fold pointer
 * would say nothing a reader could act on.
 */
const POINTER_SLOTS: ReadonlySet<string> = new Set(["edges", "leans"]);

/**
 * What the stage a carrier declares still owes, read from its own bytes alone.
 *
 * An empty answer means either "this carrier stands at its stage's floor" or "this carrier declines
 * the ladder" — and the two stay indistinguishable HERE on purpose, because a gate that faulted an
 * ungoverned carrier would fault 669 of 726 of them.
 */
export function checkCarrierLifecycle(text: string): string[] {
  const life = readCarrierLifecycle(text);
  if (life.stages.length > 1) {
    return [`lifecycle: two stages stand — ${life.stages.join(", ")}; a carrier holds one`];
  }
  const stage = life.stage;
  if (stage === null) return [];
  const faults: string[] = [];
  const slots = readSlots(text);

  // A DESIGN IS ALLOWED ITS OPEN QUESTIONS — that is what a design IS. A carrier ruled into standing
  // is not, because the ruling is precisely what closes them.
  if (stage === "standing") {
    const leans = slots.find((s) => s.name === "leans" || s.name.endsWith("/leans"));
    if (leans && OPEN_LEAN.test(leans.body)) {
      faults.push(
        "lifecycle/standing: an open lean `-> ?` stands in #/leans — a ruling closes it, or the stage reads designed",
      );
    }
  }

  // A FOLDED CARRIER HOLDS POINTERS ALONE. Its argument has moved to a standing home, and each slot
  // says which one — so a reader arriving at the old address reaches the content in one hop.
  if (stage === "folded") {
    for (const s of slots) {
      if (POINTER_SLOTS.has(s.name)) continue;
      if (!FOLD_POINTER.test(s.body)) {
        faults.push(`lifecycle/folded: #/${s.name} carries no fold pointer — every slot names where its content went`);
      }
    }
  }

  // A HARVEST ROOM NAMES WHERE ITS MATERIALS GO. Without the destination the room is simply a shelf
  // nobody empties, which is the state the rite exists to end.
  if (stage === "harvest" && !life.harvestTo) {
    faults.push('lifecycle/harvest: no harvest-to — name the living bag, harvest-to = "lar:///ha.ka.ba/bags/<bag>"');
  }

  // `retiring` owes ZERO INBOUND and nothing else, and inbound belongs to the shelf. Answering it
  // here would mean guessing, and a guess that reads as a verdict is worse than the silence.
  return faults;
}
