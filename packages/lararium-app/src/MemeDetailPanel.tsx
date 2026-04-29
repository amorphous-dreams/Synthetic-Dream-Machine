/**
 * MemeDetailPanel — TW5-rendered meme carrier panel.
 *
 * Pipeline (TW5 cascade, single mode):
 *   shape.meta.carrierText  ← CRDT projection from lares/ file
 *   tw5.setTiddler(uri, text)  → loaded into TW5 wiki store
 *   tw5.renderTiddler(uri)     → HTML string (TW5 cascade renderer)
 *   dangerouslySetInnerHTML    → browser DOM
 *
 * TW5 is the authoritative rendering pipeline. The MemoryTiddlerStore
 * feeds TW5's wiki directly so all filter expressions resolve correctly.
 * No native-render.tsx branch; no renderMode gate.
 */

import { useEffect, useCallback, useState } from "react";
import { useLararium } from "./lararium-context.js";

export function MemeDetailPanel() {
  const { navState, dispatch, editor, tw5, tiddlerStore } = useLararium();
  const visible = navState.activeView === "meme-detail" && !!navState.focusUri;
  const uri = visible ? navState.focusUri! : null;

  // Read carrier text from CRDT shape meta — seeded at projection time.
  const carrierText: string | null = (() => {
    if (!uri || !editor) return null;
    const shape = editor.getCurrentPageShapes().find(
      (s) =>
        (s.meta as Record<string, unknown>)?.uri === uri &&
        (s.meta as Record<string, unknown>)?.frameKind === "meme",
    );
    const ct = (shape?.meta as Record<string, unknown>)?.carrierText;
    return typeof ct === "string" ? ct : null;
  })();

  // Bridge carrier text into TW5 wiki store so renderTiddler resolves tiddler fields.
  useEffect(() => {
    if (!tw5 || !uri || !carrierText) return;
    tw5.setTiddler({ title: uri, text: carrierText, type: "text/vnd.tiddlywiki" });
  }, [tw5, uri, carrierText]);

  // TW5 rendering — async because tiddlerStore.get is async.
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    if (!visible || !uri) { setHtml(null); return; }
    if (!tw5) { setHtml(null); return; }

    let cancelled = false;
    async function render() {
      // Prefer tiddlerStore text (may differ from shape meta after canon promotion).
      let text = carrierText;
      if (tiddlerStore) {
        const rec = await tiddlerStore.get(uri!);
        if (rec && !rec.deleted && rec.text !== undefined) text = rec.text;
      }
      if (!text) { if (!cancelled) setHtml(null); return; }

      // Ensure TW5 has the latest text before rendering.
      tw5!.setTiddler(uri!, { text, type: "text/vnd.tiddlywiki" });
      const rendered = tw5!.renderTiddler(uri!);
      if (!cancelled) setHtml(rendered || null);
    }
    render();
    return () => { cancelled = true; };
  }, [visible, uri, tw5, tiddlerStore, carrierText]);

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
          {!tw5 ? (
            <div style={css.status}>⟳ TW5 booting…</div>
          ) : !carrierText ? (
            <div style={css.status}>No carrier text in store — reseed room to populate.</div>
          ) : html === null ? (
            <div style={css.status}>⟳ rendering…</div>
          ) : (
            <div className="tw5-render" dangerouslySetInnerHTML={{ __html: html }} />
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
