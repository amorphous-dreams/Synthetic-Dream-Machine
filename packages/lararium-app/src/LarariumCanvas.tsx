import { useEffect, useRef } from "react";
import { Tldraw } from "tldraw";
import type { TLPageId } from "tldraw";
import "tldraw/tldraw.css";
import type { LarApp } from "@lararium/web";
import type { LarViewState, LarViewAction, TldrawEditorLike } from "@lararium/tldraw";
import { pageId, goToStoryRiver, goToGraph, zoomToMeme } from "@lararium/tldraw";

interface Props {
  app: LarApp;
  navState: LarViewState;
  dispatch: React.Dispatch<LarViewAction>;
}

type TldrawEditor = Parameters<NonNullable<React.ComponentProps<typeof Tldraw>["onMount"]>>[0];

export function LarariumCanvas({ app, navState, dispatch: _dispatch }: Props) {
  const editorRef = useRef<TldrawEditor | null>(null);

  // Sync navState → tldraw camera/page
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const ed = editor as unknown as TldrawEditorLike;

    if (navState.activeView === "graph") {
      goToGraph(ed);
    } else if (navState.activeView === "meme-detail" && navState.focusUri) {
      zoomToMeme(ed, navState.focusUri);
    } else {
      goToStoryRiver(ed);
    }
  }, [navState]);

  const emission = app.emission as { pages: Array<{ id: string; name: string }>; shapes: unknown[] } | null;

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <Tldraw
        onMount={(editor) => {
          editorRef.current = editor;

          if (!emission) return;

          // Hydrate the store from the pre-computed emission.
          // TW analogy: loading tiddlers from the boot store into the story river.
          editor.store.mergeRemoteChanges(() => {
            for (const page of emission.pages) {
              editor.createPage({ id: page.id as TLPageId, name: page.name });
            }
            editor.store.put(emission.shapes as Parameters<typeof editor.store.put>[0]);
          });

          // Navigate to the story-river page
          const storyPageId = pageId("story-river") as unknown as TLPageId;
          if (editor.getPage(storyPageId)) {
            editor.setCurrentPage(storyPageId);
          }

          editor.zoomToFit();
        }}
      />
    </div>
  );
}
