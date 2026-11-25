/**
 * session-document-view-door: the names the package barrel exports from `session-document-view.ts`, on a subpath of their own.
 *
 * `session-document-view.ts` exports more than the barrel lends (helpers its own package composes with); a reader that names a
 * subpath instead of the barrel reaches this door, which carries exactly the barrel's names from that module and
 * nothing else. `tools/mesh-barrel-witness.test.mjs` holds every exported subpath to the barrel's reach.
 */
export { SessionDocumentView, SessionViewError } from "./session-document-view.js";
export type { SessionDocumentFacets, DocumentFacet, FacetLayer } from "./session-document-view.js";
