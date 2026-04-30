/**
 * LarariumPanel — floating wiki frame that collapses into the HUD chip.
 *
 * Two states driven by wikiOpen:
 *   collapsed  — HUD chip (small, bottom-right by default)
 *   expanded   — floating wiki frame with TW5 story river
 *
 * Always mounted: TW5 shadow root stays alive regardless of state.
 * Transition: CSS width/height/border-radius animated between states.
 * Draggable: pointer-capture drag on the handle bar.
 * Edge-snap: on pointer-up, snaps to nearest edge if within SNAP_PX.
 * Resize: custom bottom-right corner handle adjusts panel size.
 *
 * Keyboard:
 *   Ctrl+K / ⌘K  — toggle (handled in LarariumShell, calls setWikiOpen)
 *   `             — drawingMode toggle (handled in LarariumShell)
 *   Escape        — close, via capture-phase listener when expanded
 *   tldraw keys   — blocked via capture when focus is inside shadow root
 */

import {
  useEffect, useRef, useCallback, useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useLararium } from "./lararium-context.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PANEL_W = 420;
const PANEL_H = 560;
const CHIP_W  = 116;
const CHIP_H  = 40;
const SNAP_PX = 28;
const MIN_W   = 280;
const MIN_H   = 180;

interface Pos  { left: number; top: number }
interface Size { w: number; h: number }

// ---------------------------------------------------------------------------
// LarariumPanel
// ---------------------------------------------------------------------------

export function LarariumPanel() {
  const {
    navState, dispatch,
    wikiOpen, setWikiOpen,
    drawingMode, setDrawingMode,
    tw5, fireMeme,
    reactionGraph,
  } = useLararium();

  const uri = navState.focusUri ?? null;

  // TW5 mount refs — shadow root persists regardless of expand/collapse.
  const tw5HostRef  = useRef<HTMLDivElement>(null);
  const unmountRef  = useRef<(() => void) | null>(null);

  // Preserve drawing mode across wiki open/close.
  const prevDrawRef = useRef(false);

  // Panel position — lazy init to bottom-right of viewport.
  const [pos, setPos] = useState<Pos>(() => ({
    left: (typeof window !== "undefined" ? window.innerWidth  : 800) - PANEL_W - 12,
    top:  (typeof window !== "undefined" ? window.innerHeight : 600) - PANEL_H - 12,
  }));

  // User-adjusted panel size.
  const [size, setSize] = useState<Size>({ w: PANEL_W, h: PANEL_H });

  // Drag state — stored in refs to avoid re-render on every mousemove.
  const drag   = useRef<{ mx: number; my: number; pl: number; pt: number } | null>(null);
  // Resize state.
  const resize = useRef<{ mx: number; my: number; sw: number; sh: number } | null>(null);

  // ---------------------------------------------------------------------------
  // Auto-collapse drawingMode when wiki opens; restore on close.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (wikiOpen) {
      prevDrawRef.current = drawingMode;
      if (drawingMode) setDrawingMode(false);
    } else {
      if (prevDrawRef.current) setDrawingMode(true);
    }
    // drawingMode deliberately omitted — only snapshot on wikiOpen change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wikiOpen]);

  // ---------------------------------------------------------------------------
  // Mount TW5 once — shadow root survives expand/collapse.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!tw5HostRef.current || !tw5) return;
    if (unmountRef.current) return;
    unmountRef.current = tw5.mountPanel(tw5HostRef.current);
    return () => { unmountRef.current?.(); unmountRef.current = null; };
  }, [tw5]);

  // ---------------------------------------------------------------------------
  // Kukali suspension wire — local-first, no React MutationObserver.
  // KukaliWidget calls wiki._larKukaliHook(uri, trigger) at render time.
  // We subscribe once via reactionGraph; when the trigger fires, touch the
  // tiddler to force TW5 to re-render it in the story river.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!tw5 || !reactionGraph) return;
    return tw5.registerKukaliHook((kukaliUri, trigger) => {
      const p = reactionGraph.subscribeOnce(kukaliUri, trigger);
      p.then(() => tw5.touchTiddler(kukaliUri)).catch(() => {});
      return () => p.cancel();
    });
  }, [tw5, reactionGraph]);

  // ---------------------------------------------------------------------------
  // Navigate TW5 when panel opens or focusUri changes.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!wikiOpen || !tw5) return;
    if (uri) {
      tw5.setTiddler({ title: "$:/StoryList", text: uri, tags: [] });
      fireMeme?.(uri, "activate");
    } else {
      tw5.setTiddler({ title: "$:/StoryList", text: "$:/DefaultTiddlers", tags: [] });
    }
  }, [wikiOpen, uri, tw5, fireMeme]);

  // ---------------------------------------------------------------------------
  // Keyboard: Escape closes; capture blocks tldraw single-char shortcuts.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!wikiOpen) return;

    const onCapture = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      // Block single-char tldraw tool keys (v, d, a, e, …) when focus is
      // inside the shadow root or anywhere in the panel host.
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const host = tw5HostRef.current;
        if (!host) return;
        const active = document.activeElement;
        const shadowActive = host.shadowRoot?.activeElement;
        if (host.contains(active) || shadowActive) {
          e.stopPropagation();
        }
      }
    };

    document.addEventListener("keydown", onCapture, { capture: true });
    return () => document.removeEventListener("keydown", onCapture, { capture: true });
  // onClose included via closure; wikiOpen is the real gate.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wikiOpen]);

  // ---------------------------------------------------------------------------
  // Close
  // ---------------------------------------------------------------------------
  const onClose = useCallback(() => {
    setWikiOpen(false);
    if (navState.activeView === "meme-detail") dispatch({ type: "NAVIGATE_BACK" });
  }, [setWikiOpen, navState.activeView, dispatch]);

  // ---------------------------------------------------------------------------
  // Drag — pointer capture on handle bar.
  // ---------------------------------------------------------------------------
  const onDragDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    drag.current = { mx: e.clientX, my: e.clientY, pl: pos.left, pt: pos.top };
  }, [pos]);

  const onDragMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.mx;
    const dy = e.clientY - drag.current.my;
    setPos({ left: drag.current.pl + dx, top: drag.current.pt + dy });
  }, []);

  const onDragUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current = null;
    const panW = wikiOpen ? size.w : CHIP_W;
    const panH = wikiOpen ? size.h + CHIP_H : CHIP_H;
    setPos((p) => snapToEdge(p, panW, panH));
  }, [wikiOpen, size]);

  // ---------------------------------------------------------------------------
  // Resize — bottom-right corner handle.
  // ---------------------------------------------------------------------------
  const onResizeDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    resize.current = { mx: e.clientX, my: e.clientY, sw: size.w, sh: size.h };
  }, [size]);

  const onResizeMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!resize.current) return;
    const dx = e.clientX - resize.current.mx;
    const dy = e.clientY - resize.current.my;
    setSize({
      w: Math.max(MIN_W, resize.current.sw + dx),
      h: Math.max(MIN_H, resize.current.sh + dy),
    });
  }, []);

  const onResizeUp = useCallback(() => { resize.current = null; }, []);

  // ---------------------------------------------------------------------------
  // Derived panel dimensions.
  // ---------------------------------------------------------------------------
  const panW = wikiOpen ? size.w    : CHIP_W;
  const panH = wikiOpen ? size.h + CHIP_H : CHIP_H;

  return (
    <div
      style={{
        position:       "fixed",
        left:           pos.left,
        top:            pos.top,
        width:          panW,
        height:         panH,
        zIndex:         600,
        display:        "flex",
        flexDirection:  "column",
        borderRadius:   wikiOpen ? 10 : 8,
        overflow:       "hidden",
        background:     "rgba(20,20,20,0.75)",
        backdropFilter: "blur(10px)",
        border:         "1px solid rgba(255,255,255,0.09)",
        boxShadow:      "0 4px 28px rgba(0,0,0,0.55)",
        transition:     "width 0.15s ease, height 0.15s ease, border-radius 0.15s ease",
        userSelect:     "none",
      }}
    >
      {/* ── Handle bar ─────────────────────────────────────────────────── */}
      <div
        style={handleBar}
        onPointerDown={onDragDown}
        onPointerMove={onDragMove}
        onPointerUp={onDragUp}
      >
        <span style={gripDots} aria-hidden>⠿</span>

        <button
          style={{ ...hudBtn, ...(wikiOpen ? hudBtnActive : {}) }}
          onClick={(e) => { e.stopPropagation(); setWikiOpen((v) => !v); }}
          title="Wiki  (⌘K)"
          aria-label="Toggle wiki panel"
          aria-pressed={wikiOpen}
        >
          ⌘K
        </button>

        <button
          style={{ ...hudBtn, ...(drawingMode ? hudBtnActive : {}) }}
          onClick={(e) => { e.stopPropagation(); setDrawingMode((v) => !v); }}
          title="Drawing mode  (`)"
          aria-label="Toggle drawing mode"
          aria-pressed={drawingMode}
        >
          {drawingMode ? "✏" : "◻"}
        </button>

        {wikiOpen && (
          <button
            style={{ ...hudBtn, marginLeft: "auto" }}
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            aria-label="Close wiki panel"
          >
            ✕
          </button>
        )}
      </div>

      {/* ── TW5 content ─────────────────────────────────────────────────
           Always in the DOM so shadow root stays alive.
           Visibility controlled by display toggle.                      */}
      <div
        style={{
          flex:       1,
          overflow:   "hidden",
          display:    wikiOpen ? "block" : "none",
          userSelect: "text",
        }}
      >
        <div ref={tw5HostRef} style={{ width: "100%", height: "100%" }} />
      </div>

      {/* ── Resize handle ───────────────────────────────────────────────
           Only visible when expanded.                                   */}
      {wikiOpen && (
        <div
          style={resizeHandle}
          onPointerDown={onResizeDown}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeUp}
          title="Drag to resize"
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function snapToEdge(p: Pos, panW: number, panH: number): Pos {
  let { left, top } = p;
  if (left                                    < SNAP_PX) left = 12;
  if (top                                     < SNAP_PX) top  = 12;
  if (window.innerWidth  - left - panW < SNAP_PX) left = window.innerWidth  - panW - 12;
  if (window.innerHeight - top  - panH < SNAP_PX) top  = window.innerHeight - panH - 12;
  return { left, top };
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const handleBar: React.CSSProperties = {
  display:        "flex",
  alignItems:     "center",
  gap:            6,
  padding:        "0 8px",
  height:         CHIP_H,
  flexShrink:     0,
  cursor:         "grab",
  background:     "rgba(0,0,0,0.3)",
  backdropFilter: "blur(4px)",
  borderBottom:   "1px solid rgba(255,255,255,0.06)",
};

const gripDots: React.CSSProperties = {
  fontSize:   14,
  opacity:    0.35,
  flexShrink: 0,
  lineHeight: 1,
  fontFamily: "monospace",
};

const hudBtn: React.CSSProperties = {
  display:        "flex",
  alignItems:     "center",
  justifyContent: "center",
  minWidth:       34,
  height:         28,
  padding:        "0 8px",
  background:     "none",
  color:          "rgba(255,255,255,0.6)",
  border:         "1px solid rgba(255,255,255,0.12)",
  borderRadius:   5,
  cursor:         "pointer",
  fontSize:       12,
  fontFamily:     "system-ui, monospace, sans-serif",
  fontWeight:     600,
  lineHeight:     1,
  transition:     "color 0.1s, border-color 0.1s, background 0.1s",
  flexShrink:     0,
  userSelect:     "none",
};

const hudBtnActive: React.CSSProperties = {
  color:       "#fabd2f",
  borderColor: "#fabd2f",
  background:  "rgba(250,189,47,0.08)",
};

const resizeHandle: React.CSSProperties = {
  position:   "absolute",
  right:      0,
  bottom:     0,
  width:      18,
  height:     18,
  cursor:     "se-resize",
  // Subtle corner grip visual
  background: "linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.15) 50%)",
  borderRadius: "0 0 10px 0",
};
