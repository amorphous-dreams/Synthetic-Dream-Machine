import { useEffect, useRef } from "react";
import { Tldraw, inlineBase64AssetStore } from "tldraw";
import type { TLPageId, TLShapeId, TLComponents } from "tldraw";
import { useSync } from "@tldraw/sync";
import "tldraw/tldraw.css";
import type { LarViewState, LarViewAction, TldrawEditorLike, ZoomLevel } from "@lararium/tldraw";
import { pageId, goToStoryRiver, goToGraph, goToRoom, zoomToMeme, classifyZoom, ZOOM_PAGE } from "@lararium/tldraw";
import { LarariumMenuPanel, LarariumSharePanel, LarariumHelperButtons, useLararium } from "./lararium-context.js";

// Wiki mode: suppress tldraw chrome; Lararium slot components fill the UI.
// All slot components are stable module-level refs — tldraw won't remount them.
const WIKI_COMPONENTS: TLComponents = {
  Toolbar:      null,
  StylePanel:   null,
  PageMenu:     null,
  MainMenu:     null,
  ZoomMenu:     null,
  QuickActions: null,
  TopPanel:     null,
  // NavigationPanel (minimap + zoom) left at default — owns the bottom-left zone
  // Lararium slots — room/status top-left, ⌘K top-right, controls row
  MenuPanel:    LarariumMenuPanel,
  SharePanel:   LarariumSharePanel,
  HelperButtons: LarariumHelperButtons,
};

// Canvas mode: restore tldraw drawing chrome alongside Lararium slots.
// PageMenu and TopPanel stay null — nav owned by Lararium slots.
const CANVAS_COMPONENTS: TLComponents = {
  PageMenu:      null,
  TopPanel:      null,
  MenuPanel:     LarariumMenuPanel,
  SharePanel:    LarariumSharePanel,
  HelperButtons: LarariumHelperButtons,
};

interface Props {
  wsUrl: string;
  navState: LarViewState;
  dispatch: React.Dispatch<LarViewAction>;
  canvasMode: boolean;
  onZoomLevel?: (level: ZoomLevel) => void;
  onMemes?: (memes: { uri: string; depth: number; kind: string }[]) => void;
}

type TldrawEditor = Parameters<NonNullable<React.ComponentProps<typeof Tldraw>["onMount"]>>[0];

function syncNavState(editor: TldrawEditor, navState: LarViewState) {
  const ed = editor as unknown as TldrawEditorLike;
  if (navState.activeView === "graph") {
    goToGraph(ed);
  } else if (navState.activeView === "room" && navState.focusUri) {
    goToRoom(ed, navState.focusUri);
  } else if (navState.activeView === "meme-detail" && navState.focusUri) {
    zoomToMeme(ed, navState.focusUri);
  } else {
    goToStoryRiver(ed);
  }
}

function getLarUriFromShape(editor: TldrawEditor, shapeId: TLShapeId): string | null {
  const shape = editor.getShape(shapeId);
  if (!shape) return null;
  const meta = shape.meta as Record<string, unknown> | undefined;
  if (meta?.uri && typeof meta.uri === "string") return meta.uri;
  if (meta?.larUri && typeof meta.larUri === "string") return meta.larUri;
  if (shape.type === "frame" || shape.type === "geo") {
    const props = shape.props as unknown as Record<string, unknown>;
    const name = props.name ?? props.text;
    if (typeof name === "string" && name.startsWith("lar:")) return name;
  }
  return null;
}

export function LarariumCanvas({ wsUrl, navState, dispatch, canvasMode, onZoomLevel, onMemes }: Props) {
  const store = useSync({ uri: wsUrl, assets: inlineBase64AssetStore });
  const editorRef = useRef<TldrawEditor | null>(null);
  const { theme } = useLararium();
  if (process.env.NODE_ENV === "development") {
    (window as any).__larariumDebug ??= {};
    (window as any).__larariumDebug.store = store;
  }

  // Populate meme list reactively — CRDT-native, no /api/memes fetch.
  // One-shot scan on sync, then store.listen for document mutations (shape add/remove/update).
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || store.status !== "synced-remote" || !onMemes) return;

    const scanMemes = () => {
      const memes = editor.getCurrentPageShapes()
        .filter((s) => {
          const meta = s.meta as Record<string, unknown> | undefined;
          return s.type === "frame" && meta?.frameKind === "meme";
        })
        .map((s) => {
          const meta = s.meta as Record<string, unknown>;
          return {
            uri:   String(meta.uri ?? ""),
            depth: Number(meta.depth ?? 0),
            kind:  String(meta.kind ?? "meme"),
          };
        })
        .filter((m) => m.uri.startsWith("lar:"));
      onMemes(memes);
    };

    scanMemes();

    // Re-scan on any document mutation (shape add/remove/meta change).
    // scope:'document' skips camera/presence records — fires ~100x less than default.
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const unsub = editor.store.listen(
      () => {
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(scanMemes, 150);
      },
      { scope: "document" },
    );

    return () => {
      unsub();
      if (debounce) clearTimeout(debounce);
    };
  }, [store.status, onMemes]);

  // Sync tldraw colorScheme when Lararium theme changes
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const colorScheme = theme === "gruvbox-dark" ? "dark" : theme === "gruvbox-light" ? "light" : "system";
    editor.user.updateUserPreferences({ colorScheme });
  }, [theme]);

  // Double-click: geo portal (meta.larPortal) → GO_TO_ROOM, meme frame → ZOOM_IN
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || store.status !== "synced-remote") return;
    const handler = (e: { target?: { id?: TLShapeId } }) => {
      const shapeId = e?.target?.id;
      if (!shapeId) return;
      const shape = editor.getShape(shapeId);
      const meta = shape?.meta as Record<string, unknown> | undefined;
      if (meta?.larPortal && typeof meta.targetRoomId === "string") {
        dispatch({ type: "GO_TO_ROOM", roomId: meta.targetRoomId });
        return;
      }
      const uri = getLarUriFromShape(editor, shapeId);
      if (uri) dispatch({ type: "ZOOM_IN", uri });
    };
    editor.on("doubleClickShape" as any, handler);
    return () => { editor.off("doubleClickShape" as any, handler); };
  }, [store.status, dispatch]);

  // Nav state → tldraw camera
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || store.status !== "synced-remote") return;
    const storyPageId = pageId("minimal-boot") as unknown as TLPageId;
    if (editor.getPage(storyPageId)) {
      editor.setCurrentPage(storyPageId);
      editor.zoomToFit();
    } else {
      console.warn("[lararium] missing story page", storyPageId);
    }
    syncNavState(editor, navState);
  }, [store.status, navState]);

  // Zoom level → page auto-switch.
  // scope:'session' filters to camera/presence records only — avoids firing on
  // every document mutation (shape moves, text edits, etc.).
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || store.status !== "synced-remote") return;

    const storyPageId = pageId("minimal-boot") as unknown as TLPageId;
    const graphPageId = pageId("graph")         as unknown as TLPageId;

    let lastLevel = classifyZoom(editor.getZoomLevel());

    const unsub = editor.store.listen(
      () => {
        const zoom  = editor.getZoomLevel();
        const level = classifyZoom(zoom);
        if (level === lastLevel) return;
        lastLevel = level;

        onZoomLevel?.(level);

        const target = ZOOM_PAGE[level];
        if (target === "graph" && editor.getCurrentPageId() !== graphPageId) {
          editor.setCurrentPage(graphPageId);
          editor.zoomToFit({ animation: { duration: 200 } });
        } else if (target === "story" && editor.getCurrentPageId() !== storyPageId) {
          editor.setCurrentPage(storyPageId);
          editor.zoomToFit({ animation: { duration: 200 } });
        }
        // "preserve" → meme-detail page stays under navState control
      },
      { scope: "session" },   // camera is session-scoped; this fires ~100x less than default
    );

    return unsub;
  }, [store.status]);

  if (store.status === "loading") {
    return <div style={fill}>Connecting to Lararium…</div>;
  }
  if (store.status === "error") {
    return (
      <div style={{ ...fill, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "red", gap: 12 }}>
        <span>Sync error: {store.error?.message ?? "unknown"}</span>
        <button onClick={() => window.location.reload()} style={{ padding: "6px 16px", cursor: "pointer" }}>Reload</button>
      </div>
    );
  }

  return (
    <div style={fill}>
      <Tldraw
        store={store.store}
        components={canvasMode ? CANVAS_COMPONENTS : WIKI_COMPONENTS}
        onMount={(editor) => {
          editorRef.current = editor;
          if (process.env.NODE_ENV === "development") {
            (window as any).__larariumDebug ??= {};
            (window as any).__larariumDebug.editor = editor;
          }
          editor.user.updateUserPreferences({ colorScheme: "dark" });
          editor.setCurrentTool("select");
          const storyPageId = pageId("minimal-boot") as unknown as TLPageId;
          if (editor.getPage(storyPageId)) {
            editor.setCurrentPage(storyPageId);
            editor.zoomToFit();
          } else {
            console.warn("[lararium] missing story page", storyPageId);
          }
          syncNavState(editor, navState);
        }}
      />
    </div>
  );
}

const fill = { width: "100%", height: "100%" } as const;
