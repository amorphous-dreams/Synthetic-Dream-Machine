import type { IntentView } from "./intent-read.js";

export interface IntentPaneModel {
  readonly rows: readonly { readonly id: string; readonly verb: string; readonly status: string; readonly winner: string | null;
    readonly winners: readonly string[]; readonly duplicates: readonly string[]; readonly unknownOutcomes: readonly string[]; readonly voidAfterAct: readonly string[];
    readonly unknown: boolean; readonly unknownReason: string | null; readonly outcomeCount: number | "unknown" }[];
  readonly refusedCount: number;
  readonly strayAnswerCount: number;
  readonly refused: readonly string[];
  readonly strayAnswers: readonly string[];
}
export function intentPaneModel(view: IntentView): IntentPaneModel {
  return { rows: view.intents.map((i) => ({ id: i.id, verb: i.verb, status: i.status,
    winner: i.slots.find((s) => s.winner)?.winner?.cid ?? null,
    winners: i.slots.flatMap((s) => s.winner ? [s.winner.cid] : []),
    duplicates: i.slots.flatMap((s) => s.unknownFrontier ? [] : s.duplicates.map((o) => o.cid)),
    unknownOutcomes: i.slots.flatMap((s) => s.unknownFrontier ? s.duplicates.map((o) => o.cid) : []),
    voidAfterAct: i.voidAfterAct.map((o) => o.cid),
    unknown: i.status === "unknown-frontier" || i.slots.some((s) => s.unknownFrontier),
    unknownReason: i.status === "unknown-frontier" || i.slots.some((s) => s.unknownFrontier)
      ? (view.standing(i.issuer) === "unknown" ? "issuer standing missing" : "outcome signer standing missing") : null,
    outcomeCount: i.status === "unknown-frontier" || i.slots.some((s) => s.unknownFrontier) ? "unknown" : i.slots.filter((s) => s.winner).length,
  })), refusedCount: view.refused.length, strayAnswerCount: view.strayAnswers.length,
    refused: view.refused.map((r) => r.refusal), strayAnswers: view.strayAnswers.map((r) => r.cid) };
}
