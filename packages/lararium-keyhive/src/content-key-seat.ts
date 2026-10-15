/**
 * content-key-seat — the content-key holder seated beside one island's Keyhive identities, and the roll it
 * subscribes to the vessel's seat rolls.
 *
 * THE HOLDER LIVES WHERE THE KEYS' SEAT LIVES. A vessel's Keyhive identities stand in its daemon island, so the
 * holder stands there too: a bare content key never crosses the island's port. The vessel hands a body in and
 * takes a sealed value back.
 *
 * THIS MODULE SUPPLIES THE VESSEL'S OWN READINGS, and holds none of its own:
 *   · WHOM A WRAP SERVES. The readers of a bag read as the seats the face's key group holds on this replica,
 *     each one still seated, less every party whose edge this vessel reads as set aside or as owing a roll. A
 *     vessel with no face names no key group: its keys wrap for its own identities alone.
 *   · WHICH BAGS A SCOPE REACHES. A seat roll names a scope (a fleet root); the bags that scope reaches read
 *     as the bags this vessel holds under that face.
 *   · WHICH RAISES COUNT. A raise counts where this island's own count of the fleet's acts answered it (every
 *     roll this seat took, and every kept roll the vessel handed back under its own receipt), or where the
 *     vessel's ledger reading says so.
 *   · WHERE THIS VESSEL SITS. Its own seat reads as the one of its identities the face's key group holds and
 *     still seats on this replica. A vessel with no face, or whose identities hold no seat there, names none, and
 *     an import of a bundle's memory section then refuses: it would wrap a key for no seat.
 *   · WHO SIGNS. The session whose act asks. No session proof composed: every mint refuses by name, and this
 *     vessel reads no writer as capable, so it counts no record. No vessel key and no daemon key signs in a
 *     session's place.
 *
 * ONE SUBSCRIPTION. `seatContentKeys` subscribes the content-key roll to this island's seat rolls
 * (`subscribeSeatRolls`), the one seam kapae#/keys names. A roll it could not finish rejects, the raises stay
 * unmarked, and the same roll comes again.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store · lar:///ha.ka.ba/lares/api/pono/kapae#/keys
 */
import {
  ContentKeyHolder, SealedStore, contentKeyRollSink, verifiedSeatRoll,
  type ContentKeyHolderPorts, type EdgeStanding, type RecordSigner, type RollOutcome, type SealedStoreRest,
  type SeatRoll, type SeatRollSink, type WriterStanding,
} from "@lararium/mesh";
import { keyhiveLockboxShore, type LockboxProvider } from "./keyhive-lockbox.js";
import { subscribeSeatRolls } from "./seat-duty-executor.js";

/** The slice of a `KeyhiveProvider` a content-key seat rides. */
export interface ContentKeyProvider extends LockboxProvider {
  groupMembers(groupId: string): Promise<string[]>;
  verifyGroupMembership(agentIdentifierHex: string, groupId: string): Promise<{ ok: boolean }>;
}

/** What a session's open hands the holder: the signer of the session that acts, and this vessel's own reading
 *  of who may write a bag (the face proof's chain check). */
export interface SessionProof {
  /** The signer of the session whose act asks now, or null where none stands. */
  signer(): RecordSigner | null;
  readonly standing: WriterStanding;
  readonly apart?: NonNullable<ContentKeyHolderPorts["apart"]>;
}

/** With no session proof composed, this vessel reads no writer as capable: it counts no record and mints none. */
const NO_PROOF: SessionProof = Object.freeze({ signer: () => null, standing: Object.freeze({ holdsWrite: () => false }) });

export interface ContentKeySeatInput {
  /** This island's identities, in wrap order: the identity that holds the face's key group first. */
  readonly providers: readonly ContentKeyProvider[];
  /** Durable rest for lockboxes, records and index rows (the node answers it over files). */
  readonly rest: SealedStoreRest;
  /** The sealed values' own rest: bytes by address. */
  readonly values: ContentKeyHolderPorts["values"];
  /** Rest one identity's Archive under the vessel key. It resolves before a wrap answers. */
  restArchive(provider: ContentKeyProvider): Promise<void>;
  /** The face's key group (a Keyhive group's id) and the scope its edge acts ride. Null: no face stands here. */
  readonly group: { readonly groupId: string; readonly scope: string } | null;
  /** The bags this vessel holds under the face's key group. */
  bags(): readonly string[];
  /** What one seat's edge reads on this vessel's own fold. Absent: no reader stands composed, and every other
   *  seat reads as set aside. */
  readonly standingOf?: (member: string) => EdgeStanding | Promise<EdgeStanding>;
  /** Does this vessel read a shadow over its own edge in the face's scope? Absent: it reads none. */
  readonly ownEdgeShadowed?: () => boolean | Promise<boolean>;
  /** Raises the vessel's own ledger counts on the face's scope, beyond the rolls this seat itself took. */
  readonly countedRaises?: () => ReadonlySet<string> | Promise<ReadonlySet<string>>;
  /** Admission acts this vessel verified. */
  readonly verifiedAdmissions?: () => ReadonlySet<string> | Promise<ReadonlySet<string>>;
  readonly session?: SessionProof;
  /** What each founding of each bag did with a roll: for a door, a log line or a vector. It names no key. */
  readonly report?: (outcome: RollOutcome) => void;
  /** Where the roll subscribes. Absent: this island's own seat rolls (`subscribeSeatRolls`), the production
   *  seam. A vector that stands several vessels in one process hands each its own. */
  readonly subscribe?: (sink: SeatRollSink) => () => void;
}

export interface ContentKeySeat {
  readonly holder: ContentKeyHolder;
  /** The subscriber this seat stood on the vessel's seat rolls. */
  readonly sink: SeatRollSink;
  /**
   * Hand the seat the rolls the vessel kept (`keptSeatRolls`), each under the vessel's own receipt. A roll
   * whose receipt fails under `vesselKey` moves nothing. A roll already answered settles as not owed; a
   * founding or a head that arrived since still takes its roll. Answers how many it took and what stays owed.
   */
  catchUp(rolls: readonly unknown[], vesselKey: string): Promise<{ readonly taken: number; readonly refused: number; readonly owed: readonly string[] }>;
  /** Unsubscribe, overwrite every key and forget every reading. */
  lock(): void;
}

const bare = (id: string): string => id.trim().toLowerCase().replace(/^0x/, "");

/** Seat the holder beside these identities and subscribe its roll. */
export function seatContentKeys(input: ContentKeySeatInput): ContentKeySeat {
  const session = input.session ?? NO_PROOF;
  const shore = keyhiveLockboxShore(input.providers, { restArchive: (provider) => input.restArchive(provider as ContentKeyProvider) });
  /** Raises this island's own count answered: every roll the sink took, and every kept roll under a receipt. */
  const answered = new Set<string>();

  const readersOf = async (): Promise<readonly string[]> => {
    if (input.group === null) return [];
    const own = new Set((await shore.self()).map(bare));
    for (const provider of input.providers) {
      let members: string[];
      try { members = await provider.groupMembers(input.group.groupId); } catch { continue; }   // this identity holds no replica of the group
      const readers: string[] = [];
      for (const member of members) {
        if (own.has(bare(member))) continue;                         // the wrap seats this vessel's own identities itself
        if (!(await provider.verifyGroupMembership(member, input.group.groupId)).ok) continue;
        const standing = input.standingOf === undefined ? "aside" : await input.standingOf(member);
        // A seat that owes its roll leaves first; a party set aside holds no standing. Neither receives a key.
        if (standing === "clear" || standing === "returned") readers.push(bare(member));
      }
      return readers;
    }
    return [];
  };

  const holder = new ContentKeyHolder({
    store: new SealedStore(input.rest),
    shore,
    readersOf,
    standing: session.standing,
    evidenceOf: async () => {
      const counted = input.countedRaises === undefined ? new Set<string>() : await input.countedRaises();
      const admitted = input.verifiedAdmissions === undefined ? new Set<string>() : await input.verifiedAdmissions();
      return { raiseCounts: (act) => answered.has(act) || counted.has(act), admissionVerifies: (act) => admitted.has(act) };
    },
    ownEdgeShadowed: async () => (input.ownEdgeShadowed === undefined ? false : (await input.ownEdgeShadowed()) === true),
    ownSeat: async () => {
      if (input.group === null) return null;
      const own = (await shore.self()).map(bare);
      for (const provider of input.providers) {
        let members: string[];
        try { members = (await provider.groupMembers(input.group.groupId)).map(bare); } catch { continue; }   // this identity holds no replica of the group
        for (const id of own) {
          if (members.includes(id) && (await provider.verifyGroupMembership(id, input.group.groupId)).ok) return id;
        }
        return null;
      }
      return null;
    },
    values: input.values,
    ...(session.apart ? { apart: session.apart } : {}),
  });

  const roll = contentKeyRollSink(holder.rollerPorts({
    bagsOf: (scope) => (input.group !== null && bare(scope) === bare(input.group.scope) ? input.bags() : []),
    signer: () => session.signer(),
    ...(input.report ? { report: input.report } : {}),
  }));
  const sink: SeatRollSink = async (seatRoll: SeatRoll) => {
    // This island's own count of the fleet's acts answered these raises (`answerFleetSeatDuties`), so the
    // version a roll mints for them verifies against this seat's own evidence.
    for (const cid of seatRoll.raiseCids) answered.add(cid);
    await roll(seatRoll);
  };
  const unsubscribe = (input.subscribe ?? subscribeSeatRolls)(sink);

  return {
    holder, sink,
    async catchUp(rolls, vesselKey) {
      let taken = 0, refused = 0;
      const owed: string[] = [];
      for (const raw of rolls) {
        const kept = verifiedSeatRoll(raw, vesselKey);
        if (kept === null) { refused += 1; continue; }
        try { await sink(kept); taken += 1; }
        catch (err) { owed.push(err instanceof Error ? err.message : String(err)); }
      }
      return { taken, refused, owed };
    },
    lock() { unsubscribe(); holder.lock(); },
  };
}
