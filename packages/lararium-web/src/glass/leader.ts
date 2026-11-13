export interface LockManagerLike {
  request(name: string, options: { mode: "exclusive" }, callback: () => Promise<void>): Promise<unknown>;
}

/** The exclusive lock itself carries leadership and its release carries succession. */
export function electLeader({ locks, name }: { locks: LockManagerLike; name: string }) {
  let leader = false;
  let release: (() => void) | undefined;
  let stopped = false;
  const listeners = new Set<(release: () => void) => void>();
  void locks.request(name, { mode: "exclusive" }, async () => {
    if (stopped) return;
    leader = true;
    await new Promise<void>(resolve => {
      release = () => {
        if (!leader) return;
        leader = false;
        release = undefined;
        resolve();
      };
      for (const listener of listeners) listener(release);
    });
  });
  return {
    onLeader(cb: (release: () => void) => void) {
      listeners.add(cb);
      if (leader && release) cb(release);
      return () => listeners.delete(cb);
    },
    isLeader: () => leader,
    stepDown() { stopped = true; release?.(); },
  };
}
