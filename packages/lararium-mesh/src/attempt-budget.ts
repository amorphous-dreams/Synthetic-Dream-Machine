/**
 * attempt-budget — THE ONE COUNT every security door spends before it burns, locks or stops asking, and the warning that
 * climbs as the count runs down.
 *
 * The operator ruled it (2026-11-23): "Bump 'three tries' to 5 in all cases in the security layers (hail eris, and srsrly
 * people get mad at themselves for burning their own devices, but the warning should get increasingly frantic at 3+)."
 *
 *   · FIVE TRIES. `ATTEMPT_BUDGET` owns the count; the vessel's unlock bound (`UNLOCK_ATTEMPTS_PER_BOOT`, @lararium/node), each
 *     face's and each ward's bound, the browser page's ward bound, the browser boot's stand and every read-back rite derive from it.
 *   · THE CLIMB. Misses one and two read calm; the third raises the alarm; the fourth names the last try; the fifth reads spent.
 *     Every line names the tries left, what the burn does, and the road back (`ATTEMPT_STAKES`, one row per door).
 *   · NAMES HOLD. A refusal keeps the reading its door gave before the count moved (`no-slot-opens`, `attempts-spent`,
 *     `ward-no-slot-opens`, `ward-attempts-spent`); the count rides beside it as `attemptsLeft`, and these words ride as its
 *     detail. One difference stands between the two ward doors, named: the node's ward reads its spending miss (the fifth)
 *     `ward-attempts-spent`, while the browser page's ward reads every miss `ward-no-slot-opens` (the fifth with
 *     `attemptsLeft: 0`) and reads `ward-attempts-spent` only at the act past the bound, which runs nothing.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/waking-floor (the custody door's bound)
 */

/** The tries every security door grants before it burns, locks or stops asking. */
export const ATTEMPT_BUDGET = 5;

/** The miss from which the warning stops reading calm. */
export const ATTEMPT_ALARM_FROM = 3;

/** How loud a refusal speaks after `failed` misses: calm, alarm, the last try, or spent. */
export type AttemptTier = "calm" | "alarm" | "last" | "spent";

/** What one door's burn does, in words a refusal carries. */
export interface AttemptStakes {
  /** Completes "the next miss …": what the burn does (a verb phrase). */
  readonly burn: string;
  /** What stands once the tries run out (a clause). */
  readonly spent: string;
  /** The road back (an imperative clause). */
  readonly recovery: string;
}

/** One row per door that spends tries. */
export const ATTEMPT_STAKES = {
  vessel: {
    burn: "shuts this vessel's unlock door until the vessel restarts",
    spent: "this vessel refuses every unlock until it restarts",
    recovery: "restart the vessel (`lares vessel stand --restart`) to restore the tries; where the vessel's tree binds a paper pin (`lares vault status` lists its slots), `lares vault unlock --paper` opens it under the sheet",
  },
  face: {
    burn: "shuts this face's unlock and ward until the vessel restarts",
    spent: "this face refuses every unlock and ward act until the vessel restarts",
    recovery: "restart the vessel (`lares vessel stand --restart`) to restore the face's tries; where the face binds a paper pin, `lares vault unlock --face <N> --paper` opens it under the sheet; a face beyond its routes returns from its backup bundle (`lares vault restore <file>`) or its split cards (`lares vault restore --cards --face <root-key> --as <N>`)",
  },
  "page-ward": {
    burn: "shuts this page's ward until the page reloads",
    spent: "this page refuses every ward act until it reloads",
    recovery: "reload the page to restore the tries; where the face binds a paper pin, its sheet opens the ward too",
  },
  "browser-stand": {
    burn: "ends this unlock, and the browser's custody stays shut until the page reloads",
    spent: "this unlock stopped asking, and the browser's custody stays shut",
    recovery: "reload the page to try again; where this browser binds a paper pin, its sheet opens the custody too; a browser beyond its routes returns to its anon floor through the reset ceremony (the console's `vessel reset`), which burns what it holds",
  },
  "offline-run": {
    burn: "ends this command's run with nothing opened",
    spent: "this run stopped asking and opened nothing",
    recovery: "run the command again; where the vessel's tree binds a paper pin (`lares vault status` lists its slots), choose the sheet at the route question",
  },
  "read-back": {
    burn: "ends the rite with nothing written or bound",
    spent: "the rite stopped with nothing written or bound",
    recovery: "run the rite again: a new run prints new words (a new card, a new sheet), so discard these and write down the new ones",
  },
} as const satisfies Record<string, AttemptStakes>;

export type AttemptDoor = keyof typeof ATTEMPT_STAKES;

/** The tier after `failed` misses of `budget`. */
export function attemptTier(failed: number, budget: number = ATTEMPT_BUDGET): AttemptTier {
  if (failed >= budget) return "spent";
  if (failed >= budget - 1) return "last";
  if (failed >= ATTEMPT_ALARM_FROM) return "alarm";
  return "calm";
}

const ORDINAL = ["zeroth", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];
const ordinal = (n: number): string => ORDINAL[n] ?? `${n}th`;

/**
 * The warning a refusal carries with `left` tries of `budget` remaining. Calm on misses one and two; from the third it climbs,
 * and every tier names the tries left, the burn, and the road back.
 */
export function attemptWarning(left: number, stakes: AttemptStakes | AttemptDoor, budget: number = ATTEMPT_BUDGET): string {
  const s = typeof stakes === "string" ? ATTEMPT_STAKES[stakes] : stakes;
  const remain = Math.max(0, Math.min(budget, left));
  const failed = budget - remain;
  const count = `${remain} of ${budget} ${budget === 1 ? "try" : "tries"} remain`;
  switch (attemptTier(failed, budget)) {
    case "calm":
      return `That route opened nothing; ${count}. The ${ordinal(budget)} miss ${s.burn}. If the route slips your memory: ${s.recovery}.`;
    case "alarm":
      return `CAREFUL: ${failed} misses now, and ${count}. The ${ordinal(budget)} miss ${s.burn}. Check caps lock, the keyboard layout and the card before you type again. If the route slips your memory: ${s.recovery}.`;
    case "last":
      return `LAST TRY!! ${failed} misses, and ${count}. The next miss ${s.burn}! Stop. Breathe. Hail Eris. Type it only if you hold it for certain; otherwise ${s.recovery}.`;
    case "spent":
      return `SPENT: ${count}: ${s.spent}. To come back: ${s.recovery}.`;
  }
}
