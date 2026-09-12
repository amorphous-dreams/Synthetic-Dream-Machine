/**
 * vessel-lock — the single-owner law lit in the browser, on the Web Locks API.
 *
 * ── THE COLLISION THIS EXISTS TO STOP ────────────────────────────────────────────────────────────
 * Two tabs on one origin each open the vessel's IndexedDB store and its OPFS CAS. Each stands a whole
 * holder — its own repo, its own keyhive provider, its own islands — over ONE store. That is the shape
 * `vessel-island-pool-core` refuses inside a page ("one activation runs per grain at a time") and
 * `palace-path` refuses on disk ("one physical palace, one spelling, one holder"); across tabs nothing
 * refused it, so the second holder wrote beside the first in silence.
 *
 * The Web Locks API states the same law: one exclusive holder per name. So the vessel open asks for the
 * lock `lares:vessel:<idbName>` with `ifAvailable` and holds it for its own life — the page's life; the
 * browser releases a lock when its holder goes away, which is the one release a crashed tab can make.
 *
 * ── WHAT NEVER PASSES ────────────────────────────────────────────────────────────────────────────
 * `steal`. The platform offers it and the house law forbids it: a stolen lock hands the store to a second
 * holder by force while the first still runs, which is the collision with an extra step. A refused open
 * says which client holds the store and stops there; the person closes that tab.
 *
 * ── THE FLOOR ────────────────────────────────────────────────────────────────────────────────────
 * An engine without `navigator.locks` opens exactly as before. A missing platform cap removes a cap from
 * the vessel's declaration and nothing else; it never becomes a throw.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/device-capabilities-2026#/pattern-integrity-rhymes
 */

/** One lock the platform reports as held. */
export interface HeldLockInfo {
  readonly name:     string;
  readonly mode:     string;
  readonly clientId: string;
}

/** The lock surface the door reads — injected so a test drives a host that has none. */
export interface LockHost {
  request(
    name: string,
    options: { ifAvailable: true },
    callback: (lock: { name: string } | null) => Promise<unknown> | unknown,
  ): Promise<unknown>;
  query?(): Promise<{ held?: ReadonlyArray<HeldLockInfo> }>;
}

/** Read `navigator.locks`, or null where the engine offers none. */
export function ambientLocks(): LockHost | null {
  return (globalThis as unknown as { navigator?: { locks?: LockHost } }).navigator?.locks ?? null;
}

/** The lock name a vessel store answers to — one per store, per origin. */
export function vesselLockName(idbName: string): string {
  return `lares:vessel:${idbName}`;
}

export interface VesselLockHold {
  readonly name: string;
  /** True when the platform granted the lock; false on the floor (no Web Locks here). */
  readonly held: boolean;
  /** Names the floor when `held` reads false. */
  readonly floor?: string;
  /** Give the lock back; resolves once the platform has let go. The browser also releases it when the
   *  holder's page goes away. */
  release(): Promise<void>;
}

/**
 * Hold the vessel store's lock for the caller's life, or refuse loud with the holder named.
 *
 * `ifAvailable` answers at once: the callback receives the lock, or null when another client holds it.
 * The callback's promise stays pending until `release()`, which is what keeps the lock held — the
 * platform releases a lock the moment its callback settles.
 */
export async function holdVesselLock(idbName: string, host: LockHost | null = ambientLocks()): Promise<VesselLockHold> {
  const name = vesselLockName(idbName);
  if (!host || typeof host.request !== "function") {
    return { name, held: false, floor: "this engine offers no Web Locks; the store opens unguarded", release: async () => {} };
  }

  let endLife: () => void = () => {};
  const life = new Promise<void>((resolve) => { endLife = resolve; });
  let settled: Promise<unknown> = Promise.resolve();
  const granted = new Promise<boolean>((resolve, reject) => {
    settled = host.request(name, { ifAvailable: true }, (lock) => {
      resolve(lock !== null);
      // A granted lock rides the pending promise; a refused one settles the callback at once.
      return lock === null ? undefined : life;
    }).catch(reject);
  });

  if (await granted) {
    // Release settles the callback, and the platform lets go once the request promise resolves.
    return { name, held: true, release: async () => { endLife(); await settled; } };
  }

  const holder = await describeHolder(host, name);
  throw new Error(
    `[vessel] the store "${idbName}" is already held — lock "${name}" held by ${holder}. One holder per vessel ` +
    `store on this origin; close the other tab (or worker) before opening this vessel here.`,
  );
}

/** Name the client the platform reports holding the lock; "another client on this origin" when it cannot. */
async function describeHolder(host: LockHost, name: string): Promise<string> {
  if (typeof host.query !== "function") return "another client on this origin";
  try {
    const held = (await host.query()).held ?? [];
    const match = held.find((h) => h.name === name);
    return match ? `client ${match.clientId} (${match.mode})` : "another client on this origin";
  } catch {
    return "another client on this origin";
  }
}
