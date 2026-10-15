/**
 * node-persona-admit-store — this vessel's own MULTITUDE-VIEW and the airgapped ceremony's pending state: three
 * rows under the identity home, each sealed under the vessel key and read through the custody seat.
 *
 * THE LOAD-BEARING INVARIANT: the admitted-persona list stays PER-VESSEL and NEVER fleet-syncs or federates. A
 * synced "all my faces" record would come close to a global-now-of-the-self, and a captured vessel must spill only
 * the faces actually admitted TO IT. The never-syncs wall stays STRUCTURAL: no bag, relay or board write exists in
 * this shore. Separation gets composed by WHERE a key gets admitted, never dissolved by a convenience sync.
 *
 * ── THE THREE ROWS ──────────────────────────────────────────────────────────────────────────────
 *   · `admissions`      the mutually-signed `JoinRecord`s admitted to THIS vessel, keyed by persona prefix. A
 *                       re-admission supersedes CAUSALLY (the granting op-key's KEL sequence, then the grant's
 *                       nonce as a tiebreak; NEVER a wall-clock field). Both the granting vessel and the target
 *                       vessel record their matching copy, each into its own view.
 *   · `enroll-pending`  the target vessel's on-device enrollment secrets between `offer` and `open`.
 *   · `grant-pending`   the granting vessel's sent-grant memos between `grant` and `accept`.
 * The 3-hop runs as SEPARATE commands, so the secret between hops rests here. The ephemeral X25519 secret never
 * leaves the device.
 *
 * ── THE COMMIT POINT ────────────────────────────────────────────────────────────────────────────
 * An act that completes a hop writes two rows, and `admissions` commits it. The flow records the admission FIRST
 * and drops the pending entry SECOND (`persona-admit-flow`): an act that dies before the admission leaves the
 * pending entry standing, and one that dies between the two leaves an admission beside a pending entry the same
 * carriage completes again. No order of deaths leaves an entry dropped with no admission to show for it.
 *
 * ── AT REST ─────────────────────────────────────────────────────────────────────────────────────
 * Every row passes through the custody seat (`custody-seat`). Nothing at a row's path reads as no admission, or
 * as nothing pending: a vessel learns each from its own acts, and a lost row costs a hop run again. A row that
 * stands and does not open (torn, bare, another key's), or opens to another shape, refuses
 * `CustodyRowUnavailable`. No reader folds a refusal to empty, so nothing records or stashes over a row it could
 * not read. Every change reads, decides and writes under ONE custody holder (`updateCustodyRow`), so two commands
 * in two processes never drop each other's entry. At the floor every door refuses `CustodyLocked`.
 *
 * TRACK-CONTRACTS-NEVER-IDENTITIES: a JoinRecord holds prefixes, key-material and nonces only: no name, no email,
 * no device inventory. A user leaves no roster trace anywhere but its OWN vessel's view.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/persona-admit-store
 */
import { mkdirSync } from "node:fs";
import { hex, hexToBytes, type JoinRecord, type EnrollmentSecret, type SentGrantMemo } from "@lararium/mesh";
import { CustodyRowUnavailable } from "./custody-holder.js";
import { readCustodyRow, updateCustodyRow } from "./custody-seat.js";
import { larIdentityDir } from "./vessel-paths.js";

/** The per-vessel multitude-view row: the personas admitted to THIS vessel. */
export const ADMISSIONS_FILE = ".persona-admissions.json";
/** The target vessel's pending enrollment secrets, keyed by ephemeral pubkey. */
export const PENDING_ENROLL_FILE = ".persona-enroll-pending.json";
/** The granting vessel's pending sent-grant memos, keyed by nonce_A. */
export const PENDING_GRANT_FILE = ".persona-grant-pending.json";

/**
 * The pending-offer set's named bound: a FRESH offer past this count withdraws the OLDEST standing offer by
 * insertion order (never by age or clock; ordering rides the `order` list this store writes). No clock reads it.
 * `stashEnrollmentSecret`'s `maxPending` overrides it per call.
 */
export const PENDING_OFFER_LIMIT = 50;
/** The sent-grant memos' named count bound, the same shape on the granting side. */
export const SENT_MEMO_LIMIT = 50;

const utf8 = new TextEncoder();
const encode = (value: unknown): Uint8Array => utf8.encode(JSON.stringify(value, null, 2));
const bad = (file: string): CustodyRowUnavailable => new CustodyRowUnavailable("identity", file, "malformed");
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
/** A map with no prototype: a key may spell any name, and none reaches an inherited slot. */
const bare = <T>(): Record<string, T> => Object.create(null) as Record<string, T>;

function parseJson(bytes: Uint8Array, file: string): unknown {
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw bad(file); }
}

// ── The multitude-view (never fleet-syncs) ──────────────────────────────────────────────────────────────────

/**
 * Causal supersede order for a re-admission (M12) — the granting op-key's KEL sequence number, then the
 * grant's `nonceA` as a stated tiebreak, NEVER `expiry` (a wall-clock field either party's own clock set).
 * `granterSeq` is OPTIONAL (only present when the opener supplied a `resolveHeadSeq`); a record carrying a
 * RESOLVED seq is always more causally informative than one that carries none, so it always stands over an
 * unresolved one, and an unresolved re-admission never rolls back a resolved standing record. When both
 * sides carry a seq, the HIGHER seq wins (the persona rotated forward, never backward, under KEL rules).
 * When seqs tie (or both are absent), the lexicographically GREATER `nonceA` wins — deterministic on both
 * vessels since both hold the identical joinRecord bytes; a byte-identical replay ties and changes nothing.
 */
function supersedesCausally(prior: JoinRecord, next: JoinRecord): boolean {
  const priorSeq = prior.granterSeq;
  const nextSeq = next.granterSeq;
  if (priorSeq !== undefined && nextSeq !== undefined) {
    if (nextSeq !== priorSeq) return nextSeq > priorSeq;
  } else if (priorSeq !== undefined || nextSeq !== undefined) {
    return nextSeq !== undefined;   // a resolved seq always outranks an unresolved one, either direction
  }
  return next.nonceA > prior.nonceA;
}

const allStrings = (v: Record<string, unknown>, keys: readonly string[]): boolean => keys.every((k) => typeof v[k] === "string");
/** A persona reference holds a prefix and its key material, both strings. */
const refHolds = (v: unknown): v is Record<string, unknown> => isRecord(v) && allStrings(v, ["prefix", "verifyingKey"]);

/** The admissions a row's plaintext carries; nothing standing reads as none, and every other shape refuses. */
function parseAdmissions(bytes: Uint8Array | null): Record<string, JoinRecord> {
  const out = bare<JoinRecord>();
  if (bytes === null) return out;
  const raw = parseJson(bytes, ADMISSIONS_FILE);
  if (!isRecord(raw) || !isRecord(raw["admissions"])) throw bad(ADMISSIONS_FILE);
  for (const [prefix, record] of Object.entries(raw["admissions"])) {
    if (!isRecord(record) || !refHolds(record["personaRef"]) || record["personaRef"]["prefix"] !== prefix
      || !allStrings(record, ["kind", "targetVesselId", "granterKey", "nonceA", "nonceB", "grantSig"])
      || (record["granterSeq"] !== undefined && !Number.isInteger(record["granterSeq"]))) throw bad(ADMISSIONS_FILE);
    out[prefix] = record as unknown as JoinRecord;
  }
  return out;
}

function identityHome(): void { mkdirSync(larIdentityDir(), { recursive: true, mode: 0o700 }); }

/**
 * Record a mutually-signed JoinRecord into THIS vessel's multitude-view: THE COMMIT POINT of a hop. Keyed by
 * persona prefix; a re-admission that supersedes the standing one causally (`supersedesCausally`, never a clock)
 * replaces it, an older one changes nothing and writes nothing. No bag, no board, no wire. Both the granting
 * vessel (on ACK-accept) and the target vessel (on grant-open) call it.
 */
export function recordAdmittedPersona(join: JoinRecord): Promise<void> {
  identityHome();
  return updateCustodyRow("identity", ADMISSIONS_FILE, (bytes) => {
    const cur = parseAdmissions(bytes);
    const prior = cur[join.personaRef.prefix];
    if (prior && !supersedesCausally(prior, join)) return { plaintext: null, value: undefined };
    cur[join.personaRef.prefix] = join;
    return { plaintext: encode({ admissions: cur }), value: undefined };
  });
}

/** Every persona admitted to THIS vessel, by prefix (the private multitude-view; read-only). */
export async function listAdmittedPersonas(): Promise<JoinRecord[]> {
  const admissions = parseAdmissions(await readCustodyRow("identity", ADMISSIONS_FILE));
  return Object.values(admissions).sort((a, b) => a.personaRef.prefix.localeCompare(b.personaRef.prefix));
}

/** Whether a persona (by prefix) stands admitted to THIS vessel. */
export async function isPersonaAdmitted(prefix: string): Promise<boolean> {
  return Object.hasOwn(parseAdmissions(await readCustodyRow("identity", ADMISSIONS_FILE)), prefix);
}

// ── The airgapped pending state ─────────────────────────────────────────────────────────────────────────────

/** A pending set at rest: `order` names INSERTION order explicitly, so the count bound's "oldest" reads off
 *  `order[0]` and never off a clock or an object's key order. */
interface PendingSet<T> { order: string[]; pending: Record<string, T> }

/** The pending set a row's plaintext carries; nothing standing reads as nothing pending; every other shape refuses. */
function parsePending<T>(bytes: Uint8Array | null, file: string, entryHolds: (v: Record<string, unknown>) => boolean): PendingSet<T> {
  const pending = bare<T>();
  if (bytes === null) return { order: [], pending };
  const raw = parseJson(bytes, file);
  if (!isRecord(raw) || !isRecord(raw["pending"]) || !Array.isArray(raw["order"]) || raw["order"].some((k) => typeof k !== "string")) throw bad(file);
  for (const [key, entry] of Object.entries(raw["pending"])) {
    if (!isRecord(entry) || !entryHolds(entry)) throw bad(file);
    pending[key] = entry as unknown as T;
  }
  const order = raw["order"] as string[];
  if (order.length !== Object.keys(pending).length || new Set(order).size !== order.length || order.some((k) => !Object.hasOwn(pending, k))) throw bad(file);
  return { order: [...order], pending };
}

/** Read one pending row, decide, and write it, under one custody holder. `null` from `decide` writes nothing. */
function updatePending<T, V>(
  file: string, entryHolds: (v: Record<string, unknown>) => boolean,
  decide: (set: PendingSet<T>) => { readonly next: PendingSet<T> | null; readonly value: V },
): Promise<V> {
  identityHome();
  return updateCustodyRow("identity", file, (bytes) => {
    const { next, value } = decide(parsePending<T>(bytes, file, entryHolds));
    return { plaintext: next === null ? null : encode({ order: next.order, pending: next.pending }), value };
  });
}

/** Add `key` as the newest entry and withdraw the oldest past `max`, by insertion order. */
function stashInto<T>(set: PendingSet<T>, key: string, entry: T, max: number): PendingSet<T> {
  const order = set.order.filter((k) => k !== key);
  order.push(key);
  set.pending[key] = entry;
  while (order.length > Math.max(1, max)) delete set.pending[order.shift()!];
  return { order, pending: set.pending };
}

/** Drop `key`; `null` when nothing stood under it. */
function dropFrom<T>(set: PendingSet<T>, key: string): { next: PendingSet<T>; entry: T } | null {
  if (!Object.hasOwn(set.pending, key)) return null;
  const entry = set.pending[key]!;
  delete set.pending[key];
  return { next: { order: set.order.filter((k) => k !== key), pending: set.pending }, entry };
}

/** An EnrollmentSecret with its ephemeral X25519 secret hex-encoded at rest (decoded on the way out), and the
 *  grant this offer got bound to, once an open verified one (`bindEnrollmentToGrant`). */
type StashedEnroll = { ephemeralSecretHex: string; targetVesselId: string; nonceB: string; boundTo?: string };
const enrollHolds = (v: Record<string, unknown>): boolean =>
  typeof v["ephemeralSecretHex"] === "string" && /^[0-9a-f]{64}$/.test(v["ephemeralSecretHex"])
  && typeof v["targetVesselId"] === "string" && typeof v["nonceB"] === "string"
  && (v["boundTo"] === undefined || typeof v["boundTo"] === "string");
const secretOf = (s: StashedEnroll): EnrollmentSecret =>
  ({ ephemeralSecret: hexToBytes(s.ephemeralSecretHex), targetVesselId: s.targetVesselId, nonceB: s.nonceB });

/**
 * Stash the target vessel's on-device enrollment secret between `offer` and `open`, keyed by the ephemeral
 * pubkey, as the newest entry. The pending-offer set stays COUNT-bounded at `maxPending` (a NAMED parameter,
 * never a clock): a stash past that count WITHDRAWS the OLDEST standing offer by insertion order, in the same
 * write.
 */
export function stashEnrollmentSecret(ephemeralPubkey: string, secret: EnrollmentSecret, maxPending: number = PENDING_OFFER_LIMIT): Promise<void> {
  const stashed: StashedEnroll = { ephemeralSecretHex: hex(secret.ephemeralSecret), targetVesselId: secret.targetVesselId, nonceB: secret.nonceB };
  return updatePending<StashedEnroll, void>(PENDING_ENROLL_FILE, enrollHolds, (set) =>
    ({ next: stashInto(set, ephemeralPubkey, stashed, maxPending), value: undefined }));
}

/**
 * BIND an offer to the one grant that completes it, before anything gets signed. The first grant an open verifies
 * against this enrollment binds it, under one custody holder; the same grant binds again to the same answer (a
 * retry), and any other grant reads `bound-other` for as long as the enrollment stands. So one offer yields one
 * acknowledgment for one grant, whatever dies between the steps and whatever two commands attempt at once.
 * `absent` when the enrollment left meanwhile (withdrawn, evicted, or completed).
 */
export function bindEnrollmentToGrant(ephemeralPubkey: string, nonceA: string): Promise<"bound" | "bound-other" | "absent"> {
  return updatePending<StashedEnroll, "bound" | "bound-other" | "absent">(PENDING_ENROLL_FILE, enrollHolds, (set) => {
    if (!Object.hasOwn(set.pending, ephemeralPubkey)) return { next: null, value: "absent" };
    const entry = set.pending[ephemeralPubkey]!;
    if (entry.boundTo === nonceA) return { next: null, value: "bound" };
    if (entry.boundTo !== undefined) return { next: null, value: "bound-other" };
    set.pending[ephemeralPubkey] = { ...entry, boundTo: nonceA };
    return { next: set, value: "bound" };
  });
}

/**
 * Take the target vessel's stashed enrollment secret for an ephemeral pubkey: return it and DROP it from the
 * pending set and the insertion order. Null when nothing stands under it (the offer got withdrawn, evicted, or
 * taken already). The flow takes an enrollment only after its admission stands recorded.
 */
export function takeEnrollmentSecret(ephemeralPubkey: string): Promise<EnrollmentSecret | null> {
  return updatePending<StashedEnroll, EnrollmentSecret | null>(PENDING_ENROLL_FILE, enrollHolds, (set) => {
    const dropped = dropFrom(set, ephemeralPubkey);
    return dropped ? { next: dropped.next, value: secretOf(dropped.entry) } : { next: null, value: null };
  });
}

/**
 * WITHDRAW a pending offer: the offerer's OWN causal act, triggered by its OWN liveness (the CLI's
 * `withdraw-offer`), never by a clock comparison here. `"all"` drops every pending offer at once; a specific
 * ephemeral pubkey drops only that one. Returns the count actually dropped. Once withdrawn, a sealed grant
 * answering that offer finds no pending enrollment to open against.
 */
export function withdrawAdmitOffer(target: string | "all"): Promise<number> {
  return updatePending<StashedEnroll, number>(PENDING_ENROLL_FILE, enrollHolds, (set) => {
    if (target === "all") return set.order.length > 0 ? { next: { order: [], pending: bare<StashedEnroll>() }, value: set.order.length } : { next: null, value: 0 };
    const dropped = dropFrom(set, target);
    return dropped ? { next: dropped.next, value: 1 } : { next: null, value: 0 };
  });
}

/** PEEK (taking nothing) every stashed enrollment secret, OLDEST first. The target's `open` tries each against a
 *  grant (it cannot know WHICH pending enrollment a grant answers until one decrypts). */
export async function peekEnrollmentSecrets(): Promise<Array<{ ephemeralPubkey: string; secret: EnrollmentSecret }>> {
  const { order, pending } = parsePending<StashedEnroll>(await readCustodyRow("identity", PENDING_ENROLL_FILE), PENDING_ENROLL_FILE, enrollHolds);
  return order.map((ephemeralPubkey) => ({ ephemeralPubkey, secret: secretOf(pending[ephemeralPubkey]!) }));
}

const memoHolds = (v: Record<string, unknown>): boolean =>
  typeof v["grantSig"] === "string" && isRecord(v["transcript"]) && refHolds(v["transcript"]["personaRef"])
  && allStrings(v["transcript"], ["kind", "targetVesselId", "nonceA", "nonceB"]);

/**
 * Stash the granting vessel's sent-grant memo between `grant` and `accept`, keyed by nonce_A, as the newest
 * entry. COUNT-bounded at `maxPending` (a NAMED parameter, never a clock): a stash past that count withdraws the
 * OLDEST standing memo in the same write.
 */
export function stashSentMemo(memo: SentGrantMemo, maxPending: number = SENT_MEMO_LIMIT): Promise<void> {
  return updatePending<SentGrantMemo, void>(PENDING_GRANT_FILE, memoHolds, (set) =>
    ({ next: stashInto(set, memo.transcript.nonceA, memo, maxPending), value: undefined }));
}

/** PEEK (taking nothing) the sent memo for a nonce_A, or null. The accept verifies an ACK against it and takes
 *  it only after the admission stands recorded. */
export async function peekSentMemo(nonceA: string): Promise<SentGrantMemo | null> {
  const { pending } = parsePending<SentGrantMemo>(await readCustodyRow("identity", PENDING_GRANT_FILE), PENDING_GRANT_FILE, memoHolds);
  return Object.hasOwn(pending, nonceA) ? pending[nonceA]! : null;
}

/** Take the sent memo for a nonce_A: return it and DROP it. Null when nothing stands under it. */
export function takeSentMemo(nonceA: string): Promise<SentGrantMemo | null> {
  return updatePending<SentGrantMemo, SentGrantMemo | null>(PENDING_GRANT_FILE, memoHolds, (set) => {
    const dropped = dropFrom(set, nonceA);
    return dropped ? { next: dropped.next, value: dropped.entry } : { next: null, value: null };
  });
}

/**
 * WITHDRAW a sent grant memo: the granter's OWN causal act. Once withdrawn, a late ACK answering that nonce_A
 * finds no sent memo to verify against and refuses by name. Returns whether a memo stood there to withdraw.
 */
export async function withdrawAdmitGrant(nonceA: string): Promise<boolean> {
  return (await takeSentMemo(nonceA)) !== null;
}

/** Drop every pending secret and memo (a `persona admit reset`: abandon every enrollment in flight). */
export async function clearPersonaAdmitPending(): Promise<void> {
  await updatePending<StashedEnroll, void>(PENDING_ENROLL_FILE, enrollHolds, (set) =>
    ({ next: set.order.length > 0 ? { order: [], pending: bare<StashedEnroll>() } : null, value: undefined }));
  await updatePending<SentGrantMemo, void>(PENDING_GRANT_FILE, memoHolds, (set) =>
    ({ next: set.order.length > 0 ? { order: [], pending: bare<SentGrantMemo>() } : null, value: undefined }));
}
