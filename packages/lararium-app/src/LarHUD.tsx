/**
 * LarHUD — right-docked TW5 wiki panel, VSCode activity-bar model.
 *
 * Architecture: flex sibling of LarariumCanvas (NOT a portal).
 * The canvas container shrinks when the panel opens — push model, no z-index wars.
 *
 * Three states (⌘K cycles, Escape collapses):
 *   collapsed  — 44px icon strip on right edge; always visible
 *   sidebar    — 340px push panel; default on first open
 *   expanded   — 640px push panel; full wiki chrome
 *
 * TW5 mount: shadow root lives on tw5HostRef.current via tw5.mountPanel().
 * The shadow root is never destroyed — it stays live across all state transitions
 * (same pattern as VSCode webviews staying alive when sidebar collapses).
 *
 * Push vs overlay: above PUSH_BREAKPOINT_PX container width → push (shrinks canvas).
 * Below → overlay (fixed-position, right:0, does not shrink canvas). Future work.
 *
 * CSS transition: width 150ms ease on panel div. No spring. No layout thrash.
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { useLararium } from "./lararium-context.js";

// ---------------------------------------------------------------------------
// Types + constants
// ---------------------------------------------------------------------------

export type HudState = "collapsed" | "sidebar" | "expanded";

const STATE_CYCLE: HudState[] = ["collapsed", "sidebar", "expanded"];

const STRIP_W    = 44;   // px — collapsed icon strip
const SIDEBAR_W  = 340;  // px — default open width
const EXPANDED_W = 640;  // px — full wiki width

// ---------------------------------------------------------------------------
// LarHUD
// ---------------------------------------------------------------------------

export function LarHUD() {
  const { tw5, openPhase, wikiOpen, setWikiOpen } = useLararium();
  const tw5HostRef   = useRef<HTMLDivElement>(null);
  const unmountRef   = useRef<(() => void) | null>(null);
  const [hudState, setHudState] = useState<HudState>("collapsed");
  const hudRef = useRef<HudState>("collapsed");
  hudRef.current = hudState;

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

  // ── ⌘K capture — cycles states (overrides LarariumShell toggle) ──────────
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

  // ── Block tldraw from intercepting keys typed inside the shadow root ───────
  useEffect(() => {
    const host = tw5HostRef.current;
    if (!host) return;
    const guard = (e: Event) => {
      const shadow = host.shadowRoot;
      if (shadow?.contains(e.target as Node)) e.stopPropagation();
    };
    window.addEventListener("keydown", guard, { capture: true });
    window.addEventListener("keyup",   guard, { capture: true });
    return () => {
      window.removeEventListener("keydown", guard, { capture: true });
      window.removeEventListener("keyup",   guard, { capture: true });
    };
  }, []);

  // ── TW5 shadow mount — boot once, stay live ───────────────────────────────
  useEffect(() => {
    const host = tw5HostRef.current;
    if (!tw5 || !host || unmountRef.current) return;
    try {
      unmountRef.current = tw5.mountPanel(host);
    } catch {
      // tw5.boot() not yet resolved — will retry when tw5 ref updates
    }
    return () => { unmountRef.current?.(); unmountRef.current = null; };
  }, [tw5]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const isCollapsed = hudState === "collapsed";
  const panelWidth  = hudState === "expanded" ? EXPANDED_W
    : hudState === "sidebar"                  ? SIDEBAR_W
    :                                           STRIP_W;

  const phaseLabel = !openPhase ? "—"
    : openPhase === "live"         ? "live"
    : openPhase === "tw5-booted"   ? "ready"
    : openPhase === "peer-ready"   ? "peer"
    : openPhase === "room-ready"   ? "room"
    : openPhase === "catalog-ready"? "cat"
    :                                "boot";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ ...css.shell, width: panelWidth }}>

      {/* ── Tab bar / icon strip ─────────────────────────────────────────── */}
      {isCollapsed ? (
        <button
          style={css.iconStrip}
          onClick={cycleHud}
          title="Open wiki (⌘K)"
          aria-label="Open wiki panel"
        >
          <span style={css.stripIcon}>⬡</span>
          <span style={css.stripPhase}>{phaseLabel}</span>
        </button>
      ) : (
        <div style={css.tabBar}>
          <span style={css.tabIcon}>⬡</span>
          <span style={css.tabTitle}>wiki</span>
          <span style={css.tabPhase}>{phaseLabel}</span>
          <div style={css.tabActions}>
            <button
              style={css.iconBtn}
              title={hudState === "expanded" ? "Shrink to sidebar (⌘K)" : "Expand (⌘K)"}
              onClick={() => {
                const next = hudState === "expanded" ? "sidebar" : "expanded";
                setHudState(next); setWikiOpen(true);
              }}
            >
              {hudState === "expanded" ? "◂" : "▸"}
            </button>
            <button style={css.iconBtn} title="Collapse (Escape)" onClick={collapseHud}>
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── TW5 mount surface — always present, hidden when collapsed ────── */}
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
  // Outer shell — this div is the flex child; width drives push behavior
  shell: {
    flexShrink:    0,
    height:        "100%",
    display:       "flex",
    flexDirection: "column" as const,
    background:    "var(--tl-color-panel, #1e1e1e)",
    borderLeft:    "1px solid var(--tl-color-divider, #2a2a2a)",
    overflow:      "hidden",
    transition:    "width 150ms ease-in-out",
    // Ensure correct stacking without relying on z-index
    position:      "relative" as const,
  },

  // Collapsed icon strip — full height, 44px wide, acts as the tab
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
  },
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

  // Open tab bar
  tabBar: {
    height:       36,
    flexShrink:   0,
    display:      "flex",
    alignItems:   "center",
    gap:          6,
    padding:      "0 8px",
    borderBottom: "1px solid var(--tl-color-divider, #2a2a2a)",
    userSelect:   "none" as const,
  },
  tabIcon: {
    fontSize:   15,
    color:      "var(--tl-color-primary, #7c9cce)",
    lineHeight: 1,
    fontFamily: "system-ui, sans-serif",
    flexShrink: 0,
  },
  tabTitle: {
    flex:          1,
    fontSize:      12,
    fontWeight:    600,
    color:         "var(--tl-color-text, #ccc)",
    fontFamily:    "var(--tl-font-mono, monospace)",
    letterSpacing: "0.05em",
    overflow:      "hidden",
    whiteSpace:    "nowrap" as const,
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

  // TW5 mount surface — flex:1 when live, zero when hidden
  tw5Live: {
    flex:     1,
    overflow: "hidden",
    minHeight: 0,
  },
  tw5Hidden: {
    width:      0,
    height:     0,
    overflow:   "hidden",
    visibility: "hidden" as const,
  },
} as const;
