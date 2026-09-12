/**
 * herm-follows-realm-public.test.ts — THE HERM FOLLOWS THE REALM'S PUBLIC REGISTRATIONS (the 2026-09-12
 * ruling: the realm's own registration decides which documents cross, and the PUBLIC tier rides the Herm
 * by hash).
 *
 * The measured seam (`tests/e2e/herm-reshares-public-blob.e2e.test.ts`): the Herm's shore read its OWN
 * crossroads board alone, so a pointer a fleet peer lands in a PUBLIC bag never reached it and `/cas/<cid>`
 * drew 404 whether the peer stood or went dark. Here the shore also reads, for each realm it serves, the
 * pointers the realm's PUBLIC-tier registrations name.
 *
 * CONTROLS: a pointer from a CONTRACT-tier registration draws the 404 the bulb answers, byte-identical to
 * the one an unnamed cid draws; a shore with no realm lane answers exactly as it answered before.
 */
import { describe, test, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256HexBytesSync, utf8Bytes, type CasReferenceEntry, type CapTier } from "@lararium/mesh";
import { publicCasShore } from "../src/bulb-read-face.js";
import { writeCasEntriesFs } from "../src/node-cas.js";

const HERM_CROSSROADS = "lar:///ha.ka.ba/bags/crossroads";
const REALM_PUBLIC_BAG = "lar:///ha.ka.ba/bags/lares";
const REALM_CONTRACT_BAG = "lar:///ha.ka.ba/bags/ledger";
const pointer = (bagId: string, title: string, cid: string): CasReferenceEntry =>
  ({ title, bagId, record: { tiddler: { title, _is_skinny: "yes", textCid: cid } } });

describe("the Herm's shore follows the realm's PUBLIC registrations, never its own crossroads alone", () => {
  test("a pointer in a realm-registered PUBLIC bag reads public; a CONTRACT-tier one does not", async () => {
    const storageDir = mkdtempSync(join(tmpdir(), "lr-herm-realm-"));
    try {
      const casDir = join(storageDir, "cas");
      const likeness = utf8Bytes("a public png a fleet peer staged"); const likenessCid = sha256HexBytesSync(likeness);
      const ledger   = utf8Bytes("the ford's own book");              const ledgerCid   = sha256HexBytesSync(ledger);
      const stray    = utf8Bytes("bytes no pointer names");           const strayCid    = sha256HexBytesSync(stray);
      writeCasEntriesFs([{ cid: likenessCid, bytes: likeness }, { cid: ledgerCid, bytes: ledger }, { cid: strayCid, bytes: stray }], casDir);

      // The Herm's own crossroads carries nothing about either body — the whole point of the seam.
      const shore = publicCasShore({
        casDir,
        references: () => [],
        bagTier: (bagUrl) => (bagUrl === HERM_CROSSROADS ? "public" as CapTier : null),
        // THE REALM LANE: for each realm this Herm serves, the pointers its registrations name, each carrying
        // the tier the registration declared.
        realmReferences: async () => [
          { bagUri: REALM_PUBLIC_BAG,   readTier: "public"   as CapTier, entries: [pointer(REALM_PUBLIC_BAG, "lar:///t.w.h/photo", likenessCid)] },
          { bagUri: REALM_CONTRACT_BAG, readTier: "contract" as CapTier, entries: [pointer(REALM_CONTRACT_BAG, "lar:///t.w.h/ledger", ledgerCid)] },
        ],
      });

      expect(await shore.isPublic(likenessCid)).toBe(true);
      expect(shore.read(likenessCid)).not.toBeNull();
      // CONTROL: the contract-tier book and the unnamed body both read NOT public — one withholding, one shape.
      expect(await shore.isPublic(ledgerCid)).toBe(false);
      expect(await shore.isPublic(strayCid)).toBe(false);
    } finally { rmSync(storageDir, { recursive: true, force: true }); }
  });

  test("CONTROL: a shore with no realm lane answers exactly as it answered before", async () => {
    const storageDir = mkdtempSync(join(tmpdir(), "lr-herm-realm-control-"));
    try {
      const casDir = join(storageDir, "cas");
      const own = utf8Bytes("a body the Herm's own crossroads names"); const ownCid = sha256HexBytesSync(own);
      const far = utf8Bytes("a body only a realm names");              const farCid = sha256HexBytesSync(far);
      writeCasEntriesFs([{ cid: ownCid, bytes: own }, { cid: farCid, bytes: far }], casDir);
      const shore = publicCasShore({
        casDir,
        references: () => [pointer(HERM_CROSSROADS, "lar:///t.w.h/own", ownCid)],
        bagTier: (bagUrl) => (bagUrl === HERM_CROSSROADS ? "public" as CapTier : null),
      });
      expect(await shore.isPublic(ownCid)).toBe(true);
      expect(await shore.isPublic(farCid)).toBe(false);
    } finally { rmSync(storageDir, { recursive: true, force: true }); }
  });
});
