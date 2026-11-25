/**
 * pulama-sign — THE CLOSED SET OF RECORDS THE PŪLAMA'S HAND DOOR SIGNS UNDER A FACE ROOT (`sign`).
 *
 * Under a pūlama the vessel holds no face root, so every ward act that signs as the face refused `needs-the-human` with no door
 * to ask at. The hand door's `sign` act carries them in ONE pattern (terms -> sign -> land), so a new ward act registers a record
 * kind here rather than a new act. CUSTODY:
 *   - the root never signs bytes a frame names: each kind reads its record against its own CLOSED shape (the same checks the
 *     record's reader runs, short of the signature) and signs that kind's own preimage, whose bytes carry its domain tag;
 *   - each kind names the face root's key it expects (and, where the record names it, the face's group), checked BEFORE the route;
 *   - the root opens fresh under the operator's route for that one signature and zeroes (`wardRootSigner`).
 * A kind outside this table refuses `sign-kind-unknown`.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/the-worn-house#/the-pulama
 */
import {
  KAHUA_ACT_DOMAIN, PLUGIN_OFFERING_DOMAIN, kahuaActBodyFault, pluginOfferingCid, readKahuaAct, signKahuaActBody, signPluginOffering, verifyPluginOffering, kahuaActCid,
  type KahuaActBody, type PluginOffering,
} from "@lararium/mesh";
import { offeringTermsOf, type PulamaOfferingTerms } from "./pulama-offering.js";

/** What a kind's check reads beside the record: the face root's public key and the face's group (null where none reads). */
export interface PulamaSignContext { readonly key: string; readonly group: string | null }
export type PulamaRootSigner = { readonly key: string; sign(bytes: Uint8Array): Promise<string> };

/** One record kind the hand signs: its domain tag, its closed shape check, its signing and its reader's verdict. */
export interface PulamaSignKind<T> {
  readonly domain: string;
  /** The record's closed shape against the face, or the refusal's detail. Runs BEFORE the route reads. */
  termsOf(raw: unknown, face: PulamaSignContext): Promise<{ readonly terms: T } | { readonly detail: string; readonly mismatch?: true }>;
  /** The words the route's prompt names, so the person reads what the root will sign. */
  describe(terms: T): string;
  /** Sign the record's own preimage under the root (one signature). */
  sign(terms: T, root: PulamaRootSigner): Promise<{ readonly record: unknown; readonly cid: string }>;
  /** The record's reader, over the signed record: a record the reader would refuse never leaves the door. */
  verify(record: unknown, face: PulamaSignContext): Promise<string | null>;
}

const kahuaAct: PulamaSignKind<KahuaActBody> = {
  domain: KAHUA_ACT_DOMAIN,
  async termsOf(raw, face) {
    const fault = kahuaActBodyFault(raw);
    if (fault) return { detail: `a kahua act reads ${fault}: the root signs a lift, a withdraw or a carry whose shape the stage's reader takes` };
    const body = raw as KahuaActBody;
    if (face.group === null) return { detail: "the face's anchors name no group, so no kahua act signs for it" };
    if (body.group !== face.group) return { detail: `the act names group ${body.group}, and the face reads ${face.group}`, mismatch: true };
    // A LIFT BY HAND names the root as its seat; a lift that answers a proposal names the proposer, as the stage reader checks.
    if (body.act === "lift" && body.proposal === undefined && body.origin.seat.toLowerCase() !== face.key) return { detail: "a lift by hand names the face root as its seat", mismatch: true };
    return { terms: body };
  },
  describe(b) {
    return b.act === "lift" ? `a kahua lift of "${b.title}" (epoch ${b.epoch})` : b.act === "withdraw" ? `a kahua withdraw of ${b.target}` : `a kahua carry of ${b.carries.length} revision(s)`;
  },
  async sign(body, root) {
    const record = await signKahuaActBody(body, root);
    return { record, cid: kahuaActCid(record) };
  },
  async verify(record, face) {
    const read = readKahuaAct(record, { group: face.group ?? "", grant: (k) => k.toLowerCase() === face.key });
    return read.ok ? null : `kahua-act: ${read.refusal}`;
  },
};

const pluginOffering: PulamaSignKind<PulamaOfferingTerms> = {
  domain: PLUGIN_OFFERING_DOMAIN,
  async termsOf(raw, face) {
    const read = await offeringTermsOf(raw);
    if ("reading" in read) return { detail: read.detail };
    if (read.terms.offeror !== face.key) return { detail: `the offering names offeror ${read.terms.offeror}, and the face root reads ${face.key}`, mismatch: true };
    return { terms: read.terms };
  },
  describe: (t) => `the plugin offering ${t.pluginsCid} (${t.blobs.length} blob(s))`,
  async sign(terms, root) {
    const record = await signPluginOffering(terms, (bytes) => root.sign(bytes));
    return { record, cid: pluginOfferingCid(record) };
  },
  async verify(record) {
    const verdict = await verifyPluginOffering(record as PluginOffering);
    return verdict.ok ? null : `${verdict.code}: ${verdict.reason}`;
  },
};

/** THE CLOSED SET. A ward act that signs as the face under a pūlama registers its record kind here, never a new hand act. */
export const PULAMA_SIGN_KINDS: Readonly<Record<string, PulamaSignKind<unknown>>> = Object.freeze({
  "kahua-act": kahuaAct as PulamaSignKind<unknown>,
  "plugin-offering": pluginOffering as PulamaSignKind<unknown>,
});

export function pulamaSignKind(kind: unknown): PulamaSignKind<unknown> | null {
  return typeof kind === "string" && Object.hasOwn(PULAMA_SIGN_KINDS, kind) ? PULAMA_SIGN_KINDS[kind]! : null;
}
