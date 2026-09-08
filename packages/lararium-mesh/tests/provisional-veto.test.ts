/**
 * provisional-veto — THE G2 SETTLEMENT's reds: the persona-KEL's last bytes-change under this alpha,
 * stated clause by clause from the walked hardening rule (identity-classes#the-two-forks).
 *
 *   ① a PROVISIONAL head confers nothing by default — the prior key stays head until the observer
 *     chooses acceptance (its own silence-across-K-local-epochs policy; the grammar stays pure and
 *     takes the observer's verdict as input, never a clock);
 *   ② the VETO out-competes causally, always — even after an observer hardened, and it kills the
 *     provisional's DESCENDANTS with it (their state falls to kapae, which clause ① kept clean);
 *   ③ the contest survives the board round-trip UN-COLLAPSED — contest-aware keying, and the fold
 *     picks a verified veto over a provisional at the same seq, everywhere, always;
 *   ④ an idle observer never hardens — silence against ZERO local progress reads as patience, the
 *     fail-closed posture, never as acceptance (the last vessel of a dying mesh keeps its head).
 */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { hex } from "../src/crypto.js";
import {
  mintPersonaRotation, mintVeto, personaVetoSigningBytes,
  headOpKey, verifyPersonaKel, foldPersonaContests,
  type PersonaKelEvent,
} from "../src/persona-kel.js";
import { provisionThresholdRecoveryAtFounding, attestAndRotate } from "../src/recovery-keel-core.js";
import { guardianRecoveryRegistrationCard } from "../src/recovery-registration.js";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";
import { writePersonaKelEvent, personaKelChainForPrefix } from "../src/persona-kel-board.js";

const SEEDS = {
  op:    new Uint8Array(32).fill(11),   // the standing holder's op-key
  fresh: new Uint8Array(32).fill(22),   // the recovery's fresh op-key
  next:  new Uint8Array(32).fill(33),   // a descendant the provisional chain mints
  self:  new Uint8Array(32).fill(5),    // the 1-of-1 self-recovery guardian
};
const pubOf    = (s: Uint8Array) => ed.getPublicKeyAsync(s).then(hex);
const didOf    = async (s: Uint8Array) => `0x${await pubOf(s)}`;
const signerOf = (s: Uint8Array) => async (b: Uint8Array) => hex(await ed.signAsync(b, s));
const gsigner  = async (s: Uint8Array) => ({ signer: await pubOf(s), sign: signerOf(s) });

async function armedInception() {
  const foundingOpKeyDid = await didOf(SEEDS.op);
  const selfPub = await pubOf(SEEDS.self);
  return {
    foundingOpKeyDid, selfPub,
    prov: provisionThresholdRecoveryAtFounding({
      foundingOpKeyDid,
      guardians: [guardianRecoveryRegistrationCard("mine", selfPub, null)],
      recoveryThreshold: 1,
    }),
  };
}

async function provisionalRotation(head: PersonaKelEvent, selfPub: string) {
  return attestAndRotate({
    head, freshOpKeyDid: await didOf(SEEDS.fresh),
    guardianRecoveryKeys: [selfPub], recoveryThreshold: 1,
    guardianSigners: [await gsigner(SEEDS.self)],
    provisional: true,
  });
}

describe("the settlement's four clauses", () => {
  test("★ ① A PROVISIONAL HEAD CONFERS NOTHING BY DEFAULT ★", async () => {
    const { foundingOpKeyDid, selfPub, prov } = await armedInception();
    const rot = await provisionalRotation(prov.inception, selfPub);
    expect(rot.ok, rot.ok ? "" : rot.reason).toBe(true);
    if (!rot.ok) return;
    expect(rot.event.provisional).toBe(true);

    const chain = [prov.inception, rot.event];
    expect(verifyPersonaKel(chain)).toBe(true);
    // The prior key stays head until the OBSERVER accepts — its policy, its input, never a clock.
    expect(await headOpKey(chain)).toBe(foundingOpKeyDid);
    expect(await headOpKey(chain, { acceptProvisional: true })).toBe(await didOf(SEEDS.fresh));
  });

  test("★ ② THE VETO KILLS THE PROVISIONAL AND ITS DESCENDANTS — even after an observer hardened ★", async () => {
    const { foundingOpKeyDid, selfPub, prov } = await armedInception();
    const rot = await provisionalRotation(prov.inception, selfPub);
    if (!rot.ok) throw new Error("setup");

    // The provisional chain marches on (an observer hardened and the fresh key minted a descendant).
    const onward = await attestAndRotate({
      head: rot.event, freshOpKeyDid: await didOf(SEEDS.next),
      guardianRecoveryKeys: [selfPub], recoveryThreshold: 1,
      guardianSigners: [await gsigner(SEEDS.self)],
    });
    if (!onward.ok) throw new Error("setup2");

    // The unpartitioned holder's veto lands late — signed by the STANDING op-key, at any distance.
    const veto = await mintVeto({
      contested: rot.event, standing: prov.inception, sign: signerOf(SEEDS.op),
    });
    const folded = foldPersonaContests([prov.inception, rot.event, onward.event, veto]);
    expect(verifyPersonaKel(folded)).toBe(true);
    expect(await headOpKey(folded), "the standing key returns; the descendants fall to kapae").toBe(foundingOpKeyDid);
    expect(folded.some((e) => e.eventCid === onward.event.eventCid), "the descendant dies with its parent").toBe(false);
  });

  test("★ ③ THE CONTEST SURVIVES THE BOARD ROUND-TRIP UN-COLLAPSED ★", async () => {
    const { foundingOpKeyDid, selfPub, prov } = await armedInception();
    const rot = await provisionalRotation(prov.inception, selfPub);
    if (!rot.ok) throw new Error("setup");
    const veto = await mintVeto({ contested: rot.event, standing: prov.inception, sign: signerOf(SEEDS.op) });

    const doc = emptyLarDoc() as LarDoc;
    for (const e of [prov.inception, rot.event, veto]) writePersonaKelEvent(doc, e);
    // Contest-aware keying: the provisional and its veto BOTH survive storage (never one LWW slot).
    const chain = personaKelChainForPrefix(doc, prov.inception.prefix);
    expect(chain, "the board carries the folded, veto-resolved lineage").not.toBeNull();
    expect(await headOpKey(chain!)).toBe(foundingOpKeyDid);
  });

  test("★ ④ AN IDLE OBSERVER NEVER HARDENS — patience, not a hole ★", async () => {
    // The grammar takes the observer's verdict as INPUT: acceptance is the caller's
    // silence-across-K-local-epochs policy. An observer whose own board never advanced supplies no
    // acceptance, and the head stays the standing key — the last vessel of a dying mesh keeps its
    // head, fail-closed, exactly as a gate that refuses on absence keeps its boot. This clause needs
    // no mechanism here beyond ①'s default: NOT accepting is the resting state.
    const { foundingOpKeyDid, selfPub, prov } = await armedInception();
    const rot = await provisionalRotation(prov.inception, selfPub);
    if (!rot.ok) throw new Error("setup");
    expect(await headOpKey([prov.inception, rot.event])).toBe(foundingOpKeyDid);
  });

  test("the veto's bytes bind the contested cid — a veto never floats onto another contest", async () => {
    const { selfPub, prov } = await armedInception();
    const rot = await provisionalRotation(prov.inception, selfPub);
    if (!rot.ok) throw new Error("setup");
    const a = personaVetoSigningBytes(rot.event, prov.inception);
    const rot2 = await provisionalRotation(prov.inception, selfPub);
    if (!rot2.ok) throw new Error("setup2");
    // identical inputs mint identical provisionals — so bind through DISTINCT contested events instead
    const other = { ...rot2.event, eventCid: "pkel1-" + "f".repeat(64) };
    const b = personaVetoSigningBytes(other as PersonaKelEvent, prov.inception);
    expect(hex(a)).not.toBe(hex(b));
  });
});
