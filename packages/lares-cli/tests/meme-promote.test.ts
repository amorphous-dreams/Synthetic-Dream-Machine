/**
 * meme-promote.test — THE PRIESTHOOD ACT GETS A DOOR AND A RECORD.
 *
 * `lar:///ha.ka.ba/lares/docs/pono/canon-boundary#/the-promotion-boundary` names the blocker: a promotion
 * into a canon bag is PERMITTED by capability and RECORDED by nothing. `mintPromotionReceipt` built the
 * record; this is the door that performs the crossing and writes it beside the carrier it moved.
 *
 * THE SEAT IS INJECTED, so every vector here runs with no vessel, no keyring, and no daemon: the approver's
 * nym, its key, its signer, and the ADMIN READING all arrive as arguments. That is the same discipline the
 * receipt module keeps — it "holds no key and reads no cap" — carried one layer out.
 *
 * THE FIXTURE IS ASSEMBLED AT READ TIME and promotes NOTHING REAL: a carrier minted into a temp tree, with
 * no DOCTYPE line and no `type =` line, so nothing here can be mistaken for a hearth carrier or swept up by
 * a corpus reader that walks declarations.
 *
 * Proven:
 *   · a crossing with the admin cap moves the file, rewrites `uri-path` + `file-path`, welds every inbound
 *     edge, and leaves the receipt beside the promoted carrier where `verifyPromotionReceipt` reads it,
 *   · RED: no `cap("admin")` on the canon bag → refused, and NOTHING moves,
 *   · CONTROL: an ungoverned carrier (no `lifecycle/` tag) and one standing off `lifecycle/standing` are
 *     each refused, and nothing moves,
 *   · CONTROL: the edge count is equal before and after — zero new dangling addresses.
 */
import { describe, test, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  verifyPromotionReceipt, promotionReceiptPath, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed,
} from "@lararium/mesh";
import { promoteCarrier } from "../src/commands/meme-promote.js";

const SEED = new Uint8Array(32).fill(9);

/** A carrier assembled at read time — no DOCTYPE, no `type =`, nothing a corpus reader would claim. */
function carrier(uriPath: string, filePath: string, tags: string): string {
  return [
    `<<^ code="&#x0001;" from="?" -> to="lar:///${uriPath}">>`,
    "```toml meta",
    `file-path  = "${filePath}"`,
    `tags       = [${tags}]`,
    `uri-path   = "${uriPath}"`,
    "```",
    "",
    '<<^ code="&#x0002;">>',
    "",
    "! A fixture that crosses nothing real",
    "",
    '<<^ code="&#x0003;">>ni:///sha-256;AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    '<<^ code="&#x0004;" -> to="?">>',
    "",
  ].join("\n");
}

/** A second carrier that POINTS AT the first — the inbound edge the weld must move. */
function pointer(uriPath: string, filePath: string, at: string): string {
  return [
    `<<^ code="&#x0001;" from="?" -> to="lar:///${uriPath}">>`,
    "```toml meta",
    `file-path  = "${filePath}"`,
    `uri-path   = "${uriPath}"`,
    "```",
    "",
    '<<^ code="&#x0002;">>',
    "",
    `<<~ loulou "lar:///${at}">>`,
    "",
    '<<^ code="&#x0003;">>ni:///sha-256;AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    '<<^ code="&#x0004;" -> to="?">>',
    "",
  ].join("\n");
}

const SUBJECT_URI = "ha.ka.ba/lares/docs/pono/fixture-crossing";
const TARGET_URI  = "ha.ka.ba/lares/api/pono/fixture-crossing";
const SUBJECT_REL = "bags/lares/ha.ka.ba/lares/docs/pono/fixture-crossing.mem";
const TARGET_REL  = "bags/lares/ha.ka.ba/lares/api/pono/fixture-crossing.mem";
const POINTER_REL = "bags/lares/ha.ka.ba/lares/docs/pono/fixture-pointer.mem";

function tree(tags = '"docs/pono/design", "lifecycle/standing"'): string {
  const root = mkdtempSync(join(tmpdir(), "lr-promote-"));
  mkdirSync(join(root, "bags/lares/ha.ka.ba/lares/docs/pono"), { recursive: true });
  mkdirSync(join(root, "bags/lares/ha.ka.ba/lares/api/pono"),  { recursive: true });
  writeFileSync(join(root, SUBJECT_REL), carrier(SUBJECT_URI, SUBJECT_REL, tags));
  writeFileSync(join(root, POINTER_REL), pointer("ha.ka.ba/lares/docs/pono/fixture-pointer", POINTER_REL, SUBJECT_URI));
  return root;
}

async function seat(opts?: { admin?: boolean }) {
  const key = await ed25519VerifyingKeyFromSeed(SEED);
  return {
    proposerNym:    key,
    approverNym:    key,
    approverKeyDid: key,
    holdsAdmin:     async () => opts?.admin !== false,
    sign:           ed25519SignerFromSeed(SEED),
    now:            () => "2026-09-13T00:00:00.000Z",
  };
}

describe("lares meme promote — the crossing performs, and the receipt records it", () => {
  test("with the admin cap: the file moves, the addresses rewrite, the edge welds, the receipt verifies", async () => {
    const root = tree();
    try {
      const r = await promoteCarrier({ root, file: SUBJECT_REL, corpus: [SUBJECT_REL, POINTER_REL] }, await seat());
      expect(r.ok, "ok" in r ? "" : (r as { reason: string }).reason).toBe(true);
      if (!r.ok) return;

      expect(existsSync(join(root, SUBJECT_REL))).toBe(false);
      const moved = readFileSync(join(root, TARGET_REL), "utf8");
      expect(moved).toContain(`uri-path   = "${TARGET_URI}"`);
      expect(moved).toContain(`file-path  = "${TARGET_REL}"`);
      expect(moved).toContain(`to="lar:///${TARGET_URI}"`);
      expect(moved).not.toContain("docs/pono/fixture-crossing");

      // THE WELD: the inbound edge followed the address, so no carrier points at a name nothing holds.
      expect(readFileSync(join(root, POINTER_REL), "utf8")).toContain(`lar:///${TARGET_URI}`);
      expect(r.welded).toBe(1);
      expect(r.edgesBefore).toBe(r.edgesAfter);           // CONTROL: zero new dangling
      expect(r.danglingAfter).toBe(0);

      const receiptPath = promotionReceiptPath(join(root, TARGET_REL));
      const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
      expect(await verifyPromotionReceipt(receipt)).toBe(true);
      expect(receipt.assertion.targetUri).toBe(`lar:///${TARGET_URI}`);
      expect(receipt.assertion.carrierHash).toMatch(/^ni:\/\/\/sha-256;/);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test("RED: no cap(\"admin\") on the canon bag — refused, and nothing moves", async () => {
    const root = tree();
    try {
      const r = await promoteCarrier({ root, file: SUBJECT_REL, corpus: [SUBJECT_REL, POINTER_REL] }, await seat({ admin: false }));
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.reason).toContain("admin");
      expect(existsSync(join(root, SUBJECT_REL)), "the subject moved under a refusal").toBe(true);
      expect(existsSync(join(root, TARGET_REL)), "a carrier landed in canon under a refusal").toBe(false);
      expect(readFileSync(join(root, POINTER_REL), "utf8")).toContain(SUBJECT_URI);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test("CONTROL: an ungoverned carrier, and one off `lifecycle/standing`, are each refused", async () => {
    for (const tags of ['"docs/pono/design"', '"docs/pono/design", "lifecycle/lean"']) {
      const root = tree(tags);
      try {
        const r = await promoteCarrier({ root, file: SUBJECT_REL, corpus: [SUBJECT_REL, POINTER_REL] }, await seat());
        expect(r.ok, `${tags} crossed the boundary`).toBe(false);
        expect(existsSync(join(root, SUBJECT_REL))).toBe(true);
        expect(existsSync(join(root, TARGET_REL))).toBe(false);
      } finally { rmSync(root, { recursive: true, force: true }); }
    }
  });

  test("CONTROL: a carrier already in canon, and one naming no `docs/` segment, are refused", async () => {
    const root = tree();
    try {
      writeFileSync(join(root, TARGET_REL), carrier(TARGET_URI, TARGET_REL, '"lifecycle/standing"'));
      const r = await promoteCarrier({ root, file: TARGET_REL, corpus: [TARGET_REL] }, await seat());
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toMatch(/docs|canon/);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
