/**
 * hearth-canon — what an admitted leaf takes from ITS OWN HEARTH beyond the public boards.
 *
 * A leaf that a hearth admitted wears that hearth's face, and the wiki it opens there reads the hearth's
 * base canon: the `@lares` and `@lararium` documents. The carried admit NAMES those documents by url
 * (`hearthCanonDocs`), the way it names the persona plane and the hearth's door: a pointer per relation,
 * carried by the act that makes the relation. The cross-operator gate federates the public boards alone, so
 * without the names a carrier the hearth holds never reaches the page.
 *
 * The widening rides the gate, deny-by-default:
 *   - it stands only for a crossing to the hearth whose admit this vessel carries (`isOwnHearthCrossing`):
 *     the pinned gate key equals the key the admit named, and the vessel holds the signed device edge;
 *   - it opens exactly the documents the admit names, and only under the canon titles;
 *   - the oracle plane stays behind the gate with every other private plane (the daemon bag, the catalog,
 *     the slot documents). Every vessel holds the oracle under ONE derived document id, and a hearth boots
 *     from its own copy; a leaf that synced it would merge its writes into the registry its hearth reads.
 *
 * The leaf mounts by its OWN oracle replica, as every vessel does: `seatHearthCanon` writes the admitted
 * pointers there, and that replica never leaves the leaf.
 *
 * Meme: lar:///ha.ka.ba/lararium/browser/hearth-canon
 */
import { interpretAsDocumentId, isValidAutomergeUrl, type AutomergeUrl, type DocumentId, type PeerId } from "@automerge/automerge-repo";
import { LARES_DOC_URI, LARARIUM_DOC_URI, mutableLarRecord, tiddlerText, type FederationGate, type LarDoc } from "@lararium/mesh";

/** The canon titles an admit may name: the bags a leaf's wiki reads from its hearth. */
export const HEARTH_CANON_TITLES: readonly string[] = [LARES_DOC_URI, LARARIUM_DOC_URI];

/** The canon documents an admit names: canon title → document url. */
export type HearthCanonDocs = Readonly<Record<string, string>>;

/**
 * True when the pinned relay names the hearth that admitted this vessel. A vessel that founded its own face
 * carries no hearth key and reads false; so does an admitted vessel dialing any other gate.
 */
export function isOwnHearthCrossing(at: {
  readonly pinnedGatePubKey: string | null | undefined;
  readonly hearthGatePubKey: string | null | undefined;
  readonly holdsDeviceEdge:  boolean;
}): boolean {
  if (!at.holdsDeviceEdge || !at.pinnedGatePubKey || !at.hearthGatePubKey) return false;
  return at.pinnedGatePubKey.toLowerCase() === at.hearthGatePubKey.toLowerCase();
}

/**
 * What a carried admit's `hearthCanonDocs` may name, read as DATA: the canon titles alone, each with a
 * well-formed document url. Any other title, a torn url or a non-string falls out, so a carriage names
 * neither a private plane nor a key of the leaf's oracle beyond the two canon pointers.
 */
export function admittedCanonDocs(carried: unknown): HearthCanonDocs {
  const named: Record<string, string> = {};
  if (!carried || typeof carried !== "object") return named;
  for (const title of HEARTH_CANON_TITLES) {
    const url = (carried as Record<string, unknown>)[title];
    if (typeof url === "string" && isValidAutomergeUrl(url)) named[title] = url;
  }
  return named;
}

/** The named canon documents, by document id. */
export function hearthCanonDocIds(named: HearthCanonDocs): ReadonlySet<DocumentId> {
  const ids = new Set<DocumentId>();
  for (const url of Object.values(admittedCanonDocs(named))) ids.add(interpretAsDocumentId(url as AutomergeUrl) as DocumentId);
  return ids;
}

/** The own-hearth gate: the outer gate's verdict, widened by exactly the documents the admit names. */
export class HearthCanonGate implements FederationGate {
  readonly #outer: FederationGate;
  readonly #canon: ReadonlySet<DocumentId>;

  constructor(outer: FederationGate, named: HearthCanonDocs) {
    this.#outer = outer;
    this.#canon = hearthCanonDocIds(named);
  }

  mayFederate(documentId: DocumentId, peerId?: PeerId): boolean | Promise<boolean> {
    if (this.#canon.has(documentId)) return true;
    return this.#outer.mayFederate(documentId, peerId);
  }
}

/** The slice of an oracle handle the seating reads and writes. */
export interface OracleReplica {
  doc(): LarDoc | null | undefined;
  change(fn: (doc: LarDoc) => void): void;
}

/**
 * Seat the admitted canon on this vessel's OWN oracle replica: each named title points at the document the
 * admit named. The keel and every island resolve `@lares` and `@lararium` off that replica, so the leaf's
 * wiki mounts the hearth's canon. One change carries every pointer that differs; a replica that already
 * names them takes no write.
 */
export function seatHearthCanon(oracle: OracleReplica, named: HearthCanonDocs): void {
  const owed = Object.entries(admittedCanonDocs(named))
    .filter(([title, url]) => tiddlerText(oracle.doc()?.tiddlers?.[title]) !== url);
  if (owed.length === 0) return;
  oracle.change((doc) => {
    for (const [title, url] of owed) doc.tiddlers[title] = mutableLarRecord(title, { text: url }, "hearth-canon");
  });
}
