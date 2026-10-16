/**
 * confirm-road — TiddlyWiki asks its confirm questions through the wiki itself, and the shore and the
 * projection carry that road unchanged.
 *
 * The engine parks a question as `$:/temp/confirm/<n>` (tag `$:/tags/Confirmation`), renders it from its
 * own root template as a modal dialog, and re-dispatches the asking message when a `tm-confirm` answers
 * "yes". These vectors stand the real engine over the shore rig (real stores, recorded store calls) and
 * over a mounted projection (the frames a page paints, the events a page returns), and read:
 *
 *   - a question writes nothing but itself, and itself never reaches a store;
 *   - "yes" applies against the wiki as it then stands; "no" leaves every tiddler as it stood;
 *   - a subject that changed in content refuses on the alert rail, while a landing that re-stamps the
 *     envelope field alone still applies (`$:/config/ConfirmIgnoredFields` names `ENVELOPE_FIELDS`);
 *   - a projected frame carries the dialog and the `inert` marks, Escape crosses as a `lar:key` with its real
 *     key chord, and a render-id of an answered question answers `stale-target`.
 */
import { afterEach, describe, expect, test } from "vitest";
import { type LarTiddlerRecord } from "@lararium/mesh";
import { ENVELOPE_FIELDS } from "../src/envelope-fields.js";
import { neverPersists } from "../src/island-adaptor.js";
import { dispatchLarControlEvent } from "../src/tw5-projection.js";
import { htmlOf, mountSurface, type Surface } from "./projection-surface.js";
import { skipNote, wikiSkip } from "./test-wiki.js";
import {
  afterDispatch, draftBag, draftTitleOf, ManualTimers, peerWrite, remote, shoreRig, storeDeleted, storeText, tempBag,
  turns, typeInto, workingBag, type Rig,
} from "./wiki-shore-rig.js";

const QUESTION_TAG = "$:/tags/Confirmation";
const CORE_ALERT = "$:/temp/alerts/confirm";

interface NavWidget {
  render(parent: unknown, next: unknown): void;
  children?: NavWidget[];
  dispatchEvent(e: unknown): void;
  invokeActionString(actions: string, triggeringWidget: unknown, event: unknown, variables: Record<string, string>): void;
  handleEditTiddlerEvent?: unknown;
}
interface LooseTw {
  wiki: {
    parseText(type: string, text: string): unknown;
    makeWidget(parser: unknown, options: unknown): NavWidget;
    getTiddlersWithTag(tag: string): string[];
    getTiddler(title: string): { fields: Record<string, unknown> } | undefined;
    getTiddlerText(title: string): string | undefined;
    isShadowTiddler(title: string): boolean;
  };
  utils: { confirm?: unknown; answerConfirmation?: unknown; parseStringArray(text: string): string[] };
  language: { getString(name: string, options?: unknown): string };
  fakeDocument: { createElement(tag: string): unknown };
  rootWidget: unknown;
}

const seedRecords = async (r: Rig, records: readonly Record<string, unknown>[]): Promise<void> => {
  for (const tiddler of records) await r.working.put({ tiddler } as LarTiddlerRecord, remote);
  await turns();
};
const tw = (r: Rig): LooseTw => r.engine.$tw as unknown as LooseTw;

/** A navigator under the engine's root widget, where the engine itself hears `tm-confirm`. */
function standNavigator(r: Rig): NavWidget {
  const $tw = tw(r);
  const widget = $tw.wiki.makeWidget(
    $tw.wiki.parseText("text/vnd.tiddlywiki", `<$navigator story="$:/StoryList" history="$:/HistoryList"/>`),
    { document: $tw.fakeDocument, parentWidget: $tw.rootWidget },
  );
  widget.render($tw.fakeDocument.createElement("div"), null);
  const find = (w: NavWidget): NavWidget | null => {
    if (typeof w.handleEditTiddlerEvent === "function") return w;
    for (const c of w.children ?? []) { const f = find(c); if (f) return f; }
    return null;
  };
  return find(widget)!;
}
const questions = (r: Rig): string[] => tw(r).wiki.getTiddlersWithTag(QUESTION_TAG);
const standingQuestion = (r: Rig): { title: string; fields: Record<string, unknown> } => {
  const titles = questions(r);
  expect(titles, "exactly one question stands").toHaveLength(1);
  return { title: titles[0]!, fields: tw(r).wiki.getTiddler(titles[0]!)!.fields };
};
/** The message the question's own buttons send. */
const answer = (nav: NavWidget, title: string, word: "yes" | "no"): void =>
  nav.dispatchEvent({ type: "tm-confirm", param: title, paramObject: { answer: word } });
const namesAny = (r: Rig, since: number, prefix: string): boolean =>
  r.calls.slice(since).some((c) => [...c.puts, ...c.deletes].some((t) => t.startsWith(prefix)));
const snapshot = (r: Rig, titles: readonly string[]): string =>
  JSON.stringify(titles.map((t) => r.wiki.getTiddler(t)?.fields ?? null));

describe.skipIf(wikiSkip)(`the confirm road over the shore${skipNote}`, () => {
  test("weld: the engine carries the question door, and the plugin's ignored-fields list names every envelope field", async () => {
    const r = await shoreRig();
    const $tw = tw(r);
    expect(typeof $tw.utils.confirm).toBe("function");
    expect(typeof $tw.utils.answerConfirmation).toBe("function");
    expect($tw.wiki.isShadowTiddler("$:/core/ui/ConfirmTemplate")).toBe(true);
    expect($tw.utils.parseStringArray($tw.wiki.getTiddlerText("$:/config/ConfirmIgnoredFields") ?? "")).toEqual([...ENVELOPE_FIELDS]);
    // CONTROL: a name the engine never carried reads absent.
    expect(($tw.utils as Record<string, unknown>)["confirmThroughAWindow"]).toBeUndefined();
    await r.stop();
  }, 120_000);

  test("Delete parks a question that never reaches a store, then applies on yes; an empty tiddler deletes at once", async () => {
    const timers = new ManualTimers();
    const r = await shoreRig({ timers, upperSlots: true });
    const x = "lar:///t/confirm/delete";
    const e = "lar:///t/confirm/empty";
    await seedRecords(r, [{ title: x, text: "landed" }, { title: e, text: "" }]);
    await r.adaptor.armSeedCheckpoint();
    const nav = standNavigator(r);

    const mark = r.calls.length;
    // No DOM event rides this message: the handler reads no window, so it neither throws nor needs a view.
    expect(() => nav.dispatchEvent({ type: "tm-delete-tiddler", tiddlerTitle: x })).not.toThrow();
    await afterDispatch();
    timers.fireAll(400);
    await turns(24);
    const q = standingQuestion(r);
    expect(q.title.startsWith("$:/temp/confirm/")).toBe(true);
    expect(q.fields["confirm-type"]).toBe("delete");
    expect(q.fields["text"]).toBe(tw(r).language.getString("ConfirmDeleteTiddler", { variables: { title: x } }));
    expect(r.wiki.getTiddler(x)?.fields["text"], "the tiddler stands while the question waits").toBe("landed");
    expect(r.calls.slice(mark), "the question took no store call, and neither did its subject").toEqual([]);
    expect(neverPersists(q.title)).toBe(true);

    answer(nav, q.title, "yes");
    await afterDispatch();
    timers.fireAll(400);
    await turns(24);
    expect(r.wiki.getTiddler(x)).toBeUndefined();
    expect(storeDeleted(r, workingBag, x)).toBe(true);
    expect(questions(r)).toEqual([]);
    expect(namesAny(r, mark, "$:/temp/confirm/"), "no store call ever named a question").toBe(false);

    // CONTROL: a tiddler with no text asks nothing and deletes in the same turn.
    nav.dispatchEvent({ type: "tm-delete-tiddler", tiddlerTitle: e });
    expect(r.wiki.getTiddler(e)).toBeUndefined();
    expect(questions(r)).toEqual([]);

    // CONTROL for "never stored": the rig does see an ordinary temporary title reach the temp layer.
    const markTemp = r.calls.length;
    r.wiki.addTiddler(new r.Tiddler({ title: "$:/temp/lararium-test/ordinary", text: "volatile but routed" }));
    await afterDispatch();
    timers.fireAll(400);
    await turns(24);
    expect(r.calls.slice(markTemp).some((c) => c.bag === tempBag && c.puts.includes("$:/temp/lararium-test/ordinary"))).toBe(true);
    await r.stop();
  }, 120_000);

  test("Discard of a typed draft parks, survives the draft's own landing, and applies; decline leaves every tiddler as it stood", async () => {
    const timers = new ManualTimers();
    const r = await shoreRig({ timers });
    const z = "lar:///t/confirm/discard";
    await seedRecords(r, [{ title: z, text: "landed" }]);
    await r.adaptor.armSeedCheckpoint();
    const nav = standNavigator(r);

    nav.dispatchEvent({ type: "tm-edit-tiddler", tiddlerTitle: z });
    const d = draftTitleOf(z);
    await afterDispatch();
    // CONTROL: an untouched draft cancels with no question.
    nav.dispatchEvent({ type: "tm-cancel-tiddler", tiddlerTitle: d });
    expect(questions(r)).toEqual([]);
    expect(r.wiki.getTiddler(d)).toBeUndefined();
    await afterDispatch();
    timers.fireAll(400);
    await turns(24);

    nav.dispatchEvent({ type: "tm-edit-tiddler", tiddlerTitle: z });
    await afterDispatch();
    typeInto(r, d, "typed by a person");
    // The person presses Discard before the draft's save wave returns.
    nav.dispatchEvent({ type: "tm-cancel-tiddler", tiddlerTitle: d });
    const q1 = standingQuestion(r);
    expect(q1.fields["confirm-type"]).toBe("cancel");
    const story = "$:/StoryList";
    const before = snapshot(r, [d, z, story]);
    answer(nav, q1.title, "no");
    expect(snapshot(r, [d, z, story]), "declining moved nothing").toBe(before);
    expect(questions(r)).toEqual([]);
    expect(r.wiki.getTiddler(CORE_ALERT), "a decline raises no alert").toBeUndefined();

    nav.dispatchEvent({ type: "tm-cancel-tiddler", tiddlerTitle: d });
    const q2 = standingQuestion(r);
    expect(q2.title).not.toBe(q1.title);
    const stampAtAsk = r.wiki.getTiddler(d)!.fields["$origin-bag"];
    await afterDispatch();
    timers.fireAll(400);
    await turns(24);
    expect(storeText(r, draftBag, d), "the draft landed while the question stood").toBe("typed by a person");
    expect(r.wiki.getTiddler(d)!.fields["$origin-bag"], "the landing re-stamped the envelope field").not.toBe(stampAtAsk);
    expect(r.wiki.getTiddler(d)!.fields["text"]).toBe("typed by a person");

    answer(nav, q2.title, "yes");
    expect(r.wiki.getTiddler(d), "the draft leaves").toBeUndefined();
    expect(r.wiki.getTiddler(z)?.fields["text"]).toBe("landed");
    expect(r.wiki.getTiddler(CORE_ALERT)).toBeUndefined();
    await afterDispatch();
    timers.fireAll(400);
    await turns(24);
    expect(storeDeleted(r, draftBag, d)).toBe(true);
    await r.stop();
  }, 120_000);

  test("a rename onto a standing title whose content changed underneath refuses on the alert rail and writes nothing", async () => {
    const timers = new ManualTimers();
    const r = await shoreRig({ timers });
    const x = "lar:///t/confirm/rename-from";
    const y = "lar:///t/confirm/rename-onto";
    await seedRecords(r, [{ title: x, text: "source" }, { title: y, text: "standing" }]);
    await r.adaptor.armSeedCheckpoint();
    const nav = standNavigator(r);

    nav.dispatchEvent({ type: "tm-edit-tiddler", tiddlerTitle: x });
    const d = draftTitleOf(x);
    await afterDispatch();
    typeInto(r, d, "renamed text", { "draft.title": y });
    timers.fireAll(400);
    await turns(24);
    nav.dispatchEvent({ type: "tm-save-tiddler", tiddlerTitle: d });
    const q = standingQuestion(r);
    expect(q.fields["confirm-type"]).toBe("overwrite");
    expect(q.fields["confirm-title"]).toBe(y);
    expect(r.wiki.getTiddler(y)?.fields["text"]).toBe("standing");

    await peerWrite(r, workingBag, [{ tiddler: { title: y, text: "a peer wrote this" } } as LarTiddlerRecord]);
    expect(r.wiki.getTiddler(y)?.fields["text"]).toBe("a peer wrote this");
    const mark = r.calls.length;
    answer(nav, q.title, "yes");
    await afterDispatch();
    timers.fireAll(400);
    await turns(24);
    expect(r.wiki.getTiddler(y)?.fields["text"], "the peer's text stands").toBe("a peer wrote this");
    expect(r.wiki.getTiddler(d), "the draft stays open").toBeDefined();
    expect(r.wiki.getTiddler(x)?.fields["text"]).toBe("source");
    expect(r.wiki.getTiddler(CORE_ALERT)?.fields["text"]).toBe(tw(r).language.getString("ConfirmationChanged"));
    expect(r.wiki.getTiddler(CORE_ALERT)?.fields["tags"]).toEqual(["$:/tags/Alert"]);
    expect(r.calls.slice(mark).filter((c) => c.puts.includes(y) || c.deletes.includes(x)), "zero puts of the refused rename").toEqual([]);
    expect(namesAny(r, 0, "$:/temp/alerts/"), "the alert itself never reaches a store").toBe(false);

    // CONTROL: asked again against the wiki as it now stands, the same rename applies.
    nav.dispatchEvent({ type: "tm-save-tiddler", tiddlerTitle: d });
    answer(nav, standingQuestion(r).title, "yes");
    expect(r.wiki.getTiddler(y)?.fields["text"]).toBe("renamed text");
    expect(r.wiki.getTiddler(x)).toBeUndefined();
    await afterDispatch();
    timers.fireAll(400);
    await turns(24);
    await r.stop();
  }, 120_000);

  test("a newer question withdraws the older, and an answer to the older reads withdrawn", async () => {
    const r = await shoreRig();
    const a = "lar:///t/confirm/first";
    const b = "lar:///t/confirm/second";
    await seedRecords(r, [{ title: a, text: "one" }, { title: b, text: "two" }]);
    const nav = standNavigator(r);
    nav.dispatchEvent({ type: "tm-delete-tiddler", tiddlerTitle: a });
    const first = standingQuestion(r).title;
    nav.dispatchEvent({ type: "tm-delete-tiddler", tiddlerTitle: b });
    const second = standingQuestion(r).title;
    expect(second).not.toBe(first);
    answer(nav, first, "yes");
    expect(r.wiki.getTiddler(a)?.fields["text"]).toBe("one");
    expect(r.wiki.getTiddler(b)?.fields["text"]).toBe("two");
    expect(r.wiki.getTiddler(CORE_ALERT)?.fields["text"]).toBe(tw(r).language.getString("ConfirmationWithdrawn"));
    // A title no question ever wore reads the same.
    answer(nav, "$:/temp/confirm/never-asked", "yes");
    expect(r.wiki.getTiddler(a)).toBeDefined();
    // A question whose own tiddler no longer reads as asked answers nothing.
    r.wiki.addTiddler(new r.Tiddler(r.wiki.getTiddler(second)!.fields, { text: "Keep the tiddler?" }));
    answer(nav, second, "yes");
    expect(r.wiki.getTiddler(b)?.fields["text"], "an altered question deletes nothing").toBe("two");
    expect(questions(r)).toEqual([]);
    // CONTROL: asked afresh and left as asked, the question applies.
    nav.dispatchEvent({ type: "tm-delete-tiddler", tiddlerTitle: b });
    answer(nav, standingQuestion(r).title, "yes");
    expect(r.wiki.getTiddler(b)).toBeUndefined();
    expect(r.wiki.getTiddler(a)).toBeDefined();
    await turns(24);
    await r.stop();
  }, 120_000);

  test("an action before `$action-confirm` runs once across ask and yes; `$prompt=no` asks nothing", async () => {
    const r = await shoreRig();
    const nav = standNavigator(r);
    const ran = "lar:///t/confirm/ran-before";
    const out = "lar:///t/confirm/guarded";
    nav.invokeActionString(
      `<$action-setfield $tiddler="${ran}" text="ran"/><$action-confirm $message="Proceed?"><$action-setfield $tiddler="${out}" text="done"/></$action-confirm>`,
      nav, null, {},
    );
    const q = standingQuestion(r);
    expect(q.fields["confirm-type"]).toBe("action");
    expect(q.fields["text"]).toBe("Proceed?");
    expect(r.wiki.getTiddler(ran)?.fields["text"]).toBe("ran");
    expect(r.wiki.getTiddler(out)).toBeUndefined();
    r.wiki.deleteTiddler(ran);
    answer(nav, q.title, "yes");
    expect(r.wiki.getTiddler(out)?.fields["text"]).toBe("done");
    expect(r.wiki.getTiddler(ran), "the sibling before the question never ran again").toBeUndefined();
    // CONTROL
    r.wiki.deleteTiddler(out);
    nav.invokeActionString(`<$action-confirm $prompt="no"><$action-setfield $tiddler="${out}" text="unasked"/></$action-confirm>`, nav, null, {});
    expect(questions(r)).toEqual([]);
    expect(r.wiki.getTiddler(out)?.fields["text"]).toBe("unasked");
    await turns(24);
    await r.stop();
  }, 120_000);
});

const ROOT = "$:/temp/lararium/confirm-road-root";
const SUBJECT = "Confirm Road Subject";

function buttonRid(html: string, cls: string): string {
  const tag = [...html.matchAll(/<button\b[^>]*>/g)].map((m) => m[0]).find((t) => new RegExp(`class="[^"]*\\b${cls}\\b`).test(t));
  if (!tag) throw new Error(`no projected button of class ${cls}`);
  const rid = tag.match(/data-lar-rid="([^"]+)"/);
  if (!rid) throw new Error(`the ${cls} button carries no render-id`);
  return rid[1]!;
}

describe.skipIf(wikiSkip)(`the confirm road through a projected frame${skipNote}`, () => {
  let s: Surface | undefined;
  afterEach(() => { s?.stop(); s = undefined; });

  test("the frame carries the wiki's own dialog and the inert marks; Escape crosses as a key; yes deletes; an answered button reads stale", async () => {
    s = await mountSurface(`{{${ROOT}}}`, [
      { title: SUBJECT, text: "body" },
      { title: ROOT, type: "text/vnd.tiddlywiki", text: [
        `<$navigator story="$:/StoryList" history="$:/HistoryList">`,
        `<div class="page"><$button class="ask-delete" message="tm-delete-tiddler" param="${SUBJECT}">delete</$button></div>`,
        `</$navigator>`,
        `{{$:/core/ui/Confirmations}}`,
      ].join("") },
    ]);
    const wiki = s.wiki as unknown as LooseTw["wiki"];
    const html = (): string => htmlOf(s!.last());
    const click = (renderId: string) => dispatchLarControlEvent(s!.event("", { kind: "lar:act", action: "lar:click", renderId }));
    expect(s.frames.length).toBeGreaterThan(0);
    // CONTROL: no question, no dialog, nothing inert.
    expect(html()).not.toContain('aria-modal="true"');
    expect(html()).not.toContain("inert");

    expect(click(buttonRid(html(), "ask-delete"))).toMatchObject({ status: "applied" });
    await s.flush();
    const asked = html();
    expect(asked).toContain('aria-modal="true"');
    expect(asked).toContain('role="alertdialog"');
    expect(asked).toMatch(/<div[^>]*class="page"[^>]*inert=""|<div[^>]*inert=""[^>]*class="page"/);
    expect(asked).toContain(`Do you wish to delete the tiddler &quot;${SUBJECT}&quot;?`.replaceAll("&quot;", '"'));
    expect(asked.indexOf("tc-confirm-decline"), "the declining button comes first in the frame").toBeLessThan(asked.indexOf("tc-confirm-accept"));
    expect(wiki.getTiddler(SUBJECT), "the tiddler stands while the question waits").toBeDefined();

    // Escape, as the page relays it from the focused declining button: it bubbles to the keyboard widget.
    const declineRid = buttonRid(asked, "tc-confirm-decline");
    const acceptRid = buttonRid(asked, "tc-confirm-accept");
    expect(dispatchLarControlEvent(s.event("", {
      kind: "lar:act", action: "lar:key", renderId: declineRid,
      key: { key: "Escape", code: "Escape", keyCode: 27, repeat: false },
      modifiers: { ctrl: false, meta: false, alt: false, shift: false },
    }))).toMatchObject({ status: "applied" });
    await s.flush();
    expect(html()).not.toContain('aria-modal="true"');
    expect(html()).not.toContain("inert");
    expect(wiki.getTiddler(SUBJECT), "Escape declined").toBeDefined();
    expect(wiki.getTiddlersWithTag(QUESTION_TAG)).toEqual([]);

    // A late press of the answered question's button names a node no frame holds.
    expect(click(acceptRid)).toMatchObject({ status: "stale-target" });
    expect(wiki.getTiddler(SUBJECT)).toBeDefined();

    click(buttonRid(html(), "ask-delete"));
    await s.flush();
    expect(html()).toContain('aria-modal="true"');
    expect(buttonRid(html(), "tc-confirm-accept"), "a new question wears new render-ids").not.toBe(acceptRid);
    expect(click(buttonRid(html(), "tc-confirm-accept"))).toMatchObject({ status: "applied" });
    await s.flush();
    expect(html()).not.toContain('aria-modal="true"');
    expect(wiki.getTiddler(SUBJECT), "yes deleted").toBeUndefined();
    expect(html()).not.toContain("inert");
  }, 120_000);
});
