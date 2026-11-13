/**
 * keyhive-lockbox — the key shore a lockbox wraps through, over a selected face's Keyhive identity.
 *
 * EACH LOCKBOX WRAPS INTO A KEYHIVE DOCUMENT OF ITS OWN (`KeyhiveProvider.wrapToReaders`): a fresh document
 * that seats exactly the readers the lockbox serves, takes no later member and seals nothing else.
 *
 * THE BOX HOLDS THE WRAP DOCUMENT'S ID AND THE KEYHIVE CIPHERTEXT, AND NOTHING ELSE. Both read opaque, so a
 * lockbox rests beside the sealed values and travels to a carrier. The wrap's public operations name its
 * readers' identifiers: `opsFor` hands them to the member lane alone.
 *
 * A WRAP ANSWERS ONLY ONCE IT CAN OPEN AGAIN. The wrapping identity opens its own wrap from an Archive taken
 * AFTER the wrap and from nothing earlier (`tests/lockbox-wrap.test.ts`). So the shore rests that identity's
 * Archive (`restArchive`) before it answers a box, and a rest that fails there fails the wrap.
 *
 * The selected face owns the wrapping identity and its archive.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-records (the lockbox)
 */
import { SEALED_LOCKBOX_BOX_DOMAIN, hex, hexToBytes, readSealedImage, sealedImage, type LockboxWrapShore } from "@lararium/mesh";

/** The slice of a `KeyhiveProvider` the shore rides. */
export interface LockboxProvider {
  wrapToReaders(args: { readonly readers: readonly string[]; readonly contentRef: Uint8Array; readonly payload: Uint8Array }):
    Promise<{ docIdHex: string; ciphertext: Uint8Array; served: string[]; unreached: string[] }>;
  unwrapFromDocument(docIdHex: string, ciphertext: Uint8Array): Promise<Uint8Array>;
  eventsForPeer(peerAgentIdHex: string): Promise<Uint8Array[]>;
  ingestPeerEvents(events: readonly Uint8Array[]): Promise<void>;
  vesselIdentifierHex(): Promise<string>;
  knowsAgent(agentIdentifierHex: string): Promise<boolean>;
}

const bare = (id: string): string => id.trim().toLowerCase().replace(/^0x/, "");

/** The box image: the wrap document's 32-byte id, then the Keyhive ciphertext. */
export function encodeLockboxBox(docIdHex: string, ciphertext: Uint8Array): Uint8Array {
  const id = hexToBytes(bare(docIdHex));
  if (id.length !== 32 || !(ciphertext instanceof Uint8Array) || ciphertext.length === 0) throw new TypeError("keyhive-lockbox: a box holds a 32-byte wrap document id and a ciphertext");
  return sealedImage(SEALED_LOCKBOX_BOX_DOMAIN, id, ciphertext);
}
export function readLockboxBox(box: unknown): { docIdHex: string; ciphertext: Uint8Array } | null {
  try {
    const fields = readSealedImage(SEALED_LOCKBOX_BOX_DOMAIN, box, 2);
    if (fields === null || fields[0]!.length !== 32 || fields[1]!.length === 0) return null;
    return { docIdHex: `0x${hex(fields[0]!)}`, ciphertext: fields[1]! };
  } catch { return null; }
}

/**
 * The shore over this vessel's identities, in wrap order. `restArchive` rests one identity's Archive (the
 * face seals it under its own custody key); it must resolve before a wrap answers.
 */
export function keyhiveLockboxShore(providers: readonly LockboxProvider[], rest: { restArchive(provider: LockboxProvider): Promise<void> }): LockboxWrapShore {
  if (providers.length === 0) throw new TypeError("keyhive-lockbox: a shore stands over one identity or more");
  const selfIds = async (): Promise<string[]> => Promise.all(providers.map(async (provider) => bare(await provider.vesselIdentifierHex())));
  return {
    async wrap({ readers, ref, payload }) {
      const own = new Set(await selfIds());
      const named = [...new Set(readers.map(bare))].filter((id) => !own.has(id));
      // The identity that knows the most named readers wraps; the first that knows them all ends the search.
      let wrapper = providers[0]!;
      let most = -1;
      for (const provider of providers) {
        let known = 0;
        for (const id of named) if (await provider.knowsAgent(`0x${id}`)) known += 1;
        if (known > most) { wrapper = provider; most = known; }
        if (known === named.length) break;
      }
      const wrapped = await wrapper.wrapToReaders({ readers: named.map((id) => `0x${id}`), contentRef: ref, payload });
      await rest.restArchive(wrapper);
      return { box: encodeLockboxBox(wrapped.docIdHex, wrapped.ciphertext), served: wrapped.served.map(bare), unreached: wrapped.unreached.map(bare) };
    },
    async unwrap(box) {
      const read = readLockboxBox(box);
      if (read === null) return null;
      for (const provider of providers) {
        try { return await provider.unwrapFromDocument(read.docIdHex, read.ciphertext); } catch { /* another identity may hold the seat */ }
      }
      return null;
    },
    async opsFor(reader) {
      const out: Uint8Array[] = [];
      for (const provider of providers) {
        try { if (await provider.knowsAgent(`0x${bare(reader)}`)) out.push(...await provider.eventsForPeer(`0x${bare(reader)}`)); } catch { /* an identity that cannot name the reader hands it nothing */ }
      }
      return out;
    },
    async ingest(ops) {
      for (const provider of providers) {
        try { await provider.ingestPeerEvents(ops); } catch { /* one identity's refusal never stops the next */ }
      }
    },
    self: selfIds,
  };
}
