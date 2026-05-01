/**
 * BootSplash — boot progress overlay with shrine-light readiness panel.
 *
 * Renders as a fixed full-screen overlay during the boot sequence.
 * Disappears when phase reaches tw5-ready or live.
 * Shows ReadinessMap shrine-lights so the operator sees which doors have opened.
 *
 * Shrine-lights follow boot doctrine:
 *   auth → catalog → room-content → tw-vm → tldraw-doc
 *   presence and corpus lights appear as they arrive — never block content.
 */

import React from "react";
import type { LarariumOpenPhase, ReadinessKey } from "@lararium/core";
import { READINESS_KEYS, ReadinessMap } from "@lararium/core";

interface BootSplashProps {
  phase:     LarariumOpenPhase | null;
  readiness?: ReadinessMap;
}

export function BootSplash({ phase, readiness }: BootSplashProps): React.ReactElement | null {
  const [tick, setTick] = React.useState(0);

  // Re-render when any shrine-light changes.
  React.useEffect(() => {
    if (!readiness) return;
    return readiness.subscribe(() => setTick((t) => t + 1));
  }, [readiness]);

  // Suppress unused-var lint for tick — it exists only to trigger re-render.
  void tick;

  if (!phase) return <Overlay label="connecting…" readiness={readiness} />;

  switch (phase.kind) {
    case "host-opening":
    case "authority-opening":
      return <Overlay label="authority…" readiness={readiness} />;
    case "authority-ready":
    case "store-opening":
      return <Overlay label="catalog…" readiness={readiness} />;
    case "store-ready":
    case "tw5-opening":
      return <Overlay label="loading wiki…" readiness={readiness} />;
    case "tw5-hydrating":
      return <Overlay label="hydrating memes…" loaded={phase.loaded} total={phase.total} readiness={readiness} />;
    case "tw5-ready":
    case "live":
      return null;
    case "error":
      return <Overlay label={`error: ${phase.message}`} isError readiness={readiness} />;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// ShrinePanel — row of named shrine-lights from ReadinessMap
// ---------------------------------------------------------------------------

const BOOT_LIGHTS: ReadinessKey[] = ["auth", "catalog", "room-content", "tw-vm"];
const SECONDARY_LIGHTS: ReadinessKey[] = ["tldraw-doc", "room-presence", "snapshot"];

function ShrinePanel({ readiness }: { readiness: ReadinessMap }): React.ReactElement {
  // Collect any dynamic corpus/projection keys that have lit.
  const snap = readiness.snapshot();
  const dynamicLit = Object.keys(snap).filter(
    (k) => snap[k] && !READINESS_KEYS.includes(k as typeof READINESS_KEYS[number])
  ) as ReadinessKey[];

  return (
    <div style={css.shrinePanel}>
      <div style={css.shrineRow}>
        {BOOT_LIGHTS.map((k) => (
          <ShrineLight key={k} label={k} lit={readiness.get(k)} />
        ))}
      </div>
      {(SECONDARY_LIGHTS.some((k) => readiness.get(k)) || dynamicLit.length > 0) && (
        <div style={css.shrineRow}>
          {SECONDARY_LIGHTS.filter((k) => readiness.get(k)).map((k) => (
            <ShrineLight key={k} label={k} lit secondary />
          ))}
          {dynamicLit.slice(0, 4).map((k) => (
            <ShrineLight key={k} label={k} lit secondary />
          ))}
        </div>
      )}
    </div>
  );
}

function ShrineLight({ label, lit, secondary }: { label: string; lit: boolean; secondary?: boolean }): React.ReactElement {
  const shortLabel = label.replace("room-", "").replace("tldraw-", "tl:").replace("corpus:", "c:").replace("projection:", "p:");
  return (
    <div style={{ ...css.shrineLight, ...(lit ? css.shrineLit : {}), ...(secondary ? css.shrineLightSecondary : {}) }}>
      <span style={{ ...css.shrineDot, ...(lit ? css.shrineDotLit : {}) }} />
      <span style={css.shrineLabel}>{shortLabel}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overlay
// ---------------------------------------------------------------------------

interface OverlayProps {
  label:      string;
  loaded?:    number;
  total?:     number;
  isError?:   boolean;
  readiness?: ReadinessMap | undefined;
}

function Overlay({ label, loaded, total, isError, readiness }: OverlayProps): React.ReactElement {
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
        {readiness && <ShrinePanel readiness={readiness} />}
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
  barTrack: { width: "100%", height: 3, background: "#21262d", borderRadius: 2, overflow: "hidden" as const },
  barFill:  { height: "100%", background: "#238636", borderRadius: 2, transition: "width 80ms linear" },
  count:    { fontSize: 11, color: "#484f58", fontFamily: "monospace" },
  shrinePanel: { display: "flex", flexDirection: "column" as const, gap: 6, marginTop: 4, width: "100%" },
  shrineRow:   { display: "flex", gap: 8, justifyContent: "center" as const, flexWrap: "wrap" as const },
  shrineLight: {
    display:     "flex",
    alignItems:  "center",
    gap:         4,
    padding:     "2px 6px",
    borderRadius: 3,
    background:  "#0d1117",
    border:      "1px solid #21262d",
    opacity:     0.4,
    transition:  "opacity 200ms",
  },
  shrineLit:            { opacity: 1, border: "1px solid #238636" },
  shrineLightSecondary: { fontSize: 10 },
  shrineDot:    { width: 5, height: 5, borderRadius: "50%", background: "#484f58", display: "inline-block" as const, transition: "background 200ms" },
  shrineDotLit: { background: "#3fb950" },
  shrineLabel:  { fontSize: 10, color: "#8b949e", fontFamily: "monospace" },
} as const;
