/**
 * guarded-boot — the browser boot's lock keeps pace with what the boot stood.
 *
 * A boot takes the store lock first and stands a Repo, a relay adapter, a shared-holder port and a daemon worker over the
 * one IndexedDB store after it. A throw later in the boot used to give the lock back with all of that still up, so a retry
 * in the same page opened a second Repo and a second adapter on the same store. Now the boot REGISTERS each thing it stands,
 * and a throw tears them down, newest first, BEFORE the lock goes back. A thing that will not come down keeps the lock and
 * the boot refuses by name (`BootTeardownRefusal`): the store stays held by the half-stood boot rather than opened twice.
 */
import type { VesselLockHold } from "./vessel-lock.js";

/** What a boot holds while it stands: the store lock, and what it stood beneath it. */
export interface BootHold {
  lock: VesselLockHold | null;
  readonly stood: Array<{ readonly what: string; readonly down: () => unknown }>;
}

/** A failed boot could not take down what it stood, so the store lock stays held. */
export class BootTeardownRefusal extends Error {
  readonly failed: readonly string[];
  override readonly cause: unknown;
  constructor(failed: readonly string[], cause: unknown) {
    super(`[openBrowserVessel] the boot failed (${cause instanceof Error ? cause.message : String(cause)}) and could not take down ${failed.join(", ")}; the store lock stays held so a retry cannot open a second copy over the same store`);
    this.name = "BootTeardownRefusal";
    this.failed = failed;
    this.cause = cause;
  }
}

/** Run `boot`; on a throw, take down what it stood (newest first), then give the lock back, or keep it and refuse by name. */
export async function guardedBoot<T>(held: BootHold, boot: () => Promise<T>, budgetMs = 5_000): Promise<T> {
  try {
    return await boot();
  } catch (error) {
    const failed: string[] = [];
    for (const thing of [...held.stood].reverse()) {
      // A teardown is bounded: a Repo over a store that never opened awaits a flush that never lands, and a boot that waits
      // on it forever would hold the page. A thing that outlasts its budget reads as one that will not come down.
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          Promise.resolve().then(() => thing.down()),
          new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`${thing.what} outlasted its ${String(budgetMs)}ms teardown budget`)), budgetMs); }),
        ]);
      } catch { failed.push(thing.what); } finally { if (timer !== undefined) clearTimeout(timer); }
    }
    held.stood.length = 0;
    if (failed.length > 0) throw new BootTeardownRefusal(failed, error);
    await held.lock?.release().catch(() => undefined);
    throw error;
  }
}
