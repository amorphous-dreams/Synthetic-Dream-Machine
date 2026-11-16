/**
 * kukulu-gate — THE GATE a kūkulu passes before the pūlama serves it: a lei bound to a vouch, its return claimed first.
 *
 * A rebuilt vessel offers two records in its hello: the kūkulu lei the operator's hand strung, and the vouch the standing
 * vessel signed over the candidate image it walked. The gate reads both against what the pūlama itself holds and what the
 * host reports, claims the lei's return, writes the pūlama's tessera half, and only then answers a session's scope.
 *
 * ── WHAT THE GATE READS, IN ORDER; EACH MISS REFUSES BY NAME ────────────────────────────────────
 *   `kukulu-unvouched`          the offer carries no vouch
 *   `kukulu-vouch-<reading>`    the vouch reads no vouch, or another key than the custody root's vouch child signed it
 *   `kukulu-walk-red`           the vouch's walk did not pass
 *   `kukulu-face-absent` · `kukulu-face-locked`   the vouch's group names no face standing open at this pūlama
 *   `kukulu-ward-key-absent`    that face's ward holds no key row, so no hand's signature reads
 *   `kukulu-lei-<reading>`      the lei reads no standing kūkulu lei of that face's hand (`KukuluLeiPort.readLei`)
 *   `kukulu-lei-unbound`        the lei names another vouch's digest, another group or another branch than the vouch carries
 *   `kukulu-image-unreported`   the host reported no image digest
 *   `kukulu-image-mismatch`     the vouch walked another image than the one the host raises
 *   `kukulu-lei-returned`       the lei's return was already claimed
 *   `kukulu-tessera-unwritten`  the pūlama's tessera half did not land; the return stays claimed and nothing serves
 *
 * ── THE RETURN CLAIMS BEFORE ANYTHING SERVES ────────────────────────────────────────────────────
 * The claim lands once, atomically, ahead of the session. A fault between the claim and the session burns the return and
 * serves nothing: the gate fails closed.
 *
 * ── THE HOST REPORTS THE IMAGE, NEVER THE VESSEL ────────────────────────────────────────────────
 * `image` is an input port: the host shim writes the digest of the image it raises at the pūlama's hand door. The offer
 * carries no image field the gate trusts; the vouch's own digest must equal the host's.
 *
 * ── THE LEI FAMILY RIDES A PORT ─────────────────────────────────────────────────────────────────
 * The lei's record, its chain and its return belong to the swarm's lei family (`@lararium/mesh`). The gate names what it
 * asks of that family as `KukuluLeiPort`, so the family's own reader and return seat here through a thin adapter.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/the-worn-house#/the-pulama
 */
import { FLOOR_REST_KEY_INFO, GATE_BUNDLE_INFO, PULAMA_TESSERA_DOMAIN, KUKULU_VOUCH_DOMAIN, canonicalJsonBytes, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, verifyKukuluVouch } from "@lararium/mesh";
import type { CustodyHolder } from "./custody-holder.js";
import { personaGroupDigest } from "./persona-group-file.js";
import type { PulamaGate, PulamaScope } from "./pulama-server.js";

/** A signing seat: a verifying key (64 lower hex) and its signature over bytes. */
export interface KukuluSigner { readonly key: string; readonly sign: (bytes: Uint8Array) => Promise<string> }

/** What the gate asks of the lei family, for the one rite `kukulu`. */
export interface KukuluLeiPort {
  /**
   * Read an offered lei: it verifies as a `kukulu` lei for `group` that a key `hand` accepts strung, it stands (no newer lei
   * restrung it, none unstrung it) and its return rests unclaimed. Answers what it binds, or the family's own refusal reading.
   */
  readLei(offered: unknown, group: string, hand: (key: string) => boolean): Promise<
    { readonly ok: true; readonly cid: string; readonly branch: string; readonly head: string } | { readonly ok: false; readonly refusal: string }>;
  /** Claim the lei's return, once, signed by the pūlama: false where a return of it already rests. */
  returnLei(cid: string, by: KukuluSigner): Promise<boolean>;
}

/** The pūlama's tessera half: the signed record that a kūkulu began under one lei, one vouch and one image. */
export interface PulamaTesseraBody {
  readonly kind: typeof PULAMA_TESSERA_DOMAIN; readonly act: "rite-begun"; readonly rite: "kukulu";
  readonly group: string; readonly branch: string; readonly lei: string; readonly vouch: string; readonly image: string;
}
export interface SignedPulamaTessera { readonly body: PulamaTesseraBody; readonly signer: string; readonly sig: string }

/** Where the pūlama's tessera halves rest: one row per lei, written once. */
export interface PulamaTesseraPort { land(lei: string, text: string): Promise<boolean> }

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

/** The key the pūlama signs its tessera halves and its lei returns under. */
export async function pulamaSignerOf(holder: Pick<CustodyHolder, "derive">): Promise<KukuluSigner> {
  const seed = holder.derive(PULAMA_TESSERA_DOMAIN);
  let key: string;
  try { key = await ed25519VerifyingKeyFromSeed(seed); } finally { seed.fill(0); }
  return { key, sign: async (bytes) => { const s = holder.derive(PULAMA_TESSERA_DOMAIN); try { return await ed25519SignerFromSeed(s)(bytes); } finally { s.fill(0); } } };
}

export function kukuluGate(a: {
  /** The pūlama's own holder: the gate reads the face's standing, the ward's public key and two derived children off it. */
  readonly holder: CustodyHolder;
  readonly lei: KukuluLeiPort;
  /** THE HOST'S REPORT of the image it raises, or null where it reported none. */
  readonly image: () => string | null | Promise<string | null>;
  readonly tessera: PulamaTesseraPort;
  readonly coldReads?: readonly string[];
}): PulamaGate {
  const { holder } = a;
  const refuse = (reading: string, why?: string) => ({ ok: false as const, reading, ...(why ? { why } : {}) });
  return {
    async admit(offer) {
      const o = (typeof offer === "object" && offer !== null ? offer : {}) as { lei?: unknown; vouch?: unknown };
      if (o.vouch === undefined || o.vouch === null) return refuse("kukulu-unvouched", "a kūkulu wears its lei beside a vouch; this hello carries none");
      const vouched = verifyKukuluVouch(o.vouch, await vouchKeyOf(holder));
      if (!vouched.ok) return refuse(`kukulu-vouch-${vouched.refusal}`);
      const { body } = vouched.vouch;
      if (body.verdict !== "pass") return refuse("kukulu-walk-red", "the walk the vouch names did not pass");
      const groupDigest = personaGroupDigest(body.group);
      const face = await holder.faceStanding({ group: groupDigest });
      if (face === null) return refuse("kukulu-face-absent");
      if (!face.unlocked) return refuse("kukulu-face-locked", "the face the vouch names rests unopened at this pūlama");
      // THE HAND'S KEY comes off the pūlama's own custody (the face's ward key row), never off the offer.
      const hand = await holder.wardPublicKey({ group: groupDigest });
      if (hand === null) return refuse("kukulu-ward-key-absent");
      const lei = await a.lei.readLei(o.lei, body.group, (key) => key.toLowerCase() === hand);
      if (!lei.ok) return refuse(`kukulu-lei-${lei.refusal}`);
      if (lei.head !== vouched.digest || lei.branch !== body.branch) return refuse("kukulu-lei-unbound", "the lei names another vouch than the one offered beside it");
      const raised = await a.image();
      if (raised === null) return refuse("kukulu-image-unreported", "the host reported no image digest at the pūlama's hand door");
      if (raised !== body.image) return refuse("kukulu-image-mismatch", "the vouch walked another image than the one the host raises");
      // THE RETURN CLAIMS FIRST: from here a fault burns the return and serves nothing.
      const signer = await pulamaSignerOf(holder);
      if (!(await a.lei.returnLei(lei.cid, signer))) return refuse("kukulu-lei-returned", "this lei's return was already claimed");
      const half: PulamaTesseraBody = { kind: PULAMA_TESSERA_DOMAIN, act: "rite-begun", rite: "kukulu", group: body.group, branch: body.branch, lei: lei.cid, vouch: vouched.digest, image: raised };
      const signed: SignedPulamaTessera = { body: half, signer: signer.key, sig: await signer.sign(canonicalJsonBytes(half)) };
      let landed = false;
      try { landed = await a.tessera.land(lei.cid, JSON.stringify(signed)); } catch { landed = false; }
      if (!landed) return refuse("kukulu-tessera-unwritten");
      const scope: PulamaScope = { face: { fcid: face.fcid, ordinal: face.ordinal }, coldReads: a.coldReads ?? KUKULU_COLD_READS };
      return { ok: true, scope };
    },
  };
}
