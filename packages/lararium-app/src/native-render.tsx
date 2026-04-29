/**
 * React render adapter — third layer of the three-tree pipeline.
 *
 *   carrier text → MemeAstNode[] → WidgetNode[] → React.ReactNode (here)
 *
 * Each ahu WorksiteNode renders as a visually connected skeleton section:
 * slot-name header + left-rail connector + body content. Suppressed structural
 * slots (iam, meme-body-open, body-close, edges) render without headers but
 * still emit body content so pranala edges and toml blocks remain visible.
 *
 * Pranala EdgeNodes render as colored family-badge pills with role + target.
 * Kahea/kumu/wehe SigilNodes delegate to the widgetMap for kumu execution output.
 * Typed holes (no registry match) render as Hazel-style dashed placeholders.
 */

import type {
  MemeAstNode,
  WorksiteNode,
  EdgeNode,
  TextNode,
  SigilNode,
  WidgetNode,
  KumuResult,
} from "@lararium/core";
import type { WidgetSlot } from "@lararium/tldraw";

// ---------------------------------------------------------------------------
// Top-level entry point
// ---------------------------------------------------------------------------

export function renderCarrier(
  ast: MemeAstNode[],
  widgetMap: Map<number, WidgetSlot>,
): React.ReactNode {
  return (
    <div style={css.carrier}>
      {ast.map((node, i) => renderNode(node, String(i), widgetMap))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slot classification
// ---------------------------------------------------------------------------

// Structural slots that carry content but suppress their slug header.
const SILENT_HEADER_SLOTS = new Set([
  "iam", "meme-body-open", "body-close", "edges",
]);

// Slots suppressed entirely (no visual output).
const SUPPRESSED_SLOTS = new Set([
  "meme-body-open", "body-close",
]);

// ---------------------------------------------------------------------------
// AST node dispatch
// ---------------------------------------------------------------------------

function renderNode(
  node: MemeAstNode,
  key: string,
  widgetMap: Map<number, WidgetSlot>,
): React.ReactNode {
  switch (node.kind) {
    case "CarrierHeader":
      return null;

    case "Worksite": {
      const ws = node as WorksiteNode;
      const slug = ws.slot.replace(/^#/, "");

      if (SUPPRESSED_SLOTS.has(slug)) return null;

      const showHeader = !SILENT_HEADER_SLOTS.has(slug);
      const children = ws.body.map((child, i) =>
        renderNode(child, `${key}.${i}`, widgetMap),
      );
      const hasContent = ws.body.length > 0;

      return (
        <section key={key} style={css.worksite} data-slot={ws.slot}>
          {/* Skeleton connector rail — always present, creates vertical rhythm */}
          <div style={css.rail} aria-hidden="true" />
          <div style={css.worksiteBody}>
            {showHeader && (
              <div style={css.slotHeader}>
                <span style={css.slotDot} />
                <span style={css.slotSlug}>{slug}</span>
              </div>
            )}
            {hasContent ? children : (
              <span style={css.emptySlot}>—</span>
            )}
          </div>
        </section>
      );
    }

    case "Text": {
      const text = (node as TextNode).content.trim();
      if (!text) return null;
      return <p key={key} style={css.text}>{text}</p>;
    }

    case "Edge": {
      const e = node as EdgeNode;
      const toShort = e.toRaw.replace("lar:///", "").replace(/^ha\.ka\.ba\/api\/v0\.1\//, "");
      return (
        <div key={key} style={css.edge}>
          <span style={{ ...css.familyBadge, ...familyColor(e.family) }}>{e.family}</span>
          {e.role && <span style={css.edgeRole}>{e.role}</span>}
          <span style={css.edgeTo} title={e.toRaw}>{toShort}</span>
        </div>
      );
    }

    case "Sigil": {
      const s = node as SigilNode;

      if (s.sigilName === "toml" || s.sigilName === "iam") {
        const content = (s.attrs["content"] ?? "").trim();
        if (!content) return null;
        return <pre key={key} style={css.toml}><code>{content}</code></pre>;
      }

      if (s.sigilName === "kahea" || s.sigilName === "kumu" || s.sigilName === "wehe") {
        const slot = widgetMap.get(s.pos);
        if (slot) {
          return slot.result
            ? renderKumuResult(slot.result, slot.widget, key, widgetMap)
            : renderWidgetSkeleton(slot.widget, key);
        }
        return (
          <div key={key} style={{ ...css.widget, ...css.widgetHole }}>
            <span style={css.widgetName}>
              {s.attrs["name"] ? `? ${s.attrs["name"]}` : s.sigilName}
            </span>
          </div>
        );
      }

      if (s.body.length > 0) {
        return (
          <div key={key}>
            {s.body.map((c, i) => renderNode(c, `${key}.${i}`, widgetMap))}
          </div>
        );
      }
      return null;
    }

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Widget rendering — executed result, suspended kukali, typed hole, skeleton
// ---------------------------------------------------------------------------

function renderKumuResult(
  result: KumuResult,
  widget: WidgetNode,
  key: string,
  widgetMap: Map<number, WidgetSlot>,
): React.ReactNode {
  if (result.ok) {
    return (
      <div key={key} style={css.widget}>
        <div style={css.widgetHeader}>
          <span style={css.widgetName}>{widget.kumuName}</span>
          {Object.entries(widget.resolvedProps).map(([k, v]) => (
            <span key={k} style={css.widgetProp}>{k}=<em>{v}</em></span>
          ))}
        </div>
        {result.nodes.length > 0 && (
          <div style={css.widgetContent}>
            {result.nodes.map((node, i) => renderNode(node, `${key}.node.${i}`, widgetMap))}
          </div>
        )}
      </div>
    );
  }

  if (result.error === "suspended") {
    return (
      <div key={key} style={{ ...css.widget, ...css.widgetSuspended }}>
        <span style={css.widgetName}>{widget.kumuName}</span>
        <span style={css.suspendedLabel}>
          ⏿ kukali{result.detail ? `: ${result.detail}` : ""}
        </span>
      </div>
    );
  }

  return (
    <div key={key} style={{ ...css.widget, ...css.widgetHole }}>
      <span style={css.widgetName}>
        {result.error === "unresolved-hole" ? `? ${widget.kumuName}` : widget.kumuName}
      </span>
      {result.detail && <span style={css.widgetProp}>{result.error}: {result.detail}</span>}
    </div>
  );
}

function renderWidgetSkeleton(node: WidgetNode, key: string): React.ReactNode {
  return (
    <div key={key} style={{ ...css.widget, opacity: node.def ? 0.6 : 1, ...(node.def ? {} : css.widgetHole) }}>
      <div style={css.widgetHeader}>
        <span style={css.widgetName}>{node.def ? node.kumuName : `? ${node.kumuName}`}</span>
        {Object.entries(node.resolvedProps).map(([k, v]) => (
          <span key={k} style={css.widgetProp}>{k}=<em>{v}</em></span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Family color map — all eight pranala families
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
// Styles
// ---------------------------------------------------------------------------

const css = {
  carrier: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 0,
  },
  // Ahu worksite — skeleton section with left rail connector
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
  emptySlot: {
    color: "#21262d",
    fontSize: 11,
  },
  // Text content
  text: {
    margin: "0 0 6px",
    color: "#c9d1d9",
  },
  // Toml / iam data blocks
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
  // Pranala edge pill
  edge: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginBottom: 3,
    fontSize: 11,
    fontFamily: "monospace",
  },
  familyBadge: {
    padding: "1px 5px",
    borderRadius: 3,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.04em",
    flexShrink: 0,
  },
  edgeRole: {
    color: "#6e7681",
    flexShrink: 0,
  },
  edgeTo: {
    color: "#58a6ff",
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  // Kumu widget blocks
  widget: {
    marginBottom: 6,
    padding: "6px 10px",
    background: "#0d1117",
    border: "1px solid #30363d",
    borderRadius: 4,
  },
  widgetHole: {
    borderStyle: "dashed",
    opacity: 0.7,
  },
  widgetSuspended: {
    borderColor: "#f0a04b",
    borderStyle: "dashed",
  },
  widgetHeader: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 6,
    alignItems: "center",
  },
  widgetContent: {
    marginTop: 6,
    paddingTop: 6,
    borderTop: "1px solid #21262d",
  },
  widgetName: {
    fontSize: 11,
    fontFamily: "monospace",
    color: "#d2a8ff",
    fontWeight: 600,
  },
  widgetProp: {
    fontSize: 11,
    fontFamily: "monospace",
    color: "#6e7681",
  },
  suspendedLabel: {
    fontSize: 11,
    fontFamily: "monospace",
    color: "#f0a04b",
    marginLeft: 8,
  },
} as const;
