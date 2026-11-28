/**
 * THE FLUSH: render one carrier through the one render shore, site it, settle the homes a siting move left, skip a
 * byte-identical write, meet the projecting leg's gate (`confluence.ts`), write body then sidecar, and sweep the mirrors
 * the carrier left.
 * Heleuma ha: see lararium/mesh/disk-projector-flush.
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { dirname, extname } from "path";
import { carrierHash } from "@lararium/mesh/crypto";
import { confineMirrorWrite } from "../bag-paths.js";
import { KAPAE_EXT } from "../kapae-shadow.js";
import { contentHash, syncedTreeKey } from "../synced-tree.js";
import type { ProjectorCore } from "./core.js";
import { sitedKey, safeReadEquals, contentOf } from "./entries.js";
import { carrierDiskFiles } from "./disk-files.js";
import { otherDocument, pin, basedHomes } from "./bases.js";
import { projectingLeg } from "./confluence.js";
import { lowerShadowAt } from "./dropped.js";
import { settleHomes } from "./homes.js";
import { _leavePending } from "./pending.js";
import { neverOnDisk } from "./reconcile.js";
import { mirrorCarrierFiles, mirrorCarrierFilesAt, siteBase } from "./siting.js";
import { _leaveStandoff } from "./standoffs.js";
import { renderedOutput } from "./write.js";

export async function flush(core: ProjectorCore, bagId: string, tiddlerUri: string, recoveryFields?: Record<string, unknown>, ownRecord = false): Promise<void> {
  const mirror = core.mirrors.find((m) => m.bagId === bagId);
  if (!mirror) return;

  if (await neverOnDisk(core, mirror, tiddlerUri, recoveryFields)) return;

  // Site the carrier by its own filetype — ONE render shore. The VM registry
  // hands back the chosen extension + bytes + any `.meta` sidecar, so a
  // memetic carrier sites `.mem` and a `.tid`/`.json`/`.md` record projects
  // back as its OWN file. The VM decides the type; the projector only sites.
  // A shadowed own record renders off its bag's own fields (`recordFileFn`), never the resolved view that hides it.
  const file = recoveryFields ? await core.recoveryFileFn?.(recoveryFields) ?? null
    : ownRecord ? await core.recordFileFn?.(bagId, tiddlerUri) ?? null
    : await core.carrierFileFn(tiddlerUri);
  if (file === null) return;
  const base = siteBase(core, mirror, file, tiddlerUri);
  if (!base) return;
  const relPath  = base + file.ext;
  const metaBody = file.metaBody;
  const isBinary  = file.encoding === "base64";
  // A POINTER carries no body: its raw bytes come from the local cid/ tier, verified by hash.
  // The whole file lands beside the `.meta`; a miss or a fault lands the `.meta` alone (the
  // content file neither written nor swept — a file the projector did not write is not its own).
  const { pointerBytes, bodyPending, output } = await renderedOutput(core, tiddlerUri, file);
  const writeBytes: string | Buffer = pointerBytes ?? (isBinary ? Buffer.from(output, "base64") : output);

  // The disk ward — sovereign-island write confinement (bag-paths). Cascade
  // output counts as untrusted; refusals surface LOUDLY, never silently.
  const gate = confineMirrorWrite(mirror.mirrorRoot, relPath, mirror.allowBagsRootFiles);
  if (!gate.ok) {
    console.error(`[disk-ward] write refused (${mirror.bagId} <- ${tiddlerUri}): ${gate.reason}`);
    core.onRefusal?.({ bagId: mirror.bagId, uri: tiddlerUri, reason: gate.reason });
    return;
  }
  const candidate = gate.path;

  // Projection-side hash gate (Confluence): bytes already on disk == would-write
  // bytes → skip the write entirely (no event for any watcher, no mtime
  // churn) — but still record the observation in the Synced tree. The gate
  // reads the MAIN body per-file; the Synced-tree OBSERVATION folds the `.meta`
  // in (the echo gate keys on the whole carrier, body + live metadata).
  const outputHash = contentHash(output);                       // body-only, for the per-file skip
  const obsHash    = carrierHash(output, metaBody);             // whole-carrier, for the Synced tree
  const metaPath   = metaBody !== undefined ? candidate + ".meta" : null;
  const metaInSync = metaPath === null || (existsSync(metaPath) && safeReadEquals(metaPath, metaBody!));
  /** The records' render as text a line merge reads: a text carrier with no sidecar alone (`standoffRender`). */
  const renderText = metaPath === null && !bodyPending && typeof writeBytes === "string" ? writeBytes : undefined;

  // ── THE HOMES THIS CARRIER LEFT ─────────────────────────────────────────
  // A siting rule that moved the carrier leaves its files at the earlier path. Two memories name that
  // path: this session's own siting, and the base, which stands at the content file its agreement held
  // and so remembers across a restart. Each earlier home gets READ before anything unlinks or writes.
  const earlier: string[] = [];
  const previous = core.sited.get(sitedKey(bagId, tiddlerUri));
  if (previous !== undefined && previous !== base) {
    const was = confineMirrorWrite(mirror.mirrorRoot, previous, mirror.allowBagsRootFiles);
    if (was.ok) for (const f of carrierDiskFiles(was.path)) earlier.push(contentOf(f));
  }
  earlier.push(...basedHomes(core, mirror, tiddlerUri));
  const left = earlier.filter((home) => home !== candidate);
  if (left.length > 0 && !settleHomes(core, bagId, tiddlerUri, left, bodyPending ? null : obsHash, candidate, `a siting moves ${tiddlerUri}`)) return;
  core.sited.set(sitedKey(bagId, tiddlerUri), base);
  try {
    // The body-skip reads BYTES for a binary file (a utf8 read would mangle the
    // raw bytes and never match), else hashes the utf8 text against the carrier.
    // A pending pointer body never compares — nothing to write, nothing to skip.
    const bodyInSync = !bodyPending && existsSync(candidate) && (isBinary
      ? readFileSync(candidate).equals(writeBytes as Buffer)
      : contentHash(readFileSync(candidate, "utf-8")) === outputHash);
    if (bodyInSync && metaInSync) {
      // Another document's file already says what these records render: its own base stays, and nothing writes.
      if (!otherDocument(core, bagId, core.syncedTree.baseAt(syncedTreeKey(bagId, tiddlerUri), candidate))) pin(core, bagId, tiddlerUri, candidate, obsHash);
      _leaveStandoff(core, bagId, tiddlerUri, undefined, true);
      _leavePending(core, bagId, tiddlerUri);
      if (mirror.mirrorClass !== "recovery") await sweepLeftMirrors(core, bagId, tiddlerUri, candidate, bodyPending ? null : obsHash);
      return;
    }
  } catch { /* unreadable existing file — fall through to the gate */ }
  // A pointer whose bytes the tier lacks, and which declares no sidecar, holds nothing to write.
  if (bodyPending && metaPath === null) return;

  // ── THE CONFLUENCE, PROJECTING LEG ──────────────────────────────────────
  // The byte-skip above answers only the cheap identity (disk bytes == would-write
  // bytes). Everything it did not answer now meets the three-way gate: the records'
  // render, the merge base, and WHAT THE OPERATOR'S HANDS LEFT. The gate decides and
  // never writes; this shore owns every I/O and every alert (projection-gate's law).
  // A POINTER WHOSE BYTES THE TIER LACKS projects its sidecar alone, and that sidecar meets the same gate:
  // the carrier it weighs holds an empty body beside the `.meta`, on both sides. So a hand's edit to that
  // sidecar stands off like any other, and no sidecar gets replaced unread.
  const gateRecords = bodyPending ? carrierHash("", metaBody) : obsHash;
  if (!await projectingLeg(core, { mirror, bagId, tiddlerUri, file, candidate, metaPath, isBinary, bodyPending, gateRecords, obsHash, renderText })) return;

  // ── A SIBLING AT AN EARLIER EXTENSION ───────────────────────────────────
  // A filetype change re-sites the carrier at a new extension (`.md` → `.tid`), and the file at the
  // earlier one would orphan beside the fresh write. It gets READ before this write lands: agreed, it
  // leaves; holding a hand's bytes, it stays, nothing writes, and the carrier stands off.
  const siblings = (mirrorCarrierFilesAt(mirror, base) ?? []).map((f) => contentOf(f)).filter((home) => home !== candidate);
  if (siblings.length > 0 && !settleHomes(core, bagId, tiddlerUri, siblings, bodyPending ? null : obsHash, candidate, `a filetype change moves ${tiddlerUri}`)) return;
  _leaveStandoff(core, bagId, tiddlerUri);

  core.writing.add(tiddlerUri);
  try {
    mkdirSync(dirname(candidate), { recursive: true });
    // Atomic write (§2 law): temp in the SAME dir, fsync, rename, fsync the dir — no watcher or
    // editor ever observes a torn carrier; a crash leaves only a temp file.
    // A pointer whose bytes the tier lacks writes no content file at all.
    //
    // THE ORDER: BODY FIRST, THEN `.meta`. Each lands atomically and durably before the next starts, so a crash
    // between them leaves the fresh body beside the prior sidecar, never a fresh sidecar over a prior body: a
    // `.meta` names the fields of the body it sits beside, and a stale body under fresh fields would read as a carrier
    // nobody wrote. The Synced-tree agreement lands after both, so a crash between them leaves no agreement
    // claiming the pair, and the next reconcile reads the disk against the records afresh.
    if (!bodyPending) core.atomicWrite(candidate, writeBytes);
    if (metaPath !== null) core.atomicWrite(metaPath, metaBody!);
    // THE KĀPAE LOWERED: the carrier writes back, so a shadow standing at its stem leaves with the raise.
    lowerShadowAt(core, bagId, tiddlerUri, candidate.slice(0, candidate.length - extname(candidate).length) + KAPAE_EXT);
    // The observation names the WHOLE carrier; under a pending body it names the sidecar alone.
    pin(core, bagId, tiddlerUri, candidate, gateRecords);
    // A bag counts as projected once a file of it stands: a pending body with no sidecar wrote nothing yet.
    if ((!bodyPending || metaPath !== null) && !core.projectedBags.has(bagId)) {
      core.projectedBags.add(bagId);
      const projected = { bagId, path: mirror.mirrorRoot };
      core.journal?.append("bag-projected", projected);
      core.onBagProjected?.(projected);
    }
    if (core.debugJson && core._tw5) {
      const jsonStr = (core._tw5.$tw.wiki as { getTiddlerAsJson?: (t: string) => string })
        .getTiddlerAsJson?.(tiddlerUri);
      if (jsonStr) {
        // Ride as a `.json` AFTER the full filename (`base.mem.json`), not
        // `base.json` — a bare-stem sibling would be a carrier of stem `base`,
        // and the straggler sweep would delete it every flush. The double
        // extension keeps it OUT of `carrierDiskFiles`' single-segment match.
        const jsonPath = candidate + ".json";
        writeFileSync(jsonPath, jsonStr, "utf-8");
      }
    }
    if (!core._firstFlushDone) {
      core._firstFlushDone = true;
      core.readinessMap?.mark("disk-projector");
    }
  } finally {
    core.writing.delete(tiddlerUri);
  }

  if (mirror.mirrorClass !== "recovery") await sweepLeftMirrors(core, bagId, tiddlerUri, candidate, bodyPending ? null : obsHash);
}

/**
 * Unlink stale files from OTHER mirrors once this flush settled its own mirror, whether it wrote bytes
 * or found them already standing, but ONLY where the carrier has genuinely LEFT that bag (a true MOVE,
 * e.g. promotion wiki-bag → lares-bag, cleaning the scratch file it left). The seed's leaf-bag road LOADs onto
 * a working layer and MOVEs it into canon, whose mirror already holds the bytes: that flush writes nothing
 * and still clears the working mirror's copy here.
 */
export async function sweepLeftMirrors(core: ProjectorCore, bagId: string, tiddlerUri: string, candidate: string, settleHash: string | null): Promise<void> {
  // A carrier that STILL LIVES in a bag — a working edit SHADOWING its canon copy — keeps
  // its file there: `bagsHolding` reports every bag holding it, and a bag on
  // that list never gets its file unlinked. Without the callback, the unlink
  // clears every other mirror by path. One gate, one choke-point: the unlink
  // path routes through the ward like every other mirror touch.
  if (core.bagsHolding) core.measure.holdsSinceChange++;
  const holdingBags = core.bagsHolding ? new Set(await core.bagsHolding(tiddlerUri)) : null;
  for (const otherMirror of core.mirrors) {
    // This flush's own mirror settled its homes above.
    if (otherMirror.bagId === bagId) continue;
    // The carrier still lives in this bag (shadowed, not moved) → keep its file.
    if (holdingBags?.has(otherMirror.bagId)) continue;
    const staleFiles = mirrorCarrierFiles(core, otherMirror, tiddlerUri);
    if (staleFiles === null) continue;
    // Never unlink what THIS flush just wrote. Path identity — not bag
    // identity — marks the live file: the base derives from the URI alone,
    // so the current bag, AND any mirror sharing this mirrorRoot, resolves to
    // the SAME files. The path guard closes the co-rooted self-deletion
    // structurally — no mirror config can trigger it (the `.meta` sidecar
    // rides beside the body under the same guard).
    const homes = staleFiles.map((f) => contentOf(f)).filter((home) => home !== candidate);
    // The carrier left this mirror's bag: each file it left there gets read first. One that says what the
    // records render (or stands where its base left it) leaves; one a hand edited stays and stands off.
    if (settleHomes(core, otherMirror.bagId, tiddlerUri, homes, settleHash, null, `${tiddlerUri} left ${otherMirror.bagId} for ${bagId}`)) {
      core.sited.delete(sitedKey(otherMirror.bagId, tiddlerUri));
      _leaveStandoff(core, otherMirror.bagId, tiddlerUri, "home");
    }
  }
}
