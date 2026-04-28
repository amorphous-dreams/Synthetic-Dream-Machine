/**
 * Pranala parser — extract PranaEdge records from carrier text.
 *
 * Surface forms:
 *   block pranala   <<~ pranala #frag FROM -> TO >> ... <<~/pranala >>
 *   inline pranala  <<~ pranala #frag FROM -> TO family:F role:R >>
 *   loulou sugar    <<~ loulou URI >>          → family=relation
 *   aka sugar       <<~ aka URI >>             → family=observe
 *   kahea sugar     <<~ kahea URI >>           → family=dataflow
 *
 * ? -> resolution uses the innermost enclosing ahu #fragment as from_socket.
 */

export interface PranaEdge {
  readonly fromUri: string;
  /** The enclosing ahu worksite socket. Falls back to carrierUri if no ahu is open. */
  readonly fromSocket: string;
  /**
   * Named outgoing slot on the fromSocket ahu, if the pranala carries an explicit #fragment.
   * `<<~ pranala #hydrate-hud ? -> TARGET >>` → fromSocket=#core-hydration, fromSlot=#hydrate-hud
   * Null for bare `?` pranala (no explicit slot name).
   */
  readonly fromSlot: string | null;
  readonly toUri: string;
  readonly toSocket: string;
  readonly family: string;
  readonly lifecycle: string;
  readonly role: string | null;
  readonly traversal: string;
  readonly propagation: string;
  readonly label: string;
  readonly payload: Record<string, unknown>;
  readonly cardinality: string | null;
  readonly polarity: string | null;
  readonly status: string;
  readonly confidence: number | null;
  readonly renderMode: string | null;
}

// ---------------------------------------------------------------------------
// Family contract — parse-time property schema
// ---------------------------------------------------------------------------

export type PranaViolationSeverity = "error" | "warning";

export interface PranaEdgeViolation {
  readonly fromUri: string;
  readonly toUri: string;
  readonly family: string;
  readonly severity: PranaViolationSeverity;
  readonly rule: string;
  readonly message: string;
}

interface FamilyContract {
  /** Error if family name not in this set */
  knownFamilies: readonly string[];
  /** Warn if role missing */
  roleRecommended: boolean;
  /** Error if confidence present but outside [0, 1] */
  confidenceBounded: boolean;
}

const KNOWN_FAMILIES = ["control", "relation", "observe", "dataflow", "message", "constraint", "reaction"] as const;

const FAMILY_CONTRACTS: Record<string, Omit<FamilyContract, "knownFamilies">> = {
  control:    { roleRecommended: true,  confidenceBounded: false },
  relation:   { roleRecommended: false, confidenceBounded: false },
  observe:    { roleRecommended: false, confidenceBounded: true  },
  dataflow:   { roleRecommended: true,  confidenceBounded: false },
  message:    { roleRecommended: true,  confidenceBounded: false },
  constraint: { roleRecommended: false, confidenceBounded: false },
  reaction:   { roleRecommended: true,  confidenceBounded: false },
};

export function validatePranaEdge(edge: PranaEdge, grammar?: GrammarRules): PranaEdgeViolation[] {
  const violations: PranaEdgeViolation[] = [];
  const base = { fromUri: edge.fromUri, toUri: edge.toUri, family: edge.family };
  const contracts = resolveFamilyContracts(grammar);
  const knownFamilies = grammar
    ? grammar.families.map((f) => f.name)
    : (KNOWN_FAMILIES as readonly string[]);

  if (!knownFamilies.includes(edge.family)) {
    violations.push({ ...base, severity: "error", rule: "unknown-family",
      message: `family "${edge.family}" not in [${knownFamilies.join(", ")}]` });
    return violations;
  }

  const contract = contracts[edge.family]!;

  if (contract.roleRecommended && !edge.role) {
    violations.push({ ...base, severity: "warning", rule: "role-recommended",
      message: `${edge.family} edge missing role (from ${edge.fromUri} → ${edge.toUri})` });
  }

  if (contract.confidenceBounded && edge.confidence !== null) {
    if (typeof edge.confidence !== "number" || edge.confidence < 0 || edge.confidence > 1) {
      violations.push({ ...base, severity: "error", rule: "confidence-out-of-range",
        message: `confidence ${edge.confidence} outside [0, 1]` });
    }
  }

  return violations;
}

export { KNOWN_FAMILIES, FAMILY_CONTRACTS };

// ---------------------------------------------------------------------------
// GrammarRules — Phase 2 external grammar interface
//
// In Phase 1 the parser uses hard-coded patterns below.
// In Phase 2 a GrammarRules object (read from lares/grammars/memetic-wikitext.md)
// overrides patterns and family contracts. parsePranalaEdges accepts GrammarRules
// as an optional second argument; absent = fall back to built-ins.
// ---------------------------------------------------------------------------

export interface SigilRule {
  name: string;
  kind: "worksite" | "edge" | "edge-sugar" | "metadata" | "header" | "concurrency" | "query" | "guest-grammar" | "guest-grammar-alias" | "query-alias" | "pragma" | "conditional" | "conditional-else" | "conditional-branch" | "iteration" | "context" | "concurrency-alias" | "edge-alias" | "pragma-alias" | "iteration-alias" | "conditional-alias";
  /** Layer: compile, render, or both */
  layer?: "compile" | "render" | "both";
  /** For edge sigils: inline match pattern (regex source string) */
  inlinePattern?: string;
  /** For edge sigils: block match pattern (regex source string, dotAll) */
  blockPattern?: string;
  /** For open-close sigils: open pattern */
  openPattern?: string;
  /** For open-close sigils: close pattern */
  closePattern?: string;
  /** For leaf sigils: match pattern */
  pattern?: string;
  /** For pragma hoisted sigils (<<~! form) */
  pragmaPattern?: string;
  /** For alias sigils: canonical sigil name this maps to */
  aliasFor?: string;
  defaultFamily?: string;
  defaultPropagation?: string;
}

export interface FamilyRule {
  name: string;
  dagRequired: boolean;
  roleRecommended: boolean;
  confidenceBounded: boolean;
}

export interface GrammarRules {
  sigils: SigilRule[];
  families: FamilyRule[];
}

// ---------------------------------------------------------------------------
// Built-in regex constants (Phase 1 hard-coded kernel — bootstrap safety net)
// ---------------------------------------------------------------------------

const BUILTIN_AHU_OPEN    = /<<~[^>]*\bahu\s+(#[\w-]+)\s*>>/g;
const BUILTIN_AHU_CLOSE   = /<<~\/ahu\s*>>/g;
const BUILTIN_BLOCK_RE    = /<<~\s*pranala\s+(#[\w-]+\s+)?(\S+)\s*->\s*(\S+)\s*>>([\s\S]*?)<<~\/pranala\s*>>/gs;
const BUILTIN_INLINE_RE   = /<<~\s*pranala\s+(#[\w-]+\s+)?(\S+)\s*->\s*(\S+)(?:\s+family:([\w-]+))?(?:\s+role:([\w-]+))?\s*>>/g;
const BUILTIN_LOULOU_RE   = /<<~\s*loulou\s+(\S+)\s*>>/g;
const BUILTIN_AKA_RE      = /<<~\s*aka\s+(\S+)\s*>>/g;
const BUILTIN_KAHEA_RE    = /<<~\s*kahea\s+(\S+)\s*>>/g;
// pono: constraint family sugar — inline-pranala-style (#slot ? -> TARGET [role:R])
const BUILTIN_PONO_RE     = /<<~\s*pono\s+(#[\w-]+\s+)?(\S+)\s*->\s*(\S+)(?:\s+role:([\w-]+))?\s*>>/g;
// lele: message family sugar — fire-and-forget (lele TARGET)
const BUILTIN_LELE_RE     = /<<~\s*lele\s+(\S+)\s*>>/g;
// papalohe: reaction family sugar — pāpālohe "body-listening reflex" (#slot? FROM -> TO [trigger:EVENT])
const BUILTIN_PAPALOHE_RE      = /<<~\s*papalohe\s+(#[\w-]+\s+)?(\S+)\s*->\s*(\S+)(?:\s+trigger:([\w-]+))?\s*>>/g;
const TOML_FENCE_RE = /```toml\s*([\s\S]*?)```/;

// ---------------------------------------------------------------------------
// Grammar-aware regex resolution (Phase 2 method-dictionary pattern)
//
// resolveRegexes() builds the active regex set from GrammarRules when provided,
// falling back to built-in constants for any missing sigil entry.
// The interpretation engine (how these regexes are applied) never changes —
// only the rule table it reads is externally supplied.
// ---------------------------------------------------------------------------

interface ActiveRegexes {
  ahuOpen:  RegExp;
  ahuClose: RegExp;
  block:    RegExp;
  inline:   RegExp;
  loulou:   RegExp;
  aka:      RegExp;
  kahea:    RegExp;
  pono:     RegExp;
  lele:     RegExp;
  papalohe: RegExp;
  loulouDefaultFamily:     string;
  akaDefaultFamily:        string;
  kaheaDefaultFamily:      string;
  kaheaDefaultPropagation: string;
  ponoDefaultFamily:       string;
  leleDefaultFamily:       string;
  papaloheDefaultFamily:        string;
}

function sigilPattern(grammar: GrammarRules, name: string, key: keyof SigilRule): string | undefined {
  return grammar.sigils.find((s) => s.name === name)?.[key] as string | undefined;
}

function resolveRegexes(grammar?: GrammarRules): ActiveRegexes {
  if (!grammar) {
    return {
      ahuOpen:  BUILTIN_AHU_OPEN,
      ahuClose: BUILTIN_AHU_CLOSE,
      block:    BUILTIN_BLOCK_RE,
      inline:   BUILTIN_INLINE_RE,
      loulou:   BUILTIN_LOULOU_RE,
      aka:      BUILTIN_AKA_RE,
      kahea:    BUILTIN_KAHEA_RE,
      pono:     BUILTIN_PONO_RE,
      lele:     BUILTIN_LELE_RE,
      papalohe: BUILTIN_PAPALOHE_RE,
      loulouDefaultFamily:      "relation",
      akaDefaultFamily:         "observe",
      kaheaDefaultFamily:       "dataflow",
      kaheaDefaultPropagation:  "push-forward",
      ponoDefaultFamily:        "constraint",
      leleDefaultFamily:        "message",
      papaloheDefaultFamily:    "reaction",
    };
  }

  const safe = (src: string | undefined, fallback: RegExp, flags: string): RegExp => {
    if (!src) return new RegExp(fallback.source, flags);
    try { return new RegExp(src, flags); }
    catch { return new RegExp(fallback.source, flags); }
  };

  return {
    ahuOpen:  safe(sigilPattern(grammar, "ahu", "openPattern"),  BUILTIN_AHU_OPEN,  "g"),
    ahuClose: safe(sigilPattern(grammar, "ahu", "closePattern"), BUILTIN_AHU_CLOSE, "g"),
    block:    safe(sigilPattern(grammar, "pranala", "blockPattern"),  BUILTIN_BLOCK_RE,  "gds"),
    inline:   safe(sigilPattern(grammar, "pranala", "inlinePattern"), BUILTIN_INLINE_RE, "g"),
    loulou:   safe(sigilPattern(grammar, "loulou", "pattern"), BUILTIN_LOULOU_RE, "g"),
    aka:      safe(sigilPattern(grammar, "aka",    "pattern"), BUILTIN_AKA_RE,    "g"),
    kahea:    safe(sigilPattern(grammar, "kahea",  "pattern"), BUILTIN_KAHEA_RE,  "g"),
    pono:     safe(sigilPattern(grammar, "pono",      "pattern"), BUILTIN_PONO_RE,      "g"),
    lele:     safe(sigilPattern(grammar, "lele",      "pattern"), BUILTIN_LELE_RE,      "g"),
    papalohe: safe(sigilPattern(grammar, "papalohe",  "pattern"), BUILTIN_PAPALOHE_RE,  "g"),
    loulouDefaultFamily:      sigilPattern(grammar, "loulou",   "defaultFamily")      ?? "relation",
    akaDefaultFamily:         sigilPattern(grammar, "aka",      "defaultFamily")      ?? "observe",
    kaheaDefaultFamily:       sigilPattern(grammar, "kahea",    "defaultFamily")      ?? "dataflow",
    kaheaDefaultPropagation:  sigilPattern(grammar, "kahea",    "defaultPropagation") ?? "push-forward",
    ponoDefaultFamily:        sigilPattern(grammar, "pono",     "defaultFamily")      ?? "constraint",
    leleDefaultFamily:        sigilPattern(grammar, "lele",     "defaultFamily")      ?? "message",
    papaloheDefaultFamily:    sigilPattern(grammar, "papalohe", "defaultFamily")      ?? "reaction",
  };
}

// ---------------------------------------------------------------------------
// Grammar-aware family contract resolution
// ---------------------------------------------------------------------------

function resolveFamilyContracts(grammar?: GrammarRules): typeof FAMILY_CONTRACTS {
  if (!grammar || grammar.families.length === 0) return FAMILY_CONTRACTS;
  const out: typeof FAMILY_CONTRACTS = {};
  for (const f of grammar.families) {
    out[f.name] = {
      roleRecommended: f.roleRecommended,
      confidenceBounded: f.confidenceBounded,
    };
  }
  // Fill any gaps with built-in defaults
  for (const [k, v] of Object.entries(FAMILY_CONTRACTS)) {
    if (!out[k]) out[k] = v;
  }
  return out;
}

// ---------------------------------------------------------------------------
// URI helpers
// ---------------------------------------------------------------------------

function resolveTo(raw: string, carrierUri: string): [string, string] {
  if (raw.startsWith("#")) return [carrierUri, carrierUri + raw];
  if (raw.startsWith("lar:///") && raw.includes("#")) {
    const idx = raw.indexOf("#");
    const uri = raw.slice(0, idx);
    return [uri, uri + "#" + raw.slice(idx + 1)];
  }
  if (raw.startsWith("lar:///")) return [raw, ""];
  // Relative: prepend up to the api/docs segment
  const parts = carrierUri.split("/");
  let apiIdx = -1;
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === "api" || parts[i] === "docs" || parts[i] === "library") {
      apiIdx = i;
      break;
    }
  }
  const root =
    apiIdx >= 0
      ? parts.slice(0, apiIdx + 2).join("/") + "/"
      : carrierUri.slice(0, carrierUri.lastIndexOf("/") + 1);
  return [root + raw, ""];
}

function resolveFrom(token: string, carrierUri: string, ahuStack: string[]): [string, string] {
  if (token === "?") {
    const socket = ahuStack.length > 0 ? (ahuStack[ahuStack.length - 1] as string) : carrierUri;
    return [carrierUri, socket];
  }
  if (token.startsWith("#")) return [carrierUri, carrierUri + token];
  if (token.startsWith("lar:///") && token.includes("#")) {
    const idx = token.indexOf("#");
    const uri = token.slice(0, idx);
    return [uri, uri + "#" + token.slice(idx + 1)];
  }
  if (token.startsWith("lar:///")) return [token, token];
  return [carrierUri, carrierUri];
}

// ---------------------------------------------------------------------------
// Minimal TOML field extraction (no full TOML parser — handles key = "value" pairs)
// ---------------------------------------------------------------------------

function fieldsFromToml(tomlText: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const payload: Record<string, unknown> = {};
  const known = new Set([
    "family","lifecycle","role","label","cardinality","polarity",
    "status","confidence","render-mode","traversal","propagation",
    "dir","payload","from","to","when",
  ]);

  // Simple line-by-line extraction for string/number/bool values
  for (const line of tomlText.split("\n")) {
    const m = line.match(/^\s*([\w-]+)\s*=\s*"([^"]*)"\s*$/) ??
              line.match(/^\s*([\w-]+)\s*=\s*(\S+)\s*$/);
    if (!m) continue;
    const [, key, val] = m as [string, string, string];
    const parsed: unknown =
      val === "true" ? true : val === "false" ? false : /^\d+(\.\d+)?$/.test(val) ? Number(val) : val;
    if (known.has(key)) out[key] = parsed;
    else payload[key] = parsed;
  }

  const lifecycle = (out["lifecycle"] as string | undefined) ?? "instance";
  const role = (out["role"] as string | undefined) ?? null;
  const label = (out["label"] as string | undefined) ?? "";
  const cardinality = (out["cardinality"] as string | undefined) ?? null;
  const polarity = (out["polarity"] as string | undefined) ?? null;
  const status = (out["status"] as string | undefined) ?? "declared";
  const confidence = (out["confidence"] as number | undefined) ?? null;
  const renderMode = (out["render-mode"] as string | undefined) ?? null;

  const dirVal = out["dir"] as string | undefined;
  let traversal = (out["traversal"] as string | undefined) ?? "source-to-target";
  if (dirVal === "both") { traversal = "source-to-target"; payload["dir_hint"] = "both"; }
  else if (dirVal === "back") traversal = "target-to-source";
  else if (dirVal === "forward") traversal = "source-to-target";

  const propagation = (out["propagation"] as string | undefined) ?? "none";

  return { lifecycle, role, label, cardinality, polarity, status, confidence, renderMode, traversal, propagation, payload };
}

// ---------------------------------------------------------------------------
// Event-based parser (Phase 1/2 — kept as the stable edge-projection path)
//
// parsePranalaEdges remains the public API for PranaEdge[] production.
// Phase 3 adds parseCarrier() in parser.ts as the new primary path that
// produces MemeAstNode[]; edgesFromAst() then projects PranaEdge[] from it.
// parsePranalaEdges is NOT wired through parser.ts to avoid a circular dep
// (parser.ts imports PranaEdge types from this file).
// ---------------------------------------------------------------------------

type EventKind = "ahu_open" | "ahu_close" | "block" | "inline" | "loulou" | "aka" | "kahea" | "pono" | "lele" | "papalohe";
interface Event { pos: number; kind: EventKind; groups: (string | undefined)[] }

export function parsePranalaEdges(carrierUri: string, text: string, grammar?: GrammarRules): PranaEdge[] {
  const rx = resolveRegexes(grammar);
  const edges: PranaEdge[] = [];

  // Collect block spans first so inline scan can exclude them
  const blockSpans: [number, number][] = [];
  for (const m of text.matchAll(new RegExp(rx.block.source, "gs"))) {
    blockSpans.push([m.index!, m.index! + m[0].length]);
  }
  const inBlock = (pos: number) => blockSpans.some(([s, e]) => pos >= s && pos < e);

  const events: Event[] = [];

  for (const m of text.matchAll(new RegExp(rx.ahuOpen.source, "g"))) {
    events.push({ pos: m.index!, kind: "ahu_open", groups: [...m] });
  }
  for (const m of text.matchAll(new RegExp(rx.ahuClose.source, "g"))) {
    events.push({ pos: m.index!, kind: "ahu_close", groups: [...m] });
  }
  for (const m of text.matchAll(new RegExp(rx.block.source, "gds"))) {
    events.push({ pos: m.index!, kind: "block", groups: [...m] });
  }
  for (const m of text.matchAll(new RegExp(rx.inline.source, "g"))) {
    if (!inBlock(m.index!)) events.push({ pos: m.index!, kind: "inline", groups: [...m] });
  }
  for (const m of text.matchAll(new RegExp(rx.loulou.source, "g"))) {
    if (!inBlock(m.index!)) events.push({ pos: m.index!, kind: "loulou", groups: [...m] });
  }
  for (const m of text.matchAll(new RegExp(rx.aka.source, "g"))) {
    if (!inBlock(m.index!)) events.push({ pos: m.index!, kind: "aka", groups: [...m] });
  }
  for (const m of text.matchAll(new RegExp(rx.kahea.source, "g"))) {
    if (!inBlock(m.index!)) events.push({ pos: m.index!, kind: "kahea", groups: [...m] });
  }
  for (const m of text.matchAll(new RegExp(rx.pono.source, "g"))) {
    if (!inBlock(m.index!)) events.push({ pos: m.index!, kind: "pono", groups: [...m] });
  }
  for (const m of text.matchAll(new RegExp(rx.lele.source, "g"))) {
    if (!inBlock(m.index!)) events.push({ pos: m.index!, kind: "lele", groups: [...m] });
  }
  for (const m of text.matchAll(new RegExp(rx.papalohe.source, "g"))) {
    if (!inBlock(m.index!)) events.push({ pos: m.index!, kind: "papalohe", groups: [...m] });
  }

  events.sort((a, b) => a.pos - b.pos);

  const ahuStack: string[] = [];

  for (const { kind, groups } of events) {
    if (kind === "ahu_open") {
      const frag = (groups[1] ?? "").trim();
      ahuStack.push(carrierUri + frag);
      continue;
    }
    if (kind === "ahu_close") {
      if (ahuStack.length > 0) ahuStack.pop();
      continue;
    }

    if (kind === "block") {
      const fragRaw = (groups[1] ?? "").trim();
      const fromRaw = (groups[2] ?? "").trim();
      const toRaw   = (groups[3] ?? "").trim();
      const body    = groups[4] ?? "";

      const [fromUri, fromSocket] = resolveFrom(fromRaw, carrierUri, ahuStack);
      const fromSlot = fragRaw ? carrierUri + fragRaw : null;
      const [toUri, toSocket] = resolveTo(toRaw, carrierUri);

      let fields: Record<string, unknown> = {};
      const tomlMatch = body.match(TOML_FENCE_RE);
      if (tomlMatch) fields = fieldsFromToml(tomlMatch[1] ?? "");

      // family from TOML body or fallback
      let family = (fields["family"] as string | undefined) ?? "";
      if (!family) {
        const fm = body.match(/\bfamily\s*=\s*"([\w-]+)"/);
        family = fm ? (fm[1] ?? "relation") : "relation";
      }
      delete fields["family"];

      edges.push(makeEdge(fromUri, fromSocket, fromSlot, toUri, toSocket, family, fields));
      continue;
    }

    if (kind === "inline") {
      const fragRaw = (groups[1] ?? "").trim();
      const fromRaw = (groups[2] ?? "").trim();
      const toRaw   = (groups[3] ?? "").trim();
      const family  = (groups[4] ?? "relation").trim();
      const role    = (groups[5] ?? null) as string | null;

      const [fromUri, fromSocket] = resolveFrom(fromRaw, carrierUri, ahuStack);
      const fromSlot = fragRaw ? carrierUri + fragRaw : null;
      const [toUri, toSocket] = resolveTo(toRaw, carrierUri);

      edges.push(makeEdge(fromUri, fromSocket, fromSlot, toUri, toSocket, family, { role }));
      continue;
    }

    // pono: inline-pranala-style with family:constraint default
    // groups: [full, #slot?, FROM, TO, role?]
    if (kind === "pono") {
      const fragRaw = (groups[1] ?? "").trim();
      const fromRaw = (groups[2] ?? "").trim();
      const toRaw   = (groups[3] ?? "").trim();
      const role    = (groups[4] ?? null) as string | null;

      const [fromUri, fromSocket] = resolveFrom(fromRaw, carrierUri, ahuStack);
      const fromSlot = fragRaw ? carrierUri + fragRaw : null;
      const [toUri, toSocket] = resolveTo(toRaw, carrierUri);

      edges.push(makeEdge(fromUri, fromSocket, fromSlot, toUri, toSocket, rx.ponoDefaultFamily, { role }));
      continue;
    }

    // papalohe: reaction family sugar — pāpālohe body-listening reflex (#slot? FROM -> TO [trigger:EVENT])
    // groups: [full, #slot?, FROM, TO, trigger?]
    if (kind === "papalohe") {
      const fragRaw = (groups[1] ?? "").trim();
      const fromRaw = (groups[2] ?? "").trim();
      const toRaw   = (groups[3] ?? "").trim();
      const trigger = (groups[4] ?? null) as string | null;

      const [fromUri, fromSocket] = resolveFrom(fromRaw, carrierUri, ahuStack);
      const fromSlot = fragRaw ? carrierUri + fragRaw : null;
      const [toUri, toSocket] = resolveTo(toRaw, carrierUri);

      const payload: Record<string, unknown> = {};
      if (trigger !== null) payload["trigger"] = trigger;
      edges.push(makeEdge(fromUri, fromSocket, fromSlot, toUri, toSocket, rx.papaloheDefaultFamily, { payload }));
      continue;
    }

    // Sugar forms (single URI capture in groups[1])
    const targetRaw = (groups[1] ?? "").trim();
    let toUri: string, toSocket: string;
    if (targetRaw.startsWith("#")) {
      toUri = carrierUri; toSocket = carrierUri + targetRaw;
    } else if (targetRaw.startsWith("lar:///") && targetRaw.includes("#")) {
      const idx = targetRaw.indexOf("#");
      toUri = targetRaw.slice(0, idx);
      toSocket = toUri + "#" + targetRaw.slice(idx + 1);
    } else {
      toUri = targetRaw; toSocket = "";
    }
    const fromSocket = ahuStack.length > 0 ? (ahuStack[ahuStack.length - 1] as string) : carrierUri;

    if (kind === "loulou") {
      edges.push(makeEdge(carrierUri, fromSocket, null, toUri, toSocket, rx.loulouDefaultFamily, {}));
    } else if (kind === "aka") {
      edges.push(makeEdge(carrierUri, fromSocket, null, toUri, toSocket, rx.akaDefaultFamily, {}));
    } else if (kind === "kahea") {
      edges.push(makeEdge(carrierUri, fromSocket, null, toUri, toSocket, rx.kaheaDefaultFamily, { propagation: rx.kaheaDefaultPropagation }));
    } else if (kind === "lele") {
      // fire-and-forget: sugar form, single URI target, family:message
      edges.push(makeEdge(carrierUri, fromSocket, null, toUri, toSocket, rx.leleDefaultFamily, {}));
    }
  }

  return edges;
}

function makeEdge(
  fromUri: string,
  fromSocket: string,
  fromSlot: string | null,
  toUri: string,
  toSocket: string,
  family: string,
  fields: Record<string, unknown>,
): PranaEdge {
  return {
    fromUri,
    fromSocket,
    fromSlot,
    toUri,
    toSocket,
    family,
    lifecycle: (fields["lifecycle"] as string | undefined) ?? "instance",
    role: (fields["role"] as string | null | undefined) ?? null,
    traversal: (fields["traversal"] as string | undefined) ?? "source-to-target",
    propagation: (fields["propagation"] as string | undefined) ?? "none",
    label: (fields["label"] as string | undefined) ?? "",
    payload: (fields["payload"] as Record<string, unknown> | undefined) ?? {},
    cardinality: (fields["cardinality"] as string | null | undefined) ?? null,
    polarity: (fields["polarity"] as string | null | undefined) ?? null,
    status: (fields["status"] as string | undefined) ?? "declared",
    confidence: (fields["confidence"] as number | null | undefined) ?? null,
    renderMode: (fields["renderMode"] as string | null | undefined) ?? null,
  };
}
