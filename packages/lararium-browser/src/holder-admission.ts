/**
 * holder-admission — which tab messages wait for an admitted session.
 *
 * While a house's island proves the face, its claimant boots the island: the manifest and the answers to the island's
 * own asks cross. A verb, a camera lease or a sealing announcement waits until the holder admits the session. The
 * holder core and the tab's door share this one reading, so neither holds a message the other sends.
 */

/** Tab-originated requests that expect an island result. */
export const TAB_REQUESTS: ReadonlySet<string> = new Set([
  "wiki:place-verb",
  "daemon:place-verb",
  "daemon:worldline-compare-request",
  "daemon:worldline-trajectory-request",
  "daemon:resolve-binding-request",
  "daemon:gate-verb-request",
]);

/** A message the holder answers only for an admitted session. */
export function waitsForAdmission(type: string): boolean {
  return TAB_REQUESTS.has(type) || type === "lar:control-event" || type === "lar:resend" || type === "session:sealer";
}
