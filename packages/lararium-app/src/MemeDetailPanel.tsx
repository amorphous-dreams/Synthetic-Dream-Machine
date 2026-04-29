/**
 * MemeDetailPanel — three-tree pipeline for meme carrier rendering.
 *
 * Pipeline:
 *   shape.meta.carrierText           ← CRDT projection from lares/ file
 *   parseMemeCarrier()               → MemeAstNode[]   (parse tree — agnostic)
 *   resolveWidgetTree(ast, registry) → WidgetNode[]    (widget tree — kumu-typed)
 *   buildWidgetMap() + executeKumu() → Map<pos, slot>  (causal island fanout)
 *   renderCarrier(ast, widgetMap)    → React.ReactNode (React render adapter)
 *
 * TW5 instance: available via context for filter expressions and recipe cascade
 * evaluation — NOT used to render carrier text (carrier text is our sigil grammar,
 * not standard TW5 wikitext).
 */

import { useEffect, useMemo, useCallback, useState } from "react";
import {
  parseMemeCarrier,
  resolveWidgetTree,
  executeBatch,
} from "@lararium/core";
import type { MemeAstNode, WidgetNode, KumuResult, KumuContext } from "@lararium/core";
import { buildWidgetMap } from "@lararium/tldraw";
import { useLararium } from "./lararium-context.js";
import { renderCarrier } from "./native-render.js";

// ---------------------------------------------------------------------------
// useKumuExecution — async Verse-aligned causal island fanout
// ---------------------------------------------------------------------------

function useKumuExecution(
  widgetTree: WidgetNode[] | null,
  kumuRegistry: ReturnType<typeof useLararium>["kumuRegistry"],
): KumuResult[] | null {
  const [results, setResults] = useState<KumuResult[] | null>(null);

  useEffect(() => {
    if (!widgetTree || !kumuRegistry || widgetTree.length === 0) {
      setResults(null);
      return;
    }
    let cancelled = false;
    const ctx: KumuContext = { props: {}, depth: 0, registry: kumuRegistry };
    executeBatch(widgetTree, ctx).then((r) => {
      if (!cancelled) setResults(r);
    });
    return () => { cancelled = true; };
  }, [widgetTree, kumuRegistry]);

  return results;
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export function MemeDetailPanel() {
  const { navState, dispatch, editor, kumuRegistry } = useLararium();
  const visible = navState.activeView === "meme-detail" && !!navState.focusUri;
  const uri = visible ? navState.focusUri! : null;

  // Read carrier text from CRDT shape meta — seeded at projection time.
  const carrierText = useMemo<string | null>(() => {
    if (!uri || !editor) return null;
    const shape = editor.getCurrentPageShapes().find(
      (s) =>
        (s.meta as Record<string, unknown>)?.uri === uri &&
        (s.meta as Record<string, unknown>)?.frameKind === "meme",
    );
    const ct = (shape?.meta as Record<string, unknown>)?.carrierText;
    return typeof ct === "string" ? ct : null;
  }, [uri, editor]);

  // parse tree — agnostic
  const ast = useMemo<MemeAstNode[] | null>(() => {
    if (!uri || !carrierText) return null;
    return parseMemeCarrier(uri, carrierText);
  }, [uri, carrierText]);

  // widget tree — kumu-typed; null until registry arrives
  const widgetTree = useMemo<WidgetNode[] | null>(() => {
    if (!ast || !kumuRegistry) return null;
    return resolveWidgetTree(ast, kumuRegistry);
  }, [ast, kumuRegistry]);

  // causal island fanout — async kumu execution
  const kumuResults = useKumuExecution(widgetTree, kumuRegistry);

  // pos→slot index for O(1) lookup in renderCarrier
  const widgetMap = useMemo(
    () => buildWidgetMap(widgetTree ?? [], kumuResults),
    [widgetTree, kumuResults],
  );

  const onClose = useCallback(() => dispatch({ type: "NAVIGATE_BACK" }), [dispatch]);

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
          {!carrierText ? (
            <div style={css.status}>No carrier text in store — reseed room to populate.</div>
          ) : (
            ast && renderCarrier(ast, widgetMap)
          )}
        </div>
      </div>
    </div>
  );
}

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
} as const;
