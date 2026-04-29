/**
 * MemeDetailPanel — renders a focused meme carrier through the TW5 pipeline.
 *
 * Read path (local-first):
 *   tiddlerStore.get(uri)         — Automerge source of truth for carrier text
 *   tiddlerStore.subscribe()      — reactive updates without panel close/reopen
 *   tw5.renderMeme(uri, text)     → { view, vdom }  (ViewTemplate dispatch + TW5 render)
 *   renderVDom(vdom)              → React.ReactNode  (vdom-to-react adapter)
 *
 * tw5 must be booted (tw5-ready phase) before the panel renders content.
 * While tw5 is null the panel shows a loading state.
 */

import { useEffect, useMemo, useCallback, useState } from "react";
import type { VDomNode } from "@lararium/tw5";
import { useLararium } from "./lararium-context.js";
import { renderVDom } from "./vdom-to-react.js";

// ---------------------------------------------------------------------------
// useCarrierText — tiddlerStore-subscribed carrier text for focused URI
// ---------------------------------------------------------------------------

function useCarrierText(uri: string | null): string | null {
  const { tiddlerStore } = useLararium();
  const [carrierText, setCarrierText] = useState<string | null>(null);

  useEffect(() => {
    if (!uri || !tiddlerStore) { setCarrierText(null); return; }

    tiddlerStore.get(uri).then((record) => setCarrierText(record?.text ?? null));

    return tiddlerStore.subscribe((change) => {
      if (change.title !== uri) return;
      setCarrierText(change.record?.text ?? null);
    });
  }, [uri, tiddlerStore]);

  return carrierText;
}

// ---------------------------------------------------------------------------
// useMemeRender — Automerge text → tw5.renderMeme → { view, vdom }
// ---------------------------------------------------------------------------

type MemeView = "kumu-view" | "reaction-view" | "meme-view";

function useMemeRender(
  uri: string | null,
  carrierText: string | null,
): { view: MemeView; vdom: VDomNode[]; kumuInstances: { name: string; props: string; el: unknown }[] } | null {
  const { tw5 } = useLararium();
  return useMemo(() => {
    if (!uri || !carrierText || !tw5) return null;
    try {
      return tw5.renderMeme(uri, carrierText);
    } catch {
      return null;
    }
  }, [uri, carrierText, tw5]);
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export function MemeDetailPanel() {
  const { navState, dispatch, tw5 } = useLararium();
  const visible  = navState.activeView === "meme-detail" && !!navState.focusUri;
  const uri      = visible ? navState.focusUri! : null;

  const carrierText = useCarrierText(uri);
  const rendered    = useMemeRender(uri, carrierText);

  const onClose = useCallback(
    () => dispatch({ type: "NAVIGATE_BACK" }),
    [dispatch],
  );

  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [visible, onClose]);

  if (!visible) return null;

  const body = (() => {
    if (!tw5)         return <div style={css.status}>⏿ tw5 booting…</div>;
    if (!carrierText) return <div style={css.status}>No carrier text — reseed room to populate.</div>;
    if (!rendered)    return <div style={css.status}>Render error — check carrier syntax.</div>;
    return renderVDom(rendered.vdom);
  })();

  const viewBadgeStyle: React.CSSProperties = {
    fontSize: 9, fontFamily: "monospace", fontWeight: 700, letterSpacing: "0.08em",
    padding: "1px 5px", borderRadius: 3, flexShrink: 0,
    background: rendered?.view === "kumu-view" ? "#3d1f6b" : "#1a3d20",
    color:      rendered?.view === "kumu-view" ? "#d2a8ff" : "#56d364",
  };
  const viewBadge = rendered?.view === "kumu-view"
    ? <span style={viewBadgeStyle}>kumu</span>
    : rendered?.view === "reaction-view"
      ? <span style={viewBadgeStyle}>reaction</span>
      : null;

  return (
    <div style={css.backdrop} onClick={onClose} aria-modal="true" role="dialog">
      <div style={css.panel} onClick={(e) => e.stopPropagation()}>
        <div style={css.header}>
          <span style={css.uri}>{uri}</span>
          {viewBadge}
          <button style={css.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div style={css.body}>{body}</div>
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
} as const;
