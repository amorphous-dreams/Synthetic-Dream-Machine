/**
 * THE PINNED AGREEMENT: `pinAgreement` pins a base only where this island's own render and the file agree;
 * `recordsRenderOf` folds the render it reads.
 * Heleuma ha: see lararium/mesh/disk-projector-agreement.
 */

import { existsSync } from "fs";
import { relative as relativePath } from "path";
import { digestsEqual } from "@lararium/mesh/agile-digest";
import { carrierHash } from "@lararium/mesh/crypto";
import { MEME_EXT } from "@lararium/mesh/mirror-paths";
import type { CarrierFile } from "@lararium/tw5";
import { confineMirrorWrite } from "../bag-paths.js";
import { syncedTreeKey } from "../synced-tree.js";
import type { ProjectorCore } from "./core.js";
import { realPathOf } from "./entries.js";
import { otherDocument, ownBases, pin, forgetAt } from "./bases.js";
import { isPackMember, shadowedOwnRecords, neverOnDisk } from "./reconcile.js";
import { diskCarrierText, renderedOutput } from "./write.js";

/**
 * The render this island's records hold for one carrier of a bag, folded as the projecting leg folds it (`flush`) and
 * chosen as `reconcileCarrier` chooses: the resolved view's carrier where the view shows it from this bag, else the bag's
 * own record where it stands shadowed and still projects (`shadowedOwnRecords`: none under a top tombstone, none for a
 * pack member). Null where reconcile projects no such record, the carrier never reaches disk, or its body rides a pointer
 * whose bytes the tier lacks.
 */
export async function recordsRenderOf(core: ProjectorCore, bagId: string, uri: string): Promise<{ readonly file: CarrierFile; readonly hash: string } | null> {
  const mirror = core.mirrors.find((m) => m.bagId === bagId);
  if (!mirror || await neverOnDisk(core, mirror, uri)) return null;
  // A pack member lives inside its pack file and projects no file of its own.
  if (isPackMember(core, uri)) return null;
  const fields = core._tw5?.$tw.wiki.getTiddler?.(uri)?.fields as Record<string, unknown> | undefined;
  const origin = typeof fields?.["$origin-bag"] === "string" ? fields["$origin-bag"] : undefined;
  const winner = origin !== undefined && core.mirrors.some((m) => m.bagId === origin) ? origin : undefined;
  if (winner !== bagId && !(await shadowedOwnRecords(core, uri, winner)).includes(bagId)) return null;
  const file = winner === bagId ? await core.carrierFileFn(uri) : await core.recordFileFn?.(bagId, uri) ?? null;
  if (file === null) return null;
  const { bodyPending, output } = await renderedOutput(core, uri, file);
  return bodyPending ? null : { file, hash: carrierHash(output, file.metaBody) };
}

/**
 * THE ISLAND PINS ONLY AN AGREEMENT IT READS ITSELF (the shore's `base` act; ONE OWNER OF PENDING STATE, `synced-tree.ts`). A
 * wave names a carrier and the file it landed from, and nothing else: no hash a caller sends ever lands. This projector
 * hashes the file itself, renders its own records, and pins a base at that file only where the two agree, byte for byte or
 * through the congruence the projecting leg reads (`canonicalizeFn`, `canonicalizeNativeFn`), under its own document and
 * its own heads (`pin`), so the row waits on its seal like every pin of this tree.
 *
 *   unprojected  no ordinary mirror of this projector holds the bag: another island answers for it
 *   outside-mirror  the file lies outside every ordinary mirror root of the bag: nothing pins
 *   unread       this island reads no file there (it left, or it rests where this island cannot read): nothing lands
 *   differs      the file and this island's records say different things, the bag holds no such record here, or the
 *                file answers to another document: no agreement stands, and the gate weighs the carrier as it stands
 *   waiting      a pin of this same agreement already waits on its seal: the ask waits with it
 *   kept         the tree already names the agreement
 *   recorded     the pin set
 *
 * `from` names the vanished source of a rename the island confirmed: once the moved carrier's agreement stands, the
 * source gives up each base of those same bytes whose own file stands no more.
 */
export async function pinAgreement(core: ProjectorCore, bagId: string, uri: string, file: string, from?: string): Promise<"unprojected" | "outside-mirror" | "unread" | "differs" | "waiting" | "kept" | "recorded"> {
  if (!core.projects(bagId)) return "unprojected";
  // A file outside every ordinary mirror of the bag stands beyond this island's reach: no pin lands there. The check reads
  // the roots as `confineMirrorWrite` reads them (the widened bags-dir grant included), over real paths on both sides, so a
  // symlinked root weighs a realpath'd file as the projecting leg does.
  const realFile = realPathOf(file);
  const within = core.mirrors.some((m) => {
    if (m.bagId !== bagId) return false;
    const realRoot = realPathOf(m.mirrorRoot);
    return confineMirrorWrite(realRoot, relativePath(realRoot, realFile), m.allowBagsRootFiles).ok;
  });
  if (!within) return "outside-mirror";
  const render = await recordsRenderOf(core, bagId, uri);
  // The sidecar reads only where the render carries one, as the projecting leg reads it: a stray `.meta` beside a carrier
  // whose render holds no metaBody stays no part of the disk's state.
  const metaPath = file + ".meta";
  const isBinary = render?.file.encoding === "base64";
  const onDisk = diskCarrierText(file, render?.file.metaBody !== undefined && existsSync(metaPath) ? metaPath : null, isBinary);
  if (onDisk === null) return "unread";
  if (render === null) return "differs";
  const disk = carrierHash(onDisk.body, onDisk.meta);
  const canonical = ((): string | null => {
    if (render.file.ext === MEME_EXT) {
      const text = core.canonicalizeFn ? core.canonicalizeFn(uri, onDisk.body) : null;
      return text === null ? null : carrierHash(text, onDisk.meta);
    }
    if (isBinary || !core.canonicalizeNativeFn) return null;
    const native = core.canonicalizeNativeFn(uri, render.file.ext, onDisk.body, onDisk.meta);
    return native === null ? null : carrierHash(native.body, native.metaBody);
  })();
  if (!digestsEqual(disk, render.hash) && !(canonical !== null && digestsEqual(canonical, render.hash))) return "differs";
  const key = syncedTreeKey(bagId, uri);
  const standing = core.syncedTree.baseAt(key, file);
  if (otherDocument(core, bagId, standing)) return "differs";
  // THE SOURCE'S BASE LEAVES WITH ITS OWN FILE, now that the moved carrier's agreement stands at the new one.
  if (from !== undefined && from !== uri) {
    for (const base of ownBases(core, bagId, from)) if (digestsEqual(base.disk, disk) && !existsSync(base.path)) forgetAt(core, bagId, from, base.path);
  }
  const agrees = standing !== null && digestsEqual(standing.disk, disk) && digestsEqual(standing.records, render.hash);
  if (agrees && core.syncedTree.pendingAt(key, file)) { core.syncedTree.metWaiting(key, file); return "waiting"; }
  // A row that names the agreement stays put, unless this document's history stands to name and the row names none.
  if (agrees && (standing!.heads !== undefined || !core.lineageOf?.(bagId)?.heads?.length)) return "kept";
  pin(core, bagId, uri, file, disk, render.hash);
  return "recorded";
}
