/**
 * pulama-hand — THE PŪLAMA'S HAND DOOR: the acts only the operator's own hand, or the host shim, brings.
 *
 * The hand door answers on a socket of its own, inside the pūlama and mounted nowhere else; no vessel reaches it and no
 * session frame carries one of its acts. One frame in, one answer out.
 *
 *   light    the operator's route opens the vessel key and every face it fits, here, in the pūlama (`admit: true` also admits
 *            the reported image for every lit face under that one route: the struck fire costs one proof). ONLY THIS ACT LIGHTS
 *            THE PŪLAMA: no lei, no vouch and no session carries a route. The unlock bound holds as it does on a vessel's
 *            door, and a vessel's restart never resets it: the count rides the pūlama's own life.
 *   admit    THE HAND ADMITS AN IMAGE. The operator's route PROVES against the lit holder (`CustodyHolder.proves`: it opens
 *            nothing and holds nothing new; a miss spends an unlock attempt as an unlock's miss does), and the image the
 *            host reports then rests admitted for the named open faces, under a tessera whose two halves this act alone rests
 *            (`pulama-admit`). An unlit pūlama refuses `pulama-locked` and an unreported image `image-unreported`, each
 *            before the route reads. The route never leaves the pūlama.
 *   unadmit  THE HAND ENDS AN ADMISSION. The route proves as `admit`'s does, and the admission of the named image digest rests
 *            ended under a signed tombstone naming its tessera (`pulama-admit`); the gate then reads it unadmitted. An unlit
 *            pūlama refuses `pulama-locked` before the route reads; a digest no admission stands for answers
 *            `image-not-admitted` once the route proves.
 *   rehive   THE HAND REHIVES A SHUT FACE (`face-rehive`): a face whose veil-archive row holds another identity's Archive stands
 *            its hive again from its own seed. The face must stand SHUT here (a lit face refuses `face-open`: `lock` shuts every
 *            face first); the face's own route opens its key for this act alone through the holder's attempt budget and checks
 *            (`openFaceForAct`), the foreign bytes rest aside and one compare-and-replace seals the row's next bytes, and nothing
 *            lights. It rides this door's one chain, so `light` never opens the face mid-act. The answer names what moved, what
 *            was lost and the pūlama-path acts that come next.
 *   recard   THE HAND PROVES A STALE FACE'S OWN ROUTE FOR ITS RECARD (`face-recard` under a pūlama): a face whose light on the
 *            vessel refused `FaceHoldsNoPrekeySecret` lights again under its own identity, and the light runs in the vessel,
 *            while the face's key rests here. The face must stand LIT here (a shut face refuses `face-shut`: `light` opens it); the
 *            face's own route (the A1 ruling: never the vessel's) opens its key for the proof alone through the holder's attempt
 *            budget (`openFaceForAct`, while open), the opened copy zeroes at once, and ONE grant rests in the server's memory
 *            (`grantRecard`). The vessel's `lares vault recard face=N` then reads its own guard (only a face whose last light
 *            refused for want of a prekey secret), spends the grant over its session (`face.recard`) and arms that face's next
 *            light. An unlit pūlama refuses `pulama-locked` before the route reads; a refusal grants nothing. The lock forgets it.
 *   lock     every session drops and every key zero-fills.
 *   close    ONE FACE CLOSES IN TWO PHASES (`face`, by its whole ordinal): the pūlama tells every vessel that lends it, keeps
 *            the key while each drains, and locks it once each answered; one no vessel lends locks at once. It answers
 *            `closing` with the count still to answer, and `status` names each such face ("the vessel has not answered its
 *            close"). No clock locks it: `force: true` is the operator's hand confirming the forced lock.
 *   status   lit or not, the faces open, the sessions standing, attempts left, the image the host reported; while lit, the
 *            admitted digests and the ended ones. Opens nothing.
 *   image    THE HOST'S REPORT of the image digest it raises (the kūkulu gate's input port), with an optional seed line: the
 *            seed that image offers beside the founding record, ratchet by ratchet, as the host read it (D1). The pūlama
 *            opens no document, so it names the line and never computes it; `status` and `admit` repeat it, and no admitted
 *            row carries it: admission moves nothing.
 *   tessera  the tessera halves the pūlama witnessed, as they rest: `rite-begun` for each kūkulu it served, `rite-landed`
 *            for each that composed; and, while lit, the admitted images with each one's count of re-services.
 *   lei      THE HAND STRINGS, RESTRINGS OR UNSTRINGS A LEI (`act`: `kui` · `restring` · `unstring`), SIGN-ONLY. The vessel under
 *            a pūlama holds no face root, so the hand's lei acts come here, where the root rests: the face's root opens fresh
 *            under the operator's route (a ward act; a miss spends the face's own ward attempts), signs ONE record (a lei, or
 *            an unstring) for the face's own group, and zeroes. An UNSTRING also rests in the pūlama's own records, so its own
 *            reuse of a begun half sees the revocation whatever offer a vessel carries; otherwise the act writes nothing: the vessel lands the record
 *            (`lares lei land`), where the chain's tip, the returns left and the push co-sign gate judge it. A restring rides
 *            kui: it names the line's tip it follows (`after`, as `lares lei show` reads it), and signs a lei after that tip.
 *            An unlit pūlama, an unopened face, a face whose anchors name no group, malformed terms, a count above twelve
 *            without `confirm` and a restring naming no tip each refuse before the route reads; `check: true` answers `ready`
 *            there and reads no route.
 *
 *   publish  THE HAND SIGNS ONE PLUGIN OFFERING (`lares nexus publish plugins … apply=true` under a pūlama), SIGN-ONLY, in the lei
 *            pattern. The vessel under a pūlama holds no face root, so the offering's signature comes here: the vessel reads the
 *            source and hands the CLOSED descriptor it would sign (`offeror` · `pluginsCid` · `blobs`, the `signPluginOffering`
 *            preimage and nothing beside it: `offeringTermsOf`), the face's root opens fresh under the operator's route (a ward
 *            act; a miss spends the face's own ward attempts), signs that ONE descriptor, and zeroes. The answer carries the
 *            signed offering; the act writes nothing, and the vessel lands it (`land=`), where the bytes, the boot set and
 *            the descriptor the source folds to are judged again. An unlit pūlama, an unopened face, a descriptor outside the
 *            closed shape (an extra field, a blob without provenance, a region its blobs do not fold to) and an offeror that
 *            names another key than the face's root each refuse before the route reads.
 *
 *   sign     THE HAND SIGNS ONE RECORD OF A CLOSED SET under a face root, SIGN-ONLY, in the lei pattern: every ward act that signs
 *            as the face under a pūlama rides here (`lares kahua lift|withdraw|carry`, and `publish` beneath it), each by its
 *            record KIND (`pulama-sign`: a closed table, each kind its own shape check and domain-tagged preimage). The vessel
 *            reads the terms (`terms=true`: the face, the kind, the one unsigned record), the route opens the face root for ONE
 *            signature and zeroes, and the vessel lands the record (`land=`) over the record it builds afresh. An unlit
 *            pūlama, an unopened face, a kind outside the table, a record outside its kind's shape and a record naming another
 *            root or group each refuse before the route reads; `check: true` answers `ready` there and reads no route.
 *
 *   closure  THE HOST'S CLOSURE REPORT: the pūlama code closure of the image this keeper runs, as the host read its label. It
 *            rests in this keeper's memory alone (two keepers share one state dir), and `image` may carry it too (`closure`).
 *
 * ── THE KEEPER TALLY (`pulama-keeper`): the keeper's own succession ─────────────────────────────
 *   name-successor  THE HAND NAMES THE SUCCESSOR. The route proves against the lit holder (as `admit`'s does) and the guest half
 *                  rests naming ONE successor closure (`next`); a later commit supersedes. Unlit, unreported or passing refuses
 *                  before the route reads.
 *   keeper-offer   (the successor, unlit) mint the one-handoff X25519 key and answer its public half beside the closure the host
 *                  reported. A fresh offer drops the one before.
 *   keeper-vest    (the lit keeper, no route: the consent rode the commit) seal the house's end of the bond (the node key and the
 *                  open face keys) to the offered key, once per commit, only inside a live kūkulu rite (the frame's `offer`: its
 *                  vouches name this move, and the vest begins the rite, claiming one lei return) and only where the successor's
 *                  reported closure equals the committed `next`. One attempt spends the commit, vested or lapsed. The answer
 *                  carries the slot for the host's pipe; it never rests. From then this keeper is PASSING THE FIRE: every hand
 *                  act that writes (admit, unadmit, lei, publish, sign, keep-seat, rehive, close, name-successor, name-successor-lei, keeper-vest,
 *                  keeper-land) refuses
 *                  `fire-passing`. The vessel's sessions keep serving through it until the shim locks it, so the down's keep and
 *                  census ride the keeper that still holds the fire; the successor holds no socket and serves nothing meanwhile.
 *   keeper-receive (the successor) open the slot with its one-handoff key (spent on the open), adopt the node key and each face
 *                  key, check the slot against this house's own key, the commit and its own closure, carry the budget, and land
 *                  the host half naming what it received. Any refusal or a red pair locks it: the lit fire still burns.
 *   keeper-land    (a keeper the hand lit by passphrase: the struck fire) land the live successor with no vest; a keeper lit by a
 *                  vest, or a passing one, refuses.
 *   take-fire      (a lit successor) claim the vessel socket; it refuses while another keeper still holds it.
 *   name-successor-lei  THE COMMIT THE KUKULU LEI LICENSES (no route; operator ruling 2026-11-24: no count of its own). The host,
 *                  having read a standing kukulu lei on the branch with returns left, testifies the branch, the revision, its tree, the
 *                  fresh-archive recheck, the built image's closure label (it must equal `next`), the local bench verdict over that
 *                  tree (whole: the keeper hashes and checks it), the CI push run (annotation alone, never a gate) and the device
 *                  count; a missing, foreign or red verdict rides as its reading (`benchLine`) and a count read nowhere reads one
 *                  device; the keeper refuses a face read at more than one device, a fork, a live hand successor (a lei never supersedes
 *                  it), a vested commit unlanded, a red last pair and the struck fire due, then rests the same commit
 *                  `name-successor` rests, naming the license. The vest's live rite spends that lei's return (the same return the
 *                  rite spends for the lent face) and names it. `KEEPER_LEI_STANDS` (a code constant inside the closure) turns it off.
 * ── THE HOʻĀLA LEI (`pulama-hoala`): a restarted keeper stands lit again, one counted return per restart ──
 *   hoala-string   THE HAND STRINGS IT. The route PROVES against the lit holder (as `admit`'s does; a miss spends an unlock attempt),
 *                    then the house's end of the bond (the node key, each lit face's key) seals to a fresh device key and rests: the
 *                    slot in this keeper's state, the key in its device directory. Unlit, passing, an unreported closure, no device
 *                    directory, no lit face and a count above twelve without `confirm` each refuse before the route reads;
 *                    `check: true` answers `ready` there. A later stringing supersedes the one before it.
 *   hoala          (an unlit keeper that never stood lit in this life, no route: the start path's own act) open the slot under the
 *                    device key, seat the node key, verify slot and lei under the key that now stands, adopt each face, CLAIM the
 *                    return's receipt, move the slot to the next return (the last return destroys slot and key), then serve. Any
 *                    refusal after a key seated locks this keeper. A keeper whose code closure moved since the stringing wakes all the
 *                    same (operator ruling, 2026-11-26): the return spends, the next slot names the new closure and keeps the prior one
 *                    as the rollback target, and a check that fails under the moved code keeps what rests for the prior keeper.
 *   hoala-admit      THE LEI'S CAPS LICENSE THE ADMIT (operator ruling, 2026-11-26; a lit keeper, no route: the start path's own act). Where the
 *                    image the host reports stands unadmitted and a hoʻāla lei stands with a return left for this keeper's closure, ONE
 *                    return spends (its receipt names `licensed: "admit"`), then the image rests admitted for the lei's lit faces under
 *                    a tessera, as the hand's admit rests it. An image already admitted spends nothing; no standing lei refuses by the
 *                    lei's own reading, and the hand's `admit` stays the path.
 *   hoala-unstring REVOKE WINS (no route, lit or unlit): the device key and the slot die at once and the unstring's word rests.
 *   `status` names a standing hoʻāla lei (`hoala`: its cid, returns, returns left, closure, faces), unverified while unlit.
 *
 *   `status` folds the chain while lit (`keeper`), and names `vestReady` where a live successor can vest; `keeperLei` names the floor
 *   and each licensed commit (branch, revision, the bench verdict's hash, the CI annotation, the lei returns its vest spent), and `leiReady` where one could rest now.
 *
 * An answer names a reading, a count or a public digest. No answer and no log line carries a route or a key; a slot carries keys
 * only sealed to one successor's key.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/the-worn-house#/the-pulama
 */
import { LEI_RETURNS_ASK_ABOVE } from "@lararium/mesh/swarm-door";
import { encodeKeepSeat, mintKeepSeatUnder } from "@lararium/mesh/keep-seat-door";
import { isSwarmLeiRite } from "@lararium/mesh/swarm-lei-rite";
import {
  signSwarmAct,
  swarmActCid,
  swarmLeiUnstrungTitle,
  swarmTesseraPrefix,
  type SwarmBodyParts,
  type SwarmSignerPort,
  type SwarmWikiPort,
} from "@lararium/mesh/swarm-tiddlers";
import { type Credential } from "@lararium/mesh/keyslot-door";
import { lentFacesOf } from "@lararium/mesh/lent-faces";
import { PULAMA_SIGN_KINDS, pulamaSignKind, type PulamaSignContext } from "./pulama-sign.js";
import { nativeKdf } from "@lararium/mesh/node";
import { UNLOCK_ATTEMPTS_PER_BOOT, type CustodyHolder } from "./custody-holder.js";
import { pulamaSignerOf } from "./kukulu-gate.js";
import { pulamaRecordCid } from "./pulama-admit.js";
import {
  CLOSURE, KEEPER_LEI_STANDS, keeperNameSuccessor, keeperNameSuccessorByLei, keeperEphemeral, keeperFold, keeperLand, keeperLeiReady, keeperLicensed, keeperSuccessorStale,
  keeperPayloadDrop, keeperSlotBinds, keeperSlotOf, keeperVest, type KeeperEphemeral, type KeeperRiteReading, type KeeperStanding,
} from "./pulama-keeper.js";
import type { PulamaAdmissions } from "./pulama-admit.js";
import { HOALA_HAND_CURE, HOALA_RETURNS_ASK_ABOVE, hoalaLand, hoalaOpen, hoalaSpendLit, hoalaPayloadDrop, hoalaStanding, hoalaString, hoalaUnstring, type HoalaDevice } from "./pulama-hoala.js";
import type { PulamaServer } from "./pulama-server.js";
import type { RehiveOutcome } from "./face-rehive.js";
import { rehiveLines } from "./face-rehive-lines.js";

export type PulamaHandAnswer = Readonly<Record<string, unknown>> & { readonly op: string };

function credentialsOf(v: unknown): readonly Credential[] | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const out: Credential[] = [];
  for (const c of v as unknown[]) {
    const k = (c as { kind?: unknown } | null)?.kind;
    if (k === "passphrase" && typeof (c as { passphrase?: unknown }).passphrase === "string") out.push({ kind: "passphrase", passphrase: (c as { passphrase: string }).passphrase });
    else if (k === "paper" && Array.isArray((c as { sheets?: unknown }).sheets) && (c as { sheets: unknown[] }).sheets.every((s) => typeof s === "string")) out.push({ kind: "paper", sheets: [...(c as { sheets: string[] }).sheets] });
    else return null;
  }
  return out;
}

/** The face root the hand's `lei` act signs under, read in the pūlama, where the root rests. */
export interface PulamaLeiHand {
  /** The PersonaGroup the face at this ordinal names (its anchors row); null where none reads. */
  group(ordinal: number): Promise<string | null>;
  /** The face root's signer for ONE act, opened fresh under the operator's route (a ward act); a route that opens no slot of the
   *  face's ward throws the ward's refusal by its reading. */
  signer(ordinal: number, credentials: readonly Credential[]): Promise<SwarmSignerPort>;
}

/** The face root the hand's `publish` act signs one offering under, read in the pūlama, where the root rests. */
export interface PulamaPublishHand {
  /** The face root's PUBLIC key at this ordinal (its roster row; no route opens for it); absent where none reads. */
  key(ordinal: number): Promise<string | null | undefined>;
  /** The face root's signer for ONE offering, opened fresh under the operator's route (a ward act); a route that opens no slot
   *  of the face's ward throws the ward's refusal by its reading. */
  signer(ordinal: number, credentials: readonly Credential[]): Promise<{ readonly key: string; sign(bytes: Uint8Array): Promise<string> }>;
}

export { offeringTermsOf, type PulamaOfferingTerms } from "./pulama-offering.js";

/** The face root the hand's `sign` act signs ONE record under (every registered kind), read in the pūlama, where the root rests. */
export interface PulamaSignHand {
  /** The face root's PUBLIC key at this ordinal (its roster row; no route opens for it); absent where none reads. */
  key(ordinal: number): Promise<string | null | undefined>;
  /** The PersonaGroup the face at this ordinal names (its anchors row); null where none reads. */
  group(ordinal: number): Promise<string | null>;
  /** The face root's signer for ONE record, opened fresh under the operator's route (a ward act). */
  signer(ordinal: number, credentials: readonly Credential[]): Promise<{ readonly key: string; sign(bytes: Uint8Array): Promise<string> }>;
}

type LeiAct = "kui" | "restring" | "unstring";
const CID = /^[0-9a-f]{64}$/;

/** The record a lei frame asks the hand to sign, or the refusal its terms read; the shape check runs after (`signSwarmAct`'s own). */
function leiPartsOf(act: LeiAct, group: string, f: Readonly<Record<string, unknown>>): { readonly parts: SwarmBodyParts; readonly after?: string } | { readonly reading: string; readonly detail: string } {
  const malformed = (detail: string) => ({ reading: "lei-malformed", detail });
  const rite = f["rite"], branch = f["branch"];
  if (!isSwarmLeiRite(rite)) return malformed("a lei names its rite: push, kukulu or keep");
  if (typeof branch !== "string" || branch === "") return malformed("a lei names its branch");
  if (act === "unstring") {
    const lei = f["lei"];
    if (typeof lei !== "string" || !CID.test(lei)) return malformed("an unstring names its lei by cid");
    return { parts: { act: "lei-unstrung", group, rite, branch, lei } };
  }
  const after = f["after"] ?? null;
  if (act === "restring" && after === null) return { reading: "lei-restring-names-the-tip", detail: "a restring follows the line's tip: name it (`after`, as `lares lei show` reads it)" };
  if (after !== null && (typeof after !== "string" || !CID.test(after))) return malformed("a lei names the lei it follows by cid (`after`), or none for the line's first");
  const reach = f["reach"] ?? "wide";
  if (reach === "wide") {
    const returns = f["returns"];
    if (f["head"] !== undefined) return malformed("a wide lei names no head");
    if (typeof returns !== "number" || !Number.isSafeInteger(returns) || returns < 1) return malformed("a wide lei names its returns, a count of at least one");
    if (returns > LEI_RETURNS_ASK_ABOVE && f["confirm"] !== true) return { reading: "swarm-lei-returns-unconfirmed", detail: `this lei would carry ${returns} returns, more than ${LEI_RETURNS_ASK_ABOVE}; confirm the count to string it` };
    return { parts: { act: "lei", group, rite, branch, after, reach, returns }, ...(after !== null ? { after } : {}) };
  }
  if (reach === "head") {
    const head = f["head"];
    if (f["returns"] !== undefined) return malformed("a head lei spends once and names no returns");
    if (typeof head !== "string" || head === "") return malformed("a head lei names its head");
    return { parts: { act: "lei", group, rite, branch, after, reach, head }, ...(after !== null ? { after } : {}) };
  }
  return malformed("a lei's reach reads wide or head");
}

export function pulamaHandDoor(a: {
  readonly holder: CustodyHolder;
  readonly server: PulamaServer;
  readonly image: { report(digest: string): void; raised(): string | null };
  readonly records: SwarmWikiPort;
  /** The admitted set the `admit` act rests into. Absent, `admit` refuses `admit-unavailable`. */
  readonly admissions?: PulamaAdmissions;
  /** The face root the `lei` act signs under. Absent, `lei` refuses `lei-unavailable`. */
  readonly lei?: PulamaLeiHand;
  /** The face root the `publish` act signs one offering under. Absent, `publish` refuses `publish-unavailable`. */
  readonly publish?: PulamaPublishHand;
  /** The face root the `sign` act signs one record of the closed set under (`pulama-sign`). Absent, `sign` refuses `sign-unavailable`. */
  readonly sign?: PulamaSignHand;
  /** The rehive of one SHUT face under its own route (`rehiveShutFace` over this pūlama's holder). Absent, `rehive` refuses `rehive-unavailable`. */
  readonly rehive?: (ordinal: number, credentials: readonly Credential[]) => Promise<RehiveOutcome>;
  /** The vessel socket: whether this keeper holds the fire, and the claim a lit successor takes. Absent, `take-fire` refuses `fire-unavailable`. */
  readonly fire?: { holds(): boolean; take(): Promise<{ readonly taken: true } | { readonly refusal: string; readonly detail: string }> };
  /** The face the vessel last wore here (`face.worn`); absent, the chain carries none. */
  readonly worn?: () => number | undefined;
  /** THE LIVE RITE a vest rides (`keeperRiteOver`): the offer read and bound to this keeper move, its return claimed. Absent, `keeper-vest` refuses `vest-rite-unavailable`. */
  readonly keeperRite?: (offer: unknown, keeper: { readonly to: string; readonly next: string }) => Promise<KeeperRiteReading>;
  /** THE HOʻĀLA LEI's device keys (`hoalaDevice` over the keeper's device directory). Absent, every hoala act refuses `hoala-unavailable`. */
  readonly hoala?: HoalaDevice;
  /** THE KEEPER LEI'S FLOOR, a test seam alone: `pulama-main` passes none, so the floor reads `KEEPER_LEI_STANDS` (a code constant). */
  readonly keeperLeiStands?: boolean;
  readonly onLog?: (line: string) => void;
}): (frame: unknown) => Promise<PulamaHandAnswer> {
  const { holder, server } = a;
  const log = a.onLog ?? (() => {});
  let chain: Promise<unknown> = Promise.resolve();
  // THE SEED LINE the host reported beside the image; a later report with no line clears it.
  let seed: string | null = null;
  // THE CLOSURE THIS KEEPER RUNS, as the host reported it: memory alone, since a successor shares the state dir.
  let closure: string | null = null;
  // THE SUCCESSOR'S ONE-HANDOFF KEY, and whether this keeper vested its fire away (every write act then refuses).
  let ephemeral: KeeperEphemeral | null = null;
  let passing = false;
  // HOW THIS KEEPER STANDS LIT: by the hand's light (the struck fire), or by a vest; a lock clears it. Only a struck keeper lands struck.
  let litBy: "hand" | "vest" | "hoala" | null = null;
  // WHETHER THIS KEEPER EVER STOOD LIT IN ITS LIFE: a hoʻāla lei re-stands a RESTARTED keeper alone, so a hand's `lock` stays locked.
  let lived = holder.isUnlocked();
  const leiFloor = a.keeperLeiStands ?? KEEPER_LEI_STANDS;
  const status = () => {
    const closing = server.closing();
    return { lit: holder.isUnlocked(), faces: holder.unlockedFaces().length, sessions: server.sessions(), attemptsLeft: holder.attemptsLeft(), image: a.image.raised(),
      ...(seed !== null ? { seed } : {}), ...(closing.length ? { closing } : {}), ...(closure !== null ? { closure } : {}),
      ...(a.fire ? { fire: a.fire.holds() } : {}), ...(passing ? { passing } : {}) };
  };
  const passingRefusal = (op: string): PulamaHandAnswer => ({ op, reading: "fire-passing", detail: "this keeper vested its fire to a successor, so its hand door writes nothing more; `lares rite kukulu` finishes the handoff (the successor takes the fire and this keeper locks) or, where the successor failed, relights one keeper by passphrase" });
  const openFaces = async (): Promise<Array<{ fcid: string; ordinal: number }>> => {
    const open: Array<{ fcid: string; ordinal: number }> = [];
    for (const fcid of holder.unlockedFaces()) { const at = await holder.faceStanding({ fcid }); if (at !== null) open.push({ fcid: at.fcid, ordinal: at.ordinal }); }
    return open.sort((x, y) => x.ordinal - y.ordinal);
  };
  const standing = async (): Promise<KeeperStanding> => ({ closure, image: a.image.raised(), faces: await openFaces(), worn: a.worn?.() ?? null, spent: UNLOCK_ATTEMPTS_PER_BOOT - holder.attemptsLeft() });
  /** The chain, folded under this keeper's key: an unlit keeper names none. */
  const keeperDigest = async () => {
    if (!holder.isUnlocked()) return {};
    const by = await pulamaSignerOf(holder);
    const fold = await keeperFold(a.records, by);
    const licensed = await keeperLicensed(a.records, by);
    const last = fold.pairs.at(-1);
    const stale = keeperSuccessorStale(fold.successor, closure);
    return {
      // THE KEEPER LEI: the floor, and each commit a kukulu lei licensed with no route (its branch, revision, bench hash, CI annotation and, once vested,
      // the lei returns its rite spent); `leiReady` where the kukulu lei could license one now (the host's stand reading follows it).
      keeperLei: { floor: leiFloor, licensed },
      ...(keeperLeiReady(fold, leiFloor, closure) && !passing ? { leiReady: true } : {}),
      // `staleSuccessor` (with `staleSuccessorWhy`) names a live successor that binds nothing current: the next lei commit supersedes it.
      keeper: { v: fold.v, vestings: fold.vestings, struckDue: fold.struckDue, fork: fold.fork, tip: fold.tip, ...(fold.successor ? { successor: fold.successor.next } : {}), staleSuccessor: stale !== null, ...(stale !== null ? { staleSuccessorWhy: stale } : {}), ...(last ? { last: last.par ? "par" : last.red } : {}) },
      // VEST-READY ONLY WHERE A VEST COULD PROCEED: a live successor, no struck fire due, and a face of one device as the commit read it,
      // or a face of two whose commit carries its co-sign.
      ...(fold.successor && !fold.struckDue && !passing && (fold.successor.devices === null || fold.successor.devices === 1 || (fold.successor.devices !== null && fold.successor.devices > 1 && Array.isArray(fold.successor.body.cosigns))) ? { vestReady: fold.successor.next } : {}),
    };
  };
  /** The admitted digests and the ended ones, read under the pūlama's key: an unlit pūlama names none. */
  const admissionDigests = async () => {
    if (!a.admissions || !holder.isUnlocked()) return {};
    const by = await pulamaSignerOf(holder);
    return { admitted: (await a.admissions.list(by)).map((r) => r.image), ended: [...await a.admissions.ended(by)] };
  };
  /**
   * THE ONE SIGNING PATH (`sign`, and `publish` beneath it): unlit, an unopened face, a kind outside the closed set, a record
   * outside its kind's shape and a face whose root key or group differs from the record's each refuse BEFORE the route reads;
   * `check: true` answers `ready` there and asks for no route (the verb asks it before a person types one). Then the root opens
   * fresh under the route for ONE signature, signs the kind's own preimage and zeroes; the reader's verdict runs over the record,
   * and the answer carries it for the vessel to land. The door writes nothing.
   */
  const signOne = async (op: string, kindName: unknown, faceRaw: unknown, raw: unknown, f: Record<string, unknown>, port: PulamaSignHand): Promise<PulamaHandAnswer> => {
    if (!holder.isUnlocked()) return { op, reading: "pulama-locked", ...status() };
    const face = faceRaw;
    if (typeof face !== "number" || !Number.isSafeInteger(face) || face < 0) return { op, reading: "sign-malformed", detail: "a signing names the face by its whole ordinal" };
    if (!(await openFaces()).some((o) => o.ordinal === face)) return { op, reading: "face-locked", face, ...status() };
    const kind = pulamaSignKind(kindName);
    if (kind === null) return { op, reading: "sign-kind-unknown", face, detail: `the hand signs ${Object.keys(PULAMA_SIGN_KINDS).join(", ")} alone, never ${JSON.stringify(kindName)}` };
    const key = await port.key(face);
    if (typeof key !== "string" || key === "") return { op, reading: "face-root-unread", face, detail: `face h${face} names no root key on its roster row, so nothing signs for it` };
    const ctx: PulamaSignContext = { key: key.toLowerCase(), group: await port.group(face).catch(() => null) };
    // THE CLOSED RECORD READS BEFORE THE ROUTE: the root signs a registered kind's preimage, never bytes a frame names.
    const read = await kind.termsOf(raw, ctx);
    if ("detail" in read) return { op, reading: read.mismatch ? "sign-key-mismatch" : "sign-malformed", face, kind: kindName, detail: read.detail };
    if (f["check"] === true) return { op, reading: "ready", face, kind: kindName, describe: kind.describe(read.terms) };
    const credentials = credentialsOf(f["credentials"]);
    if (credentials === null) return { op, reading: "malformed" };
    let signed: { readonly record: unknown; readonly cid: string };
    try {
      const signer = await port.signer(face, credentials);
      if (signer.key.toLowerCase() !== ctx.key) return { op, reading: "sign-key-mismatch", face, detail: `h${face}'s root signer names another key than its roster row` };
      signed = await kind.sign(read.terms, signer);
    } catch (err) {
      const e = err as { reading?: unknown; code?: unknown; message?: unknown };
      const reading = typeof e.reading === "string" ? e.reading : typeof e.code === "string" ? e.code : "sign-refused";
      log(`${op}: ${reading}`);
      return { op, reading, face, ...(typeof e.message === "string" ? { detail: e.message } : {}) };
    }
    const fault = await kind.verify(signed.record, ctx);
    if (fault !== null) return { op, reading: "sign-unverified", face, detail: fault };
    log(`signed by hand: ${kind.describe(read.terms)} for h${face}; the vessel lands it`);
    return { op, reading: "signed", face, kind: kindName, record: signed.record, cid: signed.cid };
  };
  const act = async (frame: unknown): Promise<PulamaHandAnswer> => {
    const f = (typeof frame === "object" && frame !== null ? frame : {}) as Record<string, unknown>;
    switch (f["op"]) {
      case "light": {
        const credentials = credentialsOf(f["credentials"]);
        if (credentials === null) return { op: "light", reading: "malformed" };
        const opened = await holder.unlock(credentials);
        if (opened.reading !== "opens" && opened.reading !== "already-unlocked") { log(`light: ${opened.reading}`); return { op: "light", ...opened, ...status() }; }
        const faces = (await holder.unlockFaces(credentials)).map((r) => r.reading);
        if (opened.reading === "opens") litBy = "hand";
        lived = true;
        server.refresh();
        log(`lit: ${faces.filter((r) => r === "opens" || r === "already-unlocked").length} face(s) open`);
        // THE STRUCK FIRE IS ONE PROOF: `admit: true` admits the reported image for every lit face under the route that just lit,
        // so a moved closure asks the passphrase once. An image already admitted stays as it stands.
        // A KEEPER THAT PASSED ITS FIRE NAMES IT (blind read F4), never a silent skip: its lock spends the passing, then a struck light admits.
        if (f["admit"] === true && passing) return { op: "light", reading: opened.reading, faceReadings: faces, admit: "fire-passing", detail: "this keeper vested its fire to a successor, so it admits nothing; lock it (`lares pulama lock`) and light it again to strike the fire here, or finish the handoff: lares rite kukulu", ...status() };
        if (f["admit"] === true && a.admissions) {
          const image = a.image.raised();
          if (image === null) return { op: "light", reading: opened.reading, faceReadings: faces, admit: "image-unreported", ...status() };
          const by = await pulamaSignerOf(holder);
          const standing = await a.admissions.admitted(image, by);
          if (standing !== null && !("refusal" in standing)) return { op: "light", reading: opened.reading, faceReadings: faces, admit: "already-admitted", ...status() };
          const open = await openFaces();
          if (!open.length) return { op: "light", reading: opened.reading, faceReadings: faces, admit: "face-locked", ...status() };
          const { tessera } = await a.admissions.admitByHand(image, open, by);
          log(`admitted by hand at the light: the reported image now serves ${open.map((o) => `h${o.ordinal}`).join(", ")}`);
          return { op: "light", reading: opened.reading, faceReadings: faces, admit: "admitted", admitted: image, tessera, ...status() };
        }
        return { op: "light", reading: opened.reading, faceReadings: faces, ...status() };
      }
      case "admit": {
        if (passing) return passingRefusal("admit");
        if (!a.admissions) return { op: "admit", reading: "admit-unavailable" };
        // UNLIT OR UNREPORTED REFUSES BEFORE THE ROUTE READS: nothing proves against a holder that holds no key, and no image stands to admit.
        if (!holder.isUnlocked()) return { op: "admit", reading: "pulama-locked", ...status() };
        const image = a.image.raised();
        if (image === null) return { op: "admit", reading: "image-unreported", ...status() };
        const credentials = credentialsOf(f["credentials"]);
        if (credentials === null) return { op: "admit", reading: "malformed" };
        // THE FACES NAMED: whole ordinals, each once; none named admits every lit face. A lone `face` names no set.
        const raw = f["faces"] ?? [];
        if (f["face"] !== undefined || !Array.isArray(raw) || raw.some((n) => typeof n !== "number")) return { op: "admit", reading: "lent-faces-malformed" };
        if (raw.length > 0) { const parsed = lentFacesOf(raw); if (!parsed.ok) return { op: "admit", reading: parsed.refusal }; }
        const named = raw as number[];
        // THE ROUTE PROVES A PERSON STANDS HERE: it opens a slot of this vessel's tree to the key already held, and opens nothing new.
        const proof = await holder.proves(credentials);
        if (proof.reading !== "proves") { log(`admit: ${proof.reading}`); return { op: "admit", ...proof, ...status() }; }
        const open: Array<{ fcid: string; ordinal: number }> = [];
        for (const fcid of holder.unlockedFaces()) { const at = await holder.faceStanding({ fcid }); if (at !== null) open.push({ fcid: at.fcid, ordinal: at.ordinal }); }
        const missing = named.find((n) => !open.some((o) => o.ordinal === n));
        if (missing !== undefined) return { op: "admit", reading: "face-locked", face: missing, openFaces: open.map((o) => o.ordinal), ...status() };
        const faces = named.length ? open.filter((o) => named.includes(o.ordinal)) : open;
        if (!faces.length) return { op: "admit", reading: "face-locked", openFaces: [], ...status() };
        const { tessera } = await a.admissions.admitByHand(image, faces, await pulamaSignerOf(holder));
        const ordinals = faces.map((face) => face.ordinal).sort((x, y) => x - y);
        log(`admitted by hand: the reported image now serves ${ordinals.map((n) => `h${n}`).join(", ")}`);
        return { op: "admit", reading: "admitted", admitted: image, tessera, ...status(), lent: ordinals };
      }
      case "unadmit": {
        if (passing) return passingRefusal("unadmit");
        if (!a.admissions) return { op: "unadmit", reading: "admit-unavailable" };
        if (!holder.isUnlocked()) return { op: "unadmit", reading: "pulama-locked", ...status() };
        const image = f["image"];
        const credentials = credentialsOf(f["credentials"]);
        if (typeof image !== "string" || image === "" || credentials === null) return { op: "unadmit", reading: "malformed" };
        // THE ROUTE PROVES A PERSON STANDS HERE, as an admission's does; it opens nothing new.
        const proof = await holder.proves(credentials);
        if (proof.reading !== "proves") { log(`unadmit: ${proof.reading}`); return { op: "unadmit", ...proof, ...status() }; }
        const ended = await a.admissions.unadmit(image, await pulamaSignerOf(holder));
        if (ended === null) return { op: "unadmit", reading: "image-not-admitted", digest: image, ...status() };
        if ("occupied" in ended) {
          log("unadmit: the tombstone slot holds a row the pūlama never signed; the admission still stands");
          return { op: "unadmit", reading: "unadmit-slot-occupied", digest: image, slot: ended.occupied, detail: `the tombstone slot ${ended.occupied} holds a row the pūlama's key never signed, so no tombstone rests and the admission still stands; clear that row from the pūlama's state dir, then unadmit again`, ...status() };
        }
        if (ended.already === true) return { op: "unadmit", reading: "unadmitted", already: true, digest: image, ends: ended.ends, ...status() };
        log("unadmitted by hand: an image's admission rests ended under a tombstone");
        return { op: "unadmit", reading: "unadmitted", digest: image, ends: ended.ends, ...status() };
      }
      case "lei": {
        if (passing) return passingRefusal("lei");
        if (!a.lei) return { op: "lei", reading: "lei-unavailable" };
        // UNLIT REFUSES BEFORE ANYTHING READS: no root rests open to sign under.
        if (!holder.isUnlocked()) return { op: "lei", reading: "pulama-locked", ...status() };
        const act = f["act"], face = f["face"];
        if ((act !== "kui" && act !== "restring" && act !== "unstring") || typeof face !== "number" || !Number.isSafeInteger(face) || face < 0) {
          return { op: "lei", reading: "lei-malformed", detail: "a lei act names kui, restring or unstring, and the face by its whole ordinal" };
        }
        let open = false;
        for (const fcid of holder.unlockedFaces()) { if ((await holder.faceStanding({ fcid }))?.ordinal === face) { open = true; break; } }
        if (!open) return { op: "lei", act, reading: "face-locked", face, ...status() };
        const group = await a.lei.group(face);
        if (group === null) return { op: "lei", act, reading: "face-group-unread", face, detail: `face h${face} names no PersonaGroup in its anchors, so no lei signs for it` };
        const terms = leiPartsOf(act, group, f);
        if ("reading" in terms) return { op: "lei", act, ...terms };
        // THE SHAPE READS BEFORE THE ROUTE: a body no swarm control forms signs nothing, so a probe that signs nothing judges it.
        try { await signSwarmAct(terms.parts, { key: "", sign: async () => "" }); }
        catch { return { op: "lei", act, reading: "lei-malformed", detail: "the lei's terms form no swarm record (its branch reads as no name)" }; }
        // EVERY CHECK SHORT OF THE ROUTE has run: `check: true` answers `ready` here and reads no route (the verb asks it before a
        // person types one, as `sign` and `publish` do).
        if (f["check"] === true) return { op: "lei", act, reading: "ready", face };
        const credentials = credentialsOf(f["credentials"]);
        if (credentials === null) return { op: "lei", act, reading: "malformed" };
        // THE ROUTE OPENS THE FACE ROOT FOR THIS ONE SIGNATURE, here in the pūlama; the record leaves, the root never does.
        let record: Awaited<ReturnType<typeof signSwarmAct>>;
        try { record = await signSwarmAct(terms.parts, await a.lei.signer(face, credentials)); }
        catch (err) {
          const e = err as { reading?: unknown; code?: unknown; message?: unknown };
          const reading = typeof e.reading === "string" ? e.reading : typeof e.code === "string" ? e.code : "lei-sign-refused";
          log(`lei ${act}: ${reading}`);
          return { op: "lei", act, reading, face, ...(typeof e.message === "string" ? { detail: e.message } : {}) };
        }
        // AN UNSTRING RESTS HERE TOO: the pūlama's own reuse of a begun half reads its records, never an offer that may omit it.
        if (terms.parts.act === "lei-unstrung") await a.records.writeNew(swarmLeiUnstrungTitle(terms.parts.lei), JSON.stringify(record));
        log(`signed by hand: a ${terms.parts.act === "lei-unstrung" ? "lei's unstring" : "lei"} for h${face}; the vessel lands it`);
        return { op: "lei", act, reading: "signed", face, record, cid: swarmActCid(record), ...(act === "restring" ? { restrung: terms.after } : {}) };
      }
      case "publish": {
        // THE OFFERING'S OWN ACT rides the one `sign` path under kind `plugin-offering`; its answer keeps its own words.
        if (passing) return passingRefusal("publish");
        if (!a.publish) return { op: "publish", reading: "publish-unavailable" };
        const out = await signOne("publish", "plugin-offering", f["face"], f["offering"], f, { key: a.publish.key, group: async () => null, signer: a.publish.signer });
        const { record, kind: _kind, ...rest } = out as Record<string, unknown>;
        if (rest["reading"] === "sign-malformed") rest["reading"] = "publish-malformed";
        if (rest["reading"] === "sign-key-mismatch") rest["reading"] = "publish-offeror-mismatch";
        if (rest["reading"] === "sign-unverified") rest["reading"] = "publish-unverified";
        return { ...rest, op: "publish", ...(record !== undefined ? { offering: record } : {}) } as PulamaHandAnswer;
      }
      case "sign": {
        if (passing) return passingRefusal("sign");
        if (!a.sign) return { op: "sign", reading: "sign-unavailable" };
        return signOne("sign", f["kind"], f["face"], f["record"], f, a.sign);
      }
      case "keep-seat": {
        if (passing) return passingRefusal("keep-seat");
        // THE KEEP SEAT AT THE PŪLAMA: a house the pūlama keeps reads its route here alone. The route PROVES against the lit
        // holder's key (it opens nothing new; a miss spends an attempt), and the pair mints under the credentials that proof names:
        // the seat (public half, the slot tree wrapping its secret) and the signing seed answer over this hand socket alone, to the
        // verb in this same pūlama, which writes the house's seat file and prints neither.
        if (!holder.isUnlocked()) return { op: "keep-seat", reading: "pulama-locked", ...status() };
        const credentials = credentialsOf(f["credentials"]);
        if (credentials === null) return { op: "keep-seat", reading: "malformed" };
        const proof = await holder.proves(credentials);
        if (proof.reading !== "proves") { log(`keep-seat: ${proof.reading}`); return { op: "keep-seat", ...proof, ...status() }; }
        const opener = proof.opener.map((i) => credentials[i]).filter((c): c is Credential => c !== undefined);
        let mint: Awaited<ReturnType<typeof mintKeepSeatUnder>>;
        try { mint = await mintKeepSeatUnder(opener, nativeKdf); }
        catch (e) { return { op: "keep-seat", reading: "keep-seat-unchecked", detail: e instanceof Error ? e.message : String(e) }; }
        if (mint === null) return { op: "keep-seat", reading: "keep-seat-unseatable", detail: "the proved route holds no human route the keep binds (a passkey alone)" };
        const signingSeed = Buffer.from(mint.signingSeed).toString("hex");
        mint.signingSeed.fill(0);
        log("keep-seat: a fresh keep pair seated under the proved route; the verb writes the house's seat");
        return { op: "keep-seat", reading: "seated", seat: encodeKeepSeat(mint.seat), signingSeed, publicKey: Buffer.from(mint.seat.publicKey).toString("hex") };
      }
      case "rehive": {
        if (passing) return passingRefusal("rehive");
        if (!a.rehive) return { op: "rehive", reading: "rehive-unavailable" };
        const face = f["face"];
        const credentials = credentialsOf(f["credentials"]);
        if (typeof face !== "number" || !Number.isSafeInteger(face) || face < 0 || credentials === null) return { op: "rehive", reading: "malformed", detail: "a rehive names the face by its whole ordinal and carries the face's own route" };
        // THE FACE STANDS SHUT HERE, read before the route: a lit face's rows serve a vessel now.
        const at = await holder.faceStanding({ ordinal: face });
        if (at === null) return { op: "rehive", reading: "face-not-standing", face };
        if (at.unlocked) return { op: "rehive", reading: "face-open", face, detail: `face h${face} stands lit at the pūlama: shut it first (tools/lares-container.sh pulama lock, which shuts every face and leaves the vessel at its floor), then rehive; nothing moved`, ...status() };
        try {
          const out = await a.rehive(face, credentials);
          log(`rehived by hand: h${face} ${out.outcome}`);
          return { op: "rehive", reading: "rehived", face, ...out, lines: rehiveLines({ face, ...out }, "pulama") };
        } catch (err) {
          const e = err as { reason?: unknown; message?: unknown };
          const reading = typeof e.reason === "string" ? e.reason : "rehive-failed";
          log(`rehive h${face}: ${reading}`);
          return { op: "rehive", reading, face, ...(typeof e.message === "string" ? { detail: e.message } : {}) };
        }
      }
      case "recard": {
        if (passing) return passingRefusal("recard");
        if (!server.grantRecard || !holder.openFaceForAct) return { op: "recard", reading: "recard-unavailable" };
        const face = f["face"];
        const credentials = credentialsOf(f["credentials"]);
        if (typeof face !== "number" || !Number.isSafeInteger(face) || face < 0 || credentials === null) return { op: "recard", reading: "malformed", detail: "a recard names the face by its whole ordinal and carries the face's own route" };
        // UNLIT REFUSES BEFORE THE ROUTE READS, and a face shut here holds no key the vessel lights.
        if (!holder.isUnlocked()) return { op: "recard", reading: "pulama-locked", face, detail: `the pūlama stands unlit: light it (tools/lares-container.sh pulama light), then tools/lares-container.sh pulama recard ${face}; nothing moved`, ...status() };
        const at = await holder.faceStanding({ ordinal: face });
        if (at === null) return { op: "recard", reading: "face-not-standing", face, detail: `no face h${face} stands in this house (\`lares vessel roster\` names each face); nothing moved` };
        if (!at.unlocked) return { op: "recard", reading: "face-shut", face, detail: `face h${face} stands shut at the pūlama: light it (tools/lares-container.sh pulama light), let the vessel's light refuse it by name, then tools/lares-container.sh pulama recard ${face}; nothing moved`, ...status() };
        // THE FACE'S OWN ROUTE PROVES A PERSON STANDS HERE: its key opens for the proof alone, and the copy zeroes at once.
        const proof = await holder.openFaceForAct({ ordinal: face }, credentials, { whileOpen: true });
        if (proof.reading !== "opens") {
          log(`recard h${face}: ${proof.reading}`);
          const left = "attemptsLeft" in proof ? proof.attemptsLeft : undefined;
          return { op: "recard", reading: proof.reading, face, ...(left !== undefined ? { attemptsLeft: left } : {}),
            detail: proof.reading === "no-slot-opens"
              ? `no slot of face h${face} opens under what the hand presented: a recard asks the FACE's own route, never the vessel's; nothing moved (${String(left)} attempt(s) left this boot for this face)`
              : `face h${face} did not open for the recard (${proof.reading}); nothing moved. Read it with tools/lares-container.sh pulama status` };
        }
        proof.fck.fill(0);
        if (server.grantRecard(face) === null) return { op: "recard", reading: "face-not-standing", face, detail: `no face h${face} stands in this house's face index; nothing moved` };
        log(`recard granted by hand: h${face}`);
        return { op: "recard", reading: "granted", face, lines: [
          `face h${face}: its own route proved at the pūlama, and one recard grant stands for the vessel that lends it.`,
          `Next, at the vessel: lares vault recard face=${face} (it arms the face's next light and spends the grant; a face that needs no recard leaves the grant unspent).`,
          "A lock of the pūlama forgets the grant.",
        ] };
      }
      // THE LOCK SPENDS THE PASSING (blind read F4): the slot already left, the keys zero here, and a later light strikes the fire anew.
      case "lock": await server.lock(); litBy = null; passing = false; return { op: "lock", ...status() };
      case "close": {
        if (passing) return passingRefusal("close");
        if (!holder.isUnlocked()) return { op: "close", reading: "pulama-locked", ...status() };
        const face = f["face"];
        if (typeof face !== "number" || !Number.isSafeInteger(face) || face < 0 || (f["force"] !== undefined && typeof f["force"] !== "boolean")) {
          return { op: "close", reading: "malformed", detail: "a close names the face by its whole ordinal, and `force` true or false" };
        }
        const closed = await server.closeFace(face, { force: f["force"] === true });
        log(`close: face h${face} ${closed.reading}`);
        return { op: "close", ...closed, ...status() };
      }
      case "status": {
        const lei = a.hoala ? await hoalaStanding(a.records).catch(() => null) : null;
        return { op: "status", ...status(), ...await admissionDigests(), ...await keeperDigest(), ...(litBy === "hoala" ? { litBy } : {}), ...(lei !== null ? { hoala: { ...lei, verified: holder.isUnlocked() } } : {}) };
      }
      case "hoala-string": {
        if (passing) return passingRefusal("hoala-string");
        if (!a.hoala || !holder.handOver) return { op: "hoala-string", reading: "hoala-unavailable", detail: "this keeper seats no hoʻāla lei" };
        // UNLIT, UNREPORTED, UNSEATED AND MALFORMED EACH REFUSE BEFORE THE ROUTE READS.
        if (!holder.isUnlocked()) return { op: "hoala-string", reading: "pulama-locked", detail: "the pūlama stands unlit: light it first (`lares pulama light`), then string the hoʻāla lei", ...status() };
        if (closure === null) return { op: "hoala-string", reading: "closure-unreported", detail: "the host reported no closure for this keeper, so the lei cannot name the keeper it licenses; `lares up` reports it, then string again" };
        if (!a.hoala.seated()) return { op: "hoala-string", reading: "hoala-device-unseated", detail: "this keeper mounts no device directory, so no device key rests and no hoʻāla lei strings; raise the keeper on an image and compose file that carry the device volume (`lares rite kukulu`), then string again" };
        const returns = f["returns"];
        if (typeof returns !== "number" || !Number.isSafeInteger(returns) || returns < 1) return { op: "hoala-string", reading: "hoala-malformed", detail: "a hoʻāla lei names its returns, a count of at least one: lares lei kui rite=hoala returns=<n>" };
        if (returns > HOALA_RETURNS_ASK_ABOVE && f["confirm"] !== true) return { op: "hoala-string", reading: "hoala-returns-unconfirmed", detail: `this lei would carry ${returns} returns, more than ${HOALA_RETURNS_ASK_ABOVE}; confirm the count to string it (--yes)` };
        if ((await openFaces()).length === 0) return { op: "hoala-string", reading: "face-locked", detail: "no face stands lit at this keeper, so a restart would relight none; light it with the route that opens your faces (`lares pulama light`), then string again", ...status() };
        if (f["check"] === true) return { op: "hoala-string", reading: "ready", returns };
        const credentials = credentialsOf(f["credentials"]);
        if (credentials === null) return { op: "hoala-string", reading: "malformed" };
        // THE ROUTE PROVES A PERSON STANDS HERE, as an admission's does; it opens nothing new.
        const proof = await holder.proves(credentials);
        if (proof.reading !== "proves") { log(`hoala-string: ${proof.reading}`); return { op: "hoala-string", ...proof, ...status() }; }
        const keys = holder.handOver?.() ?? null;
        if (keys === null) return { op: "hoala-string", reading: "pulama-locked", ...status() };
        try {
          const strung = await hoalaString(a.records, await pulamaSignerOf(holder), a.hoala, { returns, closure, image: a.image.raised(), keys, worn: a.worn?.() ?? null });
          if ("refusal" in strung) { log(`hoala-string: ${strung.refusal}`); return { op: "hoala-string", reading: strung.refusal, detail: strung.detail }; }
          log(`hoʻāla lei strung by hand: ${strung.returns} return(s) for ${strung.faces.map((n) => `h${n}`).join(", ")}; the slot rests in this keeper's state and its key on this device`);
          return { op: "hoala-string", reading: "strung", lei: strung.lei, returns: strung.returns, faces: strung.faces, ...(strung.supersedes !== null ? { supersedes: strung.supersedes } : {}) };
        } finally { keys.treeKey.fill(0); for (const face of keys.faces) face.fck.fill(0); }
      }
      case "hoala-unstring": {
        if (!a.hoala) return { op: "hoala-unstring", reading: "hoala-unavailable", detail: "this keeper seats no hoʻāla lei" };
        // REVOKE WINS: no route and no light gate a destruction, which lowers power alone.
        const ended = await hoalaUnstring(a.records, a.hoala, holder.isUnlocked() ? await pulamaSignerOf(holder) : null);
        log(ended.lei !== null ? "hoʻāla lei unstrung: its slot and device key stand destroyed" : "hoala-unstring: no hoʻāla lei stood");
        return ended.lei !== null ? { op: "hoala-unstring", reading: "unstrung", lei: ended.lei, keys: ended.keys } : { op: "hoala-unstring", reading: "hoala-lei-absent", keys: ended.keys, detail: "no hoʻāla lei stands at this keeper; nothing to unstring" };
      }
      case "hoala-admit": {
        if (passing) return passingRefusal("hoala-admit");
        if (!a.hoala || !a.admissions || !holder.handOver) return { op: "hoala-admit", reading: "hoala-unavailable", detail: "this keeper seats no hoʻāla lei; admit the image by hand on a terminal: lares pulama admit" };
        if (!holder.isUnlocked()) return { op: "hoala-admit", reading: "pulama-locked", detail: "the pūlama stands unlit, so nothing admits; `lares rite hoala` lights it first", ...status() };
        const image = a.image.raised();
        if (image === null) return { op: "hoala-admit", reading: "image-unreported", ...status() };
        const by = await pulamaSignerOf(holder);
        const standing = await a.admissions.admitted(image, by);
        // AN IMAGE ALREADY ADMITTED SPENDS NOTHING.
        if (standing !== null && !("refusal" in standing)) return { op: "hoala-admit", reading: "already-admitted", admitted: image, ...status() };
        const keys = holder.handOver?.() ?? null;
        if (keys === null) return { op: "hoala-admit", reading: "pulama-locked", ...status() };
        try {
          // THE RETURN CLAIMS BEFORE THE ADMISSION RESTS: a refusal here spends nothing and admits nothing.
          const spent = await hoalaSpendLit(a.records, by, a.hoala, { closure, keys, worn: a.worn?.() ?? null, image, licensed: "admit" });
          if ("refusal" in spent) { log(`hoala-admit: ${spent.refusal}`); return { op: "hoala-admit", reading: spent.refusal, detail: `${spent.detail} (or admit this image by hand on a terminal: lares pulama admit)`, ...status() }; }
          const { tessera } = await a.admissions.admitByHand(image, spent.faces, by);
          log(`admitted under the hoʻāla lei: the reported image now serves ${spent.faces.map((o) => `h${o.ordinal}`).join(", ")}; return ${spent.n} of ${spent.of} spent, no route asked`);
          return { op: "hoala-admit", reading: "admitted", admitted: image, tessera, lei: spent.lei, n: spent.n, of: spent.of, left: spent.left, receipt: spent.receipt, lent: spent.faces.map((o) => o.ordinal), ...status() };
        } finally { keys.treeKey.fill(0); for (const face of keys.faces) face.fck.fill(0); }
      }
      case "hoala": {
        if (!a.hoala || !holder.adoptFace) return { op: "hoala", reading: "hoala-unavailable", detail: `this keeper seats no hoʻāla lei; ${HOALA_HAND_CURE}` };
        if (holder.isUnlocked()) return { op: "hoala", reading: "keeper-lit", detail: "this keeper stands lit already, so no return spends", ...status() };
        // ONE LIFE: a keeper that stood lit and locked stays locked until the hand lights it.
        if (lived) return { op: "hoala", reading: "hoala-keeper-lived", detail: "this keeper stood lit in this life and a hand locked it, and a hoʻāla lei re-stands a restarted keeper alone; light it by hand on a terminal: lares pulama light", ...status() };
        const opened = await hoalaOpen(a.records, a.hoala, { closure });
        if ("refusal" in opened) { log(`hoala: ${opened.refusal}`); return { op: "hoala", reading: opened.refusal, detail: opened.detail, ...status() }; }
        const red = async (reading: string, detail: string): Promise<PulamaHandAnswer> => { await holder.lock(); litBy = null; log(`hoala: ${reading}; nothing stays seated`); return { op: "hoala", reading, detail, ...status() }; };
        try {
          try { await holder.adopt(opened.payload.node as Parameters<CustodyHolder["adopt"]>[0]); }
          catch { return red("hoala-slot-refused", `the node key the hoʻāla lei's slot carried opens no custody root of this house; ${HOALA_HAND_CURE}`); }
          lived = true;
          const by = await pulamaSignerOf(holder);
          const adopted: Array<{ fcid: string; ordinal: number }> = [];
          for (const face of opened.payload.faces) {
            const lit = await holder.adoptFace?.(face.fcid, face.fck);
            if (lit?.reading === "opens" || lit?.reading === "already-unlocked") adopted.push({ fcid: face.fcid, ordinal: face.ordinal });
          }
          const landed = await hoalaLand(a.records, by, a.hoala, { slot: opened.slot, text: opened.text, payload: opened.payload, image: a.image.raised(), lit: adopted, closure: closure ?? opened.slot.body.closure });
          if ("refusal" in landed) return red(landed.refusal, landed.detail);
          litBy = "hoala";
          server.refresh();
          log(`woke by the hoʻāla lei: return ${landed.n} of ${landed.of} spent, ${adopted.length} face(s) lit${landed.prior !== null ? "; the keeper's code moved under the lei, and the prior closure stays the rollback" : ""}${landed.left === 0 ? "; the lei's returns lie spent and nothing rests" : ""}`);
          return { op: "hoala", reading: "woke", lei: landed.lei, n: landed.n, of: landed.of, left: landed.left, receipt: landed.receipt, ...(landed.prior !== null ? { moved: true, prior: landed.prior } : {}), woke: adopted.map((face) => face.ordinal).sort((x, y) => x - y), ...status() };
        } finally { hoalaPayloadDrop(opened.payload); }
      }
      case "closure": {
        if (typeof f["digest"] !== "string" || !CLOSURE.test(f["digest"])) return { op: "closure", reading: "malformed", detail: "a closure reads `sha256:<64 hex>`" };
        closure = f["digest"];
        log("the host reported this keeper's code closure");
        return { op: "closure", reading: "reported", closure };
      }
      case "name-successor": {
        if (passing) return passingRefusal("name-successor");
        if (!holder.isUnlocked()) return { op: "name-successor", reading: "pulama-locked", ...status() };
        if (closure === null) return { op: "name-successor", reading: "closure-unreported", detail: "the host reported no closure for this keeper (`closure <digest>`), so the chain cannot name what it hands from" };
        const next = f["next"];
        if (typeof next !== "string" || !CLOSURE.test(next)) return { op: "name-successor", reading: "next-malformed", detail: "the successor's closure reads `sha256:<64 hex>`" };
        const credentials = credentialsOf(f["credentials"]);
        if (credentials === null) return { op: "name-successor", reading: "malformed" };
        // THE ROUTE PROVES A PERSON STANDS HERE, as an admission's does: the human's consent names ONE successor closure.
        const proof = await holder.proves(credentials);
        if (proof.reading !== "proves") { log(`name-successor: ${proof.reading}`); return { op: "name-successor", ...proof, ...status() }; }
        // THE DEVICE COUNT the vessel read at commit time rides the commit's own body; none read rides as null, and the vest fails closed on it.
        const devices = typeof f["devices"] === "number" && Number.isSafeInteger(f["devices"]) && f["devices"] >= 1 ? f["devices"] : null;
        // THE CARRIED CO-SIGN (`lares intent keeper-cosign`): the commit's nonce and each face's spent co-sign, read once at the vest.
        const cosign = f["cosign"] === undefined ? null : f["cosign"];
        const out = await keeperNameSuccessor(a.records, await pulamaSignerOf(holder), { ...await standing(), next, devices, cosign });
        if ("refusal" in out) return { op: "name-successor", reading: out.refusal, detail: out.detail };
        log(`keeper named a successor: v${out.v} names the successor closure${out.supersedes !== null ? ", superseding the commit before it" : ""}`);
        return { op: "name-successor", reading: "named", ...out };
      }
      case "name-successor-lei": {
        // THE COMMIT THE KUKULU LEI LICENSES (no route: the consent rode the hand's kukulu lei, whose return the vest's rite spends).
        // The host testifies what it read (the branch, the revision, its tree, the recheck, the image's closure label, the local bench
        // verdict whole, the CI run as annotation, the device count); the keeper checks the verdict and its own bounds and rests the commit.
        if (passing) return passingRefusal("name-successor-lei");
        if (!holder.isUnlocked()) return { op: "name-successor-lei", reading: "pulama-locked", ...status() };
        const next = f["next"];
        if (typeof next !== "string" || !CLOSURE.test(next)) return { op: "name-successor-lei", reading: "next-malformed", detail: "the successor's closure reads `sha256:<64 hex>`" };
        const word = (k: string): string => (typeof f[k] === "string" ? f[k] : "");
        const devices = typeof f["devices"] === "number" && Number.isSafeInteger(f["devices"]) && f["devices"] >= 1 ? f["devices"] : null;
        const out = await keeperNameSuccessorByLei(a.records, await pulamaSignerOf(holder), { ...await standing(), next, devices, branch: word("branch"), rev: word("rev"), tree: word("tree"), recheck: word("recheck"), image: word("image"), bench: f["bench"], ci: word("ci"), floor: leiFloor });
        if ("refusal" in out) { log(`name-successor-lei: ${out.refusal}`); return { op: "name-successor-lei", reading: out.refusal, detail: out.detail }; }
        log(`keeper named a successor under the kukulu lei of ${out.branch}: v${out.v} names the successor closure; the vest's rite spends the lei's return`);
        return { op: "name-successor-lei", reading: "named", ...out };
      }
      case "keeper-offer": {
        if (holder.isUnlocked()) return { op: "keeper-offer", reading: "keeper-lit", detail: "a lit keeper holds a fire already; only an unlit successor offers a key" };
        ephemeral?.drop();
        ephemeral = keeperEphemeral();
        log("keeper-offer: a one-handoff key stands for one vest");
        return { op: "keeper-offer", reading: "offered", to: ephemeral.pub, closure, image: a.image.raised() };
      }
      case "keeper-vest": {
        if (passing) return passingRefusal("keeper-vest");
        if (!holder.isUnlocked() || !holder.handOver) return { op: "keeper-vest", reading: "pulama-locked", ...status() };
        const to = f["to"], theirs = f["closure"];
        if (typeof to !== "string" || typeof theirs !== "string") return { op: "keeper-vest", reading: "malformed", detail: "a vest names the successor's key (`to`), the closure its host reported (`closure`) and the live rite's offer (`offer`)" };
        // A VEST RIDES A LIVE RITE: the offer's vouches name this move, and the vest begins the rite itself (one lei return).
        const ride = a.keeperRite;
        const rite = ride ? (keeper: { readonly to: string; readonly next: string }) => ride(f["offer"], keeper)
          : async () => ({ ok: false as const, refusal: "vest-rite-unavailable", detail: "this keeper reads no kūkulu rite, so nothing vests; light the successor by hand: lares rite kukulu on a terminal" });
        const out = await keeperVest(a.records, await pulamaSignerOf(holder), { to, closure: theirs, rite, keys: () => holder.handOver!(), spent: UNLOCK_ATTEMPTS_PER_BOOT - holder.attemptsLeft(), worn: a.worn?.() ?? null, leiFloor });
        if ("refusal" in out) { log(`keeper-vest: ${out.refusal}`); return { op: "keeper-vest", reading: out.refusal, detail: out.detail }; }
        passing = true;
        log(`keeper-vest: the fire vests to one successor key (${out.faces.map((n) => `h${n}`).join(", ") || "no face"}); this keeper passes it`);
        return { op: "keeper-vest", reading: "vested", tessera: out.tessera, faces: out.faces, rite: out.rite, slot: out.slot };
      }
      case "keeper-receive": {
        if (holder.isUnlocked()) return { op: "keeper-receive", reading: "keeper-lit", detail: "this keeper stands lit already; a slot opens only on an unlit successor" };
        if (ephemeral === null) return { op: "keeper-receive", reading: "offer-absent", detail: "no one-handoff key stands here (`keeper-offer` first)" };
        if (ephemeral.spent()) return { op: "keeper-receive", reading: "offer-spent", detail: "this keeper's one-handoff key opened a slot already; a slot spends once" };
        const slot = keeperSlotOf(f["slot"]);
        if (slot === null) return { op: "keeper-receive", reading: "malformed", detail: "a receive carries one keeper slot" };
        if (slot.body.to !== ephemeral.pub) return { op: "keeper-receive", reading: "slot-names-another", detail: "the slot names another successor key than this keeper's offer" };
        const payload = ephemeral.open(slot.body);
        if (payload === null) return { op: "keeper-receive", reading: "slot-unopened", detail: "the slot opens under no key this keeper offered; nothing seats" };
        // A RECEIVE THAT FAILS LOCKS THIS SUCCESSOR, and the fire-holder (which vested, so it passes the fire and writes nothing) still
        // serves; the cure that runs from here is the struck fire, which relights one keeper by passphrase.
        const cure = "this successor locks; the old keeper still holds the fire but passes it and writes nothing: relight one keeper by hand with `lares rite kukulu` on a terminal (the struck fire)";
        const red = async (reading: string, detail: string): Promise<PulamaHandAnswer> => { await holder.lock(); litBy = null; log(`keeper-receive: ${reading}; nothing stays seated`); return { op: "keeper-receive", reading, detail: `${detail}; ${cure}`, ...status() }; };
        // THE KEYS ARRIVE AS BYTES (blind read F8) and zero when the receive settles, whichever way it settles.
        try {
          try { await holder.adopt(payload.node as Parameters<CustodyHolder["adopt"]>[0]); }
          catch { return red("slot-refused", "the node key the slot carried opens no custody root here"); }
          const by = await pulamaSignerOf(holder);
          const binds = await keeperSlotBinds(a.records, by, slot, { to: ephemeral.pub, closure });
          if (binds !== null) return red(binds.refusal, binds.detail);
          const adopted: string[] = [];
          for (const face of payload.faces) {
            const opened = await holder.adoptFace?.(face.fcid, face.fck);
            if (opened?.reading === "opens") adopted.push(face.fcid);
          }
          holder.seedSpent?.(payload.spent, payload.faces.map((face) => ({ fcid: face.fcid, spent: face.spent })));
          const landed = await keeperLand(a.records, by, { ...await standing(), worn: a.worn?.() ?? payload.worn, vest: { slot: pulamaRecordCid(slot), node: true, faces: adopted }, tessera: slot.body.tessera });
          if ("refusal" in landed) return red(landed.refusal, landed.detail);
          if (!landed.pair.par) return red(landed.pair.red ?? "keeper-red", `the keeper pair reads ${landed.pair.red ?? "red"}; the successor locks and the old fire still burns`);
          litBy = "vest";
          lived = true;
          server.refresh();
          log(`keeper landed by vest: v${landed.fold.v} par, ${adopted.length} face(s) carried`);
          return { op: "keeper-receive", reading: "landed", pair: landed.pair, vestings: landed.fold.vestings, ...status() };
        } finally { keeperPayloadDrop(payload); }
      }
      case "keeper-land": {
        if (passing) return passingRefusal("keeper-land");
        if (!holder.isUnlocked()) return { op: "keeper-land", reading: "pulama-locked", ...status() };
        // ONLY THE STRUCK FIRE LANDS STRUCK: a keeper the hand lit (`light`) lands the live successor with no vest; a keeper lit by a vest
        // landed already, and a replay never spends a successor's landing.
        if (litBy !== "hand") return { op: "keeper-land", reading: "keeper-not-struck", detail: "only a keeper the hand lit by passphrase lands struck; a vested keeper landed at its receive. Read the chain with `lares pulama status`" };
        const landed = await keeperLand(a.records, await pulamaSignerOf(holder), { ...await standing(), vest: null, ...(typeof f["tessera"] === "string" ? { tessera: f["tessera"] } : {}) });
        if ("refusal" in landed) return { op: "keeper-land", reading: landed.refusal, detail: landed.detail };
        log(`keeper landed by the hand's light: v${landed.fold.v} ${landed.pair.par ? "par" : landed.pair.red}`);
        return { op: "keeper-land", reading: landed.pair.par ? "landed" : "red", pair: landed.pair, ...(landed.pair.red ? { red: landed.pair.red } : {}) };
      }
      case "take-fire": {
        if (!a.fire) return { op: "take-fire", reading: "fire-unavailable" };
        if (a.fire.holds()) return { op: "take-fire", reading: "fire-held-here" };
        if (!holder.isUnlocked()) return { op: "take-fire", reading: "pulama-locked", ...status() };
        const taken = await a.fire.take();
        if ("refusal" in taken) return { op: "take-fire", reading: taken.refusal, detail: taken.detail };
        log("take-fire: this keeper holds the vessel socket now");
        return { op: "take-fire", reading: "taken", ...status() };
      }
      case "image": {
        if (typeof f["digest"] !== "string") return { op: "image", reading: "malformed" };
        if (f["seed"] !== undefined && typeof f["seed"] !== "string") return { op: "image", reading: "malformed" };
        if (f["closure"] !== undefined && (typeof f["closure"] !== "string" || !CLOSURE.test(f["closure"]))) return { op: "image", reading: "malformed" };
        try { a.image.report(f["digest"]); } catch { return { op: "image", reading: "malformed" }; }
        if (typeof f["closure"] === "string") closure = f["closure"];
        seed = typeof f["seed"] === "string" && f["seed"].trim() !== "" ? f["seed"].trim() : null;
        log(seed !== null ? "the host reported an image digest and the seed it offers" : "the host reported an image digest");
        return { op: "image", reading: "reported", image: a.image.raised(), ...(seed !== null ? { seed } : {}), ...(typeof f["closure"] === "string" ? { closure } : {}) };
      }
      case "tessera": {
        const halves: unknown[] = [];
        for (const title of await a.records.list(swarmTesseraPrefix())) { const text = await a.records.read(title); if (text !== null) { try { halves.push(JSON.parse(text)); } catch { /* a row that forms no record lists as nothing */ } } }
        // The admitted set reads only under the pūlama's key, so an unlit pūlama lists none.
        const admitted = a.admissions && holder.isUnlocked() ? await a.admissions.list(await pulamaSignerOf(holder)) : [];
        return { op: "tessera", halves, admitted };
      }
      default: return { op: String(f["op"] ?? ""), reading: "unknown-act" };
    }
  };
  // ONE ACT AT A TIME, as the custody door runs its own.
  return (frame) => { const run = chain.then(() => act(frame)); chain = run.catch(() => undefined); return run; };
}
