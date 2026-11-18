/**
 * partial-landing — the last judgement a two-vault door runs before it writes a completed partial (kapae#/edge-hands).
 *
 * A seat's signature awaits custody, and the judge itself awaits, so the board or the charter head may move between
 * the judgement that read `complete` and the write. The door therefore judges again until the board AND the head
 * hold still across one whole judgement; the write follows the last judgement with no await between. A board that
 * moves through every pass of a bounded count refuses, and the person carries the partial again: a COUNT bounds it,
 * never a clock.
 *
 * Pure of I/O itself: the caller supplies the mark (what the head and board read now), the judge, and its refusal.
 */
import type { NexusPartialJudgement } from "@lararium/mesh";

/** How many whole judgements a landing runs before a board that keeps moving refuses. */
export const LANDING_PASSES = 8;

export interface StillJudgement {
  /** A string naming the charter head and the board as they read now; equal marks name an unmoved world. */
  readonly mark:   () => string;
  /** One whole judgement of the partial against the head and the board as they read now. */
  readonly judge:  () => Promise<NexusPartialJudgement>;
  /** The door's own refusal, worded for its family. */
  readonly refuse: (message: string) => Error;
}

/**
 * Resolve once a judgement reads `complete` and the mark held still across it; throw the door's refusal for any
 * other verdict, or once `LANDING_PASSES` judgements in a row each saw the mark move. The caller writes on return,
 * with no await between.
 */
export async function judgeStillBeforeWrite(s: StillJudgement): Promise<void> {
  for (let pass = 0; ; pass++) {
    if (pass === LANDING_PASSES) throw s.refuse(`the board moved through ${LANDING_PASSES} judgements in a row; nothing lands — carry the partial again.`);
    const before = s.mark();
    const last = await s.judge();
    if (last.verdict !== "complete") {
      throw s.refuse(`the partial reads ${last.verdict} on this vessel at the write${last.why ? `: ${last.why}` : ""}; nothing lands.`);
    }
    if (s.mark() === before) return;
  }
}
