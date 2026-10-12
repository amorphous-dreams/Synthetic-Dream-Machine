/**
 * hearth-canon — what an admitted leaf takes from ITS OWN HEARTH beyond the public boards.
 *
 * A leaf that a hearth admitted wears that hearth's face, and the wiki it opens there reads the hearth's
 * base canon: the oracle plane (one deterministic address every vessel of the island shares) and the two
 * canon documents that plane names, `@lares` and `@lararium`. The cross-operator gate federates the public
 * boards alone, so under it the oracle's pointers never arrive, the leaf mints a blank wiki document of its
 * own, and a carrier the hearth holds never reaches the page.
 *
 * The widening rides the gate, deny-by-default as before:
 *   - it stands only for a crossing to the hearth whose admit this vessel carries (`isOwnHearthCrossing`):
 *     the pinned gate key equals the key the admit named, and the vessel holds the signed device edge;
 *   - it opens exactly the oracle plane and the canon documents the oracle NAMES, read live at each verdict;
 *   - every private plane (the daemon bag, the catalog, the slot documents) stays behind the gate.
 *
 * Meme: lar:///ha.ka.ba/lararium/browser/hearth-canon
 */
import { interpretAsDocumentId, type AutomergeUrl, type DocumentId, type PeerId } from "@automerge/automerge-repo";
import { LARES_DOC_URI, LARARIUM_DOC_URI, oracleGenesisDocUrl, tiddlerText, type FederationGate, type LarDoc } from "@lararium/mesh";

/** The oracle titles whose documents count as the hearth's base canon. */
export const HEARTH_CANON_TITLES: readonly string[] = [LARES_DOC_URI, LARARIUM_DOC_URI];

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

function documentIdOf(url: string | null | undefined): DocumentId | null {
  if (!url || !url.startsWith("automerge:")) return null;
  try { return interpretAsDocumentId(url as AutomergeUrl) as DocumentId; } catch { return null; }
}

/** The canon documents an oracle doc names, by document id. A torn or absent pointer names nothing. */
export function hearthCanonDocIds(oracle: LarDoc | null | undefined): ReadonlySet<DocumentId> {
  const ids = new Set<DocumentId>();
  for (const title of HEARTH_CANON_TITLES) {
    const id = documentIdOf(tiddlerText(oracle?.tiddlers?.[title]));
    if (id) ids.add(id);
  }
  return ids;
}

/** The hearth's `@lares` document as the oracle names it, or null while the pointer has not arrived. */
export function hearthWikiPointer(oracle: LarDoc | null | undefined): string | null {
  const url = tiddlerText(oracle?.tiddlers?.[LARES_DOC_URI]) ?? null;
  return documentIdOf(url) ? url : null;
}

/**
 * The own-hearth gate: the outer gate's verdict, widened by the oracle plane and the canon it names.
 * `oracle` answers the oracle doc as this vessel holds it now; the canon set follows it at each verdict.
 */
export class HearthCanonGate implements FederationGate {
  readonly #outer:  FederationGate;
  readonly #oracle: () => LarDoc | null | undefined;
  readonly #oracleId = interpretAsDocumentId(oracleGenesisDocUrl()) as DocumentId;

  constructor(outer: FederationGate, oracle: () => LarDoc | null | undefined) {
    this.#outer = outer;
    this.#oracle = oracle;
  }

  mayFederate(documentId: DocumentId, peerId?: PeerId): boolean | Promise<boolean> {
    if (documentId === this.#oracleId) return true;
    if (hearthCanonDocIds(this.#oracle()).has(documentId)) return true;
    return this.#outer.mayFederate(documentId, peerId);
  }
}

/** The minimal handle surface the pointer wait reads. */
export interface OracleWatch {
  doc(): LarDoc | null | undefined;
  on(event: "change", listener: () => void): unknown;
  off(event: "change", listener: () => void): unknown;
}

export type HearthCanonArrival =
  | { readonly arrived: true;  readonly wikiDocUrl: string }
  | { readonly arrived: false; readonly why: "bound-spent" | "crossing-closed" };

/**
 * Wait for the hearth's `@lares` pointer to stand on this vessel's oracle doc. It resolves on the change
 * that carries the pointer; `crossingClosed` (the relay refused or dropped) ends the wait at once, and
 * `boundMs` only bounds it. An absent pointer stays an honest answer: the caller mounts without it and says so.
 */
export function awaitHearthCanon(
  oracle: OracleWatch,
  opts: { readonly boundMs: number; readonly crossingClosed?: (onClosed: () => void) => () => void },
): Promise<HearthCanonArrival> {
  const standing = hearthWikiPointer(oracle.doc());
  if (standing) return Promise.resolve({ arrived: true, wikiDocUrl: standing });
  return new Promise<HearthCanonArrival>((resolve) => {
    let settled = false;
    let unwatchClose: (() => void) | undefined;
    const finish = (answer: HearthCanonArrival): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      oracle.off("change", onChange);
      unwatchClose?.();
      resolve(answer);
    };
    const onChange = (): void => {
      const url = hearthWikiPointer(oracle.doc());
      if (url) finish({ arrived: true, wikiDocUrl: url });
    };
    const timer = setTimeout(() => finish({ arrived: false, why: "bound-spent" }), opts.boundMs);
    oracle.on("change", onChange);
    unwatchClose = opts.crossingClosed?.(() => finish({ arrived: false, why: "crossing-closed" }));
    onChange();   // a pointer that landed between the first read and the subscription
  });
}
