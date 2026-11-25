/**
 * shore-take-disk — a person takes the DISK's words of one standoff, named by its key.
 *
 * The twin of `take-records`. A standoff says the file and the records say different things and no rule
 * picks; its key folds the bag, the carrier, the path, the two states and the base they stand against.
 * `take-records` hands the answer to the projector, which writes the records' render over the file. This
 * door goes the other way, and the projecting leg carries no disk byte into a record, so it rides the
 * ingest leg, in three steps that each read the state the person read:
 *
 *   1. THE KEY. The island's shore lists the standoff for the named carrier, after a fresh look at the
 *      disk. No standoff, or one under another key, refuses by name and nothing lands.
 *   2. THE FILE. The file at the standoff's path gets read through the scan's own door, and its hash must
 *      equal the disk state the key folded. A file that moved since refuses by name.
 *   2b. THE MERGE. Where the records moved too, their edit must not drown under the file's. The door reads
 *      the base's words from the file's own git history (the face pool's commit whose blob hashes to the base
 *      the key folded, `basePoolText`; the synced tree holds hashes alone, and where a re-found cleared it, the
 *      base the key folded stands at the pool's HEAD) and the render the
 *      island weighed under the key (`render`), and merges the three through the one seal merge
 *      (`shore-merge.ts` over `@lararium/mesh/meme-merge`, the module git's `.mem` driver reads too): a slot only one side moved
 *      takes that side, a slot both moved line-merges alone, and a `.mem` re-seals. A clean merge writes the
 *      file whole (temp, then rename) and the merged words ride the wave; a slot both sides moved into
 *      overlap refuses by name (`slot-conflict`), and nothing writes or lands on either side. A file in no
 *      git history, a pool with no commit holding the base, a sidecar or a binary body lands the file whole,
 *      and the answer says so (`merge`).
 *   3. THE RECORDS. The file rides one INGEST wave whose base names the records the key folded. The gate
 *      lands the disk's words where the records still stand at that state (rule 4), and answers `conflict`
 *      where they moved since: nothing lands, and the standoff that stands keeps its own key.
 *
 * So an answer under a key reaches the one state its giver read, on both sides. The gesture pins the
 * base at the file; the projector's next reconcile finds the disk and the records agreed, and the alert
 * clears. The file's bytes stay as the hand left them.
 *
 * A person's gesture alone: nothing calls this door by itself, and no flag makes a wave take it.
 */

import { statSync } from "node:fs";
import { atomicWriteFileSync, contentHash, poolHeadOf, syncedTreeKey, type GitRun, type SyncedTree } from "@lararium/node";
import { carrierHash, digestsEqual, mediaTypeFromExt, ridesAsPointer } from "@lararium/mesh";
import { basePoolText, mergeStandoffSides } from "./shore-merge.js";
import { carrierCasFlagged, declaredType } from "./cas-stage.js";
import { scanFiles, settleIngest, submitIngest, type ScanRow, type SubmitIngestOpts } from "./ingest-core.js";
import { readShoreList, type ShoreAnswer } from "./shore-core.js";
import type { SubmitResult } from "./verb-result.js";

export interface TakeDiskRequest {
  readonly uri: string;
  readonly key: string;
  /** The bag a person named; absent = whichever mirror holds the standoff under that key. */
  readonly bag?: string;
  /**
   * KEEP THE DISK WHOLE (`lares shore keep-disk`): the file's words land as they stand, with no merge, over the records the
   * key folded, so a slot both sides moved takes the file's words. Absent, the door merges where both sides moved.
   */
  readonly whole?: boolean;
}

export interface TakeDiskDeps {
  /** One shore act to the active wiki's island (`askShore`, bound to the vessel's identity). */
  readonly ask: (shoreArgs: Readonly<Record<string, unknown>>) => Promise<ShoreAnswer>;
  readonly tree: SyncedTree;
  readonly root: string;
  readonly did: string;
  readonly submit?: (o: SubmitIngestOpts) => Promise<SubmitResult>;
  /** The git run the base read takes in the file's pool; absent, `runGit`. */
  readonly git?: GitRun;
}

/**
 * How the file's words met the records': `slots` merged the two edits against the base and wrote the merge; `disk`
 * found the records unmoved past the base, so the file stood as the merge; `whole` landed the file with no merge, and
 * `why` names what the door lacked.
 */
export type TakeDiskMerge =
  | { readonly kind: "slots" | "disk" }
  | { readonly kind: "whole"; readonly why: string };

export type TakeDiskResult =
  | { readonly ok: true; readonly uri: string; readonly bag: string; readonly key: string; readonly path: string; readonly decision: string; readonly merge: TakeDiskMerge; readonly requestId?: string }
  | { readonly ok: false; readonly refusal: string; readonly why: string; readonly requestId?: string };

/** A wiki's instance slot addressed as a bag: its INGEST runs inside that wiki's island. */
const WIKI_SLOT_BAG_RE = /^lar:\/\/\/ha\.ka\.ba\/wikis\/[^/]+\/(temp|draft|working|personal)$/;

const text = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

type Merged =
  | { readonly ok: true; readonly text: string | null; readonly merge: TakeDiskMerge }
  | { readonly ok: false; readonly refusal: string; readonly why: string; readonly requestId?: string };

/**
 * THE THREE SIDES MEET. `text` answers the merged words where they differ from the file's, null where the file
 * stands as the merge already (or lands whole).
 */
async function mergeSides(
  req: { readonly uri: string; readonly key: string; readonly bag: string; readonly path: string; readonly row: ScanRow; readonly named: Record<string, unknown> },
  deps: TakeDiskDeps,
): Promise<Merged> {
  const { uri, key, bag, path, row, named } = req;
  const whole = (why: string): Merged => ({ ok: true, text: null, merge: { kind: "whole", why } });
  if (row.meta !== undefined || row.binary) return whole("the carrier rides a sidecar or a binary body, which no line merge reads");
  const folded = named["base"] as { disk?: unknown } | undefined;
  const foldedDisk = text(folded?.disk);
  if (foldedDisk === null) return whole("no base names a last agreement, so nothing tells which side moved a line");
  // The base the key folded stands in the tree, or, where a re-found cleared the tree, at the pool's HEAD (face-pools A5:
  // the projector read HEAD as the base where none stood).
  const treeBase = deps.tree.baseAt(syncedTreeKey(bag, uri), path);
  const head = treeBase === null ? poolHeadOf(path, deps.git) : null;
  const standing = treeBase?.disk ?? (head !== null ? carrierHash(head.body, head.meta) : null);
  if (standing === null || !digestsEqual(standing, foldedDisk)) {
    return { ok: false, refusal: "standoff-key-moved", why: `the base at ${path} moved since the key was read; \`lares shore\` names the standoff's present key` };
  }
  const pooled = basePoolText(path, foldedDisk, deps.git);
  if (pooled.text === null) return whole(pooled.why);
  const baseText = pooled.text;
  const answer = await deps.ask({ op: "render", uri, key, bag });
  if (!answer.ok) {
    if (answer.refusal === "standoff-render-unheld" || answer.refusal === "shore-op-unknown") return whole(answer.why ?? "the island holds no render of the records' side");
    return { ok: false, refusal: answer.refusal ?? "verb-error", why: answer.why ?? "the island refused", ...(answer.requestId !== undefined ? { requestId: answer.requestId } : {}) };
  }
  const recordsText = typeof answer.output["text"] === "string" ? answer.output["text"] : null;
  const records = text(named["records"]);
  if (recordsText === null || records === null || !digestsEqual(contentHash(recordsText), records)) {
    return { ok: false, refusal: "standoff-key-moved", why: `the records' render for ${uri} moved since the key was read; \`lares shore\` names the standoff's present key` };
  }
  if (digestsEqual(contentHash(recordsText), contentHash(baseText))) return { ok: true, text: null, merge: { kind: "disk" } };
  const merged = mergeStandoffSides({ base: baseText, records: recordsText, disk: row.text, path, ext: row.ext });
  if (!merged.resolved) {
    return {
      ok: false, refusal: "slot-conflict",
      why: `the records and the file both moved ${path} past their last agreement into one place (${merged.why}); nothing writes and nothing lands. Bring the file to the words both should hold and \`lares shore\` names the new key, or take the records' side under this one`,
    };
  }
  return { ok: true, text: merged.text === row.text ? null : merged.text, merge: { kind: "slots" } };
}

export async function takeDisk(req: TakeDiskRequest, deps: TakeDiskDeps): Promise<TakeDiskResult> {
  const { uri, key } = req;
  // 1 — the key, against what stands after a fresh look at the disk, read across every page the list answers.
  const listed = await readShoreList(deps.ask, { uris: [uri], ...(req.bag !== undefined ? { bag: req.bag } : {}) });
  if (!listed.ok) return { ok: false, refusal: listed.refusal ?? "verb-error", why: listed.why ?? "the island refused", ...(listed.requestId !== undefined ? { requestId: listed.requestId } : {}) };
  const stands = listed.standoffs.filter((s) => s["uri"] === uri);
  if (stands.length === 0) return { ok: false, refusal: "no-standoff-stands", why: `no standoff stands for ${uri} at this island's shore` };
  // A key folds the bag and the states, never the island: where two islands list it, the door cannot name
  // which standoff the person read, and takes neither.
  const keyed = stands.filter((s) => s["standoff"] === key);
  if (keyed.length > 1) {
    return { ok: false, refusal: "shore-answer-incomplete", why: `the standoff under key ${key} stands at ${keyed.length} islands over one bag (${String(keyed[0]!["bagId"])}); the door cannot name which one a person read, so it takes neither` };
  }
  const named = keyed[0];
  if (named === undefined) {
    return { ok: false, refusal: "standoff-key-moved", why: `the standoff for ${uri} stands under key ${stands.map((s) => String(s["standoff"])).join(", ")}; the answer names ${key}` };
  }
  const bag = text(named["bagId"]);
  const path = text(named["path"]);
  const records = text(named["records"]);
  const disk = text(named["disk"]);
  if (named["kind"] !== "sides" || bag === null || path === null || records === null || disk === null) {
    return {
      ok: false, refusal: "standoff-holds-no-disk-side",
      why: `the standoff for ${uri} names no one file whose words could land (a file at a path the carrier left, or a file that vanished); \`lares ingest\` the file it names, or take the records' side under the key`,
    };
  }

  // 2 — the file, read through the scan's own door, against the disk state the key folded.
  const scan = scanFiles(deps.root, [path], bag, deps.tree, () => uri);
  const row = scan.rows[0];
  if (row === undefined || row.status === "deleted") return { ok: false, refusal: "standoff-key-moved", why: `no file stands at ${path}; the standoff the key names moved` };
  if (row.status === "non-nfc") return { ok: false, refusal: "disk-refused", why: `the file at ${path} holds text outside NFC; nothing lands` };
  if (row.diskHash !== disk) return { ok: false, refusal: "standoff-key-moved", why: `the file at ${path} moved since the key was read; \`lares shore\` names the standoff's present key` };

  // A POINTER'S BODY HOLDS NO KEY PROOF. The island weighs a pointer at content-address grain: it reads
  // the handle's cid and never the render the key folded, so it cannot prove the records still stand where
  // the person read them. An answer that cannot prove its state takes nothing.
  if (ridesAsPointer(declaredType(row.meta) ?? mediaTypeFromExt(row.ext, row.binary ?? false)) || carrierCasFlagged(row.text, row.meta)) {
    return {
      ok: false, refusal: "pointer-body-holds-no-key-proof",
      why: `${uri} rides a pointer to its bytes, and the island cannot weigh a pointer against the records the key read; nothing lands. \`lares ingest\` of ${path} lands its bytes by name`,
    };
  }

  // 2b — the merge: the records' edit and the file's meet against the base's words (a person who keeps the disk whole asks none).
  const merged: Merged = req.whole === true
    ? { ok: true, text: null, merge: { kind: "whole", why: "the person kept the disk's words whole (`keep-disk`)" } }
    : await mergeSides({ uri, key, bag, path, row, named }, deps);
  if (!merged.ok) return merged;
  let landing: ScanRow = row;
  if (merged.text !== null) {
    // The file moved since it was read: the merge names a state no one read, and nothing writes.
    const again = scanFiles(deps.root, [path], bag, deps.tree, () => uri).rows[0];
    if (again === undefined || again.diskHash !== disk) return { ok: false, refusal: "standoff-key-moved", why: `the file at ${path} moved while the merge ran; \`lares shore\` names the standoff's present key` };
    let mode: number | undefined;
    try { mode = statSync(path).mode & 0o777; } catch { mode = undefined; }
    atomicWriteFileSync(path, merged.text, undefined, mode !== undefined ? { mode } : {});
    const read = scanFiles(deps.root, [path], bag, deps.tree, () => uri).rows[0];
    if (read === undefined || read.status === "deleted" || read.text !== merged.text) return { ok: false, refusal: "standoff-key-moved", why: `the file at ${path} moved as the merge landed; \`lares shore\` names the standoff's present key` };
    landing = read;
  }

  // 3 — the records, as the person read them: the wave's base names that state, on both sides.
  const { syncedRecordsHash: _side, ...rest } = landing;
  const candidate: ScanRow = { ...rest, status: "changed", syncedHash: records };
  const settled = await settleIngest(
    // A wiki's instance slot ingests inside the active wiki's island; the daemon island's own working layer
    // ingests daemon-side, in the island that listed its standoff.
    { source: path, toBag: bag, candidates: [candidate], did: deps.did, ...(WIKI_SLOT_BAG_RE.test(bag) && named["island"] !== "daemon" ? { inWiki: true } : {}) },
    deps.tree, deps.submit ?? submitIngest,
  );
  const requestId = settled.first.requestId;
  if (settled.first.status === "error") return { ok: false, refusal: "verb-error", why: settled.first.errorMessage ?? "the daemon refused and named no reason", requestId };
  if (settled.conflicts.length > 0) {
    // A PACK FILE SETTLES MEMBER BY MEMBER, each against its own base: the wave's one base names no
    // member. Members whose records stood unmoved landed; the rest stand off. The answer says exactly that.
    const row = settled.named.get(uri);
    if (row !== undefined && typeof row["pack"] === "string") {
      const members = Array.isArray(row["members"]) ? (row["members"] as Array<Record<string, unknown>>) : [];
      const held = members.filter((m) => m["decision"] === "conflict").map((m) => String(m["title"]));
      return { ok: false, refusal: "pack-members-stand-off", why: `${path} holds a pack, which settles member by member: ${Number(row["landed"] ?? 0)} member(s) landed, and ${held.length} stand in a conflict (${held.join(", ")})`, requestId };
    }
    return { ok: false, refusal: "standoff-key-moved", why: `the records moved since the key was read, so nothing landed; \`lares shore\` names the standoff's present key`, requestId };
  }
  if (settled.refused.length > 0) return { ok: false, refusal: "disk-refused", why: settled.refused[0]!.why, requestId };
  if (!settled.landed.has(uri)) return { ok: false, refusal: "verb-error", why: `the island answered the wave without a row for ${uri}`, requestId };
  return { ok: true, uri, bag, key, path, decision: String(settled.named.get(uri)?.["decision"] ?? "ingest"), merge: merged.merge, requestId };
}
