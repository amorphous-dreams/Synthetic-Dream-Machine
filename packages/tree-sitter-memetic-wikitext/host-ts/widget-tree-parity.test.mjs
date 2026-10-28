/**
 * widget-tree parity witness — the in-VM widget tree and the tree-sitter fold agree on the shared structure.
 *
 * It runs where the grammar wasm stands (this package's gate, after `build:wasm`) and reads the tw5 package's
 * built `dist`, so the in-VM `parseMemeText` + `resolveWidgetTree` answer to the host fold of the same specimens.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadArtifact } from "./loader.mjs";
import { fold } from "./fold.mjs";
import { heldBytes } from "./held-text.mjs";
import { parseMemeText } from "../../lararium-tw5/dist/meme-ast/parse.js";
import { defaultWidgetRegistry, resolveWidgetTree } from "../../lararium-tw5/dist/meme-ast/widget-tree.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const grammar = path.join(root, "tree-sitter-memetic_wikitext.wasm");
const runtime = path.join(root, "node_modules/web-tree-sitter/web-tree-sitter.wasm");
const names = ["authored-01-unreached-constructs.mem", "authored-02-comment.mem", "wild-01-voices.mem", "wild-02-pragma.mem"];

/** Shared reduction: authored ahu slots and loulou targets, in preorder. A block loulou sigil is the childless
 * `link-handle`; an inline `[[wikilink]]` carries its text as a child, and the host fold keeps wikilinks inside
 * plain text, so wikilinks stand outside the shared remainder. The in-VM reader lifts a loulou sigil mid-line into
 * its own node where the host fold keeps the line whole; the comparison below counts those exactly. The host fold
 * alone carries CST trivia, quotes, tables, fences and comments; the widget tree alone carries DOM paragraphs,
 * degradation and affordances. The control corpus entry holds quote, fence, table and widget lines and shows both
 * reductions keep the same remainder when those classes stand in the source. */
function fromWidget(source) {
  const tree = resolveWidgetTree(parseMemeText("lar:///ha.ka.ba/test/parity", source).nodes.slice(), defaultWidgetRegistry);
  const tokens = [];
  const visit = (node) => {
    if (node.kind === "section" && node.attrs?.slot) tokens.push({ kind: "ahu", value: node.attrs.slot });
    if (node.kind === "link-handle" && node.attrs?.target && node.children.length === 0) tokens.push({ kind: "link", value: node.attrs.target });
    for (const child of node.children) visit(child);
  };
  for (const node of tree) visit(node);
  return tokens;
}

function fromHost(rootNode, bytes) {
  const tokens = [];
  const source = (node) => new TextDecoder().decode(bytes.slice(node.start, node.end));
  const visit = (node) => {
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

test("widget-tree-parity: reviewed source and seven fixture-derived specimens agree; CONTROL: excluded constructs preserve the shared remainder; known positive: mutated token disagrees", async () => {
  assert.ok(existsSync(grammar) && existsSync(runtime), `tree-sitter artifact absent: ${grammar} or ${runtime}`);
    const artifact = await loadArtifact();
    const fixtures = names.map((name) => new TextDecoder().decode(heldBytes(readFileSync(path.join(root, "fixtures/specimens", name)))));
    // The in-VM reader takes the canonical `#/slot` spelling alone; the host fold also reads the legacy `#slot`
    // spelling and the spaced close. The specimens hold some of each, so the corpus canonicalizes the legacy
    // spelling for BOTH sides, and the two divergences stand pinned below as they are.
    const canon = (text) => text.replace(/(<<~\s*ahu\s+)#(?!\/)/g, "$1#/");
    const spaced = fixtures[0].slice(fixtures[0].indexOf("<<~ ahu #open-and-close"), fixtures[0].indexOf("\\procedure"));
    const corpus = [
      "! Start\n\nSee [[Alpha]] and [[Beta]].", // widget-tree.test.ts reviewed source
      ...fixtures.slice(1).map(canon),
      canon(fixtures[2].slice(fixtures[2].indexOf("<<~ ahu #meme-header"), fixtures[2].indexOf("<<~ ahu #architecture"))),
      canon(fixtures[3].slice(fixtures[3].indexOf("<<~ ahu #the-ground"), fixtures[3].indexOf("<<~ ahu #the-rhizome"))),
      '<<~ ahu #/control>>\n<<<quote\nbody\n<<<\n```fence\nbody\n```\n| A | B |\n<$button>Go</$button>\n<<~/ahu>>',
    ];
    for (const [index, source] of corpus.entries()) {
      const bytes = new TextEncoder().encode(source);
      const widget = fromWidget(source);
      const host = fromHost(fold(bytes, artifact), bytes);
      // The ahu slots agree exactly and in order. The in-VM reader lifts a loulou sigil mid-line into its own
      // node while the host fold keeps that line whole as text, so the widget links are the host's links in the
      // same order plus exactly the mid-line sigils the source carries.
      assert.deepEqual(widget.filter((t) => t.kind === "ahu"), host.filter((t) => t.kind === "ahu"), `specimen ${index} ahu slots`);
      const links = widget.filter((t) => t.kind === "link").map((t) => t.value);
      const hostLinks = host.filter((t) => t.kind === "link").map((t) => t.value);
      const midLine = (source.match(/[^\n]<<~\s*loulou\s+[^\s>]+\s*>>/g) ?? []).length;
      assert.equal(links.length - hostLinks.length, midLine, `specimen ${index} extra links are the mid-line sigils`);
      let at = 0;
      for (const link of links) if (link === hostLinks[at]) at++;
      assert.equal(at, hostLinks.length, `specimen ${index} host links are a subsequence of the widget links`);
      if (index >= 2 && index <= 3) assert.equal(widget.some((t) => t.kind === "ahu"), true, `specimen ${index} carries ahu slots both sides read`);
    }
    // KNOWN DIVERGENCES, pinned as they stand (the writer emits neither spelling): the spaced `<<~ ahu #x >>` of
    // authored-01 and the legacy `#slot` spelling fold in the host and read as no slot in the in-VM parser.
    const spacedBytes = new TextEncoder().encode(spaced);
    assert.deepEqual(fromWidget(spaced), [], "the in-VM parser reads no ahu from the spaced spelling");
    assert.ok(fromHost(fold(spacedBytes, artifact), spacedBytes).map((t) => t.value).includes("#open-and-close"), "the host fold reads it");
    const legacy = "<<~ ahu #legacy>>\nbody\n<<~/ahu>>";
    const legacyBytes = new TextEncoder().encode(legacy);
    assert.deepEqual(fromWidget(legacy), [], "the in-VM parser reads no slot from the legacy spelling");
    assert.deepEqual(fromHost(fold(legacyBytes, artifact), legacyBytes).map((t) => t.value), ["#legacy"], "the host fold reads it");
    const witnessSource = "<<~ ahu #/witness>>\n<<~/ahu>>";
    const witnessBytes = new TextEncoder().encode(witnessSource);
    const witness = fromWidget(witnessSource);
    const hostWitness = fromHost(fold(witnessBytes, artifact), witnessBytes);
    assert.deepEqual(witness, hostWitness);
    assert.notDeepEqual([{ ...witness[0], value: "#/mutated" }], hostWitness);
  });
