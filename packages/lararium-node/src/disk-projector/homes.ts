/**
 * THE ONE JUDGE EVERY UNLINK ASKS (`judgeHome`), the unlink it admits (`unlinkHome`), and the settle of every home a
 * carrier left (`settleHomes`): an agreed home leaves; a home holding a hand's bytes goes to capture first.
 * Heleuma ha: see lararium/mesh/disk-projector-homes.
 */

import { unlinkSync, existsSync, readFileSync } from "fs";
import { extname } from "path";
import { digestsEqual } from "@lararium/mesh/agile-digest";
import { carrierHash } from "@lararium/mesh/crypto";
import { MEME_EXT } from "@lararium/mesh/mirror-paths";
import { syncedTreeKey } from "../synced-tree.js";
import type { ProjectorCore } from "./core.js";
import { otherDocument, pastRecords } from "./bases.js";
import { captureMoved } from "./capture.js";

/**
 * THE ONE JUDGE EVERY UNLINK ASKS. Reads the carrier standing at `contentPath` (body plus its `.meta`
 * where one sits beside it) and answers whether the projector may remove it:
 *
 *   absent   no content file stands there (a sidecar may, alone and unproven: it stays);
 *   agreed   its bytes equal the disk side of the base standing AT THAT PATH, or say what the records
 *            render: byte for byte, or through the family's congruence. Nothing a hand added rests there;
 *   held     anything else, with the hash of what stands. The file stays. `behind` marks a file whose base agrees
 *            with it while the records fell behind that base (`pastRecords`): the file holds the newer words.
 *   another  the base standing AT THAT PATH names another document: the file mirrors that document's records,
 *            so it stays, and this document's pass says nothing of it.
 *
 * `recordsHash` names the render the records carry, or null where the records hold no such carrier:
 * then the base alone can vouch.
 */
export function judgeHome(core: ProjectorCore, bagId: string, uri: string, contentPath: string, recordsHash: string | null): "absent" | "agreed" | "another" | { readonly held: string; readonly behind?: true } {
  if (otherDocument(core, bagId, core.syncedTree.baseAt(syncedTreeKey(bagId, uri), contentPath))) return "another";
  let body: string, meta: string | undefined, binary: boolean;
  try {
    if (!existsSync(contentPath)) {
      // A SIDECAR ALONE. Where the base (or the records, under a pending pointer) names exactly that state,
      // the empty body beside these very sidecar bytes, the projector wrote it and may take it back.
      const sidecar = `${contentPath}.meta`;
      if (existsSync(sidecar)) {
        const lone = carrierHash("", readFileSync(sidecar, "utf-8"));
        const stood = core.syncedTree.baseAt(syncedTreeKey(bagId, uri), contentPath);
        if ((stood !== null && digestsEqual(lone, stood.disk)) || (recordsHash !== null && digestsEqual(lone, recordsHash))) return "agreed";
      }
      return "absent";
    }
    const bytes = readFileSync(contentPath);
    const text = bytes.toString("utf8");
    binary = !Buffer.from(text, "utf8").equals(bytes);
    body = binary ? bytes.toString("base64") : text;
    meta = existsSync(`${contentPath}.meta`) ? readFileSync(`${contentPath}.meta`, "utf-8") : undefined;
  } catch { return { held: "unreadable" }; }
  const hash = carrierHash(body, meta);
  const base = core.syncedTree.baseAt(syncedTreeKey(bagId, uri), contentPath);
  // A base past the records vouches for no unlink: the document lost the write this file still carries.
  const behind = pastRecords(core, bagId, base);
  if (base !== null && digestsEqual(hash, base.disk) && !behind) return "agreed";
  if (recordsHash !== null) {
    if (digestsEqual(hash, recordsHash)) return "agreed";
    const ext = extname(contentPath);
    let canonical: string | null = null;
    if (ext === MEME_EXT) {
      const text = core.canonicalizeFn ? core.canonicalizeFn(uri, body) : null;
      canonical = text === null ? null : carrierHash(text, meta);
    } else if (!binary && core.canonicalizeNativeFn) {
      const view = core.canonicalizeNativeFn(uri, ext, body, meta);
      canonical = view === null ? null : carrierHash(view.body, view.metaBody);
    }
    if (canonical !== null && digestsEqual(canonical, recordsHash)) return "agreed";
  }
  return behind && base !== null && digestsEqual(hash, base.disk) ? { held: hash, behind: true } : { held: hash };
}

/** Remove one carrier home the judge agreed to: the content file and its sidecar; the base that stood there leaves with it. */
export function unlinkHome(core: ProjectorCore, bagId: string, uri: string, contentPath: string): void {
  core.writing.add(uri);
  try {
    for (const f of [contentPath, `${contentPath}.meta`]) {
      try { if (existsSync(f)) unlinkSync(f); } catch { /* best-effort — a hand can clean up */ }
    }
  } finally { core.writing.delete(uri); }
  const key = syncedTreeKey(bagId, uri);
  core.syncedTree.deleteAt(key, contentPath);
}

/**
 * SETTLE THE HOMES A CARRIER LEFT, reading each before anything unlinks. Agreed homes leave. A home holding bytes no
 * agreement covers goes to the capture door (`captureMoved`): once the house holds its words the base moves to them and
 * the carrier marks for one more reading, whose judge then reads the home agreed and unlinks it. Until then nothing
 * unlinks and nothing writes, and this answers false. A sidecar standing with no body beside it stays: its bytes alone
 * match no base, so nothing can prove it holds no hand's edit. `toward` names the path the carrier would take (for the log).
 */
export async function settleHomes(core: ProjectorCore, bagId: string, uri: string, homes: readonly string[], recordsHash: string | null, toward: string | null, why: string): Promise<boolean> {
  const agreed: string[] = [];
  let held = false;
  for (const home of [...new Set(homes)].sort()) {
    const verdict = judgeHome(core, bagId, uri, home, recordsHash);
    if (verdict === "agreed") { agreed.push(home); continue; }
    if (verdict === "absent" || verdict === "another") continue;   // nothing stands, or another document's file: it stays
    held = true;
    if (verdict.held === "unreadable") { console.error(`[capture] ${bagId} <- ${uri}: ${why}; the file at ${home} reads no bytes, so it stays${toward !== null ? ` and nothing writes at ${toward}` : ""}`); continue; }
    const base = core.syncedTree.baseAt(syncedTreeKey(bagId, uri), home);
    await captureMoved(core, {
      bagId, uri, path: home, disk: verdict.held, records: recordsHash,
      base: base !== null ? { disk: base.disk, records: base.records } : null,
      ...(verdict.behind ? { behind: true as const } : {}),
    });
  }
  for (const home of agreed) unlinkHome(core, bagId, uri, home);
  return !held;
}
