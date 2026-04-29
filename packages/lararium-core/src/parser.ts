// ---------------------------------------------------------------------------
// parser.ts — Phase 3 unified carrier parser (compressed)
//
// Three stages: collectEvents → buildAst → [edgesFromAst]
//
// Alias erasure is INLINE in collectEvents: each SigilScan carries an optional
// canonicalName; alias scans emit canonical name directly. No separate phase.
//
// Node hierarchy is flat: canonical non-edge sigils all produce SigilNode.
// Typed nodes (WorksiteNode, EdgeNode, EdgeSugarNode, etc.) exist only where
// edgesFromAst needs to branch on node shape.
//
// BOOTSTRAP_SCANS covers edge sigils + ahu + the most common control sigils.
// When GrammarRules are loaded (normal server operation), buildScansFromGrammar
// replaces this entirely.
//
// Refresh model: on carrier change → parseMemeCarrier(uri, newText, grammar)
// → diff MemeAstNode[] → edgesFromAst delta → broadcast to connected clients.
// ---------------------------------------------------------------------------

import type {
  GrammarRules,
  SigilRule,
  PranaEdge,
  MemeAstNode,
  WorksiteNode,
  EdgeNode,
  EdgeSugarNode,
  DispatchNode,
  CarrierHeaderNode,
  SigilNode,
  DynamicNode,
} from "./ast.js";

// ---------------------------------------------------------------------------
// SigilScan — one regex scan pass; canonicalName enables inline alias erasure
// ---------------------------------------------------------------------------

interface SigilScan {
  sigilName: string;
  canonicalName?: string;   // set on alias scans; event emits this name instead
  regex: RegExp;
  eventType: "open" | "close" | "leaf" | "pragma";
}

// ---------------------------------------------------------------------------
// BOOTSTRAP_SCANS — minimal edge + ahu + common control sigils.
// Used when no GrammarRules loaded (bootstrap / unit tests without grammar).
// ---------------------------------------------------------------------------

const BOOTSTRAP_SCANS: SigilScan[] = [
  // Structural
  { sigilName: "ahu",       regex: /<<~[^>]*\bahu\s+(#[\w-]+)\s*>>/g,     eventType: "open"   },
  { sigilName: "ahu",       regex: /<<~\/ahu\s*>>/g,                       eventType: "close"  },
  // Edge — block before inline so block wins at same position
  { sigilName: "pranala",   regex: /<<~\s*pranala\s+(#[\w-]+\s+)?(\S+)\s*->\s*(\S+)\s*>>([\s\S]*?)<<~\/pranala\s*>>/gs, eventType: "leaf" },
  { sigilName: "pranala",   regex: /<<~\s*pranala\s+(#[\w-]+\s+)?(\S+)\s*->\s*(\S+)(?:\s+family:([\w-]+))?(?:\s+role:([\w-]+))?\s*>>/g, eventType: "leaf" },
  // Edge sugar
  { sigilName: "loulou",    regex: /<<~\s*loulou\s+(\S+)\s*>>/g,           eventType: "leaf"   },
  { sigilName: "aka",       regex: /<<~\s*aka\s+(\S+)\s*>>/g,              eventType: "leaf"   },
  // kahea URI form:  <<~ kahea lar:///uri >> → EdgeSugarNode (compile + render)
  // kahea name form: <<~ kahea name(args)  >> → SigilNode (render-only)
  // URI form matched first (starts with lar: or contains / or #).
  // Name form: identifier optionally followed by (key:val ...) args block.
  { sigilName: "kahea",      regex: /<<~\s*kahea\s+(lar:[^\s>]+|[^\s>(]+\/[^\s>]*|[^\s>(]+#[^\s>]*)\s*>>/g, eventType: "leaf" },
  { sigilName: "kahea-call", regex: /<<~\s*kahea\s+([\w][\w.-]*)\s*(?:\(([^)]*)\))?\s*>>/g,                  eventType: "leaf" },
  { sigilName: "pono",      regex: /<<~\s*pono\s+(#[\w-]+\s+)?(\S+)\s*->\s*(\S+)(?:\s+role:([\w-]+))?\s*>>/g, eventType: "leaf" },
  { sigilName: "lele",      regex: /<<~\s*lele\s+(\S+)\s*>>/g,             eventType: "leaf"   },
  // papalohe: groups [full, #slot?, FROM, TO, trigger?, fn?]
  // Full UEFN wire: <<~ papalohe DeviceA -> DeviceB trigger:OnEliminated fn:ShowScore >>
  { sigilName: "papalohe",  regex: /<<~\s*papalohe\s+(#[\w-]+\s+)?(\S+)\s*->\s*(\S+)(?:\s+trigger:([\w.-]+))?(?:\s+fn:([\w.-]+))?\s*>>/g, eventType: "leaf" },
  // TOML data block — general carrier (```toml fence or sigil form)
  { sigilName: "toml",      regex: /```toml\s*([\s\S]*?)```/g,              eventType: "leaf"   },
  { sigilName: "toml",      regex: /<<~\s*toml\s*>>([\s\S]*?)<<~\/toml\s*>>/g, eventType: "leaf" },
  // Variable binding (kau — core enough to bootstrap)
  { sigilName: "kau",       regex: /<<~!\s*kau\s+([\w-]+)\s*=\s*([^\n>]+?)\s*>>/g,  eventType: "pragma" },
  { sigilName: "kau",       regex: /<<~\s*kau\s+([\w-]+)\s*=\s*([^\n>]+?)\s*>>/g,   eventType: "open"   },
  { sigilName: "kau",       regex: /<<~\/kau\s*>>/g,                                 eventType: "close"  },
  // Conditional (needed for parity testing)
  { sigilName: "wai",       regex: /<<~\s*wai\s+([^\n>]+?)\s*>>/g,         eventType: "open"   },
  { sigilName: "wai",       regex: /<<~\/wai\s*>>/g,                        eventType: "close"  },
  { sigilName: "mukuwai",   regex: /<<~\s*mukuwai\s*>>/g,                   eventType: "leaf"   },
  { sigilName: "kahawai",   regex: /<<~\s*kahawai\s+([^\n>]+?)\s*>>/g,     eventType: "leaf"   },
  // Iteration
  { sigilName: "huli",      regex: /<<~\s*huli\s+([^\n>]+?)\s+as\s+([\w-]+)\s*>>/g, eventType: "open" },
  { sigilName: "huli",      regex: /<<~\/huli\s*>>/g,                               eventType: "close" },
  // English aliases — emit canonical name directly (inline erasure)
  { sigilName: "\\if",      canonicalName: "wai",     regex: /<<~\s*\\if\s+([^\n>]+?)\s*>>/g,           eventType: "open"   },
  { sigilName: "\\if",      canonicalName: "wai",     regex: /<<~\/\\if\s*>>/g,                          eventType: "close"  },
  { sigilName: "\\else",    canonicalName: "mukuwai", regex: /<<~\s*\\else\s*>>/g,                       eventType: "leaf"   },
  { sigilName: "\\elif",    canonicalName: "kahawai", regex: /<<~\s*\\elif\s+([^\n>]+?)\s*>>/g,         eventType: "leaf"   },
  { sigilName: "\\const",   canonicalName: "kau",     regex: /<<~!\s*\\const\s+([\w-]+)\s*=\s*([^\n>]+?)\s*>>/g, eventType: "pragma" },
  { sigilName: "\\let",     canonicalName: "kau",     regex: /<<~\s*\\let\s+([\w-]+)\s*=\s*([^\n>]+?)\s*>>/g,    eventType: "open"   },
  { sigilName: "\\let",     canonicalName: "kau",     regex: /<<~\/\\let\s*>>/g,                         eventType: "close"  },
  { sigilName: "\\var",     canonicalName: "kau",     regex: /<<~\s*\\var\s+([\w-]+)\s*=\s*([^\n>]+?)\s*>>/g,    eventType: "open"   },
  { sigilName: "\\var",     canonicalName: "kau",     regex: /<<~\/\\var\s*>>/g,                         eventType: "close"  },
  { sigilName: "kumu",                                regex: /<<~\s*kumu\s+([\w-]+)(?:\(([^)]*)\))?\s*>>/g,     eventType: "open"  },
  { sigilName: "kumu",                                regex: /<<~\/kumu\s*>>/g,                                   eventType: "close"  },
  { sigilName: "\\widget",  canonicalName: "kumu",    regex: /<<~!\s*\\widget\s+([\w-]+)(?:\(([^)]*)\))?\s*>>/g, eventType: "open"  },
  { sigilName: "\\widget",  canonicalName: "kumu",    regex: /<<~\/\\widget\s*>>/g,                               eventType: "close"  },
  { sigilName: "\\task",    canonicalName: "hana",    regex: /<<~\s*\\task\s+([^\n>]+?)\s*>>/g,          eventType: "open"   },
  { sigilName: "\\task",    canonicalName: "hana",    regex: /<<~\/\\task\s*>>/g,                        eventType: "close"  },
  // kukali — reactive wait posture inside a causal island (Verse `suspends` analogue)
  // groups [full, trigger?] — trigger is optional papalohe slot name
  { sigilName: "kukali",    regex: /<<~\s*kukali(?:\s+trigger:([\w.-]+))?\s*>>/g, eventType: "leaf" },
  { sigilName: "\\suspends", canonicalName: "kukali", regex: /<<~\s*\\suspends(?:\s+trigger:([\w.-]+))?\s*>>/g, eventType: "leaf" },
];

function buildScansFromGrammar(sigils: SigilRule[]): SigilScan[] {
  const scans: SigilScan[] = [];
  const safe = (src: string, flags: string): RegExp | null => {
    try { return new RegExp(src, flags); } catch { return null; }
  };
  for (const s of sigils) {
    const alias = s.aliasFor;
    const extra = alias ? { canonicalName: alias } : {};
    if (s.openPattern) {
      const rx = safe(s.openPattern, "g");
      if (rx) scans.push({ sigilName: s.name, ...extra, regex: rx, eventType: "open" });
    }
    if (s.closePattern) {
      const rx = safe(s.closePattern, "g");
      if (rx) scans.push({ sigilName: s.name, ...extra, regex: rx, eventType: "close" });
    }
    if (s.pragmaPattern) {
      const rx = safe(s.pragmaPattern, "g");
      if (rx) scans.push({ sigilName: s.name, ...extra, regex: rx, eventType: "pragma" });
    }
    if (s.blockPattern) {
      const rx = safe(s.blockPattern, "gs");
      if (rx) scans.push({ sigilName: s.name, ...extra, regex: rx, eventType: "leaf" });
    }
    if (s.inlinePattern) {
      const rx = safe(s.inlinePattern, "g");
      if (rx) scans.push({ sigilName: s.name, ...extra, regex: rx, eventType: "leaf" });
    }
    if (s.pattern && !s.openPattern && !s.blockPattern && !s.inlinePattern) {
      const flags = s.name === "pranala" ? "gs" : "g";
      const rx = safe(s.pattern, flags);
      if (rx) scans.push({ sigilName: s.name, ...extra, regex: rx, eventType: "leaf" });
    }
  }
  return scans;
}

// ---------------------------------------------------------------------------
// ParseEvent
// ---------------------------------------------------------------------------

interface ParseEvent {
  pos: number;
  end: number;
  raw: string;
  sigilName: string;     // canonical (alias already erased via canonicalName)
  eventType: "open" | "close" | "leaf" | "pragma";
  groups: (string | undefined)[];
}

// ---------------------------------------------------------------------------
// collectEvents — scan + inline alias erasure in one pass
// ---------------------------------------------------------------------------

export function collectEvents(text: string, grammar?: GrammarRules): ParseEvent[] {
  const scans = grammar ? buildScansFromGrammar(grammar.sigils) : BOOTSTRAP_SCANS;

  // Pranala block spans: inline events inside a pranala block body are excluded
  const blockSpans: [number, number][] = [];
  for (const m of text.matchAll(/<<~\s*pranala\s+(#[\w-]+\s+)?(\S+)\s*->\s*(\S+)\s*>>([\s\S]*?)<<~\/pranala\s*>>/gs)) {
    blockSpans.push([m.index!, m.index! + m[0].length]);
  }
  const inBlock = (pos: number): boolean => blockSpans.some(([s, e]) => pos >= s && pos < e);

  const seen = new Set<number>();
  const events: ParseEvent[] = [];

  for (const scan of scans) {
    const rx = new RegExp(scan.regex.source, scan.regex.flags.includes("s") ? "gs" : "g");
    const emitName = scan.canonicalName ?? scan.sigilName; // inline alias erasure
    for (const m of text.matchAll(rx)) {
      const pos = m.index!;
      if (seen.has(pos)) continue;
      if (scan.eventType !== "open" && scan.eventType !== "close" && inBlock(pos)) continue;
      seen.add(pos);
      events.push({ pos, end: pos + m[0].length, raw: m[0], sigilName: emitName, eventType: scan.eventType, groups: [...m] });
    }
  }

  return events.sort((a, b) => a.pos - b.pos || a.end - b.end);
}

// ---------------------------------------------------------------------------
// attrsFromGroups — the compression core.
// Extracts sigil-specific named attributes from regex capture groups.
// Replaces the 15-case finalizeNode/buildLeafNode switch with 12 lines.
// ---------------------------------------------------------------------------

function attrsFromGroups(
  name: string,
  groups: (string | undefined)[],
  scope: "carrier" | "block" = "block",
): Record<string, string> {
  const g = (i: number) => (groups[i] ?? "").trim();
  switch (name) {
    case "wai":     return { filter: g(1) };
    case "kahawai": return { filter: g(1) };
    case "huli":    return { filter: g(1), binding: g(2) };
    case "hana":    return { grammarKey: g(1) };
    case "meme":    return { targetUri: g(1) };
    case "wehe":
    case "kumu":    return { name: g(1), params: g(2) };
    case "helu":    return { name: g(1), params: g(2), expression: g(3) };
    case "kau":     return { name: g(1), value: g(2), scope };
    case "kapu":    return { qualifier: g(1), inline: scope === "carrier" ? "true" : "false" };
    case "ui":      return { filter: g(1) };
    case "kukali":  return g(1) ? { trigger: g(1) } : {};
    case "toml":
    case "iam":     return { content: g(1) };
    default:        return {};
  }
}

// ---------------------------------------------------------------------------
// buildAst — push/pop scope stack → MemeAstNode[]
// Frame is the internal under-construction state; finalizeNode closes it.
// ---------------------------------------------------------------------------

interface Frame {
  sigilName: string;
  pos: number;
  raw: string;
  groups: (string | undefined)[];
  children: MemeAstNode[];
}

const CANONICAL_SIGILS = new Set([
  "ahu", "pranala", "loulou", "aka", "kahea", "kahea-call", "pono", "lele", "papalohe",
  "wai", "mukuwai", "kahawai", "huli", "hana", "meme",
  "wehe", "helu", "kumu", "kau", "kapu", "hui", "heihei", "puka", "ui",
  "iam", "toml", "pranala-header",
  "kukali",
]);

export function buildAst(events: ParseEvent[], carrierUri: string, grammar?: GrammarRules, sourceText?: string): MemeAstNode[] {
  const root: MemeAstNode[] = [];
  const stack: Frame[] = [];
  const ahuStack: string[] = [];
  let cursor = 0;

  const top = (): MemeAstNode[] => stack.length > 0 ? stack[stack.length - 1]!.children : root;

  const emitTextGap = (upTo: number) => {
    if (!sourceText || upTo <= cursor) return;
    const span = sourceText.slice(cursor, upTo);
    if (span.trim()) {
      top().push({ kind: "Text", pos: cursor, raw: span, content: span } as import("./ast.js").TextNode);
    }
  };

  for (const evt of events) {
    const { sigilName, eventType, pos, end, raw, groups } = evt;
    emitTextGap(pos);

    if (eventType === "open") {
      stack.push({ sigilName, pos, raw, groups, children: [] });
      if (sigilName === "ahu") ahuStack.push(carrierUri + (groups[1] ?? "").trim());
      cursor = end;
      continue;
    }

    if (eventType === "close") {
      // Walk back to matching open, orphan anything above it
      let i = stack.length - 1;
      while (i >= 0 && stack[i]!.sigilName !== sigilName) i--;
      if (i < 0) { cursor = end; continue; }
      while (stack.length - 1 > i) {
        const orphan = stack.pop()!;
        top().push(closeFrame(orphan, carrierUri, "block", grammar));
      }
      const frame = stack.pop()!;
      if (sigilName === "ahu") ahuStack.pop();
      top().push(closeFrame(frame, carrierUri, "block", grammar));
      cursor = end;
      continue;
    }

    // leaf or pragma
    top().push(makeLeaf(sigilName, eventType, pos, end, raw, groups, carrierUri, ahuStack, grammar));
    cursor = end;
  }

  // Trailing text after last event
  if (sourceText && cursor < sourceText.length) {
    const span = sourceText.slice(cursor);
    if (span.trim()) {
      top().push({ kind: "Text", pos: cursor, raw: span, content: span } as import("./ast.js").TextNode);
    }
  }

  // Unclosed frames
  while (stack.length > 0) {
    const frame = stack.pop()!;
    if (frame.sigilName === "ahu") ahuStack.pop();
    root.push(closeFrame(frame, carrierUri, "block", grammar));
  }

  return root;
}

function closeFrame(frame: Frame, carrierUri: string, _scope: "block", grammar?: GrammarRules): MemeAstNode {
  const { sigilName, pos, raw, groups, children } = frame;
  const base = { pos, raw };

  if (sigilName === "ahu") {
    const slot = (groups[1] ?? "").trim();
    return { kind: "Worksite", ...base, slot, uri: carrierUri + slot, body: children } as WorksiteNode;
  }
  if (sigilName === "pranala") {
    // Block form
    const slot = (groups[1] ?? "").trim() || null;
    const fromRaw = (groups[2] ?? "").trim();
    const toRaw   = (groups[3] ?? "").trim();
    const body    = groups[4] ?? "";
    const family  = body.match(/\bfamily\s*=\s*"([\w-]+)"/)?.[1] ?? "relation";
    const role    = body.match(/\brole\s*=\s*"([\w-]+)"/)?.[1] ?? null;
    return { kind: "Edge", ...base, slot, fromRaw, toRaw, family, role, body: children } as EdgeNode;
  }
  if (CANONICAL_SIGILS.has(sigilName)) {
    return { kind: "Sigil", ...base, sigilName, attrs: attrsFromGroups(sigilName, groups, "block"), body: children } as SigilNode;
  }
  // DynamicNode — grammar-meme extension
  const sigilKind = grammar?.sigils.find((s) => s.name === sigilName)?.kind ?? "unknown";
  return { kind: "Dynamic", ...base, sigilName, sigilKind, eventType: "open-close", body: children } as DynamicNode;
}

function makeLeaf(
  sigilName: string,
  eventType: "leaf" | "pragma",
  pos: number, end: number, raw: string,
  groups: (string | undefined)[],
  carrierUri: string,
  ahuStack: string[],
  grammar?: GrammarRules,
): MemeAstNode {
  const base = { pos, raw };
  const g = (i: number) => (groups[i] ?? "").trim();

  switch (sigilName) {
    case "pranala": {
      // Inline form
      const slot   = g(1) || null;
      const fromRaw = g(2);
      const toRaw   = g(3);
      const family  = g(4) || "relation";
      const role    = g(5) || null;
      return { kind: "Edge", ...base, slot, fromRaw, toRaw, family, role, body: [] } as EdgeNode;
    }
    case "loulou":
      return { kind: "EdgeSugar", ...base, sigil: "loulou", slot: null, fromRaw: null, toRaw: g(1), family: "relation", role: null, trigger: null, fn: null } as EdgeSugarNode;
    case "aka":
      return { kind: "EdgeSugar", ...base, sigil: "aka",    slot: null, fromRaw: null, toRaw: g(1), family: "observe",  role: null, trigger: null, fn: null } as EdgeSugarNode;
    case "kahea":
      return { kind: "EdgeSugar", ...base, sigil: "kahea", slot: null, fromRaw: null, toRaw: g(1), family: "dataflow", role: null, trigger: null, fn: null } as EdgeSugarNode;
    case "kahea-call":
      // Definition invocation — render-only, no compile-time graph edge.
      // attrs.name = definition name; attrs.args = raw args string (render layer parses)
      return { kind: "Sigil", ...base, sigilName: "kahea", attrs: { name: g(1) ?? "", args: g(2) ?? "" }, body: [] } as SigilNode;
    case "pono": {
      const slot = g(1) || null;
      return { kind: "EdgeSugar", ...base, sigil: "pono", slot, fromRaw: g(2), toRaw: g(3), family: "constraint", role: g(4) || null, trigger: null, fn: null } as EdgeSugarNode;
    }
    case "papalohe": {
      const slot = g(1) || null;
      return { kind: "EdgeSugar", ...base, sigil: "papalohe", slot, fromRaw: g(2), toRaw: g(3), family: "reaction", role: null, trigger: g(4) || null, fn: g(5) || null } as EdgeSugarNode;
    }
    case "lele":
      return { kind: "Dispatch", ...base, targetRaw: g(1), family: "message" } as DispatchNode;
    case "iam":
      // iam is a special ahu slot — emit as SigilNode so toml content is in attrs
      return { kind: "Sigil", ...base, sigilName: "iam", attrs: { content: groups[1] ?? "" }, body: [] } as SigilNode;
    case "toml":
      return { kind: "Sigil", ...base, sigilName: "toml", attrs: { content: groups[1] ?? "" }, body: [] } as SigilNode;
    case "pranala-header":
      return { kind: "CarrierHeader", ...base, toUri: g(1) } as CarrierHeaderNode;
    default: {
      if (CANONICAL_SIGILS.has(sigilName)) {
        const scope = eventType === "pragma" ? "carrier" : "block";
        return { kind: "Sigil", ...base, sigilName, attrs: attrsFromGroups(sigilName, groups, scope), body: [] } as SigilNode;
      }
      const sigilKind = grammar?.sigils.find((s) => s.name === sigilName)?.kind ?? "unknown";
      return { kind: "Dynamic", ...base, sigilName, sigilKind, eventType: eventType === "pragma" ? "pragma" : "leaf", body: [] } as DynamicNode;
    }
  }
}

// ---------------------------------------------------------------------------
// edgesFromAst — projection walk
// ---------------------------------------------------------------------------

export function edgesFromAst(ast: MemeAstNode[], carrierUri: string): PranaEdge[] {
  const edges: PranaEdge[] = [];
  walkForEdges(ast, carrierUri, [carrierUri], edges);
  return edges;
}

function walkForEdges(nodes: MemeAstNode[], carrierUri: string, ahuStack: string[], edges: PranaEdge[]): void {
  for (const node of nodes) {
    switch (node.kind) {
      case "Worksite":
        ahuStack.push(node.uri);
        walkForEdges(node.body, carrierUri, ahuStack, edges);
        ahuStack.pop();
        break;
      case "Edge":
        edges.push(projectEdge(node, carrierUri, ahuStack));
        if (node.body.length) walkForEdges(node.body, carrierUri, ahuStack, edges);
        break;
      case "EdgeSugar":
        edges.push(projectSugar(node, carrierUri, ahuStack));
        break;
      case "Dispatch":
        edges.push(projectDispatch(node, carrierUri, ahuStack));
        break;
      case "CarrierHeader":
        edges.push(mk(carrierUri, carrierUri, null, node.toUri, node.toUri, "control", "header"));
        break;
      case "Sigil":
      case "Dynamic":
        if (node.body.length) walkForEdges(node.body, carrierUri, ahuStack, edges);
        break;
    }
  }
}

// ---------------------------------------------------------------------------
// Edge projection helpers
// ---------------------------------------------------------------------------

function tok(token: string, carrierUri: string, ahuStack: string[]): [string, string] {
  if (token === "?") {
    return [carrierUri, ahuStack[ahuStack.length - 1] ?? carrierUri];
  }
  if (token.startsWith("#")) return [carrierUri, carrierUri + token];
  if (token.startsWith("lar:///") && token.includes("#")) {
    const idx = token.indexOf("#");
    const uri = token.slice(0, idx);
    return [uri, uri + token.slice(idx)];
  }
  if (token.startsWith("lar:///")) return [token, token];
  return [carrierUri, carrierUri];
}

function mk(
  fromUri: string, fromSocket: string, fromSlot: string | null,
  toUri: string, toSocket: string,
  family: string, role: string | null,
  payload: Record<string, unknown> = {},
): PranaEdge {
  return {
    fromUri, fromSocket, fromSlot, toUri, toSocket, family, role,
    lifecycle: "instance", traversal: "source-to-target", propagation: "none",
    label: "", cardinality: null, polarity: null, status: "declared",
    confidence: null, renderMode: null, payload,
  };
}

function projectEdge(node: EdgeNode, cu: string, ahuStack: string[]): PranaEdge {
  const fromSlot = node.slot ? cu + node.slot : null;
  const [fromUri, fromSocket] = tok(node.fromRaw, cu, ahuStack);
  const [toUri, toSocket] = tok(node.toRaw, cu, ahuStack);
  return mk(fromUri, fromSocket, fromSlot, toUri, toSocket, node.family, node.role);
}

function projectSugar(node: EdgeSugarNode, cu: string, ahuStack: string[]): PranaEdge {
  const fromSlot = node.slot ? cu + node.slot : null;
  const fromSocket = ahuStack[ahuStack.length - 1] ?? cu;

  if (node.fromRaw !== null) {
    const [fromUri, fSock] = tok(node.fromRaw, cu, ahuStack);
    const [toUri, toSocket] = tok(node.toRaw, cu, ahuStack);
    const payload: Record<string, unknown> = {};
    if (node.trigger) payload["trigger"] = node.trigger;
    if (node.fn)      payload["fn"]      = node.fn;
    const renderMode = node.sigil === "papalohe" ? "reaction-wire" : null;
    const edge = mk(fromUri, fSock, fromSlot, toUri, toSocket, node.family, node.role, payload);
    return renderMode ? { ...edge, renderMode } : edge;
  }

  // Single-URI sugar
  const toRaw = node.toRaw;
  let toUri: string, toSocket: string;
  if (toRaw.startsWith("#")) { toUri = cu; toSocket = cu + toRaw; }
  else if (toRaw.startsWith("lar:///") && toRaw.includes("#")) {
    const idx = toRaw.indexOf("#"); toUri = toRaw.slice(0, idx); toSocket = toUri + toRaw.slice(idx);
  } else { toUri = toRaw; toSocket = ""; }

  const propagation = node.sigil === "kahea" ? "push-forward" : "none";
  return mk(cu, fromSocket, null, toUri, toSocket, node.family, node.role, { propagation });
}

function projectDispatch(node: DispatchNode, cu: string, ahuStack: string[]): PranaEdge {
  const fromSocket = ahuStack[ahuStack.length - 1] ?? cu;
  const toRaw = node.targetRaw;
  let toUri: string, toSocket: string;
  if (toRaw.startsWith("#")) { toUri = cu; toSocket = cu + toRaw; }
  else if (toRaw.startsWith("lar:///") && toRaw.includes("#")) {
    const idx = toRaw.indexOf("#"); toUri = toRaw.slice(0, idx); toSocket = toUri + toRaw.slice(idx);
  } else { toUri = toRaw; toSocket = ""; }
  return mk(cu, fromSocket, null, toUri, toSocket, "message", null);
}

// ---------------------------------------------------------------------------
// parseMemeCarrier — public entry point
// ---------------------------------------------------------------------------

export function parseMemeCarrier(
  carrierUri: string,
  text: string,
  grammar?: GrammarRules,
): MemeAstNode[] {
  return buildAst(collectEvents(text, grammar), carrierUri, grammar, text);
}

/**
 * Parse a carrier text into a rooted CarrierNode — the island boundary unit.
 * Prefer this over parseMemeCarrier when building the full widget pipeline;
 * pass the result to resolveCarrier() to get a CarrierWidget.
 */
export function parseCarrierNode(
  uri: string,
  text: string,
  grammar?: GrammarRules,
): import("./ast.js").CarrierNode {
  return {
    kind: "Carrier",
    uri,
    body: parseMemeCarrier(uri, text, grammar),
  };
}
