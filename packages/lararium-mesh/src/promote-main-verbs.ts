import { PromoteRefused } from "./promote.js";
import type { PromotePanelApi } from "./promote-panel-api.js";

export const PROMOTE_PANEL_VERBS = ["promote-commit", "promote-drop", "promote-keep", "promote-orphan-drop", "kapae-raise", "kapae-lower"] as const;
export const PROMOTE_PANEL_HAND_CODES: Readonly<Record<typeof PROMOTE_PANEL_VERBS[number], string>> = {
  "promote-commit": "promote-needs-hand", "promote-drop": "promote-needs-hand",
  "promote-keep": "promote-needs-hand", "promote-orphan-drop": "promote-needs-hand",
  "kapae-raise": "kapae-needs-hand", "kapae-lower": "kapae-needs-hand",
};

/** The island admits the gesture; these handlers act and return a fresh view. */
export function promoteMainVerbs({ api, push }: { api: PromotePanelApi; push: (data: string) => Promise<void> }): Record<string, (args: Record<string, unknown>) => Promise<Record<string, unknown>>> {
  const refresh = async () => { await push(JSON.stringify(await api.snapshot())); };
  const acts: Record<typeof PROMOTE_PANEL_VERBS[number], (wiki: string, digest: string) => Promise<unknown>> = {
    "promote-commit": (w, d) => api.commit(w, d), "promote-drop": (w, d) => api.drop(w, d),
    "promote-keep": (w, d) => api.orphan(w, d, "keep"), "promote-orphan-drop": (w, d) => api.orphan(w, d, "drop"),
    "kapae-raise": (w, d) => api.raise(w, d), "kapae-lower": (w, d) => api.lower(w, d),
  };
  const handlers: Record<string, (args: Record<string, unknown>) => Promise<Record<string, unknown>>> = {};
  for (const verb of PROMOTE_PANEL_VERBS) handlers[verb] = async (args) => {
    const { wiki, digest } = args;
    if (typeof wiki !== "string" || !wiki.trim()) throw new PromoteRefused("promote-wiki-missing", "a wiki must be named");
    if (typeof digest !== "string" || !/^[0-9a-f]{64}$/i.test(digest)) throw new PromoteRefused("promote-digest-malformed", "a hex digest must be named");
    await acts[verb](wiki, digest);
    await refresh();
    return { done: verb };
  };
  handlers["promote-refresh"] = async () => { await refresh(); return { pushed: true }; };
  return handlers;
}

/**
 * The store-door rows whose ISLAND route the panel owns: the panel's main-thread handler of this name answers a summoned verb (and pushes
 * the fresh snapshot), while the door's own reactor of the same name serves its socket and CLI road alone. Any other shared name is a clash
 * and the verb table refuses it.
 */
export const PROMOTE_PANEL_OWNED_ROWS: ReadonlySet<string> = new Set(["promote-commit", "promote-drop", "kapae-raise", "kapae-lower"]);
