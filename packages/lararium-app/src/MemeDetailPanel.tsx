/**
 * MemeDetailPanel — renders a focused meme carrier through the TW5 pipeline.
 *
 * Read path (local-first):
 *   tiddlerStore.get(uri)         — live store authority (seed from CRDT projection)
 *   tiddlerStore.subscribe(uri)   — reactive updates without panel close/reopen
 *   tw5.renderCarrierVDom(uri, text)  → VDomNode[]   (TW5 fake DOM render)
 *   renderVDom(vdom)              → React.ReactNode  (vdom-to-react adapter)
 *
 * Cold-start: if the store has no record yet, shape.meta.carrierText is the
 * seed (CRDT projection value present at panel mount). The subscription fires
 * immediately when seedAll() writes the store record.
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
  const { editor, tiddlerStore } = useLararium();

  // Cold-start seed from CRDT projection in shape.meta — present at mount.
  const shapeSeed = useMemo<string | null>(() => {
    if (!uri || !editor) return null;
    const shape = editor.getCurrentPageShapes().find(
      (s) =>
        (s.meta as Record<string, unknown>)?.uri === uri &&
        (s.meta as Record<string, unknown>)?.frameKind === "meme",
    );
    const ct = (shape?.meta as Record<string, unknown>)?.carrierText;
    return typeof ct === "string" ? ct : null;
  }, [uri, editor]);

  const [carrierText, setCarrierText] = useState<string | null>(null);

  useEffect(() => {
    if (!uri) { setCarrierText(null); return; }

    if (tiddlerStore) {
      tiddlerStore.get(uri).then((record) => {
        setCarrierText(record?.text ?? shapeSeed ?? null);
      });
    } else {
      setCarrierText(shapeSeed);
    }

    if (!tiddlerStore) return;

    return tiddlerStore.subscribe((change) => {
      if (change.title !== uri) return;
      setCarrierText(change.record?.text ?? null);
    });
  // shapeSeed seeds once on uri change; subscription owns subsequent updates.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri, tiddlerStore]);

  return carrierText;
}

// ---------------------------------------------------------------------------
// useCarrierVDom — TW5 render of carrier text → VDomNode[]
//
// Synchronous once tw5 is booted. Re-runs when carrierText changes.
// Returns null while tw5 is loading or text is absent.
// ---------------------------------------------------------------------------

function useCarrierVDom(
  uri: string | null,
  carrierText: string | null,
): VDomNode[] | null {
  const { tw5 } = useLararium();
  return useMemo<VDomNode[] | null>(() => {
    if (!uri || !carrierText || !tw5) return null;
    try {
      return tw5.renderCarrierVDom(uri, carrierText);
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
  const vdom        = useCarrierVDom(uri, carrierText);

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
    if (!vdom)        return <div style={css.status}>Render error — check carrier syntax.</div>;
    return renderVDom(vdom);
  })();

  return (
    <div style={css.backdrop} onClick={onClose} aria-modal="true" role="dialog">
      <div style={css.panel} onClick={(e) => e.stopPropagation()}>
        <div style={css.header}>
          <span style={css.uri}>{uri}</span>
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
