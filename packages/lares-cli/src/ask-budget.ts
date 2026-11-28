/**
 * ask-budget — the param a caller declares its own wait by, read off the argv alone (no environment name carries it).
 * The entry (`takeEntryAsks`) takes the param off before any verb's parser meets it; the local connector arms the wait.
 */

/** The param a caller declares its own wait by (`ask-budget-ms=<N>`), in whole milliseconds counted from this process's start. */
export const ASK_BUDGET_PARAM = "ask-budget-ms";

/** The budget a param's value declares, or null where it names none (absent, or anything but a positive whole number). */
export function askBudgetMs(raw: string | undefined): number | null {
  return raw !== undefined && /^[1-9]\d{0,8}$/.test(raw) ? Number(raw) : null;
}
