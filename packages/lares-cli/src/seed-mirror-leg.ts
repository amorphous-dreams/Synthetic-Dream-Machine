/**
 * seed-mirror-leg — the seed's mirror leg as a door any verb walks through with a narrow options object.
 *
 * The leg takes what it reads by name (`apply`, the raw `--lift-kahua` count, whether the reading answers as JSON, the
 * kahua-only cut) and never a verb's whole flag bag, so `lares vessel seed` and `lares shore lift-kahua` each read only
 * the flags their own accepts row names (`tests/laws/accepts-track-the-handlers.law.test.ts`). This module reaches no
 * command handler: the seed's ingest and act gestures stay in `commands/seed.ts`.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */

import { createInterface } from "node:readline/promises";
import { seedMirrors, mirrorLines, mirrorsLeftWork, kahuaConfirmPrompt, MirrorRefused, type MirrorDoors, type KahuaPreviewItem } from "./seed-mirrors.js";

/** What the mirror leg reads: each name the calling verb took off its own flags. */
export interface MirrorLegOptions {
  /** Whether the leg writes (`--apply`); a dry leg previews. */
  readonly apply: boolean;
  /** The raw `--lift-kahua` count as typed, or undefined where absent; a malformed count refuses by name. */
  readonly liftKahua?: string | undefined;
  /** Whether the reading answers as JSON: then no TTY hand confirms the kahua lift. */
  readonly json?: boolean;
  /** Lift the kahua items alone, laying no mirror back. */
  readonly kahuaOnly?: boolean;
}

/** `--lift-kahua <N>` read as a whole count, or null where absent; a malformed count refuses by name. */
export function liftKahuaCountOf(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  if (!/^(?:0|[1-9][0-9]*)$/.test(raw)) throw new MirrorRefused("seed-kahua-count", `--lift-kahua names the whole count the preview shows; "${raw}" names none`);
  return Number(raw);
}

/** A person at a TTY reads the preview and types the count; anywhere else no hand confirms. */
export function ttyKahuaConfirmFor(json: boolean): ((count: number, preview: readonly KahuaPreviewItem[]) => Promise<boolean>) | undefined {
  if (json || !process.stdin.isTTY || !process.stdout.isTTY) return undefined;
  return async (count) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try { return (await rl.question(kahuaConfirmPrompt(count))).trim() === String(count); } finally { rl.close(); }
  };
}

/** Run the mirror leg and print it; its exit code (0 clean, 1 a refusal or something standing for a hand). */
export async function runMirrors(opts: MirrorLegOptions, doors: MirrorDoors): Promise<number> {
  try {
    const confirmKahua = ttyKahuaConfirmFor(opts.json === true);
    const result = await seedMirrors({
      apply: opts.apply, doors, liftKahua: liftKahuaCountOf(opts.liftKahua),
      ...(confirmKahua ? { confirmKahua } : {}), ...(opts.kahuaOnly ? { kahuaOnly: true } : {}),
    });
    const { out, err } = mirrorLines(result);
    for (const l of out) console.log(l);
    for (const l of err) console.error(l);
    return mirrorsLeftWork(result) ? 1 : 0;
  } catch (e) {
    if (e instanceof MirrorRefused) { console.error(`lares vessel seed: ${e.message}`); return 1; }
    throw e;
  }
}
