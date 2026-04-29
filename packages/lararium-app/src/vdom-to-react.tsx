/**
 * vdom-to-react — VDomNode[] → React.ReactNode adapter.
 *
 * Converts the virtual DOM produced by LarariumTW5.renderCarrierVDom()
 * (TW5 fake DOM output) into styled React elements for MemeDetailPanel.
 *
 * Node classification is driven by data-lar-kind attributes emitted by
 * the lararium-* TW5 widget classes:
 *   worksite  → <span data-lar-kind="worksite" data-lar-slot="#x" data-lar-uri="lar:///...">
 *   edge      → <meta data-lar-kind="edge" data-lar-from data-lar-to data-lar-family data-lar-role>
 *   papalohe  → <meta data-lar-kind="papalohe" data-lar-from data-lar-to data-lar-trigger data-lar-fn>
 *   kukali    → <span data-lar-kind="kukali" data-lar-trigger?>
 *   kumu      → <div  data-lar-kind="kumu" data-lar-name data-lar-props data-lar-resolved>
 *   toml      → <script type="application/toml" data-lar-kind="toml">
 *   sigil     → <span data-lar-kind="sigil" data-lar-sigil="...">
 *   dynamic   → <span data-lar-kind="dynamic" data-lar-sigil="...">
 *   header    → <meta data-lar-kind="header">   (suppressed)
 *   dispatch  → <meta data-lar-kind="dispatch"> (suppressed)
 *
 * Text nodes render as prose paragraphs.
 * Unknown elements recurse into children (transparent passthrough).
 */

import React from "react";
import type { VDomNode } from "@lararium/tw5";

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function renderVDom(nodes: readonly VDomNode[]): React.ReactNode {
  return (
    <div style={css.carrier}>
      {nodes.map((n, i) => renderNode(n, String(i)))}
    </div>
  );
}

/** Collect all dispatch nodes from a vdom tree for imperative firing via useEffect. */
export function collectDispatchNodes(
  nodes: readonly VDomNode[],
): Array<{ target: string; trigger: string }> {
  const result: Array<{ target: string; trigger: string }> = [];
  function walk(node: VDomNode) {
    if (node.type === "element" && node.attrs?.["data-lar-kind"] === "dispatch") {
      const target  = node.attrs["data-lar-target"]  ?? "";
      const trigger = node.attrs["data-lar-trigger"] ?? "";
      if (target && trigger) result.push({ target, trigger });
    }
    if (node.type === "element") node.children.forEach(walk);
  }
  nodes.forEach(walk);
  return result;
}

// ---------------------------------------------------------------------------
// Node dispatch
// ---------------------------------------------------------------------------

function renderNode(node: VDomNode, key: string): React.ReactNode {
  if (node.type === "text") {
    const text = node.text?.trim() ?? "";
    if (!text) return null;
    // Multi-line prose: split on double-newlines into paragraphs
    const paras = text.split(/\n{2,}/);
    return paras.map((p, i) => {
      const t = p.trim();
      if (!t) return null;
      // Treat lines starting with # as headings
      if (t.startsWith("### ")) return <h3 key={`${key}.h${i}`} style={css.h3}>{t.slice(4)}</h3>;
      if (t.startsWith("## "))  return <h2 key={`${key}.h${i}`} style={css.h2}>{t.slice(3)}</h2>;
      if (t.startsWith("# "))   return <h1 key={`${key}.h${i}`} style={css.h1}>{t.slice(2)}</h1>;
      return <p key={`${key}.p${i}`} style={css.text}>{renderInline(t)}</p>;
    });
  }

  if (node.type !== "element") return null;

  const kind = node.attrs?.["data-lar-kind"];

  switch (kind) {
    case "worksite":  return renderWorksite(node, key);
    case "edge":      return renderEdge(node, key);
    case "papalohe":  return renderPapalohe(node, key);
    case "kukali":    return renderKukali(node, key);
    case "kumu":      return renderKumu(node, key);
    case "toml":      return renderToml(node, key);
    case "sigil":     return renderSigil(node, key);
    case "dynamic":   return renderChildren(node.children, key);
    case "header":    return null;  // metadata only
    case "dispatch":  return null;  // fired via collectDispatchNodes, not rendered
    default:          return renderChildren(node.children, key);
  }
}

// ---------------------------------------------------------------------------
// Worksite — ahu socket section with left-rail connector
// ---------------------------------------------------------------------------

const SUPPRESSED_SLOTS = new Set(["meme-body-open", "body-close"]);
const SILENT_HEADER_SLOTS = new Set(["iam", "meme-body-open", "body-close", "edges"]);

function renderWorksite(node: VDomNode, key: string): React.ReactNode {
  const slot = node.attrs?.["data-lar-slot"] ?? "";
  const slug = slot.replace(/^#/, "");

  if (SUPPRESSED_SLOTS.has(slug)) return null;

  const showHeader = !SILENT_HEADER_SLOTS.has(slug);
  const children = node.children.map((c, i) => renderNode(c, `${key}.${i}`));
  const hasContent = node.children.length > 0;

  return (
    <section key={key} style={css.worksite} data-slot={slot}>
      <div style={css.rail} aria-hidden="true" />
      <div style={css.worksiteBody}>
        {showHeader && (
          <div style={css.slotHeader}>
            <span style={css.slotDot} />
            <span style={css.slotSlug}>{slug}</span>
          </div>
        )}
        {hasContent ? children : <span style={css.emptySlot}>—</span>}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Edge — pranala family pill
// ---------------------------------------------------------------------------

function renderEdge(node: VDomNode, key: string): React.ReactNode {
  const family = node.attrs?.["data-lar-family"] ?? "relation";
  const role   = node.attrs?.["data-lar-role"]   ?? "";
  const to     = node.attrs?.["data-lar-to"]     ?? "";
  const sigil  = node.attrs?.["data-lar-sigil"];  // present for edge-sugar

  const toShort = to
    .replace("lar:///", "")
    .replace(/^ha\.ka\.ba\/api\/v0\.1\//, "");

  return (
    <div key={key} style={css.edge}>
      {sigil && <span style={css.edgeSigil}>{sigil}</span>}
      <span style={{ ...css.familyBadge, ...familyColor(family) }}>{family}</span>
      {role && <span style={css.edgeRole}>{role}</span>}
      {toShort && <span style={css.edgeTo} title={to}>{toShort}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Papalohe — reaction wire (DeviceA.trigger → DeviceB.fn)
// ---------------------------------------------------------------------------

function renderPapalohe(node: VDomNode, key: string): React.ReactNode {
  const from    = node.attrs?.["data-lar-from"]    ?? "";
  const to      = node.attrs?.["data-lar-to"]      ?? "";
  const trigger = node.attrs?.["data-lar-trigger"]  ?? "";
  const fn      = node.attrs?.["data-lar-fn"]       ?? "";

  const shorten = (u: string) => u.replace("lar:///", "").replace(/^ha\.ka\.ba\/api\/v0\.1\//, "");

  return (
    <div key={key} style={css.papalohe}>
      <span style={css.papaloheLabel}>papalohe</span>
      <span style={css.papaloheFrom} title={from}>{shorten(from) || "self"}</span>
      {trigger && <span style={css.papaloheEvent}>.{trigger}</span>}
      <span style={css.papaloheArrow}>→</span>
      <span style={css.papaloheFrom} title={to}>{shorten(to)}</span>
      {fn && <span style={css.papaloheEvent}>.{fn}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Kukali — reactive wait posture (Verse `suspends` analogue)
// ---------------------------------------------------------------------------

function renderKukali(node: VDomNode, key: string): React.ReactNode {
  const trigger = node.attrs?.["data-lar-trigger"] ?? "";
  return (
    <div key={key} style={css.kukali}>
      <span style={css.kukaliLabel}>⏿ kukali</span>
      {trigger && <span style={css.kukaliTrigger}> trigger:{trigger}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Kumu — device instance (name + resolved props + body slot)
// ---------------------------------------------------------------------------

function renderKumu(node: VDomNode, key: string): React.ReactNode {
  const name     = node.attrs?.["data-lar-name"]     ?? "?";
  const props    = node.attrs?.["data-lar-props"]     ?? "";
  const resolved = node.attrs?.["data-lar-resolved"]  !== "false";
  const children = node.children.map((c, i) => renderNode(c, `${key}.${i}`));

  return (
    <div key={key} style={{ ...css.kumu, ...(resolved ? {} : css.kumuHole) }}>
      <div style={css.kumuHeader}>
        <span style={css.kumuName}>{name}</span>
        {props && <span style={css.kumuProps}>({props})</span>}
        {!resolved && <span style={css.kumuHoleLabel}>? hole</span>}
      </div>
      {children.length > 0 && <div style={css.kumuBody}>{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toml — data block (iam identity + general toml blocks)
// ---------------------------------------------------------------------------

function renderToml(node: VDomNode, key: string): React.ReactNode {
  // Content is in textContent of the script element — first text child
  const content = node.children
    .filter(c => c.type === "text")
    .map(c => c.text ?? "")
    .join("")
    .trim();

  if (!content) return null;
  return (
    <pre key={key} style={css.toml}>
      <code>{content}</code>
    </pre>
  );
}

// ---------------------------------------------------------------------------
// Sigil — generic canonical sigil (kukali, kumu, wai, etc.)
// ---------------------------------------------------------------------------

function renderSigil(node: VDomNode, key: string): React.ReactNode {
  const name = node.attrs?.["data-lar-sigil"] ?? "sigil";
  const children = node.children.map((c, i) => renderNode(c, `${key}.${i}`));
  const hasChildren = node.children.length > 0;

  // Other sigils: transparent container if they have children
  if (hasChildren) return <div key={key}>{children}</div>;
  return null;
}

// ---------------------------------------------------------------------------
// Children passthrough
// ---------------------------------------------------------------------------

function renderChildren(children: readonly VDomNode[], key: string): React.ReactNode {
  return children.map((c, i) => renderNode(c, `${key}.${i}`));
}

// ---------------------------------------------------------------------------
// Inline text rendering — bold/italic/code via simple markdown-like pass
// ---------------------------------------------------------------------------

function renderInline(text: string): React.ReactNode {
  // Single-pass: split on code spans first, then bold, then italic
  const parts: React.ReactNode[] = [];
  let rest = text;
  let idx = 0;
  const codeRe = /`([^`]+)`/g;
  let m: RegExpExecArray | null;
  let last = 0;
  while ((m = codeRe.exec(rest)) !== null) {
    if (m.index > last) parts.push(rest.slice(last, m.index));
    parts.push(<code key={idx++} style={css.inlineCode}>{m[1]}</code>);
    last = m.index + m[0].length;
  }
  parts.push(rest.slice(last));
  return parts.length === 1 ? parts[0] : parts;
}

// ---------------------------------------------------------------------------
// Family color map
// ---------------------------------------------------------------------------

const FAMILY_COLORS: Record<string, { bg: string; fg: string }> = {
  control:    { bg: "#1f4b8e", fg: "#a8c8ff" },
  relation:   { bg: "#1a4731", fg: "#7ee787" },
  observe:    { bg: "#5c3a00", fg: "#f0a04b" },
  dataflow:   { bg: "#3d1f6b", fg: "#d2a8ff" },
  message:    { bg: "#5c4400", fg: "#e3b341" },
  constraint: { bg: "#5c1a1a", fg: "#ff8888" },
  reaction:   { bg: "#1a3d20", fg: "#56d364" },
  spatial:    { bg: "#1a3d5c", fg: "#79c0ff" },
};

function familyColor(family: string): React.CSSProperties {
  const c = FAMILY_COLORS[family] ?? { bg: "#21262d", fg: "#8b949e" };
  return { background: c.bg, color: c.fg };
}

// ---------------------------------------------------------------------------
// Styles — same visual language as native-render.tsx
// ---------------------------------------------------------------------------

const css = {
  carrier: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 0,
  },
  worksite: {
    display: "flex",
    flexDirection: "row" as const,
    gap: 12,
    marginBottom: 2,
    position: "relative" as const,
  },
  rail: {
    width: 2,
    background: "#21262d",
    borderRadius: 1,
    flexShrink: 0,
    minHeight: 24,
    alignSelf: "stretch" as const,
  },
  worksiteBody: {
    flex: 1,
    paddingBottom: 12,
    minWidth: 0,
  },
  slotHeader: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
    marginTop: 2,
  },
  slotDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#30363d",
    border: "1.5px solid #484f58",
    flexShrink: 0,
  },
  slotSlug: {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    color: "#484f58",
    fontFamily: "monospace",
  },
  emptySlot: { color: "#21262d", fontSize: 11 },
  h1: { margin: "8px 0 4px", fontSize: 15, fontWeight: 700, color: "#e6edf3" },
  h2: { margin: "6px 0 4px", fontSize: 13, fontWeight: 700, color: "#c9d1d9" },
  h3: { margin: "4px 0 4px", fontSize: 12, fontWeight: 600, color: "#8b949e" },
  text: { margin: "0 0 6px", color: "#c9d1d9", lineHeight: 1.6 },
  inlineCode: {
    fontFamily: "monospace",
    fontSize: "0.9em",
    background: "#161b22",
    padding: "1px 4px",
    borderRadius: 3,
    color: "#79c0ff",
  },
  toml: {
    margin: "0 0 8px",
    padding: "8px 10px",
    background: "#0d1117",
    border: "1px solid #21262d",
    borderRadius: 4,
    fontSize: 11,
    color: "#7ee787",
    overflowX: "auto" as const,
    fontFamily: "monospace",
    whiteSpace: "pre" as const,
  },
  edge: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginBottom: 3,
    fontSize: 11,
    fontFamily: "monospace",
  },
  edgeSigil: { color: "#484f58", fontSize: 10 },
  familyBadge: {
    padding: "1px 5px",
    borderRadius: 3,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.04em",
    flexShrink: 0,
  },
  edgeRole: { color: "#6e7681", flexShrink: 0 },
  edgeTo: {
    color: "#58a6ff",
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  // papalohe
  papalohe: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    margin: "3px 0",
    fontSize: 11,
    fontFamily: "monospace",
    padding: "3px 6px",
    background: "#0d1a10",
    borderLeft: "2px solid #56d364",
    borderRadius: "0 3px 3px 0",
  },
  papaloheLabel: { color: "#484f58", fontSize: 10, flexShrink: 0 },
  papaloheFrom:  { color: "#79c0ff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const },
  papaloheEvent: { color: "#56d364", flexShrink: 0 },
  papaloheArrow: { color: "#484f58", flexShrink: 0 },
  // kukali
  kukali: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    margin: "4px 0",
    padding: "4px 8px",
    borderLeft: "2px solid #f0a04b",
    background: "#1a1200",
    borderRadius: "0 3px 3px 0",
  },
  kukaliLabel:   { fontSize: 11, fontFamily: "monospace", color: "#f0a04b" },
  kukaliTrigger: { fontSize: 11, fontFamily: "monospace", color: "#8b949e" },
  // kumu
  kumu: {
    margin: "4px 0",
    padding: "6px 10px",
    background: "#0d1117",
    border: "1px solid #30363d",
    borderRadius: 4,
  },
  kumuHole: {
    border: "1px dashed #484f58",
    background: "#0a0d10",
  },
  kumuHeader: { display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 },
  kumuName:   { fontSize: 12, fontWeight: 700, fontFamily: "monospace", color: "#d2a8ff" },
  kumuProps:  { fontSize: 11, fontFamily: "monospace", color: "#8b949e" },
  kumuHoleLabel: { fontSize: 10, color: "#484f58", marginLeft: "auto" as const },
  kumuBody:   { paddingLeft: 8, borderLeft: "1px solid #21262d" },
} as const;
