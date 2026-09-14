/**
 * meme-promote.test — A PROMOTION IS A RESIDENCY MOVE, AND AN ADDRESS DOES NOT MOVE WITH IT.
 *
 * ADDRESS STABILITY rules it: //the thing an address names does not become a different thing. This is what
 * makes an edge worth writing//. And the operator ruled the rest — a `lar:` URI naming an authority says WHO
 * SPOKE, UNDER WHAT GRANT, FROM WHERE, a property of the CONTENT and never of the layer it sits on. Any
 * `lar:` URI serves as a valid meme title, so the crossing assigns NO address of any kind.
 *
 * One shape follows: a promotion rewrites no `uri-path`, assigns no host, welds no edge, and re-stamps no
 * block check. It changes only WHICH BAG HOLDS THE RECORD, which rides the ENVELOPE
 * (`store.put(record, origin, { bag })`) and touches no persisted byte
 * (`UNPERSISTED_FIELDS = ["bag", "$origin-bag"]`).
 *
 * THE SEAT IS INJECTED WHOLE, so every vector here runs with no vessel, no keyring, and no daemon: the
 * approver's nym, its key, its signer, the ADMIN READING, the RESIDENCY READING, and the MOVE itself all
 * arrive as arguments. That is the receipt module's own discipline — it "holds no key and reads no cap" —
 * carried one layer out. The residency ledger the seat reads and the MOVE writes stands here as a Map, so
 * the door's HALF of the contract is what these vectors measure; the daemon's half is `executeMove`'s own.
 *
 * THE FIXTURE IS ASSEMBLED AT READ TIME and promotes NOTHING REAL: carriers minted into a temp tree, with no
 * DOCTYPE line and no `type =` line, so nothing here can be mistaken for a hearth carrier or swept up by a
 * corpus reader that walks declarations.
 *
 * Proven:
 *   · RED (the address holds): the promoted carrier's bytes stand IDENTICAL before and after — same
 *     `uri-path`, same `file-path`, same address mark, same block check digest, and the receipt records
 *     that ONE address rather than a fabricated hostful/hostless pair,
 *   · RED (the graph holds): a REFERENCING carrier changes not one byte — the property the string
 *     substitution existed to fake,
 *   · the door asks for a residency MOVE of the record at its own title, from the live bag to the canon bag,
 *   · the receipt records HOSTFUL → HOSTLESS over ONE path, and `verifyPromotionReceipt` reads it,
 *   · CONTROL: no `cap("admin")` on the canon bag → refused, naming the CAP, and nothing moves,
 *   · CONTROL: an ungoverned carrier, and one off `lifecycle/standing`, are each refused,
 *   · CONTROL: a record already resident in the canon bag, and one no live bag holds, are each refused —
 *     each read off RESIDENCY, never off a path segment.
 */
import { describe, test, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  verifyPromotionReceipt, promotionReceiptPath, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed,
} from "@lararium/mesh";
import { promoteCarrier, type PromotionSeat } from "../src/commands/meme-promote.js";

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

/** A second carrier that POINTS AT the first — the inbound edge a promotion must leave alone. */
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

const SUBJECT_URI   = "ha.ka.ba/lares/docs/pono/fixture-crossing";
const SUBJECT_TITLE = `lar:///${SUBJECT_URI}`;
const SUBJECT_REL   = "bags/lares/ha.ka.ba/lares/docs/pono/fixture-crossing.mem";
const POINTER_REL   = "bags/lares/ha.ka.ba/lares/docs/pono/fixture-pointer.mem";
/** The address the invented rename WOULD have assigned. Nothing rules it, so nothing here may produce it. */
const RENAMED_URI   = "ha.ka.ba/lares/api/pono/fixture-crossing";
const RENAMED_REL   = "bags/lares/ha.ka.ba/lares/api/pono/fixture-crossing.mem";

const LIVE_BAG  = "lar:///ha.ka.ba/bags/working";
const CANON_BAG = "lar:///ha.ka.ba/bags/lares";

/** A refusal read off a PATH SEGMENT rather than off residency. The address itself carries `/docs/`, so the
 *  tell is the COMPLAINT — "names no `docs/` segment", or the invented `api/` twin — never the address. */
const PATH_COMPLAINT = /segment|\/api\//;

function tree(tags = '"docs/pono/design", "lifecycle/standing"'): string {
  const root = mkdtempSync(join(tmpdir(), "lr-promote-"));
  mkdirSync(join(root, "bags/lares/ha.ka.ba/lares/docs/pono"), { recursive: true });
  writeFileSync(join(root, SUBJECT_REL), carrier(SUBJECT_URI, SUBJECT_REL, tags));
  writeFileSync(join(root, POINTER_REL), pointer("ha.ka.ba/lares/docs/pono/fixture-pointer", POINTER_REL, SUBJECT_URI));
  return root;
}

/** The RESIDENCY LEDGER the seat reads and the MOVE writes — bag → the titles it holds. Residency lives
 *  here and nowhere in the bytes, which is the whole claim these vectors stand on. */
type Ledger = Map<string, Set<string>>;
function ledger(entries: readonly (readonly [string, readonly string[]])[] = [[LIVE_BAG, [SUBJECT_TITLE]]]): Ledger {
  return new Map(entries.map(([bag, titles]) => [bag, new Set(titles)]));
}

interface Seated { seat: PromotionSeat; moves: { title: string; fromBag: string; toBag: string }[]; residency: Ledger }

async function seated(opts?: { admin?: boolean; residency?: Ledger }): Promise<Seated> {
  const key       = await ed25519VerifyingKeyFromSeed(SEED);
  const residency = opts?.residency ?? ledger();
  const moves: { title: string; fromBag: string; toBag: string }[] = [];
  const seat: PromotionSeat = {
    proposerNym:    key,
    approverNym:    key,
    approverKeyDid: key,
    holdsAdmin:     async () => opts?.admin !== false,
    residencyOf:    async (title) => [...residency].filter(([, ts]) => ts.has(title)).map(([bag]) => bag),
    move:           async (m) => {
      moves.push(m);
      const src = residency.get(m.fromBag);
      if (!src?.has(m.title)) return { ok: false as const, reason: `MOVE: source bag ${m.fromBag} does not hold ${m.title}` };
      src.delete(m.title);
      const dst = residency.get(m.toBag) ?? new Set<string>();
      dst.add(m.title);
      residency.set(m.toBag, dst);
      return { ok: true as const, moved: 1 };
    },
    sign:           ed25519SignerFromSeed(SEED),
    now:            () => "2026-09-13T00:00:00.000Z",
  };
  return { seat, moves, residency };
}

const plan = (root: string) => ({ root, file: SUBJECT_REL, fromBag: LIVE_BAG, destBag: CANON_BAG });

describe("lares meme promote — the crossing moves residency, and the address holds", () => {
  test("RED: the promoted carrier's bytes stand IDENTICAL — uri-path, file-path, address mark, block check", async () => {
    const root = tree();
    try {
      const before = readFileSync(join(root, SUBJECT_REL), "utf8");
      const { seat, moves, residency } = await seated();
      const r = await promoteCarrier(plan(root), seat);
      expect(r.ok, r.ok ? "" : r.reason).toBe(true);
      if (!r.ok) return;

      // THE ADDRESS HOLDS. A residency move re-stamps nothing, so the bytes are the bytes.
      const after = readFileSync(join(root, SUBJECT_REL), "utf8");
      expect(after, "the carrier's bytes moved under a residency move").toBe(before);
      expect(after).toContain(`uri-path   = "${SUBJECT_URI}"`);
      expect(after).toContain(`file-path  = "${SUBJECT_REL}"`);
      expect(after).toContain(`to="lar:///${SUBJECT_URI}"`);
      // THE BLOCK CHECK SURVIVES UNTOUCHED — same digest line, character for character.
      const digest = (t: string): string => /ni:\/\/\/[a-z0-9-]+;[A-Za-z0-9_-]+/.exec(t)?.[0] ?? "";
      expect(digest(after)).toBe(digest(before));
      expect(digest(after)).not.toBe("");

      // NO INVENTED RENAME. Nothing rules `/docs/` → `/api/`, so nothing produces it.
      expect(after).not.toContain(RENAMED_URI);
      expect(existsSync(join(root, RENAMED_REL)), "a file rite invented a second path").toBe(false);

      // THE MOVE IS WHAT WAS ASKED FOR — the record, at its own unchanged title, from live bag to canon bag.
      expect(moves).toEqual([{ title: SUBJECT_TITLE, fromBag: LIVE_BAG, toBag: CANON_BAG }]);
      expect(residency.get(LIVE_BAG)?.has(SUBJECT_TITLE)).toBe(false);
      expect(residency.get(CANON_BAG)?.has(SUBJECT_TITLE)).toBe(true);
      expect(r.title).toBe(SUBJECT_TITLE);
      expect(r.fromBag).toBe(LIVE_BAG);
      expect(r.toBag).toBe(CANON_BAG);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test("RED: a REFERENCING carrier changes not one byte — the property the string substitution faked", async () => {
    const root = tree();
    try {
      const before = readFileSync(join(root, POINTER_REL), "utf8");
      const { seat } = await seated();
      const r = await promoteCarrier(plan(root), seat);
      expect(r.ok, r.ok ? "" : r.reason).toBe(true);
      const after = readFileSync(join(root, POINTER_REL), "utf8");
      expect(after, "a weld rewrote a carrier the crossing never renamed").toBe(before);
      expect(after).toContain(`lar:///${SUBJECT_URI}`);
      expect(after).not.toContain(RENAMED_URI);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test("the receipt records ONE subject address, unchanged, and verifies", async () => {
    const root = tree();
    try {
      const { seat } = await seated();
      const r = await promoteCarrier(plan(root), seat);
      expect(r.ok, r.ok ? "" : r.reason).toBe(true);
      if (!r.ok) return;

      // NO ADDRESS MOVES. Not the path, and not the authority — the crossing assigns neither.
      expect(r.subjectUri).toBe(SUBJECT_TITLE);
      expect(r.subjectUri).not.toContain(RENAMED_URI);

      // The receipt rests BESIDE the carrier, at the carrier's own unmoved path.
      expect(r.receiptPath).toBe(promotionReceiptPath(join(root, SUBJECT_REL)));
      const receipt = JSON.parse(readFileSync(r.receiptPath, "utf8"));
      expect(await verifyPromotionReceipt(receipt)).toBe(true);
      expect(receipt.assertion.subjectUri).toBe(SUBJECT_TITLE);
      expect(receipt.assertion.fromBag).toBe(LIVE_BAG);
      expect(receipt.assertion.toBag).toBe(CANON_BAG);
      expect(receipt.assertion.carrierHash).toMatch(/^ni:\/\/\/sha-256;/);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test("CONTROL: no cap(\"admin\") on the canon bag — refused by the CAP, and nothing moves", async () => {
    const root = tree();
    try {
      const subject = readFileSync(join(root, SUBJECT_REL), "utf8");
      const { seat, moves, residency } = await seated({ admin: false });
      const r = await promoteCarrier(plan(root), seat);
      expect(r.ok).toBe(false);
      if (r.ok) return;
      // The refusal NAMES THE CAP, never a path segment.
      expect(r.reason).toContain("admin");
      expect(r.reason).not.toMatch(PATH_COMPLAINT);
      expect(moves, "a MOVE was asked for under a cap refusal").toEqual([]);
      expect(residency.get(LIVE_BAG)?.has(SUBJECT_TITLE)).toBe(true);
      expect(residency.get(CANON_BAG)?.has(SUBJECT_TITLE)).not.toBe(true);
      expect(readFileSync(join(root, SUBJECT_REL), "utf8")).toBe(subject);
      expect(existsSync(promotionReceiptPath(join(root, SUBJECT_REL)))).toBe(false);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test("CONTROL: an ungoverned carrier, and one off `lifecycle/standing`, are each refused", async () => {
    for (const tags of ['"docs/pono/design"', '"docs/pono/design", "lifecycle/lean"']) {
      const root = tree(tags);
      try {
        const { seat, moves } = await seated();
        const r = await promoteCarrier(plan(root), seat);
        expect(r.ok, `${tags} crossed the boundary`).toBe(false);
        expect(moves).toEqual([]);
        expect(existsSync(promotionReceiptPath(join(root, SUBJECT_REL)))).toBe(false);
      } finally { rmSync(root, { recursive: true, force: true }); }
    }
  });

  test("CONTROL: the gate reads RESIDENCY — already in canon, and held by no live bag, each refuse", async () => {
    // Already resident in the canon bag: a crossing never overwrites canon.
    const rootA = tree();
    try {
      const { seat, moves } = await seated({ residency: ledger([[LIVE_BAG, [SUBJECT_TITLE]], [CANON_BAG, [SUBJECT_TITLE]]]) });
      const r = await promoteCarrier(plan(rootA), seat);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.reason).toContain(CANON_BAG);
        expect(r.reason).not.toMatch(PATH_COMPLAINT);
      }
      expect(moves).toEqual([]);
    } finally { rmSync(rootA, { recursive: true, force: true }); }

    // Held by no live bag: a record that never stood on the live layer crosses nothing.
    const rootB = tree();
    try {
      const { seat, moves } = await seated({ residency: ledger([[LIVE_BAG, []]]) });
      const r = await promoteCarrier(plan(rootB), seat);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.reason).toContain(LIVE_BAG);
        expect(r.reason).not.toMatch(PATH_COMPLAINT);
      }
      expect(moves).toEqual([]);
    } finally { rmSync(rootB, { recursive: true, force: true }); }
  });

  test("the source bag DERIVES from residency when one bag holds the record — no flag owed", async () => {
    const root = tree();
    try {
      const { seat, moves } = await seated();
      const r = await promoteCarrier({ root, file: SUBJECT_REL, destBag: CANON_BAG }, seat);
      expect(r.ok, r.ok ? "" : r.reason).toBe(true);
      expect(moves).toEqual([{ title: SUBJECT_TITLE, fromBag: LIVE_BAG, toBag: CANON_BAG }]);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test("CONTROL: residency in TWO live bags refuses rather than picking one", async () => {
    const root = tree();
    const OTHER = "lar:///ha.ka.ba/bags/draft";
    try {
      const { seat, moves } = await seated({ residency: ledger([[LIVE_BAG, [SUBJECT_TITLE]], [OTHER, [SUBJECT_TITLE]]]) });
      const r = await promoteCarrier({ root, file: SUBJECT_REL, destBag: CANON_BAG }, seat);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toContain(OTHER);
      expect(moves).toEqual([]);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test("CONTROL: a carrier naming a `/docs/` segment carries no special standing — the path is not read", async () => {
    // The SAME carrier, declared at a canon-shaped address, promotes on residency alone. Under the path
    // gate this refused; under a residency gate the path says nothing either way.
    const root = mkdtempSync(join(tmpdir(), "lr-promote-api-"));
    try {
      mkdirSync(join(root, "bags/lares/ha.ka.ba/lares/api/pono"), { recursive: true });
      writeFileSync(join(root, RENAMED_REL), carrier(RENAMED_URI, RENAMED_REL, '"lifecycle/standing"'));
      const title = `lar:///${RENAMED_URI}`;
      const { seat, moves } = await seated({ residency: ledger([[LIVE_BAG, [title]]]) });
      const r = await promoteCarrier({ root, file: RENAMED_REL, fromBag: LIVE_BAG, destBag: CANON_BAG }, seat);
      expect(r.ok, r.ok ? "" : r.reason).toBe(true);
      expect(moves).toEqual([{ title, fromBag: LIVE_BAG, toBag: CANON_BAG }]);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
