/**
 * keep-at-unlock — the operator's unlock offers to string a keep lei in the same act, under the one passphrase it gathered.
 *
 * Where the house config names a keep workspace (`./keep-config.ts`) and no keep lei stands for it with a return left, the
 * unlock asks once on its terminal; a yes strings the lei by the lei family's own row (`swarm-lei-kui`, rite `keep`, branch =
 * the workspace, after the line's tip) and its ward, handing the ward the very route the unlock gathered, so nothing asks again.
 * No terminal (a script, `--json`), no route (a pūlama unlock asks none), a lei that stands, or a no: nothing strings, and the
 * line that strings one by hand gets named.
 *
 * THE FACE: the lei strings as the face the unlock named, else as the daemon mount (`mountFace`), and the question, the answer
 * and the by-hand line all name it; a vessel that stands no mount (the floor) strings nothing and says why.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import type { Credential } from "@lararium/mesh";
import type { RiteVerbAnswer } from "./rite-kukulu.js";
import { RITE_KEEP, mountLine, type KeepFaceBy } from "./rite-keep.js";

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
  /**
   * The face the daemon mount runs under (`face.resolve` with `worn`), the face an unlock naming none strings the keep lei as;
   * it throws, naming why, where the vessel stands no mount. Absent: the offer rides no face and the vessel resolves it.
   */
  mountFace?(): Promise<number>;
}

export interface KeepOfferOutcome {
  readonly offered: boolean;
  readonly strung: boolean;
  readonly workspace: string | null;
  readonly why?: "no-workspace" | "no-route" | "no-terminal" | "no-face" | "standing" | "forked" | "declined" | "refused" | "unread";
  readonly lei?: string;
  /** The face the offer read and strung as, and how it came by it: the unlock named it, or it acts as the daemon mount. */
  readonly face?: number;
  readonly faceBy?: KeepFaceBy;
}

const byHand = (ws: string, face?: number): string => `lares lei kui --rite ${RITE_KEEP} --branch ${ws} --returns <n>${face === undefined ? "" : ` --face ${face}`}`;

export async function offerKeepLei(ports: KeepOfferPorts, opts: { readonly workspace: string | null; readonly route: readonly Credential[] | null; readonly face?: number }): Promise<KeepOfferOutcome> {
  const ws = opts.workspace;
  if (ws === null) return { offered: false, strung: false, workspace: null, why: "no-workspace" };
  if (opts.route === null || !opts.route.some((c) => c.kind === "passphrase")) return { offered: false, strung: false, workspace: ws, why: "no-route" };
  if (!ports.canAsk()) return { offered: false, strung: false, workspace: ws, why: "no-terminal" };
  // THE FACE THE LEI STRINGS AS: the one the unlock named, else the daemon mount; no mount (the floor) strings nothing.
  let acting: { face?: number; faceBy?: KeepFaceBy } = opts.face === undefined ? {} : { face: opts.face, faceBy: "named" };
  if (opts.face === undefined && ports.mountFace !== undefined) {
    try { acting = { face: await ports.mountFace(), faceBy: "mount" }; }
    catch (e) {
      ports.say(`keep: no keep lei offered for workspace "${ws}": the unlock named no face and the vessel stands no daemon mount (${e instanceof Error ? e.message : String(e)}); string one by hand as the face it belongs to: ${byHand(ws)} --face N`);
      return { offered: false, strung: false, workspace: ws, why: "no-face" };
    }
  }
  const face = acting.face === undefined ? {} : { face: acting.face };
  const as = acting.faceBy === "mount" && acting.face !== undefined ? `, ${mountLine(acting.face)}` : "";
  const hand = (): string => byHand(ws, acting.face);
  const line = await ports.row("swarm-show", { rite: RITE_KEEP, branch: ws, ...face });
  if (!line.ok) { ports.say(`keep: the keep line for workspace "${ws}" reads no answer (${line.code}); string a lei by hand: ${hand()}`); return { offered: false, strung: false, workspace: ws, why: "unread", ...acting }; }
  const lei = (line.output["lei"] ?? {}) as { standing?: boolean; returnsLeft?: number; after?: string | null; forks?: string[] };
  if (lei.standing === true && Number(lei.returnsLeft ?? 0) > 0) return { offered: false, strung: false, workspace: ws, why: "standing", ...acting };
  if (Array.isArray(lei.forks) && lei.forks.length > 0) {
    ports.say(`keep: the keep line for workspace "${ws}" stands forked; settle it by hand (lares lei show --rite ${RITE_KEEP} --branch ${ws}${acting.face === undefined ? "" : ` --face ${acting.face}`})`);
    return { offered: false, strung: false, workspace: ws, why: "forked", ...acting };
  }
  if (!(await ports.ask(`string a keep lei for workspace "${ws}" (${KEEP_LEI_RETURNS} returns${as}) under this same passphrase?`))) {
    ports.say(`keep: no keep lei strung; \`lares rite keep\` waits for one (${hand()})`);
    return { offered: true, strung: false, workspace: ws, why: "declined", ...acting };
  }
  const strung = await ports.row("swarm-lei-kui", { rite: RITE_KEEP, branch: ws, returns: KEEP_LEI_RETURNS, after: lei.after ?? null, ...face }, opts.route);
  if (!strung.ok) {
    ports.say(`keep: the keep lei did not string (${strung.message}); string it by hand: ${hand()}`);
    return { offered: true, strung: false, workspace: ws, why: "refused", ...acting };
  }
  const cid = typeof strung.output["cid"] === "string" ? strung.output["cid"] : undefined;
  ports.say(`keep: a keep lei of ${KEEP_LEI_RETURNS} returns stands for workspace "${ws}"${cid ? ` (${cid.slice(0, 12)})` : ""}; \`lares rite keep --workspace ${ws}${acting.face === undefined ? "" : ` --face ${acting.face}`}\` spends one`);
  return { offered: true, strung: true, workspace: ws, ...(cid ? { lei: cid } : {}), ...acting };
}
