export function vesselOnlyShareVerdict(docs: { has(id: string): boolean }, islands: { has(id: string): boolean }, peerId: string, documentId: string | undefined, hasSocket: boolean, sibling = false): boolean | undefined {
  if (documentId && docs.has(documentId)) return !hasSocket && !sibling && islands.has(peerId);
  return undefined;
}
