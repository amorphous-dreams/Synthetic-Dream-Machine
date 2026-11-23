import type { ParsedArgs } from "../parse-args.js";
import { helpLines } from "../command-help.js";
import { refuseUsage } from "../render.js";
import { storeVerb } from "../store-door.js";

/** Every verb the trust door answers, and every verb its brake (`kapae`) answers. */
export const TRUST_VERBS = ["list", "prepare", "commit", "drop", "orphan"] as const;
export const KAPAE_VERBS = ["raise", "lower", "flag"] as const;

export async function promotionDoor(args: ParsedArgs, command: "trust" | "kapae"): Promise<number> {
  const [act, digest] = args.positional;
  const acts: readonly string[] = command === "trust" ? TRUST_VERBS : KAPAE_VERBS;
  if (!act || !acts.includes(act)) return refuseUsage(args, command, helpLines(command), act ? `unknown sub-verb "${act}"` : "name a sub-verb");
  try {
    const payload: Record<string, unknown> = {};
    if (act !== "list") {
      if (!digest || !/^[0-9a-f]{64}$/.test(digest)) throw new Error("promote-digest-malformed: name a hex64 digest");
      payload.digest = digest;
    }
    const face = args.options["face"];
    if (args.flags["face"] !== undefined || (face !== undefined && (!/^(?:0|[1-9][0-9]*)$/.test(face) || !Number.isSafeInteger(Number(face))))) throw new Error("face-malformed: --face needs a whole persona index from 0");
    if (face !== undefined) payload.face = Number(face);
    if (args.options["wiki"] !== undefined) payload.wiki = args.options["wiki"];
    const why = args.options["why"];
    if ((act === "prepare" || act === "flag") && !why?.trim()) throw new Error("promote-why-missing: name --why");
    if (why !== undefined) payload.why = why;
    if (act === "orphan") {
      const keep = args.flags["keep"] === true, drop = args.flags["drop"] === true;
      if (keep === drop) throw new Error("promote-decision-malformed: name --keep or --drop");
      payload.decision = keep ? "keep" : "drop";
    }
    const { output } = await storeVerb(`${command === "trust" ? "promote" : command}-${act}` as Parameters<typeof storeVerb>[0], payload);
    console.log(JSON.stringify(output));
    return 0;
  } catch (err) {
    if (err instanceof Error) { console.error(`[lares ${command}] refused: ${err.message}`); return 1; }
    throw err;
  }
}
export const cmdPromote = (args: ParsedArgs) => promotionDoor(args, "trust");
