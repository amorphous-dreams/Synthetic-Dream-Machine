/**
 * face-seat-summons — A JOINED, UNSEATED LEAF SUMMONS ITS OWN SEAT.
 *
 * The person's `fleet join` is the intent ("join = intent; idempotent", ruled 2026-10-29 on the Founding Walk, W4): once the
 * join landed, the leaf's daemon island carries that act out by issuing the one `face-join` summons on the face's intents
 * plane, pinned to the founding hearth, which answers through its intent door (`faceJoinEffect`). Before this, nothing in
 * a browser leaf issued the summons, and a node joinee needed a hand step (`lares intent issue face-join`).
 *
 * The binds, each a named answer and never a write:
 *   · `seated`    — the veil already knows the group: nothing to summon;
 *   · `standing`  — a summons of this atom already stands on the plane (a second pass, a second boot): no duplicate.
 *                   Idempotence rides the plane, since a ContactCard is not byte-stable across derivations;
 *   · `aside` / `unknown` — the leaf's own edge stands aside (kapae'd) or the dyad reads nothing: never summon;
 *   · `no-edge` / `no-card` / `no-hearth` — a stranger (no root-signed edge), no card to carry, no founding hearth
 *                   admitted on the persona log to pin.
 *
 * Meme: lar:///ha.ka.ba/lararium/keyhive/face-seat-summons
 */
import type { DocHandle, LarDoc, IntentVerbRegistry, IntentView, DeviceDelegationTiddler, IntentSigner } from "@lararium/mesh";
import { requestFaceJoin } from "./face-intent-door.js";
import type { FaceJoinSummons } from "./face-join.js";

export type SeatSummonsAnswer = "issued" | "seated" | "standing" | "aside" | "unknown" | "no-edge" | "no-card" | "no-hearth";

export interface SeatSummonsPorts {
  readonly group: string;
  readonly atom: IntentSigner;
  readonly plane: DocHandle<LarDoc>;
  readonly verbs: IntentVerbRegistry;
  /** Whether the veil already knows the group (the seat landed). */
  readonly seated: () => Promise<boolean>;
  /** This vessel's own ContactCard bytes, or null where it holds none yet. */
  readonly contactCard: () => Promise<Uint8Array | null>;
  /** The root-signed edge this vessel presents; null on a vessel that joined no face. */
  readonly deviceEdge: DeviceDelegationTiddler | null;
  /** The dyad's reading of this vessel's own edge: never summon from an edge set aside. */
  readonly standing: (device: string) => Promise<"stands" | "aside" | "unknown">;
  /** The persona log's records: the earliest admission names the founding hearth the summons pins. */
  readonly personaRecords: () => readonly unknown[];
  /** The intents plane as read: a standing summons of this atom means no second one. */
  readonly view: () => Promise<IntentView>;
  readonly log: (message: string) => void;
}

/** The device key of the earliest admission act on a persona log, or null. Read as data; the hearth door judges the rest. */
export function firstAdmittedDevice(records: readonly unknown[]): string | null {
  let first: { seq: number; deviceKey: string } | null = null;
  for (const raw of records) {
    // A signed persona act: `body.act`, `body.seq`, and its fields flat on the body (`persona-act.ts` projects them so).
    const body = (raw as { body?: { act?: unknown; seq?: unknown; deviceKey?: unknown } } | null)?.body;
    if (!body || body.act !== "admission" || typeof body.deviceKey !== "string") continue;
    const seq = typeof body.seq === "number" ? body.seq : Number.MAX_SAFE_INTEGER;
    if (first === null || seq < first.seq) first = { seq, deviceKey: body.deviceKey };
  }
  return first?.deviceKey ?? null;
}

/** A summons of `issuer` that still stands: open or answered, never void, and never one the hearth refused. */
export function standingOwnSummons(view: IntentView, issuer: string): boolean {
  const own = issuer.toLowerCase();
  return view.intents.some((state) => state.verb === "face-join" && state.issuer.toLowerCase() === own && state.status !== "void"
    && !state.slots.some((slot) => (slot.winner?.entry.body["result"] as { admitted?: unknown } | undefined)?.admitted === false));
}

export function makeSeatSummons(ports: SeatSummonsPorts): { summon(): Promise<SeatSummonsAnswer> } {
  let inFlight: Promise<SeatSummonsAnswer> | null = null;
  const pass = async (): Promise<SeatSummonsAnswer> => {
    if (await ports.seated()) return "seated";
    const edge = ports.deviceEdge;
    if (!edge) return "no-edge";
    const standing = await ports.standing(edge.deviceVerifyingKey);
    if (standing !== "stands") return standing;
    if (standingOwnSummons(await ports.view(), ports.atom.key)) return "standing";
    const hearth = firstAdmittedDevice(ports.personaRecords());
    if (!hearth) return "no-hearth";
    const card = await ports.contactCard();
    if (!card) return "no-card";
    const summons: FaceJoinSummons = { kind: "face-join/v1", contactCard: new TextDecoder().decode(card), deviceEdge: edge };
    const id = await requestFaceJoin({ group: ports.group, plane: ports.plane, atom: ports.atom, hearthAtom: hearth, summons, verbs: ports.verbs });
    ports.log(`the seat summons issued (${id.slice(0, 12)}…), pinned to the founding hearth ${hearth.slice(0, 12)}…`);
    return "issued";
  };
  // One pass at a time: a wake during a pass waits for it, and reads the plane the pass wrote.
  const summon = (): Promise<SeatSummonsAnswer> => {
    if (inFlight) return inFlight.then(() => summon());
    inFlight = pass().finally(() => { inFlight = null; });
    return inFlight;
  };
  return { summon };
}
