import { promoteCommand, type PromoteCommandDeps } from "./promote-command.js";

export type PromotePanelListing = Awaited<ReturnType<ReturnType<PromoteCommandDeps["promotionsFor"]>["list"]>>;
export type PromotePanelSnapshot = { wikis: Array<({ wiki: string } & PromotePanelListing) | { wiki: string; error: string }> };
export type PromotePanelApi = ReturnType<typeof promotePanelApi>;

/** Adapt the promotion doors to a wiki-indexed panel. */
export function promotePanelApi(deps: PromoteCommandDeps & { wikis: () => Promise<readonly string[]> }) {
  const act = (action: "commit" | "drop" | "orphan" | "raise" | "lower", wiki: string, digest: string, decision?: "keep" | "drop") =>
    promoteCommand({ action, wiki, digest, ...(decision ? { decision } : {}) }, deps);
  return {
    async snapshot(): Promise<PromotePanelSnapshot> {
      const wikis = await deps.wikis();
      return { wikis: await Promise.all(wikis.map(async wiki => {
        try { return { wiki, ...await deps.promotionsFor(wiki).list() }; }
        catch (error) { return { wiki, error: error instanceof Error ? error.message : String(error) }; }
      })) };
    },
    commit: (wiki: string, digest: string) => act("commit", wiki, digest),
    drop: (wiki: string, digest: string) => act("drop", wiki, digest),
    orphan: (wiki: string, digest: string, decision: "keep" | "drop") => act("orphan", wiki, digest, decision),
    raise: (wiki: string, digest: string) => act("raise", wiki, digest),
    lower: (wiki: string, digest: string) => act("lower", wiki, digest),
  };
}
