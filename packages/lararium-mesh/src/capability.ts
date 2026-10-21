/**
 * Capability protocol — provider-neutral authority shore.
 *
 * Mesh owns the shape. Adapters prove it.
 * Keyhive, local-dev stubs, future UCAN/CAIP/EIP-712 bridges, and job
 * handlers can all satisfy this small interface without depending on a concrete
 * provider package.
 */

/** Small binary gate used before app-specific policy narrows further. */
export type CapabilityAccess = "read" | "admin";

/** Opaque principal identifier: DID, account id, verifying key, or provider handle. */
export type CapabilityPresenter = string;

export interface CapabilityVerifyArgs {
  readonly presenter: CapabilityPresenter;
  readonly bagUrl:    string;
  readonly access:    CapabilityAccess;
  /**
   * HOW THE ASK ARRIVED. `local` reads only when the dispatcher took the verb over the vessel's own presence channel;
   * it never rides in from a claim, so a verifier that grants more to a local session reads this and nothing a peer wrote.
   */
  readonly channel?:  "local";
}

export interface CapabilityVerifyResult {
  readonly ok:      boolean;
  readonly reason?: string;
}

export interface CapabilityVerifier {
  verify(args: CapabilityVerifyArgs): Promise<CapabilityVerifyResult>;
  /**
   * A verifier that carries the Kahu predicate also answers it for a bag a routed verb names INSIDE its args (the
   * `wiki-act` envelope carries the real destination and source in `args.args`, where `verify`'s bag derivation
   * never looks). Throws a `kahu-reach` refusal for a system canon bag the hand's cabal does not reach.
   */
  kahuReach?(bagUrl: string, act: string): Promise<void>;
}
