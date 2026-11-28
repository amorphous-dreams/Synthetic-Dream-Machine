/**
 * THE SETTLE WORD: a gesture that landed records waits here until the projection those records cause has run, by a
 * handshake with the wiki's change events and the queue's drain, never a clock.
 * Heleuma ha: see lararium/mesh/disk-projector-settle-word.
 */

import { digestsEqual } from "@lararium/mesh/agile-digest";
import { carrierHash } from "@lararium/mesh/crypto";
import type { ProjectorCore } from "./core.js";
import type { SettleInbox, ReconcileWatch } from "./entries.js";
import { nextWake, wakeWaiters, watchReconcile, releaseWatch, reconcileWatched } from "./watches.js";
import { renderedOutput } from "./write.js";

/**
 * THE SETTLE WORD. A gesture that landed records names each carrier and the hash its records render
 * (`records`, the records side the gesture pinned). This answers once the projection those records cause
 * has run: for each carrier the wiki's resolved view holds records from this bag that render to that hash,
 * a reconcile of that carrier marked after the look has run to its end, and the queue then stands drained.
 * So the base each reconcile pins stands in the tree, and a scan that follows reads what the projection left.
 *
 * Each carrier ends in one of five readings:
 *   settled    the view held the named records from this bag, and the reconcile marked after that look ran;
 *   elsewhere  the view's origin names a bag the composition ranks ABOVE this one: that bag shadows the
 *              carrier, and this mirror projects nothing of it. An origin ranked below this bag, or one the
 *              composition cannot rank, names records that have not reached the view yet: the wait goes on;
 *   superseded a later settle word asked for the same carrier in the same bag while this one still waited
 *              for its records: the later wait carries it, and this one ends naming it and claiming no
 *              projection for it. So at most one word per bag waits for a carrier's records, and words a caller
 *              gave up on never pile; a word that already marked the carrier's reconcile waits for that
 *              reconcile alone;
 *   stopped    the projector stopped before the records arrived, or before the reconcile marked for them ran;
 *   closed     the far side closed while the named heads (below) had not arrived: the records can never come
 *              through the link that carried the gesture, and the word ends naming the carrier;
 *   failed     the reconcile marked for them threw: the file stands as the failure left it.
 *
 * THE WORD FOLLOWS THE HEADS IT NAMES. A gesture that landed records also names, per carrier, the causal
 * heads of the bag's document it landed (`heads`). The word then reads the arrival from the view's own
 * ledger (`viewHolds`): once the view holds those heads, the records have arrived, whether or not the bytes
 * still render to the named hash, and the word marks the reconcile that projects the state the view holds
 * (the named records or a later one). Without a hash match the heads alone end the wait, so a view that
 * moved past the named records never keeps a word waiting. A word that names heads also listens for the far
 * side to close (`farSideClosed`): the close brings one last look, and a carrier the look still finds
 * absent reads `closed`, unless the island's own replica already holds its heads (`docHolds`): those reach
 * the view through the island's own pipeline, and the word keeps waiting for them. A word with no heads
 * claims nothing about the link and follows the hash alone.
 *
 * A HANDSHAKE, NO CLOCK. Records a gesture landed elsewhere reach this wiki by sync, at no instant a caller
 * can name, and the wiki raises its change event on a later tick than the view moves. So the word never
 * rests on that event: once the look finds the named records in the view, the wait marks the carrier
 * itself (the reconcile reads settled state and writes nothing where nothing moved; a mark during a
 * running reconcile runs it once more) and the drain at the end waits for that reconcile. Each change event
 * drops the carriers it names into the wait's own inbox, so no event goes unread between two looks, and a
 * later look renders only the carriers a change named. The wait holds no timer of its own: the caller's
 * wait bounds the caller, a later word for the same carrier supersedes it, and a projector that stops ends
 * it. A view that renders other words than the named ones keeps the wait: a carrier lands as a root and its
 * fragments, title by title, so a look may read a family halfway landed, and no byte the view holds tells
 * that state from a later one. A wait whose caller gave up holds its inbox, and renders only at changes
 * naming its own carriers, until they settle, a later word supersedes them or the projector stops. A view
 * that names no origin yet counts as not arrived.
 *
 * THE WORD NAMES THE STATE OR A LATER ONE. Where the view moves past the named records before the marked
 * reconcile runs, that reconcile projects the later state, and the word still holds: a scan that follows
 * reads what the projection left. A carrier whose records never moved settles at the first look, at the
 * cost of one reconcile that writes nothing.
 */
export async function settled(core: ProjectorCore, bagId: string, carriers: ReadonlyArray<{ readonly uri: string; readonly records: string; readonly heads?: readonly string[] }>): Promise<
  | { readonly mirrored: false }
  | {
      readonly mirrored: true; readonly settled: readonly string[]; readonly elsewhere: readonly string[];
      readonly superseded: readonly string[]; readonly stopped: readonly string[]; readonly failed: readonly string[];
      readonly closed: readonly string[];
    }
> {
  if (!core.mirrors.some((m) => m.bagId === bagId)) return { mirrored: false };
  const waiting = new Map(carriers.map((c) => [c.uri, c.records] as const));
  const named = new Map(carriers.filter((c) => c.heads !== undefined && c.heads.length > 0).map((c) => [c.uri, c.heads!] as const));
  const marked: string[] = [];
  const elsewhere: string[] = [];
  const failed: string[] = [];
  const watches = new Map<string, ReconcileWatch>();
  const inbox: SettleInbox = { bagId, roots: new Set(), all: true, waiting, superseded: [] };
  // A LATER WORD SUPERSEDES AN EARLIER ONE OF THE SAME BAG: every earlier wait over this bag gives up the
  // carriers this one names while it still waits for their records, and wakes. A wait over another bag keeps
  // its own records' wait.
  let took = false;
  for (const other of core.settleInboxes) {
    if (other.bagId !== bagId) continue;
    for (const uri of waiting.keys()) if (other.waiting.delete(uri)) { other.superseded.push(uri); took = true; }
  }
  core.settleInboxes.add(inbox);
  if (took) wakeWaiters(core, new Set());
  // THE FAR SIDE'S CLOSE ends a word that named heads: no record comes through a link that closed. The close
  // brings one more look of every carrier (`afterClose`), and what that look still finds absent reads `closed`.
  const far = named.size > 0 ? core.farSideClosed?.(bagId) ?? null : null;
  let closed = false as boolean;
  const farClosed = far === null ? null : far.promise.then(() => { closed = true; inbox.all = true; });
  try {
    for (;;) {
      // Arm the wake BEFORE the look, so an event that comes while the look awaits a render wakes the next look.
      const wake = nextWake(core);
      const afterClose = closed;
      try {
        const look = inbox.all ? null : new Set(inbox.roots);
        inbox.roots.clear(); inbox.all = false;
        for (const [uri, records] of [...waiting]) {
          if (look !== null && !look.has(uri)) continue;
          const originOf = (): unknown => (core._tw5?.$tw.wiki.getTiddler?.(uri)?.fields as Record<string, unknown> | undefined)?.["$origin-bag"];
          const origin = originOf();
          if (typeof origin !== "string") continue;
          if (origin !== bagId && ranksAbove(core, origin, bagId)) { waiting.delete(uri); elsewhere.push(uri); continue; }
          // Only this bag's own records can settle the word: a view another bag answers renders nothing here.
          if (origin !== bagId) continue;
          // THE VIEW HOLDS THE NAMED HEADS: the records arrived (the bytes may render a later state, which the
          // marked reconcile projects), so no render decides this carrier.
          const heads = named.get(uri);
          if (heads !== undefined && core.viewHolds?.(bagId, uri, heads) === true) {
            waiting.delete(uri);
            marked.push(uri);
            watches.set(uri, watchReconcile(core, uri));
            if (core.gate !== null) core.gate.mark(uri);
            else await reconcileWatched(core, uri).catch(() => undefined);
            continue;
          }
          let hash: string;
          try {
            const file = await core.carrierFileFn(uri);
            if (file === null) continue;
            const { output } = await renderedOutput(core, uri, file);
            hash = carrierHash(output, file.metaBody);
          } catch {
            // A look that cannot render the carrier claims nothing for it: the word names it failed, unless a
            // later word took the carrier while the look rendered, or the view moved off this bag meanwhile
            // (the change event that moved it brings the next look).
            if (originOf() !== bagId) continue;
            if (waiting.delete(uri)) failed.push(uri);
            continue;
          }
          if (!waiting.has(uri)) continue;   // a later word took it while this look rendered
          // The view may have moved while the look rendered: a render counts for the origin it read alone, and
          // the change event that moved it brings the next look.
          if (originOf() !== bagId) continue;
          if (digestsEqual(hash, records)) {
            // The view holds the named records: a reconcile marked now reads them, and the drain below waits for it.
            waiting.delete(uri);
            marked.push(uri);
            watches.set(uri, watchReconcile(core, uri));
            if (core.gate !== null) core.gate.mark(uri);
            else await reconcileWatched(core, uri).catch(() => undefined);
            continue;
          }
        }
        if (waiting.size === 0 || core.stopping) break;
        // A look that followed the close ends the word: what it found absent can never come. A carrier whose
        // named heads the island's own replica holds still comes, through the island's own pipeline.
        if (afterClose && ![...waiting.keys()].some((uri) => { const h = named.get(uri); return h !== undefined && core.docHolds?.(bagId, h) === true; })) break;
        if (inbox.all || inbox.roots.size > 0) continue;   // a change came during the look: look again now
        await (farClosed === null || closed ? wake.promise : Promise.race([wake.promise, farClosed]));
      } finally {
        wake.cancel();
      }
    }
    await core.idle();
  } finally {
    far?.cancel();
    core.settleInboxes.delete(inbox);
    for (const [uri, watch] of watches) releaseWatch(core, uri, watch);
  }
  const settled: string[] = [];
  // What still waits when the loop ends: the far side's close names it `closed`; a stop names it `stopped`.
  const left = [...waiting.keys()];
  const stopped = closed && !core.stopping ? [] : left;
  const closedUris = closed && !core.stopping ? left : [];
  for (const uri of marked) {
    const watch = watches.get(uri)!;
    if (watch.threw) failed.push(uri);
    else if (watch.ran) settled.push(uri);
    else stopped.push(uri);   // the projector stopped before the marked reconcile ran
  }
  return { mirrored: true, settled, elsewhere, superseded: inbox.superseded, stopped, failed, closed: closedUris };
}

/** True where the composition ranks `origin` above `bagId`; false where below, unmounted or unknown. */
export function ranksAbove(core: ProjectorCore, origin: string, bagId: string): boolean {
  if (!core.layerIndexOf) return false;
  const at = core.layerIndexOf(origin);
  const of = core.layerIndexOf(bagId);
  return at >= 0 && of >= 0 && at > of;
}
