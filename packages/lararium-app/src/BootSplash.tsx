/**
 * BootSplash — boot progress overlay for the local-first peer boot sequence.
 *
 * Renders as a fixed full-screen overlay during BrowserOpenPhase boot.
 * Disappears when phase reaches "live".
 */

import React from "react";
import type { BrowserOpenPhase } from "./open-browser-lar-peer.js";

interface BootSplashProps {
  phase: BrowserOpenPhase | null;
}

export function BootSplash({ phase }: BootSplashProps): React.ReactElement | null {
  if (phase === "live") return null;
  if (!phase || phase === "boot" || phase === "repo-open") return <Overlay label="connecting…" />;
  if (phase === "catalog-ready") return <Overlay label="catalog…" />;
  if (phase === "room-ready" || phase === "peer-ready") return <Overlay label="loading wiki…" />;
  if (phase === "tw5-booted") return <Overlay label="booting engine…" />;
  return null;
}

// ---------------------------------------------------------------------------
// Overlay
// ---------------------------------------------------------------------------

interface OverlayProps {
  label:    string;
  isError?: boolean;
}

function Overlay({ label, isError }: OverlayProps): React.ReactElement {
  return (
    <div style={{ ...css.overlay, ...(isError ? css.overlayError : {}) }}>
      <div style={css.card}>
        <div style={css.sigil}>⏿</div>
        <div style={css.label}>{label}</div>
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
  overlayError: { background: "#1a0a0a" },
  card: {
    display:       "flex",
    flexDirection: "column" as const,
    alignItems:    "center",
    gap:           12,
    padding:       "32px 40px",
    background:    "#161b22",
    border:        "1px solid #21262d",
    borderRadius:  10,
    minWidth:      260,
  },
  sigil:  { fontSize: 28, lineHeight: 1, color: "#484f58" },
  label:  { fontSize: 13, color: "#8b949e", fontFamily: "monospace", letterSpacing: "0.04em" },
} as const;
