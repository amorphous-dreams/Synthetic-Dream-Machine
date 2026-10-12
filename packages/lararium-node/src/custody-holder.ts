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
 * Node-main only: a worker never imports this module.
 */
import {
  openSealedCarrier, writeSealedCarrier,
  type Credential, type CustodyIo, type VesselKey,
} from "@lararium/mesh";
import { custodyDerive, custodyRootFromBytes, openCustodyRootCarrier, type CustodyRoot } from "./custody-root.js";
import { unlockCustody } from "./custody-session.js";
import { carrierTable, vkSlotsPath, type CustodyHome, type CustodyHomes } from "./vault-carriers.js";

export type HolderUnlock =
  | { readonly reading: "opens"; readonly slot: string }
  | { readonly reading: "already-unlocked" }
  | { readonly reading: "no-slot-opens"; readonly attemptsLeft: number }
  | { readonly reading: "attempts-spent" }
  | { readonly reading: "tree-absent" }
  | { readonly reading: "tree-unreadable"; readonly why: string }
  | { readonly reading: "root-unopenable"; readonly why: string };

export type RowReading =
  | { readonly reading: "opens"; readonly plaintext: Uint8Array }
  | { readonly reading: "absent" }
  | { readonly reading: "locked" }
  | { readonly reading: "unavailable"; readonly why: string };

export class CustodyLocked extends Error {
  override readonly name = "CustodyLocked";
  constructor() { super("custody holder is locked"); }
}
/** A cold row that stands and does not open: the act never runs over anything but the row's own plaintext. */
export class CustodyRowUnavailable extends Error {
  override readonly name = "CustodyRowUnavailable";
  constructor(home: CustodyHome, file: string, readonly reading: string) {
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
  unlock(credentials: readonly Credential[]): Promise<HolderUnlock>;
  lock(): Promise<void>;
  isUnlocked(): boolean;
  attemptsLeft(): number;
  openedSlot(): string | null;
  readRow(home: CustodyHome, file: string): Promise<RowReading>;
  writeRow(home: CustodyHome, file: string, plaintext: Uint8Array): Promise<void>;
  openColdRow<T>(home: CustodyHome, file: string, act: (plaintext: Uint8Array) => Promise<T> | T): Promise<T>;
  derive(domain: string): Uint8Array;
}

export function makeCustodyHolder(a: { readonly io: CustodyIo; readonly homes: CustodyHomes }): CustodyHolder {
  let vk: VesselKey | null = null;
  let root: CustodyRoot | null = null;
  let slot: string | null = null;
  let spent = 0;
  let unlockChain: Promise<unknown> = Promise.resolve();
  let accepting = true;
  let lockChain: Promise<void> = Promise.resolve();
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
      return { reading: "root-unopenable", why: opened.reading };
    }
    vk = result.vk;
    root = custodyRootFromBytes(opened.opened);
    slot = result.slot;
    return { reading: "opens", slot };
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

  return {
    unlock: enqueueUnlock,
    lock(): Promise<void> {
      accepting = false;
      const run = lockChain.then(async () => {
        await Promise.allSettled([...active]);
        vk?.fill(0);
        root?.bytes.fill(0);
        vk = null;
        root = null;
        slot = null;
        accepting = true;
      });
      lockChain = run;
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
    derive(domain) {
      if (!accepting || root === null) throw new CustodyLocked();
      return custodyDerive(root, domain);
    },
  };
}
