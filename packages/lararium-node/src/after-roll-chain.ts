/**
 * after-roll-chain — THE ONE AFTER-WRITE REFOLD, as a module a vector can run.
 *
 * `openNodeVessel` hands this module its holders as stages; the module owns the ORDER of a pass and the QUEUE
 * of passes. Every `store-door-verbs` row that lands a board or a practice joint (a host roll, a contract, a
 * posture flip, a taken admit bundle) and every socket reconnect fires `roll(holder)`, and awaits its answer.
 *
 * H2 — AWAITED, SERIALIZED, TRUTHFUL. `roll` returns the `Promise<boolean>` of a pass that began AFTER the roll
 * landed, so `admit-take`'s `represented` and `seal-home-refold`'s `refolded` read a pass that saw the roll. The
 * answer asks ONE question — did the re-presentation run without throwing.
 *
 * THE ORDER OF A PASS. Land the owed hosting acts; refold antigen then membership (one `try`); refresh the realm
 * plane (its own `try`); refold the edge shadows (its own `try`); re-verdict (unguarded); re-present (its own
 * `try`, the only one whose fault answers `false`). A fault in a stage logs and never skips the stages after it.
 *
 * A WARD REFUSAL REACHES ITS ASKER BY NAME. When the re-present refuses a route by the ward's own word (`WardRefused`,
 * a take's route meeting a wardless dial in flight: `ward-dial-in-flight`), every roll that carried a route rejects
 * with that refusal, so the take answers it by name; a roll that carried none answers `false`, as any fault does.
 *
 * G15 — THE BOUND. The queue counts passes; no clock decides. Passes run ONE AT A TIME (a pass refolds holders
 * every other pass shares, so two passes never overlap). Each HOLDER (the hosting nexus a roll names, or none)
 * owns at most ONE queued pass: a roll that lands before that pass starts folds into it, because a pass reads
 * the state it finds when it starts, and so the pass covers the roll; a roll that lands MID-pass queues the
 * holder's NEXT pass. Queued holders run in the order their passes queued, and a holder that rolls again while
 * its pass runs queues at the TAIL, behind every holder already waiting. So a storm of N rolls over H holders
 * completes in at most one pass per holder plus the pass that was already running (H + 1), and a holder waits
 * behind at most one pass of each other holder: no holder starves.
 */
import { WardRefused } from "@lararium/mesh";
import type { WardCredential } from "./ward-credential.js";

export interface AfterRollStages {
  /** Re-derive any hosting acts still owed from the sealed state. A throw rejects the rolls that pass answers. */
  landOwedHostingActs?: () => Promise<void>;
  refoldAntigen: () => Promise<void>;
  refoldMembership: () => Promise<void>;
  refreshRealmPlane?: () => Promise<void>;
  refoldEdgeShadows?: () => Promise<void>;
  reverdict: () => void;
  /** Re-present the dial. `ward` is the route of the act that asked for this pass (a take's), for a founder's first presentation at a new scope. */
  representIfMoved?: (ward?: WardCredential) => Promise<void>;
  log: (line: string) => void;
  /** Fires as a pass starts, naming the holder whose queued pass this is. A vector reads the order off it. */
  onPass?: (holder: string | undefined) => void;
}

/** `roll(holder)`: queue (or fold into) the holder's pass; resolves with that pass's truthful answer. */
export type AfterRoll = (holder?: string, ward?: WardCredential) => Promise<boolean>;

interface Waiter { resolve: (answer: boolean) => void; reject: (cause: unknown) => void; ward?: WardCredential }

const says = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** A pass's answer: whether the re-present ran clean, and the ward's own refusal of the route it carried, if one stood. */
interface PassAnswer { readonly represented: boolean; readonly wardRefusal?: WardRefused }

/** One full pass, the house order. `represented` reads `true` iff `representIfMoved` ran without throwing. */
async function runPass(stages: AfterRollStages, ward?: WardCredential): Promise<PassAnswer> {
  await stages.landOwedHostingActs?.();
  try {
    await stages.refoldAntigen();
    await stages.refoldMembership();
  } catch (e) {
    stages.log(`after-roll refold failed (antigen/membership): ${says(e)}`);
  }
  try {
    await stages.refreshRealmPlane?.();
  } catch (e) {
    stages.log(`after-roll refold failed (realm plane): ${says(e)}`);
  }
  try {
    await stages.refoldEdgeShadows?.();
  } catch (e) {
    stages.log(`after-roll refold failed (edge shadows): ${says(e)}`);
  }
  stages.reverdict();
  try {
    await stages.representIfMoved?.(ward);
    return { represented: true };
  } catch (e) {
    stages.log(`after-roll refold failed (re-present): ${says(e)}`);
    return e instanceof WardRefused && ward !== undefined ? { represented: false, wardRefusal: e } : { represented: false };
  }
}

export function createAfterRoll(stages: AfterRollStages): AfterRoll {
  /** Holders with a queued pass, in the order those passes queued; each holder appears once. */
  const ready: (string | undefined)[] = [];
  /** The rolls each queued pass will answer. A holder leaves this map the moment its pass starts. */
  const waiting = new Map<string | undefined, Waiter[]>();
  let draining = false;

  const drain = async (): Promise<void> => {
    if (draining) return;
    draining = true;
    try {
      while (ready.length > 0) {
        const holder = ready.shift();
        const waiters = waiting.get(holder) ?? [];
        waiting.delete(holder);
        try {
          stages.onPass?.(holder);
          // The pass carries the route of the act that queued it, if one did; it re-presents once, for every waiter.
          const answer = await runPass(stages, waiters.find((w) => w.ward !== undefined)?.ward);
          // A route the ward refused reaches each roll that carried one, by name; the rest read the plain answer.
          for (const w of waiters) {
            if (answer.wardRefusal && w.ward !== undefined) w.reject(answer.wardRefusal);
            else w.resolve(answer.represented);
          }
        } catch (cause) {
          for (const w of waiters) w.reject(cause);
        }
      }
    } finally {
      draining = false;
    }
  };

  return (holder, ward) =>
    new Promise<boolean>((resolve, reject) => {
      const queued = waiting.get(holder);
      const waiter: Waiter = { resolve, reject, ...(ward ? { ward } : {}) };
      if (queued) queued.push(waiter);
      else {
        waiting.set(holder, [waiter]);
        ready.push(holder);
      }
      void drain();
    });
}
