/**
 * BootSplash — boot progress overlay (tc-remove-when-wiki-loaded pattern).
 *
 * Renders as a fixed full-screen overlay during the boot sequence.
 * Automatically removes itself when phase reaches tw5-ready or live —
 * the React analogue of TW5's tc-remove-when-wiki-loaded class.
 *
 * Phases rendered:
 *   host-opening / authority-opening  → "connecting…"
 *   authority-ready / store-opening   → "opening store…"
 *   store-ready / tw5-opening         → "loading wiki…"
 *   tw5-hydrating                     → progress bar  (loaded / total memes)
 *   tw5-ready / live / null           → null (splash removed)
 *   error                             → error message
 */

import React from "react";
import type { LarariumOpenPhase } from "@lararium/core";

interface BootSplashProps {
  phase: LarariumOpenPhase | null;
}

export function BootSplash({ phase }: BootSplashProps): React.ReactElement | null {
  if (!phase) return <Overlay label="connecting…" />;

  switch (phase.kind) {
    case "host-opening":
    case "authority-opening":
      return <Overlay label="connecting…" />;
    case "authority-ready":
    case "store-opening":
      return <Overlay label="opening store…" />;
    case "store-ready":
    case "tw5-opening":
      return <Overlay label="loading wiki…" />;
    case "tw5-hydrating":
      return <Overlay label={`loading memes…`} loaded={phase.loaded} total={phase.total} />;
    case "tw5-ready":
    case "live":
      return null;
    case "error":
      return <Overlay label={`error: ${phase.message}`} isError />;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Internal overlay
// ---------------------------------------------------------------------------

interface OverlayProps {
  label:   string;
  loaded?: number;
  total?:  number;
  isError?: boolean;
}

function Overlay({ label, loaded, total, isError }: OverlayProps): React.ReactElement {
  const showBar = typeof loaded === "number" && typeof total === "number" && total > 0;
  const pct     = showBar ? Math.round((loaded! / total!) * 100) : 0;

  return (
    <div style={{ ...css.overlay, ...(isError ? css.overlayError : {}) }}>
      <div style={css.card}>
        <div style={css.sigil}>⏿</div>
        <div style={css.label}>{label}</div>
        {showBar && (
          <div style={css.barTrack}>
            <div style={{ ...css.barFill, width: `${pct}%` }} />
          </div>
        )}
        {showBar && (
          <div style={css.count}>{loaded} / {total}</div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const css = {
  overlay: {
    position:       "fixed"  as const,
    inset:          0,
    zIndex:         9999,
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    background:     "#0d1117",
  },
  overlayError: {
    background: "#1a0a0a",
  },
  card: {
    display:        "flex",
    flexDirection:  "column" as const,
    alignItems:     "center",
    gap:            12,
    padding:        "32px 40px",
    background:     "#161b22",
    border:         "1px solid #21262d",
    borderRadius:   10,
    minWidth:       240,
  },
  sigil: {
    fontSize:   28,
    lineHeight: 1,
    color:      "#484f58",
  },
  label: {
    fontSize:   13,
    color:      "#8b949e",
    fontFamily: "monospace",
    letterSpacing: "0.04em",
  },
  barTrack: {
    width:        "100%",
    height:       3,
    background:   "#21262d",
    borderRadius: 2,
    overflow:     "hidden" as const,
  },
  barFill: {
    height:       "100%",
    background:   "#238636",
    borderRadius: 2,
    transition:   "width 80ms linear",
  },
  count: {
    fontSize:   11,
    color:      "#484f58",
    fontFamily: "monospace",
  },
} as const;
