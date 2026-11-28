/**
 * RECOVERY AT REST AND THE PINNED AGREEMENT: `recoveryAtRest` proves a captured recovery record stands in its granted
 * mirror's bytes; `pinAgreement` pins a base only where this island's own render and the file agree; `recordsRenderOf`
 * folds the render both read.
 * Heleuma ha: see lararium/mesh/disk-projector-recovery.
 */

import { existsSync, readFileSync } from "fs";
import { relative as relativePath, resolve as resolvePath } from "path";
import { digestsEqual } from "@lararium/mesh/agile-digest";
import { carrierHash } from "@lararium/mesh/crypto";
import { MEME_EXT } from "@lararium/mesh/mirror-paths";
import type { CarrierFile } from "@lararium/tw5";
import { confineMirrorWrite } from "../bag-paths.js";
import { syncedTreeKey } from "../synced-tree.js";
import type { ProjectorCore } from "./core.js";
import { realPathOf, contentOf } from "./entries.js";
import { otherDocument, ownBases, pin, forgetAt, basedHomes } from "./bases.js";
import { reconcileNow, isPackMember, shadowedOwnRecords, neverOnDisk } from "./reconcile.js";
import { mirrorCarrierFiles } from "./siting.js";
import { diskCarrierText, renderedOutput } from "./write.js";

/** Confirm the captured recovery record against the actual bytes at its granted mirror. */
export async function recoveryAtRest(core: ProjectorCore, bagId: string, title: string, written: Record<string, unknown> | null): Promise<void> {
  const mirrors = core.mirrors.filter((m) => m.bagId === bagId && m.mirrorClass === "recovery");
  if (!mirrors.length) return;
  const store = core.recoveryStore?.(bagId);
  if (!store || !core.recoveryFileFn || core.stopping) throw new Error("recovery projection unavailable");
  if (written === null) {
    const absent = async (): Promise<boolean> => {
      const record = await store.get(title);
      return !record || !!record.meta?.deleted;
    };
    if (!await absent()) throw new Error("recovery deletion superseded");
    const key = syncedTreeKey(bagId, title);
    core.syncedTree.reread(key);
    const homes = new Set(mirrors.flatMap((mirror) => [
      ...basedHomes(core, mirror, title),
      ...(mirrorCarrierFiles(core, mirror, title) ?? []).map((file) => contentOf(file)),
    ]));
    await reconcileNow(core, title);
    if (core.stopping) throw new Error("recovery projection stopped");
    if (!await absent()) throw new Error("recovery deletion superseded");
    core.syncedTree.reread(key);
    for (const mirror of mirrors) for (const home of basedHomes(core, mirror, title)) homes.add(home);
    if ([...homes].some((home) => existsSync(home) || existsSync(`${home}.meta`))) {
      throw new Error("recovery file still present or conflicting");
    }
    return;
  }
  const record = await store.get(title);
  if (!record || record.meta?.deleted) throw new Error("recovery record missing");
  const stableFields = (fields: Record<string, unknown>): string => JSON.stringify(Object.fromEntries(Object.entries(fields).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)));
  const captured = stableFields(written);
  if (stableFields(record.tiddler) !== captured) throw new Error("recovery record superseded");
  const file = await core.recoveryFileFn(written);
  if (!file || typeof file.body !== "string") throw new Error("recovery render unavailable");
  const expected = carrierHash(file.body, file.metaBody);
  await core.idle();
  if (core.stopping) throw new Error("recovery projection stopped");
  const current = await store.get(title);
  if (!current || current.meta?.deleted || stableFields(current.tiddler) !== captured) throw new Error("recovery record superseded");
  core.syncedTree.reread(syncedTreeKey(bagId, title));
  const bases = ownBases(core, bagId, title);
  for (const mirror of mirrors) {
    const candidates = bases.filter((base) => {
      const rel = relativePath(resolvePath(mirror.mirrorRoot), base.path);
      return rel !== "" && rel !== ".." && !rel.startsWith("../") && !rel.startsWith("..\\");
    });
    if (!candidates.some((base) => {
      if (!digestsEqual(base.records, expected)) return false;
      try {
        const body = readFileSync(base.path, "utf8");
        const meta = file.metaBody === undefined ? undefined : readFileSync(base.path + ".meta", "utf8");
        return digestsEqual(carrierHash(body, meta), expected);
      } catch { return false; }
    })) throw new Error("recovery file missing, conflicting, or not written");
  }
}

/**
 * The render this island's records hold for one carrier of a bag, folded as the projecting leg folds it (`flush`) and
 * chosen as `reconcileCarrier` chooses: the resolved view's carrier where the view shows it from this bag, else the bag's
 * own record where it stands shadowed and still projects (`shadowedOwnRecords`: none under a top tombstone, none for a
 * pack member). Null where reconcile projects no such record, the carrier never reaches disk, or its body rides a pointer
 * whose bytes the tier lacks.
 */
export async function recordsRenderOf(core: ProjectorCore, bagId: string, uri: string): Promise<{ readonly file: CarrierFile; readonly hash: string } | null> {
  const mirror = core.mirrors.find((m) => m.bagId === bagId && m.mirrorClass !== "recovery");
  if (!mirror || await neverOnDisk(core, mirror, uri)) return null;
  // A pack member lives inside its pack file and projects no file of its own.
  if (isPackMember(core, uri)) return null;
  const fields = core._tw5?.$tw.wiki.getTiddler?.(uri)?.fields as Record<string, unknown> | undefined;
  const origin = typeof fields?.["$origin-bag"] === "string" ? fields["$origin-bag"] : undefined;
  const winner = origin !== undefined && core.mirrors.some((m) => m.bagId === origin && m.mirrorClass !== "recovery") ? origin : undefined;
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
    if (m.bagId !== bagId || m.mirrorClass === "recovery") return false;
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
