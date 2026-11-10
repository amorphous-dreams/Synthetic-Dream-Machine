/**
 * A realm-bag announce rests on the Nexus's announce board, a document no recipe mounts and no mirror names, so no
 * announce file lands under the crossroads mirror; and a record hand-placed in the crossroads mirror never folds as a
 * carriable book, since the carrier's fold reads the announce board alone.
 */
import { describe, expect, test } from "vitest";
import { Repo, type AutomergeUrl } from "@automerge/automerge-repo";
import * as ed from "@noble/ed25519";
import {
  REALM_BAG_ANNOUNCE_PREFIX, CROSSROADS_DOC_URI, crossroadsAnnounceOf, crossroadsDocUrl, hex, materializeSharedLarDoc,
  mutableLarRecord, publicRealmBooksFromDoc, realmAnnounceDocUrl, publicationDocUrl, whoBoardDocUrl, realmBagAnnounceKey, realmDocUrl,
  reAnnounceRealmBooksAtIsland, signRealmBagRegistration, writeRealmBagRegistration, type LarDoc,
} from "@lararium/mesh";
import { daemonDiskMirrors } from "../src/bag-paths.js";
import { hermRealmShoreBooks } from "../src/bulb-read-face.js";

const ISLAND = "ee".repeat(32);
const REALM = `nexus-${"7a".repeat(32)}`;
const BOOK_DOC = "automerge:4NMNnkMhL8jXrdJ9jamS58PAVdXu";
const STEWARD = new Uint8Array(32).fill(9);
const repo = (): Repo => new Repo({ sharePolicy: async () => true });
const board = (r: Repo, url: AutomergeUrl) => materializeSharedLarDoc(r, url, "test:board");
const announceTitles = (doc: LarDoc | undefined): string[] =>
  Object.keys(doc?.tiddlers ?? {}).filter((t) => t.startsWith(REALM_BAG_ANNOUNCE_PREFIX));

async function publicBook(bagUri: string) {
  const nym = hex(await ed.getPublicKeyAsync(STEWARD));
  return signRealmBagRegistration(
    { realmId: REALM, bagUri, docUrl: BOOK_DOC, readTier: "public" },
    [{ signer: nym, sign: (b) => ed.signAsync(b, STEWARD).then(hex) }],
  );
}

describe("a realm announce rests where no mirror reaches", () => {
  test("the re-announce lands on the announce board and writes nothing into the mirrored crossroads document", async () => {
    const r = repo();
    const bag = "lar:///ha.ka.ba/books/the-offering";
    const rec = await publicBook(bag);
    (await board(r, realmDocUrl(REALM))).change((d) => writeRealmBagRegistration(d, rec));

    const act = await reAnnounceRealmBooksAtIsland({ repo: r, nexusPubkey: ISLAND, realmId: REALM });
    expect(act.landed).toBe(1);
    expect(publicRealmBooksFromDoc((await board(r, realmAnnounceDocUrl(ISLAND))).doc())).toEqual([{ bagUri: bag, docUrl: BOOK_DOC }]);
    expect(announceTitles((await board(r, crossroadsDocUrl(ISLAND))).doc()), "the crossroads mirror would write it to disk").toEqual([]);
  }, 30_000);

  test("the announce board is no bag: no daemon mirror names it, and it stands apart from the crossroads document", () => {
    expect(realmAnnounceDocUrl(ISLAND)).not.toBe(crossroadsDocUrl(ISLAND));
    const mirrors = daemonDiskMirrors({ projectionRoot: "/w", canonBags: "/w-absent", faceRelation: null });
    expect(mirrors.map((m) => m.bagId)).toEqual([CROSSROADS_DOC_URI]);
  });

  test("an announce hand-placed in the crossroads mirror ingests as content and folds as no book", async () => {
    const r = repo();
    const ghost = "lar:///ha.ka.ba/books/hand-placed";
    const key = realmBagAnnounceKey(ghost);
    const text = JSON.stringify(crossroadsAnnounceOf(await publicBook(ghost)));
    (await board(r, crossroadsDocUrl(ISLAND))).change((d) => { d.tiddlers[key] = mutableLarRecord(key, { text }, "test:hand-placed"); });
    const announceBoard = await board(r, realmAnnounceDocUrl(ISLAND));
    const books = await hermRealmShoreBooks({
      realmStanding: async () => new Map(),
      findDoc: async () => ({ tiddlers: {} } as unknown as LarDoc),
      announceDoc: () => announceBoard.doc(),
    });
    expect(books).toEqual([]);
  }, 30_000);
});

describe("a Nexus publication rests where no mirror reaches", () => {
  test("the publication board is no bag: no daemon mirror names it, and it stands apart from every other board", () => {
    const url = publicationDocUrl(ISLAND);
    for (const other of [crossroadsDocUrl(ISLAND), realmAnnounceDocUrl(ISLAND), whoBoardDocUrl(ISLAND)]) expect(url).not.toBe(other);
    const mirrors = daemonDiskMirrors({ projectionRoot: "/w", canonBags: "/w-absent", faceRelation: null });
    expect(mirrors.map((m) => m.bagId)).toEqual([CROSSROADS_DOC_URI]);
  });
});
