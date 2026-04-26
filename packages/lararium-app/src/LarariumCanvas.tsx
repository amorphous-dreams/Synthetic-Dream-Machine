import { useEffect, useRef } from "react";
import { Tldraw, inlineBase64AssetStore } from "tldraw";
import type { TLPageId } from "tldraw";
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

export function LarariumCanvas({ wsUrl, navState, dispatch: _dispatch }: Props) {
  const store = useSync({
    uri: wsUrl,
    assets: inlineBase64AssetStore,
  });
  const editorRef = useRef<TldrawEditor | null>(null);
  (window as any).__larariumStore = store;

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
