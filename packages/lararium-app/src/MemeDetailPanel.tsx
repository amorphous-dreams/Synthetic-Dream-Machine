/**
 * MemeDetailPanel — TW5 story river panel floating over the canvas.
 *
 * React owns: container position, visibility, close gesture, Escape key.
 * TW5 owns:   everything inside the container — story river, sidebar, styles.
 *
 * tw5.mountPanel(containerRef.current) attaches TW5's rootWidget to the
 * container's shadow root. TW5's native refresh cascade handles all content
 * updates — no VDom interpreter, no tiddlerStore subscription in React.
 *
 * Navigation into the panel: LarariumShell sets $:/StoryList via tw5.setTiddler()
 * when navState.focusUri changes, which TW5's story river widget handles natively.
 */

import { useEffect, useRef, useCallback } from "react";
import { useLararium } from "./lararium-context.js";

export function MemeDetailPanel() {
  const { navState, dispatch, tw5, fireMeme } = useLararium();
  const visible = navState.activeView === "meme-detail" && !!navState.focusUri;
  const uri     = visible ? navState.focusUri! : null;

  const containerRef = useRef<HTMLDivElement>(null);
  const unmountRef   = useRef<(() => void) | null>(null);

  const onClose = useCallback(
    () => dispatch({ type: "NAVIGATE_BACK" }),
    [dispatch],
  );

  // Mount TW5's story river into the container on first render.
  // mountPanel() returns a cleanup fn; we hold it in a ref for unmount.
  useEffect(() => {
    if (!containerRef.current || !tw5) return;
    if (unmountRef.current) return; // already mounted
    unmountRef.current = tw5.mountPanel(containerRef.current);
    return () => {
      unmountRef.current?.();
      unmountRef.current = null;
    };
  }, [tw5]);

  // Navigate TW5's story river to the focused meme URI.
  // $:/StoryList is TW5's native "open tiddlers" list — setting it focuses the meme.
  useEffect(() => {
    if (!uri || !tw5) return;
    tw5.setTiddler({ title: "$:/StoryList", text: uri, tags: [] });
    // Activation signal — ReactionGraph handlers respond to this.
    fireMeme?.(uri, "activate");
  }, [uri, tw5, fireMeme]);

  // Escape to close.
  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [visible, onClose]);

  return (
    <div
      style={{ ...css.backdrop, display: visible ? "flex" : "none" }}
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div style={css.panel} onClick={(e) => e.stopPropagation()}>
        <div style={css.handleBar}>
          <button style={css.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>
        {/* TW5 renders its full story river into this div via shadow DOM */}
        <div ref={containerRef} style={css.tw5Root} />
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
    alignItems: "flex-end",
  },
  panel: {
    width: "100%",
    maxHeight: "70vh",
    borderRadius: "12px 12px 0 0",
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
    // No background/border — TW5's CSS owns the panel interior.
  },
  handleBar: {
    display: "flex",
    justifyContent: "flex-end",
    padding: "6px 12px",
    flexShrink: 0,
    background: "rgba(0,0,0,0.3)",
    backdropFilter: "blur(4px)",
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "#ebdbb2",
    cursor: "pointer",
    fontSize: 16,
    lineHeight: 1,
    padding: "4px 6px",
    borderRadius: 4,
    flexShrink: 0,
  },
  tw5Root: {
    flex: 1,
    overflow: "hidden",
    // Shadow DOM boundary — TW5 styles stay inside.
  },
} as const;
