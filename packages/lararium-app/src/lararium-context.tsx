/**
 * LarariumContext — shared state + tldraw slot components.
 *
 * Pattern: slot components (TopPanel, SharePanel, HelperButtons) must be stable
 * module-level references so tldraw doesn't remount them on every render.
 * They read state via React context rather than props.
 *
 * Provider lives in LarariumShell. Consumers live here and in LarariumCanvas.
 */

import { createContext, useContext, useState, useCallback } from "react";
import type { Editor } from "tldraw";
import type { LarViewState, LarViewAction, ZoomLevel } from "@lararium/tldraw";
import { DEFAULT_ROOMS, ROOM_SYSTEM } from "@lararium/tldraw";
import type { LarariumOpenPhase, ReactionGraph } from "@lararium/core";
import type { LarariumTW5 } from "@lararium/tw5";
import type { AutomergeMemeStore } from "./automerge-store.js";
import type { MemeEntry } from "./App.js";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

export type LarTheme = "system" | "gruvbox-dark" | "gruvbox-light";

const THEME_CYCLE: LarTheme[] = ["system", "gruvbox-dark", "gruvbox-light"];
const THEME_GLYPH: Record<LarTheme, string> = {
  "system":        "◑",
  "gruvbox-dark":  "🌑",
  "gruvbox-light": "☀",
};
const THEME_LABEL: Record<LarTheme, string> = {
  "system":        "System",
  "gruvbox-dark":  "Gruvbox Dark",
  "gruvbox-light": "Gruvbox Light",
};

const STORAGE_KEY = "lararium.theme";

function readStoredTheme(): LarTheme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "gruvbox-dark" || v === "gruvbox-light" || v === "system") return v;
  } catch {}
  return "gruvbox-dark";
}

function applyTheme(theme: LarTheme) {
  document.documentElement.dataset.theme = theme;
}

export function useTheme(): [LarTheme, () => void] {
  const [theme, setTheme] = useState<LarTheme>(() => {
    const t = readStoredTheme();
    applyTheme(t);
    return t;
  });

  const cycle = useCallback(() => {
    setTheme((current) => {
      const next = THEME_CYCLE[(THEME_CYCLE.indexOf(current) + 1) % THEME_CYCLE.length]!;
      applyTheme(next);
      try { localStorage.setItem(STORAGE_KEY, next); } catch {}
      return next;
    });
  }, []);

  return [theme, cycle];
}

export { THEME_GLYPH, THEME_LABEL };

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface LarariumCtxValue {
  navState:       LarViewState;
  dispatch:       React.Dispatch<LarViewAction>;
  memes:          MemeEntry[];
  paletteOpen:    boolean;
  setPaletteOpen: React.Dispatch<React.SetStateAction<boolean>>;
  canvasMode:     boolean;
  setCanvasMode:  React.Dispatch<React.SetStateAction<boolean>>;
  zoomLevel:      ZoomLevel;
  theme:          LarTheme;
  cycleTheme:     () => void;
  /** Live tldraw editor — set by LarariumCanvas on mount, null before sync. */
  editor:         Editor | null;
  setEditor:      (editor: Editor | null) => void;
  /** Current opening phase — null before host open begins. */
  openPhase:      LarariumOpenPhase | null;
  /** Automerge-backed meme store — null until store-ready phase. */
  tiddlerStore:   AutomergeMemeStore | null;
  /** Booted TW5 instance — null until tw5-ready phase. */
  tw5:            LarariumTW5 | null;
  /** Boot receipt from authority phase. */
  hostReceipt:    string | null;
  /** Reaction graph built from Automerge store — null until store-ready + scan complete. */
  reactionGraph:  ReactionGraph | null;
  /** Fire a reaction trigger — sends LiveMsgFire over the room WS. */
  fireMeme:       (fromUri: string, trigger: string, payload?: unknown) => void;
}

export const LarariumCtx = createContext<LarariumCtxValue | null>(null);

export function useLararium(): LarariumCtxValue {
  const ctx = useContext(LarariumCtx);
  if (!ctx) throw new Error("useLararium used outside LarariumCtx.Provider");
  return ctx;
}

// ---------------------------------------------------------------------------
// Utilities (shared between slot components and shell)
// ---------------------------------------------------------------------------

export function shortUri(uri: string): string {
  return uri
    .replace("lar:///", "")
    .replace(/^ha\.ka\.ba\/api\/v0\.1\//, "")
    .replace(/\//g, " / ");
}

const ROOM_NAME: Record<string, string> = Object.fromEntries(
  DEFAULT_ROOMS.map((r) => [r.id, r.name])
);

export function activeRoomName(navState: LarViewState): string {
  if (navState.activeView === "room" && navState.focusUri)
    return ROOM_NAME[navState.focusUri] ?? navState.focusUri;
  if (navState.activeView === "graph") return ROOM_NAME["graph"] ?? "Graph Overview";
  return ROOM_NAME[ROOM_SYSTEM.id] ?? "System View";
}

export const ZOOM_GLYPH: Record<ZoomLevel, string> = {
  strategic:   "🗺️",
  operational: "⚙️",
  tactical:    "🔍",
  combat:      "⚔️",
  action:      "⚡",
};

// ---------------------------------------------------------------------------
// Shared slot button style (uses tldraw CSS variables — renders inside .tl-container)
// ---------------------------------------------------------------------------

const slotBtn: React.CSSProperties = {
  display:        "flex",
  alignItems:     "center",
  justifyContent: "center",
  minHeight:      32,
  padding:        "0 10px",
  background:     "var(--tl-color-panel)",
  color:          "var(--tl-color-text)",
  border:         "1px solid var(--tl-color-divider)",
  borderRadius:   "var(--tl-radius-2)",
  cursor:         "pointer",
  fontSize:       13,
  // system-ui so emoji + special glyphs (⬡, 🔍 etc.) render correctly —
  // tldraw's custom --tl-font-sans lacks these characters
  fontFamily:     "system-ui, sans-serif",
  whiteSpace:     "nowrap",
};

const slotBtnAccent: React.CSSProperties = {
  ...slotBtn,
  color:      "var(--tl-color-primary)",
  fontFamily: "monospace, system-ui",
  fontWeight: 700,
};


// MenuPanel: room label + live status — top-left, always visible in both modes.
// Replaces the separate footer; NavigationPanel owns the bottom zone.
export function LarariumMenuPanel() {
  const { navState, memes, zoomLevel } = useLararium();

  return (
    <div style={menuPanelWrap}>
      <span style={logoSpan}>⬡</span>
      <span style={roomNameSpan}>{activeRoomName(navState)}</span>

      {navState.activeView === "meme-detail" && navState.focusUri && (
        <>
          <span style={sepSpan}>›</span>
          <span style={crumbSpan}>{shortUri(navState.focusUri)}</span>
        </>
      )}

      <span style={menuDivider} />

      <span style={menuStatusSpan} title={`Zoom: ${zoomLevel}`}>
        {ZOOM_GLYPH[zoomLevel]}
      </span>
      <span style={menuStatusSpan}>
        {memes.length || "—"} memes
      </span>
      <span style={menuBadgeSpan}>{navState.activeView}</span>
    </div>
  );
}

const menuDivider: React.CSSProperties = {
  width:           1,
  alignSelf:       "stretch",
  background:      "var(--tl-color-divider)",
  margin:          "0 4px",
  flexShrink:      0,
};

const menuStatusSpan: React.CSSProperties = {
  fontSize:   11,
  color:      "var(--tl-color-text-3)",
  fontFamily: "system-ui, sans-serif",
  userSelect: "none",
  whiteSpace: "nowrap",
};

const menuBadgeSpan: React.CSSProperties = {
  fontSize:     10,
  fontFamily:   "monospace, system-ui",
  color:        "var(--tl-color-primary)",
  background:   "var(--tl-color-muted-1)",
  borderRadius: "var(--tl-radius-1)",
  padding:      "1px 5px",
  userSelect:   "none",
  whiteSpace:   "nowrap",
};

const menuPanelWrap: React.CSSProperties = {
  display:       "flex",
  alignItems:    "center",
  gap:           8,
  padding:       "4px 10px",
  background:    "var(--tl-color-panel)",
  border:        "1px solid var(--tl-color-divider)",
  borderRadius:  "var(--tl-radius-2)",
  boxShadow:     "var(--tl-shadow-1)",
  whiteSpace:    "nowrap",
};

const logoSpan: React.CSSProperties = {
  fontSize:   16,
  color:      "var(--tl-color-primary)",
  lineHeight: 1,
  fontFamily: "system-ui, sans-serif",
};

const roomNameSpan: React.CSSProperties = {
  fontSize:   13,
  fontFamily: "var(--tl-font-mono)",
  color:      "var(--tl-color-text)",
  fontWeight: 600,
  userSelect: "none",
};

const sepSpan: React.CSSProperties = {
  color:      "var(--tl-color-text-3)",
  fontSize:   13,
  userSelect: "none",
};

const crumbSpan: React.CSSProperties = {
  fontSize:     12,
  fontFamily:   "var(--tl-font-mono)",
  color:        "var(--tl-color-text-1)",
  overflow:     "hidden",
  textOverflow: "ellipsis",
  whiteSpace:   "nowrap",
  maxWidth:     200,
  userSelect:   "none",
};


// ---------------------------------------------------------------------------
// LarariumSharePanel — ⌘K trigger + (future) theme toggle   (tldraw SharePanel slot)
// ---------------------------------------------------------------------------

export function LarariumSharePanel() {
  const { setPaletteOpen, theme, cycleTheme } = useLararium();

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 4px" }}>
      <button
        style={slotBtn}
        onClick={cycleTheme}
        aria-label={`Theme: ${THEME_LABEL[theme]} — click to cycle`}
        title={`Theme: ${THEME_LABEL[theme]}`}
      >
        {THEME_GLYPH[theme]}
      </button>
      <button
        style={slotBtnAccent}
        onClick={() => setPaletteOpen(true)}
        aria-label="Open command palette (⌘K)"
        title="⌘K"
      >
        ⌘K
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LarariumHelperButtons — canvas mode toggle + zoom glyph   (tldraw HelperButtons slot)
// ---------------------------------------------------------------------------

// HelperButtons: horizontal row at bottom-right.
// Holds Back, Graph toggle, canvas mode toggle, zoom glyph — all in one stable row.
// In wiki mode this row is the only interactive chrome visible. In canvas mode
// tldraw's toolbar appears above/beside it; the row stays put.
export function LarariumHelperButtons() {
  const { navState, dispatch, canvasMode, setCanvasMode, zoomLevel } = useLararium();
  const isGraph = navState.activeView === "graph";

  return (
    <div style={helperRow}>
      {navState.history.length > 0 && (
        <button
          style={slotBtn}
          onClick={() => dispatch({ type: "NAVIGATE_BACK" })}
          aria-label="Navigate back"
        >
          ← Back
        </button>
      )}

      <button
        style={slotBtn}
        onClick={() => dispatch({ type: isGraph ? "CLOSE_GRAPH" : "OPEN_GRAPH" })}
        aria-label={isGraph ? "Close graph view" : "Open graph view"}
      >
        {isGraph ? "✕ Graph" : "⬡ Graph"}
      </button>

      <button
        style={{
          ...slotBtn,
          ...(canvasMode ? { color: "var(--tl-color-primary)", borderColor: "var(--tl-color-primary)" } : {}),
        }}
        onClick={() => setCanvasMode((v) => !v)}
        aria-pressed={canvasMode}
        title="` — toggle canvas mode"
      >
        {canvasMode ? "✏ Canvas" : "Wiki"}
      </button>

      <span
        style={{ fontSize: 16, lineHeight: 1, userSelect: "none", cursor: "default", padding: "0 4px", fontFamily: "system-ui, sans-serif" }}
        title={`Zoom: ${zoomLevel}`}
      >
        {ZOOM_GLYPH[zoomLevel]}
      </span>
    </div>
  );
}

const helperRow: React.CSSProperties = {
  display:    "flex",
  flexDirection: "row",
  alignItems: "center",
  gap:        6,
  padding:    "0 4px 4px",
};
