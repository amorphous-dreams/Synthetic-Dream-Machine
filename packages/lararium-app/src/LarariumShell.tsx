/**
 * LarariumShell — Kinopio-style chrome that wraps tldraw without overlaying it.
 *
 * Architecture:
 *   - <LarariumCanvas> fills 100vw × 100vh with tldraw chrome suppressed
 *   - All Lararium UI is position:fixed siblings rendered via React.createPortal
 *   - Header: pointer-events:none shell, pointer-events:auto on interactive children
 *   - Footer: status bar, zoom level, trust tier badge
 *   - CommandPalette: ⌘K overlay (room + meme navigation)
 *   - MemeDetail: slides up from bottom on double-click
 *
 * Platform targets: Windows 11 / Ubuntu WSL (mouse+kb), Android Samsung (touch).
 * All tap targets ≥ 44×44px. No hover-only affordances.
 */

import { useReducer, useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { INITIAL_VIEW_STATE, viewStateReducer } from "@lararium/tldraw";
import type { LarViewAction, LarViewState } from "@lararium/tldraw";
import { LarariumCanvas } from "./LarariumCanvas.js";
import type { MemeEntry } from "./App.js";

interface ShellProps {
  wsUrl: string;
  memes: MemeEntry[];
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function LarariumHeader({
  memes,
  navState,
  dispatch,
  onPalette,
}: {
  memes: MemeEntry[];
  navState: LarViewState;
  dispatch: React.Dispatch<LarViewAction>;
  onPalette: () => void;
}) {
  const isGraph = navState.activeView === "graph";
  return (
    <div style={css.header} aria-label="Lararium header">
      {/* left: logo */}
      <div style={css.headerLeft}>
        <span style={css.logo}>⬡ Lararium</span>
      </div>

      {/* center: room breadcrumb */}
      <div style={css.headerCenter}>
        <span style={css.roomName}>the-altar-fire</span>
        {navState.focusUri && (
          <>
            <span style={css.breadcrumbSep}>›</span>
            <span style={css.focusCrumb}>{shortUri(navState.focusUri)}</span>
          </>
        )}
      </div>

      {/* right: nav actions + palette */}
      <div style={css.headerRight}>
        {navState.history.length > 0 && (
          <button
            style={css.headerBtn}
            onClick={() => dispatch({ type: "NAVIGATE_BACK" })}
            aria-label="Navigate back"
          >
            ← Back
          </button>
        )}
        <button
          style={css.headerBtn}
          onClick={() => dispatch({ type: isGraph ? "CLOSE_GRAPH" : "OPEN_GRAPH" })}
          aria-label={isGraph ? "Close graph" : "Open graph"}
        >
          {isGraph ? "✕ Graph" : "⬡ Graph"}
        </button>
        <button
          style={{ ...css.headerBtn, ...css.paletteBtn }}
          onClick={onPalette}
          aria-label="Open command palette (⌘K)"
          title="⌘K"
        >
          ⌘K
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Footer / status bar
// ---------------------------------------------------------------------------

function LarariumFooter({ memes, navState }: { memes: MemeEntry[]; navState: LarViewState }) {
  return (
    <div style={css.footer} role="status" aria-label="Canvas status">
      <span style={css.footerItem}>{memes.length || "—"} memes</span>
      <span style={css.viewBadge}>{navState.activeView}</span>
      {navState.focusUri && (
        <span style={css.footerUri}>{navState.focusUri.replace("lar:///", "")}</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Command palette  (⌘K)
// ---------------------------------------------------------------------------

function LarariumCommandPalette({
  memes,
  dispatch,
  onClose,
}: {
  memes: MemeEntry[];
  dispatch: React.Dispatch<LarViewAction>;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const filtered = query
    ? memes.filter((m) => m.uri.toLowerCase().includes(query.toLowerCase()))
    : memes;

  const select = useCallback(
    (uri: string) => { dispatch({ type: "ZOOM_IN", uri }); onClose(); },
    [dispatch, onClose]
  );

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") { setCursor((c) => Math.min(c + 1, filtered.length - 1)); return; }
    if (e.key === "ArrowUp") { setCursor((c) => Math.max(c - 1, 0)); return; }
    if (e.key === "Enter" && filtered[cursor]) { select(filtered[cursor]!.uri); return; }
  };

  return (
    <div style={css.paletteBackdrop} onClick={onClose} aria-modal="true" role="dialog">
      <div style={css.palette} onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          style={css.paletteInput}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
          onKeyDown={onKey}
          placeholder="Jump to meme…"
          aria-label="Search memes"
          autoComplete="off"
          spellCheck={false}
        />
        <div style={css.paletteList} role="listbox">
          {filtered.slice(0, 12).map((m, i) => (
            <button
              key={m.uri}
              role="option"
              aria-selected={i === cursor}
              style={{
                ...css.paletteItem,
                ...(i === cursor ? css.paletteItemActive : {}),
              }}
              onClick={() => select(m.uri)}
              onMouseEnter={() => setCursor(i)}
            >
              <span style={{ ...css.depthBar, width: 4 + m.depth * 6 }} />
              <span style={css.paletteItemLabel}>{shortUri(m.uri)}</span>
              <span style={css.paletteItemKind}>{m.kind}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div style={css.paletteEmpty}>No memes match "{query}"</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shell root
// ---------------------------------------------------------------------------

export function LarariumShell({ wsUrl, memes }: ShellProps) {
  const [navState, dispatch] = useReducer(viewStateReducer, INITIAL_VIEW_STATE);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // ⌘K / Ctrl+K global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (e.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const chromeRoot = document.body;

  return (
    <div style={css.shellRoot}>
      {/* tldraw fills entire shell — chrome suppressed, TopPanel injected inside */}
      <LarariumCanvas
        wsUrl={wsUrl}
        navState={navState}
        dispatch={dispatch as React.Dispatch<LarViewAction>}
      />

      {/* Fixed chrome rendered outside tldraw DOM tree */}
      {createPortal(
        <>
          <LarariumHeader
            memes={memes}
            navState={navState}
            dispatch={dispatch as React.Dispatch<LarViewAction>}
            onPalette={() => setPaletteOpen(true)}
          />
          <LarariumFooter memes={memes} navState={navState} />
          {paletteOpen && (
            <LarariumCommandPalette
              memes={memes}
              dispatch={dispatch as React.Dispatch<LarViewAction>}
              onClose={() => setPaletteOpen(false)}
            />
          )}
        </>,
        chromeRoot
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function shortUri(uri: string): string {
  return uri.replace("lar:///", "").replace(/^ha\.ka\.ba\/api\/v0\.1\//, "").replace(/\//g, " / ");
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const css = {
  shellRoot: {
    width: "100%",
    height: "100%",
    position: "relative" as const,
    overflow: "hidden",
  },

  // Header: fixed, thin, pointer-events:none shell with re-enabled children
  header: {
    position: "fixed" as const,
    top: 0,
    left: 0,
    right: 0,
    height: 44,
    zIndex: 600,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 12px",
    background: "rgba(13,13,15,0.75)",
    backdropFilter: "blur(12px)",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    pointerEvents: "none" as const,
  },
  headerLeft: { display: "flex", alignItems: "center", pointerEvents: "auto" as const },
  headerCenter: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    pointerEvents: "none" as const,
    flex: 1,
    justifyContent: "center",
    overflow: "hidden",
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    pointerEvents: "auto" as const,
  },
  logo: {
    fontSize: 14,
    fontWeight: 700,
    color: "#58a6ff",
    letterSpacing: "0.04em",
    userSelect: "none" as const,
  },
  roomName: {
    fontSize: 13,
    color: "#c9d1d9",
    fontFamily: "monospace",
    userSelect: "none" as const,
    whiteSpace: "nowrap" as const,
  },
  breadcrumbSep: { color: "#444d56", fontSize: 13, userSelect: "none" as const },
  focusCrumb: {
    fontSize: 12,
    color: "#8b949e",
    fontFamily: "monospace",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
    maxWidth: 200,
    userSelect: "none" as const,
  },
  headerBtn: {
    minWidth: 44,
    minHeight: 44,
    padding: "0 12px",
    background: "rgba(30,30,35,0.7)",
    color: "#c9d1d9",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  paletteBtn: {
    color: "#58a6ff",
    fontFamily: "monospace",
    fontWeight: 600,
    letterSpacing: "0.04em",
  },

  // Footer
  footer: {
    position: "fixed" as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: 32,
    zIndex: 600,
    display: "flex",
    gap: 16,
    alignItems: "center",
    padding: "0 14px",
    background: "rgba(13,13,15,0.75)",
    backdropFilter: "blur(8px)",
    borderTop: "1px solid rgba(255,255,255,0.06)",
    pointerEvents: "none" as const,
  },
  footerItem: { fontSize: 11, color: "#6e7681", userSelect: "none" as const },
  viewBadge: {
    padding: "2px 8px",
    background: "rgba(22,27,34,0.9)",
    borderRadius: 4,
    color: "#58a6ff",
    fontFamily: "monospace",
    fontSize: 11,
    userSelect: "none" as const,
  },
  footerUri: {
    color: "#8b949e",
    fontFamily: "monospace",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
    maxWidth: 400,
    fontSize: 11,
    userSelect: "none" as const,
  },

  // Command palette
  paletteBackdrop: {
    position: "fixed" as const,
    inset: 0,
    zIndex: 800,
    background: "rgba(0,0,0,0.55)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    paddingTop: 80,
  },
  palette: {
    width: "min(600px, 90vw)",
    background: "#161b22",
    border: "1px solid #30363d",
    borderRadius: 10,
    overflow: "hidden",
    boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
  },
  paletteInput: {
    display: "block",
    width: "100%",
    padding: "14px 16px",
    background: "transparent",
    border: "none",
    borderBottom: "1px solid #21262d",
    color: "#e6edf3",
    fontSize: 15,
    fontFamily: "system-ui, sans-serif",
    outline: "none",
    boxSizing: "border-box" as const,
  },
  paletteList: {
    maxHeight: 320,
    overflowY: "auto" as const,
  },
  paletteItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    minHeight: 44,
    padding: "8px 16px",
    background: "none",
    border: "none",
    color: "#c9d1d9",
    cursor: "pointer",
    fontSize: 13,
    fontFamily: "monospace",
    textAlign: "left" as const,
    transition: "background 0.08s",
  },
  paletteItemActive: {
    background: "#1f2937",
    color: "#58a6ff",
  },
  paletteItemLabel: {
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  paletteItemKind: {
    fontSize: 10,
    color: "#6e7681",
    padding: "2px 6px",
    border: "1px solid #21262d",
    borderRadius: 3,
    flexShrink: 0,
  },
  paletteEmpty: {
    padding: "20px 16px",
    color: "#6e7681",
    fontSize: 13,
    fontFamily: "monospace",
    textAlign: "center" as const,
  },
  depthBar: {
    display: "inline-block",
    height: 3,
    background: "#444d56",
    borderRadius: 2,
    flexShrink: 0,
  },
} as const;
