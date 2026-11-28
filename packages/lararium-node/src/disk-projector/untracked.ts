/**
 * THE FILES A CHECKOUT NEVER TRACKED: a dropped carrier's untracked file stays and raises its alert (`keepUntracked`),
 * and the census lists every untracked file under each mirror root (`untrackedCarriers`).
 * Heleuma ha: see lararium/mesh/disk-projector-untracked.
 */

import { existsSync } from "fs";
import { dirname, resolve as resolvePath } from "path";
import type { ProjectorCore } from "./core.js";
import { untrackedCarrierAlertTitle } from "./entries.js";

/**
 * THE HOMES A CHECKOUT NEVER TRACKED, where the records dropped their carrier. Each content file (or its sidecar) git
 * reads untracked, or a checkout git cannot read, stays and raises one alert per path naming the cure; a home that no
 * longer stands untracked clears the alert it raised. Answers whether any home stays, so the caller leaves every home
 * of this carrier where it stands.
 */
export function keepUntracked(core: ProjectorCore, bagId: string, uri: string, homes: readonly string[]): boolean {
  if (core.untrackedAt === undefined) return false;
  const wiki = core._tw5?.$tw.wiki as unknown as {
    getTiddler?: (t: string) => unknown; addTiddler?: (f: Record<string, unknown>) => void; deleteTiddler?: (t: string) => void;
  } | undefined;
  let kept = false;
  for (const home of [...new Set(homes)].sort()) {
    const alert = untrackedCarrierAlertTitle(home);
    const files = [home, `${home}.meta`].filter((f) => existsSync(f));
    const reading = files.length === 0 ? null : core.untrackedAt(dirname(home));
    const untracked = reading !== null && "untracked" in reading ? files.filter((f) => reading.untracked.includes(f)) : [];
    const why = reading !== null && "why" in reading ? reading.why : null;
    if (untracked.length === 0 && why === null) {
      if (wiki?.getTiddler?.(alert) !== undefined) wiki.deleteTiddler?.(alert);
      continue;
    }
    kept = true;
    const text = why === null
      ? `The records dropped ${uri}, and its file at ${home} rests untracked in a checkout: it holds the only copy, so it stays. Commit it, or remove it by hand.`
      : `The records dropped ${uri}, and its file at ${home} stays: ${why}. Commit it, or remove it by hand.`;
    const standing = (wiki?.getTiddler?.(alert) as { fields?: Record<string, unknown> } | undefined)?.fields;
    if (standing?.["text"] !== text) {
      console.error(`[disk-ward] untracked carrier kept (${bagId} <- ${uri}): ${home}`);
      wiki?.addTiddler?.({ title: alert, text, tags: "$:/tags/Alert", "alert-kind": "untracked-carrier", path: home, uri, bag: bagId });
    }
  }
  return kept;
}

/**
 * THE FILES EACH MIRROR'S CHECKOUT NEVER TRACKED, read and never moved: every untracked file under a mirror root a
 * checkout holds (by path, with the mirror's bag), and each root whose checkout git could not read. A mirror outside
 * every checkout names none. A stop with these on disk lists them first (`lares vessel census`): each owes a commit.
 */
export function untrackedCarriers(core: ProjectorCore): { readonly files: ReadonlyArray<{ readonly path: string; readonly bagId: string }>; readonly unread: ReadonlyArray<{ readonly root: string; readonly why: string }> } {
  const files = new Map<string, string>();
  const unread = new Map<string, string>();
  if (core.untrackedAt === undefined) return { files: [], unread: [] };
  for (const mirror of core.mirrors) {
    const root = resolvePath(mirror.mirrorRoot);
    const reading = core.untrackedAt(root);
    if (reading === null) continue;
    if ("why" in reading) { unread.set(root, reading.why); continue; }
    for (const path of reading.untracked) if (!files.has(path)) files.set(path, mirror.bagId);
  }
  return {
    files: [...files].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([path, bagId]) => ({ path, bagId })),
    unread: [...unread].map(([root, why]) => ({ root, why })),
  };
}
