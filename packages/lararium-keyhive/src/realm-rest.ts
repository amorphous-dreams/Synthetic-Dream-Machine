/**
 * realm-rest — A WORKBENCH'S REST SEALS FOR ITS REALM'S ROSTER (cabal-realm#/the-workbench; research meme
 * `lar:///ha.ka.ba/kahua/memory/research/workbench-rest-gate`).
 *
 * NO NEW CRYPTO. The rest of a realm workbench seals as every bag's does: a bare random key per version, held in the
 * content-key holder, wrapped to its readers through one-shot Keyhive lockbox Documents. Keyhive supplies the ROSTER (the
 * realm's key Document, on this face's own replica) and the AEAD-to-roster of the lockbox; it seals nothing here itself.
 *
 *   · READERS FOLLOW THE ROSTER. A realm workbench bag's readers read as every hive the realm's key Document seats now, on
 *     the reading hive's own replica after its merge (Keyhive applies removes last), in place of the face's PersonaGroup.
 *   · ONE FOUNDER. The realm's owner face founds the bag; any other seated face's holder refuses `founding-owned-elsewhere`
 *     and waits for the owner's lockbox, so no second face founds a rival key (the 9d57bb71e fault).
 *
 * This module reads the vessel's ledger and the face's hive; it holds no key and seals nothing.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/cabal-realm#/the-workbench · lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store
 */
import {
  privateCabalRealmId, wikiSlotOf, workbenchSeats,
  type LarDoc, type SessionOwnChain,
} from "@lararium/mesh";
import type { RealmWriters } from "./island-session-proof.js";
import type { KeyhiveProvider } from "./keyhive-provider.js";
import { seatedWorkbenches } from "./workbench-realm.js";

const bare = (id: string): string => id.trim().toLowerCase().replace(/^0x/, "");

/** A realm workbench bag as one face's seat reads it. */
export interface RealmRestBag {
  readonly realmId: string;
  readonly slug: string;
  /** This vessel's key Document of the realm, the one that seats the reading face's hive. */
  readonly keyDoc: string;
  /** Does the reading face own the realm (its private cabal of one): its holder alone founds the bag. */
  readonly owner: boolean;
  /** The roster's readers: every hive the realm's key Document seats now, as the reading hive's replica reads it. */
  readers(): Promise<readonly string[]>;
}

/** The realm port one face's content-key seat reads: the realm a bag rests in for this face, or null for any other bag. */
export interface RealmRestPort {
  of(bagId: string): Promise<RealmRestBag | null>;
  /** The line a seated face's refusal names, where it waits on the owner's holder to found the bag. */
  readonly ownerCure?: (bag: RealmRestBag) => string;
}

/** The cure a seated face reads while the realm's owner has not founded the bag (or handed it a lockbox). */
export const WAIT_FOR_OWNER_CURE = "light the realm's owner face (`lares vault unlock --face <owner's handle>`) so its holder founds the workbench's key and hands this face its lockbox, then save again";

/**
 * THE REALM ONE FACE READS A BAG UNDER: the working slot of a wiki whose workbench the vessel's ledger binds, kept where the
 * realm's own key Document seats this face's hive (`seatedWorkbenches`). A face no realm seats, a slug the ledger binds to no
 * realm, and every other bag read null: their rest keeps the face's own readers.
 */
export async function realmRestBag(provider: KeyhiveProvider, ledger: LarDoc | undefined | null, bagId: string, face: string): Promise<RealmRestBag | null> {
  const slot = wikiSlotOf(bagId);
  if (slot === null || slot.kind !== "working") return null;
  const seated = await seatedWorkbenches(provider, ledger, slot.slug);
  if (seated.length !== 1) return null;
  const { realmId, keyDoc } = seated[0]!;
  return {
    realmId, slug: slot.slug, keyDoc, owner: realmId === privateCabalRealmId(face, slot.slug),
    readers: () => rosterReaders(provider, ledger, realmId, slot.slug, keyDoc),
  };
}

/**
 * THE CONVERGED ROSTER, as one hive's replica of the realm's key Document reads it: each agent the ledger's seat rows name and
 * each member the Document's CGKA names, kept where the Document grants it any access NOW (a revoke this replica ingested
 * leaves at once). Sorted, bare hex.
 */
export async function rosterReaders(provider: KeyhiveProvider, ledger: LarDoc | undefined | null, realmId: string, slug: string, keyDoc: string): Promise<string[]> {
  const candidates = new Set<string>([...workbenchSeats(ledger, realmId, slug).values()].map(bare));
  try { for (const id of await provider.sentinelCgkaMembers(`0x${bare(keyDoc)}`)) candidates.add(bare(id)); } catch { /* the ledger's rows still name the seats */ }
  const out: string[] = [];
  for (const agent of candidates) if ((await provider.accessInDoc(`0x${agent}`, keyDoc)) !== null) out.push(agent);
  return out.sort();
}

/** The realm port over one face's hive and the vessel's ledger, as a seat composes it. */
export function realmRestPort(input: { readonly provider: () => KeyhiveProvider | null | undefined; readonly ledger: () => Promise<LarDoc | undefined | null>; readonly face: string }): RealmRestPort {
  return {
    async of(bagId) {
      const hive = input.provider();
      if (!hive) return null;
      return realmRestBag(hive, await input.ledger(), bagId, input.face);
    },
  };
}

/** One face of this vessel as the writer book reads it: its hive's agent id, and its chain as the vessel last read it. */
export interface RealmFace {
  readonly agent: string;
  chain(): SessionOwnChain | null;
}

/**
 * THE BOOK OF A REALM'S WRITERS ON THIS VESSEL (S4): for each realm workbench bag, the faces of this vessel the realm's key
 * Document seats as writers (`admin`) now, read on a seated hive's replica. A writer standing reads it synchronously
 * (`faceStanding`'s `realmWriters`), so the book reads the roster ahead (at a mount, a landing, a projection) and answers from
 * what it last read; each face's chain resolves at the ask, so a face that lit since reads with it. `mark` names the book by
 * its content: a holder's reading gives way when a seat lands or leaves.
 */
export class RealmWriterBook {
  readonly #bags = new Map<string, { readonly seated: readonly RealmFace[]; readonly former: readonly { readonly face: RealmFace; readonly removedBy: readonly string[] }[] }>();
  #mark = "";

  /** Read one bag's writers afresh: the roster of the realm a seated hive among `hives` reads, over this vessel's faces. */
  async read(bagId: string, hives: readonly KeyhiveProvider[], ledger: LarDoc | undefined | null, faces: readonly RealmFace[]): Promise<void> {
    const slot = wikiSlotOf(bagId);
    let found: { readonly hive: KeyhiveProvider; readonly keyDoc: string } | null = null;
    if (slot !== null && slot.kind === "working") {
      for (const hive of hives) {
        const seated = await seatedWorkbenches(hive, ledger, slot.slug).catch(() => []);
        if (seated.length === 1) { found = { hive, keyDoc: seated[0]!.keyDoc }; break; }
      }
    }
    if (found === null) { this.#bags.delete(bagId); this.#remark(); return; }
    const seated: RealmFace[] = [];
    for (const face of faces) if ((await found.hive.accessInDoc(`0x${bare(face.agent)}`, found.keyDoc)) === "admin") seated.push(face);
    this.#bags.set(bagId, { seated, former: [] });
    this.#remark();
  }

  /** The writers one bag reads, as last read: null for a bag no realm keeps. */
  writers(bagId: string): RealmWriters | null {
    const bag = this.#bags.get(bagId);
    if (bag === undefined) return null;
    const chains = (faces: readonly RealmFace[]): SessionOwnChain[] => faces.map((f) => f.chain()).filter((c): c is SessionOwnChain => c !== null);
    return {
      seated: chains(bag.seated),
      former: bag.former.flatMap(({ face, removedBy }) => { const chain = face.chain(); return chain === null ? [] : [{ chain, removedBy }]; }),
    };
  }

  /** Does the realm keep this bag, as last read? */
  keeps(bagId: string): boolean { return this.#bags.has(bagId); }

  /** The book named by its content. */
  mark(): string { return this.#mark; }

  #remark(): void {
    this.#mark = JSON.stringify([...this.#bags].sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0)).map(([bagId, b]) => [bagId, b.seated.map((f) => bare(f.agent)).sort(), b.former.map((f) => [bare(f.face.agent), [...f.removedBy].sort()])]));
  }
}
