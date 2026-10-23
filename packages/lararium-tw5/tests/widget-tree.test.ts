import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseMemeText } from "../src/meme-ast/parse.js";
import { defaultWidgetRegistry, resolveWidgetTree } from "../src/meme-ast/widget-tree.js";
import { blocksToLabelHtml, widgetTreeToBlocks } from "../src/meme-ast/blocks-from-widget-tree.js";
import type { MemeAstNode } from "../src/meme-ast/types.js";
import type { Block } from "../src/recording-serialisers.js";
import { RecordingDocument, cameraContainer, cameraDocument } from "../src/recording-document.js";
import { toBlocks, toLabelHtml } from "../src/recording-serialisers.js";
import { mountCamera } from "../src/tw5-camera.js";
import { bootTestWiki, skipNote, wikiSkip } from "./test-wiki.js";

const URI = "lar:///ha.ka.ba/test/widget-tree";
const SOURCE = "! Start\n\nSee [[Alpha]] and [[Beta]].";
const goldenPath = path.join(import.meta.dirname, "goldens", "blocks", "annex-b-small.json");

// The recording document assigns runtime nodeIds. The AST has no DOM identity,
// so parity compares semantic structure and preorder affordance ids, not nodeIds.
function structure(block: Block): unknown {
  return {
    kind: block.kind,
    children: block.children.map(structure),
    ...(block.text !== undefined ? { text: block.text } : {}),
    affordances: block.affordances.map(({ id, kind, target }) => ({ id, kind, ...(target !== undefined ? { target } : {}) })),
  };
}

/**
 * The declared normaliser between the two paths. The TW5 path wraps heading text in an inline span and gives a
 * link widget its click and drag affordances; the AST path names neither. The comparison keeps the document's
 * shape: it unwraps affordance-free spans and a lone wrapper div around the root, keeps only link affordances and compares them by target in
 * document order, since each path numbers its own ids.
 */
function canon(block: Block): unknown {
  const flat = (b: Block): Block[] => b.kind === "span" && b.affordances.length === 0 ? b.children.flatMap(flat) : [{ ...b, children: b.children.flatMap(flat) }];
  const one = (b: Block): unknown => ({
    kind: b.kind,
    children: b.children.map(one),
    ...(b.text !== undefined ? { text: b.text } : {}),
    links: b.affordances.filter(a => a.kind === "link").map(a => a.target),
  });
  const unwrapRoot = (b: Block): Block => b.kind === "div" && b.affordances.length === 0 && b.children.length === 1 && b.children[0]!.kind === "div" ? unwrapRoot(b.children[0]!) : b;
  return one(unwrapRoot(flat(block)[0]!));
}

function blockOf(source: string): Block {
  return widgetTreeToBlocks(resolveWidgetTree(parseMemeText(URI, source).nodes.slice(), defaultWidgetRegistry));
}

describe("Annex B widget tree", () => {
  it("annexb-resolve-widget-tree-structure: headings, paragraphs, and lists keep structure; plain prose controls it", () => {
    const tree = resolveWidgetTree(parseMemeText(URI, "! Start\n\nPlain.\n\n* one\n* two").nodes.slice(), defaultWidgetRegistry);
    expect(tree.map(node => node.kind)).toEqual(["section", "paragraph", "list"]);
    expect(tree[2]?.children.map(node => node.kind)).toEqual(["list-item", "list-item"]);
    expect(tree[1]?.children[0]?.text).toBe("Plain.");
    expect(tree.some(node => node.degraded)).toBe(false);
  });

  it("annexb-unknown-sigil-degrades-named: an unknown sigil marks damage; ahu controls it", () => {
    const unknown: MemeAstNode = { kind: "Sigil", pos: 0, raw: "<<~ stranger>>", sigilName: "stranger", attrs: {}, body: [] };
    expect(resolveWidgetTree([unknown], defaultWidgetRegistry)[0]).toMatchObject({
      kind: "degraded", text: "<<~ stranger>>", degraded: { reason: "unknown-sigil:stranger" },
    });
    const known = parseMemeText(URI, "<<~ ahu #/start>>\n\nHello.\n\n<<~/ahu>>");
    const tree = resolveWidgetTree(known.nodes.slice(), defaultWidgetRegistry);
    expect(tree[0]).toMatchObject({ kind: "section", attrs: { slot: "#/start" } });
    expect(tree.some(node => node.degraded || node.children.some(child => child.degraded))).toBe(false);
  });

  it("annexb-affordance-ids-by-position: swapping links preserves ids at positions and moves targets", () => {
    const first = blockOf("[[Alpha]] [[Beta]]");
    const swapped = blockOf("[[Beta]] [[Alpha]]");
    const links = (block: Block) => block.children[0]?.children.filter(child => child.kind === "a").map(child => child.affordances[0]);
    expect(links(first)?.map(affordance => affordance?.id)).toEqual(links(swapped)?.map(affordance => affordance?.id));
    expect(links(first)?.map(affordance => affordance?.target)).toEqual(["Alpha", "Beta"]);
    expect(links(swapped)?.map(affordance => affordance?.target)).toEqual(["Beta", "Alpha"]);
  });

  it("annexb-blocks-golden-parity-with-recording-serialiser: the AST path matches the reviewed structure", () => {
    const golden = JSON.parse(readFileSync(goldenPath, "utf8")) as unknown;
    expect(structure(blockOf(SOURCE))).toEqual(golden);
  });
});

describe.skipIf(wikiSkip)(`Annex B recording camera parity${skipNote}`, () => {
  it("annexb-blocks-golden-parity-with-recording-serialiser: TW5 renders the same source and structure", async () => {
    const engine = await bootTestWiki({ tiddlers: [{ title: "Annex B small", type: "text/vnd.tiddlywiki", text: SOURCE }] });
    const document = new RecordingDocument();
    const root = document.createElement("div");
    const stop = mountCamera(engine, { rootTiddler: "Annex B small", document: cameraDocument(document), container: cameraContainer(root) });
    try {
      const recorded = toBlocks(root);
      if ("missing" in recorded) throw new Error("recording-camera-missing");
      expect(canon(blockOf(SOURCE))).toEqual(canon(recorded));
      // The label camera projects the same block structure and strips DOM-only classes.
      expect(blocksToLabelHtml(blockOf(SOURCE))).toBe(toLabelHtml(root));
    } finally { stop(); }
  });
});
