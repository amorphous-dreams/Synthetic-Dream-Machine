/**
 * A reactor's refusal BY NAME. `reason` is machine-read; `message` is for a human.
 *
 * Callers that route on a refusal read `reason`, never the message prose.
 *
 * Source: packages/lararium-mesh/src/verb-refusal.ts
 */

export class VerbRefusal extends Error {
  override readonly name = "VerbRefusal";
  constructor(readonly reason: string, message: string) {
    super(message);
  }
}

/**
 * True for a VerbRefusal from any realm or bundle copy: reads `name` and a string
 * `reason`, never `instanceof`.
 */
export function isVerbRefusal(err: unknown): err is VerbRefusal {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { name?: unknown; reason?: unknown };
  return e.name === "VerbRefusal" && typeof e.reason === "string";
}
