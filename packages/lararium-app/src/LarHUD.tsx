/**
 * LarHUD — VSCode-style dockable TW5 wiki frame.
 *
 * Three panel states (cycles via ⌘K):
 *   collapsed  — tab chip on the right edge (44×120px); shows ⬡ icon + phase
 *   sidebar    — right-docked panel, ~340px wide; default on first open
 *   expanded   — right-docked panel, ~640px wide; full wiki chrome
 *
 * Dock edge: right (default). Future: bottom dock via drag-to-edge snap.
 * TW5 mount: shadow root stays live across all states (never unmounted).
 * Portal: renders into document.body; sits above TLDraw z-index.
 *
 * Keyboard:
 *   ⌘K / Ctrl+K  — cycle collapsed → sidebar → expanded → collapsed
 *   Escape        — collapse (capture-phase, only when focus inside shadow root)
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { useLararium } from "./lararium-context.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HudState = "collapsed" | "sidebar" | "expanded";

const STATE_CYCLE: HudState[] = ["collapsed", "sidebar", "expanded"];

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const CHIP_W       = 44;
const CHIP_H       = 120;
const SIDEBAR_W    = 340;
const EXPANDED_W   = 640;
const PANEL_H_PCT  = 100;   // vh — full height when docked right
const Z            = 8000;  // above tldraw (tldraw uses ~300–1000)

// ---------------------------------------------------------------------------
// LarHUD
// ---------------------------------------------------------------------------

export function LarHUD() {
  const { tw5, openPhase, wikiOpen, setWikiOpen } = useLararium();
  const tw5HostRef = useRef<HTMLDivElement>(null);
  const unmountRef = useRef<(() => void) | null>(null);

  // Derive hudState from wikiOpen + local expanded toggle
  const [hudState, setHudState] = useState<HudState>("collapsed");
  const hudStateRef = useRef<HudState>("collapsed");
  hudStateRef.current = hudState;

  // ── Sync wikiOpen → hudState ─────────────────────────────────────────────
  // wikiOpen true  → at least sidebar
  // wikiOpen false → collapsed
  useEffect(() => {
    if (!wikiOpen && hudState !== "collapsed") {
      setHudState("collapsed");
    } else if (wikiOpen && hudState === "collapsed") {
      setHudState("sidebar");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wikiOpen]);

  // Expose hudState changes back to shell's wikiOpen signal
  const cycleHud = useCallback(() => {
    const next = STATE_CYCLE[(STATE_CYCLE.indexOf(hudStateRef.current) + 1) % STATE_CYCLE.length]!;
    setHudState(next);
    setWikiOpen(next !== "collapsed");
  }, [setWikiOpen]);

  // Override ⌘K to cycle rather than toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault(); e.stopPropagation();
        cycleHud();
      }
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [cycleHud]);

  // ── TW5 shadow mount ─────────────────────────────────────────────────────
  useEffect(() => {
    const host = tw5HostRef.current;
    if (!tw5 || !host) return;
    if (unmountRef.current) return; // already mounted
    try {
      unmountRef.current = tw5.mountPanel(host);
    } catch {
      // boot() not yet resolved — will retry when tw5 ref updates
    }
    return () => {
      unmountRef.current?.();
      unmountRef.current = null;
    };
  }, [tw5]);

  // ── Escape → collapse ────────────────────────────────────────────────────
  useEffect(() => {
    if (hudState === "collapsed") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setHudState("collapsed"); setWikiOpen(false); }
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [hudState, setWikiOpen]);

  // ── TLDraw key passthrough guard ─────────────────────────────────────────
  // Block tldraw from intercepting keys typed inside the shadow root.
  useEffect(() => {
    const host = tw5HostRef.current;
    if (!host) return;
    const stop = (e: Event) => {
      const shadow = host.shadowRoot;
      if (shadow && shadow.contains(e.target as Node)) e.stopPropagation();
    };
    window.addEventListener("keydown", stop, { capture: true });
    window.addEventListener("keyup",   stop, { capture: true });
    return () => {
      window.removeEventListener("keydown", stop, { capture: true });
      window.removeEventListener("keyup",   stop, { capture: true });
    };
  }, []);

  const isCollapsed = hudState === "collapsed";
  const panelW = hudState === "expanded" ? EXPANDED_W : SIDEBAR_W;

  // Status label for the collapsed chip
  const phaseLabel = !openPhase        ? "—"
    : openPhase === "live"             ? "live"
    : openPhase === "tw5-booted"       ? "ready"
    : openPhase === "peer-ready"       ? "peer"
    : openPhase === "room-ready"       ? "room"
    : openPhase === "catalog-ready"    ? "cat"
    : "boot";

  const hud = (
    <div
      style={isCollapsed ? css.chip : { ...css.panel, width: panelW }}
      onPointerDown={(e) => { if (isCollapsed) { e.stopPropagation(); cycleHud(); } }}
      aria-label={isCollapsed ? "Open wiki HUD (⌘K)" : undefined}
      role={isCollapsed ? "button" : undefined}
    >
      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div style={css.tabBar}>
        <span style={css.tabIcon}>⬡</span>
        {!isCollapsed && <span style={css.tabTitle}>wiki</span>}
        {!isCollapsed && (
          <span style={css.tabPhase}>{phaseLabel}</span>
        )}
        {!isCollapsed && (
          <div style={css.tabActions}>
            <button
              style={css.iconBtn}
              onClick={() => setHudState(hudState === "expanded" ? "sidebar" : "expanded")}
              title={hudState === "expanded" ? "Shrink to sidebar" : "Expand panel"}
            >
              {hudState === "expanded" ? "◂" : "▸"}
            </button>
            <button
              style={css.iconBtn}
              onClick={() => { setHudState("collapsed"); setWikiOpen(false); }}
              title="Collapse (Escape)"
            >
              ✕
            </button>
          </div>
        )}
        {isCollapsed && <span style={css.chipPhase}>{phaseLabel}</span>}
      </div>

      {/* ── TW5 mount surface ───────────────────────────────────────────── */}
      <div
        ref={tw5HostRef}
        style={isCollapsed ? css.tw5HostHidden : css.tw5Host}
        aria-hidden={isCollapsed}
      />
    </div>
  );

  return createPortal(hud, document.body);
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const shared = {
  position:   "fixed" as const,
  top:        0,
  right:      0,
  zIndex:     Z,
  fontFamily: "var(--tl-font-sans, system-ui, sans-serif)",
};

const css = {
  // Collapsed chip — vertical tab on right edge
  chip: {
    ...shared,
    top:            "50%",
    transform:      "translateY(-50%)",
    width:          CHIP_W,
    height:         CHIP_H,
    background:     "var(--tl-color-panel, #1e1e1e)",
    border:         "1px solid var(--tl-color-divider, #333)",
    borderRight:    "none",
    borderRadius:   "6px 0 0 6px",
    display:        "flex",
    flexDirection:  "column" as const,
    alignItems:     "center",
    justifyContent: "center",
    gap:            6,
    cursor:         "pointer",
    userSelect:     "none" as const,
    boxShadow:      "-2px 0 8px rgba(0,0,0,.35)",
    transition:     "background 120ms",
  },

  // Open panel — full height right dock
  panel: {
    ...shared,
    height:         `${PANEL_H_PCT}dvh`,
    background:     "var(--tl-color-panel, #1e1e1e)",
    borderLeft:     "1px solid var(--tl-color-divider, #333)",
    display:        "flex",
    flexDirection:  "column" as const,
    boxShadow:      "-4px 0 16px rgba(0,0,0,.45)",
    transition:     "width 160ms cubic-bezier(.4,0,.2,1)",
    overflow:       "hidden",
  },

  // Tab bar — top strip with title + actions
  tabBar: {
    display:        "flex",
    alignItems:     "center",
    gap:            6,
    padding:        "0 8px",
    height:         36,
    borderBottom:   "1px solid var(--tl-color-divider, #333)",
    flexShrink:     0,
    userSelect:     "none" as const,
  },

  tabIcon: {
    fontSize:   16,
    color:      "var(--tl-color-primary, #7c9cce)",
    lineHeight: 1,
  },
  tabTitle: {
    fontSize:   12,
    fontWeight: 600,
    color:      "var(--tl-color-text, #ccc)",
    flexGrow:   1,
    letterSpacing: "0.05em",
    fontFamily: "var(--tl-font-mono, monospace)",
  },
  tabPhase: {
    fontSize:   10,
    color:      "var(--tl-color-text-3, #666)",
    fontFamily: "var(--tl-font-mono, monospace)",
    padding:    "1px 5px",
    background: "var(--tl-color-muted-1, #2a2a2a)",
    borderRadius: 3,
  },
  chipPhase: {
    fontSize:   9,
    color:      "var(--tl-color-text-3, #666)",
    fontFamily: "var(--tl-font-mono, monospace)",
    writingMode: "vertical-rl" as const,
    textOrientation: "mixed" as const,
  },
  tabActions: {
    display: "flex",
    gap:     2,
  },
  iconBtn: {
    background: "transparent",
    border:     "none",
    color:      "var(--tl-color-text-3, #888)",
    cursor:     "pointer",
    padding:    "4px 6px",
    fontSize:   13,
    borderRadius: 4,
    lineHeight: 1,
  },

  // TW5 mount — hidden in chip, full height in panel
  tw5Host: {
    flex:       1,
    overflow:   "hidden",
    minHeight:  0,
  },
  tw5HostHidden: {
    width:      0,
    height:     0,
    overflow:   "hidden",
    visibility: "hidden" as const,
  },
} as const;
