/**
 * SITING: where a carrier's file stands in one mirror. A `$:/config/FileSystemPaths` rule, else the loci law, else TW5's
 * flattened default through the free-or-mine uniquifier; and the files a carrier's siting already holds.
 * Heleuma ha: see lararium/mesh/disk-projector-siting.
 */

import type { CarrierFile } from "@lararium/tw5";
import { confineMirrorWrite, carrierBaseRelPath, titleRelPath } from "../bag-paths.js";
import type { BagMirrorConfig } from "../bag-paths.js";
import type { ProjectorCore } from "./core.js";
import { sitedKey } from "./entries.js";
import { carrierDiskFiles, projectedFileTitle } from "./disk-files.js";

/**
 * Resolve a carrier's confined on-disk file(s) within ONE mirror — the
 * native-aware shore globs the actual `<stem><ext>` (+ `.meta`) so a
 * `.tid`/`.md`/`.json` carrier resolves its real files (the ruling: the
 * extension varies); the memetic fallback resolves the single `.mem` path.
 * Returns null to SKIP (unresolvable name, or a ward refusal already surfaced);
 * an empty array means the name resolved but no file sits on disk.
 */
export function mirrorCarrierFiles(core: ProjectorCore, mirror: BagMirrorConfig, uri: string): string[] | null {
  const base = core.sited.get(sitedKey(mirror.bagId, uri)) ?? carrierBaseRelPath(uri);
  if (!base) return null;
  const gate = confineMirrorWrite(mirror.mirrorRoot, base, mirror.allowBagsRootFiles);
  if (!gate.ok) {
    console.error(`[disk-ward] unlink refused (${mirror.bagId}): ${gate.reason}`);
    core.onRefusal?.({ bagId: mirror.bagId, uri, reason: gate.reason });
    return null;
  }
  return carrierDiskFiles(gate.path);
}

/** The carrier files standing at one extension-less mirror-relative base, or null where the ward refuses it. */
export function mirrorCarrierFilesAt(mirror: BagMirrorConfig, base: string): string[] | null {
  const gate = confineMirrorWrite(mirror.mirrorRoot, base, mirror.allowBagsRootFiles);
  return gate.ok ? carrierDiskFiles(gate.path) : null;
}

/**
 * THE UNIQUIFIER — TW5's `title`, `title_1`, `title_2` … walk (filesystem.js:382-390), with its
 * one memory-bound step replaced.
 *
 * TW5 breaks its loop on `oldPath == fullPath`, where `oldPath` comes from `$tw.boot.files` — the
 * in-memory title→path assignment its process holds for life. This projector holds none, so the
 * break condition reads off the DISK instead: a candidate is free when nothing sits there, and
 * MINE when what sits there names this very title (`projectedFileTitle`). Same walk, same
 * assignment, and it survives a restart because the evidence never left the filesystem.
 *
 * Where the format proves nothing, this REFUSES rather than clobber a stranger's bytes or grow a
 * `_1` per boot. Applied ONLY to the flattened default — a ruled path and a loci path both keep
 * exactly the siting they had (the loci path is injective by construction, and a `.mem` carries
 * no `title:` to read back, so uniquifying there could only misfire).
 */
export function uniquifyBase(
  mirror: BagMirrorConfig,
  base: string,
  ext: string,
  hasMeta: boolean,
  title: string,
): { readonly base: string } | { readonly reason: string } {
  for (let count = 0; count < 1000; count++) {
    const candidate = count === 0 ? base : `${base}_${count}`;
    const gate = confineMirrorWrite(mirror.mirrorRoot, candidate + ext, mirror.allowBagsRootFiles);
    if (!gate.ok) return { reason: gate.reason };
    const owner = projectedFileTitle(gate.path, ext, hasMeta);
    if (owner === null || owner === title) return { base: candidate };   // free, or already mine
    if (owner === undefined) {
      return { reason: `${candidate}${ext} is occupied and its format proves no ownership — refusing to clobber or to grow a copy per boot (${title})` };
    }
  }
  return { reason: `no free-or-mine path for "${title}" within 1000 tries at ${base}${ext}` };
}

/**
 * SITE ONE CARRIER in one mirror: the extension-less mirror-relative base its file takes, or null where nothing sites it
 * (a deliberate refusal inside the `lar:` family, or a flattened title the uniquifier refused, which speaks on the
 * refusal rail first).
 */
export function siteBase(core: ProjectorCore, mirror: BagMirrorConfig, file: CarrierFile, tiddlerUri: string): string | null {
  // Three sitings, one precedence, each reading off the shape of what the shore handed back:
  //   ① a `$:/config/FileSystemPaths` RULE (`relPath`) — the operator's own word, and the same
  //      word a stock server's filesystem adaptor obeys, so both doors site one file.
  //   ② the LOCI law — `lar:///w.w.w/…` at its uri-path. Injective, so it needs no uniquifier.
  //   ③ TW5's FLATTENED default (`defaultRelPath`) — the ONLY thing that sites a foreign title
  //      (`My Notes`, `$:/config/Foo`), which owns no uri-path. Two titles may flatten alike, so
  //      this one — and only this one — walks the free-or-mine uniquifier.
  const ruledBase = file.relPath !== undefined && file.relPath.endsWith(file.ext)
    ? file.relPath.slice(0, file.relPath.length - file.ext.length)
    : null;
  // A title-path mirror (the kahua stage) sites a foreign title at its own `/` path before TW5's flatten reaches it.
  const base = ruledBase ?? carrierBaseRelPath(tiddlerUri) ?? (mirror.titlePaths ? titleRelPath(tiddlerUri) : null);
  // The flatten reaches ONLY a name the address siting rule does not govern. Inside the `lar:` family a null
  // base is a DELIBERATE refusal (a fragment owns no file — its carrier root does; a bag manifest
  // belongs to the declare verb), never a name left un-sited for want of a path, so flattening one
  // would resurrect exactly what those refusals withhold.
  if (base === null && !tiddlerUri.startsWith("lar:")
      && file.defaultRelPath !== undefined && file.defaultRelPath.endsWith(file.ext)) {
    const flat = file.defaultRelPath.slice(0, file.defaultRelPath.length - file.ext.length);
    const sited = uniquifyBase(mirror, flat, file.ext, file.metaBody !== undefined, tiddlerUri);
    if ("reason" in sited) {
      console.error(`[disk-ward] siting refused (${mirror.bagId} <- ${tiddlerUri}): ${sited.reason}`);
      core.onRefusal?.({ bagId: mirror.bagId, uri: tiddlerUri, reason: sited.reason });
      return null;
    }
    return sited.base;
  }
  return base;
}
