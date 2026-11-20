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

/** The most chunks one resting plane may carry before its read refuses as absent (a persona plane holds a face's few acts). */
export const RESTING_DOC_MAX_CHUNKS = 4096;
/** The most bytes one resting plane may carry before its read refuses as absent, checked before any buffer allocates. */
export const RESTING_DOC_MAX_BYTES = 32 * 1024 * 1024;

/** One read of a document's chunks per store at a time: a silent store holds one read, never a pile of them. */
const restingReads = new WeakMap<object, Map<string, Promise<Chunk[] | null>>>();
function readChunksOnce(storage: Pick<StorageAdapterInterface, "loadRange">, documentId: string): Promise<Chunk[] | null> {
  let reads = restingReads.get(storage);
  if (reads === undefined) { reads = new Map(); restingReads.set(storage, reads); }
  const standing = reads.get(documentId);
  if (standing !== undefined) return standing;
  let read: Promise<Chunk[] | null>;
  try { read = Promise.resolve(storage.loadRange([documentId])).catch(() => null); }
  catch { read = Promise.resolve(null); }   // an adapter that throws on the call answers absence, as one that rejects does
  const held = reads;
  const settled: Promise<Chunk[] | null> = read.finally(() => { if (held.get(documentId) === settled) held.delete(documentId); });
  reads.set(documentId, settled);
  return settled;
}

/**
 * A plane doc as this replica's own STORE rests it, read from the storage adapter's bytes alone and loaded into a scratch
 * document: never a Repo handle, never the network, never a peer. A lit sibling's persona plane rests so (the composition
 * mounts the worn face's plane alone), and its proof reads it here before anything admits it anywhere: a plane that fails
 * its proof never reached the live Repo, since this read never touches one.
 *
 * Pass the vessel's own face-gated store as `storage`: a chunk sealed under a face outside the open set refuses there, and
 * the refusal reads as absent. THE TIMER CLOSES THE WINDOW: the bound's timer callback alone marks the read spent, and the
 * read accepts only while that mark stands clear, checked after the decode and before the answer returns, so an answer that
 * lands once the timer fired reads absent (a late answer populates nothing: nothing loads into any Repo). The store's own
 * read cannot cancel through its interface; one read per document per store stands at a time, so a silent store holds one.
 *
 * ABSENT means undefined, never a partial plane: nothing rests; a refusal; the bound spent; any reported chunk whose bytes did
 * not read (an older snapshot never stands in for a missing incremental); more than `RESTING_DOC_MAX_CHUNKS` chunks or
 * `RESTING_DOC_MAX_BYTES` bytes (checked before allocation); a malformed url; a torn chunk; any throw on the way.
 */
export async function readRestingDoc(
  storage: Pick<StorageAdapterInterface, "loadRange">, url: string, boundMs = DOCUMENT_READY_TIMEOUT_MS,
): Promise<LarDoc | undefined> {
  let documentId: string;
  try { documentId = parseAutomergeUrl(url as AutomergeUrl).documentId; } catch { return undefined; }
  let spent = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<null>((resolve) => { timer = setTimeout(() => { spent = true; resolve(null); }, boundMs); });
  let chunks: Chunk[] | null;
  try { chunks = await Promise.race([readChunksOnce(storage, documentId), late]); }
  finally { clearTimeout(timer); }
  if (chunks === null || spent) return undefined;
  try {
    // The engine's own order (`StorageSubsystem.loadDocData`): snapshots, then incrementals; no other role carries the doc.
    const role = (c: Chunk): number => (c.key[1] === "snapshot" ? 0 : c.key[1] === "incremental" ? 1 : -1);
    const parts = chunks.filter((c) => role(c) >= 0);
    if (parts.length === 0 || parts.length > RESTING_DOC_MAX_CHUNKS) return undefined;
    let total = 0;
    for (const c of parts) {
      if (!(c.data instanceof Uint8Array)) return undefined;   // a reported chunk that did not read: absent, never stale-present
      total += c.data.length;
      if (total > RESTING_DOC_MAX_BYTES) return undefined;
    }
    const ordered = [...parts].sort((a, b) => role(a) - role(b));
    const bytes = new Uint8Array(total);
    let at = 0;
    for (const c of ordered) { bytes.set(c.data!, at); at += c.data!.length; }
    const doc = A.loadIncremental(A.init<LarDoc>(), bytes);
    if (spent || A.getHeads(doc).length === 0) return undefined;
    return doc as LarDoc;
  } catch { return undefined; }
}
