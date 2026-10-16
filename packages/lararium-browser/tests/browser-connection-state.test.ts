import { describe, expect, test } from "vitest";
import { createBrowserConnectionState, crossingStandingOf, observeRelayConnection } from "../src/browser-connection-state.js";

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
  const at = (over: Partial<Parameters<typeof crossingStandingOf>[0]> = {}) => crossingStandingOf({
    relayUrl: "ws://hearth:8080/ws", faceJoined: true, pinnedGateKey: GATE, presentationRefusal: null, hasContactCard: true, ...over,
  });

  test("no relay stands local", () => {
    expect(at({ relayUrl: undefined })).toEqual({ status: "local" });
  });

  test("a device with no face joined stands at the floor, and names it", () => {
    expect(at({ faceJoined: false, pinnedGateKey: null })).toMatchObject({ status: "floor", reason: expect.stringMatching(/no face is joined to this device/) });
  });

  test("a joined face whose join carried no pin for this hearth names the pin", () => {
    expect(at({ pinnedGateKey: null })).toMatchObject({ status: "missing-pin", reason: expect.stringMatching(/no sovereign gate pin is held for this hearth/) });
  });

  test("a valid pin without a contact card names why no adapter can stand", () => {
    expect(at({ hasContactCard: false })).toEqual({
      status: "blocked",
      gatePubKey: GATE,
      reason: "no social contact card is available for the pinned relay crossing",
    });
  });

  test("a joined face that composes no presentation names its refusal", () => {
    expect(at({ presentationRefusal: "dial-absent" })).toEqual({ status: "blocked", gatePubKey: GATE, reason: "the joined face presents nothing here (dial-absent)" });
  });

  test("CONTROL: a joined face, its pin, its card and its presentation stand pinned", () => {
    expect(at()).toEqual({ status: "pinned", gatePubKey: GATE });
  });

  test("CONTROL: a verified adapter join publishes its gate-bound identity and disconnect", () => {
    const state = createBrowserConnectionState({ status: "pinned", gatePubKey: GATE });
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
    const state = createBrowserConnectionState({ status: "pinned", gatePubKey: GATE });
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
    const state = createBrowserConnectionState({ status: "pinned", gatePubKey: GATE });
    const adapter = new FakeRelayAdapter();
    observeRelayConnection(state, adapter);

    adapter.anergized = "device has no vouch";
    adapter.onClose();
    expect(state.getSnapshot()).toEqual({ status: "refused", gatePubKey: GATE, reason: "device has no vouch" });
  });
});
