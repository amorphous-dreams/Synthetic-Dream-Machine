import { useEffect, useRef } from "react";
import { Tldraw, inlineBase64AssetStore } from "tldraw";
import type { TLPageId, TLShapeId, TLComponents } from "tldraw";

// Suppress tldraw's built-in chrome — Lararium shell provides its own.
// PageMenu removed so users don't accidentally switch pages via tldraw UI.
const LARARIUM_COMPONENTS: TLComponents = {
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
import { useSync } from "@tldraw/sync";
import "tldraw/tldraw.css";
import type { LarViewState, LarViewAction, TldrawEditorLike } from "@lararium/tldraw";
import { pageId, goToStoryRiver, goToGraph, zoomToMeme } from "@lararium/tldraw";

interface Props {
  wsUrl: string;
  navState: LarViewState;
  dispatch: React.Dispatch<LarViewAction>;
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

// Extract lar URI from a shape's meta or name field.
// Meme frames are emitted with meta.larUri set by the projection layer.
function getLarUriFromShape(editor: TldrawEditor, shapeId: TLShapeId): string | null {
  const shape = editor.getShape(shapeId);
  if (!shape) return null;
  const meta = shape.meta as Record<string, unknown> | undefined;
  if (meta?.uri && typeof meta.uri === "string") return meta.uri;
  if (meta?.larUri && typeof meta.larUri === "string") return meta.larUri;
  // Fallback: frames named after the URI slug
  if (shape.type === "frame" || shape.type === "geo") {
    const props = shape.props as unknown as Record<string, unknown>;
    const name = props.name ?? props.text;
    if (typeof name === "string" && name.startsWith("lar:")) return name;
  }
  return null;
}

export function LarariumCanvas({ wsUrl, navState, dispatch }: Props) {
  const store = useSync({
    uri: wsUrl,
    assets: inlineBase64AssetStore,
  });
  const editorRef = useRef<TldrawEditor | null>(null);
  (window as any).__larariumStore = store;

  // Wire double-click on meme frames → ZOOM_IN dispatch
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

  if (store.status === "loading") {
    return <div style={{ width: "100%", height: "100%" }}>Connecting to Lararium...</div>;
  }

  if (store.status === "error") {
    return <div style={{ width: "100%", height: "100%", color: "red" }}>[lararium] sync error: {store.error?.message ?? "Unknown error"}</div>;
  }

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <Tldraw
        store={store.store}
        components={LARARIUM_COMPONENTS}
        onMount={(editor) => {
          editorRef.current = editor;
          (window as any).__larariumEditor = editor;
          const pageIds = editor.getPages().map((page) => page.id);
          console.log("[lararium] editor pages:", pageIds);
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
