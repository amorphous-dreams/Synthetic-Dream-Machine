/**
 * mint-census — THE DOCUMENTS A COMPOSE MINTS AND CANNOT FIND AGAIN.
 *
 * A compose mints nothing it cannot find again. `repo.create` mints a fresh, random address; a cap that calls it while
 * it builds, and names that address under no pointer it reads back, leaves one orphan per boot in the store, and a
 * census of binding mints alone reads zero over every one.
 *
 * The census is seated on a Repo (one per composition, like the Repo's actor door, `repo-wear`): it records each
 * `create` that runs while a cap builds (`capBuilding`), under that cap's name. A cap that does keep a pointer names
 * the address with `pointMint`, and a document at a derived address (`deterministicDocUrl`) never passes `create` at
 * all. What stays reads `capMintsUnpointed`, and `unboundMints` counts it beside the binding mints, so a leak reads
 * non-zero. A create outside every compose (a verb's mint) answers to its own rows, never to this census.
 */
import { capBuilding, type CapId } from "./cap-compose.js";

/** A document a cap created while it built, under no pointer it named. */
export interface CapMint {
  readonly cap: CapId;
  readonly url: string;
}

interface Minting { create(...args: never[]): { readonly url: string } }

const ledgers = new WeakMap<object, CapMint[]>();
/** Addresses a cap named under a pointer it reads back. A document id names one document anywhere. */
const pointed = new Set<string>();

/**
 * Seat the census on `repo`: each `create` a cap's build calls records its address under that cap. Answers the unseat,
 * which hands the Repo its own `create` back. Seating twice keeps the first census.
 */
export function seatMintCensus(repo: object): () => void {
  if (ledgers.has(repo)) return () => {};
  const target = repo as Minting;
  const ledger: CapMint[] = [];
  ledgers.set(repo, ledger);
  const own = Object.prototype.hasOwnProperty.call(repo, "create");
  const prior = target.create;
  target.create = function censusCreate(this: unknown, ...args: never[]) {
    const handle = prior.apply(this, args);
    const cap = capBuilding();
    if (cap !== null) ledger.push({ cap, url: handle.url });
    return handle;
  } as Minting["create"];
  return () => {
    if (own) target.create = prior;
    else delete (target as { create?: unknown }).create;
    ledgers.delete(repo);
  };
}

/** A cap names the address it created under a pointer it reads back at its next compose. */
export function pointMint(url: string): void {
  pointed.add(url);
}

/** The documents caps created on `repo` while they built and named under no pointer, oldest first. */
export function capMintsUnpointed(repo: object): CapMint[] {
  return (ledgers.get(repo) ?? []).filter((m) => !pointed.has(m.url));
}
