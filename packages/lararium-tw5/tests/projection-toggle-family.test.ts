/**
 * projection-toggle-family.test — a checkbox, a radio and a select reach TW5 where TW5 reads them, and the
 * frame paints their state as attributes.
 *
 * TW5's toggle widgets keep live state in node PROPERTIES (`input.checked`, `input.indeterminate`,
 * `option.selected`, `select.value`) and read it back off the node inside their `change` handler. So a toggle
 * works across the thread only when (1) the act lands the person's state on the node BEFORE TW5's handler runs,
 * and (2) the frame serialiser promotes each property to the attribute the page paints. Every vector drives a
 * live widget tree over the fake document through `dispatchLarControlEvent`; each names a control beside it.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/dreamdom#/what-a-sink-keeps
 */
import { afterEach, describe, expect, test } from "vitest";
import { dispatchLarControlEvent } from "../src/tw5-projection.js";
import { htmlOf, mountSurface, type Surface } from "./projection-surface.js";
import { skipNote, wikiSkip } from "./test-wiki.js";

const REC = "lar:///t/toggle-family/rec";
const field = (s: Surface, name: string): unknown => s.wiki.getTiddler(REC)?.fields[name];
/** The opening tag the frame paints for the node carrying `data-control-id="id"`, or for `<option value="v">` within it. */
const tagOf = (s: Surface, id: string): string => {
  const tag = htmlOf(s.last()).match(new RegExp(`<[a-z]+\\b[^>]*data-control-id="${id}"[^>]*>`))?.[0];
  if (!tag) throw new Error(`the frame paints no control ${id}`);
  return tag;
};
const optionOf = (s: Surface, id: string, value: string): string => {
  const html = htmlOf(s.last());
  const from = html.indexOf(tagOf(s, id));
  const tag = html.slice(from).match(new RegExp(`<option\\b[^>]*value="${value}"[^>]*>`))?.[0];
  if (!tag) throw new Error(`control ${id} paints no option ${value}`);
  return tag;
};
const act = (s: Surface, id: string, e: Record<string, unknown>) =>
  dispatchLarControlEvent(s.event("", { kind: "lar:act", controlId: id, ...e } as Parameters<Surface["event"]>[1]));

const CHECKBOX = `<$checkbox data-control-id="cb" tiddler="${REC}" field="done" checked="yes" unchecked="no"/>`;
const RADIO = `<$radio data-control-id="rd" tiddler="${REC}" field="colour" value="blue"/>`;
const MULTI = `<$select data-control-id="multi" tiddler="${REC}" field="tags" multiple="yes"><option value="a">a</option><option value="b">b</option></$select>`;
const SINGLE = `<$select data-control-id="sel" tiddler="${REC}" field="size"><option value="s">s</option><option value="m">m</option></$select>`;

describe.skipIf(wikiSkip)(`the projected toggle family${skipNote}`, () => {
  let s: Surface | undefined;
  afterEach(() => { s?.stop(); s = undefined; });

  test("a toggle act lands `checked` on the node before TW5's checkbox handler reads it; the frame paints it", async () => {
    s = await mountSurface(CHECKBOX, [{ title: REC, text: "", done: "no" }]);
    expect(tagOf(s, "cb")).not.toMatch(/\bchecked=/);
    expect(act(s, "cb", { action: "lar:toggle", checked: true, localRev: 3 })).toMatchObject({ status: "applied" });
    await s.flush();
    expect(field(s, "done"), "TW5's handler read the person's state off its node").toBe("yes");
    expect(tagOf(s, "cb")).toMatch(/\bchecked="checked"/);
    expect(s.last().sensedRevision, "the act's revision rides into the next frame").toEqual({ cb: 3 });
  }, 120_000);

  test("CONTROL: a toggle act carrying `checked: false` on an unchecked box writes nothing and paints no `checked`", async () => {
    s = await mountSurface(CHECKBOX, [{ title: REC, text: "", done: "no" }]);
    expect(act(s, "cb", { action: "lar:toggle", checked: false })).toMatchObject({ status: "applied" });
    await s.flush();
    expect(field(s, "done")).toBe("no");
    expect(tagOf(s, "cb")).not.toMatch(/\bchecked=/);
  }, 120_000);

  test("unchecking a box TW5 first painted checked paints the absence: the property outranks the first render's attribute", async () => {
    s = await mountSurface(CHECKBOX, [{ title: REC, text: "", done: "yes" }]);
    expect(tagOf(s, "cb"), "TW5's first render sets the attribute alone, and it stands").toMatch(/\bchecked="true"/);
    expect(act(s, "cb", { action: "lar:toggle", checked: false })).toMatchObject({ status: "applied" });
    await s.flush();
    expect(field(s, "done")).toBe("no");
    expect(tagOf(s, "cb")).not.toMatch(/\bchecked=/);
  }, 120_000);

  test("a radio act lands `checked`, TW5's radio writes its value, and the frame paints it checked", async () => {
    s = await mountSurface(RADIO, [{ title: REC, text: "", colour: "red" }]);
    expect(tagOf(s, "rd")).not.toMatch(/\bchecked=/);
    expect(act(s, "rd", { action: "lar:toggle", checked: true })).toMatchObject({ status: "applied" });
    await s.flush();
    expect(field(s, "colour")).toBe("blue");
    expect(tagOf(s, "rd")).toMatch(/\bchecked="checked"/);
  }, 120_000);

  test("a choice lands the whole key set before TW5's multiple select gathers it; each option paints its own `selected`", async () => {
    s = await mountSurface(MULTI, [{ title: REC, text: "", tags: [] }]);
    expect(act(s, "multi", { action: "lar:choice", wholeValue: ["b"] })).toMatchObject({ status: "applied" });
    await s.flush();
    expect(field(s, "tags")).toEqual(["b"]);
    expect(optionOf(s, "multi", "b")).toMatch(/\bselected="selected"/);
    expect(optionOf(s, "multi", "a")).not.toMatch(/\bselected=/);
    // CONTROL: the empty key set clears every option.
    expect(act(s, "multi", { action: "lar:choice", wholeValue: [] })).toMatchObject({ status: "applied" });
    await s.flush();
    expect(field(s, "tags")).toEqual([]);
    expect(optionOf(s, "multi", "b")).not.toMatch(/\bselected=/);
  }, 120_000);

  test("a single select's value paints as the `selected` of the one option it names, and a peer's write moves it", async () => {
    s = await mountSurface(SINGLE, [{ title: REC, text: "", size: "m" }]);
    expect(optionOf(s, "sel", "m")).toMatch(/\bselected="selected"/);
    expect(optionOf(s, "sel", "s")).not.toMatch(/\bselected=/);
    s.wiki.addTiddler({ ...s.wiki.getTiddler(REC)!.fields, size: "s" });
    await s.flush();
    expect(optionOf(s, "sel", "s")).toMatch(/\bselected="selected"/);
    expect(optionOf(s, "sel", "m")).not.toMatch(/\bselected=/);
  }, 120_000);

  test("an indeterminate checkbox paints `data-lar-indeterminate`; CONTROL: a determinate one paints none", async () => {
    const tri = `<$checkbox data-control-id="tri" tiddler="${REC}" field="done" checked="yes" unchecked="no" indeterminate="yes"/>`;
    s = await mountSurface(tri, [{ title: REC, text: "", done: "maybe" }]);
    expect(tagOf(s, "tri")).toMatch(/\bdata-lar-indeterminate=""/);
    expect(act(s, "tri", { action: "lar:toggle", checked: true })).toMatchObject({ status: "applied" });
    await s.flush();
    expect(field(s, "done")).toBe("yes");
    expect(tagOf(s, "tri")).not.toMatch(/\bdata-lar-indeterminate=/);
  }, 120_000);

  test("a toggle with no `checked`, or an act of the wrong family, refuses by name and runs nothing", async () => {
    s = await mountSurface(CHECKBOX + SINGLE, [{ title: REC, text: "", done: "no", size: "m" }]);
    expect(act(s, "cb", { action: "lar:toggle" })).toMatchObject({ status: "refused", reason: "unsupported-control" });
    expect(act(s, "cb", { action: "lar:choice", wholeValue: ["yes"] })).toMatchObject({ status: "refused", reason: "unsupported-control" });
    expect(act(s, "sel", { action: "lar:toggle", checked: true })).toMatchObject({ status: "refused", reason: "unsupported-control" });
    expect(act(s, "sel", { action: "lar:choice", wholeValue: "s" })).toMatchObject({ status: "refused", reason: "unsupported-control" });
    await s.flush();
    expect([field(s, "done"), field(s, "size")]).toEqual(["no", "m"]);
    // CONTROL: the right family on the same nodes applies.
    expect(act(s, "sel", { action: "lar:choice", wholeValue: ["s"] })).toMatchObject({ status: "applied" });
    await s.flush();
    expect(field(s, "size")).toBe("s");
  }, 120_000);
});
