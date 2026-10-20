/**
 * custody-holder — THE ONE HOLDER OF THE OPENED VESSEL KEY in a standing vessel.
 *
 * The vessel key (VK) and the opened custody root rest in this module's closure for as long as the vessel stays
 * unlocked, and nowhere else: no field, no log line, no refusal and no reading carries the key, the root, a
 * credential or a digest of one. Every hot row a standing vessel reads or writes passes through `readRow` /
 * `writeRow`; a cold row opens for one act (`openColdRow`) and its plaintext zero-fills when the act settles.
 *
 * ── THE FLOOR HOLDS NOTHING ─────────────────────────────────────────────────────────────────────
 * A fresh holder holds no key. Locked, a read answers `locked` and a write refuses `CustodyLocked`. `lock` waits
 * out every read and write in flight, then zero-fills and drops both secrets; nothing an unlock did touches disk,
 * so a restart always returns to the floor.
 *
 * ── A TORN ROW NEVER READS EMPTY ────────────────────────────────────────────────────────────────
 * `readRow` answers `opens`, `absent`, `locked`, or `unavailable` with the sealed reader's own name for what
 * stands (`torn`, `key-fails`, `bare`, `old-shape`, `unopenable`). No caller may mint over `unavailable`.
 *
 * ── THE UNLOCK BOUND ────────────────────────────────────────────────────────────────────────────
 * Any process of the vessel's own user reaches the unlock door. Each credential that opens no slot spends one of
 * `UNLOCK_ATTEMPTS_PER_BOOT` attempts; once spent, every later unlock answers `attempts-spent` before any key
 * derivation runs. Nothing resets the count but a restart: no success, no lock. Unlocks run one at a time, so
 * parallel guesses never outrun the bound.
 *
 * ── A FOUNDING HANDS ITS KEY STRAIGHT IN ────────────────────────────────────────────────────────
 * The act that minted the vessel key holds it already; `adopt` takes that key, opens the custody root and the
 * serving key (SK) under it and holds all three, as an unlock does. It asks no credential and spends no attempt, and it refuses a key the custody root does not open
 * under, so a stranger key never sits here.
 *
 * Node-main only: a worker never imports this module.
 */
import {
  openSealedCarrier, writeSealedCarrier, updateSealedCarrier, removeSealedCarrier, CustodyRefusal, vkEquals,
  type Credential, type CustodyIo, type ServingKey, type VesselKey,
} from "@lararium/mesh";
import { custodyDerive, custodyRootFromBytes, openCustodyRootCarrier, type CustodyRoot } from "./custody-root.js";
import { openCustodyVk, openServingTree, unlockCustody } from "./custody-session.js";
import { carrierTable, vkSlotsPath, type CustodyHome, type CustodyHomes } from "./vault-carriers.js";

export type HolderUnlock =
  | { readonly reading: "opens"; readonly slot: string }
  | { readonly reading: "already-unlocked" }
  | { readonly reading: "no-slot-opens"; readonly attemptsLeft: number }
  | { readonly reading: "attempts-spent" }
  | { readonly reading: "tree-absent" }
  | { readonly reading: "tree-unreadable"; readonly why: string }
  | { readonly reading: "serving-unopenable"; readonly why: string }
  | { readonly reading: "root-unopenable"; readonly why: string };

/** What `proves` answers: whether a person presented a route of the tree this holder's own key rests in. */
export type HolderProof =
  | { readonly reading: "proves" }
  | { readonly reading: "locked" }
  | { readonly reading: "no-slot-opens"; readonly attemptsLeft: number }
  | { readonly reading: "attempts-spent" }
  | { readonly reading: "tree-absent" }
  | { readonly reading: "tree-unreadable"; readonly why: string };

export type RowReading =
  | { readonly reading: "opens"; readonly plaintext: Uint8Array }
  | { readonly reading: "absent" }
  | { readonly reading: "locked" }
  | { readonly reading: "unavailable"; readonly why: string };

/** What `updateRow`'s decision answers: the row's next plaintext (`null` writes nothing) and the caller's answer. */
export interface RowUpdate<T> { readonly plaintext: Uint8Array | null; readonly value: T }

export class CustodyLocked extends Error {
  override readonly name = "CustodyLocked";
  constructor() { super("this vessel's key rests unopened, so its sealed rows stay shut: open it with `lares vault unlock`"); }
}
/** A cold row that stands and does not open: the act never runs over anything but the row's own plaintext. */
export class CustodyRowUnavailable extends Error {
  override readonly name = "CustodyRowUnavailable";
  constructor(readonly home: CustodyHome, readonly file: string, readonly reading: string) {
    super(`custody row ${home}/${file} reads ${reading}`);
  }
}
export class CustodyRowUnknown extends Error {
  override readonly name = "CustodyRowUnknown";
  constructor(home: CustodyHome, file: string, detail = "no hot or cold carrier row matches") {
    super(`custody row ${home}/${file}: ${detail}`);
  }
}

export const UNLOCK_ATTEMPTS_PER_BOOT = 3;

export interface CustodyHolder {
  /** The homes this holder's rows rest in. */
  readonly homes: CustodyHomes;
  unlock(credentials: readonly Credential[]): Promise<HolderUnlock>;
  /**
   * PROVE A PERSON STANDS HERE, on a holder that already holds its key: the credentials open a slot of this
   * vessel's tree, and the key that slot yields equals the key held. An act that hands a face's root off the
   * vessel asks this first. A miss spends one of the boot's unlock attempts, exactly as an unlock's miss does,
   * and spent attempts refuse before any key derivation runs. Opens nothing new and holds nothing new.
   */
  proves(credentials: readonly Credential[]): Promise<HolderProof>;
  /** Hold a vessel key the caller already opened (a founding's own mint). Refuses a key the custody root does not open under. */
  adopt(vk: VesselKey): Promise<void>;
  lock(): Promise<void>;
  isUnlocked(): boolean;
  attemptsLeft(): number;
  openedSlot(): string | null;
  readRow(home: CustodyHome, file: string): Promise<RowReading>;
  writeRow(home: CustodyHome, file: string, plaintext: Uint8Array): Promise<void>;
  /**
   * Read a hot row, decide, and write it as ONE custody holder: no other writer in any process lands between the
   * read and the write. `decide` answers the row's next plaintext, or `null` to leave it as it stands.
   */
  updateRow<T>(home: CustodyHome, file: string, decide: (standing: RowReading) => RowUpdate<T>): Promise<T>;
  /**
   * Remove one hot row as ONE custody holder; answers whether a row stood. The holder removes only a row its own
   * key opens: a row that stands and does not open refuses `CustodyRowUnavailable` and stays.
   */
  removeRow(home: CustodyHome, file: string, when?: (plaintext: Uint8Array) => boolean): Promise<boolean>;
  /**
   * Remove one COLD row as ONE custody holder; answers whether a row stood. As `removeRow` does for a hot row,
   * the holder removes only a row its own key opens: a row that stands and does not open refuses
   * `CustodyRowUnavailable` and stays. An act removes a cold row once what the row committed stands done. `when`,
   * where given, reads the standing plaintext under the same hold: a row it declines stays, and the removal
   * answers false. The plaintext zero-fills once `when` returns.
   */
  removeColdRow(home: CustodyHome, file: string, when?: (plaintext: Uint8Array) => boolean): Promise<boolean>;
  openColdRow<T>(home: CustodyHome, file: string, act: (plaintext: Uint8Array) => Promise<T> | T): Promise<T>;
  /**
   * Read a cold row, decide, and write it as ONE custody holder, for a cold row whose mint must never land over a
   * standing one. `decide` receives the row's standing reading and answers its next plaintext, or `null` to leave
   * it as it stands. The standing plaintext zero-fills once the decision returns, so the decision keeps a copy of
   * what it needs and nothing else.
   */
  updateColdRow<T>(home: CustodyHome, file: string, decide: (standing: RowReading) => RowUpdate<T>): Promise<T>;
  /**
   * Run `act` as ONE custody holder, while this holder holds its key: no sealed write in any process lands while it
   * runs, and no other `exclusive` act either. For a floor row whose mint must land once and never over another
   * act's (the vessel key and its inception): `act` writes those bytes itself, outside the vessel key, and touches
   * no sealed row, since a sealed write inside it would wait on the claim it already holds. Locked refuses
   * `CustodyLocked` before `act` runs.
   */
  exclusive<T>(act: () => Promise<T>): Promise<T>;
  derive(domain: string): Uint8Array;
  /** The dyad veil for `groupTag`, derived from the custody root. */
}

/** A key handed to `adopt` that the custody root does not open under. */
export class CustodyAdoptRefused extends Error {
  override readonly name = "CustodyAdoptRefused";
  constructor(reading: string) { super(`the custody root reads ${reading} under the key handed in; nothing is held`); }
}

export function makeCustodyHolder(a: { readonly io: CustodyIo; readonly homes: CustodyHomes }): CustodyHolder {
  let vk: VesselKey | null = null;
  // The serving key, opened through the serving tree's VK entry at every unlock and held beside the VK. No serving
  // row stands yet for it to open (the rows move under it with the ember's serving tier); the lock zero-fills it.
  let sk: ServingKey | null = null;
  let root: CustodyRoot | null = null;
  let slot: string | null = null;
  let spent = 0;
  let unlockChain: Promise<unknown> = Promise.resolve();
  let accepting = true;
  const active = new Set<Promise<unknown>>();

  const enqueueUnlock = (credentials: readonly Credential[]): Promise<HolderUnlock> => {
    const run = unlockChain.then(() => doUnlock(credentials), () => doUnlock(credentials));
    unlockChain = run.catch(() => undefined);
    return run;
  };
  const doUnlock = async (credentials: readonly Credential[]): Promise<HolderUnlock> => {
    if (vk !== null) return { reading: "already-unlocked" };
    if (spent >= UNLOCK_ATTEMPTS_PER_BOOT) return { reading: "attempts-spent" };
    const result = await unlockCustody({ io: a.io, homes: a.homes, credentials });
    if (result.reading === "no-slot-opens") {
      spent++;
      return { reading: "no-slot-opens", attemptsLeft: UNLOCK_ATTEMPTS_PER_BOOT - spent };
    }
    if (result.reading !== "opens") return result;
    const opened = await openCustodyRootCarrier({ io: a.io, vk: result.vk, identityDir: a.homes.identity });
    if (opened.reading !== "opens") {
      result.vk.fill(0);
      result.sk.fill(0);
      return { reading: "root-unopenable", why: opened.reading };
    }
    vk = result.vk;
    sk = result.sk;
    root = custodyRootFromBytes(opened.opened);
    slot = result.slot;
    return { reading: "opens", slot };
  };
  const doProve = async (credentials: readonly Credential[]): Promise<HolderProof> => {
    if (vk === null || !accepting) return { reading: "locked" };
    if (spent >= UNLOCK_ATTEMPTS_PER_BOOT) return { reading: "attempts-spent" };
    const result = await openCustodyVk({ io: a.io, homes: a.homes, credentials });
    if (result.reading === "no-slot-opens") {
      spent++;
      return { reading: "no-slot-opens", attemptsLeft: UNLOCK_ATTEMPTS_PER_BOOT - spent };
    }
    if (result.reading !== "opens") return result;
    // A route that opens a tree whose key differs from the one held proves nothing about this vessel.
    const same = vk !== null && vkEquals(result.vk, vk);
    result.vk.fill(0);
    if (same) return { reading: "proves" };
    spent++;
    return { reading: "no-slot-opens", attemptsLeft: UNLOCK_ATTEMPTS_PER_BOOT - spent };
  };
  const operation = <T>(fn: () => Promise<T>): Promise<T> => {
    if (!accepting || vk === null) return Promise.reject(new CustodyLocked());
    let tracked!: Promise<T>;
    tracked = fn().finally(() => active.delete(tracked));
    active.add(tracked);
    return tracked;
  };
  const address = (home: CustodyHome, file: string, coldAllowed: boolean) => {
    const row = carrierTable().find((r) => {
      if (r.home !== home || (r.custody !== "hot" && r.custody !== "cold")) return false;
      r.match.lastIndex = 0;
      return r.match.test(file);
    });
    if (!row || (row.custody === "cold" && !coldAllowed)) {
      throw new CustodyRowUnknown(home, file, row?.custody === "cold" ? "cold rows require openColdRow" : undefined);
    }
    return { row, path: `${a.homes[home]}/${file}`, name: `${home}/${file}` };
  };

  const doAdopt = async (handed: VesselKey): Promise<void> => {
    if (vk !== null) return;
    const opened = await openCustodyRootCarrier({ io: a.io, vk: handed, identityDir: a.homes.identity });
    if (opened.reading !== "opens") throw new CustodyAdoptRefused(opened.reading);
    const served = await openServingTree({ io: a.io, homes: a.homes, vk: handed });
    if (served.reading !== "opens") throw new CustodyAdoptRefused(`${served.reading} at the serving tree`);
    vk = Uint8Array.from(handed) as VesselKey;
    sk = served.sk;
    root = custodyRootFromBytes(opened.opened);
    slot = null;
  };

  return {
    homes: a.homes,
    unlock: enqueueUnlock,
    proves(credentials) {
      const run = unlockChain.then(() => doProve(credentials), () => doProve(credentials));
      unlockChain = run.catch(() => undefined);
      return run;
    },
    adopt(handed) {
      const run = unlockChain.then(() => doAdopt(handed), () => doAdopt(handed));
      unlockChain = run.catch(() => undefined);
      return run;
    },
    lock(): Promise<void> {
      accepting = false;
      // A lock takes its turn on the unlock chain: an unlock already deriving finishes first, so no key lands
      // after the lock that meant to drop it.
      const drop = async (): Promise<void> => {
        await Promise.allSettled([...active]);
        vk?.fill(0);
        sk?.fill(0);
        root?.bytes.fill(0);
        vk = null;
        sk = null;
        root = null;
        slot = null;
        accepting = true;
      };
      const run = unlockChain.then(drop, drop);
      unlockChain = run.catch(() => undefined);
      return run;
    },
    isUnlocked: () => vk !== null,
    attemptsLeft: () => UNLOCK_ATTEMPTS_PER_BOOT - spent,
    openedSlot: () => slot,
    async readRow(home, file) {
      if (vk === null || !accepting) return { reading: "locked" };
      const { row, path, name } = address(home, file, false);
      return operation(async () => {
        const result = await openSealedCarrier({ io: a.io, vk: vk!, carrier: { name, path, keyClass: row.keyClass } });
        if (result.reading === "opens") return { reading: "opens", plaintext: result.plaintext };
        if (result.reading === "absent") return { reading: "absent" };
        return { reading: "unavailable", why: result.reading };
      });
    },
    async writeRow(home, file, plaintext) {
      if (vk === null || !accepting) throw new CustodyLocked();
      const { row, path, name } = address(home, file, true);
      const key = vk;
      return operation(() => writeSealedCarrier({ io: a.io, vk: key, treePath: vkSlotsPath(a.homes.identity), carrier: { name, path, keyClass: row.keyClass }, plaintext }));
    },
    async updateRow(home, file, decide) {
      if (vk === null || !accepting) throw new CustodyLocked();
      const { row, path, name } = address(home, file, false);
      const key = vk;
      return operation(() => updateSealedCarrier({
        io: a.io, vk: key, treePath: vkSlotsPath(a.homes.identity), carrier: { name, path, keyClass: row.keyClass },
        decide: (standing) => decide(
          standing.reading === "opens" ? { reading: "opens", plaintext: standing.plaintext }
            : standing.reading === "absent" ? { reading: "absent" }
              : { reading: "unavailable", why: standing.reading }),
      }));
    },
    async removeRow(home, file, when) {
      if (vk === null || !accepting) throw new CustodyLocked();
      const { row, path, name } = address(home, file, false);
      const key = vk;
      return operation(async () => {
        try {
          return await removeSealedCarrier({ io: a.io, vk: key, treePath: vkSlotsPath(a.homes.identity), carrier: { name, path, keyClass: row.keyClass }, ...(when ? { when } : {}) });
        } catch (err) {
          if (err instanceof CustodyRefusal) throw new CustodyRowUnavailable(home, file, err.reading);
          throw err;
        }
      });
    },
    async removeColdRow(home, file, when) {
      if (vk === null || !accepting) throw new CustodyLocked();
      const { row, path, name } = address(home, file, true);
      if (row.custody !== "cold") throw new CustodyRowUnknown(home, file, "removeColdRow requires a cold row");
      const key = vk;
      return operation(async () => {
        try {
          return await removeSealedCarrier({ io: a.io, vk: key, treePath: vkSlotsPath(a.homes.identity), carrier: { name, path, keyClass: row.keyClass }, ...(when ? { when } : {}) });
        } catch (err) {
          if (err instanceof CustodyRefusal) throw new CustodyRowUnavailable(home, file, err.reading);
          throw err;
        }
      });
    },
    async updateColdRow(home, file, decide) {
      if (vk === null || !accepting) throw new CustodyLocked();
      const { row, path, name } = address(home, file, true);
      if (row.custody !== "cold") throw new CustodyRowUnknown(home, file, "updateColdRow requires a cold row");
      const key = vk;
      return operation(() => updateSealedCarrier({
        io: a.io, vk: key, treePath: vkSlotsPath(a.homes.identity), carrier: { name, path, keyClass: row.keyClass },
        decide: (standing) => {
          try {
            const next = decide(
              standing.reading === "opens" ? { reading: "opens", plaintext: standing.plaintext }
                : standing.reading === "absent" ? { reading: "absent" }
                  : { reading: "unavailable", why: standing.reading });
            // A decision that hands the standing buffer back as the next plaintext gets its own copy, so the
            // zero-fill below never reaches the bytes about to seal.
            return next.plaintext !== null && standing.reading === "opens" && next.plaintext.buffer === standing.plaintext.buffer
              ? { ...next, plaintext: Uint8Array.from(next.plaintext) } : next;
          } finally {
            if (standing.reading === "opens") standing.plaintext.fill(0);
          }
        },
      }));
    },
    async openColdRow(home, file, act) {
      if (vk === null || !accepting) throw new CustodyLocked();
      const { row, path, name } = address(home, file, true);
      if (row.custody !== "cold") throw new CustodyRowUnknown(home, file, "openColdRow requires a cold row");
      return operation(async () => {
        const opened = await openSealedCarrier({ io: a.io, vk: vk!, carrier: { name, path, keyClass: row.keyClass } });
        if (opened.reading !== "opens") throw new CustodyRowUnavailable(home, file, opened.reading);
        try { return await act(opened.plaintext); } finally { opened.plaintext.fill(0); }
      });
    },
    exclusive(act) {
      return operation(() => a.io.exclusive(act));
    },
    derive(domain) {
      if (!accepting || root === null) throw new CustodyLocked();
      return custodyDerive(root, domain);
    },
  };
}
