/**
 * LarariumShell — tldraw-native chrome architecture.
 *
 * Architecture:
 *   - <LarariumCanvas> fills 100vw × 100vh
 *   - Nav chrome (breadcrumb, room name, back, graph) → tldraw TopPanel slot
 *   - ⌘K trigger → tldraw SharePanel slot
 *   - Canvas mode toggle + zoom glyph → tldraw HelperButtons slot
 *   - Footer (status bar) → position:fixed bottom strip — no z conflict with tldraw chrome
 *   - Command palette overlay → position:fixed, z:900 — intentional full-cover
 *
 * Stacking context: tldraw owns it. All interactive Lararium chrome lives inside
 * tldraw's component tree via stable slot refs in lararium-context.tsx.
 * No z-index arithmetic between Lararium and tldraw UI ever needed.
 *
 * Platform targets: Windows 11 / Ubuntu WSL (mouse+kb), Android Samsung (touch).
 * All tap targets ≥ 44×44px. No hover-only affordances.
 */

import { useReducer, useEffect, useState, useRef, useCallback } from "react";
import type { Editor } from "tldraw";
import { createPortal } from "react-dom";
import { INITIAL_VIEW_STATE, viewStateReducer } from "@lararium/tldraw";
import type { LarViewAction, ZoomLevel } from "@lararium/tldraw";
import { ReactionGraph } from "@lararium/core";
import { LarariumCanvas } from "./LarariumCanvas.js";
import { MemeDetailPanel } from "./MemeDetailPanel.js";
import { LarariumCtx, useLararium, shortUri, useTheme } from "./lararium-context.js";
import { useLarariumHostOpen } from "./lararium-browser-host.js";
import { debugSet } from "./debug.js";
import "./lararium-theme.css";
import type { MemeEntry } from "./App.js";


interface ShellProps {
  wsUrl: string;
  memes: MemeEntry[];
  onMemes: (memes: MemeEntry[]) => void;
}

// ---------------------------------------------------------------------------
// Command palette  (⌘K)
// ---------------------------------------------------------------------------

// Flat item list for unified keyboard nav across sections
type PaletteItem =
  | { kind: "home" }
  | { kind: "page"; pageId: string; name: string }
  | { kind: "meme"; uri: string; depth: number; memeKind: string };

function LarariumCommandPalette({ onClose }: { onClose: () => void }) {
  const { memes, dispatch, editor } = useLararium();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Live pages from the editor — only pages that actually exist in the CRDT store.
  const livePages: { pageId: string; name: string }[] = editor
    ? editor.getPages()
        .filter((p) => p.id !== "page:boot") // boot is "home" below
        .map((p) => ({ pageId: p.id, name: (p as unknown as Record<string,unknown>).name as string ?? p.id }))
    : [];

  const homeItem: Extract<PaletteItem, { kind: "home" }> = { kind: "home" };

  const pageItems: Extract<PaletteItem, { kind: "page" }>[] = livePages
    .filter((p) => !query || p.name.toLowerCase().includes(query.toLowerCase()) || p.pageId.includes(query.toLowerCase()))
    .map((p) => ({ kind: "page" as const, ...p }));

  const spaceItems: PaletteItem[] = [
    ...(!query || "story river".includes(query.toLowerCase()) || "boot".includes(query.toLowerCase()) ? [homeItem] : []),
    ...pageItems,
  ];

  const memeItems: Extract<PaletteItem, { kind: "meme" }>[] = (query
    ? memes.filter((m) => m.uri.toLowerCase().includes(query.toLowerCase()))
    : memes
  ).slice(0, 12).map((m) => ({ kind: "meme" as const, uri: m.uri, depth: m.depth, memeKind: m.kind }));

  const items: PaletteItem[] = [...spaceItems, ...memeItems];

  const activate = useCallback((item: PaletteItem) => {
    if (item.kind === "home") {
      dispatch({ type: "GO_TO_ROOM", roomId: "boot" });
    } else if (item.kind === "page") {
      dispatch({ type: "GO_TO_ROOM", roomId: item.pageId.replace(/^page:/, "") });
    } else {
      dispatch({ type: "ZOOM_IN", uri: item.uri });
    }
    onClose();
  }, [dispatch, onClose]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, items.length - 1)); return; }
    if (e.key === "ArrowUp")   { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); return; }
    if (e.key === "Enter" && items[cursor]) { activate(items[cursor]!); return; }
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
          placeholder="Jump to space or meme…"
          aria-label="Search spaces and memes"
          autoComplete="off"
          spellCheck={false}
        />
        <div style={css.paletteList} role="listbox">
          {spaceItems.length > 0 && (
            <>
              <div style={css.paletteSectionLabel}>Spaces</div>
              {spaceItems.map((item, i) => {
                const isHome = item.kind === "home";
                const key    = isHome ? "__home__" : (item as Extract<PaletteItem, { kind: "page" }>).pageId;
                const label  = isHome ? "Story River (boot)" : (item as Extract<PaletteItem, { kind: "page" }>).name;
                return (
                  <button
                    key={key}
                    role="option"
                    aria-selected={i === cursor}
                    style={{ ...css.paletteItem, ...(i === cursor ? css.paletteItemActive : {}) }}
                    onClick={() => activate(item)}
                    onMouseEnter={() => setCursor(i)}
                  >
                    <span style={css.paletteRoomGlyph}>{isHome ? "⬡" : "◻"}</span>
                    <span style={css.paletteItemLabel}>{label}</span>
                    <span style={css.paletteItemKind}>space</span>
                  </button>
                );
              })}
            </>
          )}
          {memeItems.length > 0 && (
            <>
              <div style={css.paletteSectionLabel}>Memes</div>
              {memeItems.map((item, i) => {
                const idx = spaceItems.length + i;
                return (
                  <button
                    key={item.uri}
                    role="option"
                    aria-selected={idx === cursor}
                    style={{ ...css.paletteItem, ...(idx === cursor ? css.paletteItemActive : {}) }}
                    onClick={() => activate(item)}
                    onMouseEnter={() => setCursor(idx)}
                  >
                    <span style={{ ...css.depthBar, width: 4 + item.depth * 6 }} />
                    <span style={css.paletteItemLabel}>{shortUri(item.uri)}</span>
                    <span style={css.paletteItemKind}>{item.memeKind}</span>
                  </button>
                );
              })}
            </>
          )}
          {items.length === 0 && (
            <div style={css.paletteEmpty}>No results for "{query}"</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shell root
// ---------------------------------------------------------------------------

export function LarariumShell({ wsUrl, memes, onMemes }: ShellProps) {
  const [navState, dispatch] = useReducer(viewStateReducer, INITIAL_VIEW_STATE);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [canvasMode, setCanvasMode] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>("tactical");
  const [theme, cycleTheme] = useTheme();
  const [editor, setEditorState] = useState<Editor | null>(null);
  const setEditor = useCallback((e: Editor | null) => setEditorState(e), []);
  const { phase: openPhase, store: tiddlerStore, tw5 } =
    useLarariumHostOpen({ hostId: "lararium-browser", recipeUri: "lar:///recipe/room", roomId: "altar-fire" });

  // Receipt SHA from server — delivered via <meta name="lararium-receipt"> in the HTML
  // shell. Read once at mount; stable for the session.
  const [hostReceipt] = useState<string | null>(() =>
    typeof document !== "undefined"
      ? document.querySelector('meta[name="lararium-receipt"]')?.getAttribute("content") ?? null
      : null
  );

  // ReactionGraph — one stable instance for the session lifetime.
  // Never recreated; bindings are patched incrementally via updateUri().
  // subscribeByFn() handlers are registered once and automatically apply
  // to bindings that arrive after boot — no teardown/re-subscription needed.
  const graphRef = useRef<ReactionGraph>(new ReactionGraph());
  const [graphReady, setGraphReady] = useState(false);

  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  // Register fn-based view-action handlers once.
  // fn:"navigate" → GO_TO_ROOM  (toUri carries the roomId)
  // fn:"zoom"     → ZOOM_IN     (toUri carries the meme URI)
  // fn:"relay"    → Relay Device: re-fires trigger on toUri (signal bus pattern)
  useEffect(() => {
    const g = graphRef.current;
    const unsubs = [
      g.subscribeByFn("navigate", (b) => {
        dispatchRef.current({ type: "GO_TO_ROOM", roomId: b.toUri });
      }),
      g.subscribeByFn("zoom", (b) => {
        dispatchRef.current({ type: "ZOOM_IN", uri: b.toUri });
      }),
      g.subscribeByFn("relay", (b, payload) => {
        if (b.trigger) graphRef.current.fireSync(b.toUri, b.trigger, payload);
      }),
    ];
    return () => { unsubs.forEach((u) => u()); };
  }, []); // stable — never re-runs

  // Boot: full load from TW5, then incremental updateUri on wiki changes.
  useEffect(() => {
    if (!tw5) return;
    const initial = tw5.buildReactionGraph();
    if (initial) {
      graphRef.current.load(initial.bindings);
      setGraphReady(true);
    }
    return tw5.onWikiChange((changes: Record<string, unknown>) => {
      for (const uri of Object.keys(changes)) {
        if (!uri.startsWith("lar:")) continue;
        const bindings = tw5.bindingsForUri(uri);
        if (bindings.length > 0) graphRef.current.updateUri(uri, bindings);
        else graphRef.current.removeUri(uri);
      }
    });
  }, [tw5]);

  // Expose graph via context once ready; ref is stable so no churn after boot.
  const reactionGraph = graphReady ? graphRef.current : null;

  // fireMeme — synchronous local dispatch. UEFN within-tick fidelity.
  const fireMeme = useCallback((fromUri: string, trigger: string, payload: unknown = {}) => {
    graphRef.current.fireSync(fromUri, trigger, payload);
  }, []);


  // ⌘K / Ctrl+K → palette   |   ` (backtick) → canvas mode toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (e.key === "`") {
        e.preventDefault();
        setCanvasMode((v) => !v);
        return;
      }
      if (e.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);


  // Expose opening state to browser console for smoke verification.
  // window.__larariumDebug.openPhase and .tw5 update reactively with ctx.
  debugSet("openPhase", openPhase);
  debugSet("tw5",       tw5);
  debugSet("dispatch",  dispatch);
  debugSet("store",     tiddlerStore);

  const ctxValue = {
    navState,
    dispatch: dispatch as React.Dispatch<LarViewAction>,
    memes,
    paletteOpen,
    setPaletteOpen,
    canvasMode,
    setCanvasMode,
    zoomLevel,
    theme,
    cycleTheme,
    editor,
    setEditor,
    openPhase,
    tiddlerStore,
    tw5,
    hostReceipt,
    reactionGraph,
    fireMeme,
  };

  return (
    <LarariumCtx.Provider value={ctxValue}>
      <div style={css.shellRoot}>
        <LarariumCanvas
          wsUrl={wsUrl}
          navState={navState}
          dispatch={dispatch as React.Dispatch<LarViewAction>}
          canvasMode={canvasMode}
          onZoomLevel={setZoomLevel}
          onMemes={onMemes}
        />

        {paletteOpen && createPortal(
          <LarariumCommandPalette onClose={() => setPaletteOpen(false)} />,
          document.body
        )}
        {createPortal(<MemeDetailPanel />, document.body)}
      </div>
    </LarariumCtx.Provider>
  );
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
  paletteSectionLabel: {
    padding: "6px 16px 2px",
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.08em",
    color: "#6e7681",
    textTransform: "uppercase" as const,
    userSelect: "none" as const,
  },
  paletteRoomGlyph: {
    fontSize: 16,
    lineHeight: 1,
    flexShrink: 0,
    width: 20,
    textAlign: "center" as const,
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
