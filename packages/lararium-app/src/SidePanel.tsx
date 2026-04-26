import type { LarApp } from "@lararium/web";
import type { LarViewState, LarViewAction } from "@lararium/tldraw";

interface Props {
  app: LarApp;
  navState: LarViewState;
  dispatch: React.Dispatch<LarViewAction>;
}

export function SidePanel({ app, navState, dispatch }: Props) {
  const isGraphOpen = navState.activeView === "graph";

  return (
    <>
      {/* Top-left: back button, shown when not on story-river root */}
      {navState.history.length > 0 && (
        <button
          style={styles.backBtn}
          onClick={() => dispatch({ type: "NAVIGATE_BACK" })}
          aria-label="Go back"
        >
          ← Back
        </button>
      )}

      {/* Top-right: graph toggle */}
      <button
        style={styles.graphBtn}
        onClick={() => dispatch({ type: isGraphOpen ? "CLOSE_GRAPH" : "OPEN_GRAPH" })}
        aria-label={isGraphOpen ? "Close graph" : "Open graph"}
      >
        {isGraphOpen ? "✕ Graph" : "⬡ Graph"}
      </button>

      {/* Bottom status bar: meme count + active view */}
      <div style={styles.statusBar}>
        <span>{app.artifact.memeCount} memes</span>
        <span style={styles.viewBadge}>{navState.activeView}</span>
        {navState.focusUri && (
          <span style={styles.focusUri}>{navState.focusUri.replace("lar:///", "")}</span>
        )}
      </div>
    </>
  );
}

const styles = {
  backBtn: {
    position: "absolute" as const,
    top: 12,
    left: 12,
    zIndex: 500,
    padding: "6px 12px",
    background: "rgba(30,30,30,0.85)",
    color: "#c9d1d9",
    border: "1px solid #444",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    backdropFilter: "blur(4px)",
  },
  graphBtn: {
    position: "absolute" as const,
    top: 12,
    right: 12,
    zIndex: 500,
    padding: "6px 12px",
    background: "rgba(30,30,30,0.85)",
    color: "#c9d1d9",
    border: "1px solid #444",
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
    padding: "6px 14px",
    background: "rgba(20,20,20,0.7)",
    borderTop: "1px solid #333",
    fontSize: 12,
    color: "#888",
    backdropFilter: "blur(4px)",
  },
  viewBadge: {
    padding: "2px 8px",
    background: "#2d333b",
    borderRadius: 4,
    color: "#58a6ff",
    fontFamily: "monospace",
  },
  focusUri: {
    color: "#aaa",
    fontFamily: "monospace",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
    maxWidth: 400,
  },
} as const;
