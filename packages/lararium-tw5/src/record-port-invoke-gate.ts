/** The verified face rides by reference; a claimed string grants nothing. */
export interface InvokeRequest {
  readonly provenFace?: object;
  readonly requestedBy?: string;
  readonly renderCursor: string;
  readonly affordanceId: string;
  readonly action: string;
}
export type AuthorityResult = { readonly allowed: true } | { readonly allowed: false; readonly reason: string };
export type InvokeResult<T> = { readonly invoked: true; readonly value: T } | { readonly invoked: false; readonly reason: string };
export interface InvokeDeps<T> {
  readonly authority?: (req: InvokeRequest) => AuthorityResult;
  readonly currentRenderCursor: () => string;
  readonly invokeActions: (req: InvokeRequest) => T;
}
export function gateInvoke<T>(req: InvokeRequest, deps: InvokeDeps<T>): InvokeResult<T> {
  if (!req.provenFace || typeof req.provenFace !== "object") return { invoked: false, reason: "no-proven-face" };
  const authority = (deps.authority ?? (() => ({ allowed: false as const, reason: "no-authority" })))(req);
  if (!authority.allowed) return { invoked: false, reason: authority.reason };
  if (req.renderCursor !== deps.currentRenderCursor()) return { invoked: false, reason: "stale-cursor" };
  return { invoked: true, value: deps.invokeActions(req) };
}
