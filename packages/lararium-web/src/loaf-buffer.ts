/**
 * The vessel page's long-animation-frame window: the newest entries up to a cap, and a count of every frame seen.
 * A tab that lives for days keeps a bounded buffer and reads an honest total.
 */
export interface LoafEntry { readonly startTime: number; readonly duration: number; readonly blockingDuration: number }

export const LOAF_WINDOW = 200;

export function createLoafBuffer(cap: number = LOAF_WINDOW): {
  push(entry: LoafEntry): void;
  entries(): readonly LoafEntry[];
  observed(): number;
} {
  const window: LoafEntry[] = [];
  let seen = 0;
  return {
    push(entry) {
      seen += 1;
      window.push(entry);
      if (window.length > cap) window.splice(0, window.length - cap);
    },
    entries: () => window,
    observed: () => seen,
  };
}
