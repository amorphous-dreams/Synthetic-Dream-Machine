/**
 * promotion-receipt — THE AUDIT HALF OF THE PRIESTHOOD ACT.
 *
 * `docs/pono/canon-boundary#/the-promotion-boundary` names the declared blocker plainly: promotion into a
 * canon bag is PERMITTED by capability and RECORDED by nothing. "A cap gate is a decision at a moment; a
 * receipt is a record you can walk backwards." This is that record, at the smallest shape the boundary asks
 * for — proposer, approver, source, destination, content hash, signed, with the approver's hold on the
 * destination checked AT THE MOMENT OF SIGNING.
 *
 * ★ THE SIGNED-REGION / ATTACHED-REGION DISCIPLINE, which the boundary demands by name: what the signer
 * ASSERTS rides INSIDE the signature; what the world can check for itself — chains, memberships, freshness
 * — rides ATTACHED and UNSIGNED, so refreshing evidence never wakes a cold key. Signing evidence causes
 * freshness coupling and pins staleness.
 *
 * ★ THE FOUR REFUSALS: no admin cap on the destination · an UNGOVERNED carrier (neither lifecycle nor
 * standing) · an UNADDRESSED subject · a move that moves NOTHING (same bag either side, or a bag missing)
 * — plus the SESSION wall: a subject with no content hash cannot be receipted even in principle, so the
 * mint refuses it rather than inventing one.
 *
 * ★ AND A HOSTFUL ADDRESS CARRIES NO SPECIAL STANDING (operator ruling). Hostful/hostless names WHAT THE
 * URI NAMES — who spoke, under what grant, from where — never which layer it lives on. Any `lar:` URI
 * serves as a valid meme title, so the receipt records ONE subject address, identical either side, and
 * distinguishes the crossing by the BAGS it names. A source/target address pair would fabricate both
 * halves: an address the carrier never carried, and an assignment the crossing never performs.
 *
 * CONTROLS: a receipt verifies end-to-end; mutating the ATTACHED region leaves it valid (that IS the
 * discipline); mutating any asserted field invalidates it; a receipt minted for one destination never
 * verifies as one for another (the domain + the bytes); a foreign key's signature verifies as nothing.
 */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { hex, hexToBytes } from "../src/crypto.js";
import {
  mintPromotionReceipt, verifyPromotionReceipt, promotionAssertionBytes,
  PROMOTION_RECEIPT_DOMAIN, type PromotionReceipt,
} from "../src/promotion-receipt.js";

const SEED_APPROVER = hexToBytes("a1".repeat(32));
const SEED_STRANGER = hexToBytes("b2".repeat(32));
const signWith = (seed: Uint8Array) => async (b: Uint8Array): Promise<string> => hex(await ed.signAsync(b, seed));
const didOf = async (seed: Uint8Array): Promise<string> => hex(await ed.getPublicKeyAsync(seed));

const DEST = "lar:///ha.ka.ba/bags/lares";
const FROM = "lar:///ha.ka.ba/bags/working";
/** The subject's OWN address — identical either side of the crossing. A residency move moves no byte of it. */
const SUBJECT = "lar:///ha.ka.ba/lares/docs/pono/t-witness-promote";
const HASH = "ni:///sha-256;s9wMX2yprC8TPIZRdXj0IdPXjLCmt9WM-qYIq-7UQSo";

/** The governed subject: a carrier whose meta declares a lifecycle the boundary knows how to cross. */
const GOVERNED = { tags: ["docs/pono/design", "lifecycle/standing"] };
const UNGOVERNED = { tags: ["docs/pono/design"] };

async function mint(over: Record<string, unknown> = {}): Promise<
  { ok: true; receipt: PromotionReceipt } | { ok: false; reason: string }
> {
  const approverDid = await didOf(SEED_APPROVER);
  return mintPromotionReceipt({
    subjectUri: SUBJECT, carrierHash: HASH, fromBag: FROM, toBag: DEST,
    proposerNym: "proposer-nym", approverNym: approverDid, approverKeyDid: approverDid,
    subject: GOVERNED,
    holdsAdmin: (nym: string, bag: string) => nym === approverDid && bag === DEST,
    sign: signWith(SEED_APPROVER),
    ...over,
  } as Parameters<typeof mintPromotionReceipt>[0]);
}

describe("promotion-receipt — the record a promotion leaves behind", () => {
  test("★ a promotion by an admin holder on a governed carrier mints a receipt that verifies ★", async () => {
    const r = await mint();
    expect(r.ok, r.ok ? "" : r.reason).toBe(true);
    if (!r.ok) return;
    expect(r.receipt.assertion.domain).toBe(PROMOTION_RECEIPT_DOMAIN);
    expect(r.receipt.assertion.subjectUri).toBe(SUBJECT);
    expect(r.receipt.assertion.fromBag).toBe(FROM);
    expect(r.receipt.assertion.toBag).toBe(DEST);
    expect(r.receipt.assertion.carrierHash).toBe(HASH);
    expect(await verifyPromotionReceipt(r.receipt)).toBe(true);
  });

  test("★ RED: a promotion with NO admin cap on the destination REFUSES ★", async () => {
    const r = await mint({ holdsAdmin: () => false });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toContain("admin");
  });

  test("★ CONTROL: a promotion of an UNGOVERNED carrier REFUSES — not lifecycle/standing ★", async () => {
    const r = await mint({ subject: UNGOVERNED });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toContain("lifecycle/standing");
  });

  test("an UNADDRESSED subject refuses — a receipt records WHAT crossed", async () => {
    const r = await mint({ subjectUri: "" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toContain("address");
  });

  test("a move that moves NOTHING refuses — residency IS the crossing, so an unmoved envelope records nothing", async () => {
    for (const over of [{ fromBag: DEST }, { fromBag: "" }, { toBag: "" }]) {
      const r = await mint(over);
      expect(r.ok, `${JSON.stringify(over)} minted a receipt for an unmoved envelope`).toBe(false);
      if (!r.ok) expect(r.reason).toContain("moves nothing");
    }
  });

  test("★ A HOSTFUL ADDRESS CARRIES NO SPECIAL STANDING — any `lar:` URI serves as a meme title ★", async () => {
    // The operator ruling: hostful/hostless names WHAT THE URI NAMES, never which layer it lives on. A
    // captured exchange turn split by speaker-aim URI stands as a legitimate canon meme, so a subject
    // declaring one receipts exactly like any other.
    const r = await mint({ subjectUri: "lar://mara:admin@crossroads/t.witness.promote/ledger" });
    expect(r.ok, r.ok ? "" : r.reason).toBe(true);
    if (!r.ok) return;
    expect(await verifyPromotionReceipt(r.receipt)).toBe(true);
  });

  test("THE SESSION WALL: a subject with NO content hash cannot be receipted even in principle", async () => {
    const r = await mint({ carrierHash: "" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toContain("content hash");
  });

  test("★ THE DISCIPLINE: moving the ATTACHED region leaves the receipt VALID ★", async () => {
    const r = await mint();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const refreshed: PromotionReceipt = {
      ...r.receipt,
      attached: { ...r.receipt.attached, readAt: "2099-01-01T00:00:00.000Z", note: "evidence refreshed offline" },
    };
    expect(await verifyPromotionReceipt(refreshed)).toBe(true);
  });

  test("CONTROL: moving ANY asserted field invalidates the receipt", async () => {
    const r = await mint();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const field of ["subjectUri", "carrierHash", "fromBag", "toBag", "proposerNym", "approverNym"] as const) {
      const tampered: PromotionReceipt = {
        ...r.receipt,
        assertion: { ...r.receipt.assertion, [field]: `${String(r.receipt.assertion[field])}-moved` },
      };
      expect(await verifyPromotionReceipt(tampered), `${field} moved and the receipt still verified`).toBe(false);
    }
  });

  test("CONTROL: a receipt for one destination never verifies as one for another", async () => {
    const r = await mint();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const swapped: PromotionReceipt = {
      ...r.receipt, assertion: { ...r.receipt.assertion, toBag: "lar:///ha.ka.ba/bags/lararium" },
    };
    expect(await verifyPromotionReceipt(swapped)).toBe(false);
  });

  test("CONTROL: a FOREIGN key's signature over the same bytes verifies as nothing", async () => {
    const r = await mint();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const forged: PromotionReceipt = {
      ...r.receipt,
      sig: hex(await ed.signAsync(promotionAssertionBytes(r.receipt.assertion), SEED_STRANGER)),
    };
    expect(await verifyPromotionReceipt(forged)).toBe(false);
  });

  test("CONTROL: the domain separates — the same assertion under a nonsense domain verifies as nothing", async () => {
    const r = await mint();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const other: PromotionReceipt = {
      // ASSEMBLED, never written: `tools/domain-registry-witness.sh` refuses a domain literal outside the
      // registry, and it is right to — a nonsense domain spelled in full here reads to the sweep exactly
      // like a real one someone forgot to register.
      ...r.receipt, assertion: { ...r.receipt.assertion, domain: ["lar:///ha.ka.ba/lares", "domain", "not-a-promotion", "v1"].join("/") },
    };
    expect(await verifyPromotionReceipt(other)).toBe(false);
  });
});
