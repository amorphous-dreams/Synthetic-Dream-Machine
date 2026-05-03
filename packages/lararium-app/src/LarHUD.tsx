/**
 * LarHUD — right/bottom-docked TW5 wiki panel, VSCode activity-bar model.
 *
 * Three open states (⌘K cycles, Escape collapses):
 *   collapsed  — 44px icon strip; always visible
 *   sidebar    — default working width/height
 *   expanded   — full wiki chrome
 *
 * Dock edges:
 *   right  — flex column child; width drives canvas push (default)
 *   bottom — flex row child; height drives canvas push
 *
 * Resize handle: drag the leading edge (left when right-docked, top when
 * bottom-docked) to adjust between MIN_W/MIN_H and MAX_W/MAX_H.
 * Persisted to localStorage.
 *
 * Breadcrumb: reads $:/StoryList from tw5; shows the top open tiddler title.
 *
 * TW5 shadow root stays live across all state transitions.
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { useLararium } from "./lararium-context.js";

// ---------------------------------------------------------------------------
// Types + constants
// ---------------------------------------------------------------------------

export type HudState = "collapsed" | "sidebar" | "expanded";

const STATE_CYCLE: HudState[] = ["collapsed", "sidebar", "expanded"];

const STRIP_W    = 44;
const SIDEBAR_W  = 340;
const EXPANDED_W = 640;

const STRIP_H    = 44;
const SIDEBAR_H  = 280;
const EXPANDED_H = 480;

const MIN_W = 200;
const MAX_W = 900;
const MIN_H = 160;
const MAX_H = 700;

const STORAGE_KEY_W = "lararium.hud.width";
const STORAGE_KEY_H = "lararium.hud.height";

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function readStored(key: string, fallback: number): number {
  try { const v = localStorage.getItem(key); if (v) return Number(v); } catch {}
  return fallback;
}

// ---------------------------------------------------------------------------
// LarHUD
// ---------------------------------------------------------------------------

export function LarHUD() {
  const { tw5, openPhase, wikiOpen, setWikiOpen, dockEdge, setDockEdge } = useLararium();
  const tw5HostRef = useRef<HTMLDivElement>(null);
  const unmountRef = useRef<(() => void) | null>(null);

  const [hudState, setHudState] = useState<HudState>("collapsed");
  const hudRef = useRef<HudState>("collapsed");
  hudRef.current = hudState;

  const [userWidth,  setUserWidth]  = useState(() => readStored(STORAGE_KEY_W, SIDEBAR_W));
  const [userHeight, setUserHeight] = useState(() => readStored(STORAGE_KEY_H, SIDEBAR_H));

  const [breadcrumb, setBreadcrumb] = useState<string | null>(null);

  // ── Sync wikiOpen ↔ hudState ──────────────────────────────────────────────
  useEffect(() => {
    if (!wikiOpen && hudRef.current !== "collapsed") setHudState("collapsed");
    if (wikiOpen  && hudRef.current === "collapsed") setHudState("sidebar");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wikiOpen]);

  const cycleHud = useCallback(() => {
    setHudState((cur) => {
      const next = STATE_CYCLE[(STATE_CYCLE.indexOf(cur) + 1) % STATE_CYCLE.length]!;
      setWikiOpen(next !== "collapsed");
      return next;
    });
  }, [setWikiOpen]);

  const collapseHud = useCallback(() => {
    setHudState("collapsed");
    setWikiOpen(false);
  }, [setWikiOpen]);

  // ── ⌘K capture ───────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault(); e.stopImmediatePropagation();
        cycleHud();
      }
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [cycleHud]);

  // ── Escape → collapse ─────────────────────────────────────────────────────
  useEffect(() => {
    if (hudRef.current === "collapsed") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); collapseHud(); }
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [hudState, collapseHud]);

  // ── Block tldraw key intercept inside shadow root ─────────────────────────
  useEffect(() => {
    const host = tw5HostRef.current;
    if (!host) return;
    const guard = (e: Event) => {
      if (host.shadowRoot?.contains(e.target as Node)) e.stopPropagation();
    };
    window.addEventListener("keydown", guard, { capture: true });
    window.addEventListener("keyup",   guard, { capture: true });
    return () => {
      window.removeEventListener("keydown", guard, { capture: true });
      window.removeEventListener("keyup",   guard, { capture: true });
    };
  }, []);

  // ── TW5 mount — boot once, stay live ─────────────────────────────────────
  useEffect(() => {
    const host = tw5HostRef.current;
    if (!tw5 || !host || unmountRef.current) return;
    try { unmountRef.current = tw5.mountPanel(host); }
    catch { /* tw5 not yet ready — retries when tw5 ref updates */ }
    return () => { unmountRef.current?.(); unmountRef.current = null; };
  }, [tw5]);

  // ── Breadcrumb — top of $:/StoryList ─────────────────────────────────────
  const refreshBreadcrumb = useCallback(() => {
    if (!tw5) return;
    const titles = tw5.filterTiddlers("[list[$:/StoryList]]");
    setBreadcrumb(titles[0] ?? null);
  }, [tw5]);

  useEffect(() => {
    if (!tw5) return;
    refreshBreadcrumb();
    return tw5.onWikiChange((changes: Record<string, unknown>) => {
      if ("$:/StoryList" in changes) refreshBreadcrumb();
    });
  }, [tw5, refreshBreadcrumb]);

  // ── Resize handle (pointer capture) ──────────────────────────────────────
  const onResizePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const startCoord = dockEdge === "right" ? e.clientX : e.clientY;
    const startSize  = dockEdge === "right" ? userWidth : userHeight;

    const onMove = (ev: PointerEvent) => {
      const coord = dockEdge === "right" ? ev.clientX : ev.clientY;
      const delta = startCoord - coord; // drag toward leading edge = grow
      if (dockEdge === "right") {
        const w = clamp(startSize + delta, MIN_W, MAX_W);
        setUserWidth(w);
        try { localStorage.setItem(STORAGE_KEY_W, String(w)); } catch {}
      } else {
        const h = clamp(startSize + delta, MIN_H, MAX_H);
        setUserHeight(h);
        try { localStorage.setItem(STORAGE_KEY_H, String(h)); } catch {}
      }
    };
    const onUp = () => {
      el.releasePointerCapture(e.pointerId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup",   onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup",   onUp);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dockEdge, userWidth, userHeight]);

  // ── Derived dimensions ────────────────────────────────────────────────────
  const isCollapsed = hudState === "collapsed";

  const panelW = dockEdge === "right"
    ? (isCollapsed ? STRIP_W : hudState === "expanded" ? clamp(EXPANDED_W, MIN_W, MAX_W) : userWidth)
    : "100%";

  const panelH = dockEdge === "bottom"
    ? (isCollapsed ? STRIP_H : hudState === "expanded" ? clamp(EXPANDED_H, MIN_H, MAX_H) : userHeight)
    : "100%";

  const phaseLabel = !openPhase ? "—"
    : openPhase === "live"          ? "live"
    : openPhase === "tw5-booted"    ? "ready"
    : openPhase === "peer-ready"    ? "peer"
    : openPhase === "room-ready"    ? "room"
    : openPhase === "catalog-ready" ? "cat"
    :                                 "boot";

  const crumbText = breadcrumb
    ? breadcrumb.replace(/^\$:\//, "").replace(/\//g, " / ")
    : null;

  // ── Render ────────────────────────────────────────────────────────────────
  const resizeHandleStyle: React.CSSProperties = dockEdge === "right"
    ? { ...css.resizeHandle, ...css.resizeHandleLeft }
    : { ...css.resizeHandle, ...css.resizeHandleTop };

  return (
    <div style={{ ...css.shell, width: panelW, height: panelH,
      flexDirection: dockEdge === "bottom" ? "row" : "column" }}>

      {/* ── Resize handle ─────────────────────────────────────────────────── */}
      {!isCollapsed && (
        <div className="lar-hud-resize" style={resizeHandleStyle} onPointerDown={onResizePointerDown} />
      )}

      {/* ── Tab bar / icon strip ─────────────────────────────────────────── */}
      {isCollapsed ? (
        <button
          style={dockEdge === "bottom" ? css.iconStripH : css.iconStrip}
          onClick={cycleHud}
          title="Open wiki (⌘K)"
          aria-label="Open wiki panel"
        >
          <span style={css.stripIcon}>⬡</span>
          <span style={dockEdge === "bottom" ? css.stripPhaseH : css.stripPhase}>{phaseLabel}</span>
        </button>
      ) : (
        <div style={css.tabBar}>
          <span style={css.tabIcon}>⬡</span>
          <span style={css.tabTitle}>wiki</span>
          {crumbText && (
            <>
              <span style={css.crumbSep}>›</span>
              <span style={css.crumbText} title={breadcrumb ?? ""}>{crumbText}</span>
            </>
          )}
          <span style={css.tabPhase}>{phaseLabel}</span>
          <div style={css.tabActions}>
            <button
              style={css.iconBtn}
              title={hudState === "expanded" ? "Shrink (⌘K)" : "Expand (⌘K)"}
              onClick={() => { setHudState(hudState === "expanded" ? "sidebar" : "expanded"); setWikiOpen(true); }}
            >
              {dockEdge === "right"
                ? (hudState === "expanded" ? "◂" : "▸")
                : (hudState === "expanded" ? "▴" : "▾")}
            </button>
            <button
              style={css.iconBtn}
              title={dockEdge === "right" ? "Dock to bottom" : "Dock to right"}
              onClick={() => setDockEdge(dockEdge === "right" ? "bottom" : "right")}
            >
              {dockEdge === "right" ? "⬓" : "⬒"}
            </button>
            <button style={css.iconBtn} title="Collapse (Escape)" onClick={collapseHud}>✕</button>
          </div>
        </div>
      )}

      {/* ── TW5 mount surface ────────────────────────────────────────────── */}
      <div
        ref={tw5HostRef}
        style={isCollapsed ? css.tw5Hidden : css.tw5Live}
        aria-hidden={isCollapsed}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const css = {
  shell: {
    flexShrink:    0,
    display:       "flex",
    background:    "var(--tl-color-panel, #1e1e1e)",
    borderLeft:    "1px solid var(--tl-color-divider, #2a2a2a)",
    overflow:      "hidden",
    transition:    "width 150ms ease-in-out, height 150ms ease-in-out",
    position:      "relative" as const,
  } as React.CSSProperties,

  // Resize handle — 4px hit target on the leading edge
  resizeHandle: {
    flexShrink:  0,
    background:  "transparent",
    zIndex:      1,
    transition:  "background 100ms",
  } as React.CSSProperties,
  resizeHandleLeft: {
    width:  4,
    height: "100%",
    cursor: "col-resize",
  } as React.CSSProperties,
  resizeHandleTop: {
    height: 4,
    width:  "100%",
    cursor: "row-resize",
    borderTop: "2px solid transparent",
  } as React.CSSProperties,

  // Collapsed right-dock icon strip
  iconStrip: {
    width:          "100%",
    height:         "100%",
    display:        "flex",
    flexDirection:  "column" as const,
    alignItems:     "center",
    justifyContent: "center",
    gap:            8,
    background:     "transparent",
    border:         "none",
    cursor:         "pointer",
    padding:        0,
    color:          "var(--tl-color-text, #ccc)",
  } as React.CSSProperties,

  // Collapsed bottom-dock icon strip (horizontal)
  iconStripH: {
    width:          "100%",
    height:         "100%",
    display:        "flex",
    flexDirection:  "row" as const,
    alignItems:     "center",
    justifyContent: "center",
    gap:            8,
    background:     "transparent",
    border:         "none",
    cursor:         "pointer",
    padding:        0,
    color:          "var(--tl-color-text, #ccc)",
  } as React.CSSProperties,

  stripIcon: {
    fontSize:   18,
    color:      "var(--tl-color-primary, #7c9cce)",
    lineHeight: 1,
    fontFamily: "system-ui, sans-serif",
  },
  stripPhase: {
    fontSize:        9,
    fontFamily:      "var(--tl-font-mono, monospace)",
    color:           "var(--tl-color-text-3, #555)",
    writingMode:     "vertical-rl" as const,
    textOrientation: "mixed" as const,
    userSelect:      "none" as const,
    letterSpacing:   "0.08em",
  },
  stripPhaseH: {
    fontSize:      9,
    fontFamily:    "var(--tl-font-mono, monospace)",
    color:         "var(--tl-color-text-3, #555)",
    userSelect:    "none" as const,
    letterSpacing: "0.08em",
  },

  tabBar: {
    height:       36,
    flexShrink:   0,
    display:      "flex",
    alignItems:   "center",
    gap:          6,
    padding:      "0 8px",
    borderBottom: "1px solid var(--tl-color-divider, #2a2a2a)",
    userSelect:   "none" as const,
    overflow:     "hidden",
  },
  tabIcon: {
    fontSize:   15,
    color:      "var(--tl-color-primary, #7c9cce)",
    lineHeight: 1,
    fontFamily: "system-ui, sans-serif",
    flexShrink: 0,
  },
  tabTitle: {
    fontSize:      12,
    fontWeight:    600,
    color:         "var(--tl-color-text, #ccc)",
    fontFamily:    "var(--tl-font-mono, monospace)",
    letterSpacing: "0.05em",
    flexShrink:    0,
  },
  crumbSep: {
    color:      "var(--tl-color-text-3, #555)",
    fontSize:   12,
    flexShrink: 0,
  },
  crumbText: {
    flex:         1,
    fontSize:     11,
    fontFamily:   "var(--tl-font-mono, monospace)",
    color:        "var(--tl-color-text-1, #aaa)",
    overflow:     "hidden",
    textOverflow: "ellipsis",
    whiteSpace:   "nowrap" as const,
    minWidth:     0,
  },
  tabPhase: {
    fontSize:     10,
    color:        "var(--tl-color-text-3, #555)",
    fontFamily:   "var(--tl-font-mono, monospace)",
    padding:      "1px 5px",
    background:   "var(--tl-color-muted-1, #252525)",
    borderRadius: 3,
    flexShrink:   0,
  },
  tabActions: {
    display:    "flex",
    gap:        2,
    flexShrink: 0,
    marginLeft: "auto",
  },
  iconBtn: {
    background:   "transparent",
    border:       "none",
    color:        "var(--tl-color-text-3, #777)",
    cursor:       "pointer",
    padding:      "4px 6px",
    fontSize:     12,
    borderRadius: 4,
    lineHeight:   1,
    minWidth:     24,
    minHeight:    24,
  },

  tw5Live: {
    flex:      1,
    overflow:  "hidden",
    minHeight: 0,
    minWidth:  0,
  },
  tw5Hidden: {
    width:      0,
    height:     0,
    overflow:   "hidden",
    visibility: "hidden" as const,
  },
} as const;
