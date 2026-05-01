/**
 * Phase 3 parser tests — parseMemeCarrier() and edgesFromAst()
 *
 * Current grammar sigil inventory:
 *
 * EDGES (produce graph edges):
 *   pranala      — explicit edge (inline + block form)
 *   loulou       — relation sugar
 *   aka          — observe sugar (shadow transclusion)
 *   kahea        — dataflow sugar (URI form only)
 *   pono         — constraint sugar
 *   papalohe     — reaction sugar (UEFN device wiring)
 *   lele         — fire-and-forget dispatch (message)
 *
 * PHASE MARKERS (Pae nodes, no graph edges):
 *   control-soh / control-stx / control-etx / control-eot
 *
 * STRUCTURAL:
 *   ahu          — addressable scope socket <<~ ahu #slot >>
 *
 * SIGIL NODES (no graph edges):
 *   waiho        — ephemeral variable binding (was kau; renamed to distinguish from placement)
 *   kau          — device placement/instantiation (<<~ kau #frag? Name props? >>)
 *   kumu         — device definition
 *   wai          — conditional open
 *   mukuwai      — else branch
 *   kahawai      — elif branch
 *   huli         — iteration
 *   kukali       — reactive wait posture
 *   toml         — TOML data fence / block
 *
 * ENGLISH ALIASES (inline-erased to canonical before AST):
 *   \if     → wai      \else → mukuwai    \elif → kahawai
 *   \const  → waiho    \let  → waiho      \var  → waiho
 *   \widget → kumu     \suspends → kukali
 *   \constraint → pono
 */

import { describe, test, expect } from "@jest/globals";
import { parseMemeCarrier, collectEvents, edgesFromAst } from "../src/parser.js";
import { parsePranalaEdges } from "../src/pranala-parser.js";
import type {
  SigilNode, AhuNode, PranalaNode, PranalaSugarNode, PaeNode, DynamicNode,
} from "../src/ast.js";

const BASE = "lar:///test/carrier";

function ast(body: string) { return parseMemeCarrier(BASE, body); }
function edges(body: string) { return parsePranalaEdges(BASE, body); }

// ---------------------------------------------------------------------------
// Structural: AhuNode
// ---------------------------------------------------------------------------

describe("AhuNode — addressable scope socket", () => {
  test("single ahu → AhuNode with uri and slot", () => {
    const nodes = ast(`<<~ ahu #section >>\n<<~/ahu >>`);
    const n = nodes.find((n) => n.kind === "Ahu") as AhuNode | undefined;
    expect(n?.uri).toBe(`${BASE}#section`);
    expect(n?.slot).toBe("#section");
  });

  test("nested ahu — inner ahu is in outer body", () => {
    const nodes = ast(`
<<~ ahu #outer >>
  <<~ ahu #inner >>
  <<~/ahu >>
<<~/ahu >>`);
    const outer = nodes.find((n) => n.kind === "Ahu") as AhuNode | undefined;
    expect(outer?.slot).toBe("#outer");
    const inner = outer?.body.find((n) => n.kind === "Ahu") as AhuNode | undefined;
    expect(inner?.slot).toBe("#inner");
  });

  test("empty text returns empty array", () => {
    expect(ast("")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Phase markers: PaeNode
// ---------------------------------------------------------------------------

describe("PaeNode — carrier phase markers", () => {
  test("SOH marker → PaeNode phase=soh with toUri", () => {
    const nodes = ast(`<<~&#x0001; ? -> lar:///some/carrier >>`);
    const n = nodes.find((n) => n.kind === "Pae") as PaeNode | undefined;
    expect(n?.phase).toBe("soh");
    expect(n?.toUri).toBe("lar:///some/carrier");
  });

  test("STX marker → PaeNode phase=stx", () => {
    const nodes = ast(`<<~&#x0002;>>`);
    const n = nodes.find((n) => n.kind === "Pae") as PaeNode | undefined;
    expect(n?.phase).toBe("stx");
  });

  test("ETX marker → PaeNode phase=etx", () => {
    const nodes = ast(`<<~&#x0003;>>`);
    const n = nodes.find((n) => n.kind === "Pae") as PaeNode | undefined;
    expect(n?.phase).toBe("etx");
  });

  test("EOT marker → PaeNode phase=eot", () => {
    const nodes = ast(`<<~&#x0004; -> ? >>`);
    const n = nodes.find((n) => n.kind === "Pae") as PaeNode | undefined;
    expect(n?.phase).toBe("eot");
  });

  test("phase markers produce NO graph edges", () => {
    const es = edges(`<<~&#x0001; ? -> lar:///x >>\n<<~&#x0002;>>\n<<~&#x0003;>>\n<<~&#x0004; -> ? >>`);
    // SOH emits one control/soh edge; STX/ETX/EOT do not
    expect(es.filter((e) => e.family === "control" && e.role === "soh")).toHaveLength(1);
    expect(es.filter((e) => e.family !== "control")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Edge sigils: PranalaNode
// ---------------------------------------------------------------------------

describe("PranalaNode — explicit edges", () => {
  test("inline pranala → PranalaNode with family and role", () => {
    const nodes = ast(`<<~ pranala ? -> lar:///other family:control role:owns >>`);
    const n = nodes.find((n) => n.kind === "Pranala") as PranalaNode | undefined;
    expect(n?.family).toBe("control");
    expect(n?.role).toBe("owns");
  });
});

// ---------------------------------------------------------------------------
// Edge sugar: PranalaSugarNode
// ---------------------------------------------------------------------------

describe("PranalaSugarNode — edge sugar sigils", () => {
  test("loulou → sigil=loulou family=relation", () => {
    const nodes = ast(`<<~ loulou lar:///other >>`);
    const n = nodes.find((n) => n.kind === "PranalaSugar") as PranalaSugarNode | undefined;
    expect(n?.sigil).toBe("loulou");
    expect(n?.family).toBe("relation");
  });

  test("aka → sigil=aka family=observe", () => {
    const nodes = ast(`<<~ aka lar:///shadow >>`);
    const n = nodes.find((n) => n.kind === "PranalaSugar") as PranalaSugarNode | undefined;
    expect(n?.sigil).toBe("aka");
    expect(n?.family).toBe("observe");
  });

  test("kahea URI form → sigil=kahea family=dataflow", () => {
    const nodes = ast(`<<~ kahea lar:///ha.ka.ba/api/v0.1/mu >>`);
    const n = nodes.find((n) => n.kind === "PranalaSugar") as PranalaSugarNode | undefined;
    expect(n?.sigil).toBe("kahea");
    expect(n?.family).toBe("dataflow");
    expect(n?.toRaw).toBe("lar:///ha.ka.ba/api/v0.1/mu");
  });

  test("kahea produces dataflow graph edge", () => {
    const es = edges(`<<~ kahea lar:///ha.ka.ba/api/v0.1/mu >>`);
    expect(es).toHaveLength(1);
    expect(es[0]!.family).toBe("dataflow");
  });

  test("papalohe → sigil=papalohe family=reaction with trigger and fn", () => {
    const nodes = ast(`<<~ papalohe lar:///a -> lar:///b trigger:OnBegin fn:ShowScore >>`);
    const n = nodes.find((n) => n.kind === "PranalaSugar") as PranalaSugarNode | undefined;
    expect(n?.sigil).toBe("papalohe");
    expect(n?.trigger).toBe("OnBegin");
    expect(n?.fn).toBe("ShowScore");
  });

  test("pono → sigil=pono family=constraint", () => {
    const nodes = ast(`<<~ pono ? -> lar:///invariant role:implements >>`);
    const n = nodes.find((n) => n.kind === "PranalaSugar") as PranalaSugarNode | undefined;
    expect(n?.sigil).toBe("pono");
    expect(n?.family).toBe("constraint");
  });
});

// ---------------------------------------------------------------------------
// edgesFromAst parity with parsePranalaEdges
// ---------------------------------------------------------------------------

describe("edgesFromAst — parity with parsePranalaEdges", () => {
  const carriers = [
    `<<~ ahu #a >>\n<<~ pranala ? -> lar:///b family:control role:owns >>\n<<~/ahu >>`,
    `<<~ ahu #x >>\n<<~ loulou lar:///y >>\n<<~/ahu >>`,
    `<<~ aka lar:///shadow >>`,
    `<<~ ahu #c >>\n<<~ pono ? -> lar:///d role:invariant >>\n<<~/ahu >>`,
    `<<~ papalohe lar:///src -> lar:///tgt trigger:OnEnd >>`,
    `<<~ ahu #root >>\n<<~ ahu #child >>\n<<~ loulou lar:///z >>\n<<~/ahu >>\n<<~/ahu >>`,
    `<<~ kahea lar:///some/meme >>`,
  ];

  for (const [i, text] of carriers.entries()) {
    test(`carrier ${i + 1}: fromUri / toUri / family match`, () => {
      const nodes = parseMemeCarrier(BASE, text);
      const fromAst = edgesFromAst(nodes, BASE).map((e) => ({ fromUri: e.fromUri, toUri: e.toUri, family: e.family }));
      const direct  = parsePranalaEdges(BASE, text).map((e) => ({ fromUri: e.fromUri, toUri: e.toUri, family: e.family }));
      expect(fromAst).toEqual(direct);
    });
  }
});

// ---------------------------------------------------------------------------
// waiho — ephemeral variable binding (replaces kau for binding role)
// ---------------------------------------------------------------------------

describe("waiho — variable binding", () => {
  test("block waiho → SigilNode sigilName=waiho scope=block", () => {
    const nodes = ast(`<<~ waiho name = hello >>\ncontent\n<<~/waiho >>`);
    const n = nodes.find((n) => n.kind === "Sigil") as SigilNode | undefined;
    expect(n?.sigilName).toBe("waiho");
    expect(n?.attrs["scope"]).toBe("block");
    expect(n?.attrs["name"]).toBe("name");
    expect(n?.attrs["value"]).toBe("hello");
  });

  test("pragma waiho → SigilNode sigilName=waiho scope=carrier", () => {
    const nodes = ast(`<<~! waiho myVar = world >>`);
    const n = nodes.find((n) => n.kind === "Sigil") as SigilNode | undefined;
    expect(n?.sigilName).toBe("waiho");
    expect(n?.attrs["scope"]).toBe("carrier");
    expect(n?.attrs["name"]).toBe("myVar");
    expect(n?.attrs["value"]).toBe("world");
  });

  test("waiho produces NO graph edge", () => {
    expect(edges(`<<~ waiho x = 1 >>\n<<~/waiho >>`)).toHaveLength(0);
    expect(edges(`<<~! waiho x = 1 >>`)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// kau — device placement/instantiation
// ---------------------------------------------------------------------------

describe("kau — #fragment disambiguates invocation vs placement", () => {
  test("bare name (no #fragment) → render-only invocation, attrs.name + attrs.args", () => {
    const nodes = ast(`<<~ kau MyDevice >>`);
    const n = nodes.find((n) => n.kind === "Sigil") as SigilNode | undefined;
    expect(n?.sigilName).toBe("kau");
    expect(n?.attrs["name"]).toBe("MyDevice");
    expect(n?.attrs["args"]).toBe("");
  });

  test("name(args) form → attrs.args populated", () => {
    const nodes = ast(`<<~ kau card(title:Welcome) >>`);
    const n = nodes.find((n) => n.kind === "Sigil") as SigilNode | undefined;
    expect(n?.sigilName).toBe("kau");
    expect(n?.attrs["name"]).toBe("card");
    expect(n?.attrs["args"]).toBe("title:Welcome");
  });

  test("#fragment present → device placement, attrs.fragment + attrs.name + attrs.propsRaw", () => {
    const nodes = ast(`<<~ kau #sensor-1 GuardDevice mode:patrol zone:north >>`);
    const n = nodes.find((n) => n.kind === "Sigil") as SigilNode | undefined;
    expect(n?.sigilName).toBe("kau");
    expect(n?.attrs["fragment"]).toBe("sensor-1");
    expect(n?.attrs["name"]).toBe("GuardDevice");
    expect(n?.attrs["propsRaw"]).toContain("mode:patrol");
  });

  test("kau produces NO graph edge in either form", () => {
    expect(edges(`<<~ kau #inst-1 MyDevice >>`)).toHaveLength(0);
    expect(edges(`<<~ kau MyDevice >>`)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// kumu — device definition
// ---------------------------------------------------------------------------

describe("kumu — device definition", () => {
  test("kumu open/close → SigilNode attrs.name", () => {
    const nodes = ast(`<<~ kumu MyDevice >>\ncontent\n<<~/kumu >>`);
    const n = nodes.find((n) => n.kind === "Sigil") as SigilNode | undefined;
    expect(n?.sigilName).toBe("kumu");
    expect(n?.attrs["name"]).toBe("MyDevice");
  });

  test("kumu with params", () => {
    const nodes = ast(`<<~ kumu Card(title body) >>\ncontent\n<<~/kumu >>`);
    const n = nodes.find((n) => n.kind === "Sigil") as SigilNode | undefined;
    expect(n?.sigilName).toBe("kumu");
    expect(n?.attrs["params"]).toBe("title body");
  });
});

// ---------------------------------------------------------------------------
// Conditionals and iteration
// ---------------------------------------------------------------------------

describe("conditionals", () => {
  test("wai → SigilNode with filter attr", () => {
    const nodes = ast(`<<~ wai [tag[x]] >>\ncontent\n<<~/wai >>`);
    const n = nodes.find((n) => n.kind === "Sigil") as SigilNode | undefined;
    expect(n?.sigilName).toBe("wai");
    expect(n?.attrs["filter"]).toBe("[tag[x]]");
  });

  test("mukuwai → SigilNode leaf", () => {
    const nodes = ast(`<<~ mukuwai >>`);
    const n = nodes.find((n) => n.kind === "Sigil") as SigilNode | undefined;
    expect(n?.sigilName).toBe("mukuwai");
  });

  test("kahawai → SigilNode with filter", () => {
    const nodes = ast(`<<~ kahawai [tag[y]] >>`);
    const n = nodes.find((n) => n.kind === "Sigil") as SigilNode | undefined;
    expect(n?.sigilName).toBe("kahawai");
    expect(n?.attrs["filter"]).toBe("[tag[y]]");
  });
});

describe("huli — iteration", () => {
  test("huli → SigilNode with filter and binding attrs", () => {
    const nodes = ast(`<<~ huli [all[memes]] as item >>\n<<~/huli >>`);
    const n = nodes.find((n) => n.kind === "Sigil") as SigilNode | undefined;
    expect(n?.sigilName).toBe("huli");
    expect(n?.attrs["filter"]).toBe("[all[memes]]");
    expect(n?.attrs["binding"]).toBe("item");
  });
});

// ---------------------------------------------------------------------------
// kukali — reactive wait posture
// ---------------------------------------------------------------------------

describe("kukali — reactive wait posture", () => {
  test("bare kukali → SigilNode no trigger", () => {
    const nodes = ast(`<<~ kukali >>`);
    const n = nodes.find((n) => n.kind === "Sigil") as SigilNode | undefined;
    expect(n?.sigilName).toBe("kukali");
    expect(n?.attrs).toEqual({});
  });

  test("kukali with trigger attr", () => {
    const nodes = ast(`<<~ kukali trigger:sensor.OnFire >>`);
    const n = nodes.find((n) => n.kind === "Sigil") as SigilNode | undefined;
    expect(n?.sigilName).toBe("kukali");
    expect(n?.attrs["trigger"]).toBe("sensor.OnFire");
  });
});

// ---------------------------------------------------------------------------
// TOML fence
// ---------------------------------------------------------------------------

describe("toml sigil", () => {
  test("toml fence with profile=iam", () => {
    const nodes = ast("```toml iam\nkey = \"val\"\n```");
    const n = nodes.find((n) => n.kind === "Sigil") as SigilNode | undefined;
    expect(n?.sigilName).toBe("toml");
    expect(n?.attrs["profile"]).toBe("iam");
    expect(n?.attrs["content"]).toContain("key");
  });

  test("bare toml fence → profile empty string", () => {
    const nodes = ast("```toml\nfoo = 1\n```");
    const n = nodes.find((n) => n.kind === "Sigil") as SigilNode | undefined;
    expect(n?.sigilName).toBe("toml");
    expect(n?.attrs["profile"]).toBe("");
  });
});

// ---------------------------------------------------------------------------
// English alias erasure — aliases emit canonical name before AST
// ---------------------------------------------------------------------------

describe("inline alias erasure", () => {
  test("\\if → wai", () => {
    const evts = collectEvents(`<<~ \\if [tag[x]] >>`);
    expect(evts.some((e) => e.sigilName === "wai")).toBe(true);
    expect(evts.every((e) => e.sigilName !== "\\if")).toBe(true);
  });

  test("\\else → mukuwai", () => {
    const evts = collectEvents(`<<~ \\else >>`);
    expect(evts.some((e) => e.sigilName === "mukuwai")).toBe(true);
  });

  test("\\const → waiho (pragma, carrier-scoped)", () => {
    const evts = collectEvents(`<<~! \\const myVar = hello >>`);
    expect(evts.some((e) => e.sigilName === "waiho" && e.eventType === "pragma")).toBe(true);
  });

  test("\\let → waiho (open/close, block-scoped)", () => {
    const evts = collectEvents(`<<~ \\let x = 1 >>`);
    expect(evts.some((e) => e.sigilName === "waiho" && e.eventType === "open")).toBe(true);
  });

  test("\\var → waiho (open/close, block-scoped)", () => {
    const evts = collectEvents(`<<~ \\var x = 1 >>`);
    expect(evts.some((e) => e.sigilName === "waiho" && e.eventType === "open")).toBe(true);
  });

  test("\\widget → kumu", () => {
    const evts = collectEvents(`<<~! \\widget MyCard >>`);
    expect(evts.some((e) => e.sigilName === "kumu")).toBe(true);
  });

  test("\\suspends → kukali", () => {
    const nodes = ast(`<<~ \\suspends trigger:portal.OnActivate >>`);
    const n = nodes.find((n) => n.kind === "Sigil") as SigilNode | undefined;
    expect(n?.sigilName).toBe("kukali");
    expect(n?.attrs["trigger"]).toBe("portal.OnActivate");
  });

  test("\\constraint → pono (edge sugar)", () => {
    const evts = collectEvents(`<<~ \\constraint ? -> lar:///x role:implements >>`);
    expect(evts.some((e) => e.sigilName === "pono")).toBe(true);
  });

  test("\\task → hana (grammar-meme registered)", () => {
    const nodes = ast(`<<~ \\task my-grammar >>\n<<~/\\task >>`);
    const n = nodes.find((n) => n.kind === "Sigil") as SigilNode | undefined;
    expect(n?.sigilName).toBe("hana");
    expect(n?.attrs["grammarKey"]).toBe("my-grammar");
  });
});

// ---------------------------------------------------------------------------
// DynamicNode — grammar-meme-registered extensions
// ---------------------------------------------------------------------------

describe("DynamicNode — grammar-registered sigils", () => {
  test("unknown sigil with grammar entry → DynamicNode", () => {
    const fakeGrammar = {
      sigils: [{
        name: "wao",
        kind: "worksite" as const,
        openPattern:  String.raw`<<~\s*wao\s*>>`,
        closePattern: String.raw`<<~\/wao\s*>>`,
      }],
      families: [],
    };
    const nodes = parseMemeCarrier(BASE, `<<~ wao >>\n<<~/wao >>`, fakeGrammar);
    const dyn = nodes.find((n) => n.kind === "Dynamic") as DynamicNode | undefined;
    expect(dyn?.sigilName).toBe("wao");
    expect(dyn?.eventType).toBe("open-close");
  });
});
