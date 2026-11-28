/**
 * A CARRIER THE RECORDS DROPPED: each mirror whose bag holds it no more settles the homes its bases and siting name,
 * and the kāpae shadow follows the layer (`settleShadow`, `lowerShadowAt`).
 * Heleuma ha: see lararium/mesh/disk-projector-dropped.
 */

import { mkdirSync, unlinkSync, existsSync, readFileSync } from "fs";
import { dirname, resolve as resolvePath } from "path";
import { carrierHash } from "@lararium/mesh/crypto";
import { confineMirrorWrite, carrierBaseRelPath } from "../bag-paths.js";
import type { BagMirrorConfig } from "../bag-paths.js";
import { KAPAE_EXT, kapaeShadowBody } from "../kapae-shadow.js";
import { syncedTreeKey } from "../synced-tree.js";
import type { ProjectorCore } from "./core.js";
import { sitedKey, contentOf } from "./entries.js";
import { forgetAt, basedHomes } from "./bases.js";
import { settleHomes } from "./homes.js";
import { neverOnDisk } from "./reconcile.js";
import { mirrorCarrierFiles } from "./siting.js";
import { keepUntracked } from "./untracked.js";

/** Unlink by trying all mirrors whose path strategy resolves the URI — but a
 *  mirror whose bag STILL HOLDS the carrier keeps its file (a carrier hidden
 *  from the resolved view by a shadowing tombstone still lives in its lower
 *  bag; each mirror reflects its OWN bag's content, never the resolved view). */
export async function _scheduleUnlinkByTitle(core: ProjectorCore, title: string, spare?: ReadonlySet<string>): Promise<void> {
  if (core.bagsHolding) core.measure.holdsSinceChange++;
  const holdingBags = core.bagsHolding ? new Set(await core.bagsHolding(title)) : null;
  // A MIRROR ROOT A HOLDING BAG SHARES STAYS WHOLE. Two mirrors over one root resolve one carrier to one
  // file; the bag that dropped the carrier proves nothing about a file its neighbour still owns.
  const keptRoots = new Set<string>();
  for (const mirror of core.mirrors) if (holdingBags?.has(mirror.bagId) || spare?.has(mirror.bagId)) keptRoots.add(resolvePath(mirror.mirrorRoot));
  for (const mirror of core.mirrors) {
    if (holdingBags?.has(mirror.bagId) || spare?.has(mirror.bagId)) continue;
    if (keptRoots.has(resolvePath(mirror.mirrorRoot))) continue;
    // A title the address siting rule sites nowhere (a foreign title) names no file by itself; the base still may.
    const homes = (mirrorCarrierFiles(core, mirror, title) ?? []).map((f) => contentOf(f));
    // A sibling (the ingest gesture, another island) may have pinned a base for this carrier since this
    // projector loaded the tree: the directory answers before the homes get collected.
    core.syncedTree.reread(syncedTreeKey(mirror.bagId, title));
    // The base names the content file its agreement stood at, across a restart: a carrier a siting rule
    // or the flattened default placed elsewhere gets read there too.
    homes.push(...basedHomes(core, mirror, title));
    // Where the carrier sited, read BEFORE its siting leaves: the kāpae shadow takes that stem.
    const shadowBase = core.sited.get(sitedKey(mirror.bagId, title)) ?? carrierBaseRelPath(title);
    // A FILE GIT NEVER TRACKED STAYS: in a checkout it holds the only copy, so no proof of agreement lets it leave.
    // Its base stays with it, so the next scan reads the file where its agreement left it, never as an arrival.
    if (keepUntracked(core, mirror.bagId, title, homes)) continue;
    // The records hold no such carrier, so the base alone can vouch for a file. A held one goes to capture first.
    if (!await settleHomes(core, mirror.bagId, title, homes, null, null, `the records dropped ${title}`)) continue;
    // KĀPAE SHADOWS, ABSENT FALLS THROUGH, on disk too: a kāpae raised in this mirror's bag leaves its
    // shadow where the carrier stood; a record that left the bag (a MOVE, a promotion) leaves none.
    if (shadowBase !== null) await settleShadow(core, mirror, title, shadowBase);
    // A BASE LEAVES WITH ITS OWN FILE: each home this mirror weighed gives up its base, a home whose file
    // had already left included. A base at a path outside the mirror (a holding copy a hand keeps) stays
    // with its file, so that file's next scan still reads it against the agreement it reached.
    for (const home of new Set(homes)) forgetAt(core, mirror.bagId, title, home);
    core.sited.delete(sitedKey(mirror.bagId, title));
  }
}

/**
 * THE KĀPAE SHADOW FOLLOWS THE LAYER (`kapae-shadow.ts`). Where this mirror's own bag holds a raised kāpae
 * over the title, `<base>.kapae` stands, written only where its bytes differ, so a standing shadow takes
 * no write and wakes no watcher. Where the bag holds nothing under the title (a retract to absent), a
 * shadow standing there leaves: the record fell through and nothing stays set aside. The bag's own store
 * answers; a projector with no store door reads no kāpae and writes no shadow.
 */
export async function settleShadow(core: ProjectorCore, mirror: BagMirrorConfig, title: string, base: string): Promise<void> {
  if (await neverOnDisk(core, mirror, title)) return;
  const gate = confineMirrorWrite(mirror.mirrorRoot, base + KAPAE_EXT, mirror.allowBagsRootFiles);
  if (!gate.ok) {
    console.error(`[disk-ward] kāpae shadow refused (${mirror.bagId}): ${gate.reason}`);
    core.onRefusal?.({ bagId: mirror.bagId, uri: title, reason: gate.reason });
    return;
  }
  const store = core.bagStore?.(mirror.bagId);
  const record = store ? await store.get(title) : null;
  if (record?.meta?.deleted === true) {
    const body = kapaeShadowBody(title);
    let standing: string | null = null;
    try { standing = existsSync(gate.path) ? readFileSync(gate.path, "utf-8") : null; } catch { standing = null; }
    if (standing !== body) {
      core.writing.add(title);
      try {
        mkdirSync(dirname(gate.path), { recursive: true });
        core.atomicWrite(gate.path, body);
      } finally { core.writing.delete(title); }
    }
    // THE HOUSE REMEMBERS ITS SHADOW (`SyncedTree.shadows`): the bytes it wrote, or found standing as it would write them.
    const shadows = core.syncedTree.shadows();
    const key = syncedTreeKey(mirror.bagId, title), hash = carrierHash(body);
    if (shadows.baseAt(key, gate.path)?.disk !== hash) shadows.set(key, gate.path, hash);
    return;
  }
  if (record !== null || !existsSync(gate.path)) return;
  core.writing.add(title);
  try { lowerShadowAt(core, mirror.bagId, title, gate.path); } finally { core.writing.delete(title); }
}

/** A shadow standing at `path` leaves, and the house's memory of it with it: its title surfaced again, or fell through to
 *  absent. The caller holds the write mark. A shadow the disk would not give up keeps its row. */
export function lowerShadowAt(core: ProjectorCore, bagId: string, title: string, path: string): void {
  const shadows = core.syncedTree.shadows(), key = syncedTreeKey(bagId, title);
  let stood = false;
  try { if (existsSync(path)) { stood = true; unlinkSync(path); } } catch { return; /* best-effort — a hand can clean up */ }
  if (stood || shadows.baseAt(key, path) !== null) shadows.deleteAt(key, path);
}
