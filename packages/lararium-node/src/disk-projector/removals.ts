/**
 * A PERSON'S ANSWER TO PENDING REMOVALS: `restore` writes each file back from the records; `remove` takes each carrier
 * out of the bag through the delete door and reads the removal back from the view.
 * Heleuma ha: see lararium/mesh/disk-projector-removals.
 */

import type { ProjectorCore } from "./core.js";
import { sitedKey } from "./entries.js";
import { _leavePending } from "./pending.js";

/**
 * The layers beneath `bagId` that hold a live record of `uri` (`layersBeneath`), or none: a `remove` over a title
 * one of them holds raises a kāpae, and a pending row names them so the person's confirmation can.
 */
export async function beneathOf(core: ProjectorCore, bagId: string, uri: string): Promise<readonly string[]> {
  return (await core.layersBeneath?.(bagId, uri)) ?? [];
}

/**
 * A PERSON ANSWERS PENDING REMOVALS in one bag: `restore` writes each file back from the records and
 * pins its base; `remove` takes each carrier out of the bag whose mirror lost its file, in that bag's own
 * layer (`removeCarrier`). `remove` leaves the base in the tree: a carrier that later returns reads as
 * pending again and asks its person afresh.
 *
 * A REMOVE RETRACTS TO ABSENT; ONLY A LOWER COPY RAISES A KĀPAE (kapae#/disk-sense). Where no layer beneath the bag
 * holds the title, the record leaves and nothing stands in its place: no tombstone, no `.kapae`. Where one does,
 * the removal raises a kāpae in the bag so the lower copy never returns, and that act asks the person's approval
 * (`kapae: true`, the y their confirmation line named it under): without it the answer refuses
 * `remove-raises-kapae`, names each carrier with the layers beneath that hold it, and nothing runs.
 *
 * THE COUNT REPLACES A FRACTION. An answer over more than one carrier, or over `all`, names how many
 * carriers its giver read as pending in the bag. A count that moved refuses and changes nothing, so no
 * answer ever sweeps a carrier its giver never saw.
 *
 * A REMOVE READS THE VIEW, OR REFUSES. With no wiki view attached the projector cannot read back what the
 * delete door did, so `remove` refuses by name (`no-wiki-view`) and calls no door. A carrier the view now
 * resolves from ANOTHER bag left this bag's pending set, and the meme still stands: the answer names it
 * `unshadowed`, with the bag that answers it now, and never `done`, which names a carrier that left the
 * wiki. A tiddler the view still shows with no origin stays pending.
 */
export async function answerRemovals(core: ProjectorCore,
  act: "remove" | "restore", bagId: string,
  sel: { readonly uris?: readonly string[]; readonly all?: boolean; readonly count?: number; readonly kapae?: boolean },
): Promise<
  | { readonly ok: true; readonly done: readonly string[]; readonly left: readonly string[]; readonly unshadowed: ReadonlyArray<{ readonly uri: string; readonly bag: string }>; readonly raised: ReadonlyArray<{ readonly uri: string; readonly beneath: readonly string[] }> }
  | { readonly ok: false; readonly refusal: "not-pending" | "pending-count-moved" | "no-delete-door" | "no-wiki-view" | "answer-names-nothing" | "remove-raises-kapae" | "remove-bag-unmounted"; readonly why: string; readonly count?: number; readonly raising?: ReadonlyArray<{ readonly uri: string; readonly beneath: readonly string[] }> }
> {
  const inBag = core.pendingRemovals().filter((p) => p.bagId === bagId).map((p) => p.uri);
  const asked = sel.all ? inBag : [...new Set(sel.uris ?? [])];
  if (asked.length === 0) {
    return sel.all
      ? { ok: false, refusal: "not-pending", why: `no carrier of ${bagId} stands pending`, count: 0 }
      : { ok: false, refusal: "answer-names-nothing", why: "the answer names a carrier, or `all` with the count" };
  }
  const stray = asked.filter((uri) => !inBag.includes(uri));
  if (stray.length > 0) return { ok: false, refusal: "not-pending", why: `${stray.join(", ")} stand(s) in no pending removal of ${bagId}`, count: inBag.length };
  if ((sel.all || asked.length > 1) && sel.count !== inBag.length) {
    return { ok: false, refusal: "pending-count-moved", why: `${inBag.length} carrier(s) of ${bagId} stand pending; the answer names ${sel.count ?? "no count"}`, count: inBag.length };
  }
  const unshadowed: Array<{ uri: string; bag: string }> = [];
  const raising: Array<{ uri: string; beneath: readonly string[] }> = [];
  if (act === "remove") {
    if (!core.removeCarrier) return { ok: false, refusal: "no-delete-door", why: "this projector holds no wiki delete door" };
    const view = core._tw5?.$tw.wiki;
    if (!view) return { ok: false, refusal: "no-wiki-view", why: "this projector holds no wiki view to read the removal back; nothing ran" };
    // THE LAYERS BENEATH DECIDE THE ACT, before any door opens: none, a plain retract; one, a kāpae the person approves.
    for (const uri of asked) {
      const beneath = core.layersBeneath ? await core.layersBeneath(bagId, uri) : [];
      if (beneath === null) return { ok: false, refusal: "remove-bag-unmounted", why: `this island mounts no layer for ${bagId}, so nothing leaves it here; nothing ran`, count: inBag.length };
      if (beneath.length > 0) raising.push({ uri, beneath });
    }
    if (raising.length > 0 && sel.kapae !== true) {
      const named = raising.map((r) => `a lower layer (${r.beneath.join(", ")}) holds ${r.uri}`).join("; ");
      return {
        ok: false, refusal: "remove-raises-kapae", raising, count: inBag.length,
        why: `${named}; the removal raises a kāpae so it never returns, and waits on a person's y: run \`lares shore remove ${raising.map((r) => r.uri).join(" ")}\` at a terminal and answer the confirmation`,
      };
    }
    for (const uri of asked) await core.removeCarrier(uri, bagId);
    // THE DELETE DOOR'S WORD PROVES NOTHING BY ITSELF. Each carrier gets read back from the wiki's resolved
    // view: one that left it, or that the view now resolves from another bag, leaves this bag's pending
    // set; one the view still holds here stays pending, and the answer names it as left. The view answers
    // before the store weighs the tombstone: a store that refuses it returns the carrier to the view, and
    // the reconcile that return marks pends it again, since the base stays. The read runs no reconcile, so
    // the base stays in the tree.
    for (const uri of asked) {
      const standing = view.getTiddler?.(uri);
      const origin = (standing?.fields as Record<string, unknown> | undefined)?.["$origin-bag"];
      if (origin === bagId) continue;
      // A tiddler the view still shows with no origin has not left it: it stays pending.
      if (standing !== undefined && standing !== null && typeof origin !== "string") continue;
      // Left this bag's view: gone from the wiki, or answered now by another bag, which still holds the meme.
      if (typeof origin === "string") unshadowed.push({ uri, bag: origin });
      _leavePending(core, bagId, uri);
    }
  } else {
    for (const uri of asked) core.restoreAsked.add(sitedKey(bagId, uri));
    try {
      await core.sense(asked);
    } finally {
      for (const uri of asked) core.restoreAsked.delete(sitedKey(bagId, uri));
    }
  }
  await core.idle();
  const still = new Set(core.pendingRemovals().filter((p) => p.bagId === bagId).map((p) => p.uri));
  // `done` names what left the wiki; a carrier another bag answers now rides `unshadowed` alone.
  const standsBelow = unshadowed.filter((u) => !still.has(u.uri));
  const below = new Set(standsBelow.map((u) => u.uri));
  return { ok: true, done: asked.filter((uri) => !still.has(uri) && !below.has(uri)), left: asked.filter((uri) => still.has(uri)), unshadowed: standsBelow, raised: raising.filter((r) => !still.has(r.uri)) };
}
