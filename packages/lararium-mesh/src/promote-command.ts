import { PromoteRefused, type PromoteWho } from "./promote.js";
import type { promotions } from "./promote-door.js";
import type { promoteBoardDoor } from "./promote-board-door.js";

/** `promotionsFor` and the board door take the act's opaque `ward` (a host's one-use route ticket), which the mesh never reads. */
export type PromoteCommandDeps = { who: PromoteWho; promotionsFor: (wiki: string, ward?: unknown) => ReturnType<typeof promotions>; boardDoor: ReturnType<typeof promoteBoardDoor> };
export type PromoteCommandRequest = { action: "list" | "prepare" | "commit" | "drop" | "orphan" | "raise" | "lower" | "flag"; wiki?: string; digest?: string; why?: string; decision?: string; ward?: unknown };

export async function promoteCommand(request: PromoteCommandRequest, deps: PromoteCommandDeps) {
  const { action } = request, wiki = request.wiki ?? "daemon";
  if (!["list", "prepare", "commit", "drop", "orphan", "raise", "lower", "flag"].includes(action)) throw new PromoteRefused("promote-action-unknown", "unknown action");
  if (action === "list") return deps.promotionsFor(wiki).list();
  const { digest, why } = request;
  if (typeof digest !== "string" || !/^[0-9a-f]{64}$/.test(digest)) throw new PromoteRefused("promote-digest-malformed", "name a hex64 digest");
  if ((action === "prepare" || action === "flag") && (typeof why !== "string" || !why.trim())) throw new PromoteRefused("promote-why-missing", "name a reason");
  if (action === "orphan" && request.decision !== "keep" && request.decision !== "drop") throw new PromoteRefused("promote-decision-malformed", "name keep or drop");
  if (action === "raise" || action === "lower") return (await deps.boardDoor.kapae({ action, wiki, digest, who: deps.who, ward: request.ward })) ?? {};
  const door = deps.promotionsFor(wiki, request.ward);
  if (action === "commit") return (await door.promote({ digest })) ?? {};
  if (action === "drop") return (await door.unpromote({ digest })) ?? {};
  if (action === "orphan") return (await door.decideOrphan({ digest, decision: request.decision as "keep" | "drop" })) ?? {};
  const listing = await door.list();
  const item = listing.waiting.find(row => row.digest === digest) ?? (action === "flag" ? listing.rows.find(row => row.digest === digest) : undefined);
  if (action === "prepare" && !item) throw new PromoteRefused("promote-unknown", "no waiting item carries the digest");
  const input = { wiki, digest, title: item?.title ?? digest, classes: item?.classes ?? [], why: why! };
  return (await (action === "prepare" ? deps.boardDoor.prepare(input) : deps.boardDoor.flag(input))) ?? {};
}
