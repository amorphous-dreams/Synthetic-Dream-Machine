import { describe, expect, test } from "vitest";
import type { BrowserConnectionSnapshot, BrowserConnectionState } from "@lararium/browser";
import { connectionData, connectionPresentation, defaultReadFace, floorCardOf, mountLiveStatus, oracleElsewhereNote, resolveRelayUrl } from "../src/live-status.js";

describe("served-origin crossing", () => {
  test("the read face carries the page origin including its actual port", () => {
    expect(defaultReadFace({ origin: "http://localhost:5417" })).toBe("http://localhost:5417");
  });

  test("a pinned same-origin node derives the matching websocket URL", () => {
    expect(resolveRelayUrl(
      { protocol: "https:", host: "lararium.example:5441" },
      new URLSearchParams("gate=abc"),
    )).toBe("wss://lararium.example:5441/ws");
  });

  test("explicit crossing routes stay explicit and no gate means no dial", () => {
    const location = { protocol: "http:", host: "localhost:5417" };
    expect(resolveRelayUrl(location, new URLSearchParams("relay=ws%3A%2F%2Fnode%3A5440%2Fws&gate=abc")))
      .toBe("ws://node:5440/ws");
    expect(resolveRelayUrl(location, new URLSearchParams("relay=ws%3A%2F%2Fnode%3A5440%2Fws")))
      .toBe("ws://node:5440/ws");
    expect(resolveRelayUrl(location, new URLSearchParams())).toBeUndefined();
  });

  test("connection state names local, refusal and the authenticated peer", () => {
    expect(connectionPresentation({ status: "local" }).mode).toContain("local");
    expect(connectionPresentation({ status: "refused", gatePubKey: "abc", reason: "wrong pin" }).connection)
      .toContain("wrong pin");
    expect(connectionPresentation({ status: "connected", peer: { gatePubKey: "abc" } }).mode)
      .toContain("abc");
  });

  test("a blocked crossing keeps the capability reason visible", () => {
    expect(connectionPresentation({
      status: "blocked",
      gatePubKey: "gate-1",
      reason: "no social contact card is available for the pinned relay crossing",
    })).toEqual({
      connection: "blocked — no social contact card is available for the pinned relay crossing",
      mode: "crossing to gate-1 is blocked",
      tone: "warn",
    });
  });

  test("a device with no face joined reads at the floor, by name", () => {
    expect(connectionPresentation({ status: "floor", reason: "no face is joined to this device" })).toMatchObject({
      connection: "at the floor — no face is joined to this device",
      mode: expect.stringContaining("standing at the floor"),
    });
  });

  test("a failed initial dial names a hearth resting at its floor, while a lost session names disconnection", () => {
    const lost = { status: "disconnected", gatePubKey: "gate-1" } as const;
    expect(connectionPresentation(lost)).toMatchObject({
      connection: "no sovereign gate answered — gate-1: the hearth rests at its floor until a person unlocks it, or stands out of reach",
      tone: "warn",
    });
    expect(connectionPresentation(lost, true)).toMatchObject({
      connection: "disconnected from gate-1",
      tone: "warn",
    });
  });
});

describe("the floor card the arrival URL carries", () => {
  const card = { pin: { tier: "floor", nexus: "6e", route: "/oracle", transportKey: "aa", signingKey: "bb" }, publisher: "cc" } as const;
  const read = (text: string) => (text === "Y2FyZA" ? card : null);

  test("CONTROL: a card in the fragment reaches the one reader, and reads back", () => {
    expect(floorCardOf("#floor=Y2FyZA", read)).toEqual({ text: "Y2FyZA", card });
  });

  test("no fragment carries no card, and a torn one reads none", () => {
    expect(floorCardOf("", read)).toBeNull();
    expect(floorCardOf("#relay=x", read)).toBeNull();
    expect(floorCardOf("#floor=torn", read)).toEqual({ text: "torn", card: null });
  });
});

describe("the connection row publishes its mount as data", () => {
  function fakeState(initial: BrowserConnectionSnapshot): BrowserConnectionState & { push(next: BrowserConnectionSnapshot): void } {
    let snapshot = initial;
    const listeners = new Set<(snapshot: BrowserConnectionSnapshot) => void>();
    return {
      getSnapshot: () => snapshot,
      subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
      setWikiDocUrl: () => {},
      push: (next) => { snapshot = next; for (const listener of listeners) listener(next); },
    };
  }

  test("only a proven session names a gate key; the mounted document rides every state that holds one", () => {
    expect(connectionData({ status: "connecting", gatePubKey: "gate-1" })).toEqual({ gateKey: null, wikiDocUrl: null });
    expect(connectionData({ status: "connected", peer: { gatePubKey: "gate-1" }, wikiDocUrl: "automerge:doc" }))
      .toEqual({ gateKey: "gate-1", wikiDocUrl: "automerge:doc" });
    expect(connectionData({ status: "local", wikiDocUrl: "automerge:doc" })).toEqual({ gateKey: null, wikiDocUrl: "automerge:doc" });
  });

  test("the element carries data-gate-key and data-wiki-doc-url, and drops the gate key when the session ends", () => {
    const parent = document.createElement("div");
    const state = fakeState({ status: "connecting", gatePubKey: "gate-1" });
    const stop = mountLiveStatus(parent, state);
    const row = parent.querySelector<HTMLElement>('[data-live-status="connection"]')!;
    expect(row.getAttribute("data-standing")).toBe("connecting");
    // CONTROL: a pinned, unproven crossing names no gate key and no mount.
    expect(row.hasAttribute("data-gate-key")).toBe(false);
    expect(row.hasAttribute("data-wiki-doc-url")).toBe(false);

    state.push({ status: "connected", peer: { gatePubKey: "gate-1" }, wikiDocUrl: "automerge:doc" });
    expect(row.getAttribute("data-gate-key")).toBe("gate-1");
    expect(row.getAttribute("data-standing")).toBe("connected");
    expect(row.getAttribute("data-wiki-doc-url")).toBe("automerge:doc");

    state.push({ status: "disconnected", gatePubKey: "gate-1", wikiDocUrl: "automerge:doc" });
    expect(row.hasAttribute("data-gate-key")).toBe(false);
    expect(row.getAttribute("data-wiki-doc-url")).toBe("automerge:doc");
    expect(row.textContent).toBe("disconnected from gate-1");
    stop();
  });
});

describe("an ?oracle= naming another hearth says what the browser reads", () => {
  test("RED: a host other than the relay's draws the note; CONTROL: the relay's host, or no ?oracle=, draws none", () => {
    const relay = "ws://node:5440/ws";
    expect(oracleElsewhereNote("http://other:5441", relay)).toContain("only its own hearth's oracle");
    expect(oracleElsewhereNote("http://other:5441", undefined)).toContain("only its own hearth's oracle");
    expect(oracleElsewhereNote("http://node:5440", relay)).toBeNull();
    expect(oracleElsewhereNote(null, relay)).toBeNull();
    expect(oracleElsewhereNote("not a url", relay)).toContain("only its own hearth's oracle");
  });
});
