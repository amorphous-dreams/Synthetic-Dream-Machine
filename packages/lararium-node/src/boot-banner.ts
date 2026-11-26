/**
 * boot-banner — a process's later composition folds the banner rows an earlier one already printed.
 *
 * One vessel process composes more than once: it stands at its floor, and a custody unlock, a lock or a mount's close
 * stands a fresh composition over the same store. Each composition prints its own pid line and its own phase lines, since
 * the store door reads one composition's log from them (`standBootLog`, `BOOT_MILESTONES`). The address rows beneath
 * (catalog, oracle, daemon) name the same documents every time, so a later composition prints only the rows whose value
 * moved and folds the rest into ONE line that says a composition ran again and which rows it leaves unrepeated.
 *
 * The memo lives for the process and keys each row by its label; it compares values and reads no clock.
 */

/** One banner row: its label as printed (padding and colon included) and its value. */
export type BannerRow = readonly [label: string, value: string];

/** What this process's compositions have printed so far. */
export interface BannerMemo {
  compositions: number;
  readonly said: Map<string, string>;
}

export const bannerMemo = (): BannerMemo => ({ compositions: 0, said: new Map() });

/**
 * The banner lines one composition prints. The first composition of a process prints every row. A later one prints each
 * row whose value differs from the value last printed under its label, then one fold line naming the composition's
 * ordinal, the process and the rows it folded.
 */
export function foldedBanner(memo: BannerMemo, prefix: string, rows: readonly BannerRow[], pid: number): string[] {
  memo.compositions += 1;
  const lines: string[] = [];
  const folded: string[] = [];
  for (const [label, value] of rows) {
    const key = label.trim().replace(/:$/, "");
    if (memo.said.get(key) === value) folded.push(key);
    else lines.push(`${prefix} ${label}${value}`);
    memo.said.set(key, value);
  }
  if (memo.compositions > 1) {
    lines.push(`${prefix} composition ${memo.compositions} of pid ${pid}: a custody unlock, a lock or a mount's close stood a fresh composition over the same store, so its pid and phase lines print again`
      + (folded.length ? `; ${folded.join(", ")} read as an earlier composition printed them` : "; every address row moved and prints above"));
  }
  return lines;
}
