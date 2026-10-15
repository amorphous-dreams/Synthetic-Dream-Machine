import { describe, expect, test } from "vitest";
import { createBrowserConnectionState, observeRelayConnection } from "../src/browser-connection-state.js";

class FakeRelayAdapter {
  session: { nonce: string; gatePubKey: string } | null = null;
  anergized: string | null = null;
  connect = (): void => {};
  onClose = (): void => {};
  join = (): void => {};
  readonly listeners = new Map<string, Array<(payload: unknown) => void>>();

  on(event: string, listener: (payload: unknown) => void): void {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
  }

  emit(event: string, payload: unknown): void {
    for (const listener of this.listeners.get(event) ?? []) listener(payload);
  }
}

const GATE = "ab".repeat(32);

describe("browser connection state", () => {
  test("a configured relay without a gate pin has a named missing-pin state", () => {
    const state = createBrowserConnectionState({ dial: false, reason: "no gate key pinned" }, false);
    expect(state.getSnapshot()).toMatchObject({ status: "missing-pin", reason: "no gate key pinned" });
  });

  test("a valid pin without a contact card names why no adapter can stand", () => {
    const state = createBrowserConnectionState({ dial: true, gatePubKey: GATE }, false);
    expect(state.getSnapshot()).toEqual({
      status: "blocked",
      gatePubKey: GATE,
      reason: "no social contact card is available for the pinned relay crossing",
    });
  });

  test("CONTROL: a verified adapter join publishes its gate-bound identity and disconnect", () => {
    const state = createBrowserConnectionState({ dial: true, gatePubKey: GATE }, true);
    const adapter = new FakeRelayAdapter();
    const transitions: string[] = [];
    state.subscribe((snapshot) => transitions.push(snapshot.status));
    observeRelayConnection(state, adapter);

    adapter.session = { nonce: "challenge", gatePubKey: GATE };
    adapter.join();
    expect(state.getSnapshot()).toEqual({ status: "connected", peer: { gatePubKey: GATE } });

    adapter.session = null;
    adapter.onClose();
    expect(state.getSnapshot()).toEqual({ status: "disconnected", gatePubKey: GATE });
    adapter.connect();
    expect(state.getSnapshot()).toEqual({ status: "connecting", gatePubKey: GATE });
    expect(transitions).toEqual(["connecting", "connected", "disconnected", "connecting"]);
  });

  test("a mounted wiki URL rides the reactive connection snapshot", () => {
    const state = createBrowserConnectionState({ dial: true, gatePubKey: GATE }, true);
    const adapter = new FakeRelayAdapter();
    observeRelayConnection(state, adapter);
    const transitions: unknown[] = [];
    state.subscribe((snapshot) => transitions.push(snapshot));

    state.setWikiDocUrl("automerge:aki-mounted-doc");
    adapter.session = { nonce: "challenge", gatePubKey: GATE };
    adapter.join();

    expect(state.getSnapshot()).toMatchObject({
      status: "connected",
      peer: { gatePubKey: GATE },
      wikiDocUrl: "automerge:aki-mounted-doc",
    });
    expect(transitions).toHaveLength(2);
    expect(transitions[0]).toMatchObject({ wikiDocUrl: "automerge:aki-mounted-doc" });
  });

  test("a refused handshake names its reason instead of collapsing into disconnection", () => {
    const state = createBrowserConnectionState({ dial: true, gatePubKey: GATE }, true);
    const adapter = new FakeRelayAdapter();
    observeRelayConnection(state, adapter);

    adapter.anergized = "device has no vouch";
    adapter.onClose();
    expect(state.getSnapshot()).toEqual({ status: "refused", gatePubKey: GATE, reason: "device has no vouch" });
  });
});
