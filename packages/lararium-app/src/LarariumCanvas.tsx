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

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <Tldraw
        store={store}
        onMount={(editor) => {
          const storyPageId = pageId("story-river") as unknown as TLPageId;
          if (editor.getPage(storyPageId)) {
            editor.setCurrentPage(storyPageId);
            editor.zoomToFit();
          }
          syncNavState(editor, navState);
        }}
      />
    </div>
  );
}
