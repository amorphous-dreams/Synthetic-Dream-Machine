/**
 * shore-verb — a person's answers at the disk shore, carried to the projector that holds the mirror.
 *
 * The disk projector surfaces what it will not decide alone: a standoff, where the disk and the records
 * say different things and no rule picks. A person reads what stands (`list`) and answers by name. The verb
 * rides `wiki:place-verb` into the island that mounts the projector (`lares shore` sends it through
 * `wiki-act`), and each island answers for the mirrors it holds.
 *
 *   list           what stands for a hand: each standoff with the key a person answers by
 *   take-records   take the records' side of one standoff, named by its key
 *
 * Every answer names the state the person read (a standoff's key). An answer that names a state which
 * moved since takes nothing and says so: no answer ever lands on a state its giver never saw.
 */

import type { LarDiskProjector } from "./disk-projector.js";

/** The verb an island answers at its disk shore. */
export const SHORE_VERB = "shore";

/** The acts the verb carries. */
export const SHORE_OPS = ["list", "take-records"] as const;
export type ShoreOp = (typeof SHORE_OPS)[number];

const text = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

/** What stands for a hand at this island's shore. */
export function shoreList(projector: LarDiskProjector): Record<string, unknown> {
  return { standoffs: projector.standing() };
}

/**
 * Answer one shore act against one projector. A refusal comes back as `{ ok: false, refusal, why }` under
 * a stable name; an act that ran comes back `{ ok: true, ... }`.
 */
export async function answerShore(projector: LarDiskProjector, args: Readonly<Record<string, unknown>>): Promise<Record<string, unknown>> {
  const op = text(args["op"]) ?? "list";
  if (op === "list") return { ok: true, op, ...shoreList(projector) };
  if (op === "take-records") {
    const uri = text(args["uri"]);
    const key = text(args["key"]);
    if (uri === null || key === null) return { ok: false, op, refusal: "shore-answer-incomplete", why: "take-records names a carrier (`uri`) and the standoff's key (`key`)" };
    // The key names the bag: a person answers by what the alert showed, and the standoff that carries that
    // key in this island names its own mirror.
    const stands = projector.standing().filter((s) => s.uri === uri && (text(args["bag"]) === null || s.bagId === args["bag"]));
    const named = stands.find((s) => s.standoff === key);
    if (named === undefined) {
      return {
        ok: false, op, refusal: stands.length === 0 ? "no-standoff-stands" : "standoff-key-moved",
        why: stands.length === 0
          ? `no standoff stands for ${uri} at this island's shore`
          : `the standoff for ${uri} stands under key ${stands.map((s) => s.standoff).join(", ")}; the answer names ${key}`,
      };
    }
    const answer = await projector.takeRecords(named.bagId, uri, key);
    return answer.took
      ? { ok: true, op, bag: named.bagId, uri, key, took: "records" }
      : { ok: false, op, refusal: "standoff-key-moved", why: answer.why ?? "the states moved while the answer travelled" };
  }
  return { ok: false, op, refusal: "shore-op-unknown", why: `the shore verb carries ${SHORE_OPS.join(", ")}; it names no "${op}"` };
}
