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
import { announcedRealmBooks, hermRealmShoreBooks, publicCasShore } from "../src/bulb-read-face.js";
import { crossroadsAnnounceOf, writeRealmBagAnnounce, signRealmBagRegistration, type LarDoc } from "@lararium/mesh";
import * as ed from "@noble/ed25519";
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

// ── THE CARRIER FOLLOWS THE ANNOUNCES (the 2026-09-13 ruling) ────────────────────────────────────
//
// A Herm holds no charter and folds NO realm registration — `nexus realm-bags` on the Herm read `bags: []` in
// the measured fleet, so the realm lane above was unreachable by the very vessel it was built for. The public
// plane closes the circle: a PUBLIC-tier announce carries the book's doc url, and the Herm's own @crossroads
// replica already federates.
describe("the Herm folds its shore off the @crossroads announces, holding no charter and no realm doc", () => {
  const hex = (b: Uint8Array): string => Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
  const SEED = new Uint8Array(32).fill(7);
  const PUBLIC_BAG = "lar:///ha.ka.ba/bags/lares";
  const CONTRACT_BAG = "lar:///ha.ka.ba/bags/ledger";
  const emptyDoc = (): LarDoc => ({ tiddlers: {} }) as LarDoc;

  async function steward() {
    return { signer: hex(await ed.getPublicKeyAsync(SEED)), sign: async (b: Uint8Array) => hex(await ed.signAsync(b, SEED)) };
  }

  test("a PUBLIC announce names a book the carrier replicates; a CONTRACT one names none (CONTROL)", async () => {
    const PUB_DOC = "automerge:2rEvJcsJjTeS5nDXbyEttkWa6jJa";
    const CON_DOC = "automerge:3EuA8kB7XEZ5MP1oBBKdxzoLzXMn";
    const cross = emptyDoc();
    writeRealmBagAnnounce(cross, await signRealmBagRegistration(
      { realmId: "r", bagUri: PUBLIC_BAG, docUrl: PUB_DOC, readTier: "public" }, [await steward()]));
    writeRealmBagAnnounce(cross, await signRealmBagRegistration(
      { realmId: "r", bagUri: CONTRACT_BAG, docUrl: CON_DOC, readTier: "contract" }, [await steward()]));

    const asked: string[] = [];
    const books = await announcedRealmBooks({
      crossroadsDoc: () => cross,
      findBook: async (url) => {
        asked.push(url);
        return url === PUB_DOC
          ? { tiddlers: { "lar:///t.w.h/photo": { tiddler: { title: "lar:///t.w.h/photo", textCid: "cid-1" } } } } as unknown as LarDoc
          : null;
      },
    });
    expect(asked).toEqual([PUB_DOC]);                            // CONTROL: the contract book is never even asked for
    expect(books.map((b) => b.bagUri)).toEqual([PUBLIC_BAG]);
    expect(books[0]!.readTier).toBe("public");
    expect([...books[0]!.entries].map((e) => e.title)).toEqual(["lar:///t.w.h/photo"]);
  });

  test("CONTROL: a book the carrier never replicated answers nothing, and an empty board folds empty", async () => {
    const cross = emptyDoc();
    writeRealmBagAnnounce(cross, await signRealmBagRegistration(
      { realmId: "r", bagUri: PUBLIC_BAG, docUrl: "automerge:2rEvJcsJjTeS5nDXbyEttkWa6jJa", readTier: "public" }, [await steward()]));
    expect(await announcedRealmBooks({ crossroadsDoc: () => cross, findBook: async () => null })).toEqual([]);
    expect(await announcedRealmBooks({ crossroadsDoc: () => emptyDoc(), findBook: async () => null })).toEqual([]);
    expect(await announcedRealmBooks({ crossroadsDoc: () => null, findBook: async () => null })).toEqual([]);
  });

  test("CONTROL: the announce a CONTRACT registration projects still carries no doc url", async () => {
    const rec = await signRealmBagRegistration(
      { realmId: "r", bagUri: CONTRACT_BAG, docUrl: "automerge:3EuA8kB7XEZ5MP1oBBKdxzoLzXMn", readTier: "contract" }, [await steward()]);
    expect(crossroadsAnnounceOf(rec)).not.toHaveProperty("docUrl");
  });

  // ── THE WELD (`hermRealmShoreBooks`) — the lane the Herm vessel actually wires ──────────────────
  //
  // `announcedRealmBooks` folding correctly buys nothing until the vessel's `realmReferences` READS it beside
  // the registration road. This is that seam: the one function `openNodeHerm` hands `publicCasShore`.
  describe("the vessel's realm lane reads BOTH roads, and the registration wins the collision", () => {
    const PUB_DOC = "automerge:2rEvJcsJjTeS5nDXbyEttkWa6jJa";
    const CON_DOC = "automerge:3EuA8kB7XEZ5MP1oBBKdxzoLzXMn";
    const bookDoc = (title: string): LarDoc =>
      ({ tiddlers: { [title]: { tiddler: { title, textCid: "cid-1" } } } }) as unknown as LarDoc;

    async function boardWith(rows: ReadonlyArray<{ bagUri: string; docUrl: string; readTier: CapTier }>): Promise<LarDoc> {
      const cross = emptyDoc();
      for (const r of rows) {
        writeRealmBagAnnounce(cross, await signRealmBagRegistration({ realmId: "r", ...r }, [await steward()]));
      }
      return cross;
    }

    test("a Herm standing in NO realm serves the PUBLIC book off the board, and only that one", async () => {
      const cross = await boardWith([
        { bagUri: PUBLIC_BAG,   docUrl: PUB_DOC, readTier: "public"   as CapTier },
        { bagUri: CONTRACT_BAG, docUrl: CON_DOC, readTier: "contract" as CapTier },
      ]);
      const books = await hermRealmShoreBooks({
        realmStanding: async () => new Map(),            // a Herm holds no charter — the registration road is EMPTY
        findDoc:       async (url) => (url === PUB_DOC ? bookDoc("lar:///t.w.h/photo") : bookDoc("lar:///t.w.h/ledger")),
        crossroadsDoc: () => cross,
      });
      expect(books.map((b) => b.bagUri)).toEqual([PUBLIC_BAG]);
      expect(books[0]!.readTier).toBe("public");
      expect([...books[0]!.entries].map((e) => e.title)).toEqual(["lar:///t.w.h/photo"]);
    });

    test("CONTROL: a board carrying only a CONTRACT announce serves ZERO books, as an empty board does", async () => {
      const cross = await boardWith([{ bagUri: CONTRACT_BAG, docUrl: CON_DOC, readTier: "contract" as CapTier }]);
      const zero = { realmStanding: async () => new Map(), findDoc: async () => bookDoc("lar:///t.w.h/ledger") };
      expect(await hermRealmShoreBooks({ ...zero, crossroadsDoc: () => cross })).toEqual([]);
      expect(await hermRealmShoreBooks({ ...zero, crossroadsDoc: () => emptyDoc() })).toEqual([]);
    });

    test("CONTROL: a stale PUBLIC announce never re-tiers a book the registration road declares CONTRACT", async () => {
      const cross = await boardWith([{ bagUri: CONTRACT_BAG, docUrl: CON_DOC, readTier: "public" as CapTier }]);
      const books = await hermRealmShoreBooks({
        realmStanding: async () => new Map([[CONTRACT_BAG, { bagUri: CONTRACT_BAG, docUrl: CON_DOC, readTier: "contract" as CapTier }]]),
        findDoc:       async () => bookDoc("lar:///t.w.h/ledger"),
        crossroadsDoc: () => cross,
      });
      expect(books.map((b) => [b.bagUri, b.readTier])).toEqual([[CONTRACT_BAG, "contract"]]);
    });
  });
});
