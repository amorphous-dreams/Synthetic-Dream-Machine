import { describe, expect, test } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, exactBytesHash,
  openPromotionApproval, promotionApprovalBytes, signPromotionApproval, verifyPromotionApproval,
  type KahuQuorumSeats, type PromotionApproval,
} from "@lararium/mesh";
import { promoteCarrier, type PromotionSeat } from "../src/commands/meme-promote.js";
import { CROSSROADS_BAG, verifyPromotionReceipt } from "../src/promotion-receipt.js";

const seed = (n: number) => new Uint8Array(32).fill(n);
const file = "draft.mem";
const title = "lar:///test/promotion";
const fromBag = "lar:///test/working";
const toBag = CROSSROADS_BAG;
const source = [
  '<<^ code="&#x0001;" from="?" -> to="lar:///test/promotion">>',
  '<<^ code="&#x0002;">>',
  '```toml meta',
  'uri-path = "test/promotion"',
  'tags = ["lifecycle/standing"]',
  '```',
  'body',
  '<<^ code="&#x0003;">>ni:///sha-256;AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  '<<^ code="&#x0004;" -> to="?">>',
].join("\n");

async function fixture() {
  const root = mkdtempSync(join(tmpdir(), "promotion-approval-"));
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, file), source);
  const keys = await Promise.all([1, 2, 3].map((n) => ed25519VerifyingKeyFromSeed(seed(n))));
  const roster: KahuQuorumSeats = { keys, threshold: 2, sealEpochCid: "epoch-one" };
  const bytes = readFileSync(join(root, file));
  const opened = openPromotionApproval({ bytes, purpose: "publish shared canon", surface: "crossroads", actClass: "high-impact", roster });
  const signed = await signPromotionApproval(opened, await Promise.all([1, 2].map(async (n) => ({ signer: keys[n - 1]!, sign: ed25519SignerFromSeed(seed(n)) }))), roster);
  let census = JSON.stringify({ [fromBag]: [title], [toBag]: [] });
  let moves = 0;
  const seat: PromotionSeat = {
    proposerNym: keys[0]!, approverNym: keys[0]!, approverKeyDid: keys[0]!,
    holdsAdmin: async () => true,
    residencyOf: async () => JSON.parse(census)[fromBag].includes(title) ? [fromBag] : [toBag],
    move: async () => { moves++; census = JSON.stringify({ [fromBag]: [], [toBag]: [title] }); return { ok: true, moved: 1 }; },
    sign: ed25519SignerFromSeed(seed(1)),
    verifyApproval: (approval, exact) => verifyPromotionApproval({ approval, bytes: exact, roster }),
  };
  return { root, roster, opened, signed, seat, bytes, census: () => census, moves: () => moves };
}

describe("promotion approval governs the crossing into @crossroads", () => {
  for (const [name, change, reason] of [
    ["no approval", async (_f: Awaited<ReturnType<typeof fixture>>) => undefined, "malformed-approval"],
    ["approval over other bytes", async (f: Awaited<ReturnType<typeof fixture>>) => {
      const other = openPromotionApproval({ bytes: new TextEncoder().encode("other"), purpose: "publish shared canon", surface: "crossroads", actClass: "high-impact", roster: f.roster });
      return signPromotionApproval(other, await Promise.all([1, 2].map(async (n) => ({ signer: f.roster.keys[n - 1]!, sign: ed25519SignerFromSeed(seed(n)) }))), f.roster);
    }, "bytes-differ"],
    ["short count", async (f: Awaited<ReturnType<typeof fixture>>) => signPromotionApproval(f.opened, [{ signer: f.roster.keys[0]!, sign: ed25519SignerFromSeed(seed(1)) }], f.roster), "below-class-threshold"],
    ["other epoch", async (f: Awaited<ReturnType<typeof fixture>>) => ({ ...f.signed, sealEpochCid: "epoch-two" }), "wrong-charter-epoch"],
  ] as const) {
    test(`${name} refuses without moving; complete approval controls`, async () => {
      const f = await fixture();
      try {
        const before = f.census();
        const approval = await change(f);
        const refused = await promoteCarrier({ root: f.root, file, fromBag, destBag: toBag, approval }, f.seat);
        expect(refused).toEqual({ ok: false, reason });
        expect(f.census()).toBe(before);
        expect(f.moves()).toBe(0);
        const accepted = await promoteCarrier({ root: f.root, file, fromBag, destBag: toBag, approval: f.signed }, f.seat);
        expect(accepted.ok, accepted.ok ? "" : accepted.reason).toBe(true);
        if (accepted.ok) {
          expect(f.moves()).toBe(1);
          const receipt = JSON.parse(readFileSync(accepted.receiptPath, "utf8"));
          expect(receipt.assertion.approvalStatementDigest).toBe(exactBytesHash(promotionApprovalBytes(f.signed)));
          expect(await verifyPromotionReceipt(receipt)).toBe(true);
          const moved = { ...receipt, assertion: { ...receipt.assertion, approvalStatementDigest: exactBytesHash(new TextEncoder().encode("other")) } };
          expect(await verifyPromotionReceipt(moved), "the receipt's signature leaves the approval digest outside").toBe(false);
        }
      } finally { rmSync(f.root, { recursive: true, force: true }); }
    });
  }

  test("a crossing into a vessel's own canon bag asks no approval and records none", async () => {
    const f = await fixture();
    try {
      const own = "lar:///test/canon";
      const r = await promoteCarrier({ root: f.root, file, fromBag, destBag: own }, { ...f.seat,
        residencyOf: async () => [fromBag], verifyApproval: () => { throw new Error("an own-canon crossing asked the charter"); } });
      expect(r.ok, r.ok ? "" : r.reason).toBe(true);
      if (r.ok) expect(JSON.parse(readFileSync(r.receiptPath, "utf8")).assertion).not.toHaveProperty("approvalStatementDigest");
    } finally { rmSync(f.root, { recursive: true, force: true }); }
  });
});
