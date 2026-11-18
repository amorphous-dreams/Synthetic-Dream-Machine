/**
 * projection-lar-field.test — the editor's engine seam and the control table, over a real booted wiki.
 *
 * `$edit-text` on the fake document builds through a third engine handed to TW5's own editor factory: the field
 * paints inside `<lar-field>`, `setText` writes a value descriptor and never the child text, a text operation runs
 * TW5's own operation module over the pair the act carried, and the stock edit template reaches the same seam
 * through `$edit`. The control table stamps `data-lar-control` on the nodes the page binds a control to. Each
 * vector names its control.
 */
import { afterEach, describe, expect, test } from "vitest";
import { dispatchLarControlEvent } from "../src/tw5-projection.js";
import { htmlOf, mountSurface, type Surface } from "./projection-surface.js";
import { skipNote, wikiSkip } from "./test-wiki.js";

const T = (n: string): string => `lar:///t/lar-field/${n}`;
const text = (s: Surface, title: string): unknown => s.wiki.getTiddler(title)?.fields["text"];
const BOLD = `\\procedure bold() <$action-sendmessage $message="tm-edit-text-operation" $param="wrap-selection" prefix="''" suffix="''"/>\n`;
/** The opening tag of the first painted node wearing class `cls`. */
const tagOf = (html: string, cls: string): string =>
  [...html.matchAll(/<[a-zA-Z][\w-]*\b[^>]*>/g)].map((m) => m[0]).find((t) => new RegExp(`class="[^"]*(?<![\\w-])${cls}(?![\\w-])`).test(t)) ?? "";
const attr = (tag: string, name: string): string | null => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1] ?? null;

describe.skipIf(wikiSkip)(`the editor's engine seam and the control table${skipNote}`, () => {
  let s: Surface | undefined;
  afterEach(() => { s?.stop(); s = undefined; });

  test("a field paints inside lar-field with a value descriptor; a store write moves the descriptor and its revision, never the child text", async () => {
    s = await mountSurface(`<$edit-text tiddler="${T("body")}" tag="textarea" class="body"/>`, [{ title: T("body"), text: "mine" }]);
    const first = htmlOf(s.last());
    expect(first).toMatch(/<lar-field data-lar-control="lar-field"><textarea [^>]*class="body"[^>]*>mine<\/textarea><\/lar-field>/);
    expect(attr(tagOf(first, "body"), "data-lar-value")).toBe("mine");
    const rev = Number(attr(tagOf(first, "body"), "data-lar-value-rev"));
    s.wiki.addTiddler({ title: T("body"), text: "theirs" });
    await s.flush();
    const next = htmlOf(s.last());
    expect(attr(tagOf(next, "body"), "data-lar-value")).toBe("theirs");
    expect(Number(attr(tagOf(next, "body"), "data-lar-value-rev"))).toBeGreaterThan(rev);
    // CONTROL: the native carrier keeps the first value; the page reads the descriptor, never the child text.
    expect(next).toMatch(/class="body"[^>]*>mine<\/textarea>/);
  }, 120_000);

  test("getText reads the page's last word: a sense lands on the node and the store takes it; CONTROL: a peer write after it moves only the descriptor", async () => {
    s = await mountSurface(`<$edit-text tiddler="${T("body")}" tag="input" class="body"/>`, [{ title: T("body"), text: "a" }]);
    expect(dispatchLarControlEvent(s.event("body", { kind: "lar:sense", action: "lar:sense", wholeValue: "ab", localRev: 1 }))).toBeNull();
    await s.flush();
    expect(text(s, T("body"))).toBe("ab");
    s.wiki.addTiddler({ title: T("body"), text: "peer" });
    await s.flush();
    expect(attr(tagOf(htmlOf(s.last()), "body"), "data-lar-value")).toBe("peer");
    // take-theirs: the node reads the descriptor whole, so a commit of it writes nothing new.
    expect(dispatchLarControlEvent(s.event("body", { kind: "lar:act", action: "lar:take-theirs" }))).toMatchObject({ status: "applied" });
    expect(dispatchLarControlEvent(s.event("body", { kind: "lar:act", action: "lar:commit", wholeValue: "peer", localRev: 2 }))).toMatchObject({ status: "applied" });
    await s.flush();
    expect(text(s, T("body"))).toBe("peer");
  }, 120_000);

  test("the stock edit template reaches the seam through $edit; CONTROL: a plain transclusion paints no lar-field", async () => {
    s = await mountSurface(`<$edit tiddler="${T("body")}" field="text" class="body"/><span class="plain">{{${T("body")}}}</span>`, [{ title: T("body"), text: "via edit" }]);
    const html = htmlOf(s.last());
    expect(html.match(/<lar-field /g)?.length).toBe(1);
    expect(attr(tagOf(html, "body"), "data-lar-value")).toBe("via edit");
  }, 120_000);

  test("a toolbar act runs TW5's own wrap-selection over the carried pair and answers what the engine wants; CONTROL: two fields and no field named refuse selection-unavailable", async () => {
    s = await mountSurface(`${BOLD}<$edit-text tiddler="${T("body")}" tag="textarea" class="body"/><$button class="bold" actions=<<bold>>>bold</$button>`, [{ title: T("body"), text: "wrap me please" }]);
    expect(dispatchLarControlEvent(s.event("bold", { kind: "lar:act", action: "lar:edit-operation", wholeValue: "wrap me please", selection: { start: 5, end: 7 }, localRev: 0 })))
      .toMatchObject({ status: "applied", want: { value: "wrap ''me'' please", selStart: 5, selEnd: 11 } });
    await s.flush();
    expect(text(s, T("body"))).toBe("wrap ''me'' please");
    expect(s.last().sensedRevision[s.rid("body")], "the island took in the revision the page reserved for the answer").toBe(1);
    s.stop();
    s = await mountSurface(`${BOLD}<$edit-text tiddler="${T("a")}" tag="input" class="a"/><$edit-text tiddler="${T("b")}" tag="input" class="b"/><$button class="bold" actions=<<bold>>>bold</$button>`, [{ title: T("a"), text: "one" }, { title: T("b"), text: "two" }]);
    expect(dispatchLarControlEvent(s.event("bold", { kind: "lar:act", action: "lar:edit-operation", wholeValue: "two", selection: { start: 0, end: 3 }, localRev: 0 })))
      .toMatchObject({ status: "refused", reason: "selection-unavailable" });
    expect(dispatchLarControlEvent(s.event("bold", { kind: "lar:act", action: "lar:edit-operation", wholeValue: "two", selection: { start: 0, end: 3 }, localRev: 0, fieldId: s.rid("b") })))
      .toMatchObject({ status: "applied", want: { value: "''two''" } });
    await s.flush();
    expect([text(s, T("a")), text(s, T("b"))]).toEqual(["one", "''two''"]);
  }, 120_000);

  test("the control table stamps a popup reveal, a state reveal and a toolbar button; CONTROL: a plain button and a plain div carry none", async () => {
    s = await mountSurface([
      `<$reveal type="popup" state="${T("popup")}" class="pop">menu</$reveal>`,
      `<$reveal type="match" state="${T("open")}" text="yes" class="disc">body</$reveal>`,
      `<$button class="op" message="tm-edit-text-operation" param="excise">cut</$button>`,
      `<$button class="plain" set="${T("x")}" setTo="1">plain</$button><div class="div">d</div>`,
    ].join(""), [{ title: T("open"), text: "yes" }]);
    const html = htmlOf(s.last());
    expect(attr(tagOf(html, "pop"), "data-lar-control")).toBe("lar-popover");
    expect(attr(tagOf(html, "disc"), "data-lar-control")).toBe("lar-disclosure");
    expect(attr(tagOf(html, "op"), "data-lar-control")).toBe("lar-field-operation");
    expect(attr(tagOf(html, "plain"), "data-lar-control")).toBeNull();
    expect(attr(tagOf(html, "div"), "data-lar-control")).toBeNull();
  }, 120_000);

  test("lar:dismiss closes the popup the camera's manager holds; CONTROL: before it, the popup stands open", async () => {
    s = await mountSurface(`<$button class="opener" popup="${T("popup")}">open</$button><$reveal type="popup" state="${T("popup")}" class="pop">menu</$reveal>`);
    const geometry = { top: 34, left: 12, right: 112, bottom: 54, width: 100, height: 20 };
    expect(dispatchLarControlEvent(s.event("opener", { kind: "lar:act", action: "lar:click", geometry, modifiers: { ctrl: false, meta: false, alt: false, shift: false, button: 0 } }))).toMatchObject({ status: "applied" });
    await s.flush();
    expect(s.wiki.getTiddler(T("popup"))).toBeDefined();
    expect(dispatchLarControlEvent(s.event("opener", { kind: "lar:act", action: "lar:dismiss", controlType: "lar-popover" }))).toMatchObject({ status: "applied" });
    await s.flush();
    expect(s.wiki.getTiddler(T("popup"))).toBeUndefined();
    expect(attr(tagOf(htmlOf(s.last()), "pop"), "hidden")).not.toBeNull();
  }, 120_000);
});
