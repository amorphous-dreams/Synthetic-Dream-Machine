/**
 * shore-verb — a person's answers at the disk shore, carried to the projector that holds the mirror.
 *
 * The disk projector surfaces what it will not decide alone: a STANDOFF, where the disk and the records
 * say different things and no rule picks, and a PENDING REMOVAL, where a file vanished from the path its
 * base names. A person reads what stands (`list`) and answers by name. The verb rides `wiki:place-verb`
 * into the island that mounts the projector (`lares shore` sends it through `wiki-act`), and each island
 * answers for the mirrors it holds.
 *
 *   list           look at the disk, then name what stands: each standoff with its key, each pending removal
 *   sense          look at the disk for the named carriers (the watcher sends what vanished or returned)
 *   take-records   take the records' side of one standoff, named by its key
 *   restore        write a vanished file back from the records and pin its base
 *   remove         delete the vanished carrier in the wiki, by the wiki shore's own delete door
 *
 * Every answer names the state the person read: a standoff's key, and for more than one pending removal
 * the count that stood pending. An answer that names a state which moved since takes nothing and says so:
 * no answer ever lands on a state its giver never saw.
 */

import type { LarDiskProjector } from "./disk-projector.js";

/** The verb an island answers at its disk shore. */
export const SHORE_VERB = "shore";

/** The acts the verb carries. */
export const SHORE_OPS = ["list", "sense", "take-records", "restore", "remove"] as const;
export type ShoreOp = (typeof SHORE_OPS)[number];

const text = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

/** What stands for a hand at this island's shore, optionally within one bag. */
export function shoreList(projector: LarDiskProjector, bag: string | null = null): Record<string, unknown> {
  const standoffs = projector.standing().filter((s) => bag === null || s.bagId === bag);
  const pending = projector.pendingRemovals().filter((p) => bag === null || p.bagId === bag);
  return { standoffs, pending, pendingCount: pending.length };
}

const uriList = (v: unknown): string[] | null =>
  Array.isArray(v) && v.every((u) => typeof u === "string" && u !== "") ? (v as string[]) : null;

/**
 * Answer one shore act against one projector. A refusal comes back as `{ ok: false, refusal, why }` under
 * a stable name; an act that ran comes back `{ ok: true, ... }`.
 */
export async function answerShore(projector: LarDiskProjector, args: Readonly<Record<string, unknown>>): Promise<Record<string, unknown>> {
  const op = text(args["op"]) ?? "list";
  const bag = text(args["bag"]);
  if (op === "list") {
    // WHAT A PERSON READS STANDS TRUE TO THE DISK: the list looks first, at every carrier that stands in a
    // standoff or a pending removal, so a file a hand put back or edited since reads as it stands.
    await projector.sense([...new Set([...projector.standing().map((s) => s.uri), ...projector.pendingRemovals().map((p) => p.uri)])]);
    return { ok: true, op, ...shoreList(projector, bag) };
  }
  if (op === "sense") {
    // No carrier named = every carrier this island mirrors.
    const uris = args["uris"] === undefined ? undefined : uriList(args["uris"]);
    if (uris === null) return { ok: false, op, refusal: "shore-answer-incomplete", why: "sense names carriers as a list of addresses (`uris`), or none for every mirrored carrier" };
    await projector.sense(uris);
    return { ok: true, op, ...shoreList(projector, bag) };
  }
  if (op === "restore" || op === "remove") {
    const uris = args["uris"] === undefined ? [] : uriList(args["uris"]);
    const all = args["all"] === true;
    if (uris === null || (all && uris.length > 0)) return { ok: false, op, refusal: "shore-answer-incomplete", why: `${op} names carriers (\`uris\`) or \`all\`, never both` };
    const count = typeof args["count"] === "number" && Number.isInteger(args["count"]) ? args["count"] : undefined;
    // The bag a person named, else the one bag that holds what they named; two bags never fold into one answer.
    const pending = projector.pendingRemovals();
    const bags = [...new Set((all ? pending : pending.filter((p) => uris.includes(p.uri))).map((p) => p.bagId))];
    const target = bag ?? (bags.length === 1 ? bags[0]! : null);
    if (target === null) {
      return bags.length === 0
        ? { ok: false, op, refusal: "not-pending", why: all ? "no carrier stands pending at this island's shore" : `${uris.join(", ")} stand(s) in no pending removal at this island's shore`, count: 0 }
        : { ok: false, op, refusal: "shore-answer-incomplete", why: `pending removals stand in ${bags.length} bags (${bags.join(", ")}); name one with \`bag\`` };
    }
    const answer = await projector.answerRemovals(op, target, { ...(all ? { all: true } : { uris }), ...(count !== undefined ? { count } : {}) });
    return answer.ok
      ? { ok: true, op, bag: target, done: answer.done, left: answer.left }
      : { ok: false, op, bag: target, refusal: answer.refusal, why: answer.why, ...(answer.count !== undefined ? { count: answer.count } : {}) };
  }
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
