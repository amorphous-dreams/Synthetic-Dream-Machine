export function loadNode(): Promise<unknown>;
export function restsSealed(node: unknown, storageDir: string): Promise<string[]>;
export function openedStored(root: string, options?: { readonly node?: unknown; readonly wikiId?: string; readonly hostId?: string }):
  Promise<{ readonly docs: readonly { readonly id: string; readonly doc: unknown }[]; readonly sealedIds: readonly string[]; readonly opened: number }>;
export function openedStoredApart(root: string):
  Promise<{ readonly docs: readonly { readonly id: string; readonly doc: unknown }[]; readonly sealedIds: readonly string[]; readonly opened: number }>;
