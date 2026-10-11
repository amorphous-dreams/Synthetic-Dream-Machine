import type { RelayPin } from "./browser-relay-pin.js";

/** A visible snapshot of the browser vessel's relay crossing. */
export type BrowserConnectionSnapshot =
  | { readonly status: "local" }
  | { readonly status: "missing-pin"; readonly reason: string }
  | { readonly status: "blocked"; readonly gatePubKey: string; readonly reason: string }
  | { readonly status: "pinned"; readonly gatePubKey: string }
  | { readonly status: "connecting"; readonly gatePubKey: string }
  | { readonly status: "refused"; readonly gatePubKey: string; readonly reason: string }
  | { readonly status: "connected"; readonly peer: { readonly gatePubKey: string } }
  | { readonly status: "disconnected"; readonly gatePubKey: string };

export type BrowserConnectionListener = (snapshot: BrowserConnectionSnapshot) => void;

/** Stable observable surface for a browser page that paints the vessel's current crossing. */
export interface BrowserConnectionState {
  getSnapshot(): BrowserConnectionSnapshot;
  subscribe(listener: BrowserConnectionListener): () => void;
}

/** The small adapter surface needed to observe the existing LarWSClientAdapter lifecycle. */
export interface RelayConnectionAdapter {
  session: { readonly gatePubKey: string } | null;
  anergized: string | null;
  connect: (...args: never[]) => void;
  join: (...args: never[]) => void;
  disconnect: (...args: never[]) => void;
  onClose: (...args: never[]) => void;
}

class ObservableBrowserConnectionState implements BrowserConnectionState {
  #snapshot: BrowserConnectionSnapshot;
  readonly #listeners = new Set<BrowserConnectionListener>();

  constructor(initial: BrowserConnectionSnapshot) {
    this.#snapshot = initial;
  }

  getSnapshot = (): BrowserConnectionSnapshot => this.#snapshot;

  subscribe = (listener: BrowserConnectionListener): (() => void) => {
    this.#listeners.add(listener);
    return () => { this.#listeners.delete(listener); };
  };

  transition(snapshot: BrowserConnectionSnapshot): void {
    if (sameSnapshot(this.#snapshot, snapshot)) return;
    this.#snapshot = snapshot;
    for (const listener of this.#listeners) {
      try { listener(snapshot); } catch { /* one view cannot silence another subscriber */ }
    }
  }
}

function sameSnapshot(a: BrowserConnectionSnapshot, b: BrowserConnectionSnapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Start with the reason the vessel can or cannot dial; a live session arrives through the adapter observer. */
export function createBrowserConnectionState(pin: RelayPin, hasContactCard: boolean): BrowserConnectionState & {
  /** @internal Lifecycle writer used by observeRelayConnection. */
  transition(snapshot: BrowserConnectionSnapshot): void;
} {
  const initial: BrowserConnectionSnapshot = pin.dial
    ? hasContactCard
      ? { status: "pinned", gatePubKey: pin.gatePubKey }
      : {
          status: "blocked",
          gatePubKey: pin.gatePubKey,
          reason: "no social contact card is available for the pinned relay crossing",
        }
    : pin.reason
      ? { status: "missing-pin", reason: pin.reason }
      : { status: "local" };
  return new ObservableBrowserConnectionState(initial);
}

/** Bind verified join, refused handshake and disconnect edges without polling or a wall-clock verdict. */
export function observeRelayConnection(
  state: BrowserConnectionState & { transition(snapshot: BrowserConnectionSnapshot): void },
  adapter: RelayConnectionAdapter,
): () => void {
  const initial = state.getSnapshot();
  if (initial.status === "pinned") state.transition({ status: "connecting", gatePubKey: initial.gatePubKey });
  const connect = adapter.connect;
  const join = adapter.join;
  const onClose = adapter.onClose;
  const disconnect = adapter.disconnect;

  adapter.connect = function (this: RelayConnectionAdapter, ...args: never[]): void {
    if (!this.anergized) {
      const current = state.getSnapshot();
      const gatePubKey = current.status === "connected" ? current.peer.gatePubKey
        : "gatePubKey" in current ? current.gatePubKey : null;
      if (gatePubKey) state.transition({ status: "connecting", gatePubKey });
    }
    connect.apply(this, args);
  };
  adapter.join = function (this: RelayConnectionAdapter, ...args: never[]): void {
    join.apply(this, args);
    const session = this.session;
    if (session) state.transition({ status: "connected", peer: { gatePubKey: session.gatePubKey } });
  };
  adapter.onClose = function (this: RelayConnectionAdapter, ...args: never[]): void {
    onClose.apply(this, args);
    transitionAfterClose(state, this);
  };
  adapter.disconnect = function (this: RelayConnectionAdapter, ...args: never[]): void {
    disconnect.apply(this, args);
    transitionAfterClose(state, this);
  };

  return () => {
    adapter.connect = connect;
    adapter.join = join;
    adapter.onClose = onClose;
    adapter.disconnect = disconnect;
  };
}

function transitionAfterClose(
  state: BrowserConnectionState & { transition(snapshot: BrowserConnectionSnapshot): void },
  adapter: RelayConnectionAdapter,
): void {
  const current = state.getSnapshot();
  const gatePubKey = adapter.session?.gatePubKey
    ?? (current.status === "connected" ? current.peer.gatePubKey
      : "gatePubKey" in current ? current.gatePubKey : null);
  if (!gatePubKey) return;
  if (adapter.anergized) {
    state.transition({ status: "refused", gatePubKey, reason: adapter.anergized });
  } else {
    state.transition({ status: "disconnected", gatePubKey });
  }
}
