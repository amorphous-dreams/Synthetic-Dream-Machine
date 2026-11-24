/**
 * hearth-roster — who is home: the face each vessel wears and who holds that slot, the seats in two grains, the lanes a
 * seat claims and the vota still waiting. One shape serves the CLI (`lares vessel roster`), the MCP seat (`vessel_roster`)
 * and the wake block "Lares hearth (who is home)".
 *
 * TWO GRAINS, ONE SHAPE. A LOCAL seat stands by presence: a session bound on this vessel's socket, which the kernel holds
 * while the process on the other end holds it, so the seat stands exactly as long as its process does and no timer decides
 * it. A FAR seat reads by its last signed act on a face's intent plane: the act names it, its signature binds it, and no
 * global now stands behind it, so nobody far ever reads "online", only "last heard". Both rows carry the same fields and
 * name their grain.
 *
 * NO CLOCK, ONE ORDER. Every list sorts by what it holds (a face ordinal, a hand, an id or a cid), and "last heard" names the
 * signer's acts that none of its own later acts cite (its causal tips), never a time. The same house reads the same roster.
 *
 * LANES. The house records one claim a seat makes on work: an intent claim on the face intent plane (claim, takeover,
 * release). No store records a seat's claim on a leap or a road meme, and the swarm's lane-state rows wait on a lead's
 * trust (seat-harness), so the lanes read the plane's claims alone and the roster names that gap.
 *
 * WHAT PRINTS. A verb prints only as a short token and an atom or a cid only as hex: a far device signs what it writes, and
 * the roster carries no free text from it into a reader's context.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/hearth-roster
 */
import type { IntentAudience } from "./intent-entry.js";
import type { IntentRecord, IntentView } from "./intent-read.js";

export type HearthHand = "tab" | "cli" | "watcher" | "seat";
export type HearthStanding = "stands" | "aside" | "unknown";

/** One session bound on this vessel's socket: the kernel holds it while its process holds it. */
export interface HearthLocalSeat {
  readonly session: string;
  readonly face: number;
  readonly hand: HearthHand;
  readonly anchor: "place" | "nexus";
}

/** One signer on a face's intent plane: its signed acts, and the ones none of its own later acts cite. */
export interface HearthFarSeat {
  readonly atom: string;
  readonly face: number;
  /** This vessel's own face atom: the local seats above sign through it. */
  readonly self: boolean;
  readonly standing: HearthStanding;
  readonly acts: number;
  readonly lastHeard: readonly { readonly entry: string; readonly cid: string }[];
}

/** One claim standing on an intent. */
export interface HearthLane { readonly face: number; readonly intent: string; readonly verb: string; readonly claimant: string; readonly claim: string }

/** One intent still waiting: on an answer, an outcome, or a frontier the reader does not hold. */
export interface HearthVotum {
  readonly face: number; readonly intent: string; readonly verb: string; readonly issuer: string; readonly audience: string;
  readonly waitsOn: "answer" | "outcome" | "frontier";
  /** The atom that owes the outcome (the claimant, the approved executor, the pinned device), or null where none does. */
  readonly owedBy: string | null;
  readonly claimed: boolean;
}

/** What one face's intent plane gives the roster. */
export interface HearthPlaneDigest {
  readonly face: number;
  readonly self: string;
  readonly far: readonly HearthFarSeat[];
  readonly lanes: readonly HearthLane[];
  readonly vota: readonly HearthVotum[];
}

/** One seat row, either grain. */
export interface HearthSeat {
  readonly grain: "local" | "far";
  readonly seat: string;
  readonly face: number;
  /** `ai` for a seat hand (a harness), `hand` for a person's hand, `device` for a far signer. */
  readonly kind: "ai" | "hand" | "device";
  readonly hand?: HearthHand;
  readonly anchor?: "place" | "nexus";
  readonly self?: boolean;
  readonly standing?: HearthStanding;
  readonly acts?: number;
  readonly lastHeard?: readonly { readonly entry: string; readonly cid: string }[];
}

export interface HearthRoster {
  readonly grain: { readonly local: string; readonly far: string };
  /** The one worn slot this vessel holds, who holds it, and the seats known to act under another face. */
  readonly rotation: {
    readonly vessel: "this vessel";
    readonly worn: number | null;
    readonly lit: readonly number[];
    readonly lent: readonly number[] | null;
    readonly holders: readonly string[];
    readonly underOther: readonly { readonly seat: string; readonly face: number }[];
  };
  readonly seats: readonly HearthSeat[];
  /** The hand that asked for this reading: `seat` (a harness) or `hand`. */
  readonly asker: "seat" | "hand";
  readonly lanes: readonly HearthLane[];
  readonly lanesGap: string;
  readonly vota: readonly HearthVotum[];
  readonly unread: readonly { readonly face: number; readonly reason: string }[];
  /** Every row the house holds, kept or not (`far` leaves this vessel's own atom out). */
  readonly counts: { readonly local: number; readonly far: number; readonly lanes: number; readonly vota: number };
  /** The rows the vessel left out of the body: each face keeps `HEARTH_ROWS` seats here, seats far, lanes and vota at most. */
  readonly more: { readonly local: number; readonly far: number; readonly lanes: number; readonly vota: number };
}

/**
 * The rows one face keeps in each list (seats here, seats far, lanes, vota; and a far seat's tips): a count of rows, never a
 * clock, so the body stays bounded whatever a far device writes. The wake shows the same eight.
 */
export const HEARTH_ROWS = 8;

export const HEARTH_GRAIN = {
  local: "by presence: the kernel holds each session's socket, so a seat stands while its process stands",
  far: "by last signed act on the face intent plane: no global now stands, so nobody far reads online, only last heard",
} as const;

export const HEARTH_LANES_GAP =
  "no store records a seat's claim on a leap or a road meme (the swarm's lane-state rows wait on a lead's trust), so lanes read the intent plane's claims alone";

const HEX = /^[0-9a-f]+$/;
const TOKEN = /^[a-z0-9][a-z0-9:._-]{0,63}$/;
/** A verb or a capability as a short token, else `?`: no free text crosses from a far signer. */
export const hearthToken = (value: unknown): string => (typeof value === "string" && TOKEN.test(value) ? value : "?");
const hex = (value: unknown): string => (typeof value === "string" && HEX.test(value) ? value : "?");
const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const audienceOf = (a: IntentAudience): string => (a.mode === "class" ? `class:${hearthToken(a.capability)}` : a.mode);

const r0 = (r: IntentRecord, key: string): unknown => r.entry.body[key];

interface Act { readonly cid: string; readonly signer: string; readonly entry: string; readonly cites: readonly string[] }

/**
 * The roster's reading of one face's intent plane: each signer with its acts and its causal tips, each standing claim, and
 * each intent still waiting. `self` names this vessel's own face atom.
 */
export function planeRosterOf(view: IntentView, at: { readonly face: number; readonly self: string }): HearthPlaneDigest {
  const self = at.self.toLowerCase();
  // An intent's later acts name it by its id; the id maps to the intent's own cid, so a cite reads as one cid space.
  const cidOfId = new Map(view.intents.map((i) => [i.id, i.cid]));
  const acts = new Map<string, Act>();
  const add = (r: IntentRecord, named: readonly unknown[]): void => {
    const b = r.entry.body;
    const cites = [...b.refs, ...named.map((v) => (typeof v === "string" ? cidOfId.get(v) ?? v : ""))].filter((c) => c !== "");
    acts.set(r.cid, { cid: r.cid, signer: r.entry.signer.toLowerCase(), entry: b.entry, cites });
  };
  for (const i of view.intents) {
    acts.set(i.cid, { cid: i.cid, signer: i.issuer.toLowerCase(), entry: "intent", cites: [] });
    for (const r of i.asks) add(r, [r.entry.body["intent"]]);
    for (const r of i.answers) add(r, [r.entry.body["ask"]]);
    for (const r of i.claims) add(r, [r.entry.body["intent"]]);
    if (i.claim && !acts.has(i.claim.cid)) add(i.claim, [r0(i.claim, "claim"), r0(i.claim, "intent")]);
    for (const r of i.outcomes) add(r, [r.entry.body["cause"]]);
  }
  for (const r of view.strayAnswers) add(r, [r.entry.body["ask"]]);
  const bySigner = new Map<string, Act[]>();
  for (const act of acts.values()) bySigner.set(act.signer, [...(bySigner.get(act.signer) ?? []), act]);
  const far: HearthFarSeat[] = [...bySigner].sort(([a], [b]) => byText(a, b)).map(([atom, own]) => {
    const cited = new Set(own.flatMap((a) => a.cites));
    const tips = own.filter((a) => !cited.has(a.cid)).sort((a, b) => byText(a.cid, b.cid)).map((a) => ({ entry: hearthToken(a.entry), cid: a.cid }));
    return { atom: hex(atom), face: at.face, self: atom === self, standing: view.standing(atom), acts: own.length, lastHeard: tips };
  });
  const lanes: HearthLane[] = view.intents.filter((i) => i.claim !== null && i.status !== "void")
    .map((i) => ({ face: at.face, intent: hex(i.id), verb: hearthToken(i.verb), claimant: hex(i.claim!.entry.signer.toLowerCase()), claim: hex(i.claim!.cid) }));
  const vota: HearthVotum[] = [];
  for (const i of view.intents) {
    if (i.status !== "open" && i.status !== "unknown-frontier") continue;
    const base = { face: at.face, intent: hex(i.id), verb: hearthToken(i.verb), issuer: hex(i.issuer.toLowerCase()), audience: audienceOf(i.audience), claimed: i.claim !== null };
    const claimant = i.claim ? hex(i.claim.entry.signer.toLowerCase()) : null;
    if (i.status === "unknown-frontier") { vota.push({ ...base, waitsOn: "frontier", owedBy: null }); continue; }
    if (i.audience.mode === "asks") {
      const answer = i.answer;
      if (answer === null || answer === "contested") { vota.push({ ...base, waitsOn: "answer", owedBy: null }); continue; }
      // A deny answers the votum: nothing stays owed on it.
      if (answer.entry.body["verdict"] !== "approve") continue;
      vota.push({ ...base, waitsOn: "outcome", owedBy: claimant ?? hex(answer.entry.body["executor"]) });
      continue;
    }
    vota.push({ ...base, waitsOn: "outcome", owedBy: claimant ?? (i.audience.mode === "pinned" ? hex(i.audience.atom.toLowerCase()) : null) });
  }
  return { face: at.face, self: hex(self), far, lanes, vota };
}


const localId = (session: string): string => `s-${String(session).replace(/[^0-9a-zA-Z]/g, "").slice(0, 8).toLowerCase()}`;
const handOrder: Record<HearthHand, number> = { cli: 0, tab: 1, watcher: 2, seat: 3 };

/** The roster from what one vessel reads: its worn slot, its bound sessions, and the planes of the faces it wears. */
export function composeHearthRoster(input: {
  readonly worn: number | null;
  readonly lit: readonly number[];
  readonly lent: readonly number[] | null;
  readonly local: readonly HearthLocalSeat[];
  readonly asker: "seat" | "hand";
  readonly planes: readonly HearthPlaneDigest[];
  readonly unread: readonly { readonly face: number; readonly reason: string }[];
}): HearthRoster {
  const local = [...input.local].sort((a, b) => a.face - b.face || handOrder[a.hand] - handOrder[b.hand] || byText(a.session, b.session));
  const localKept = perFace(local, (s) => s.face);
  const localSeats: HearthSeat[] = localKept.kept.map((s) => ({ grain: "local", seat: localId(s.session), face: s.face, kind: s.hand === "seat" ? "ai" : "hand", hand: s.hand, anchor: s.anchor }));
  const planes = [...input.planes].sort((a, b) => a.face - b.face);
  // The far rows a face keeps: its own atom first (the local seats sign through it), then the busiest signers, then by atom.
  const farAll = planes.flatMap((p) => [...p.far].sort((a, b) => Number(b.self) - Number(a.self) || b.acts - a.acts || byText(a.atom, b.atom)));
  const farKept = perFace(farAll, (f) => f.face);
  const farSeats: HearthSeat[] = farKept.kept.map((f) => ({
    grain: "far" as const, seat: f.atom.slice(0, 12), face: f.face, kind: "device" as const, self: f.self, standing: f.standing, acts: f.acts, lastHeard: f.lastHeard.slice(0, HEARTH_ROWS),
  }));
  const holders = input.worn === null ? [] : localSeats.filter((s) => s.face === input.worn).map((s) => s.seat);
  const underOther = localSeats.filter((s) => s.face !== input.worn).map((s) => ({ seat: s.seat, face: s.face }));
  const lanesKept = perFace(planes.flatMap((p) => p.lanes), (l) => l.face);
  const votaKept = perFace(planes.flatMap((p) => p.vota), (v) => v.face);
  const lanes = lanesKept.kept, vota = votaKept.kept;
  return {
    grain: { local: HEARTH_GRAIN.local, far: HEARTH_GRAIN.far },
    rotation: {
      vessel: "this vessel", worn: input.worn, lit: [...input.lit].sort((a, b) => a - b),
      lent: input.lent === null ? null : [...input.lent].sort((a, b) => a - b), holders, underOther,
    },
    seats: [...localSeats, ...farSeats],
    asker: input.asker,
    lanes, lanesGap: HEARTH_LANES_GAP, vota,
    unread: [...input.unread].sort((a, b) => a.face - b.face || byText(a.reason, b.reason)),
    counts: { local: local.length, far: farAll.filter((f) => !f.self).length, lanes: lanes.length + lanesKept.more, vota: vota.length + votaKept.more },
    more: { local: localKept.more, far: farKept.more, lanes: lanesKept.more, vota: votaKept.more },
  };
}

/** The rows each face keeps (`HEARTH_ROWS` at most, in the order given), and how many it leaves out. */
function perFace<T>(rows: readonly T[], faceOf: (row: T) => number): { readonly kept: T[]; readonly more: number } {
  const seen = new Map<number, number>();
  const kept: T[] = [];
  let more = 0;
  for (const row of rows) {
    const n = seen.get(faceOf(row)) ?? 0;
    seen.set(faceOf(row), n + 1);
    if (n < HEARTH_ROWS) kept.push(row); else more++;
  }
  return { kept, more };
}

const short = (id: string): string => id.slice(0, 12);
const kindWords = (s: HearthSeat): string => (s.kind === "ai" ? `an AI seat (${s.hand})` : `a hand (${s.hand})`);
const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** One votum's line, in plain words. */
export function hearthVotumLine(v: HearthVotum): string {
  const head = `h${v.face} ${v.verb} (intent ${short(v.intent)}, from ${short(v.issuer)}, audience ${v.audience})`;
  if (v.waitsOn === "frontier") return `${head}: waits on a frontier this vessel does not hold`;
  if (v.waitsOn === "answer") return `${head}: waits on an answer`;
  return `${head}: waits on an outcome, ${v.owedBy ? `owed by ${short(v.owedBy)}${v.claimed ? " (claimed)" : ""}` : "unclaimed"}`;
}

/** One seat's line, either grain, in plain words. */
export function hearthSeatLine(s: HearthSeat): string {
  if (s.grain === "local") return `${s.seat}  h${s.face}  ${kindWords(s)}, anchored at the ${s.anchor}`;
  const heard = (s.lastHeard ?? []).map((t) => `${t.entry} ${short(t.cid)}`).join(", ") || "no act";
  return `${s.seat}  h${s.face}  ${s.self ? "this vessel's own atom, " : ""}last heard at ${heard} (${plural(s.acts ?? 0, "act", "acts")}, ${s.standing})`;
}

/** The rotation line: the worn face, who holds it, and each seat acting under another face. */
export function hearthRotationLine(r: HearthRoster["rotation"], seats: readonly HearthSeat[]): string {
  const named = (id: string): string => { const s = seats.find((x) => x.seat === id); return s ? `${id} (${kindWords(s)})` : id; };
  const worn = r.worn === null ? "this vessel wears no face (it stands at its floor)" : `this vessel wears h${r.worn}`;
  const held = r.worn === null ? "" : r.holders.length > 0 ? `, held by ${r.holders.map(named).join(" and ")}` : ", and no session holds it now";
  const lit = r.lit.length > 0 ? `; lit beside it: ${r.lit.map((f) => `h${f}`).join(", ")}` : "";
  const other = r.underOther.map((o) => `; ${o.seat} acts under h${o.face}`).join("");
  return `rotation: ${worn}${held}${lit}${other}`;
}

/** The line naming the rows the vessel left out, where it left any. */
const moreLine = (n: number): string[] => (n > 0 ? [`  +${n} more (each face keeps ${HEARTH_ROWS} rows)`] : []);

/** The whole roster as plain lines: the rotation first, then the seats here and far, the lanes, the vota and any plane unread. */
export function renderHearthRoster(r: HearthRoster): string[] {
  const local = r.seats.filter((s) => s.grain === "local");
  const far = r.seats.filter((s) => s.grain === "far");
  const lines = [
    `Lares hearth (who is home): ${plural(r.counts.local, "seat", "seats")} here · ${r.counts.far} heard from afar · ${plural(r.counts.lanes, "lane", "lanes")} · ${plural(r.counts.vota, "open votum", "open vota")}`,
    hearthRotationLine(r.rotation, r.seats),
    `here, ${r.grain.local}:`,
    ...(local.length > 0 ? local.map((s) => `  ${hearthSeatLine(s)}`) : ["  no session stands on this vessel's socket"]),
    ...moreLine(r.more.local),
    `far, ${r.grain.far}:`,
    ...(far.length > 0 ? far.map((s) => `  ${hearthSeatLine(s)}`) : ["  no signed act reads on a worn face's intent plane"]),
    ...moreLine(r.more.far),
    "lanes (intent claims):",
    ...r.lanes.map((l) => `  h${l.face} ${l.verb} (intent ${short(l.intent)}): claimed by ${short(l.claimant)}`),
    ...moreLine(r.more.lanes),
    `  ${r.lanes.length === 0 ? "no claim stands; " : ""}${r.lanesGap}`,
    "open vota:",
    ...(r.vota.length > 0 ? r.vota.map((v) => `  ${hearthVotumLine(v)}`) : ["  none waits"]),
    ...moreLine(r.more.vota),
    ...r.unread.map((u) => `unread: h${u.face}'s intent plane (${u.reason})`),
  ];
  return lines;
}
