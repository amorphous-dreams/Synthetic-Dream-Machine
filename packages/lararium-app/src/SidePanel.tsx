import { useState } from "react";
import type { MemeEntry } from "./App.js";
import type { LarViewState, LarViewAction } from "@lararium/tldraw";

interface Props {
  memes: MemeEntry[];
  navState: LarViewState;
  dispatch: React.Dispatch<LarViewAction>;
}

export function SidePanel({ memes, navState, dispatch }: Props) {
  const [storyOpen, setStoryOpen] = useState(true);
  const isGraphOpen = navState.activeView === "graph";

  const entries = memes;

  return (
    <>
      {/* ── Story River — left slide-in ─────────────────────────────────── */}
      <div style={{ ...styles.storyRiver, transform: storyOpen ? "translateX(0)" : "translateX(-100%)" }}>
        <div style={styles.storyHeader}>
          <span style={styles.storyTitle}>Story River</span>
          <button style={styles.collapseBtn} onClick={() => setStoryOpen(false)} aria-label="Collapse story river">
            ‹
          </button>
        </div>
        <div style={styles.storyList}>
          {entries.map((entry) => (
            <button
              key={entry.uri}
              style={{
                ...styles.memeRow,
                ...(navState.focusUri === entry.uri ? styles.memeRowActive : {}),
              }}
              onClick={() => dispatch({ type: "ZOOM_IN", uri: entry.uri })}
              title={entry.uri}
            >
              <span style={{ ...styles.depthDot, marginLeft: entry.depth * 8 }} />
              <span style={styles.memeLabel}>{uriLabel(entry.uri)}</span>
              {entry.kind === "caps-virtual" && <span style={styles.virtualBadge}>virtual</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ── Story River toggle (when collapsed) ────────────────────────── */}
      {!storyOpen && (
        <button style={styles.openStoryBtn} onClick={() => setStoryOpen(true)} aria-label="Open story river">
          ›
        </button>
      )}

      {/* ── Top-right toolbar ───────────────────────────────────────────── */}
      <div style={styles.toolbar}>
        {navState.history.length > 0 && (
          <button style={styles.toolBtn} onClick={() => dispatch({ type: "NAVIGATE_BACK" })}>
            ← Back
          </button>
        )}
        <button
          style={styles.toolBtn}
          onClick={() => dispatch({ type: isGraphOpen ? "CLOSE_GRAPH" : "OPEN_GRAPH" })}
        >
          {isGraphOpen ? "✕ Graph" : "⬡ Graph"}
        </button>
      </div>

      {/* ── Status bar ──────────────────────────────────────────────────── */}
      <div style={styles.statusBar}>
        <span>{memes.length || "—"} memes</span>
        <span style={styles.viewBadge}>{navState.activeView}</span>
        {navState.focusUri && (
          <span style={styles.focusUri}>{navState.focusUri.replace("lar:///", "")}</span>
        )}
      </div>
    </>
  );
}

function uriLabel(uri: string): string {
  return uri.replace("lar:///", "").replace(/\//g, " / ");
}

const styles = {
  storyRiver: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    bottom: 32,
    width: 260,
    zIndex: 500,
    background: "rgba(18,18,20,0.92)",
    borderRight: "1px solid #2d333b",
    display: "flex",
    flexDirection: "column" as const,
    backdropFilter: "blur(8px)",
    transition: "transform 0.2s ease",
  },
  storyHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 12px 8px",
    borderBottom: "1px solid #2d333b",
    flexShrink: 0,
  },
  storyTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: "#8b949e",
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
  },
  collapseBtn: {
    background: "none",
    border: "none",
    color: "#8b949e",
    cursor: "pointer",
    fontSize: 18,
    padding: "0 4px",
    lineHeight: 1,
  },
  storyList: {
    flex: 1,
    overflowY: "auto" as const,
    padding: "4px 0",
  },
  memeRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    width: "100%",
    padding: "5px 12px",
    background: "none",
    border: "none",
    color: "#c9d1d9",
    cursor: "pointer",
    fontSize: 12,
    textAlign: "left" as const,
    fontFamily: "monospace",
    transition: "background 0.1s",
    "&:hover": { background: "#1c2128" },
  },
  memeRowActive: {
    background: "#1c2128",
    color: "#58a6ff",
  },
  depthDot: {
    display: "inline-block",
    width: 4,
    height: 4,
    borderRadius: 2,
    background: "#444d56",
    flexShrink: 0,
  },
  memeLabel: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
    flex: 1,
  },
  virtualBadge: {
    fontSize: 10,
    color: "#6e7681",
    padding: "1px 4px",
    border: "1px solid #2d333b",
    borderRadius: 3,
    flexShrink: 0,
  },
  openStoryBtn: {
    position: "absolute" as const,
    top: "50%",
    left: 0,
    transform: "translateY(-50%)",
    zIndex: 500,
    background: "rgba(18,18,20,0.85)",
    border: "1px solid #2d333b",
    borderLeft: "none",
    borderRadius: "0 4px 4px 0",
    color: "#8b949e",
    cursor: "pointer",
    fontSize: 18,
    padding: "12px 6px",
    lineHeight: 1,
    backdropFilter: "blur(4px)",
  },
  toolbar: {
    position: "absolute" as const,
    top: 12,
    right: 12,
    zIndex: 500,
    display: "flex",
    gap: 8,
  },
  toolBtn: {
    padding: "6px 12px",
    background: "rgba(18,18,20,0.85)",
    color: "#c9d1d9",
    border: "1px solid #444d56",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    backdropFilter: "blur(4px)",
  },
  statusBar: {
    position: "absolute" as const,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 500,
    display: "flex",
    gap: 16,
    alignItems: "center",
    padding: "5px 14px",
    background: "rgba(13,13,15,0.8)",
    borderTop: "1px solid #2d333b",
    fontSize: 12,
    color: "#6e7681",
    backdropFilter: "blur(4px)",
  },
  viewBadge: {
    padding: "2px 8px",
    background: "#161b22",
    borderRadius: 4,
    color: "#58a6ff",
    fontFamily: "monospace",
    fontSize: 11,
  },
  focusUri: {
    color: "#8b949e",
    fontFamily: "monospace",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
    maxWidth: 400,
    fontSize: 11,
  },
} as const;
