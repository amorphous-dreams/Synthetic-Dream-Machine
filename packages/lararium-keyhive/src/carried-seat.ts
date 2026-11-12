/**
 * carried-seat — THE SEAT RIDES THE FILES: a joined leaf takes its seat in a face's key agreement with no road between
 * it and the vessel that holds the face (device-capabilities-2026#/device-seats, ruling 7).
 *
 * A fleet join's three files pin the face on the joining vessel. Its SEAT (the group taking the new device, so the device
 * reads what the face seals) rides a summons on the face's intents plane and a grant on its persona plane, and both
 * planes cross by sync. Two leaves with no relay hold no such crossing, so the same two records cross by hand instead:
 *
 *   SEAT-REQUEST  the joined leaf's own `face-join` intent, signed by its atom and pinned to the founding hearth: the
 *                 very entry `requestFaceJoin` writes on the plane, carrying its key-agreement card and the edge the root
 *                 signed for it. The card mints at the landing, so this file follows the answer.
 *   SEAT-GRANT    the hearth's signed `FaceGrantRecord`, as its intent door wrote it on the persona plane: the group's
 *                 admitting events under the founder's atom and its root-signed edge.
 *
 * NOTHING NEW DECIDES. The root holder's vessel lays the carried intent on its own intents plane and its standing door
 * answers it through the one gate (`faceJoinEffect`); the joined leaf keeps the carried grant beside its other carried
 * records, and its standing seat reads it there, verifies it as it verifies a synced one, ingests it and runs the Lift.
 * These helpers shape and check the two files and move them between a file and a document. They sign nothing.
 *
 * Meme: lar:///ha.ka.ba/lararium/keyhive/carried-seat
 */
import {
  buildIntent, faceIntentVerbs, intentEntryCid, intentEntryRecordsOfGroup, intentId, readIntentEntry, storedLarRecord, tiddlerText, writeIntentEntry,
  type DeviceDelegationTiddler, type DocHandle, type IntentSigner, type LarDoc, type SignedIntentEntry,
} from "@lararium/mesh";
import { faceJoinNonce } from "./face-intent-door.js";
import { FACE_GRANT_PREFIX, faceGrantRecordCid, faceGrantTitle, verifyFaceGrantRecord, type FaceGrantRecord, type FaceGrantVerdict, type FaceGrantVerifyContext } from "./face-grant-record.js";
import type { FaceJoinSummons } from "./face-join.js";

export interface FleetSeatRequest { readonly kind: "fleet-seat-request"; readonly personaGroup: string; readonly entry: SignedIntentEntry }
/** `outcome`: the pinned hearth's signed outcome for the request this grant answers (its `cause` names the intent, its
 *  `recordCid` the record). The joined leaf verifies the pair against its own request before it keeps the grant. */
export interface FleetSeatGrant { readonly kind: "fleet-seat-grant"; readonly personaGroup: string; readonly title: string; readonly record: FaceGrantRecord; readonly outcome?: SignedIntentEntry }

export const CARRIED_SEAT_REFUSALS = [
  "seat-request-malformed", "seat-request-other-face", "seat-request-other-verb",
  "seat-grant-malformed", "seat-grant-other-face", "seat-grant-other-device",
] as const;
export type CarriedSeatRefusalName = (typeof CARRIED_SEAT_REFUSALS)[number];
export class CarriedSeatRefused extends Error {
  override readonly name = "CarriedSeatRefused";
  constructor(readonly refusal: CarriedSeatRefusalName | string, detail: string) { super(`${refusal}: ${detail}`); }
}

const bare = (key: string): string => key.trim().toLowerCase().replace(/^0x/, "");
const record = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** The joined leaf's seat request: its own `face-join` intent, pinned to the founding hearth's atom, as a file. */
export async function composeSeatRequest(input: {
  readonly group: string; readonly atom: IntentSigner; readonly hearthAtom: string;
  readonly contactCard: string; readonly deviceEdge: DeviceDelegationTiddler;
}): Promise<FleetSeatRequest> {
  const summons: FaceJoinSummons = { kind: "face-join", contactCard: input.contactCard, deviceEdge: input.deviceEdge };
  const audience = { mode: "pinned" as const, atom: bare(input.hearthAtom) };
  const entry = await buildIntent({ group: input.group, signer: input.atom, verb: "face-join", args: { summons }, nonce: faceJoinNonce(input.atom.key, audience), audience, verbs: faceIntentVerbs() });
  return { kind: "fleet-seat-request", personaGroup: input.group, entry };
}

/** Read a carried seat request for `group`: its shape alone. The intent door judges its signature, edge and standing. */
export function readSeatRequest(value: unknown, group: string): FleetSeatRequest {
  if (!record(value) || value["kind"] !== "fleet-seat-request" || !record(value["entry"]) || !record((value["entry"] as Record<string, unknown>)["body"])) throw new CarriedSeatRefused("seat-request-malformed", "the file does not read as a seat request.");
  if (value["personaGroup"] !== group) throw new CarriedSeatRefused("seat-request-other-face", "the seat request names another face.");
  const entry = value["entry"] as unknown as SignedIntentEntry;
  const body = entry.body as unknown as Record<string, unknown>;
  if (body["verb"] !== "face-join" || body["entry"] !== "intent" || body["group"] !== group) throw new CarriedSeatRefused("seat-request-other-verb", "the carried intent asks something other than this face's seat.");
  return { kind: "fleet-seat-request", personaGroup: group, entry };
}

/** The device a seat request asks a seat for: the key its presented edge delegates to. */
export function seatRequestDevice(request: FleetSeatRequest): string {
  const summons = ((request.entry.body as unknown as { args?: { summons?: FaceJoinSummons } }).args)?.summons;
  const key = summons?.deviceEdge?.deviceVerifyingKey;
  if (typeof key !== "string" || !/^[0-9a-fA-F]{64}$/.test(key)) throw new CarriedSeatRefused("seat-request-malformed", "the seat request presents no device edge.");
  return key.toLowerCase();
}

/** Lay a carried seat request on the root holder's intents plane, exactly where a synced leaf's own would land. Answers its entry's id. */
export function placeSeatRequest(plane: DocHandle<LarDoc>, request: FleetSeatRequest): string {
  plane.change((draft) => writeIntentEntry(draft, request.entry));
  return intentEntryCid(request.entry);
}

/** The grant the hearth's door wrote for `device` on its persona plane, as a file; null while none stands there. */
export function seatGrantOnPlane(plane: LarDoc | undefined | null, group: string, device: string): FleetSeatGrant | null {
  const title = faceGrantTitle(group, device);
  const raw = tiddlerText(plane?.tiddlers?.[title]);
  if (typeof raw !== "string") return null;
  try { return { kind: "fleet-seat-grant", personaGroup: group, title, record: JSON.parse(raw) as FaceGrantRecord }; } catch { return null; }
}

/**
 * THE GRANT THAT ANSWERS THIS REQUEST, never merely the one standing for its device. The root holder's door answers each
 * intent once and signs an outcome naming the intent (`cause`) and the grant record it wrote (`recordCid`); the grant at the
 * device's title answers this request only where its content address is the one this intent's outcome names. A request
 * whose card the leaf minted again is another intent, so a grant an earlier intent left standing never answers it.
 * `pending`: the door has not answered this intent yet. `refused`: its outcome names no grant (the gate did not pass).
 */
export type SeatAnswer = { readonly state: "granted"; readonly grant: FleetSeatGrant } | { readonly state: "pending" } | { readonly state: "refused"; readonly reason: string };
export function seatGrantAnswering(intents: LarDoc | undefined | null, persona: LarDoc | undefined | null, request: FleetSeatRequest): SeatAnswer {
  const body = request.entry.body as unknown as { issuer: string; verb: string; args: unknown; nonce: string; audience?: { mode?: string; atom?: string } };
  const cause = intentId({ issuer: body.issuer, verb: body.verb, args: body.args, nonce: body.nonce });
  const hearth = body.audience?.mode === "pinned" && typeof body.audience.atom === "string" ? bare(body.audience.atom) : null;
  if (hearth === null) return { state: "refused", reason: "the request pins no hearth" };
  // The outcome the pinned hearth signed for this intent alone, its signature checked.
  const found = intentEntryRecordsOfGroup(intents, request.personaGroup)
    .map((raw) => readIntentEntry(raw, { group: request.personaGroup, authorize: (signer) => bare(signer) === hearth }))
    .map((read) => (read.ok ? { entry: read.entry, body: read.entry.body as unknown as { entry?: unknown; cause?: unknown; result?: Record<string, unknown> } } : null))
    .find((r) => r?.body.entry === "outcome" && r.body.cause === cause);
  if (!found) return { state: "pending" };
  const outcome = found.body;
  const recordCid = outcome.result?.["recordCid"];
  if (typeof recordCid !== "string") return { state: "refused", reason: String(outcome.result?.["reason"] ?? "the door answered this intent and wrote no grant") };
  const standing = seatGrantOnPlane(persona, request.personaGroup, seatRequestDevice(request));
  // The outcome landed before its grant reached this replica, or a later intent's grant stands: wait for the one it names.
  return standing !== null && faceGrantRecordCid(standing.record) === recordCid ? { state: "granted", grant: { ...standing, outcome: found.entry } } : { state: "pending" };
}

/** Read a carried seat grant on the joined leaf: its face and its device. The seat's own verifier judges the signature and the founder's standing. */
export function readSeatGrant(value: unknown, self: { readonly group: string; readonly deviceKey: string }): FleetSeatGrant {
  if (!record(value) || value["kind"] !== "fleet-seat-grant" || typeof value["title"] !== "string" || !record(value["record"])) throw new CarriedSeatRefused("seat-grant-malformed", "the file does not read as a seat grant.");
  const rec = value["record"] as unknown as FaceGrantRecord;
  if (rec.kind !== "face-join-grant" || !Array.isArray(rec.capEvents) || typeof rec.sig !== "string") throw new CarriedSeatRefused("seat-grant-malformed", "the file carries no signed grant.");
  if (value["personaGroup"] !== self.group || rec.groupId !== self.group) throw new CarriedSeatRefused("seat-grant-other-face", "the seat grant seats another face.");
  if (value["title"] !== faceGrantTitle(self.group, self.deviceKey) || !bare(String(rec.joineeAgentIdHex)).endsWith(bare(self.deviceKey))) throw new CarriedSeatRefused("seat-grant-other-device", "the seat grant seats another device than this one.");
  const outcome = record(value["outcome"]) ? value["outcome"] as unknown as SignedIntentEntry : undefined;
  return { kind: "fleet-seat-grant", personaGroup: self.group, title: value["title"], record: rec, ...(outcome ? { outcome } : {}) };
}

/** Keep a carried grant in a document this vessel holds (its secret home), at the grant's own title. */
export function keepCarriedSeatGrant(home: DocHandle<LarDoc>, grant: FleetSeatGrant): void {
  home.change((draft) => {
    draft.tiddlers[grant.title] = storedLarRecord(grant.title, { text: JSON.stringify(grant.record) }, "carried-seat");
    if (grant.outcome) draft.tiddlers[`${grant.title}${ANSWER_SUFFIX}`] = storedLarRecord(`${grant.title}${ANSWER_SUFFIX}`, { text: JSON.stringify(grant.outcome) }, "carried-seat");
  });
}

/** The kept outcome rests beside its grant, at the grant's title with this suffix. */
const ANSWER_SUFFIX = "#answer";

/** The carried grant this vessel keeps for one device of one face, with the outcome it answers, or null. */
export function keptSeatGrant(home: LarDoc | undefined | null, group: string, deviceKey: string): FleetSeatGrant | null {
  const title = faceGrantTitle(group, deviceKey);
  const raw = tiddlerText(home?.tiddlers?.[title]);
  if (typeof raw !== "string") return null;
  try {
    const answer = tiddlerText(home?.tiddlers?.[`${title}${ANSWER_SUFFIX}`]);
    return { kind: "fleet-seat-grant", personaGroup: group, title, record: JSON.parse(raw) as FaceGrantRecord,
      ...(typeof answer === "string" ? { outcome: JSON.parse(answer) as SignedIntentEntry } : {}) };
  } catch { return null; }
}

/** Drop a kept grant and its outcome: a grant that fails verification never stays where the seat reads it. */
export function dropCarriedSeatGrant(home: DocHandle<LarDoc>, title: string): void {
  home.change((draft) => { delete draft.tiddlers[title]; delete draft.tiddlers[`${title}${ANSWER_SUFFIX}`]; });
}

/**
 * THE FULL VERIFICATION OF A CARRIED GRANT, run before the leaf keeps it, before a place session stands on it and before the
 * Lift moves anything under the face: (1) it answers THIS leaf's own request (the pinned hearth's signed outcome for the very
 * intent the leaf composes names this record, `seatGrantAnswering`); (2) the record verifies (`verifyFaceGrantRecord`: its
 * group and joinee, the founder's edge under the pinned root and its persona-KEL head, the founder's standing off this
 * vessel's fold of the fleet board, and the signature under the founder's key). A forged file, or a grant an earlier intent
 * left, fails here by name. `pending`: proof this vessel does not hold yet (the founder's standing unread), never a pass.
 */
export async function verifyCarriedSeatGrant(input: { readonly grant: FleetSeatGrant; readonly request: FleetSeatRequest; readonly ctx: FaceGrantVerifyContext }): Promise<FaceGrantVerdict> {
  const { grant, request, ctx } = input;
  if (!grant.outcome) return { ok: false, reason: "the grant carries no outcome naming the request it answers" };
  const intents = { tiddlers: {} } as unknown as LarDoc;
  try { writeIntentEntry(intents, grant.outcome); } catch { return { ok: false, reason: "the grant's outcome does not read as an intent entry" }; }
  const persona = { tiddlers: { [grant.title]: storedLarRecord(grant.title, { text: JSON.stringify(grant.record) }, "carried-seat") } } as unknown as LarDoc;
  const answer = seatGrantAnswering(intents, persona, request);
  if (answer.state !== "granted") return { ok: false, reason: answer.state === "refused" ? answer.reason : "the grant answers another request than this leaf's own" };
  return verifyFaceGrantRecord(grant.record, ctx);
}

/** The carried grants a vessel's own store holds for one device of one face: the seat's second source, read before the plane. */
export async function carriedSeatGrants(store: { listVisible(): Promise<readonly string[]>; get(title: string): Promise<{ readonly tiddler: { readonly text?: string } } | undefined | null> } | undefined, group: string, deviceKey: string): Promise<{ title: string; record: FaceGrantRecord }[]> {
  if (!store) return [];
  const title = faceGrantTitle(group, deviceKey);
  if (!title.startsWith(FACE_GRANT_PREFIX) || !(await store.listVisible()).includes(title)) return [];
  const raw = (await store.get(title))?.tiddler.text;
  if (typeof raw !== "string") return [];
  try { return [{ title, record: JSON.parse(raw) as FaceGrantRecord }]; } catch { return []; }
}

/** A store the seat's grant sources read: its visible titles and one record's text. */
type GrantSource = { listVisible(): Promise<readonly string[]>; get(title: string): Promise<{ readonly tiddler: { readonly text?: unknown } } | undefined | null> };

/**
 * THE SEAT'S GRANT PORT (`makeFaceSeat`'s `grants`): the carried grant in this vessel's own store first, then the face's
 * persona plane. A leaf with no road never holds the plane (its read faults `document-unavailable`), so a carried grant
 * answers before the plane is asked, and the unavailable plane cannot fault the pass. With no carried grant, the plane's
 * grant records for this device answer, and a plane that faults faults the pass as before.
 */
export function seatGrantsReader(input: {
  readonly carried: GrantSource | undefined;
  readonly plane: () => Promise<GrantSource | null | undefined>;
  readonly group: string;
  readonly deviceKey: string;
}): () => Promise<{ title: string; record: FaceGrantRecord }[]> {
  return async () => {
    const carried = await carriedSeatGrants(input.carried as never, input.group, input.deviceKey).catch(() => []);
    if (carried.length > 0) return carried;
    const store = await input.plane();
    if (!store) return [];
    const prefix = `${FACE_GRANT_PREFIX}${input.group}/`;
    const self = input.deviceKey.toLowerCase();
    const found: { title: string; record: FaceGrantRecord }[] = [];
    for (const title of await store.listVisible()) {
      if (!title.startsWith(prefix) || !title.toLowerCase().endsWith(self)) continue;
      const raw = (await store.get(title))?.tiddler.text;
      if (typeof raw !== "string") continue;
      try { found.push({ title, record: JSON.parse(raw) as FaceGrantRecord }); } catch { /* An unreadable record grants nothing. */ }
    }
    return found;
  };
}
