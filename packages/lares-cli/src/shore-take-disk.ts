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

import type { SyncedTree } from "@lararium/node";
import { mediaTypeFromExt, ridesAsPointer } from "@lararium/mesh";
import { carrierCasFlagged, declaredType } from "./cas-stage.js";
import { scanFiles, settleIngest, submitIngest, type ScanRow, type SubmitIngestOpts } from "./ingest-core.js";
import { readShoreList, type ShoreAnswer } from "./shore-core.js";
import type { SubmitResult } from "./verb-result.js";

export interface TakeDiskRequest {
  readonly uri: string;
  readonly key: string;
  /** The bag a person named; absent = whichever mirror holds the standoff under that key. */
  readonly bag?: string;
}

export interface TakeDiskDeps {
  /** One shore act to the active wiki's island (`askShore`, bound to the vessel's identity). */
  readonly ask: (shoreArgs: Readonly<Record<string, unknown>>) => Promise<ShoreAnswer>;
  readonly tree: SyncedTree;
  readonly root: string;
  readonly did: string;
  readonly submit?: (o: SubmitIngestOpts) => Promise<SubmitResult>;
}

export type TakeDiskResult =
  | { readonly ok: true; readonly uri: string; readonly bag: string; readonly key: string; readonly path: string; readonly decision: string; readonly requestId?: string }
  | { readonly ok: false; readonly refusal: string; readonly why: string; readonly requestId?: string };

/** A wiki's instance slot addressed as a bag: its INGEST runs inside that wiki's island. */
const WIKI_SLOT_BAG_RE = /^lar:\/\/\/ha\.ka\.ba\/wikis\/[^/]+\/(temp|draft|working|personal)$/;

const text = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

export async function takeDisk(req: TakeDiskRequest, deps: TakeDiskDeps): Promise<TakeDiskResult> {
  const { uri, key } = req;
  // 1 — the key, against what stands after a fresh look at the disk, read across every page the list answers.
  const listed = await readShoreList(deps.ask, { uris: [uri], ...(req.bag !== undefined ? { bag: req.bag } : {}) });
  if (!listed.ok) return { ok: false, refusal: listed.refusal ?? "verb-error", why: listed.why ?? "the island refused", ...(listed.requestId !== undefined ? { requestId: listed.requestId } : {}) };
  const stands = listed.standoffs.filter((s) => s["uri"] === uri);
  if (stands.length === 0) return { ok: false, refusal: "no-standoff-stands", why: `no standoff stands for ${uri} at this island's shore` };
  const named = stands.find((s) => s["standoff"] === key);
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

  // 3 — the records, as the person read them: the wave's base names that state, on both sides.
  const { syncedRecordsHash: _side, ...rest } = row;
  const candidate: ScanRow = { ...rest, status: "changed", syncedHash: records };
  const settled = await settleIngest(
    { source: path, toBag: bag, candidates: [candidate], did: deps.did, ...(WIKI_SLOT_BAG_RE.test(bag) ? { inWiki: true } : {}) },
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
  return { ok: true, uri, bag, key, path, decision: String(settled.named.get(uri)?.["decision"] ?? "ingest"), requestId };
}
