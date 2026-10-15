/**
 * HANA BODY RENDER — a hana block's body must reach the `~hana` dispatch transclude.
 *
 * ── THE DEFECT ───────────────────────────────────────────────────────────────────────────────────
 * `lar-sigil.ts`'s compound-sigil render path (`"__compound__" in attrs`) deleted `attrs["__body__"]`
 * UNUSED and forwarded only the block's opening tag (`verbatim`) to the `~hana` dispatch transclude.
 * The `~hana` widget (tiddlers/sigil-hana.tid) declares `~hana(p1:grammar-key p2:body)` — with no
 * `p2` ever set, every hana body rendered as NOTHING, dropped silently.
 *
 * ── WHY THIS ASSERTS THE PARSE TREE, NOT FINAL HTML ─────────────────────────────────────────────
 * `sigil-render.test.ts` asserts final HTML for sigils whose OWN definition is sound. Measured against
 * this build: the shipped `~hana` widget carries an UNRELATED, pre-existing bug — its `_h-interp`
 * filter references its own name (`tag<_h-interp>`) inside the very `$set` that defines it, so the
 * lookup always reads the variable as blank/unset and the registered-interpreter branch never fires,
 * for ANY grammar-key, registered or not (verified by hand: `_h-interp` always resolves to just the
 * addprefix'd candidate title, never a matched interpreter tiddler, then transcludes a title that
 * doesn't exist → empty, on EVERY call). That bug lives in a `.tid` sigil tiddler out of scope for
 * this suite to edit, and it would swallow p2 either way, making an HTML-level assertion
 * blind to whether THIS fix (the forwarding) actually worked. So this suite asserts the render RULE's
 * own output — the transclude node's attributes — which is exactly what changed.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { TW5Engine } from "../src/tw5-vm.js";
import { bootTestWiki, wikiSkip, skipNote } from "./test-wiki.js";

function transcludeAttrs(engine: TW5Engine, wikitext: string): Record<string, unknown> {
  const title = "lar:///test/hana-render-probe";
  engine.setTiddler({ title, type: "text/vnd.tiddlywiki", text: wikitext });
  const tree = engine.wiki.parseTiddler(title)!.tree as unknown as Array<{
    type: string;
    attributes?: Record<string, { value?: string }>;
  }>;
  // hana's own scan reports `$variable="~hana"`; the \task alias's own compound match reports its
  // own literal name, so the render rule dispatches it as `$variable="~task"` (which itself forwards
  // to `~hana` — sigil-task.tid).
  const node = tree.find((n) => n.type === "transclude" && (n.attributes?.["$variable"]?.value === "~hana" || n.attributes?.["$variable"]?.value === "~task"));
  expect(node, "no ~hana/~task transclude node found in the parse tree").toBeTruthy();
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node!.attributes ?? {})) out[k] = v?.value;
  return out;
}

describe.skipIf(wikiSkip)(`the hana render rule forwards p1+p2 to ~hana${skipNote}`, () => {
  let e: TW5Engine;
  beforeAll(async () => { e = await bootTestWiki(); }, 60_000);

  test("RED — a hana block's body reaches the transclude as p2 (grammar-key stays p1)", () => {
    const attrs = transcludeAttrs(e, '<<~ hana "markdown">>\nnot TW5 wikitext\n<<~/hana>>');
    expect(attrs["p1"], "grammar-key dropped").toBe("markdown");
    expect(attrs["p2"], "hana body never reached the ~hana transclude — every hana body renders as NOTHING").toContain("not TW5 wikitext");
  });

  test("the \\task alias forwards its body the same way", () => {
    const attrs = transcludeAttrs(e, '<<~ task "markdown">>\ntask body here\n<<~/task>>');
    expect(attrs["p1"]).toBe("markdown");
    expect(attrs["p2"]).toContain("task body here");
  });

  test("CONTROL — ahu's compound-sigil path is untouched: it carries no p2 body slot", () => {
    const title = "lar:///test/ahu-render-probe";
    e.setTiddler({ title, type: "text/vnd.tiddlywiki", text: "<<~ ahu #/entry>>\nbody text\n<<~/ahu>>" });
    const tree = e.wiki.parseTiddler(title)!.tree as unknown as Array<{
      type: string;
      attributes?: Record<string, { value?: string }>;
    }>;
    const node = tree.find((n) => n.type === "transclude" && n.attributes?.["$variable"]?.value === "~ahu");
    expect(node, "no ~ahu transclude node found").toBeTruthy();
    // ahu's block body is split into a CHILD TIDDLER upstream (deserializer), never carried as
    // `__body__` through this rule — p2 must stay untouched (empty), proving the hana-only scope of
    // the fix didn't leak into every other compound/closer sigil.
    expect(node!.attributes?.["p2"]?.value ?? "").toBe("");
  });
});
