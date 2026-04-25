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
  readonly fromSocket: string;
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
// Regexes (JS doesn't have re.DOTALL flag on character class, use [\s\S] for body)
// ---------------------------------------------------------------------------

const AHU_OPEN_RE = /<<~[^>]*\bahu\s+(#[\w-]+)\s*>>/g;
const AHU_CLOSE_RE = /<<\/ahu\s*>>/g;

// Block pranala — note JS regex doesn't have dotall by default; use [\s\S]*? with 's' flag
const BLOCK_RE = /<<~\s*pranala\s+(#[\w-]+\s+)?(\S+)\s*->\s*(\S+)\s*>>([\s\S]*?)<<~\/pranala\s*>>/gs;
const INLINE_RE = /<<~\s*pranala\s+(#[\w-]+\s+)?(\S+)\s*->\s*(\S+)(?:\s+family:([\w-]+))?(?:\s+role:([\w-]+))?\s*>>/g;
const LOULOU_RE = /<<~\s*loulou\s+(\S+)\s*>>/g;
const AKA_RE    = /<<~\s*aka\s+(\S+)\s*>>/g;
const KAHEA_RE  = /<<~\s*kahea\s+(\S+)\s*>>/g;
const TOML_FENCE_RE = /```toml\s*([\s\S]*?)```/;

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
// Event-based parser
// ---------------------------------------------------------------------------

type EventKind = "ahu_open" | "ahu_close" | "block" | "inline" | "loulou" | "aka" | "kahea";
interface Event { pos: number; kind: EventKind; groups: (string | undefined)[] }

export function parsePranalaEdges(carrierUri: string, text: string): PranaEdge[] {
  const edges: PranaEdge[] = [];

  // Collect block spans first so inline scan can exclude them
  const blockSpans: [number, number][] = [];
  for (const m of text.matchAll(BLOCK_RE)) {
    blockSpans.push([m.index!, m.index! + m[0].length]);
  }
  const inBlock = (pos: number) => blockSpans.some(([s, e]) => pos >= s && pos < e);

  const events: Event[] = [];

  for (const m of text.matchAll(new RegExp(AHU_OPEN_RE.source, "g"))) {
    events.push({ pos: m.index!, kind: "ahu_open", groups: [...m] });
  }
  for (const m of text.matchAll(new RegExp(AHU_CLOSE_RE.source, "g"))) {
    events.push({ pos: m.index!, kind: "ahu_close", groups: [...m] });
  }
  for (const m of text.matchAll(new RegExp(BLOCK_RE.source, "gds"))) {
    events.push({ pos: m.index!, kind: "block", groups: [...m] });
  }
  for (const m of text.matchAll(new RegExp(INLINE_RE.source, "g"))) {
    if (!inBlock(m.index!)) events.push({ pos: m.index!, kind: "inline", groups: [...m] });
  }
  for (const m of text.matchAll(new RegExp(LOULOU_RE.source, "g"))) {
    if (!inBlock(m.index!)) events.push({ pos: m.index!, kind: "loulou", groups: [...m] });
  }
  for (const m of text.matchAll(new RegExp(AKA_RE.source, "g"))) {
    if (!inBlock(m.index!)) events.push({ pos: m.index!, kind: "aka", groups: [...m] });
  }
  for (const m of text.matchAll(new RegExp(KAHEA_RE.source, "g"))) {
    if (!inBlock(m.index!)) events.push({ pos: m.index!, kind: "kahea", groups: [...m] });
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

      let [fromUri, fromSocket] = resolveFrom(fromRaw, carrierUri, ahuStack);
      if (fragRaw) fromSocket = carrierUri + fragRaw;
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

      edges.push(makeEdge(fromUri, fromSocket, toUri, toSocket, family, fields));
      continue;
    }

    if (kind === "inline") {
      const fragRaw = (groups[1] ?? "").trim();
      const fromRaw = (groups[2] ?? "").trim();
      const toRaw   = (groups[3] ?? "").trim();
      const family  = (groups[4] ?? "relation").trim();
      const role    = (groups[5] ?? null) as string | null;

      let [fromUri, fromSocket] = resolveFrom(fromRaw, carrierUri, ahuStack);
      if (fragRaw) fromSocket = carrierUri + fragRaw;
      const [toUri, toSocket] = resolveTo(toRaw, carrierUri);

      edges.push(makeEdge(fromUri, fromSocket, toUri, toSocket, family, { role }));
      continue;
    }

    // Sugar forms
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
      edges.push(makeEdge(carrierUri, fromSocket, toUri, toSocket, "relation", {}));
    } else if (kind === "aka") {
      edges.push(makeEdge(carrierUri, fromSocket, toUri, toSocket, "observe", {}));
    } else if (kind === "kahea") {
      edges.push(makeEdge(carrierUri, fromSocket, toUri, toSocket, "dataflow", { propagation: "push-forward" }));
    }
  }

  return edges;
}

function makeEdge(
  fromUri: string,
  fromSocket: string,
  toUri: string,
  toSocket: string,
  family: string,
  fields: Record<string, unknown>,
): PranaEdge {
  return {
    fromUri,
    fromSocket,
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
