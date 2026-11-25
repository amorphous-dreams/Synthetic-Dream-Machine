import { DAEMON_BAG_ID } from "@lararium/mesh/lar-uris";
import { hex } from "@lararium/mesh/crypto";
import { mutableLarRecord } from "@lararium/mesh/base-doc";
import { type LarTiddlerStore, type ChangeOrigin } from "@lararium/mesh/tiddler-store";
import { type CompositeStore } from "@lararium/mesh/composite-store";
import type { CapabilityProvider } from "./capability-provider.js";

export interface BagDocLedger {
  get(bag: string): Promise<string | null>;
  put(bag: string, docId: string): Promise<void>;
  /** Drop a bag's record (`lares wiki retire`): the face's next mint of that bag registers a fresh Document. True where one stood. */
  drop?(bag: string): Promise<boolean>;
}

/**
 * What a durable registration did: each bag whose recorded Document this stand held no hand in, so a fresh Document took its
 * place (`remintBag`). Content sealed under the Document that left stays unreadable to this face. `commit` puts the rows a held
 * registration kept back (an ordinary one put each as it registered, so its commit moves nothing).
 */
export interface DurableRegistration { readonly reminted: readonly string[]; commit(): Promise<void> }

/**
 * Register each bag on the provider, adopting the Document the ledger records where this stand holds a hand in it. `hold` (a
 * recard's stale pass) keeps every row back: the Documents it mints ride a card whose secret only the Archive after it holds, so
 * the caller commits the rows once that Archive rests, and a recard refused `archive-unrested` leaves the ledger as it stood.
 */
export async function registerBagsDurably({ provider, bags, ledger, hold = false }: {
  provider: CapabilityProvider;
  bags: readonly string[];
  ledger: BagDocLedger;
  hold?: boolean;
}): Promise<DurableRegistration> {
  const reminted: string[] = [];
  const held: Array<readonly [string, string]> = [];
  const rest = async (bag: string, docId: string): Promise<void> => { if (hold) held.push([bag, docId]); else await ledger.put(bag, docId); };
  for (const bag of bags) {
    const recorded = await ledger.get(bag);
    if (recorded) {
      provider.adoptBag(bag, recorded);
      if (await provider.holdsHand(bag)) continue;
      const { docId } = await provider.remintBag(bag);
      await rest(bag, docId);
      reminted.push(bag);
    } else {
      const { docId } = await provider.registerBag(bag);
      await rest(bag, docId);
    }
  }
  return { reminted, commit: async () => { for (const [bag, docId] of held.splice(0)) await ledger.put(bag, docId); } };
}

async function titleFor(bag: string, vessel: boolean, face?: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(bag));
  const prefix = vessel ? "lar:///ha.ka.ba/keyhive/bag-doc/vessel/" : "lar:///ha.ka.ba/keyhive/bag-doc/";
  const scope = face === undefined ? "" : `${hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(face)))).slice(0, 24)}/`;
  return `${prefix}${scope}${hex(new Uint8Array(digest))}`;
}

const origin: ChangeOrigin = { kind: "lares-verb", requestId: "bag-doc-ledger" };

export function daemonBagDocLedger(composite: CompositeStore, face?: string): BagDocLedger {
  return {
    async get(bag) {
      const record = await composite.get(await titleFor(bag, true, face));
      return record?.meta?.deleted ? null : record?.tiddler?.bag === bag ? record.tiddler.text ?? null : null;
    },
    async put(bag, docId) {
      await composite.put(mutableLarRecord(await titleFor(bag, true, face), { text: docId, bag }, "lares-keyhive"), origin, { bag: DAEMON_BAG_ID });
    },
  };
}

export function planeBagDocLedger(store: LarTiddlerStore): BagDocLedger {
  return {
    async get(bag) {
      const record = await store.get(await titleFor(bag, false));
      return record?.meta?.deleted ? null : record?.tiddler?.bag === bag ? record.tiddler.text ?? null : null;
    },
    async put(bag, docId) {
      await store.put(mutableLarRecord(await titleFor(bag, false), { text: docId, bag }, "lares-keyhive"), origin);
    },
    async drop(bag) {
      const title = await titleFor(bag, false);
      const record = await store.get(title);
      if (!record || record.meta?.deleted || record.tiddler?.bag !== bag) return false;
      await store.remove(title, origin);
      return true;
    },
  };
}
