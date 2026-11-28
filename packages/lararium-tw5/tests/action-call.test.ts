/**
 * action-call — a button runs one call through the house's one door (`$tw.lares.call`) and the answer lands as a
 * tiddler at `$:/state/lares/call/<request-id>`. The call fires when the action fires and never at render. The call
 * face itself (plan, bind, dispatch through `$tw.lares.callDoor`) has its own suites; here a stub face stands in, so
 * each test reads the widget's half alone: what it sends, and what it lands.
 */
import { describe, test, expect, beforeAll, afterEach } from "vitest";
import { bootTestWiki, renderWikitext, wikiSkip, skipNote } from "./test-wiki.js";
import type { TW5Engine } from "../src/tw5-vm.js";
import { laresActOf, LARES_STATUS_DOOR } from "../src/modules/call.js";

type Face = (word: string, params?: Record<string, unknown>) => Promise<Record<string, unknown>>;

describe.skipIf(wikiSkip)(`<$action-call> lands the door's answer as a tiddler${skipNote}`, () => {
  let e: TW5Engine;
  let real: Face | undefined;
  const lares = (): { call?: Face } => ((e.$tw as unknown as { lares: { call?: Face } }).lares);
  const fire = (action: string): void =>
    (e.$tw as unknown as { rootWidget: { invokeActionString(s: string): void } }).rootWidget.invokeActionString(action);
  const field = (title: string, key: string): string => String(e.wiki.getTiddler(title)?.fields[key] ?? "");
  const settled = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
  beforeAll(async () => { e = await bootTestWiki(); real = lares().call; }, 60_000);
  afterEach(() => { lares().call = real; });

  test("the engine publishes the call face the widget fires through", () => {
    expect(typeof real).toBe("function");
  });

  test("RED: rendering the button calls nothing; firing it lands owed, then the answer with its word and params", async () => {
    const asked: Array<{ word: string; params: Record<string, unknown> }> = [];
    let answer!: (value: Record<string, unknown>) => void;
    lares().call = (word, params = {}) => { asked.push({ word, params }); return new Promise((resolve) => { answer = resolve; }); };
    renderWikitext(e, `<$button>Read<$action-call $word="get" title="Room 4" mu="?0"/></$button>`);
    expect(asked).toEqual([]);
    fire(`<$action-call $word="get" title="Room 4" mu="?0" text="" $request="r1"/>`);
    const title = "$:/state/lares/call/r1";
    expect(asked).toEqual([{ word: "get", params: { title: "Room 4", mu: "?0" } }]);   // a blank attribute rides no param
    expect(field(title, "band")).toBe("owed");
    expect(field(title, "request-id")).toBe("r1");
    answer({ band: "answered", human: "Room 4 reads three lines" });
    await settled();
    expect(field(title, "band")).toBe("answered");
    expect(field(title, "text")).toBe("Room 4 reads three lines");
    expect(field(title, "word")).toBe("get");
    expect(JSON.parse(field(title, "params"))).toEqual({ title: "Room 4", mu: "?0" });
    expect(JSON.parse(field(title, "answer"))).toMatchObject({ human: "Room 4 reads three lines" });
  });

  test("a refusal lands band void with the door's code; `$result` names where it lands", async () => {
    lares().call = () => Promise.reject(Object.assign(new Error("the island's door refused the call: hand-act-only"), { reason: "hand-act-only" }));
    fire(`<$action-call $word="rite kukulu" $result="$:/temp/kukulu"/>`);
    await settled();
    expect(field("$:/temp/kukulu", "band")).toBe("void");
    expect(field("$:/temp/kukulu", "refused")).toBe("hand-act-only");
  });

  test("the ~lares sigil renders a button for one act key, prose for emote, and refuses two act keys", () => {
    const html = (text: string): string => renderWikitext(e, text);
    expect(html("<<~ lares get=`Room 4`>>")).toContain("lar-lares-call");
    expect(html("<<~ lares emote=`sets down the cup`>>")).toContain("sets down the cup");
    expect(html("<<~ lares emote=`sets down the cup`>>")).not.toContain("lar-lares-call");
    expect(html("<<~ lares get=`a` put=`b`>>")).toContain("two act keys refuse");
    expect(html("<<~ lares>>")).toContain("lar-lares-status");
  });
});

describe("laresActOf folds ~lares the way its button does", () => {
  test("get, put, delete and rename name the verb and the title; title= wins", () => {
    expect(laresActOf({ get: "Room 4", mu: "?0" })).toEqual({ word: "get", params: { title: "Room 4", mu: "?0" } });
    expect(laresActOf({ rename: "a", to: "b" })).toEqual({ word: "rename", params: { title: "a", to: "b" } });
    expect(laresActOf({ put: "x", title: "y" }).params["title"]).toBe("y");
  });
  test("filter rides the get door; act names the word itself; emote rides no param", () => {
    expect(laresActOf({ filter: "[tag[a]]" })).toEqual({ word: "get", params: { filter: "[tag[a]]" } });
    expect(laresActOf({ act: "rite kukulu", mu: "_!", emote: "leans in" })).toEqual({ word: "rite kukulu", params: { mu: "_!" } });
  });
  test("no act key opens the status door; two refuse", () => {
    expect(laresActOf({ aperture: "measure" })).toEqual({ word: LARES_STATUS_DOOR, params: { aperture: "measure" } });
    expect(() => laresActOf({ get: "a", put: "b" })).toThrow(/2 act keys/);
  });
});
