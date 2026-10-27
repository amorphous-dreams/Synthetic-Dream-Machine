// vm-grammar-boundary: exempt — the parity witness drives the in-VM parseMemeText and resolveWidgetTree directly, against the tree-sitter fold
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { parseMemeText } from "../src/meme-ast/parse.js";
import { defaultWidgetRegistry, resolveWidgetTree, type WidgetTreeNode } from "../src/meme-ast/widget-tree.js";

const root = path.resolve(import.meta.dirname, "../../tree-sitter-memetic-wikitext");
const grammar = path.join(root, "tree-sitter-memetic_wikitext.wasm");
const runtime = path.join(root, "node_modules/web-tree-sitter/web-tree-sitter.wasm");
const names = ["authored-01-unreached-constructs.mem", "authored-02-comment.mem", "wild-01-voices.mem", "wild-02-pragma.mem"];
type Token = { kind: "ahu" | "link"; value: string };
type Capture = { kind: string; start: number; end: number; children?: Capture[] };

/** Shared reduction: authored ahu slots and loulou targets, in preorder. A block loulou sigil is the childless
 * `link-handle`; an inline `[[wikilink]]` carries its text as a child, and the host fold keeps wikilinks inside
 * plain text, so wikilinks stand outside the shared remainder. The in-VM reader lifts a loulou sigil mid-line into
 * its own node where the host fold keeps the line whole; the comparison below counts those exactly. The host fold
 * alone carries CST trivia, quotes, tables, fences and comments; the widget tree alone carries DOM paragraphs,
 * degradation and affordances. The control corpus entry holds quote, fence, table and widget lines and shows both
 * reductions keep the same remainder when those classes stand in the source. */
function fromWidget(source: string): Token[] {
  const tree = resolveWidgetTree(parseMemeText("lar:///ha.ka.ba/test/parity", source).nodes.slice(), defaultWidgetRegistry);
  const tokens: Token[] = [];
  const visit = (node: WidgetTreeNode): void => {
    if (node.kind === "section" && node.attrs?.slot) tokens.push({ kind: "ahu", value: node.attrs.slot });
    if (node.kind === "link-handle" && node.attrs?.target && node.children.length === 0) tokens.push({ kind: "link", value: node.attrs.target });
    for (const child of node.children) visit(child);
  };
  for (const node of tree) visit(node);
  return tokens;
}

function fromHost(rootNode: Capture, bytes: Uint8Array): Token[] {
  const tokens: Token[] = [];
  const source = (node: Capture) => new TextDecoder().decode(bytes.slice(node.start, node.end));
  const visit = (node: Capture): void => {
    if (node.kind === "meme.ahu") {
      const slot = /<<~\s*ahu\s+(#[\w/-]+)/.exec(source(node))?.[1];
      if (slot) tokens.push({ kind: "ahu", value: slot });
    }
    if (node.kind === "meme.sigil") {
      const target = /<<~\s*loulou\s+([^\s>]+)\s*>>/.exec(source(node))?.[1];
      if (target) tokens.push({ kind: "link", value: target });
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(rootNode);
  return tokens;
}

describe("widget tree and tree-sitter share structural tokens", () => {
  test("widget-tree-tree-sitter-parity: reviewed source and seven fixture-derived specimens agree; CONTROL: excluded constructs preserve the shared remainder; known positive: mutated token disagrees", async () => {
    expect(existsSync(grammar) && existsSync(runtime), `tree-sitter artifact absent: ${grammar} or ${runtime}`).toBe(true);
    // @ts-expect-error The host's JavaScript modules ship without TypeScript declarations.
    const { loadArtifact } = await import("../../tree-sitter-memetic-wikitext/host-ts/loader.mjs");
    // @ts-expect-error The host's JavaScript modules ship without TypeScript declarations.
    const { fold } = await import("../../tree-sitter-memetic-wikitext/host-ts/fold.mjs");
    // @ts-expect-error The host's JavaScript modules ship without TypeScript declarations.
    const { heldBytes } = await import("../../tree-sitter-memetic-wikitext/host-ts/held-text.mjs");
    const artifact = await loadArtifact();
    const fixtures = names.map((name) => new TextDecoder().decode(heldBytes(readFileSync(path.join(root, "fixtures/specimens", name)))));
    // The in-VM reader takes the canonical `#/slot` spelling alone; the host fold also reads the legacy `#slot`
    // spelling and the spaced close. The specimens hold some of each, so the corpus canonicalizes the legacy
    // spelling for BOTH sides, and the two divergences stand pinned below as they are.
    const canon = (text: string): string => text.replace(/(<<~\s*ahu\s+)#(?!\/)/g, "$1#/");
    const spaced = fixtures[0]!.slice(fixtures[0]!.indexOf("<<~ ahu #open-and-close"), fixtures[0]!.indexOf("\\procedure"));
    const corpus = [
      "! Start\n\nSee [[Alpha]] and [[Beta]].", // widget-tree.test.ts reviewed source
      ...fixtures.slice(1).map(canon),
      canon(fixtures[2]!.slice(fixtures[2]!.indexOf("<<~ ahu #meme-header"), fixtures[2]!.indexOf("<<~ ahu #architecture"))),
      canon(fixtures[3]!.slice(fixtures[3]!.indexOf("<<~ ahu #the-ground"), fixtures[3]!.indexOf("<<~ ahu #the-rhizome"))),
      '<<~ ahu #/control>>\n<<<quote\nbody\n<<<\n```fence\nbody\n```\n| A | B |\n<$button>Go</$button>\n<<~/ahu>>',
    ];
    for (const [index, source] of corpus.entries()) {
      const bytes = new TextEncoder().encode(source);
      const widget = fromWidget(source);
      const host = fromHost(fold(bytes, artifact) as Capture, bytes);
      // The ahu slots agree exactly and in order. The in-VM reader lifts a loulou sigil mid-line into its own
      // node while the host fold keeps that line whole as text, so the widget links are the host's links in the
      // same order plus exactly the mid-line sigils the source carries.
      expect(widget.filter((t) => t.kind === "ahu"), `specimen ${index} ahu slots`).toEqual(host.filter((t) => t.kind === "ahu"));
      const links = widget.filter((t) => t.kind === "link").map((t) => t.value);
      const hostLinks = host.filter((t) => t.kind === "link").map((t) => t.value);
      const midLine = (source.match(/[^\n]<<~\s*loulou\s+[^\s>]+\s*>>/g) ?? []).length;
      expect(links.length - hostLinks.length, `specimen ${index} extra links are the mid-line sigils`).toBe(midLine);
      let at = 0;
      for (const link of links) if (link === hostLinks[at]) at++;
      expect(at, `specimen ${index} host links are a subsequence of the widget links`).toBe(hostLinks.length);
      if (index >= 2 && index <= 3) expect(widget.some((t) => t.kind === "ahu"), `specimen ${index} carries ahu slots both sides read`).toBe(true);
    }
    // KNOWN DIVERGENCES, pinned as they stand (the writer emits neither spelling): the spaced `<<~ ahu #x >>` of
    // authored-01 and the legacy `#slot` spelling fold in the host and read as no slot in the in-VM parser.
    const spacedBytes = new TextEncoder().encode(spaced);
    expect(fromWidget(spaced), "the in-VM parser reads no ahu from the spaced spelling").toEqual([]);
    expect(fromHost(fold(spacedBytes, artifact) as Capture, spacedBytes).map((t) => t.value), "the host fold reads it").toContain("#open-and-close");
    const legacy = "<<~ ahu #legacy>>\nbody\n<<~/ahu>>";
    const legacyBytes = new TextEncoder().encode(legacy);
    expect(fromWidget(legacy), "the in-VM parser reads no slot from the legacy spelling").toEqual([]);
    expect(fromHost(fold(legacyBytes, artifact) as Capture, legacyBytes).map((t) => t.value), "the host fold reads it").toEqual(["#legacy"]);
    const witnessSource = "<<~ ahu #/witness>>\n<<~/ahu>>";
    const witnessBytes = new TextEncoder().encode(witnessSource);
    const witness = fromWidget(witnessSource);
    const hostWitness = fromHost(fold(witnessBytes, artifact) as Capture, witnessBytes);
    expect(witness).toEqual(hostWitness);
    expect([{ ...witness[0]!, value: "#/mutated" }]).not.toEqual(hostWitness);
  });
});
