/**
 * floor-accept-home — THE PLACE'S FLOOR ACCEPT HOME: one floor-filed document, sealed under the floor's rest key, holding one
 * accept per Nexus (`floor-accept`). A hand writes it; a seat reads it.
 *
 * WHERE IT RESTS. The place's daemon document names it under `<daemon bag>/floor/accept` (`FLOOR_ACCEPT_HOME_TITLE`), a row
 * of the floor's registry: its text carries the document's `automerge:` url and nothing of its content. The device table files
 * the document as the floor's (`deviceDaemonDocs.readFloor`), the held homes seal it under the floor's rest key, and the share
 * verdict keeps it on the vessel (`floorOnlyDocIds`). No recipe mounts it and no mirror names it. The secret home's key never
 * opens it, and it needs no face: a faceless, unlocked place accepts (operator ruling, kaula Q2: the accept home seals under
 * the place).
 *
 * THE GATE NAMES THE FLOOR KEY. Every stand reads the floor key's answer first and refuses by name where it does not stand
 * (`floor-unavailable: vessel-locked`, cure `lares vault unlock`; `floor-unavailable: floor-unkeyed`, a herm, which carries and
 * accepts nothing). ENROLLED BEFORE ITS FIRST BYTE: a mint maps the fresh id onto the held homes under the floor-accept bag
 * first, and only then does the document's seed move; the daemon document names it after. The first name holds.
 *
 * A Repo that binds no sealed rest (a suite's storage-less Repo) stands the home in memory, where nothing rests at all.
 *
 * Meme: lar:///ha.ka.ba/lararium/api/residency-tiers#/floor-accept
 */
import type { AutomergeUrl, DocHandle, DocumentId, Repo } from "@automerge/automerge-repo";
import { emptyLarDoc, tiddlerText, type LarDoc } from "./base-doc.js";
import { ownEntry } from "./stored-value.js";
import { storedLarRecord } from "./stored-record.js";
import { FLOOR_ACCEPT_BAG } from "./lar-uris.js";
import { FLOOR_ACCEPT_HOME_TITLE } from "./device-daemon-docs.js";
import { FloorUnavailable, type FloorKeyRefusal } from "./floor-registry.js";
import { documentIdOfUrl } from "./sealed-rest.js";
import { heldHomeSeed, mintVesselDocumentId, secretHomeRestOf } from "./secret-home.js";
import type { FloorAcceptHome } from "./floor-accept.js";

/** The floor key's answer for this composition: it stands, or a refusal names why it does not. */
export type FloorKeyReading = "stands" | FloorKeyRefusal;

/** The accept home's url as the daemon document names it, or null. */
export function floorAcceptHomeUrlOf(daemonDoc: LarDoc | null | undefined): string | null {
  const url = tiddlerText(ownEntry(daemonDoc?.tiddlers, FLOOR_ACCEPT_HOME_TITLE));
  return documentIdOfUrl(url) ? url : null;
}

/** Name the accept home in the daemon document; the first name holds, and the name it holds answers. */
function nameFloorAcceptHome(daemonHandle: DocHandle<LarDoc>, url: string): string {
  let landed = url;
  daemonHandle.change((doc) => {
    const prior = floorAcceptHomeUrlOf(doc);
    if (prior) { landed = prior; return; }
    doc.tiddlers[FLOOR_ACCEPT_HOME_TITLE] = storedLarRecord(FLOOR_ACCEPT_HOME_TITLE, { text: url, kind: "oracle", "face-reach": "vessel-only" }, "floor-accept");
  });
  return landed;
}

/**
 * STAND the place's accept home. Refuses `floor-unavailable` by name where the floor key does not stand. Where the daemon
 * document names none: `mint` (a hand's accept, adopt or rehome) mints one enrolled before its first byte and names it; a
 * read answers null, and the reader stands on genesis.
 */
export async function standFloorAcceptHome(repo: Repo, daemonHandle: DocHandle<LarDoc>, opts: {
  readonly mint:     boolean;
  readonly floorKey: () => FloorKeyReading;
}): Promise<DocHandle<LarDoc> | null> {
  const reading = opts.floorKey();
  if (reading !== "stands") throw new FloorUnavailable(reading);
  const rest = secretHomeRestOf(repo);
  const named = floorAcceptHomeUrlOf(daemonHandle.doc());
  if (named !== null) {
    if (rest !== null && !rest.enrollBeside(documentIdOfUrl(named)!, FLOOR_ACCEPT_BAG)) throw new FloorUnavailable("vessel-locked");
    return repo.find<LarDoc>(named as AutomergeUrl);
  }
  if (!opts.mint) return null;
  if (rest === null) {
    const handle = repo.create<LarDoc>(emptyLarDoc());
    const landed = nameFloorAcceptHome(daemonHandle, handle.url);
    return landed === handle.url ? handle : repo.find<LarDoc>(landed as AutomergeUrl);
  }
  const id = mintVesselDocumentId();
  // Mapped under the floor's rest key before the seed's first byte moves; a key that will not answer mints nothing.
  if (!rest.enrollBeside(id, FLOOR_ACCEPT_BAG)) throw new FloorUnavailable("vessel-locked");
  const handle = repo.import<LarDoc>(heldHomeSeed(id), { docId: id as DocumentId });
  const landed = nameFloorAcceptHome(daemonHandle, `automerge:${id}`);
  return landed === `automerge:${id}` ? handle : repo.find<LarDoc>(landed as AutomergeUrl);
}

/**
 * READ the accept home for a mount: the home, a refusal by the floor key's name (the carried showing reads then), or null
 * where no home stands named yet (genesis). Never mints, never throws.
 */
export async function readFloorAcceptHome(repo: Repo, daemonHandle: () => Promise<DocHandle<LarDoc>> | DocHandle<LarDoc>, floorKey: () => FloorKeyReading):
  Promise<DocHandle<LarDoc> | { readonly unavailable: FloorKeyRefusal } | null> {
  const reading = floorKey();
  if (reading !== "stands") return { unavailable: reading };
  try { return await standFloorAcceptHome(repo, await daemonHandle(), { mint: false, floorKey: () => reading }); }
  catch (e) { return e instanceof FloorUnavailable ? { unavailable: e.refusal } : null; }
}

/**
 * A HOME MINTED ONLY BY A LANDED WRITE: where no accept home stands named, a hand's act runs over an in-memory draft and the
 * home mints (`mint`, enrolled under the floor key before its first byte) only where the act wrote, replaying the writes there.
 * A refusal or a replay lands nothing: no home mints and the daemon document stays unmoved. Both hosts bind it.
 */
export function mintOnWrite(standing: FloorAcceptHome | null, mint: () => Promise<FloorAcceptHome>): { readonly home: FloorAcceptHome; land(): Promise<void> } {
  if (standing !== null) return { home: standing, land: async () => {} };
  const draft = emptyLarDoc();
  const pending: Array<(d: LarDoc) => void> = [];
  return {
    home: { doc: () => draft, change: (fn) => { fn(draft); pending.push(fn); } },
    land: async () => {
      if (pending.length === 0) return;
      const home = await mint();
      home.change((d) => { for (const fn of pending) fn(d); });
    },
  };
}
