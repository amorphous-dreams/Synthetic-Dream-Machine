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
 * G15 — THE BOUND. The queue counts passes; no clock decides. Passes run ONE AT A TIME (a pass refolds holders
 * every other pass shares, so two passes never overlap). Each HOLDER (the hosting nexus a roll names, or none)
 * owns at most ONE queued pass: a roll that lands before that pass starts folds into it, because a pass reads
 * the state it finds when it starts, and so the pass covers the roll; a roll that lands MID-pass queues the
 * holder's NEXT pass. Queued holders run in the order their passes queued, and a holder that rolls again while
 * its pass runs queues at the TAIL, behind every holder already waiting. So a storm of N rolls over H holders
 * completes in at most one pass per holder plus the pass that was already running (H + 1), and a holder waits
 * behind at most one pass of each other holder: no holder starves.
 */

export interface AfterRollStages {
  /** Re-derive any hosting acts still owed from the sealed state. A throw rejects the rolls that pass answers. */
  landOwedHostingActs?: () => Promise<void>;
  refoldAntigen: () => Promise<void>;
  refoldMembership: () => Promise<void>;
  refreshRealmPlane?: () => Promise<void>;
  refoldEdgeShadows?: () => Promise<void>;
  reverdict: () => void;
  representIfMoved?: () => Promise<void>;
  log: (line: string) => void;
  /** Fires as a pass starts, naming the holder whose queued pass this is. A vector reads the order off it. */
  onPass?: (holder: string | undefined) => void;
}

/** `roll(holder)`: queue (or fold into) the holder's pass; resolves with that pass's truthful answer. */
export type AfterRoll = (holder?: string) => Promise<boolean>;

interface Waiter { resolve: (answer: boolean) => void; reject: (cause: unknown) => void }

const says = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** One full pass, the house order. Resolves `true` iff `representIfMoved` ran without throwing. */
async function runPass(stages: AfterRollStages): Promise<boolean> {
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
    await stages.representIfMoved?.();
    return true;
  } catch (e) {
    stages.log(`after-roll refold failed (re-present): ${says(e)}`);
    return false;
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
          const answer = await runPass(stages);
          for (const w of waiters) w.resolve(answer);
        } catch (cause) {
          for (const w of waiters) w.reject(cause);
        }
      }
    } finally {
      draining = false;
    }
  };

  return (holder) =>
    new Promise<boolean>((resolve, reject) => {
      const queued = waiting.get(holder);
      if (queued) queued.push({ resolve, reject });
      else {
        waiting.set(holder, [{ resolve, reject }]);
        ready.push(holder);
      }
      void drain();
    });
}
