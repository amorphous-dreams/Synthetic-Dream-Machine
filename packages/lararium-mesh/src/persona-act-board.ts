/**
 * persona-act-board — where a face's signed `@persona` acts rest in the plane doc, and the lineage their signer reads under.
 *
 * Each act rides ONE tiddler keyed by group, seq and cid, so two acts at one seq both survive a merge and the
 * reader (`projectPersonaLog`) names the fork. The extractor is permissive (a torn or foreign tiddler is skipped);
 * trust rides the fold. The lineage of the face's root is its persona KEL: one roster per KEL seq, the op-key that
 * event seats, so a root that rotated beneath its prefix verifies old acts under old keys and new under new.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/research/identity-invariants-2026
 */

import * as A from "@automerge/automerge";
import { parseAutomergeUrl, type AutomergeUrl, type Chunk, type Repo, type StorageAdapterInterface } from "@automerge/automerge-repo";
import type { LarDoc } from "./base-doc.js";
import { tiddlerText } from "./base-doc.js";
import { PERSONA_ACT_DOMAIN } from "./domains.js";
import { makeHandLineage, type HandLineage } from "./hand-lineage.js";
import { verifyingKeyFromDid, type LarDid } from "./lar-did.js";
import { DOCUMENT_READY_TIMEOUT_MS } from "./find-or-throw.js";
import { foldPersonaContests, type PersonaKelEvent } from "./persona-kel.js";
import { actCid, signAct, type SignedAct } from "./signed-act.js";
import { storedLarRecord } from "./stored-record.js";
import type { PersonaActBody, PersonaActKind } from "./persona-act.js";
import type { VesselFaceTagFields } from "./vessel-face-tag.js";

export const PERSONA_ACT_ENTRY_PREFIX = "lar:///ha.ka.ba/dreamnet/persona-act/" as const;

export function personaActEntryKey(group: string, seq: number, cid: string): string {
  return `${PERSONA_ACT_ENTRY_PREFIX}${encodeURIComponent(group)}/${seq}/${cid}`;
}

/** Land an act on a plane draft. Call INSIDE a `handle.change()` callback. */
export function writePersonaAct(draft: LarDoc, act: SignedAct): void {
  const key = personaActEntryKey(act.body.group, act.body.seq, actCid(act.body));
  draft.tiddlers[key] = storedLarRecord(key, { text: JSON.stringify(act) }, actCid(act.body));
}

/** Every carried record under the group's act prefix, parsed and unjudged. */
export function personaActRecordsOfGroup(doc: LarDoc | undefined | null, group: string): unknown[] {
  const prefix = `${PERSONA_ACT_ENTRY_PREFIX}${encodeURIComponent(group)}/`;
  const out: unknown[] = [];
  for (const [title, record] of Object.entries(doc?.tiddlers ?? {})) {
    if (!title.startsWith(prefix)) continue;
    const text = tiddlerText(record);
    if (text === null) continue;
    try { out.push(JSON.parse(text)); } catch { /* torn: skipped */ }
  }
  return out;
}

/**
 * The root's roster per epoch, from the VERIFIED KEL lineage: epoch = KEL seq, signer = the op-key that event seats. The chain a
 * caller hands may carry the heap beside the lineage (a node ring transports events the reader set aside), so the lineage reads
 * through the one KEL reader (`foldPersonaContests`): an event that does not verify seats no key, a fork stops the lineage (no
 * lineage, fail-closed), and a trailing provisional rotation confers nothing until hardened.
 */
export function personaLineageFromKel(chain: readonly PersonaKelEvent[]): HandLineage | null {
  const fold = foldPersonaContests(chain);
  if (fold.fork) return null;
  const verified = [...fold.kel];
  while (verified.length > 0 && verified[verified.length - 1]!.provisional) verified.pop();
  if (verified.length === 0 || verified[0]!.seq !== 0) return null;
  try {
    return makeHandLineage(verified.map((e) => ({ epoch: e.seq, signers: [verifyingKeyFromDid(e.opKeyDid as LarDid)], threshold: 1 })));
  } catch { return null; }
}

type Signer = { readonly key: string; readonly sign: (bytes: Uint8Array) => Promise<string> };

/** The next act in a log, linked to the head. `fields` ride in the signed body. */
export function signPersonaAct(
  head: { readonly seq: number; readonly cid: string } | null,
  parts: { group: string; act: PersonaActKind; epoch: number; fields?: Record<string, unknown> },
  signer: Signer,
): Promise<SignedAct<PersonaActBody>> {
  return signAct<PersonaActBody>({
    ...(parts.fields ?? {}),
    kind: PERSONA_ACT_DOMAIN, group: parts.group, seq: head ? head.seq + 1 : 0, prior: head ? head.cid : null,
    act: parts.act, epoch: parts.epoch,
  } as PersonaActBody, signer);
}

/** A face's genesis log, signed by its root: the founding, one `plane` act per plane, the founder device's admission under
 *  its vessel's blinded tag and the device's per-face ward key (`vesselTag`, the founder vessel's door's answer for this group and
 *  device), and its edge. */
export async function signFoundingLog(parts: {
  group: string; personaKelPrefix: string; rootCommitment: string; epoch: number;
  planes: Readonly<Record<string, string>>; deviceKey: string; edgeDigest: string; vesselTag: VesselFaceTagFields;
}, signer: Signer): Promise<SignedAct<PersonaActBody>[]> {
  const out: SignedAct<PersonaActBody>[] = [];
  let head: { seq: number; cid: string } | null = null;
  const next = async (act: PersonaActKind, fields: Record<string, unknown>): Promise<void> => {
    const a = await signPersonaAct(head, { group: parts.group, act, epoch: parts.epoch, fields }, signer);
    out.push(a);
    head = { seq: a.body.seq, cid: actCid(a.body) };
  };
  await next("founding", { personaKelPrefix: parts.personaKelPrefix, rootCommitment: parts.rootCommitment });
  for (const name of Object.keys(parts.planes).sort()) await next("plane", { plane: name, url: parts.planes[name] });
  await next("admission", { deviceKey: parts.deviceKey, vesselTag: parts.vesselTag.vesselTag, vesselSig: parts.vesselTag.vesselSig, wardKey: parts.vesselTag.wardKey, wardPop: parts.vesselTag.wardPop });
  await next("device-edge", { deviceKey: parts.deviceKey, edgeDigest: parts.edgeDigest });
  return out;
}

/**
 * A plane doc this replica already holds, or undefined: a boot never waits on a doc a peer has yet to send. The carried
 * records reach a joinee in its admit bundle (its daemon doc), so a plane still unsynced proves from the bundle alone,
 * and the plane's later acts join the fold on the boot after they arrive.
 */
export function heldDocOf(repo: Repo, url: string): LarDoc | undefined {
  const handle = repo.handles[parseAutomergeUrl(url as AutomergeUrl).documentId];
  return handle?.isReady() ? (handle.doc() as LarDoc | undefined) : undefined;
}

/** The most chunks one resting plane may carry before its read refuses `over-cap` (a persona plane holds a face's few acts). */
export const RESTING_DOC_MAX_CHUNKS = 4096;
/** The most bytes one resting plane may carry before its read refuses `over-cap`, checked before the concatenation allocates. */
export const RESTING_DOC_MAX_BYTES = 32 * 1024 * 1024;

/** Why a resting read answered no document. Each reads as its own name, so a caller can tell `over-cap` from nothing at rest. */
export type RestingAbsence =
  | "url-malformed" | "bound-spent" | "refused" | "nothing-rests" | "chunk-unread" | "chunk-empty" | "over-cap" | "torn";
export type RestingRead = { readonly doc: LarDoc } | { readonly absent: RestingAbsence };

/** One adapter read waiting, and the callers listening for it; a caller whose bound spends leaves the set. */
interface PendingRead { readonly listeners: Set<(chunks: Chunk[] | null) => void> }
/** The adapter reads still waiting on each store, by document and scope (the caller's custody opening). */
const pendingReads = new WeakMap<object, Map<string, PendingRead>>();

/** Join the key's waiting read, or start one: one adapter call per key serves every caller listening while it waits. */
function joinRead(storage: Pick<StorageAdapterInterface, "loadRange">, documentId: string, key: string): { readonly pending: PendingRead; readonly reads: Map<string, PendingRead> } {
  let reads = pendingReads.get(storage);
  if (reads === undefined) { reads = new Map(); pendingReads.set(storage, reads); }
  const standing = reads.get(key);
  if (standing !== undefined) return { pending: standing, reads };
  const pending: PendingRead = { listeners: new Set() };
  reads.set(key, pending);
  let read: Promise<Chunk[] | null>;
  try { read = Promise.resolve(storage.loadRange([documentId])).catch(() => null); }
  catch { read = Promise.resolve(null); }   // an adapter that throws on the call refuses, as one that rejects does
  const held = reads;
  void read.then((chunks) => {
    if (held.get(key) === pending) held.delete(key);
    // Only the callers still listening hear it: one whose bound spent left the set, and a read the key let go reaches none.
    for (const listener of [...pending.listeners]) listener(chunks);
    pending.listeners.clear();
  });
  return { pending, reads };
}

/**
 * A plane doc as this replica's own STORE rests it, read from the storage adapter's bytes alone and loaded into a scratch
 * document: never a Repo handle, never the network, never a peer. A lit sibling's persona plane rests so (the composition
 * mounts the worn face's plane alone), and its proof reads it here before anything admits it anywhere: a plane that fails
 * its proof never reached the live Repo, since this read never touches one. Pass the vessel's own face-gated store as
 * `storage`: a chunk sealed under a face outside the open set refuses there (`refused`).
 *
 * THE BOUND IS THE EVENT LOOP'S TIMER ORDER, NEVER WALL TIME (house law reads no clock here). Each caller's own timer callback
 * alone marks THAT caller's read spent and takes it off the read's listeners; the caller ACCEPTS at its one continuation
 * after the answer, where it checks its own mark, and an answer that reaches that continuation after its timer callback ran
 * reads `bound-spent`. A timer the loop delivers late moves the bound with it: the contract orders callbacks, it measures no
 * elapsed time. The decode runs synchronously after acceptance, no callback can interleave it, and the byte cap bounds it;
 * the timer stays armed until the decode ends.
 *
 * ONE ADAPTER READ PER KEY, EACH CALLER ITS OWN BOUND: callers of one document and one `scope` (the custody opening) share the
 * key's one waiting adapter read, each listening under its own timer, its own spent mark and its own acceptance, so contention
 * never downgrades a read that lands in a caller's budget. A different opening never joins. Once every listener's bound has
 * spent, the key lets the read go and the next caller starts a fresh one; the stale read, when it lands, reaches no caller.
 * The adapter's read cannot cancel through its interface.
 *
 * ABSENT NEVER MEANS PARTIAL: a reported chunk that did not read (`chunk-unread`) or carries no bytes (`chunk-empty`) refuses
 * the whole plane, so an older snapshot never stands in for a missing incremental; a change whose parent no chunk carries
 * leaves a dependency unresolved and refuses `torn`, even with every reported chunk read, and so does a chunk that does not
 * decode whole (a truncated trailing incremental never leaves the snapshot before it reading complete); more than `RESTING_DOC_MAX_CHUNKS` chunks or
 * `RESTING_DOC_MAX_BYTES` bytes refuses `over-cap` before the concatenation allocates (the adapter has already loaded those
 * chunks by then: its interface lists no sizes before it loads them, so the cap bounds the decode, not the adapter's own load).
 */
export async function readRestingDoc(
  storage: Pick<StorageAdapterInterface, "loadRange">, url: string, opts: { readonly boundMs?: number; readonly scope?: string } = {},
): Promise<RestingRead> {
  let documentId: string;
  try { documentId = parseAutomergeUrl(url as AutomergeUrl).documentId; } catch { return { absent: "url-malformed" }; }
  const key = `${documentId}\u0000${opts.scope ?? ""}`;
  const { pending, reads } = joinRead(storage, documentId, key);
  let spent = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const chunks = await new Promise<Chunk[] | null>((resolve) => {
      const listener = (answer: Chunk[] | null): void => resolve(answer);
      pending.listeners.add(listener);
      timer = setTimeout(() => {
        spent = true;
        pending.listeners.delete(listener);
        // The last listener's bound spent: the key lets this read go, so the next caller starts a fresh one.
        if (pending.listeners.size === 0 && reads.get(key) === pending) reads.delete(key);
        resolve(null);
      }, opts.boundMs ?? DOCUMENT_READY_TIMEOUT_MS);
    });
    // ACCEPTANCE: this continuation, and only while this caller's timer callback has not run.
    if (spent) return { absent: "bound-spent" };
    if (chunks === null) return { absent: "refused" };
    // The engine's own order (`StorageSubsystem.loadDocData`): snapshots, then incrementals; no other role carries the doc.
    const role = (c: Chunk): number => (c.key[1] === "snapshot" ? 0 : c.key[1] === "incremental" ? 1 : -1);
    const parts = chunks.filter((c) => role(c) >= 0);
    if (parts.length === 0) return { absent: "nothing-rests" };
    if (parts.length > RESTING_DOC_MAX_CHUNKS) return { absent: "over-cap" };
    let total = 0;
    for (const c of parts) {
      if (!(c.data instanceof Uint8Array)) return { absent: "chunk-unread" };
      if (c.data.length === 0) return { absent: "chunk-empty" };
      total += c.data.length;
      if (total > RESTING_DOC_MAX_BYTES) return { absent: "over-cap" };
    }
    try {
      const ordered = [...parts].sort((a, b) => role(a) - role(b));
      const bytes = new Uint8Array(total);
      let at = 0;
      for (const c of ordered) { bytes.set(c.data!, at); at += c.data!.length; }
      // EVERY CHUNK DECODES WHOLE: the engine's strict load refuses a chunk that ends short (`not enough data`), where an
      // incremental load keeps the prefix it could parse and drops a truncated trailing chunk silently.
      const doc = A.load<LarDoc>(bytes);
      // A CHANGE WHOSE PARENT NEVER READ QUEUES, IT DOES NOT APPLY: the engine keeps the heads it could reach and holds the rest
      // aside, so a snapshot beside a later incremental whose parent chunk is missing would read as the snapshot alone. Any
      // dependency left unresolved refuses the whole plane, never a stale prefix standing in for it.
      if (A.getMissingDeps(doc, []).length > 0) return { absent: "torn" };
      return A.getHeads(doc).length > 0 ? { doc: doc as LarDoc } : { absent: "torn" };
    } catch { return { absent: "torn" }; }
  } finally { clearTimeout(timer); }
}
