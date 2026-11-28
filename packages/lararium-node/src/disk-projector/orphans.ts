/**
 * THE ORPHAN FOLDER (disk-projection#/the-orphan-folder): slot records whose chain reaches no standing root project as
 * plain record files under `<root-stem>.orphans/`, the wiki raises the root's orphan flag, and a root that returns takes
 * its slots back.
 * Heleuma ha: see lararium/mesh/disk-projector-orphans.
 */

import { mkdirSync, unlinkSync, existsSync, readFileSync, readdirSync, rmdirSync } from "fs";
import { dirname, relative as relativePath, resolve as resolvePath } from "path";
import { digestsEqual } from "@lararium/mesh/agile-digest";
import { carrierHash } from "@lararium/mesh/crypto";
import { memeOrphanAlertTitle, orphansUnder, ORPHAN_FOLDER_SUFFIX } from "@lararium/mesh/family";
import { surfaceOrphanAlert, wikiFamilyView } from "@lararium/tw5";
import { confineMirrorWrite, carrierBaseRelPath } from "../bag-paths.js";
import type { BagMirrorConfig } from "../bag-paths.js";
import type { ProjectorCore } from "./core.js";
import { safeReadEquals } from "./entries.js";
import type { OrphanWiki } from "./entries.js";
import { orphanRecordFile, orphanRelPath } from "./orphan-files.js";
import { ownBaseAt, pin, forgetAt } from "./bases.js";
import { neverOnDisk } from "./reconcile.js";

/** The ordinary mirrors: every mirror an orphan folder may rest in. */
export function orphanMirrors(core: ProjectorCore): BagMirrorConfig[] {
  return core.mirrors.filter((m) => m.mirrorClass !== "recovery");
}

/** Every root whose orphan folder a mirror holds on disk: `<stem>.orphans/` names `lar:///<stem>`. */
export function orphanFolderRoots(core: ProjectorCore): string[] {
  const roots = new Set<string>();
  const walk = (dir: string, rel: string): void => {
    let entries: import("fs").Dirent[];
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const at = rel === "" ? entry.name : `${rel}/${entry.name}`;
      if (entry.name.endsWith(ORPHAN_FOLDER_SUFFIX)) roots.add(`lar:///${at.slice(0, at.length - ORPHAN_FOLDER_SUFFIX.length)}`);
      else walk(`${dir}/${entry.name}`, at);
    }
  };
  for (const mirror of orphanMirrors(core)) walk(resolvePath(mirror.mirrorRoot), "");
  return [...roots];
}

/** Every file beneath an orphan folder, absolute. */
export function orphanFilesIn(dir: string): string[] {
  const out: string[] = [];
  let entries: import("fs").Dirent[];
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const entry of entries) {
    if (entry.isDirectory()) out.push(...orphanFilesIn(`${dir}/${entry.name}`));
    else out.push(`${dir}/${entry.name}`);
  }
  return out;
}

/** Remove a directory and each emptied directory above it, up to and including `top`. A directory that holds anything stays. */
export function pruneEmptyDirs(dir: string, top: string): void {
  let cur = dir;
  for (;;) {
    try { rmdirSync(cur); } catch { return; }
    if (cur === top) return;
    cur = dirname(cur);
    if (!cur.startsWith(top)) return;
  }
}

/**
 * THE ORPHAN GRADIENT'S LAST RUNG: KEEP THE PIECES AND FLAG. Where a root's slot records stand with no
 * root above them (a merge that killed the root under a live child, a lone child landing, a bare delete),
 * each stays live and projects as a plain record file under `<root-stem>.orphans/`, in the mirror of the
 * bag it rests in, and the wiki raises the root's orphan flag. A root that returns re-roots them: the
 * carrier renders them again, their files here leave, and the flag clears.
 *
 * The pass runs where a reason stands: the root reads absent, a slot beneath it left or broke its chain
 * (`orphanSuspects`), its flag stands, or a mirror still holds its folder. A whole family costs one read.
 *
 * A FILE HERE LEAVES ONLY WHERE ITS BYTES STAND AS THE PROJECTOR LEFT THEM: the base pinned at its path
 * vouches for it. A file a hand edited or added stays, as every unlink in this projector reads first.
 */
export async function reconcileOrphans(core: ProjectorCore, rootUri: string): Promise<void> {
  const wiki = core._tw5?.$tw.wiki as unknown as OrphanWiki | undefined;
  if (!wiki || typeof wiki.allTitles !== "function" || typeof wiki.addTiddler !== "function" || rootUri.includes("#")) return;
  const stem = carrierBaseRelPath(rootUri);
  const folders = new Map<BagMirrorConfig, string>();
  if (stem !== null) {
    for (const mirror of orphanMirrors(core)) {
      const gate = confineMirrorWrite(mirror.mirrorRoot, stem + ORPHAN_FOLDER_SUFFIX, mirror.allowBagsRootFiles);
      if (gate.ok) folders.set(mirror, gate.path);
    }
  }
  const suspect = core.orphanSuspects.delete(rootUri);
  const flagged = wiki.getTiddler(memeOrphanAlertTitle(rootUri)) !== undefined;
  const held = [...folders.values()].some((path) => existsSync(path));
  if (wiki.getTiddler(rootUri) !== undefined && !suspect && !flagged && !held) return;

  const orphans = orphansUnder(wikiFamilyView(wiki as never), rootUri);
  surfaceOrphanAlert(wiki as never, rootUri, orphans);

  for (const [mirror, folder] of folders) {
    const wanted = new Map<string, { body: string; key: string }>();
    for (const title of orphans) {
      const tiddler = wiki.getTiddler(title);
      if (!tiddler || tiddler.fields["$origin-bag"] !== mirror.bagId) continue;
      if (await neverOnDisk(core, mirror, title, tiddler.fields)) continue;
      const strings = tiddler.getFieldStrings?.() ?? Object.fromEntries(Object.entries(tiddler.fields).map(([k, v]) => [k, String(v)]));
      const file = orphanRecordFile(strings);
      const rel = `${stem}${ORPHAN_FOLDER_SUFFIX}/${orphanRelPath(rootUri, title)}`;
      const gate = confineMirrorWrite(mirror.mirrorRoot, rel + file.ext, mirror.allowBagsRootFiles);
      if (!gate.ok) {
        console.error(`[disk-ward] orphan write refused (${mirror.bagId} <- ${title}): ${gate.reason}`);
        core.onRefusal?.({ bagId: mirror.bagId, uri: title, reason: gate.reason });
        continue;
      }
      // The key the ingest leg derives for this file (`mirrorDirFileToUri`): the base it reads stands here.
      wanted.set(gate.path, { body: file.body, key: `lar:///${rel}` });
    }
    for (const [path, { body, key }] of wanted) {
      const hash = carrierHash(body);
      if (safeReadEquals(path, body)) { pin(core, mirror.bagId, key, path, hash); continue; }
      // A file a hand left at this path stays: the base alone vouches for bytes the projector may replace.
      if (existsSync(path)) {
        const base = ownBaseAt(core, mirror.bagId, key, path);
        let standing: string | null = null;
        try { standing = readFileSync(path, "utf-8"); } catch { standing = null; }
        if (base === null || standing === null || !digestsEqual(carrierHash(standing), base.disk)) continue;
      }
      core.writing.add(key);
      try {
        mkdirSync(dirname(path), { recursive: true });
        core.atomicWrite(path, body);
        pin(core, mirror.bagId, key, path, hash);
      } finally { core.writing.delete(key); }
    }
    if (!existsSync(folder)) continue;
    for (const path of orphanFilesIn(folder)) {
      if (wanted.has(path)) continue;
      const rel = relativePath(resolvePath(mirror.mirrorRoot), path).split("\\").join("/");
      const key = `lar:///${rel.replace(/\.[^/.]+$/, "")}`;
      const base = ownBaseAt(core, mirror.bagId, key, path);
      let standing: string | null = null;
      try { standing = readFileSync(path, "utf-8"); } catch { standing = null; }
      if (base === null || standing === null || !digestsEqual(carrierHash(standing), base.disk)) continue;
      core.writing.add(key);
      try { unlinkSync(path); } catch { /* best-effort — a hand can clean up */ } finally { core.writing.delete(key); }
      forgetAt(core, mirror.bagId, key, path);
      pruneEmptyDirs(dirname(path), folder);
    }
    pruneEmptyDirs(folder, folder);
  }
}
