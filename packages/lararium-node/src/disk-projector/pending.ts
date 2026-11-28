/**
 * PENDING REMOVALS AND THE DISK LOOK: a carrier whose file vanished from the path its base names stands pending until a
 * person answers; each settled set surfaces once the queue drains; `sense` and `vanished` read the disk on demand.
 * Heleuma ha: see lararium/mesh/disk-projector-pending.
 */

import { existsSync } from "fs";
import { relative as relativePath, resolve as resolvePath } from "path";
import { sha256HexBytesSync } from "@lararium/mesh/crypto";
import { confineMirrorWrite } from "../bag-paths.js";
import type { ProjectorCore } from "./core.js";
import { sitedKey, keepSpares } from "./entries.js";
import { otherDocument } from "./bases.js";

/** This carrier's file vanished from the path its base names: it stands pending until a person answers or the file returns. */
export function _enterPending(core: ProjectorCore, bagId: string, uri: string, path: string): void {
  const key = sitedKey(bagId, uri);
  if (core.pending.get(key)?.path === path) return;
  core.pending.set(key, { bagId, uri, path });
  _pendingSetMoved(core);
}

export function _leavePending(core: ProjectorCore, bagId: string, uri: string): void {
  if (core.pending.delete(sitedKey(bagId, uri))) _pendingSetMoved(core);
}

/** Leave the pending removal this carrier stands in under every mirror but `keepBag` (none kept when absent). */
export function _leavePendingExcept(core: ProjectorCore, uri: string, keep?: string | ReadonlySet<string>): void {
  if (core.pending.size === 0) return;
  for (const mirror of core.mirrors) if (!keepSpares(keep, mirror.bagId)) _leavePending(core, mirror.bagId, uri);
}

/**
 * A pending set moved. ITS SURFACING WAITS FOR THE QUEUE TO DRAIN, by the queue's own idle handshake
 * and no timer: a mount scan that finds five hundred vanished files raises one alert naming the count.
 */
export function _pendingSetMoved(core: ProjectorCore): void {
  if (core.pendingMoved) return;
  core.pendingMoved = true;
  void (core.gate?.idle() ?? Promise.resolve()).then(() => { _surfacePending(core); });
}

/** Surface each bag's pending-removal set where its membership moved since the last surfacing. */
export function _surfacePending(core: ProjectorCore): void {
  if (!core.pendingMoved) return;
  core.pendingMoved = false;
  const byBag = new Map<string, string[]>();
  for (const p of core.pending.values()) byBag.set(p.bagId, [...(byBag.get(p.bagId) ?? []), p.uri]);
  for (const bagId of new Set([...core.pendingSurfaced.keys(), ...byBag.keys()])) {
    const uris = (byBag.get(bagId) ?? []).sort();
    const key = uris.length === 0 ? undefined
      : sha256HexBytesSync(new TextEncoder().encode([bagId, "pending-removal", ...uris].join("\n"))).slice(0, 24);
    const surfaced = core.pendingSurfaced.get(bagId);
    if (surfaced === key) continue;
    if (surfaced !== undefined) { core.pendingSurfaced.delete(bagId); core.onPendingRemovalResolved?.({ bagId, key: surfaced }); }
    if (key === undefined) continue;
    core.pendingSurfaced.set(bagId, key);
    const named = uris.slice(0, 5);
    const reason = `${uris.length} carrier(s) vanished from disk where a base stands (${named.join(", ")}${uris.length > named.length ? ", …" : ""}); nothing writes back and nothing tombstones until a person answers: \`lares shore remove\` or \`lares shore restore\``;
    console.error(`[confluence] pending removal (${bagId}): ${reason}`);
    core.onPendingRemoval?.({ bagId, key, count: uris.length, uris: named, reason });
  }
}

/** Every carrier that stands pending right now: its bag, its address and the path its file left. */
export function pendingRemovals(core: ProjectorCore): Array<{ readonly bagId: string; readonly uri: string; readonly path: string }> {
  return [...core.pending.values()].sort((a, b) => a.bagId.localeCompare(b.bagId) || a.uri.localeCompare(b.uri));
}

/**
 * LOOK AT THE DISK NOW. The projector reads the disk only when a reconcile runs, and a file a hand
 * moved raises no change in the wiki. `sense` reconciles the named carrier roots (every root this
 * projector mirrors, when none get named) and returns once the queue drains: a vanished file enters the
 * pending set, a returned one leaves it, and every moved file reads against the base at its path.
 */
export async function sense(core: ProjectorCore, uris?: readonly string[]): Promise<void> {
  const roots = uris ?? mirroredRoots(core);
  if (core.gate === null) { for (const uri of roots) await core.reconcile(uri); _surfacePending(core); return; }
  for (const uri of roots) core.gate.mark(uri);
  await core.idle();
}

/**
 * THE CARRIERS WHOSE FILE LEFT WITH NO ONE WATCHING. A hand that removes a mirrored file raises no change
 * in the wiki, and where no watcher runs nothing marks the carrier. This reads the tree afresh and names
 * each carrier root the wiki still holds whose base stands at a path of one of this projector's mirrors
 * where no content file stands. It reads no file and decides nothing: a caller hands the names to `sense`,
 * and the gate answers each.
 */
export function vanished(core: ProjectorCore): string[] {
  core.syncedTree.reread();
  const held = new Set(mirroredRoots(core));
  const gone = new Set<string>();
  for (const { bagId, uri, base } of core.syncedTree.rows()) {
    if (!held.has(uri) || existsSync(base.path) || otherDocument(core, bagId, base)) continue;
    const mirror = core.mirrors.find((m) => m.bagId === bagId);
    if (mirror === undefined) continue;
    if (confineMirrorWrite(mirror.mirrorRoot, relativePath(resolvePath(mirror.mirrorRoot), base.path), mirror.allowBagsRootFiles).ok) gone.add(uri);
  }
  return [...gone].sort();
}

/** Every carrier root in the wiki whose `$origin-bag` names one of this projector's mirrors. */
export function mirroredRoots(core: ProjectorCore): string[] {
  const wiki = core._tw5?.$tw.wiki as unknown as { allTitles?: () => string[]; getTiddler?: (t: string) => { fields: Record<string, unknown> } | undefined } | undefined;
  const roots: string[] = [];
  for (const title of wiki?.allTitles?.() ?? []) {
    if (title.includes("#")) continue;
    const bagId = wiki?.getTiddler?.(title)?.fields["$origin-bag"];
    if (typeof bagId === "string" && core.mirrors.some((m) => m.bagId === bagId)) roots.push(title);
  }
  return roots;
}
