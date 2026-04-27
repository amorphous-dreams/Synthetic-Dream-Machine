import { useEffect, useRef } from "react";
import { Tldraw, inlineBase64AssetStore } from "tldraw";
import type { TLPageId, TLShapeId, TLComponents } from "tldraw";
import { useSync } from "@tldraw/sync";
import "tldraw/tldraw.css";
import type { LarViewState, LarViewAction, TldrawEditorLike, ZoomLevel } from "@lararium/tldraw";
import { pageId, goToStoryRiver, goToGraph, zoomToMeme, classifyZoom, ZOOM_PAGE } from "@lararium/tldraw";

// Wiki mode: suppress all tldraw chrome — Lararium shell owns the UI.
const WIKI_COMPONENTS: TLComponents = {
  Toolbar: null,
  StylePanel: null,
  PageMenu: null,
  NavigationPanel: null,
  MainMenu: null,
  ZoomMenu: null,
  QuickActions: null,
  HelperButtons: null,
  MenuPanel: null,
};

// Canvas mode: restore tldraw's full chrome so the canvas is a complete drawing app.
// PageMenu stays null — page-switching must go through Lararium navigation, not tldraw tabs.
const CANVAS_COMPONENTS: TLComponents = {
  PageMenu: null,
};

interface Props {
  wsUrl: string;
  navState: LarViewState;
  dispatch: React.Dispatch<LarViewAction>;
  canvasMode: boolean;
  onZoomLevel?: (level: ZoomLevel) => void;
}

type TldrawEditor = Parameters<NonNullable<React.ComponentProps<typeof Tldraw>["onMount"]>>[0];

function syncNavState(editor: TldrawEditor, navState: LarViewState) {
  const ed = editor as unknown as TldrawEditorLike;
  if (navState.activeView === "graph") {
    goToGraph(ed);
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

export function LarariumCanvas({ wsUrl, navState, dispatch, canvasMode, onZoomLevel }: Props) {
  const store = useSync({ uri: wsUrl, assets: inlineBase64AssetStore });
  const editorRef = useRef<TldrawEditor | null>(null);
  if (process.env.NODE_ENV === "development") {
    (window as any).__larariumDebug ??= {};
    (window as any).__larariumDebug.store = store;
  }

  // Double-click meme frame → ZOOM_IN
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || store.status !== "synced-remote") return;
    const handler = (e: { target?: { id?: TLShapeId } }) => {
      const shapeId = e?.target?.id;
      if (!shapeId) return;
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

  // Zoom level → page auto-switch (Strategic/Operational → graph, Tactical → story)
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || store.status !== "synced-remote") return;

    const storyPageId = pageId("minimal-boot") as unknown as TLPageId;
    const graphPageId = pageId("graph")         as unknown as TLPageId;

    let lastLevel = classifyZoom(editor.getZoomLevel());

    const unsub = editor.store.listen(() => {
      const zoom  = editor.getZoomLevel();
      const level = classifyZoom(zoom);
      if (level === lastLevel) return;
      lastLevel = level;

      onZoomLevel?.(level);

      const target = ZOOM_PAGE[level];
      if (target === "graph"  && editor.getCurrentPageId() !== graphPageId) {
        editor.setCurrentPage(graphPageId);
        editor.zoomToFit({ animation: { duration: 200 } });
      } else if (target === "story" && editor.getCurrentPageId() !== storyPageId) {
        editor.setCurrentPage(storyPageId);
        editor.zoomToFit({ animation: { duration: 200 } });
      }
      // "preserve" → do nothing; meme-detail page stays under navState control
    });

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
