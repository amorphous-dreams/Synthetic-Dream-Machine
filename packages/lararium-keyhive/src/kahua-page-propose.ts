/**
 * kahua-page-propose — the page's hand toward a lift: this device's atom signs ONE `kahua-lift` proposal batch over the
 * drafts its daemon top holds and writes it on the face's intents plane. Digests ride; bodies never leave the device.
 *
 * The daemon never syncs; the proposal reaches the operator's hand through the face's intents plane, pinned to the
 * proposing atom, and the operator's CLI binds the body by digest (`lares kahua lift --proposal <id> --file <body>`).
 * A proposal grants nothing: the lift still reads the lōkahi cap and the operator's grant.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { KAHUA_BAG, buildKahuaProposal, intentEntryCid, intentId, kahuaBodyDigest, writeIntentEntry } from "@lararium/mesh";
import type { CompositeStore, DocHandle, IntentSigner, IntentVerbRegistry, KahuaProposal, LarDoc } from "@lararium/mesh";

export class KahuaProposeRefused extends Error { override name = "KahuaProposeRefused"; }

export interface PageProposeInput {
  readonly group: string;
  readonly atom: IntentSigner;
  /** The face's intents plane as this island holds it; null where no plane resolved. */
  readonly plane: DocHandle<LarDoc> | null;
  /** The daemon wiki's composition: each title's draft reads off the layer above `bags/kahua`. */
  readonly composite: Pick<CompositeStore, "resolveLayered">;
  readonly titles: readonly string[];
  readonly taint?: readonly string[];
  readonly session: string;
  readonly nonce: string;
  readonly verbs: IntentVerbRegistry;
}

export async function proposeDraftsToKahua(input: PageProposeInput): Promise<{ readonly id: string; readonly cid: string; readonly proposals: readonly KahuaProposal[] }> {
  if (!input.plane) throw new KahuaProposeRefused("kahua-proposal-no-plane: this island holds no intents plane for the face; propose from a device whose face stands");
  if (input.titles.length === 0) throw new KahuaProposeRefused("kahua-proposal-no-draft: name the drafts to propose");
  const proposals: KahuaProposal[] = [];
  for (const title of input.titles) {
    // A draft stands where the topmost live record sits above the stage: the stage's own record proposes nothing.
    const top = await input.composite.resolveLayered(title);
    if (!top || top.record.meta?.deleted || top.bagId === KAHUA_BAG) throw new KahuaProposeRefused(`kahua-proposal-no-draft: ${title}`);
    const digest = kahuaBodyDigest(String(top.record.tiddler.text ?? ""));
    proposals.push({ title, revision: digest, digest, taint: [...(input.taint ?? [])] });
  }
  let entry;
  try {
    entry = await buildKahuaProposal({ group: input.group, signer: input.atom, session: input.session, nonce: input.nonce, proposals, verbs: input.verbs });
  } catch (e) { throw new KahuaProposeRefused(e instanceof Error ? e.message : String(e)); }
  input.plane.change((d) => writeIntentEntry(d, entry));
  return { id: intentId(entry.body as unknown as { issuer: string; verb: string; args: unknown; nonce: string }), cid: intentEntryCid(entry), proposals };
}

/** The titles a page names: an array of strings, or one TW5 title list (`[[Two Words]] One`). */
export function pageTitleList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((t): t is string => typeof t === "string" && t.length > 0);
  if (typeof raw !== "string") return [];
  const out: string[] = [];
  for (const m of raw.matchAll(/\[\[([^\]]+)\]\]|(\S+)/g)) out.push((m[1] ?? m[2])!);
  return out;
}
