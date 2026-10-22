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

import { parseAutomergeUrl, type AutomergeUrl, type Repo } from "@automerge/automerge-repo";
import type { LarDoc } from "./base-doc.js";
import { tiddlerText } from "./base-doc.js";
import { PERSONA_ACT_DOMAIN } from "./domains.js";
import { makeHandLineage, type HandLineage } from "./hand-lineage.js";
import { verifyingKeyFromDid, type LarDid } from "./lar-did.js";
import type { PersonaKelEvent } from "./persona-kel.js";
import { actCid, signAct, type SignedAct } from "./signed-act.js";
import { storedLarRecord } from "./stored-record.js";
import type { PersonaActBody, PersonaActKind } from "./persona-act.js";

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

/** The root's roster per epoch, from the verified KEL lineage: epoch = KEL seq, signer = the op-key that event seats. */
export function personaLineageFromKel(chain: readonly PersonaKelEvent[]): HandLineage | null {
  const sorted = [...chain].sort((a, b) => a.seq - b.seq);
  if (sorted.length === 0 || sorted[0]!.seq !== 0) return null;
  try {
    return makeHandLineage(sorted.map((e) => ({ epoch: e.seq, signers: [verifyingKeyFromDid(e.opKeyDid as LarDid)], threshold: 1 })));
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

/** A face's genesis log, signed by its root: the founding, one `plane` act per plane, the founder device's admission and its edge. */
export async function signFoundingLog(parts: {
  group: string; personaKelPrefix: string; rootCommitment: string; epoch: number;
  planes: Readonly<Record<string, string>>; deviceKey: string; edgeDigest: string;
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
  await next("admission", { deviceKey: parts.deviceKey });
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
