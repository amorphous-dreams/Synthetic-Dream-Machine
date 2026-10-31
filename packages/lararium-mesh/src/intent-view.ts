import type { IntentView } from "./intent-read.js";

export interface IntentPaneModel {
  readonly delegations: IntentView["delegations"];
  readonly rows: readonly { readonly id: string; readonly verb: string; readonly status: string; readonly winner: string | null;
    readonly admissions: IntentView["intents"][number]["admissions"]; readonly admissionCount: number;
    readonly agent: string | null; readonly delegationStatus: string | null;
    readonly winners: readonly string[]; readonly duplicates: readonly string[]; readonly unknownOutcomes: readonly string[]; readonly voidAfterAct: readonly string[];
    readonly unknown: boolean; readonly unknownReason: string | null; readonly outcomeCount: number | "unknown" }[];
  readonly refusedCount: number;
  readonly strayAnswerCount: number;
  readonly refused: readonly string[];
  /** Each refusal with the entry it concerns, so the pane names which copy collided. */
  readonly refusals: readonly { readonly refusal: string; readonly cid: string | null }[];
  readonly strayAnswers: readonly string[];
}
export function intentPaneModel(view: IntentView): IntentPaneModel {
  return { rows: view.intents.map((i) => ({ id: i.id, verb: i.verb, status: i.status,
    admissions: i.admissions, admissionCount: i.admissions.length, agent: i.agent ? i.issuer : null, delegationStatus: i.agent?.status ?? null,
    winner: i.slots.find((s) => s.winner)?.winner?.cid ?? null,
    winners: i.slots.flatMap((s) => s.winner ? [s.winner.cid] : []),
    duplicates: i.slots.flatMap((s) => s.unknownFrontier ? [] : s.duplicates.map((o) => o.cid)),
    unknownOutcomes: i.slots.flatMap((s) => s.unknownFrontier ? s.duplicates.map((o) => o.cid) : []),
    voidAfterAct: i.voidAfterAct.map((o) => o.cid),
    unknown: i.status === "unknown-frontier" || i.slots.some((s) => s.unknownFrontier),
    unknownReason: i.status === "unknown-frontier" || i.slots.some((s) => s.unknownFrontier)
      ? (i.agent?.status === "awaiting" ? "delegation frontier missing" : view.standing(i.issuer) === "unknown" && !i.agent ? "issuer standing missing" : "outcome signer standing missing") : null,
    outcomeCount: i.status === "unknown-frontier" || i.slots.some((s) => s.unknownFrontier) ? "unknown" : i.slots.filter((s) => s.winner).length,
  })), delegations: view.delegations, refusedCount: view.refused.length, strayAnswerCount: view.strayAnswers.length,
    refused: view.refused.map((r) => r.refusal), refusals: view.refused.map((r) => ({ refusal: r.refusal, cid: r.cid ?? null })), strayAnswers: view.strayAnswers.map((r) => r.cid) };
}
