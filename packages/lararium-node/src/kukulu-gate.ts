/**
 * kukulu-gate — THE GATE a kūkulu passes before the pūlama serves it: a strung lei beside a vouch, its return claimed first.
 *
 * A rebuilt vessel offers two things in its hello: the kūkulu lei the operator's hand strung (with the lei it follows, where
 * it follows one), and the vouch the standing vessel signed over the candidate image it walked. The gate reads both against
 * what the pūlama itself holds and what the host reports, begins the rite in the pūlama's own records (the lei's return,
 * then the guest half of its tessera), and only then answers a session's scope.
 *
 * ── A VESSEL WITH NO OFFER ENTERS BY ITS IMAGE ──────────────────────────────────────────────────
 * A hello that carries neither lei nor vouch reads the admitted set (`pulama-admit`): where the image the host reports
 * stands admitted, the pūlama serves the face that admission names again, spends no lei and rests one re-service row. A
 * restart with no rebuild therefore wakes standing. Any other image refuses `pulama-image-unadmitted`, and the refusal
 * names the two acts that admit one: the hand's `pulama admit`, and the rite (`lares rite kukulu`).
 *
 * AN IMAGE STANDS ADMITTED ONCE ITS KŪKULU LANDS PAR. The scope's `land` rests the host half; where the pair reads par, the
 * image the vouch walked joins the admitted set under the rite's own tessera. A kūkulu that never composed admits nothing.
 *
 * ── WHAT THE GATE READS OF AN OFFER, IN ORDER; EACH MISS REFUSES BY NAME ────────────────────────
 *   `kukulu-unvouched`          the offer carries a lei and no vouch
 *   `kukulu-vouch-<reading>`    the vouch reads no vouch, or another key than the custody root's vouch child signed it
 *   `kukulu-face-absent` · `kukulu-face-locked`   the vouch's group names no face standing open at this pūlama
 *   `kukulu-hand-absent`        the pūlama's own custody names no hand's key for that face, so no lei reads
 *   `kukulu-image-unreported`   the host reported no image digest
 *   `kukulu-image-mismatch`     the vouch walked another image than the one the host raises
 *   the lei family's own readings (`KukuluRitePort.begin`): `swarm-lei-absent` (no lei of this face's hand stands for the
 *   vouch's branch), `swarm-lei-head-mismatch` (a lei that pins a head pins another than the vouch's), `swarm-lei-returned` ·
 *   `swarm-lei-returns-spent`, `swarm-lei-unstrung`, `swarm-lei-narrowed`, `swarm-lei-forked`, `swarm-lei-testimony-red` (the
 *   vouch's walk did not pass; a wide lei narrows), `rite-begun-stands`
 *
 * ── THE RETURN CLAIMS BEFORE ANYTHING SERVES ────────────────────────────────────────────────────
 * The rite begins once every other reading passed: the return lands atomically, then the guest half. A fault after the
 * return burns it and serves nothing: the gate fails closed.
 *
 * ── THE HOST REPORTS THE IMAGE, NEVER THE VESSEL ────────────────────────────────────────────────
 * `image` is an input port: the host shim writes the digest of the image it raises at the pūlama's hand door. The offer
 * carries no image field the gate trusts; the vouch's own digest must equal the host's.
 *
 * ── THE HAND'S KEY COMES OFF THE PŪLAMA'S OWN CUSTODY ───────────────────────────────────────────
 * `hand` reads the key the face's hand strings a lei under (the face's root key, off its roster row) through the pūlama's
 * own holder. The offer names no key the gate trusts.
 *
 * ── THE HOST HALF ───────────────────────────────────────────────────────────────────────────────
 * The scope carries `land`: once the vessel composed over its session it asks the pūlama to rest the tessera's host half,
 * and conferre then reads the pair `par`. A kūkulu that never composed leaves the guest half alone, which reads red.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/the-worn-house#/the-pulama
 */
import { FLOOR_REST_KEY_INFO, GATE_BUNDLE_INFO, KUKULU_VOUCH_DOMAIN, PULAMA_TESSERA_DOMAIN, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, verifyKukuluVouch } from "@lararium/mesh";
import type { CustodyHolder } from "./custody-holder.js";
import { personaGroupDigest } from "./persona-group-file.js";
import type { PulamaAdmissions } from "./pulama-admit.js";
import type { PulamaGate, PulamaScope } from "./pulama-server.js";

/** A signing seat: a verifying key (64 lower hex) and its signature over bytes. */
export interface KukuluSigner { readonly key: string; readonly sign: (bytes: Uint8Array) => Promise<string> }

/** What a kūkulu's rite names: the face's group, the branch, and the head and tree the vouch walked. */
export interface KukuluRiteAt {
  readonly group: string; readonly branch: string; readonly head: string; readonly tree: string;
  /** Whether a key signs as the face's hand. */
  readonly hand: (key: string) => boolean;
  /** The pūlama's own signer: the witness of every record it rests. */
  readonly by: KukuluSigner;
}

/** What the gate asks of the lei family and its tessera, for the one rite `kukulu` (`kukulu-lei-seat`). */
export interface KukuluRitePort {
  /**
   * Begin the rite over what the vessel offered: the offered lei rows land where they verify as the hand's, the vouch stands
   * as the return's testimony (`vouch`: its digest; `verdict`: its walk's), the lei returns once, and the guest half rests.
   * Answers the tessera, or the family's own refusal reading.
   */
  begin(offer: { readonly lei?: unknown; readonly unstrung?: unknown }, at: KukuluRiteAt & { readonly vouch: string; readonly verdict: "pass" | "fail" }):
    Promise<{ readonly ok: true; readonly tessera: string; readonly lei: string; readonly n: number } | { readonly ok: false; readonly refusal: string }>;
  /** Rest the host half of `tessera` at the head the rite began at; answers whether the pair reads par. */
  land(tessera: string, at: KukuluRiteAt): Promise<{ readonly par: boolean }>;
}

/**
 * The cold rows a working vessel reads with nobody at a terminal: `face-proof-key`, the per-Nexus key a face presents at
 * each dial and stewards the Kahu canon under (a boot to composition reads it), and `intent-relay-key`, which signs each
 * entry the intent relay admits for a face that enabled it. A session reads these two and writes neither.
 */
export const KUKULU_COLD_READS: readonly string[] = Object.freeze(["face-proof-key", "intent-relay-key"]);

/** The domains a session's children derive under: the floor's rest key, the gate bundle root, and the vouch key the next
 *  kūkulu's walker signs with. No other child of the custody root crosses to a vessel. */
export const PULAMA_SESSION_DERIVES: readonly string[] = Object.freeze([FLOOR_REST_KEY_INFO, GATE_BUNDLE_INFO, KUKULU_VOUCH_DOMAIN]);

/** The vouch key's verifying half, as a holder that holds its custody root derives it. */
export async function vouchKeyOf(holder: Pick<CustodyHolder, "derive">): Promise<string> {
  const seed = holder.derive(KUKULU_VOUCH_DOMAIN);
  try { return await ed25519VerifyingKeyFromSeed(seed); } finally { seed.fill(0); }
}

/** The vouch signer a standing vessel signs under: the custody root's vouch child, read for one signature and zero-filled. */
export async function vouchSignerOf(holder: Pick<CustodyHolder, "derive">): Promise<KukuluSigner> {
  return {
    key: await vouchKeyOf(holder),
    sign: async (bytes) => { const seed = holder.derive(KUKULU_VOUCH_DOMAIN); try { return await ed25519SignerFromSeed(seed)(bytes); } finally { seed.fill(0); } },
  };
}

/** The key the pūlama witnesses under: every return, receipt and tessera half in its own records carries it. */
export async function pulamaSignerOf(holder: Pick<CustodyHolder, "derive">): Promise<KukuluSigner> {
  const seed = holder.derive(PULAMA_TESSERA_DOMAIN);
  let key: string;
  try { key = await ed25519VerifyingKeyFromSeed(seed); } finally { seed.fill(0); }
  return { key, sign: async (bytes) => { const s = holder.derive(PULAMA_TESSERA_DOMAIN); try { return await ed25519SignerFromSeed(s)(bytes); } finally { s.fill(0); } } };
}

export function kukuluGate(a: {
  /** The pūlama's own holder: the gate reads the face's standing and two derived children off it. */
  readonly holder: CustodyHolder;
  /** The key the hand of the face at `ordinal` strings a lei under, read off the pūlama's own custody; null where it names none. */
  readonly hand: (ordinal: number) => Promise<string | null | undefined>;
  readonly rite: KukuluRitePort;
  /** THE HOST'S REPORT of the image it raises, or null where it reported none. */
  readonly image: () => string | null | Promise<string | null>;
  readonly coldReads?: readonly string[];
  /** The admitted set (`pulama-admit`). Absent, no image stands admitted and every hello needs its offer. */
  readonly admissions?: PulamaAdmissions;
}): PulamaGate {
  const { holder } = a;
  const refuse = (reading: string, why?: string) => ({ ok: false as const, reading, ...(why ? { why } : {}) });
  return {
    async admit(offer) {
      const o = (typeof offer === "object" && offer !== null ? offer : {}) as { lei?: unknown; unstrung?: unknown; vouch?: unknown };
      if (o.vouch === undefined || o.vouch === null) {
        const wearsLei = Array.isArray(o.lei) ? o.lei.length > 0 : o.lei !== undefined && o.lei !== null;
        if (wearsLei) return refuse("kukulu-unvouched", "a kūkulu wears its lei beside a vouch; this hello carries none");
        // NO OFFER: the vessel enters by the image the host reports, where that image stands admitted.
        const reported = await a.image();
        const witness = await pulamaSignerOf(holder);
        const admission = reported !== null && a.admissions ? await a.admissions.admitted(reported, witness) : null;
        if (reported === null || !a.admissions || admission === null) {
          return refuse("pulama-image-unadmitted", "this vessel carries no offer, and the image the host reports stands unadmitted: admit it by hand at the pūlama (`pulama admit`), or raise the vessel by the rite (`lares rite kukulu`)");
        }
        const worn = await holder.faceStanding({ fcid: admission.fcid });
        if (worn === null) return refuse("kukulu-face-absent");
        if (!worn.unlocked) return refuse("kukulu-face-locked", "the face this image stands admitted for rests unopened at this pūlama");
        // THE RE-SERVICE ROW RESTS FIRST: no lei spends, and the count of such wakes reads off the records.
        await a.admissions.reserved(reported, { fcid: worn.fcid, ordinal: worn.ordinal }, witness);
        return { ok: true, scope: { face: { fcid: worn.fcid, ordinal: worn.ordinal }, coldReads: a.coldReads ?? KUKULU_COLD_READS } };
      }
      const vouched = verifyKukuluVouch(o.vouch, await vouchKeyOf(holder));
      if (!vouched.ok) return refuse(`kukulu-vouch-${vouched.refusal}`);
      const { body } = vouched.vouch;
      const face = await holder.faceStanding({ group: personaGroupDigest(body.group) });
      if (face === null) return refuse("kukulu-face-absent");
      if (!face.unlocked) return refuse("kukulu-face-locked", "the face the vouch names rests unopened at this pūlama");
      const handKey = (await a.hand(face.ordinal))?.toLowerCase();
      if (!handKey) return refuse("kukulu-hand-absent", "this pūlama's custody names no hand's key for the face the vouch names");
      const raised = await a.image();
      if (raised === null) return refuse("kukulu-image-unreported", "the host reported no image digest at the pūlama's hand door");
      if (raised !== body.image) return refuse("kukulu-image-mismatch", "the vouch walked another image than the one the host raises");
      const at: KukuluRiteAt = { group: body.group, branch: body.branch, head: body.head, tree: body.tree, hand: (key) => key.toLowerCase() === handKey, by: await pulamaSignerOf(holder) };
      // THE RETURN CLAIMS FIRST: from here a fault burns the return and serves nothing.
      const begun = await a.rite.begin({ lei: o.lei, unstrung: o.unstrung }, { ...at, vouch: vouched.digest, verdict: body.verdict });
      if (!begun.ok) return refuse(begun.refusal);
      const scope: PulamaScope = {
        face: { fcid: face.fcid, ordinal: face.ordinal }, coldReads: a.coldReads ?? KUKULU_COLD_READS,
        land: async () => {
          const landed = await a.rite.land(begun.tessera, at);
          // PAR ADMITS: the kūkulu composed and its halves match, so the image its vouch walked serves again without a lei.
          if (landed.par && a.admissions) await a.admissions.admitByRite(body.image, { fcid: face.fcid, ordinal: face.ordinal }, begun.tessera, at.by);
          return landed;
        },
      };
      return { ok: true, scope };
    },
  };
}
