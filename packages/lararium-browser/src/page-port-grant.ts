import type { PortGrant } from "@lararium/mesh/record-port";

/**
 * What a browser vessel lends its own page for one port: the page IS the person's surface, so a wiki island's port may edit the
 * default bag as the worn face (no explicit bag, no admin). The daemon surface keeps a read-only port. The vessel posts this
 * grant; the page can neither forge nor widen it.
 */
export function pagePortGrant(o: { binding: string; islandKey: string; faceId: string | null; daemonKey: string }): PortGrant {
  return { faceId: o.faceId ?? o.islandKey, actor: o.binding, edits: o.islandKey !== o.daemonKey, bags: [], admin: false };
}
