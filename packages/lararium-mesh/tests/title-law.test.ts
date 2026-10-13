/**
 * title-law — a session-form URI never stands as a TITLE, and the store's write door holds that law.
 *
 * `lar://alias:grant@host/path` names a speaker and a grant. In a record's text it reads lawful; as a
 * title it would freeze alias × grant × host into a key no tier, redaction or tombstone reaches
 * (`lar:///ha.ka.ba/lares/api/pono/lar-uri#/security`). Every durable title passes a store write, so the
 * door refuses there: a put, a family write and a tombstone alike, by name, before any byte moves.
 */
import { describe, expect, test } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { AutomergeDocStore } from "../src/automerge-doc-store.js";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";
import type { ChangeOrigin } from "../src/tiddler-store.js";
import { SESSION_FORM_TITLE_CODE, SessionFormTitleRefusal, assertStorableTitle, larUserinfoOf, storableTitleFault } from "../src/title-law.js";
import { isVerbRefusal } from "../src/verb-refusal.js";
import * as larUris from "../src/lar-uris.js";
import { storedRecord, storedLarRecord } from "../src/stored-record.js";

const BAG = "lar:///ha.ka.ba/bags/title-law";
const origin: ChangeOrigin = { kind: "lares-verb", requestId: "req-title-law" };

/** Titles that carry a userinfo, in every spelling the parse must read. */
const SESSION_FORM = [
  "lar://mara:operator@crossroads/t.title.banned/one",
  "lar://mara:operator@crossroads/t.title.banned/one#/slot",
  "lar://mara@crossroads/t.title.banned/one",
  "lar://@crossroads/t.title.banned/one",
  "lar://mara:operator@crossroads",
  "lar://mara:operator@crossroads?q=1",
  "LAR://mara:operator@crossroads/t.title.banned/one",
  "lar://a:b@c:d@host/t.title.banned/one",
] as const;

/** Titles the law lets stand: hostful, hostless, and strings that name no `lar://` authority. */
const STORABLE = [
  "lar://crossroads/t.title.allowed/one",
  "lar:///t.title.plain/one",
  "lar:///ha.ka.ba/lares/api/pono/lar-uri#/security",
  "lar:///t.title.plain/mara:operator@crossroads",
  "lar://crossroads/t.title.allowed/user@example.com",
  "lar://crossroads/t.title.allowed/one#/who@where",
  "lar://crossroads/t.title.allowed/one?to=a@b",
  "lar://crossroads?to=a@b",
  "lar://crossroads#/who@where",
  "My Notes",
  "$:/config/Foo",
  "mara:operator@crossroads",
  "mailto:mara@example.com",
  "",
] as const;

function stand() {
  const handle = new Repo({ network: [] }).create<LarDoc>(emptyLarDoc());
  return { handle, store: new AutomergeDocStore(handle, BAG) };
}

describe("the parse reads the authority's userinfo slot and nothing else", () => {
  test("the userinfo reads as the span ahead of the authority's first literal @", () => {
    expect(larUserinfoOf("lar://mara:operator@crossroads/t.x.y/z")).toBe("mara:operator");
    expect(larUserinfoOf("lar://@crossroads/t.x.y/z")).toBe("");
    expect(larUserinfoOf("lar://a:b@c:d@host/x")).toBe("a:b");
    for (const title of STORABLE) expect(larUserinfoOf(title), title).toBeNull();
  });

  test("every session-form title names a fault, by its code and with the title", () => {
    for (const title of SESSION_FORM) {
      const fault = storableTitleFault(title);
      expect(fault, title).not.toBeNull();
      expect(fault!.startsWith(`${SESSION_FORM_TITLE_CODE}: `), title).toBe(true);
      expect(fault, title).toContain(title);
    }
  });

  test("a host that hides the boundary behind a percent-encoded @ refuses too", () => {
    for (const title of ["lar://mara%40crossroads/t.x.y/z", "lar://mara%3Aoperator%40crossroads/t.x.y/z"]) {
      expect(storableTitleFault(title), title).toContain("percent-encoded");
    }
    // CONTROL: `%40` past the authority reads as path text.
    expect(storableTitleFault("lar://crossroads/t.x.y/a%40b")).toBeNull();
  });

  test("CONTROL: hostful, hostless and non-lar titles all stand", () => {
    for (const title of STORABLE) {
      expect(storableTitleFault(title), title).toBeNull();
      expect(() => assertStorableTitle(title)).not.toThrow();
    }
  });

  test("the refusal reads as a VerbRefusal that carries its reason and its title", () => {
    const refusal = (() => { try { assertStorableTitle(SESSION_FORM[0]); } catch (e) { return e; } return null; })();
    expect(refusal).toBeInstanceOf(SessionFormTitleRefusal);
    expect(isVerbRefusal(refusal)).toBe(true);
    expect((refusal as SessionFormTitleRefusal).reason).toBe(SESSION_FORM_TITLE_CODE);
    expect((refusal as SessionFormTitleRefusal).title).toBe(SESSION_FORM[0]);
  });

  test("the law rides the pure `lar-uris` door", () => {
    expect(larUris.assertStorableTitle).toBe(assertStorableTitle);
    expect(larUris.storableTitleFault).toBe(storableTitleFault);
    expect(larUris.SESSION_FORM_TITLE_CODE).toBe(SESSION_FORM_TITLE_CODE);
  });
});

describe("the stored shape holds the law for every hand that writes a document", () => {
  test("storedRecord and storedLarRecord refuse a session-form title; a registry row or a board row lands none", () => {
    for (const title of SESSION_FORM) {
      expect(() => storedRecord({ tiddler: { title, text: "x" } }), title).toThrow(SessionFormTitleRefusal);
      expect(() => storedLarRecord(title, { text: "automerge:doc" }, "lares-verb:CREATE"), title).toThrow(SessionFormTitleRefusal);
    }
  });

  test("CONTROL: a storable title takes its stored shape, and a userinfo in a FIELD rides untouched", () => {
    for (const title of STORABLE) expect(() => storedRecord({ tiddler: { title, text: "x" } }), title).not.toThrow();
    const stored = storedRecord({ tiddler: { title: "lar:///t.title.context/capture", text: "lar://alias:grant@host/x.y.z", speaker: "lar://mara:operator@crossroads/x.y.z" } }) as unknown as { tiddler: Record<string, unknown> };
    expect(String(stored.tiddler["text"])).toBe("lar://alias:grant@host/x.y.z");
    expect(String(stored.tiddler["speaker"])).toBe("lar://mara:operator@crossroads/x.y.z");
  });
});

describe("the store's write door refuses a session-form title", () => {
  for (const title of SESSION_FORM) {
    test(`a put refuses by name and writes nothing: ${title}`, async () => {
      const { store } = stand();
      const before = store.headsNow();
      await expect(store.put({ tiddler: { title, text: "a body" } }, origin)).rejects.toMatchObject({ name: "VerbRefusal", reason: SESSION_FORM_TITLE_CODE });
      expect(await store.listVisible()).toEqual([]);
      expect(store.headsNow()).toEqual(before);
    });
  }

  test("a tombstone against an absent session-form title refuses: it would mint the key", async () => {
    const { store, handle } = stand();
    const before = store.headsNow();
    await expect(store.tombstone(SESSION_FORM[0], origin)).rejects.toMatchObject({ reason: SESSION_FORM_TITLE_CODE });
    expect(Object.keys(handle.doc()!.tiddlers ?? {})).toEqual([]);
    expect(store.listTombstoned()).toEqual([]);
    expect(store.headsNow()).toEqual(before);
  });

  test("a family holding one session-form title refuses WHOLE: its lawful siblings land nowhere", async () => {
    const { store } = stand();
    const before = store.headsNow();
    await expect(store.writeFamily(
      [{ tiddler: { title: "lar:///t.title.plain/root", text: "root" } }, { tiddler: { title: SESSION_FORM[1], text: "child" } }],
      [], origin,
    )).rejects.toMatchObject({ reason: SESSION_FORM_TITLE_CODE });
    await expect(store.writeFamily([{ tiddler: { title: "lar:///t.title.plain/root", text: "root" } }], [SESSION_FORM[0]], origin))
      .rejects.toMatchObject({ reason: SESSION_FORM_TITLE_CODE });
    expect(await store.listVisible()).toEqual([]);
    expect(store.headsNow()).toEqual(before);
  });

  test("CONTROL: a userinfo in the TEXT lands untouched, under a hostful and under a hostless title", async () => {
    const { store } = stand();
    const text = `<<~ lares aim from="lar://mara:operator@crossroads/operator.asks.the-cost" -> to="lar://compita:agent@crossroads/clerk.reads.the-record">>\n\nA quoted link: lar://alias:grant@host/some.path.here\n`;
    await store.put({ tiddler: { title: "lar://crossroads/t.title.allowed/capture", text } }, origin);
    await store.put({ tiddler: { title: "lar:///t.title.context/capture", text, speaker: "lar://mara:operator@crossroads/x.y.z" } }, origin);
    expect((await store.get("lar://crossroads/t.title.allowed/capture"))?.tiddler["text"]).toBe(text);
    expect((await store.get("lar:///t.title.context/capture"))?.tiddler["text"]).toBe(text);
    expect((await store.get("lar:///t.title.context/capture"))?.tiddler["speaker"]).toBe("lar://mara:operator@crossroads/x.y.z");
  });

  test("CONTROL: every storable title lands and tombstones through the same door", async () => {
    const { store } = stand();
    const titles = STORABLE.filter((t) => t !== "");
    for (const title of titles) await store.put({ tiddler: { title, text: "ok" } }, origin);
    expect((await store.listVisible()).sort()).toEqual([...titles].sort());
    await store.tombstone(titles[0]!, origin);
    expect(store.listTombstoned()).toEqual([titles[0]]);
  });

  test("a hard remove of a session-form key that already stands stays open: the way out of the key", async () => {
    const { store, handle } = stand();
    // A key an earlier writer left, planted beneath the door.
    handle.change((doc) => { (doc.tiddlers as unknown as Record<string, unknown>)[SESSION_FORM[0]] = { tiddler: { title: SESSION_FORM[0], text: "left by an earlier hand" }, meta: {} }; });
    expect(await store.listVisible()).toEqual([SESSION_FORM[0]]);
    await store.remove(SESSION_FORM[0], origin);
    expect(await store.get(SESSION_FORM[0])).toBeNull();
  });
});
