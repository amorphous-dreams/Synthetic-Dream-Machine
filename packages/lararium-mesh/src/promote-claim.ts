import type { PromotePanelApi } from "./promote-panel-api.js";

type SubscribedPromoteApi = PromotePanelApi & { subscribe(fn: () => void): () => void };

/** The page realm is shared with mirror content, so the actions leave the vessel once, to the panel. */
export function claimablePromoteApi(api: SubscribedPromoteApi) {
  let claimed = false;
  return Object.freeze({
    snapshot: () => api.snapshot(),
    subscribe: (fn: () => void) => api.subscribe(fn),
    claim(): SubscribedPromoteApi | null {
      if (claimed) return null;
      claimed = true;
      return api;
    },
  });
}
