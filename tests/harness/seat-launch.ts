/**
 * seat-launch — a hand-only act cannot run under an AI launcher, and the suite says so by name.
 *
 * Since the hand wall reads a caller's own process chain, a seat that launches the e2e suite meets `face-hand-refused` and
 * `seat-canon-reach` on every operator-hand act a test exercises. The wall stands as designed; the harness never strips a mark
 * or leaves the branch to read as a hand (that teaches every seat the bypass). A hand-act leg therefore skips locally under an AI
 * launcher, NAMED in the run's output, and runs in CI, where no harness stands in the chain. OWED: the founder rule, where the
 * hand gate admits a hand-only act on a scratch house the calling seat founded; the legs then run under any launcher.
 */
import { harnessSeatMarked } from "../../packages/lares-cli/src/local-connector.js";

/** True where an AI harness launched this run (the same marks the wall reads). */
export const seatLaunched: boolean = harnessSeatMarked(process.env);

/** Name the skipped legs on stderr, once per file, so a skip never reads as a silent pass. */
export function nameSeatSkip(file: string, legs: readonly string[]): void {
  if (seatLaunched) console.error(`[seat-launch] SKIPPED under an AI launcher (the hand wall reads the launcher's chain; CI runs these): ${file}: ${legs.join(" · ")}`);
}
