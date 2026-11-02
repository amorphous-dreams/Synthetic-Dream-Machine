/**
 * promote-ui-tiddlers — the promote panel as TIDDLERS in the daemon surface: wikitext born from source at daemon boot, one section per
 * wiki, the rites waiting beside their origin, digest and class, and buttons whose click summons the six hand-only island verbs.
 *
 * A scripted click works (no trusted-event gate): the operator drives, and so does the AI beside them; the gate on commit sits in the
 * island's dispatcher (an ask must arrive on the surface path), never in the DOM. Every red pairs with a CONTROL.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { describe, expect, test } from "vitest";
import { PROMOTE_PANEL_VERBS } from "@lararium/mesh";
import { bootTestWiki, renderWikitext, skipNote, wikiSkip } from "./test-wiki.js";
import { PROMOTE_PANEL_TITLE, PROMOTE_STATE_TITLE, makePromoteStateReactor, seedPromoteUiTiddlers } from "../src/promote-ui-tiddlers.js";

const D = "d".repeat(64), E = "e".repeat(64);
const VERB_PREFIX = "lar:///lararium.local.vm/verb/";
const SNAPSHOT = { wikis: [
  { wiki: "daemon", shadowed: [E], waiting: [{ title: "rites/field-notes", digest: D, revision: "r", classes: ["module-type", "startup-action"], origin: { seat: "s", device: "d", session: "s-1" } }],
    rows: [{ wiki: "daemon", digest: E, title: "rites/old", revision: "r", state: "orphaned", classes: ["module-type"], shadowed: true }] },
  { wiki: "garden", shadowed: [], rows: [], waiting: [] },
  { wiki: "broken", error: "wiki unreadable" },
] };

const verbTiddlers = (engine: Awaited<ReturnType<typeof bootTestWiki>>) => engine.wiki.filterTiddlers(`[prefix[${VERB_PREFIX}]]`);

describe.skipIf(wikiSkip)(`the promote panel as tiddlers${skipNote}`, () => {
  test("RED: seeding writes the panel under the house's lar namespace, off disk; the state reactor writes the volatile snapshot tiddler; CONTROL: the state never leaves the temp slot", async () => {
    const engine = await bootTestWiki();
    seedPromoteUiTiddlers(engine);
    const panel = engine.wiki.getTiddler(PROMOTE_PANEL_TITLE);
    expect(PROMOTE_PANEL_TITLE.startsWith("$:/lares/ui/promote")).toBe(true);
    expect(panel?.fields["disk-projection"]).toBe("no");
    expect(engine.wiki.getTiddler(PROMOTE_STATE_TITLE)).toBeUndefined();
    const out = await makePromoteStateReactor(engine)({ data: JSON.stringify(SNAPSHOT) } as never, undefined as never);
    expect(out).toMatchObject({ seeded: true });
    expect(PROMOTE_STATE_TITLE.startsWith("$:/temp/lares/promote")).toBe(true);
    expect(engine.wiki.getTiddler(PROMOTE_STATE_TITLE)?.fields["data"]).toBe(JSON.stringify(SNAPSHOT));
  });

  test("RED: the panel renders one section per wiki with each waiting rite's title, 12-hex digest, class and origin, an empty wiki's note and a broken wiki's error; CONTROL: nothing renders before the state lands", async () => {
    const engine = await bootTestWiki();
    seedPromoteUiTiddlers(engine);
    expect(renderWikitext(engine, `{{${PROMOTE_PANEL_TITLE}}}`)).toContain("no promote state yet");
    await makePromoteStateReactor(engine)({ data: JSON.stringify(SNAPSHOT) } as never, undefined as never);
    const html = renderWikitext(engine, `{{${PROMOTE_PANEL_TITLE}}}`);
    for (const needle of ["Rites waiting here", "daemon", "garden", "broken", "rites/field-notes", D.slice(0, 12), "module-type", "startup-action", "s-1", "no rites waiting", "wiki unreadable", "orphaned", "set aside"]) {
      expect(html, needle).toContain(needle);
    }
  });

  test("RED: a SCRIPTED click on a commit, keep, orphan-drop, drop, raise or lower button summons exactly that island verb with the wiki and digest as args; CONTROL: nothing summons before a click", async () => {
    const engine = await bootTestWiki();
    seedPromoteUiTiddlers(engine);
    await makePromoteStateReactor(engine)({ data: JSON.stringify(SNAPSHOT) } as never, undefined as never);
    expect(verbTiddlers(engine)).toEqual([]);
    const widget = engine.wiki.makeTranscludeWidget(PROMOTE_PANEL_TITLE, { document: (engine.$tw as unknown as { fakeDocument: unknown }).fakeDocument, parentWidget: engine.$tw.rootWidget });
    const host = (engine.$tw as unknown as { fakeDocument: { createElement(t: string): unknown } }).fakeDocument.createElement("div");
    (widget as unknown as { render(parent: unknown, next: unknown): void }).render(host, null);
    type W = { parseTreeNode?: { tag?: string; attributes?: Record<string, { value?: string }> }; children?: W[]; handleClickEvent?: (e: unknown) => unknown };
    const buttons: Array<{ act: string; digest: string; click: () => void }> = [];
    const walk = (w: W): void => {
      const attrs = w.parseTreeNode?.attributes ?? {};
      if (w.parseTreeNode?.tag === "$button" && w.handleClickEvent && attrs["data-act"]) {
        buttons.push({ act: attrs["data-act"]!.value ?? "", digest: attrs["data-digest"]?.value ?? "", click: () => { w.handleClickEvent!({ type: "click", preventDefault() {}, stopPropagation() {}, isTrusted: false }); } });
      }
      for (const c of w.children ?? []) walk(c);
    };
    walk(widget as unknown as W);
    const acts = buttons.map((b) => b.act);
    for (const act of ["commit", "orphan-keep", "orphan-drop", "drop", "lower"]) expect(acts, act).toContain(act);
    for (const b of buttons) b.click();
    const summoned = verbTiddlers(engine).map((t) => engine.wiki.getTiddler(t)!.fields);
    const verbs = new Set(summoned.map((f) => String(f["verb"])));
    expect([...verbs].every((v) => (PROMOTE_PANEL_VERBS as readonly string[]).includes(v))).toBe(true);
    expect(verbs).toEqual(new Set(["promote-commit", "promote-drop", "promote-keep", "promote-orphan-drop", "kapae-lower"]));
    const commit = summoned.find((f) => f["verb"] === "promote-commit")!;
    expect(commit).toMatchObject({ "lares-dispatch": "1", "arg-wiki": "daemon", "arg-digest": D });
  });

  test("RED: the panel text names the six hand-only verbs and `promote-refresh`, and no other island verb; CONTROL: the six are exactly the mesh's list", async () => {
    const engine = await bootTestWiki();
    seedPromoteUiTiddlers(engine);
    const all = engine.wiki.filterTiddlers("[prefix[$:/lares/ui/promote]]").map((t) => String(engine.wiki.getTiddler(t)!.fields["text"] ?? "")).join("\n");
    const named = new Set([...all.matchAll(/verb="([a-z-]+)"/g)].map((m) => m[1]!));
    expect(named).toEqual(new Set([...PROMOTE_PANEL_VERBS, "promote-refresh"]));
    expect([...PROMOTE_PANEL_VERBS].sort()).toEqual(["kapae-lower", "kapae-raise", "promote-commit", "promote-drop", "promote-keep", "promote-orphan-drop"]);
  });
});
