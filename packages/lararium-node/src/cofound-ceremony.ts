/**
 * cofound-ceremony — what each founder's vessel does behind the custody door for the two-founder Nexus founding act,
 * over the pure images of `cofound` (kahu#/seed-and-nexus).
 *
 * Two founders, each from their own vault, seat one key each in a FRESH joint genesis at two of two, and each hearth
 * holds one cadence key in the cadence inception the genesis cites. Neither household seed moves: the joint charter
 * files under its own AID (`carried-set`), beside each seed. The act crosses between the vaults as files alone, and
 * no clock decides any step.
 *
 * ── THE FOUR STEPS ──────────────────────────────────────────────────────────────────────────────
 *   · OPEN (A): the seat key mints behind this door under the face whose seat stands, the hearth's cadence key mints
 *     beside it, and the offer composes around the cold successor's digest the command printed on a card and read
 *     back. The offer's row records it (`cofound-record`).
 *   · JOIN (B): B's person types A's seat fingerprint as heard BEFORE any key mints; B's seat and cadence keys mint;
 *     the image composes and the row records it as judged; then the inception door half-signs it, and the cadence
 *     key signs the cadence inception it cites.
 *   · SEAL (A): A's person types B's seat fingerprint as heard; the join judges against the offer A's row recorded;
 *     the row records the judged image; then A's seat and A's hearth sign, and the joint charter files.
 *   · ACCEPT (B): the inception A carried back judges against the image B's row recorded, and the joint charter files.
 *
 * ── THE ANTIGEN ─────────────────────────────────────────────────────────────────────────────────
 * A successor commitment this vault used in any charter it holds, or in any founding it recorded, refuses at open
 * and at join: two foundings never share a successor, and the AID names one founding statement.
 *
 * A step that refuses before its row records leaves no key behind: a seat or cadence key it minted retires.
 *
 * Callers: the custody door's rows `cofound.open`, `cofound.join`, `cofound.seal`, `cofound.accept` (`sealed-acts`),
 * which `lares nexus seal cofound open|join|seal` drives.
 *
 * Node-main only: a worker never imports this module.
 */
import {
  CofoundRefusal, canonicalJson, cofoundCharterDoc, cofoundJoin, cofoundOffer, composeCharterInception, heardSeatFingerprint, judgeCharterInception,
  judgeCofoundJoin, offerFingerprint, readCofoundInception, readCofoundJoin, readCofoundOffer, sealCofound,
  type CofoundInception, type CofoundJoin, type CofoundOffer, type ReleaseManifestAddresses, type SealRollSigner,
} from "@lararium/mesh";
import { importCarriedCharter, type CarriedImportResult } from "./carried-set.js";
import { mintCadenceKey, retireCadenceKey, signAsCadence } from "./cadence-key-store.js";
import { cofoundRecordFingerprints, dropCofoundRecord, readCofoundRecord, sameInceptionImage, updateCofoundRecord, type CofoundRecord } from "./cofound-record.js";
import { openedCustody } from "./custody-seat.js";
import { renderNexusDoc } from "./nexus-doc.js";
import { listPersonaRosterLines } from "./node-vessel-identity.js";
import { SealCeremonyRefusal, signLicensedInception, successorsHeldHere } from "./seal-ceremony.js";
import { mintSeatKey, retireSeatKey } from "./seat-key-store.js";
import { larSealHome } from "./vessel-paths.js";

const refuse = (code: string, message: string): SealCeremonyRefusal => new SealCeremonyRefusal(code, message);

/** A pure refusal keeps its code and words; anything else passes through. */
function pure<T>(run: () => T): T {
  try { return run(); }
  catch (err) { if (err instanceof CofoundRefusal) throw refuse(err.code, err.message); throw err; }
}
async function pureAsync<T>(run: () => Promise<T>): Promise<T> {
  try { return await run(); }
  catch (err) { if (err instanceof CofoundRefusal) throw refuse(err.code, err.message); throw err; }
}

/** Refuse a face this vessel holds no persona root for: a seat stands for a face this vessel holds. */
async function heldFace(face: number): Promise<void> {
  if (!(await listPersonaRosterLines()).some((l) => l.handleIndex === face)) {
    throw refuse("no-root", `this vessel holds no persona root at h${face}, so no seat stands for it`);
  }
}

/** Every successor commitment this vault has used: each charter it holds, and each founding it recorded. */
async function committedHere(): Promise<Set<string>> {
  const used = successorsHeldHere();
  for (const fp of cofoundRecordFingerprints()) {
    const record = await readCofoundRecord(fp);
    if (!record) continue;
    used.add(record.offer.next);
    for (const d of record.image?.nextKeyDigests ?? []) used.add(d);
  }
  return used;
}

async function refuseReusedSuccessor(...next: readonly string[]): Promise<void> {
  const used = await committedHere();
  if (next.some((d) => used.has(d))) {
    throw refuse("successor-reused", "that successor commitment already stands in a charter or a founding this vault holds; each founding mints fresh cold keys");
  }
}

/** The inception door's hand for one seat, and the cadence key's hand: each signs behind this door. */
const seatHand = (seat: string): SealRollSigner => ({ signer: seat, sign: async (bytes) => (await signLicensedInception(seat, bytes)).sig });
const cadenceHand = (key: string): SealRollSigner => ({ signer: key, sign: (bytes) => signAsCadence(key, bytes) });

/** Retire keys a refused step minted; a retirement that faults leaves the step's own refusal standing. */
async function retireMinted(seat: string | null, cadence: string | null): Promise<void> {
  try { if (seat) await retireSeatKey(seat); } catch { /* the step's refusal speaks */ }
  try { if (cadence) await retireCadenceKey(cadence); } catch { /* the step's refusal speaks */ }
}

/** File the joint charter a verified inception founds, under its own AID, beside the seed. */
function fileJointCharter(inception: CofoundInception): CarriedImportResult {
  return importCarriedCharter(larSealHome(), renderNexusDoc(cofoundCharterDoc(inception)));
}

// ── open (A) ──────────────────────────────────────────────────────────────────────────────────

/**
 * OPEN: mint the seat and the hearth's cadence key, compose the offer around the successor digest `next` (the cold
 * card the command printed and read back), and record it. Answers the offer and its fingerprint.
 */
export async function openCofound(input: { readonly face: number; readonly next: string; readonly charterLaw: string;
  readonly manifest: ReleaseManifestAddresses }): Promise<{ readonly offer: CofoundOffer; readonly fingerprint: string }> {
  await openedCustody();
  await heldFace(input.face);
  await refuseReusedSuccessor(input.next);
  let seat: string | null = null, cadence: string | null = null;
  try {
    seat = await mintSeatKey(input.face);
    const hearth = await mintCadenceKey(input.face);
    cadence = hearth.key;
    const offer = pure(() => cofoundOffer({ seat: seat!, next: input.next, cadence: hearth, charterLaw: input.charterLaw, manifest: input.manifest }));
    const fingerprint = offerFingerprint(offer);
    const record: CofoundRecord = { role: "offer", face: input.face, seat: seat!, cadence: hearth.key, offer, image: null };
    await updateCofoundRecord(input.face, fingerprint, (standing) => {
      if (standing !== null) throw refuse("cofound-recorded", "an offer with that fingerprint already stands recorded here");
      return { next: record, value: undefined };
    });
    return { offer, fingerprint };
  } catch (err) {
    await retireMinted(seat, cadence);
    throw err;
  }
}

// ── join (B) ──────────────────────────────────────────────────────────────────────────────────

/**
 * JOIN: read the offer, check A's seat fingerprint as heard before any key mints, mint B's seat and cadence keys,
 * record the image B composes as judged, then half-sign it and sign the cadence inception it cites. Answers the join.
 */
export async function joinCofound(input: { readonly face: number; readonly offer: unknown; readonly heardOfferSeat: string;
  readonly next: string }): Promise<{ readonly join: CofoundJoin; readonly offerFingerprint: string }> {
  await openedCustody();
  const offer = readCofoundOffer(input.offer);
  if (!offer) throw refuse("cofound-offer-malformed", "the offer file does not read at its exact shape");
  if (!heardSeatFingerprint(input.heardOfferSeat, offer.seat)) {
    throw refuse("cofound-fingerprint-unheard", "the fingerprint typed as heard names another seat than the offer's; nothing minted");
  }
  await heldFace(input.face);
  const fp = offerFingerprint(offer);
  if (await readCofoundRecord(fp)) throw refuse("cofound-recorded", "this vessel already recorded that offer: one founding, one answer");
  // Both successors the image will commit, before any key mints: the offer's and this vessel's own.
  await refuseReusedSuccessor(offer.next, input.next);
  let seat: string | null = null, cadence: string | null = null;
  let recorded = false;
  try {
    seat = await mintSeatKey(input.face);
    const hearth = await mintCadenceKey(input.face);
    cadence = hearth.key;
    const joiner = { seat: seat!, next: input.next, cadence: hearth };
    const image = pure(() => composeCharterInception(offer, joiner));
    const record: CofoundRecord = { role: "join", face: input.face, seat: seat!, cadence: hearth.key, offer, image };
    await updateCofoundRecord(input.face, fp, (standing) => {
      if (standing !== null) throw refuse("cofound-recorded", "this vessel already recorded that offer: one founding, one answer");
      return { next: record, value: undefined };
    });
    recorded = true;
    const join = await pureAsync(() => cofoundJoin(offer, joiner, input.heardOfferSeat, seatHand(seat!), cadenceHand(hearth.key)));
    return { join, offerFingerprint: fp };
  } catch (err) {
    // A join that refused takes back everything it left: its row (while the row still names its seat) and its keys.
    if (recorded) { try { await dropCofoundRecord(fp, seat!); } catch { /* the step's refusal speaks */ } }
    await retireMinted(seat, cadence);
    throw err;
  }
}

// ── seal (A) ──────────────────────────────────────────────────────────────────────────────────

/**
 * SEAL: judge B's join against the offer this vessel recorded and B's seat fingerprint as heard, record the judged
 * image, then sign it as A's seat and the cadence inception as A's hearth, and file the joint charter. Answers the
 * inception file and where the charter landed.
 */
export async function sealCofoundAct(input: { readonly join: unknown; readonly heardJoinSeat: string }):
  Promise<{ readonly inception: CofoundInception; readonly charter: CarriedImportResult }> {
  await openedCustody();
  const read = readCofoundJoin(input.join);
  if (!read) throw refuse("cofound-join-malformed", "the join file does not read at its exact shape, or its signatures fail their images");
  const fp = offerFingerprint(read.join.offer);
  const record = await readCofoundRecord(fp);
  if (!record || record.role !== "offer") throw refuse("cofound-offer-unrecorded", "this vessel made no offer that join answers, so no seat signs for it");
  const judged = judgeCofoundJoin(input.join, { offer: record.offer, heardJoinSeat: input.heardJoinSeat });
  if (!judged.ok) throw refuse(judged.code, judged.why);
  await updateCofoundRecord(record.face, fp, (standing) => {
    if (!standing || standing.role !== "offer") throw refuse("cofound-offer-unrecorded", "the offer's row left under this step");
    if (standing.image !== null && !sameInceptionImage(standing.image, judged.image)) {
      throw refuse("cofound-judged-another", "this offer already sealed another join's image; one offer founds one Nexus");
    }
    return { next: standing.image === null ? { ...standing, image: judged.image } : null, value: undefined };
  });
  const inception = await pureAsync(() => sealCofound(input.join, { offer: record.offer, heardJoinSeat: input.heardJoinSeat },
    seatHand(record.seat), cadenceHand(record.cadence)));
  const verdict = judgeCharterInception(inception, judged.image);
  if (!verdict.ok) throw refuse(verdict.code, "the sealed inception does not read whole; nothing filed");
  return { inception, charter: fileJointCharter(verdict.inception) };
}

// ── accept (B) ────────────────────────────────────────────────────────────────────────────────

/** ACCEPT: judge the inception A carried back against the image this vessel recorded when it joined, and file the joint charter. */
export async function acceptCofound(input: { readonly inception: unknown }): Promise<{ readonly charter: CarriedImportResult }> {
  await openedCustody();
  const inception = readCofoundInception(input.inception);
  if (!inception) throw refuse("inception-malformed", "the inception file does not read at its exact shape");
  const record = await readCofoundRecord(offerFingerprint(inception.offer));
  if (!record || record.role !== "join" || record.image === null) {
    throw refuse("cofound-offer-unrecorded", "this vessel never joined the offer that inception answers");
  }
  const verdict = judgeCharterInception(input.inception, record.image);
  if (!verdict.ok) throw refuse(verdict.code, "the inception does not seat exactly the image this vessel joined, signed by every seat and hearth");
  if (canonicalJson(verdict.inception.offer) !== canonicalJson(record.offer)) throw refuse("cofound-offer-mismatch", "the inception names another offer than the one this vessel joined");
  return { charter: fileJointCharter(verdict.inception) };
}
