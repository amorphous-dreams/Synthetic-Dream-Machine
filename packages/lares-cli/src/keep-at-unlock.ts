/**
 * keep-at-unlock — the operator's unlock offers to string a keep lei in the same act, under the one passphrase it gathered.
 *
 * Where the house config names a keep workspace (`./keep-config.ts`) and no keep lei stands for it with a return left, the
 * unlock asks once on its terminal; a yes strings the lei by the lei family's own row (`swarm-lei-kui`, rite `keep`, branch =
 * the workspace, after the line's tip) and its ward, handing the ward the very route the unlock gathered, so nothing asks again.
 * No terminal (a script, `--json`), no route (a pūlama unlock asks none), a lei that stands, or a no: nothing strings, and the
 * line that strings one by hand gets named.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import type { Credential } from "@lararium/mesh";
import type { RiteVerbAnswer } from "./rite-kukulu.js";
import { RITE_KEEP } from "./rite-keep.js";

/** The returns a keep lei strung at unlock carries: the most a kui takes without its `--yes` confirm. */
export const KEEP_LEI_RETURNS = 12;

export interface KeepOfferPorts {
  /** Whether a person stands at a terminal to answer. */
  canAsk(): boolean;
  /** One yes-or-no question on that terminal. */
  ask(question: string): Promise<boolean>;
  /** One store row; a ward act takes `route` as its route, asked of nobody. */
  row(verb: "swarm-show" | "swarm-lei-kui", args: Record<string, unknown>, route?: readonly Credential[]): Promise<RiteVerbAnswer>;
  say(line: string): void;
}

export interface KeepOfferOutcome {
  readonly offered: boolean;
  readonly strung: boolean;
  readonly workspace: string | null;
  readonly why?: "no-workspace" | "no-route" | "no-terminal" | "standing" | "forked" | "declined" | "refused" | "unread";
  readonly lei?: string;
}

const byHand = (ws: string): string => `lares lei kui --rite ${RITE_KEEP} --branch ${ws} --returns <n>`;

export async function offerKeepLei(ports: KeepOfferPorts, opts: { readonly workspace: string | null; readonly route: readonly Credential[] | null; readonly face?: number }): Promise<KeepOfferOutcome> {
  const ws = opts.workspace;
  if (ws === null) return { offered: false, strung: false, workspace: null, why: "no-workspace" };
  if (opts.route === null || !opts.route.some((c) => c.kind === "passphrase")) return { offered: false, strung: false, workspace: ws, why: "no-route" };
  if (!ports.canAsk()) return { offered: false, strung: false, workspace: ws, why: "no-terminal" };
  const face = opts.face === undefined ? {} : { face: opts.face };
  const line = await ports.row("swarm-show", { rite: RITE_KEEP, branch: ws, ...face });
  if (!line.ok) { ports.say(`keep: the keep line for workspace "${ws}" reads no answer (${line.code}); string a lei by hand: ${byHand(ws)}`); return { offered: false, strung: false, workspace: ws, why: "unread" }; }
  const lei = (line.output["lei"] ?? {}) as { standing?: boolean; returnsLeft?: number; after?: string | null; forks?: string[] };
  if (lei.standing === true && Number(lei.returnsLeft ?? 0) > 0) return { offered: false, strung: false, workspace: ws, why: "standing" };
  if (Array.isArray(lei.forks) && lei.forks.length > 0) {
    ports.say(`keep: the keep line for workspace "${ws}" stands forked; settle it by hand (lares lei show --rite ${RITE_KEEP} --branch ${ws})`);
    return { offered: false, strung: false, workspace: ws, why: "forked" };
  }
  if (!(await ports.ask(`string a keep lei for workspace "${ws}" (${KEEP_LEI_RETURNS} returns) under this same passphrase?`))) {
    ports.say(`keep: no keep lei strung; \`lares rite keep\` waits for one (${byHand(ws)})`);
    return { offered: true, strung: false, workspace: ws, why: "declined" };
  }
  const strung = await ports.row("swarm-lei-kui", { rite: RITE_KEEP, branch: ws, returns: KEEP_LEI_RETURNS, after: lei.after ?? null, ...face }, opts.route);
  if (!strung.ok) {
    ports.say(`keep: the keep lei did not string (${strung.message}); string it by hand: ${byHand(ws)}`);
    return { offered: true, strung: false, workspace: ws, why: "refused" };
  }
  const cid = typeof strung.output["cid"] === "string" ? strung.output["cid"] : undefined;
  ports.say(`keep: a keep lei of ${KEEP_LEI_RETURNS} returns stands for workspace "${ws}"${cid ? ` (${cid.slice(0, 12)})` : ""}; \`lares rite keep --workspace ${ws}\` spends one`);
  return { offered: true, strung: true, workspace: ws, ...(cid ? { lei: cid } : {}) };
}
