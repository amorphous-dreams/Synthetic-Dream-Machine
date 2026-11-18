/**
 * meme-merge — THE ONE SEAL MERGE for `.mem` carriers: three sides in, one merged carrier or a conflict out.
 *
 * Two callers read this one module. `tools/mem-merge-driver.mjs` shells over it for git (`merge=mem-seal`), and the
 * vessel's `mergeCarrier` calls it where a disk edit and a house write meet (`both-moved`). A merge that two callers
 * each spelled would drift the day one learned a case the other did not; the weld
 * (`tools/mem-merge-weld.test.mjs`) holds the driver and this module to one byte string over a corpus of triples.
 *
 * ── THE SEAL STAYS OUT OF THE MERGE ─────────────────────────────────────────────────────────────
 * A carrier's ETX mark carries the block check over the span it closes, so every body edit moves the `bcc=` line. Two
 * sides that edit far apart and each re-seal conflict on that one line though their bodies merge clean. So the merge
 * reads the three sides with that seal set bare (`bareSeal`), merges, and hands the merged body to the caller's sealer,
 * which runs the normalize law and stamps a fresh check. The sealer stays the caller's: the normalize law lives above
 * this package, and the module names the seam (`MemeSealer`) rather than reaching up for it.
 *
 * ── SLOTS MERGE BY SLOT ─────────────────────────────────────────────────────────────────────────
 * Where the whole bared text conflicts, the merge cuts each side into its top-level slots (`splitSlots`): the head
 * before the first slot, each ``<<~ ahu slot=`#/…`>>`` block whole, and the text after each block. A slot only one side
 * moved takes that side; a slot both moved line-merges alone; a slot one side added lands beside its anchor; a slot
 * one side dropped leaves where the other side left it untouched. Two sides adding two slots at one place both land,
 * where a line merge reads one insertion fighting another. A slot both moved into overlap, or a slot one side dropped
 * while the other moved it, stays a conflict.
 *
 * THE CUT READS LINES, AND IT ONLY PARTITIONS. A slot opener or closer counts where it stands as its own line outside a
 * fence; the pieces concatenate back to the side byte for byte. The cut decides merge grain, never membership: the
 * family law and the decomposer (`@lararium/tw5` ahu-scan) keep that, and a carrier this cut cannot read whole (a
 * closer with nothing open, an opener never closed, one slot declared twice) merges as one text instead.
 *
 * ── THE LINE MERGE STAYS THE CALLER'S ───────────────────────────────────────────────────────────
 * Every line merge runs through the `LineMerge` handed in: git's own `git merge-file` on node (`./meme-merge-git`),
 * whose conflict text git's markers carry. PURE: no store, no clock, no process; node and browser import it alike.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/working-procedures#/the-seal-merge
 */

/** The ETX seal line a re-seal writes: the block check over the span it closes. */
const SEAL_LINE = /^<<\^ code=`&#x0003;` bcc=`[^`]*`>>$/;
/** The ETX mark with no check: the seal set bare. */
export const BARE_SEAL = "<<^ code=`&#x0003;`>>";

/** A slot DECLARATION standing as its own line (a `kahea` or `aka` call carries a verb between `~` and `ahu`). */
const SLOT_OPEN = /^\s*<<(?:~\s*ahu|fragment)\s+slot=`(#\/[^`\s]+)`(?:\s+to=`[^`\n]*`)?\s*>>\s*$/;
const SLOT_CLOSE = /^\s*<<(?:~\/ahu|\/fragment)\s*>>\s*$/;
const FENCE = /^\s*(`{3,}|~{3,})/;

/** Three texts merged line by line: `conflicts` counts conflicted hunks, `text` carries the merge or its markers. */
export interface LineMergeResult {
  readonly text: string;
  readonly conflicts: number;
}

export interface LineMergeInput {
  readonly base: string;
  readonly ours: string;
  readonly theirs: string;
  /** The name a conflict marker carries. */
  readonly path?: string | undefined;
  readonly markerSize?: number | undefined;
}

/** The line merge every hunk runs through: git's own on node (`mergeTexts` in `./meme-merge-git`). */
export type LineMerge = (input: LineMergeInput) => LineMergeResult;

/** The normalize law's shore: the merged body in, the sealed carrier (or why none can seal) out. */
export type MemeSealer = (text: string) => { readonly ok: true; readonly text: string } | { readonly ok: false; readonly why: string };

/** The carrier with its ETX seal set bare: the LAST seal-shaped line, since a body may quote the mark in a fence. */
export function bareSeal(text: string): string {
  const lines = text.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    if (SEAL_LINE.test(lines[i]!)) {
      lines[i] = BARE_SEAL;
      return lines.join("\n");
    }
  }
  return text;
}

/**
 * One piece of a carrier's slot cut. `key` names it: `head` (before the first slot), `slot:#/a` (a top-level block,
 * opener through closer), `after:#/a` (the text between that block and the next, or the end).
 */
export interface SlotPiece {
  readonly key: string;
  readonly text: string;
}

/**
 * The top-level slot cut of a carrier, its pieces concatenating back to `text` byte for byte; null where the cut
 * cannot read the carrier whole (a closer with nothing open, an opener never closed, a slot declared twice).
 */
export function splitSlots(text: string): SlotPiece[] | null {
  const lines = text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  const pieces: SlotPiece[] = [];
  const seen = new Set<string>();
  let key = "head";
  let buf = "";
  let depth = 0;
  let fence: string | null = null;
  const flush = (next: string) => {
    if (buf.length > 0) pieces.push({ key, text: buf });
    key = next;
    buf = "";
  };
  for (const line of lines) {
    const bare = line.replace(/\r?\n$/, "");
    if (fence !== null) {
      if (bare.trim().startsWith(fence) && bare.trim().replace(/^[`~]+/, "").trim() === "") fence = null;
      buf += line;
      continue;
    }
    const fenced = FENCE.exec(bare);
    if (fenced) {
      fence = fenced[1]!;
      buf += line;
      continue;
    }
    const open = SLOT_OPEN.exec(bare);
    if (open) {
      if (depth === 0) {
        const slotKey = `slot:${open[1]}`;
        if (seen.has(slotKey)) return null;
        seen.add(slotKey);
        flush(slotKey);
      }
      depth++;
      buf += line;
      continue;
    }
    if (SLOT_CLOSE.test(bare)) {
      if (depth === 0) return null;
      depth--;
      buf += line;
      if (depth === 0) flush(`after:${key.slice("slot:".length)}`);
      continue;
    }
    buf += line;
  }
  if (depth !== 0) return null;
  flush("");
  return pieces;
}

/** A slot merge: the merged text (conflicted pieces carry the line merge's markers) and the pieces left conflicted. */
export interface SlotMergeResult extends LineMergeResult {
  /** The keys of the pieces that stayed conflicted; empty on a clean merge. `*` names a whole-text fallback. */
  readonly conflicted: readonly string[];
}

/**
 * Three sides merged slot by slot (see the module head). Where any side's cut fails, or one side drops a piece the
 * other moved, the three sides merge as one text and a conflict there names the whole (`*`).
 */
export function mergeSlots(input: LineMergeInput & { readonly lineMerge: LineMerge }): SlotMergeResult {
  const { base, ours, theirs, lineMerge, path, markerSize } = input;
  const whole = (): SlotMergeResult => {
    const r = lineMerge({ base, ours, theirs, path, markerSize });
    return { ...r, conflicted: r.conflicts === 0 ? [] : ["*"] };
  };
  const cut = [splitSlots(base), splitSlots(ours), splitSlots(theirs)];
  if (cut.some((c) => c === null)) return whole();
  const [b, o, t] = cut.map((c) => new Map(c!.map((p) => [p.key, p.text]))) as [Map<string, string>, Map<string, string>, Map<string, string>];
  const oursOrder = cut[1]!.map((p) => p.key);
  const theirsOrder = cut[2]!.map((p) => p.key);

  // A piece one side dropped leaves only where the other side holds it at base; dropped against a move, it conflicts.
  for (const k of oursOrder) if (!t.has(k) && b.has(k) && b.get(k) !== o.get(k)) return whole();
  for (const k of theirsOrder) if (!o.has(k) && b.has(k) && b.get(k) !== t.get(k)) return whole();
  const kept = oursOrder.filter((k) => !(b.has(k) && !t.has(k)));
  // A piece theirs added lands after its nearest anchor, past any run of pieces ours added there.
  for (let i = 0; i < theirsOrder.length; i++) {
    const k = theirsOrder[i]!;
    if (o.has(k) || b.has(k)) continue;
    let at = 0;
    for (let j = i - 1; j >= 0; j--) {
      const anchor = kept.indexOf(theirsOrder[j]!);
      if (anchor !== -1) { at = anchor + 1; break; }
    }
    while (at < kept.length && !b.has(kept[at]!) && !t.has(kept[at]!)) at++;
    kept.splice(at, 0, k);
  }

  let text = "";
  let conflicts = 0;
  const conflicted: string[] = [];
  for (const k of kept) {
    const bk = b.get(k);
    const ok = o.get(k);
    const tk = t.get(k);
    if (ok === undefined) { text += tk!; continue; }
    if (tk === undefined || ok === tk || tk === bk) { text += ok; continue; }
    if (ok === bk) { text += tk; continue; }
    const r = lineMerge({ base: bk ?? "", ours: ok, theirs: tk, path, markerSize });
    text += r.text;
    if (r.conflicts !== 0) { conflicts += r.conflicts; conflicted.push(k); }
  }
  return { text, conflicts, conflicted };
}

/** A carrier merge's verdict: resolved with the merged (and, where the seal moved, re-sealed) carrier, or a conflict. */
export type CarrierMergeResult =
  | { readonly resolved: true; readonly text: string }
  /** `text` carries the line merge's conflict over the ORIGINAL three sides, markers and all. */
  | { readonly resolved: false; readonly text: string; readonly why: string };

/**
 * One carrier merge. The plain merge first: clean, it stands as it merged. Otherwise the seals set bare, the whole bared
 * text merges, then (where that conflicts) the slots merge; a clean merge there hands its body to `seal`. Any conflict
 * left, or a sealer absent or refusing, answers the plain merge's conflict over the original three sides.
 */
export function mergeCarrier(input: LineMergeInput & { readonly lineMerge: LineMerge; readonly seal?: MemeSealer | null }): CarrierMergeResult {
  const { base, ours, theirs, path, markerSize, lineMerge, seal } = input;
  const plain = lineMerge({ base, ours, theirs, path, markerSize });
  if (plain.conflicts === 0) return { resolved: true, text: plain.text };
  const leave = (why: string): CarrierMergeResult => ({ resolved: false, text: plain.text, why });
  const bared = { base: bareSeal(base), ours: bareSeal(ours), theirs: bareSeal(theirs), path, markerSize };
  let merged: LineMergeResult = lineMerge(bared);
  if (merged.conflicts !== 0) {
    const slots = mergeSlots({ ...bared, lineMerge });
    if (slots.conflicts !== 0) {
      const where = slots.conflicted.includes("*") ? "" : ` in ${slots.conflicted.map((k) => k.replace(/^\w+:/, "")).join(", ")}`;
      return leave(`${slots.conflicts} conflict(s) beyond the seal${where}`);
    }
    merged = slots;
  }
  if (!seal) return leave("the normalize shore does not answer");
  const sealed = seal(merged.text);
  return sealed.ok ? { resolved: true, text: sealed.text } : leave(sealed.why);
}
