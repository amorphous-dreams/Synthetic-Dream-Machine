// @lararium/keyhive — capability layer wrapping @keyhive/keyhive (Ink & Switch concap, pre-alpha).

export type {
  CapabilityProvider, CapabilityProviderInitOpts,
  DelegateArgs, DelegateResult, VerifyArgs, VerifyResult,
  PeerDID, KeyhiveAccess, EventStoreRef,
} from "./capability-provider.js";

export { KeyhiveProvider } from "./keyhive-provider.js";

export { InMemoryEventStore } from "./event-store.js";
export type { EventStore, EventRecord } from "./event-store.js";

export const KEYHIVE_PROBE_VERSION = "0.0.0-alpha.56c";
