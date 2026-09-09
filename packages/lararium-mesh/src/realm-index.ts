/**
 * realm-index — a face's own memory of WHICH substrate carries each realm it holds.
 *
 * A realm founding returns a CabalRealm carrying its `substrateUrl`; this keeps that mapping so a later
 * verb handed only a realm id can open the board. RESOLUTION-ONLY, never discovery: it opens a doc the
 * holder already keyed and answers null for any id it lacks — so it names no realm the holder holds no key
 * to, standing clear of the roster 'a roster IS a global now' forbids. FACE-SCOPED: keyed under a persona
 * tag, so a compromise yields one face's realms, not a vessel's whole multitude (the persona planes' own
 * blast radius, exactly as a vessel-global @circles would correlate where a face-scoped one does not).
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/cabal-realm-nexus-planes · persona-scoped-face-planes
 */
import { tiddlerText } from "./base-doc.js";
import type { LarDoc } from "./base-doc.js";
import type { CabalRealm } from "./cabal-realm.js";

/** The per-face index root — a plain local key (no `lar:///`, no board root), since the index stays a
 *  holder-local resolution table rather than anything that travels a board. */
const REALM_INDEX_ROOT = "realm-index/" as const;

/** The tiddler prefix a face's realm-substrate slots ride under. */
export function realmIndexPrefix(personaTag: string): string {
  return `${REALM_INDEX_ROOT}${encodeURIComponent(personaTag)}/`;
}

function slotUri(personaTag: string, realmDocIdHex: string): string {
  return `${realmIndexPrefix(personaTag)}${realmDocIdHex.toLowerCase()}`;
}

/** Keep the substrate a face reaches a realm through, keyed by the realm's id. Last-writer-wins in the
 *  face's own slot — a realm that re-homes updates the one address the holder resolves through. */
export function recordFaceRealm(
  doc: LarDoc, personaTag: string, realmDocIdHex: string, substrateUrl: string,
): void {
  const uri = slotUri(personaTag, realmDocIdHex);
  (doc.tiddlers as Record<string, unknown>)[uri] = { tiddler: { title: uri, text: substrateUrl } };
}

/** Open the substrate a face keyed for a realm id, or null where it keyed none — it fabricates no address. */
export function resolveFaceRealm(doc: LarDoc, personaTag: string, realmDocIdHex: string): string | null {
  const value = tiddlerText((doc.tiddlers ?? {})[slotUri(personaTag, realmDocIdHex)] as never);
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** A face's resolution door + its own held list — never a discovery over realms the face does not hold. */
export interface FaceScopedRealmIndex {
  resolve(realmDocIdHex: string): string | null;
  record(realmDocIdHex: string, substrateUrl: string): void;
  /** The realm ids THIS face keyed a substrate for — the holder's own memory, never a mesh roster. */
  held(): string[];
}

export function faceScopedRealmIndex(doc: LarDoc, personaTag: string): FaceScopedRealmIndex {
  const prefix = realmIndexPrefix(personaTag);
  return {
    resolve: (realmDocIdHex) => resolveFaceRealm(doc, personaTag, realmDocIdHex),
    record:  (realmDocIdHex, substrateUrl) => recordFaceRealm(doc, personaTag, realmDocIdHex, substrateUrl),
    held: () => Object.keys(doc.tiddlers ?? {})
      .filter((k) => k.startsWith(prefix))
      .map((k) => decodeURIComponent(k.slice(prefix.length)))
      .sort(),
  };
}

/** Close the founding→resolution loop: keep the substrate a realm founding returned, keyed by its id, so
 *  the ceremony's output reaches a runtime that resolves it — the orphaned-ceremony red this red names. */
export function recordFoundedRealm(doc: LarDoc, personaTag: string, realm: CabalRealm): void {
  recordFaceRealm(doc, personaTag, realm.realmDocIdHex, realm.substrateUrl);
}
