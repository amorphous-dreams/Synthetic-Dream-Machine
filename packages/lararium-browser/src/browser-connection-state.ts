/** A visible snapshot of the browser vessel's relay crossing. */
export type BrowserConnectionSnapshot = (
  | { readonly status: "local" }
  | { readonly status: "floor"; readonly reason: string }
  | { readonly status: "missing-pin"; readonly reason: string }
  | { readonly status: "blocked"; readonly gatePubKey: string; readonly reason: string }
  | { readonly status: "pinned"; readonly gatePubKey: string }
  | { readonly status: "connecting"; readonly gatePubKey: string }
  | { readonly status: "refused"; readonly gatePubKey: string; readonly reason: string }
  | { readonly status: "connected"; readonly peer: { readonly gatePubKey: string } }
  | { readonly status: "disconnected"; readonly gatePubKey: string }
) & { readonly wikiDocUrl?: string };

export type BrowserConnectionListener = (snapshot: BrowserConnectionSnapshot) => void;

/** Stable observable surface for a browser page that paints the vessel's current crossing. */
export interface BrowserConnectionState {
  getSnapshot(): BrowserConnectionSnapshot;
  subscribe(listener: BrowserConnectionListener): () => void;
  /** The mounted wiki's document address joins every later crossing snapshot. */
  setWikiDocUrl(url: string): void;
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
  #wikiDocUrl: string | null = null;
  readonly #listeners = new Set<BrowserConnectionListener>();

  constructor(initial: BrowserConnectionSnapshot) {
    this.#snapshot = initial;
  }

  getSnapshot = (): BrowserConnectionSnapshot => this.#wikiDocUrl
    ? { ...this.#snapshot, wikiDocUrl: this.#wikiDocUrl }
    : this.#snapshot;

  subscribe = (listener: BrowserConnectionListener): (() => void) => {
    this.#listeners.add(listener);
    return () => { this.#listeners.delete(listener); };
  };

  transition(snapshot: BrowserConnectionSnapshot): void {
    const enriched = this.#wikiDocUrl ? { ...snapshot, wikiDocUrl: this.#wikiDocUrl } : snapshot;
    if (sameSnapshot(this.getSnapshot(), enriched)) return;
    this.#snapshot = snapshot;
    this.#publish();
  }

  setWikiDocUrl(url: string): void {
    if (!url) throw new Error("mounted wiki document URL must be non-empty");
    if (this.#wikiDocUrl === url) return;
    this.#wikiDocUrl = url;
    this.#publish();
  }

  #publish(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.#listeners) {
      try { listener(snapshot); } catch { /* one view cannot silence another subscriber */ }
    }
  }
}

function sameSnapshot(a: BrowserConnectionSnapshot, b: BrowserConnectionSnapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * What a device's crossing stands on before any dial: a relay or none, a face joined to it or none, the sovereign pin held
 * for the relay's hearth, and the presentation the joined face composed or the reason it did not.
 */
export interface CrossingInputs {
  readonly relayUrl:        string | null | undefined;
  /** The face this vessel's boot stands on carries a fleet join: a hearth admitted it. */
  readonly faceJoined:      boolean;
  /** The signing key of the sovereign pin held for the relay's hearth, or null. */
  readonly pinnedGateKey:   string | null;
  /** Why the joined face composes no presentation, or null when it stands. */
  readonly presentationRefusal: string | null;
  readonly hasContactCard:  boolean;
}

/**
 * The crossing's first snapshot, each absence by name. A device stands at the floor until a person joins a face to it
 * (operator ruling, 2026-10-16: browser devices stand at the floor); a joined face crosses only under the full sovereign
 * pin its fleet join carried, and only under a presentation it composed.
 */
export function crossingStandingOf(at: CrossingInputs): BrowserConnectionSnapshot {
  if (!at.relayUrl) return { status: "local" };
  if (!at.faceJoined) {
    return { status: "floor", reason: "no face is joined to this device: it reads what the hearth's floor offers, and a person joins a face by the fleet-join door" };
  }
  if (at.pinnedGateKey === null) {
    return { status: "missing-pin", reason: "no sovereign gate pin is held for this hearth: the face's fleet join with this hearth carries it" };
  }
  if (!at.hasContactCard) {
    return { status: "blocked", gatePubKey: at.pinnedGateKey, reason: "no social contact card is available for the pinned relay crossing" };
  }
  if (at.presentationRefusal !== null) {
    return { status: "blocked", gatePubKey: at.pinnedGateKey, reason: `the joined face presents nothing here (${at.presentationRefusal})` };
  }
  return { status: "pinned", gatePubKey: at.pinnedGateKey };
}

/** Start with the crossing's first snapshot; a live session arrives through the adapter observer. */
export function createBrowserConnectionState(initial: BrowserConnectionSnapshot): BrowserConnectionState & {
  /** @internal Lifecycle writer used by observeRelayConnection. */
  transition(snapshot: BrowserConnectionSnapshot): void;
  setWikiDocUrl(url: string): void;
} {
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
