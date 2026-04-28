/**
 * MemeDetailPanel — renders a carrier's parsed AST as wiki content.
 *
 * Pipeline (CRDT-native, no HTTP fetch):
 *   editor.getShape(shapeId).meta.carrierText  →  raw text already in the store
 *   parseMemeCarrier()                          →  MemeAstNode[]
 *   <AstRenderer>                               →  React (the third tree)
 *
 * Carrier text is seeded into the tldraw room snapshot at projection time
 * (LarTLFrame.carrierText → shape.meta.carrierText). The CRDT carries it;
 * no separate HTTP channel needed.
 *
 * Slides up from the bottom when navState.activeView === "meme-detail".
 * Escape / backdrop click dispatches NAVIGATE_BACK.
 */

import { useEffect, useMemo, useCallback } from "react";
import { parseMemeCarrier } from "@lararium/core";
import type { MemeAstNode, WorksiteNode, EdgeNode, TextNode, SigilNode } from "@lararium/core";
import { useLararium } from "./lararium-context.js";

// ---------------------------------------------------------------------------
// AST → React render pass
// ---------------------------------------------------------------------------

function renderNode(node: MemeAstNode, key: string): React.ReactNode {
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
          {ws.body.map((child, i) => renderNode(child, `${key}.${i}`))}
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
        return (
          <div key={key} style={css.sigil}>
            <span style={css.sigilName}>{s.sigilName}</span>
            {s.attrs["name"] && <span style={css.sigilAttr}>{s.attrs["name"]}</span>}
            {s.body.map((child, i) => renderNode(child, `${key}.${i}`))}
          </div>
        );
      }
      if (s.body.length > 0) {
        return <div key={key}>{s.body.map((c, i) => renderNode(c, `${key}.${i}`))}</div>;
      }
      return null;
    }

    default:
      return null;
  }
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
// Panel component
// ---------------------------------------------------------------------------

export function MemeDetailPanel() {
  const { navState, dispatch, editor } = useLararium();
  const visible = navState.activeView === "meme-detail" && !!navState.focusUri;
  const uri = visible ? navState.focusUri! : null;

  // Read carrier text directly from CRDT store — no fetch needed.
  // The shape with meta.uri === focusUri carries meta.carrierText seeded at projection.
  const carrierText = useMemo<string | null>(() => {
    if (!uri || !editor) return null;
    const shapes = editor.getCurrentPageShapes();
    const shape = shapes.find(
      (s) => (s.meta as Record<string, unknown>)?.uri === uri
        && (s.meta as Record<string, unknown>)?.frameKind === "meme"
    );
    return typeof (shape?.meta as Record<string, unknown>)?.carrierText === "string"
      ? (shape!.meta as Record<string, unknown>).carrierText as string
      : null;
  }, [uri, editor]);

  const ast = useMemo<MemeAstNode[] | null>(() => {
    if (!uri || !carrierText) return null;
    return parseMemeCarrier(uri, carrierText);
  }, [uri, carrierText]);

  const onClose = useCallback(() => {
    dispatch({ type: "NAVIGATE_BACK" });
  }, [dispatch]);

  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div style={css.backdrop} onClick={onClose} aria-modal="true" role="dialog">
      <div style={css.panel} onClick={(e) => e.stopPropagation()}>
        <div style={css.header}>
          <span style={css.uri}>{uri}</span>
          <button style={css.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div style={css.body}>
          {!carrierText && <div style={css.status}>No carrier text in store — reseed room to populate.</div>}
          {ast && ast.map((node, i) => renderNode(node, String(i)))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const css = {
  backdrop: {
    position: "fixed" as const,
    inset: 0,
    zIndex: 700,
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "flex-end",
  },
  panel: {
    width: "100%",
    maxHeight: "60vh",
    background: "#161b22",
    borderTop: "1px solid #30363d",
    borderRadius: "12px 12px 0 0",
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 16px",
    borderBottom: "1px solid #21262d",
    flexShrink: 0,
  },
  uri: {
    flex: 1,
    fontSize: 12,
    fontFamily: "monospace",
    color: "#58a6ff",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "#6e7681",
    cursor: "pointer",
    fontSize: 16,
    lineHeight: 1,
    padding: "4px 6px",
    borderRadius: 4,
    flexShrink: 0,
  },
  body: {
    flex: 1,
    overflowY: "auto" as const,
    padding: "12px 16px",
    fontFamily: "system-ui, sans-serif",
    fontSize: 13,
    color: "#e6edf3",
    lineHeight: 1.6,
  },
  status: {
    color: "#6e7681",
    fontStyle: "italic",
  },
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
