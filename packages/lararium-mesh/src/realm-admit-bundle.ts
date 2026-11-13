/** A realm invite carries the two raising hands' unjudged frontier records to a new reader. */
import type { LarDoc } from "./base-doc.js";
import type { CabalInvite } from "./cabal-invite.js";
import { edgeKapaeActsFromBoard, edgeKapaeActsFromJson, type EdgeKapae } from "./edge-kapae.js";
import { handFrontierCarriage, type HandFrontierCarriage } from "./fleet-frontier.js";
import { REALM_HAND, holderHand } from "./realm-frontier.js";
import { readCabalInvite } from "./vouch-board.js";
import { NEXUS_AID_PATTERN } from "./wax-stamp.js";

export interface RealmAdmitBundle {
  readonly kind: "realm-admit-bundle";
  readonly invite: CabalInvite;
  readonly realm: string;
  /** The Nexus the realm stands under at the voucher: a CLAIM the reader checks against the charter it holds, since only a frontier that verifies under that charter counts. */
  readonly nexus?: string;
  /** The board's edge acts, as sync would carry them: a head that counts a raise waits until the raise itself arrives, and the reader counts each act through its own fold. */
  readonly acts: EdgeKapae[];
  readonly frontiers: HandFrontierCarriage[];
}

export function realmAdmitBundle(input: { readonly invite: CabalInvite; readonly realm: string; readonly nexus?: string; readonly board: LarDoc | undefined | null }): RealmAdmitBundle {
  if (input.invite.realmDocIdHex !== input.realm) throw new Error("realm-admit-bundle: invite names another realm");
  const frontiers = [REALM_HAND, holderHand(input.invite.voucherDid)].map((hand) => ({ hand, ...handFrontierCarriage(input.board, input.realm, hand) }));
  return { kind: "realm-admit-bundle", invite: input.invite, realm: input.realm, ...(input.nexus ? { nexus: input.nexus } : {}), acts: edgeKapaeActsFromBoard(input.board), frontiers };
}

export function readRealmAdmitBundle(parsed: unknown): RealmAdmitBundle | null {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const p = parsed as Record<string, unknown>;
  const nexus = p["nexus"];
  if (Object.keys(p).length !== ("nexus" in p ? 6 : 5) || ("nexus" in p && (typeof nexus !== "string" || !NEXUS_AID_PATTERN.test(nexus))) || p["kind"] !== "realm-admit-bundle" || typeof p["realm"] !== "string" || !/^[0-9a-f]{64}$/.test(p["realm"])) return null;
  const invite = readCabalInvite(p["invite"]);
  if (!invite || invite.realmDocIdHex !== p["realm"]) return null;
  if (!Array.isArray(p["acts"]) || p["acts"].length > 4096) return null;
  const acts = edgeKapaeActsFromJson(p["acts"] as unknown[]);
  if (acts.length !== (p["acts"] as unknown[]).length) return null;
  if (!Array.isArray(p["frontiers"]) || p["frontiers"].length > 8) return null;
  const frontiers: HandFrontierCarriage[] = [];
  for (const entry of p["frontiers"] as unknown[]) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return null;
    const e = entry as Record<string, unknown>;
    if (Object.keys(e).length !== 3 || typeof e["hand"] !== "string" || !Array.isArray(e["records"]) || e["records"].length > 4096 || !Array.isArray(e["snapshots"]) || e["snapshots"].length > 4096) return null;
    for (const raw of e["records"] as unknown[]) {
      if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
      const record = raw as Record<string, unknown>;
      if (Object.keys(record).length !== 2 || typeof record["body"] !== "object" || record["body"] === null || Array.isArray(record["body"]) || !Array.isArray(record["signatures"]) || record["signatures"].length > 256) return null;
    }
    const snapshots: Array<[string, string[]]> = [];
    for (const row of e["snapshots"] as unknown[]) {
      if (!Array.isArray(row) || row.length !== 2 || typeof row[0] !== "string" || !Array.isArray(row[1]) || row[1].length > 4096 || row[1].some((c) => typeof c !== "string")) return null;
      snapshots.push([row[0], row[1] as string[]]);
    }
    frontiers.push({ hand: e["hand"], records: e["records"] as unknown[], snapshots });
  }
  return { kind: "realm-admit-bundle", invite, realm: p["realm"], ...(typeof nexus === "string" ? { nexus } : {}), acts, frontiers };
}
