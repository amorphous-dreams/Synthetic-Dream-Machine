/**
 * face-join-operation — one face-join, issued once and published once, however many times a crash re-enters it.
 *
 * The act has two halves. Issuing seats the joinee, re-seals the standing chunks and signs the grant record. Publishing
 * lays that record on the face's PersonaGroup plane. Between them the issued bytes rest as an operation record sealed
 * under the acting face's atom seed on the same plane, keyed by the content id of the signed summons, so a crash after
 * the issue re-enters to the very record it issued, and a crash after the publish returns the outcome it published.
 */

import type { DeviceDelegationTiddler, LarTiddlerRecord, LarTiddlerStore } from "@lararium/mesh";
import { faceGrantRecordCid, faceGrantTitle, signFaceGrantRecord, type FaceGrantRecord } from "./face-grant-record.js";
import { runFaceJoin, type FaceJoinContext, type FaceJoinOutcome, type FaceJoinProvider, type FaceJoinSummons } from "./face-join.js";
import { readFaceOperation, writeFaceOperation } from "./face-operation-record.js";

type IssuedJoin = Extract<FaceJoinOutcome, { ok: true }>;

type JoinOperation =
  | { readonly state: "issued"; readonly outcome: IssuedJoin; readonly grantRecord: FaceGrantRecord; readonly grantTitle: string }
  | { readonly state: "complete"; readonly output: Record<string, unknown> };

/** Where the grant record lands: the face's PersonaGroup plane, as a store and the heads its history stands at. */
export interface GrantPlane {
  readonly store: LarTiddlerStore;
  heads(): readonly string[];
}

export interface FaceJoinOperationInput {
  readonly provider: FaceJoinProvider;
  readonly summons: FaceJoinSummons;
  readonly ctx: FaceJoinContext;
  /** The acting face's own root-signed edge, carried inside the grant record. */
  readonly founderEdge: DeviceDelegationTiddler;
  /** Signs as the acting face's atom. */
  readonly signGrant: (bytes: Uint8Array) => Promise<string>;
  readonly atomSeed: Uint8Array;
  /** Holds the operation records. */
  readonly operationStore: LarTiddlerStore;
  readonly grantPlane: GrantPlane;
}

/** One lane per group: joins of one face take their serials and publish in turn, so two never read one standing grant. */
const lanes = new Map<string, Promise<unknown>>();

export function runFaceJoinOperation(input: FaceJoinOperationInput): Promise<Record<string, unknown>> {
  const key = input.ctx.personaGroupId;
  const turn = (lanes.get(key) ?? Promise.resolve()).then(() => runOne(input), () => runOne(input));
  lanes.set(key, turn);
  const clear = (): void => { if (lanes.get(key) === turn) lanes.delete(key); };
  turn.then(clear, clear);
  return turn;
}

async function runOne(input: FaceJoinOperationInput): Promise<Record<string, unknown>> {
  const { provider, summons, ctx, founderEdge, signGrant, atomSeed, operationStore, grantPlane } = input;
  const signedInput = new TextEncoder().encode(JSON.stringify(summons));

  /** The serial of the grant standing at `title`: 0 where none stands or the bytes carry none. */
  const standingSerial = async (title: string): Promise<{ serial: number; text: string | null }> => {
    const standing = await grantPlane.store.get(title);
    if (!standing || standing.meta?.deleted) return { serial: 0, text: null };
    const text = typeof standing.tiddler.text === "string" ? standing.tiddler.text : null;
    let serial = 0;
    try { const read = (JSON.parse(text ?? "null") as { serial?: unknown } | null)?.serial; if (Number.isSafeInteger(read)) serial = read as number; } catch { serial = 0; }
    return { serial, text };
  };

  const publish = async (issued: Extract<JoinOperation, { state: "issued" }>): Promise<Record<string, unknown>> => {
    const standing = await standingSerial(issued.grantTitle);
    const ours = JSON.stringify(issued.grantRecord);
    // ONE TITLE PER (GROUP, JOINEE), ORDERED BY SERIAL: an absent or older grant gives way to this issue; the same serial
    // stands only as the same bytes; a newer grant stays, and this issue answers its own outcome without writing.
    if (standing.text === null || standing.serial < issued.grantRecord.serial) {
      await grantPlane.store.put(
        { tiddler: { title: issued.grantTitle, text: ours, kind: "face-join-grant" } as LarTiddlerRecord["tiddler"], meta: { authority: "lares-verb" } },
        { kind: "lares-verb", requestId: `face-grant-${issued.grantRecord.sig.slice(0, 12)}` },
      );
    } else if (standing.serial === issued.grantRecord.serial && standing.text !== ours) {
      throw new Error("[face-join] the grant title holds different issued bytes");
    }
    const output = {
      verb: "face-join", admitted: true, ...issued.outcome.grant,
      recordTitle: issued.grantTitle, recordCid: faceGrantRecordCid(issued.grantRecord),
      recordHeads: [...grantPlane.heads()],
    };
    await writeFaceOperation(operationStore, atomSeed, signedInput, { state: "complete", output } satisfies JoinOperation);
    return output;
  };

  const prior = await readFaceOperation<JoinOperation>(operationStore, atomSeed, signedInput);
  if (prior?.state === "complete") return prior.output;
  if (prior?.state === "issued") return publish(prior);

  const outcome = await runFaceJoin(provider, summons, ctx);
  if (!outcome.ok) return { verb: "face-join", admitted: false, reason: outcome.reason };
  const { kind: _grantKind, ...grantBody } = outcome.grant;
  void _grantKind;
  const grantTitle = faceGrantTitle(ctx.personaGroupId, outcome.grant.joineeAgentIdHex);
  const serial = (await standingSerial(grantTitle)).serial + 1;
  const grantRecord = await signFaceGrantRecord({ kind: "face-join-grant/v1", groupId: ctx.personaGroupId, ...grantBody, serial, founderEdge }, signGrant);
  const issued = { state: "issued", outcome, grantRecord, grantTitle } satisfies JoinOperation;
  await writeFaceOperation(operationStore, atomSeed, signedInput, issued);
  return publish(issued);
}
