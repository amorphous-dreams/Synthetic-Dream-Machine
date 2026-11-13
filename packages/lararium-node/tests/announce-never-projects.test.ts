/**
 * A realm-bag announce rests on the Nexus's announce board, a document no recipe mounts and no mirror names, so no
 * announce file lands under the crossroads mirror; and a record hand-placed in the crossroads mirror never folds as a
 * carriable book, since the carrier's fold reads the announce board alone.
 */
import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Repo, type AutomergeUrl } from "@automerge/automerge-repo";
import * as ed from "@noble/ed25519";
import {
  REALM_BAG_ANNOUNCE_PREFIX, CROSSROADS_DOC_URI, realmBagAnnounceOf, crossroadsDocUrl, hex, materializeSharedLarDoc,
  mutableLarRecord, publicRealmBooksFromDoc, realmAnnounceDocUrl, publicationDocUrl, whoBoardDocUrl, realmBagAnnounceKey, realmDocUrl,
  reAnnounceRealmBooksAtIsland, signRealmBagRegistration, writeRealmBagRegistration, writeOfferingAnnounce, PLUGIN_OFFERING_DOMAIN, type LarDoc,
} from "@lararium/mesh";
import { daemonDiskMirrors } from "../src/bag-paths.js";
import { LarDiskProjector } from "../src/disk-projector.js";
import { hermRealmShoreBooks } from "../src/bulb-read-face.js";

const ISLAND = "ee".repeat(32);
const REALM = `nexus-${"7a".repeat(32)}`;
const BOOK_DOC = "automerge:4NMNnkMhL8jXrdJ9jamS58PAVdXu";
const STEWARD = new Uint8Array(32).fill(9);
const repo = (): Repo => new Repo({ sharePolicy: async () => true });
const board = (r: Repo, url: AutomergeUrl) => materializeSharedLarDoc(r, url, "test:board");
const announceTitles = (doc: LarDoc | undefined): string[] =>
  Object.keys(doc?.tiddlers ?? {}).filter((t) => t.startsWith(REALM_BAG_ANNOUNCE_PREFIX));

const F = "123e4567-e89b-42d3-a456-426614174000";
const roots: string[] = [];
afterEach(() => { for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true }); });

/**
 * THE INSTRUMENT: stand a disk projector over every mirror the daemon composes (faceless, and a face with its canon and temp
 * layer), each mirrored bag reading its record off the document that bag binds (the crossroads bag binds the island's
 * crossroads document; a face's private bags bind documents no house writer touches), and flush EVERY title any board in
 * the Repo holds through EVERY mirror. A record reaches a file only where a mirrored bag's own document holds it: the
 * projector writes what rests in a mirrored layer, never what a title names. Answers the files written.
 */
async function projectEveryTitle(r: Repo, boards: readonly AutomergeUrl[], bagDocs: ReadonlyMap<string, AutomergeUrl>): Promise<string[]> {
  const root = mkdtempSync(join(tmpdir(), "lar-announce-mirror-"));
  roots.push(root);
  const mirrors = [
    ...daemonDiskMirrors({ projectionRoot: join(root, "faceless"), canonBags: join(root, "absent"), faceRelation: null }),
    ...daemonDiskMirrors({ projectionRoot: join(root, "faced"), canonBags: join(root, "absent"), faceRelation: F, canon: true, temp: true }),
  ];
  const held = async (bagId: string, uri: string) => {
    const url = bagDocs.get(bagId);
    return url ? Boolean((await board(r, url)).doc()?.tiddlers?.[uri]) : false;
  };
  const files: string[] = [];
  for (const mirror of mirrors) {
    const projector = new LarDiskProjector({
      mirrors: [mirror],
      // The render reads the record off THIS mirror's bag's document: a title its document never holds renders nothing.
      carrierFileFn: async (uri) => (await held(mirror.bagId, uri) ? { ext: ".tid", body: `title: ${uri}\n` } : null),
    });
    const flush = (projector as unknown as { flush: (b: string, u: string) => Promise<void> }).flush.bind(projector);
    for (const url of boards) for (const title of Object.keys((await board(r, url)).doc()?.tiddlers ?? {})) await flush(mirror.bagId, title);
  }
  const walk = (dir: string): void => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) walk(p); else files.push(p); } };
  walk(root);
  return files;
}

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

  test("a re-announce reaches no mirror the daemon composes; a record in the crossroads document does (the instrument reads)", async () => {
    const r = repo();
    const bag = "lar:///ha.ka.ba/books/the-offering";
    const rec = await publicBook(bag);
    (await board(r, realmDocUrl(REALM))).change((d) => writeRealmBagRegistration(d, rec));
    expect((await reAnnounceRealmBooksAtIsland({ repo: r, nexusPubkey: ISLAND, realmId: REALM })).landed).toBe(1);
    const bagDocs = new Map([[CROSSROADS_DOC_URI, crossroadsDocUrl(ISLAND)]]);
    const boards = [realmAnnounceDocUrl(ISLAND), crossroadsDocUrl(ISLAND), realmDocUrl(REALM)];
    expect(await projectEveryTitle(r, boards, bagDocs), "an announce reached a mirror").toEqual([]);
    // POSITIVE: a record resting in the mirrored crossroads document reaches its file through the same projector.
    const key = "lar:///ha.ka.ba/crossroads/notes/a-public-note";
    (await board(r, crossroadsDocUrl(ISLAND))).change((d) => { d.tiddlers[key] = mutableLarRecord(key, { text: "public" }, "test"); });
    const written = await projectEveryTitle(r, boards, bagDocs);
    expect(written.length, "the instrument wrote nothing for a record resting in the mirrored document").toBeGreaterThan(0);
    expect(written.every((p) => p.includes("crossroads"))).toBe(true);
  }, 30_000);

  test("an announce hand-placed in the crossroads mirror ingests as content and folds as no book", async () => {
    const r = repo();
    const ghost = "lar:///ha.ka.ba/books/hand-placed";
    const key = realmBagAnnounceKey(ghost);
    const text = JSON.stringify(realmBagAnnounceOf(await publicBook(ghost)));
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
  test("an offering announce on the publication board reaches no mirror the daemon composes", async () => {
    const url = publicationDocUrl(ISLAND);
    for (const other of [crossroadsDocUrl(ISLAND), realmAnnounceDocUrl(ISLAND), whoBoardDocUrl(ISLAND)]) expect(url).not.toBe(other);
    const r = repo();
    const offering = { kind: PLUGIN_OFFERING_DOMAIN, offeror: "ab".repeat(32), pluginsCid: "bafy-plugins", blobs: [], sig: "00" };
    (await board(r, url)).change((d) => writeOfferingAnnounce(d, offering as never));
    expect(Object.keys((await board(r, url)).doc()?.tiddlers ?? {}).length, "the offering announce landed on its board").toBe(1);
    const bagDocs = new Map([[CROSSROADS_DOC_URI, crossroadsDocUrl(ISLAND)]]);
    expect(await projectEveryTitle(r, [url, crossroadsDocUrl(ISLAND)], bagDocs), "an offering announce reached a mirror").toEqual([]);
  }, 30_000);
});
