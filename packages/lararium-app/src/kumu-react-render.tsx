/**
 * React render adapter — the story river view of a meme carrier.
 *
 * This adapter sits at the third layer of the three-tree pipeline:
 *
 *   carrier text → MemeAstNode[] → WidgetNode[] → React.ReactNode (here)
 *
 * TW5 analogy: this module plays the role of the WikiText widget renderer.
 * TW5 widgets produce DOM; this adapter produces React nodes.
 * The widgetMap carries executed kumu output (KumuResult) keyed by parse position,
 * so kahea call-sites in the AST delegate to their executed widget output directly.
 *
 * Render contract:
 *   - renderCarrier(ast, widgetMap) → React.ReactNode  (top-level entry point)
 *   - kahea/kumu/wehe sigils → widget output (executed result, skeleton, or typed hole)
 *   - Worksite, Text, Edge, toml/iam sigils → structural wiki layout
 *
 * Wikitext-driven: kumu execution output feeds the render tree.
 * No layout hardcoded here — the carrier text IS the template.
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
  return ast.map((node, i) => renderNode(node, String(i), widgetMap));
}

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
      const suppressedSlots = new Set(["iam", "meme-body-open", "body-close", "edges"]);
      return (
        <section key={key} style={css.worksite} data-slot={ws.slot}>
          {slug && !suppressedSlots.has(slug) && (
            <h4 style={css.worksiteSlug}>{slug}</h4>
          )}
          {ws.body.map((child, i) => renderNode(child, `${key}.${i}`, widgetMap))}
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
      return (
        <div key={key} style={css.edge}>
          <span style={{ ...css.edgeBadge, ...familyColor(e.family) }}>{e.family}</span>
          {e.role && <span style={css.edgeRole}>{e.role}</span>}
          <span style={css.edgeTo}>{e.toRaw}</span>
        </div>
      );
    }

    case "Sigil": {
      const s = node as SigilNode;

      if (s.sigilName === "toml" || s.sigilName === "iam") {
        const content = s.attrs["content"] ?? "";
        if (!content.trim()) return null;
        return <pre key={key} style={css.toml}><code>{content}</code></pre>;
      }

      if (s.sigilName === "kahea" || s.sigilName === "kumu" || s.sigilName === "wehe") {
        const slot = widgetMap.get(s.pos);
        if (slot) {
          return slot.result
            ? renderKumuResult(slot.result, slot.widget, key, widgetMap)
            : renderWidgetSkeleton(slot.widget, key);
        }
        // Hazel semantics: typed hole — no registry match, render a live placeholder
        return (
          <div key={key} style={{ ...css.widget, ...css.widgetHole }}>
            <span style={css.widgetKumu}>
              {s.attrs["name"] ? `unknown kumu: ${s.attrs["name"]}` : s.sigilName}
            </span>
          </div>
        );
      }

      if (s.body.length > 0) {
        return <div key={key}>{s.body.map((c, i) => renderNode(c, `${key}.${i}`, widgetMap))}</div>;
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
        <span style={css.widgetKumu}>{widget.kumuName}</span>
        {Object.entries(widget.resolvedProps).map(([k, v]) => (
          <span key={k} style={css.widgetProp}>{k}: <em>{v}</em></span>
        ))}
        {result.nodes.map((node, i) => renderNode(node, `${key}.node.${i}`, widgetMap))}
      </div>
    );
  }

  if (result.error === "suspended") {
    return (
      <div key={key} style={{ ...css.widget, ...css.widgetSuspended }}>
        <span style={css.widgetKumu}>{widget.kumuName}</span>
        <span style={css.widgetSuspendedLabel}>
          ⏿ kukali — waiting for trigger{result.detail ? `: ${result.detail}` : ""}
        </span>
      </div>
    );
  }

  return (
    <div key={key} style={{ ...css.widget, ...css.widgetHole }}>
      <span style={css.widgetKumu}>
        {result.error === "unresolved-hole" ? `unknown kumu: ${widget.kumuName}` : widget.kumuName}
      </span>
      {result.detail && <span style={css.widgetProp}>{result.error}: {result.detail}</span>}
    </div>
  );
}

function renderWidgetSkeleton(node: WidgetNode, key: string): React.ReactNode {
  if (node.def) {
    return (
      <div key={key} style={{ ...css.widget, opacity: 0.5 }}>
        <span style={css.widgetKumu}>{node.kumuName}</span>
        {Object.entries(node.resolvedProps).map(([k, v]) => (
          <span key={k} style={css.widgetProp}>{k}: <em>{v}</em></span>
        ))}
      </div>
    );
  }
  return (
    <div key={key} style={{ ...css.widget, ...css.widgetHole }}>
      <span style={css.widgetKumu}>unknown kumu: {node.kumuName}</span>
    </div>
  );
}

function familyColor(family: string): React.CSSProperties {
  const map: Record<string, string> = {
    control:  "#58a6ff",
    relation: "#7ee787",
    observe:  "#f0a04b",
    dataflow: "#bb8bfc",
  };
  return { background: map[family] ?? "#444d56" };
}

// ---------------------------------------------------------------------------
// Styles — wiki content visual language
// ---------------------------------------------------------------------------

export const css = {
  worksite: {
    marginBottom: 16,
    borderLeft: "2px solid #21262d",
    paddingLeft: 12,
  },
  worksiteSlug: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: "#6e7681",
    margin: "0 0 6px",
  },
  text: {
    margin: "0 0 8px",
    color: "#c9d1d9",
  },
  toml: {
    margin: "0 0 8px",
    padding: "8px 10px",
    background: "#0d1117",
    border: "1px solid #21262d",
    borderRadius: 6,
    fontSize: 11,
    color: "#7ee787",
    overflowX: "auto" as const,
    fontFamily: "monospace",
  },
  edge: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
    fontSize: 11,
    fontFamily: "monospace",
  },
  edgeBadge: {
    padding: "1px 5px",
    borderRadius: 3,
    color: "#0d1117",
    fontSize: 10,
    fontWeight: 600,
  },
  edgeRole: {
    color: "#6e7681",
  },
  edgeTo: {
    color: "#58a6ff",
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  widget: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 6,
    marginBottom: 6,
    padding: "4px 8px",
    background: "#0d1117",
    border: "1px solid #30363d",
    borderRadius: 4,
    alignItems: "center",
  },
  widgetHole: {
    borderStyle: "dashed",
    opacity: 0.6,
  },
  widgetSuspended: {
    borderColor: "#f0a04b",
    borderStyle: "dashed",
  },
  widgetSuspendedLabel: {
    fontSize: 11,
    fontFamily: "monospace",
    color: "#f0a04b",
  },
  widgetKumu: {
    fontSize: 11,
    fontFamily: "monospace",
    color: "#bb8bfc",
    fontWeight: 600,
  },
  widgetProp: {
    fontSize: 11,
    fontFamily: "monospace",
    color: "#6e7681",
  },
  sigil: {
    marginBottom: 8,
    padding: "4px 8px",
    background: "#0d1117",
    border: "1px dashed #21262d",
    borderRadius: 4,
  },
  sigilName: {
    fontSize: 10,
    fontFamily: "monospace",
    color: "#bb8bfc",
    marginRight: 6,
  },
  sigilAttr: {
    fontSize: 11,
    fontFamily: "monospace",
    color: "#f0a04b",
  },
} as const;
