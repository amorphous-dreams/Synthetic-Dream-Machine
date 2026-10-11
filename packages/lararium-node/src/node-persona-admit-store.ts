/**
 * node-persona-admit-store — the node-fs PER-VESSEL multitude-view + the airgapped ceremony's pending state.
 *
 * THE LOAD-BEARING INVARIANT: the admitted-persona list is PER-VESSEL and NEVER fleet-syncs / federates. A
 * synced "all my faces" record would be almost a global-now-of-the-self, and a captured vessel must spill only
 * the faces actually admitted TO IT. So this rides a LOCAL 0o600 JSON file under the identity home — never an
 * Automerge bag, never a board. The never-syncs wall is STRUCTURAL: no bag/relay/board write exists in this
 * shore, exactly as the circle-follow graph + the handle-book beside it. Separation is composed by WHERE a key is
 * admitted, never dissolved by a convenience sync.
 *
 * TWO surfaces:
 *   · the MULTITUDE-VIEW — the mutually-signed `JoinRecord`s admitted to THIS vessel, keyed by persona prefix
 *     (a re-admission supersedes CAUSALLY — the granting op-key's KEL sequence, then the grant's nonce as a
 *     tiebreak; NEVER a wall-clock `expiry`, M12). BOTH the granting vessel (A) and the target vessel (B)
 *     record their matching copy — dual-admission, each into its own local view.
 *   · the PENDING state — the airgapped 3-hop runs as SEPARATE CLI invocations, so the on-device SECRET between
 *     hops persists here, 0o600, consume-ONCE: B's enrollment ephemeral secret (offer→open) and A's sent grant
 *     memo (grant→accept). The ephemeral X25519 secret NEVER leaves the device and is dropped the instant it is
 *     consumed (a completed or abandoned enrollment leaves no standing secret).
 *
 * TRACK-CONTRACTS-NEVER-IDENTITIES: a JoinRecord holds prefixes + key-material + nonces only — no name, no email,
 * no device inventory. A user leaves no roster trace anywhere but its OWN vessel's local view.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/persona-admit-store
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync, rmSync, renameSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { hex, hexToBytes, type JoinRecord, type EnrollmentSecret, type SentGrantMemo } from "@lararium/mesh";
import { larIdentityDir } from "./vessel-paths.js";

/** The per-vessel multitude-view file — the personas admitted to THIS vessel (0o600, never federated). */
const ADMISSIONS_FILE = ".persona-admissions.json";
/** B's pending enrollment secrets, keyed by ephemeral pubkey (0o600, consume-once). */
const PENDING_ENROLL_FILE = ".persona-enroll-pending.json";
/** A's pending sent-grant memos, keyed by nonce_A (0o600, consume-once). */
const PENDING_GRANT_FILE = ".persona-grant-pending.json";

/**
 * The pending-offer set's named bound (M-shape, §2a): a FRESH offer past this count withdraws the OLDEST
 * standing offer by insertion order (never by age/clock — ordering rides the `order` array this store writes).
 * No clock reads this; it is a pure count. `stashEnrollmentSecret`'s `maxPending` arg overrides it per-call
 * (tests use a small K so the eviction proves without minting dozens of offers).
 */
export const PENDING_OFFER_LIMIT = 50;

function idDirOf(dir?: string): string { return dir ?? larIdentityDir(); }

function readJson<T>(dir: string, file: string, fallback: T): T {
  const path = join(dir, file);
  if (!existsSync(path)) return fallback;
  try { return JSON.parse(readFileSync(path, "utf8")) as T; }
  catch { return fallback; }   // a torn file reads empty — the airgapped hop is simply re-run
}

/**
 * Write as temp-then-rename (M12): a reader can never observe a half-written admissions/pending file, because
 * `rename` on the same filesystem is atomic — the path either still holds the PRIOR complete bytes or the NEW
 * complete bytes, never a torn mix. The temp name carries this process's pid + a random suffix so two writers
 * racing the SAME store dir never collide on the temp path itself.
 */
function writeJson(dir: string, file: string, value: unknown): void {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, file);
  const tmp = join(dir, `.${file}.${process.pid}.${hex(randomBytes(4))}.tmp`);
  writeFileSync(tmp, JSON.stringify(value, null, 2), { mode: 0o600, encoding: "utf8" });
  try { chmodSync(tmp, 0o600); } catch { /* best-effort on a non-POSIX fs */ }
  renameSync(tmp, path);
}

// ── The multitude-view (never fleet-syncs) ──────────────────────────────────────────────────────────────────

/** The vessel's local admitted-persona view: `personaPrefix -> the newest verified JoinRecord`. */
type AdmissionsFile = { readonly admissions?: Record<string, JoinRecord> };

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

/**
 * Record a mutually-signed JoinRecord into THIS vessel's local multitude-view. Keyed by persona prefix; a
 * re-admission that supersedes the standing one causally (M12 — `supersedesCausally`, never a clock) replaces
 * it, an older one is ignored. A pure LOCAL write — no bag, no board, no wire. Both A (on ACK-accept) and B
 * (on grant-open) call it. The write lands temp + rename (`writeJson`) — a reader never sees a torn view.
 */
export function recordAdmittedPersona(join: JoinRecord, dir?: string): void {
  const d = idDirOf(dir);
  const cur = readJson<AdmissionsFile>(d, ADMISSIONS_FILE, {}).admissions ?? {};
  const prior = cur[join.personaRef.prefix];
  if (prior && !supersedesCausally(prior, join)) return;   // a causally-older re-admission never rolls the view back
  writeJson(d, ADMISSIONS_FILE, { admissions: { ...cur, [join.personaRef.prefix]: join } });
}

/** Every persona admitted to THIS vessel, by prefix (the private multitude-view; read-only). */
export function listAdmittedPersonas(dir?: string): JoinRecord[] {
  const admissions = readJson<AdmissionsFile>(idDirOf(dir), ADMISSIONS_FILE, {}).admissions ?? {};
  return Object.values(admissions).sort((a, b) => a.personaRef.prefix.localeCompare(b.personaRef.prefix));
}

/** Is a persona (by prefix) admitted to THIS vessel? A pure local read. */
export function isPersonaAdmitted(prefix: string, dir?: string): boolean {
  const admissions = readJson<AdmissionsFile>(idDirOf(dir), ADMISSIONS_FILE, {}).admissions ?? {};
  return prefix in admissions;
}

// ── The airgapped pending state (consume-once secrets) ──────────────────────────────────────────────────────

/** An EnrollmentSecret with its ephemeral X25519 secret hex-encoded for at-rest JSON (decoded on take). */
type StashedEnroll = { ephemeralSecretHex: string; targetVesselId: string; nonceB: string; expiry: number };
/** `order` names INSERTION order explicitly (never relies on JS object key order) — the count-bound eviction's
 *  "oldest" reads off `order[0]`, never off any clock/expiry field. */
type EnrollFile = { readonly order?: readonly string[]; readonly pending?: Record<string, StashedEnroll> };

function readEnrollFile(dir: string): { order: string[]; pending: Record<string, StashedEnroll> } {
  const file = readJson<EnrollFile>(dir, PENDING_ENROLL_FILE, {});
  const pending = { ...(file.pending ?? {}) };
  // A pre-existing file with no `order` (or a hand-edited one) falls back to key order — still deterministic,
  // just not insertion-proven; every write from here on carries an explicit `order`.
  const order = [...(file.order ?? Object.keys(pending))];
  return { order, pending };
}

/**
 * Stash B's on-device enrollment secret between `offer` and `open` (0o600), keyed by the ephemeral pubkey, and
 * append it to the insertion-`order`. The pending-offer set is COUNT-bounded at `maxPending` (default
 * `PENDING_OFFER_LIMIT`, a NAMED parameter — never a clock): a stash past that count WITHDRAWS the OLDEST
 * standing offer by insertion order before writing the new one, exactly as an explicit `withdrawAdmitOffer`
 * would (dropped from both `order` and `pending` in the one atomic write).
 */
export function stashEnrollmentSecret(
  ephemeralPubkey: string, secret: EnrollmentSecret, dir?: string, maxPending: number = PENDING_OFFER_LIMIT,
): void {
  const d = idDirOf(dir);
  const { order, pending } = readEnrollFile(d);
  const stashed: StashedEnroll = {
    ephemeralSecretHex: hex(secret.ephemeralSecret),
    targetVesselId: secret.targetVesselId, nonceB: secret.nonceB, expiry: secret.expiry,
  };
  const nextOrder = order.filter((k) => k !== ephemeralPubkey);
  nextOrder.push(ephemeralPubkey);
  pending[ephemeralPubkey] = stashed;
  while (nextOrder.length > Math.max(1, maxPending)) {
    const oldest = nextOrder.shift()!;
    delete pending[oldest];
  }
  writeJson(d, PENDING_ENROLL_FILE, { order: nextOrder, pending });
}

/**
 * Take (consume-ONCE) B's stashed enrollment secret for an ephemeral pubkey — returns it and DROPS it from the
 * pending set AND the insertion order, so a secret never lingers past the one open it enables. Null when absent
 * (the hop is re-run, or the offer was withdrawn / evicted).
 */
export function takeEnrollmentSecret(ephemeralPubkey: string, dir?: string): EnrollmentSecret | null {
  const d = idDirOf(dir);
  const { order, pending } = readEnrollFile(d);
  const s = pending[ephemeralPubkey];
  if (!s) return null;
  delete pending[ephemeralPubkey];
  writeJson(d, PENDING_ENROLL_FILE, { order: order.filter((k) => k !== ephemeralPubkey), pending });   // consume
  return { ephemeralSecret: hexToBytes(s.ephemeralSecretHex), targetVesselId: s.targetVesselId, nonceB: s.nonceB, expiry: s.expiry };
}

/**
 * WITHDRAW a pending offer (§2a) — the offerer's OWN causal act, triggered by its OWN monotonic liveness (the
 * CLI's `withdraw-offer`), never by a clock comparison here. `"all"` drops every pending offer at once (the
 * `reset` shape); a specific ephemeral pubkey drops only that one. Returns the count actually dropped (0 when
 * the target was already gone — consumed, evicted, or never stashed). Same take-shape as `takeEnrollmentSecret`,
 * minus a grant to show for it: once withdrawn, a sealed grant answering that offer finds no pending enrollment
 * to open against (the SAME "no pending enrollment matched" refusal a consumed offer already draws).
 */
export function withdrawAdmitOffer(target: string | "all", dir?: string): number {
  const d = idDirOf(dir);
  const { order, pending } = readEnrollFile(d);
  if (target === "all") {
    const n = order.length;
    if (n > 0) writeJson(d, PENDING_ENROLL_FILE, { order: [], pending: {} });
    return n;
  }
  if (!(target in pending)) return 0;
  delete pending[target];
  writeJson(d, PENDING_ENROLL_FILE, { order: order.filter((k) => k !== target), pending });
  return 1;
}

/** PEEK (non-consuming) every stashed enrollment secret, OLDEST first (insertion order) — B's `open` tries each
 *  against a grant (it cannot know WHICH pending enrollment a grant answers until one decrypts), then consumes
 *  only the matching one. */
export function peekEnrollmentSecrets(dir?: string): Array<{ ephemeralPubkey: string; secret: EnrollmentSecret }> {
  const { order, pending } = readEnrollFile(idDirOf(dir));
  return order
    .filter((k) => k in pending)
    .map((ephemeralPubkey) => {
      const s = pending[ephemeralPubkey]!;
      return {
        ephemeralPubkey,
        secret: { ephemeralSecret: hexToBytes(s.ephemeralSecretHex), targetVesselId: s.targetVesselId, nonceB: s.nonceB, expiry: s.expiry },
      };
    });
}

type GrantFile = { readonly pending?: Record<string, SentGrantMemo> };

/** Stash A's sent-grant memo between `grant` and `accept` (0o600), keyed by nonce_A (the grant's fresh id). */
export function stashSentMemo(memo: SentGrantMemo, dir?: string): void {
  const d = idDirOf(dir);
  const cur = readJson<GrantFile>(d, PENDING_GRANT_FILE, {}).pending ?? {};
  writeJson(d, PENDING_GRANT_FILE, { pending: { ...cur, [memo.transcript.nonceA]: memo } });
}

/** Take (consume-ONCE) A's sent memo for a nonce_A — returns it and DROPS it. Null when absent. */
export function takeSentMemo(nonceA: string, dir?: string): SentGrantMemo | null {
  const d = idDirOf(dir);
  const cur = readJson<GrantFile>(d, PENDING_GRANT_FILE, {}).pending ?? {};
  const memo = cur[nonceA];
  if (!memo) return null;
  const { [nonceA]: _dropped, ...rest } = cur;
  writeJson(d, PENDING_GRANT_FILE, { pending: rest });
  return memo;
}

/**
 * WITHDRAW a sent grant memo (§2a) — A's OWN causal act, triggered by its OWN monotonic liveness: "the same
 * take [as `takeSentMemo`], without a grant." Once withdrawn, a late ACK answering that nonce_A finds no sent
 * memo to verify against and refuses by name ("no sent grant matches"), the SAME refusal a consumed memo
 * already draws. Returns whether a memo actually stood there to withdraw.
 */
export function withdrawAdmitGrant(nonceA: string, dir?: string): boolean {
  return takeSentMemo(nonceA, dir) !== null;
}

/** Drop every pending secret/memo (a `persona admit reset` — abandon an in-flight enrollment). */
export function clearPersonaAdmitPending(dir?: string): void {
  const d = idDirOf(dir);
  for (const f of [PENDING_ENROLL_FILE, PENDING_GRANT_FILE]) {
    try { rmSync(join(d, f), { force: true }); } catch { /* already gone */ }
  }
}
