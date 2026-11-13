import { describe, expect, test } from "vitest";
import type { BrowserConnectionSnapshot, BrowserConnectionState } from "@lararium/browser";
import { connectionData, connectionPresentation, defaultReadFace, keptFloorOf, mountLiveStatus, readFloorCarriage } from "../src/live-status.js";

describe("served-origin crossing", () => {
  test("the read face carries the page origin including its actual port", () => {
    expect(defaultReadFace({ origin: "http://localhost:5417" })).toBe("http://localhost:5417");
  });

  test("the page's address belongs to TW5: no vessel source reads the query, and the fragment keeps its named readers alone", () => {
    // Every source the page and its workers run. A read of the address names itself here or the census reads red.
    const sources = import.meta.glob("../src/**/*.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
    const query = /location\.search|URLSearchParams|searchParams\.get\(/;
    const fragment = /location\.hash/;
    // The mirror's permalink door reads and writes the wiki's own fragment; the ceremony is a separate document (no wiki
    // stands in it) whose navigation names its ask; the daemon worker reads its own script URL, never the page's.
    const fragmentReaders = ["../src/ceremony/ceremony.ts", "../src/projection-sink.ts"];
    const ownScriptUrlReaders = ["../src/ceremony/ceremony-core.ts", "../src/workers/daemon.worker.ts"];
    expect(Object.keys(sources)).toContain("../src/main.ts");
    expect(Object.entries(sources).filter(([, src]) => query.test(src)).map(([name]) => name).sort(), "sources that read a query string").toEqual(ownScriptUrlReaders);
    expect(Object.entries(sources).filter(([, src]) => fragment.test(src)).map(([name]) => name).sort(), "sources that read the fragment").toEqual(fragmentReaders);
    // CONTROL: the daemon worker's read names its own script URL, and the ceremony parses the hash its own document hands it.
    expect(sources["../src/workers/daemon.worker.ts"]).toContain("new URL(self.location.href).searchParams.get(");
    expect(sources["../src/ceremony/ceremony-core.ts"]).toContain("new URLSearchParams(hash.replace(");
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
