/**
 * Carrier ingress for the Lararium carrier spine.
 *
 * Core is isomorphic — no fs/path imports. Text is passed in by the host.
 */

import { type Diagnostic, makeDiagnostic } from "./diagnostics.js";
import { parsePranalaEdges, type PranaEdge } from "./pranala-parser.js";

// ---------------------------------------------------------------------------
// Regex patterns
// ---------------------------------------------------------------------------

const DOCTYPE_RE   = /<!--\s*<<~\s*!DOCTYPE\s*=\s*lar:\/\/\/[^>]+>>\s*-->/;
const OPENER_RE    = /<<~(?:&#x[0-9a-fA-F]+;\s*)?\?\s*->\s*(lar:\/\/\/[^\s>]+)\s*>>/;
const IAM_BLOCK_RE = /<<~\s*ahu\s+#iam\s*>>([\s\S]*?)<<~\/ahu\s*>>/;
const TOML_FENCE_RE = /```toml\s*([\s\S]*?)```/;
const BODY_OPEN_RE  = /<<~(?:&#x[0-9a-fA-F]+;\s*)?ahu\s+#(?:meme-)?body-open\s*>>/;
const BODY_CLOSE_RE = /<<~(?:&#x[0-9a-fA-F]+;\s*)?ahu\s+#body-close\s*>>/;
const RETURN_THROAT_RE = /<<~(?:&#x[0-9a-fA-F]+;\s*)?->\s*\?\s*>>/;
const OODA_GLYPHS = ["✶", "⏿", "◇", "▶", "⤴", "↺"] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CarrierRating = "typed meme" | "meme" | "data" | "noise";
export type DepthState = "resolved" | "absent";

export interface CarrierShape {
  readonly valid: boolean;
  readonly rating: CarrierRating;
  readonly depthState: DepthState;
  readonly diagnostics: readonly Diagnostic[];
}

export interface CarrierRecord {
  readonly uri: string;
  readonly metadata: Record<string, unknown>;
  readonly implements: readonly string[];
  readonly shape: CarrierShape;
}

// ---------------------------------------------------------------------------
// Minimal TOML key=value extractor (handles string, number, bool; no arrays/tables)
// ---------------------------------------------------------------------------

export function extractTomlFields(tomlText: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const line of tomlText.split("\n")) {
    const m =
      line.match(/^\s*([\w-]+)\s*=\s*"([^"]*)"\s*$/) ??
      line.match(/^\s*([\w-]+)\s*=\s*(\S+)\s*$/);
    if (!m) continue;
    const [, key, val] = m as [string, string, string];
    const parsed: unknown =
      val === "true" ? true
      : val === "false" ? false
      : /^\d+(\.\d+)?$/.test(val) ? Number(val)
      : val;
    out[key] = parsed;
  }
  return out;
}

// ---------------------------------------------------------------------------
// IAM metadata extraction
// ---------------------------------------------------------------------------

export function extractIamMetadata(text: string): { metadata: Record<string, unknown>; diagnostics: Diagnostic[] } {
  const iamMatch = IAM_BLOCK_RE.exec(text);
  if (!iamMatch) {
    return { metadata: {}, diagnostics: [makeDiagnostic("carrier.iam.missing", "carrier lacks `ahu #iam` metadata block")] };
  }
  const fenceMatch = TOML_FENCE_RE.exec(iamMatch[1] ?? "");
  if (!fenceMatch) {
    return { metadata: {}, diagnostics: [makeDiagnostic("carrier.iam.toml_missing", "`ahu #iam` lacks a TOML fence")] };
  }
  const metadata = extractTomlFields(fenceMatch[1] ?? "");
  return { metadata, diagnostics: [] };
}

// ---------------------------------------------------------------------------
// Interface bundle
// ---------------------------------------------------------------------------

export function extractInterfaceBundle(metadata: Record<string, unknown>): string[] {
  const impl = metadata["implements"];
  if (typeof impl === "string") return [impl];
  if (Array.isArray(impl)) return impl.filter((x): x is string => typeof x === "string");
  return [];
}

// ---------------------------------------------------------------------------
// Shape validation
// ---------------------------------------------------------------------------

export function validateCarrierShape(
  text: string,
  metadata: Record<string, unknown>,
  uri: string,
  edges: PranaEdge[],
): CarrierShape {
  const diagnostics: Diagnostic[] = [];

  if (!DOCTYPE_RE.test(text)) {
    diagnostics.push(makeDiagnostic("carrier.doctype.missing", "memetic-wikitext doctype comment missing"));
  }

  const openerMatch = OPENER_RE.exec(text);
  if (!openerMatch) {
    diagnostics.push(makeDiagnostic("carrier.opener.missing", "document opener with declared `lar:` address missing"));
  } else {
    const uriPath = metadata["uri-path"] as string | undefined;
    if (uriPath) {
      const expectedUri = uriPath.startsWith("lar:///") ? uriPath : `lar:///${uriPath}`;
      const openerUri = openerMatch[1];
      if (openerUri !== expectedUri) {
        diagnostics.push(makeDiagnostic(
          "carrier.opener.metadata_mismatch",
          `opener URI "${openerUri}" does not match metadata uri-path "${expectedUri}"`,
          "warning",
        ));
      }
    }
  }

  if (Object.keys(metadata).length === 0) {
    diagnostics.push(makeDiagnostic("carrier.iam.empty", "metadata could not be extracted"));
  } else {
    for (const field of ["uri-path", "file-path", "content-type", "role"] as const) {
      if (!(field in metadata)) {
        diagnostics.push(makeDiagnostic("carrier.iam.field_missing", `metadata lacks \`${field}\``));
      }
    }
  }

  if (!BODY_OPEN_RE.test(text)) {
    diagnostics.push(makeDiagnostic("carrier.body_open.missing", "body-open threshold missing"));
  }
  if (!BODY_CLOSE_RE.test(text)) {
    diagnostics.push(makeDiagnostic("carrier.body_close.missing", "body-close threshold missing"));
  }
  if (!RETURN_THROAT_RE.test(text)) {
    diagnostics.push(makeDiagnostic("carrier.return_throat.missing", "honest return throat `-> ?` missing"));
  }

  const missingGlyphs = OODA_GLYPHS.filter((g) => !text.includes(g));
  if (missingGlyphs.length > 0) {
    diagnostics.push(makeDiagnostic(
      "carrier.ooda_ha.incomplete",
      "six-line OODA-HA phase map lacks glyphs: " + missingGlyphs.join(" "),
      "warning",
    ));
  }

  const loulou_count = (text.match(/<<~ loulou lar:\/\/\//g) ?? []).length;

  const valid = diagnostics.filter((d) => d.severity === "error").length === 0;
  const implSet = new Set(extractInterfaceBundle(metadata));
  for (const edge of edges) {
    if (edge.family === "control" && edge.role === "implements") implSet.add(edge.toUri);
  }

  let rating: CarrierRating;
  if (valid && implSet.size > 0) rating = "typed meme";
  else if (valid) rating = "meme";
  else if (Object.keys(metadata).length > 0 || openerMatch) rating = "data";
  else rating = "noise";

  const depthState: DepthState = loulou_count > 0 ? "resolved" : "absent";

  return { valid, rating, depthState, diagnostics };
}

// ---------------------------------------------------------------------------
// parseCarrier — pure text-in, record-out
// ---------------------------------------------------------------------------

export function parseCarrier(uri: string, text: string): CarrierRecord {
  const { metadata, diagnostics: metaDiags } = extractIamMetadata(text);
  const edges = parsePranalaEdges(uri, text);
  let shape = validateCarrierShape(text, metadata, uri, edges);

  if (metaDiags.length > 0) {
    shape = {
      valid: false,
      rating: text.trim() ? "data" : "noise",
      depthState: shape.depthState,
      diagnostics: [...metaDiags, ...shape.diagnostics],
    };
  }

  const implSet = new Set(extractInterfaceBundle(metadata));
  for (const edge of edges) {
    if (edge.family === "control" && edge.role === "implements") implSet.add(edge.toUri);
  }

  return { uri, metadata, implements: [...implSet].sort(), shape };
}
