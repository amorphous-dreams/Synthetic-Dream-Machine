import { describe, expect, test } from "vitest";
import type { BrowserConnectionSnapshot, BrowserConnectionState } from "@lararium/browser";
import mainSource from "../src/main.ts?raw";
import statusSource from "../src/live-status.ts?raw";
import sinkSource from "../src/projection-sink.ts?raw";
import { connectionData, connectionPresentation, defaultReadFace, keptFloorOf, mountLiveStatus, flowElsewhereNote, readFloorCarriage } from "../src/live-status.js";

describe("served-origin crossing", () => {
  test("the read face carries the page origin including its actual port", () => {
    expect(defaultReadFace({ origin: "http://localhost:5417" })).toBe("http://localhost:5417");
  });

  test("RED: no URL names the relay, the floor card or the anchor: the page's arrival sources read no query key and no fragment for them", () => {
    for (const [name, src] of [["main.ts", mainSource], ["live-status.ts", statusSource]] as const) {
      expect(src.includes("location.hash"), `${name} reads the fragment nowhere (TW5's permalink owns it)`).toBe(false);
      expect(/\.get\("(relay|floor|anchor)"\)/.test(src), `${name} reads no relay, floor or anchor key off a URL`).toBe(false);
    }
    // CONTROL: the fragment keeps one reader on the wiki's page, the mirror's own permalink door.
    expect(sinkSource).toContain("location.hash");
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

describe("the floor card the carriage door takes", () => {
  const card = { claim: { kind: "place-floor-pin", aid: "aa".repeat(32), seq: 0, head: "bb".repeat(32), pin: { tier: "floor", nexus: "6e", route: "/flow", transportKey: "aa", signingKey: "bb" }, sig: "cc".repeat(64) }, kel: [] } as never;
  const read = (text: string) => (text === "Y2FyZA" ? card : null);
  const AID = "ab".repeat(32);
  // The mesh's file reader, as the page hands it in (one kind, one key beside it; a second key refuses the file whole).
  const file = (text: string): string | null => {
    try { const v = JSON.parse(text) as Record<string, unknown>; return Object.keys(v).length === 2 && v["kind"] === "floor-card" && typeof v["card"] === "string" ? v["card"] : null; } catch { return null; }
  };
  const floorCardCarriageText = (card: string): string => JSON.stringify({ kind: "floor-card", card });
  const door = { file, card: read };

  test("CONTROL: a carried floor card file reaches the one reader, and reads back", () => {
    expect(readFloorCarriage(floorCardCarriageText("Y2FyZA"), door)).toEqual({ kind: "card", text: "Y2FyZA", card });
  });

  test("a torn card reads as a card that does not read; text of another kind reads as nothing", () => {
    expect(readFloorCarriage(floorCardCarriageText("torn"), door)).toEqual({ kind: "card", text: "torn", card: null });
    expect(readFloorCarriage("", door)).toBeNull();
    expect(readFloorCarriage("#floor=Y2FyZA", door), "a fragment's spelling carries nothing").toBeNull();
    expect(readFloorCarriage(JSON.stringify({ kind: "fleet-join-offer" }), door)).toBeNull();
  });

  test("the place AID, carried alone, reads as an anchor handed apart from the card; a card file never carries one", () => {
    expect(readFloorCarriage(` ${AID}\n`, door)).toEqual({ kind: "anchor", aid: AID });
    expect(readFloorCarriage(JSON.stringify({ kind: "floor-card", card: "Y2FyZA", anchor: AID }), door), "an anchor riding the card's own file refuses the whole file").toBeNull();
  });

  test("what this origin kept: the card and the anchor each read alone, and the card never anchors itself", () => {
    expect(keptFloorOf({ card: "Y2FyZA", anchor: null }, read)).toEqual({ floor: { text: "Y2FyZA", card }, anchor: null });
    expect(keptFloorOf({ card: null, anchor: { aid: AID, via: "admit" } }, read)).toEqual({ floor: null, anchor: { aid: AID, via: "admit" } });
    expect(keptFloorOf({ card: "torn", anchor: { aid: "short", via: "transfer" } }, read)).toEqual({ floor: { text: "torn", card: null }, anchor: null });
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

describe("an ?flow= naming another hearth says what the browser reads", () => {
  test("RED: a host other than the relay's draws the note; CONTROL: the relay's host, or no ?flow=, draws none", () => {
    const relay = "ws://node:5440/ws";   // the relay the page's own origin answered with
    expect(flowElsewhereNote("http://other:5441", relay)).toContain("only its own hearth's flow");
    expect(flowElsewhereNote("http://other:5441", undefined)).toContain("only its own hearth's flow");
    expect(flowElsewhereNote("http://node:5440", relay)).toBeNull();
    expect(flowElsewhereNote(null, relay)).toBeNull();
    expect(flowElsewhereNote("not a url", relay)).toContain("only its own hearth's flow");
  });
});
