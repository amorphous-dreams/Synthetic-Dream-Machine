/**
 * found-hearth — THE STABLE FOUNDING ACT: one act under one human route yields a hearth whose bytes no later train
 * moves (lar:///ha.ka.ba/lares/docs/stable-founding-road#/rulings, the Stable founding act).
 *
 * In order, each step resumable where an earlier run stopped:
 *   1. the custody (the vessel key, the serving key, the custody root) and the PLACE (`runInit`);
 *   2. persona zero's root, its private pet-name and its seat claim for one chair;
 *   3. the SEED CHARTER: the chair's own seat key (`armGenesis`), its cold next key minted here on ONE card the
 *      person reads back before the charter moves, and the genesis epoch at threshold one over that one seat,
 *      committing the card's digest. The charter rests PRIVATE (its stranger posture) and floor-plain, signed by
 *      its genesis; its genesis names the hearth's Nexus AID;
 *   4. persona zero's FACE (`runFoundTheFace`), whose device edge, dyad scope and cabal sentinel all bind that AID;
 *   5. the Kahu-cabal ADMISSION: a counted 1-of-1 act at the one seat admits persona zero's group (the group that
 *      holds the hearth's Kahu realm, `kahuRealmGroup`), so `kahuCabalCanonAccess` holds for it from birth;
 *   6. the Kahu REALM: the live `lares` and `lararium` documents, each registered as a realm bag of the hearth's realm
 *      under persona zero's per-Nexus key (`landKahuRealm`), so the system documents rest in the realm from birth.
 *
 * ── A RESTORE AS PERSONA ZERO ───────────────────────────────────────────────────────────────────
 * With `restore` (a face's backup bundle, its body still sealed, and its bundle key), step 2 lands THAT face's root
 * at h0 through the one restore (its commit row, its checks, its provisional mark) in place of a fresh root; step 3
 * seats a fresh seed charter over it, with a fresh chair the restored face holds; step 4 lights it bound to that
 * charter's AID. A bundle carries no seat key, so the lost hearth's chair carries no authority here. A founding that
 * stopped part way resumes only its own root: a root that differs at h0 refuses, and nothing mints over it
 * (stable-founding-road#/rulings, a restore as persona zero).
 *
 * It yields no keyring: no seat act commits to a convergence secret (operator ruling). The herm's rite (a place
 * with no face, `runInit` alone) and the joiner's rite (`runInit` with an admit) stay as they stand.
 *
 * ── THE CARD READS BACK BEFORE THE CHARTER MOVES ────────────────────────────────────────────────
 * The act holds the card's seed in this process alone and hands it to `readBack`, which prints the card and asks
 * it back (a person's terminal, or the stand-in on a staged test root). A read-back that throws writes no charter
 * and retires the seat key the arming minted; the next run arms afresh. Every seed zero-fills before the act
 * returns, whichever way it leaves.
 *
 * ── THE CADENCE INCEPTION ───────────────────────────────────────────────────────────────────────
 * The founding cites no cadence inception: that record stands SPECIFIED (kahu#/contract, the cadence lineage). It
 * names the Nexus AID and the AID never names it, so its later inception moves no byte this act writes.
 */
import { ensureFaceCustodyAtHandle } from "../face-route.js";
import {
  charterInceptionBytes, charterInceptionImage, emptyFoundingCharterDoc, federationPostureFromDoc, genesisOfInception, mintColdKey, nexusAidOf, sealKeySetHash, seatedKahuKeys, standForKahuSeat,
  renameOwnPersona, type NexusDoc,
} from "@lararium/mesh";
import { aFaceBinds } from "../hearth-aid.js";
import { RestoreRefused, openRestoreBody, restoreFaceBody, restorePendingRoot, type FaceBundleRestored, type RestoreRefusal } from "../face-bundle-restore.js";
import { heldSeatKey } from "../seat-key-store.js";
import { nexusCharterStands, readNexusDoc, writeNexusDoc } from "../nexus-doc.js";
import {
  generateOrLoadPersonaGroupRoot, listPersonaRosterLines, makeNodePersonaDeclarationStore, makeNodePersonaPetnameStore,
} from "../node-vessel-identity.js";
import { armGenesis, retireSeats, signLicensedInception } from "../seal-ceremony.js";
import { larSealHome } from "../vessel-paths.js";
import { landFoundingAdmission } from "./nexus-cabal.js";
import { landKahuRealm } from "../kahu-realm.js";
import { runFoundTheFace, runInit, type InitOptions, type FoundFaceResult } from "./init.js";

/** One chair's cold next key, held in this process until its card reads back. */
export interface HearthCard {
  readonly chair:  string;
  readonly seed:   Uint8Array;
  readonly digest: string;
}

export interface FoundHearthOptions extends Omit<InitOptions, "admitPayload"> {
  /** Persona zero's private pet-name. Under `restore` it may stand empty: the bundle's own pet-name lands. */
  readonly name:     string;
  /**
   * A RESTORE AS PERSONA ZERO: a face's backup bundle, its body still sealed, and the bundle key a person's route
   * opened. The caller owns `bundleKey` and zero-fills it.
   */
  readonly restore?: { readonly sealedBody: Uint8Array; readonly bundleKey: Uint8Array };
  /** The private label of the one chair the seat claim stands for (default: the face's own chair label). */
  readonly chair?:   string;
  /**
   * Print each card and read it back before the charter moves; throw to refuse. `charterFingerprint` names the
   * genesis the cards commit, for the card's own lines. The act zero-fills every seed after this returns.
   */
  readonly readBack: (cards: readonly HearthCard[], charterFingerprint: string) => Promise<void>;
}

export interface FoundHearthResult {
  /** The seed charter's Nexus AID: the hearth's own first Nexus. */
  readonly nexusAid:       string;
  /** The one seat's key and the digest its card commits. */
  readonly seatKey:        string;
  readonly nextDigest:     string;
  /** Whether this run seated the charter (false where an earlier run's charter stood). */
  readonly charterSeated:  boolean;
  readonly face:           FoundFaceResult;
  /** Under `restore`: what the restore answered, or null where an earlier run of the same founding completed it. */
  readonly restored:       FaceBundleRestored | null;
}

/** The refusal of a Stable founding over a charter this act did not found. */
export class HearthFoundingRefused extends Error {
  override readonly name = "HearthFoundingRefused";
  /** Under `restore`, the restore's own refusal, by its name (custody#/the-restore). */
  readonly restoreRefusal: RestoreRefusal | null;
  constructor(detail: string, restoreRefusal: RestoreRefusal | null = null) {
    super(`[lares vessel found --hearth] ${restoreRefusal ? `${restoreRefusal}: ` : ""}${detail}`);
    this.restoreRefusal = restoreRefusal;
  }
}
/** Run one step of the restore road; a restore's refusal crosses as the founding's own, keeping its name. */
async function asFounding<T>(step: () => Promise<T> | T): Promise<T> {
  try { return await step(); }
  catch (err) { if (err instanceof RestoreRefused) throw new HearthFoundingRefused(err.message, err.reason); throw err; }
}

/**
 * THE SEED CHARTER, armed and written: persona zero's root and seat claim, the chair's seat key, one cold card read
 * back, and the genesis at threshold one. A seed charter already standing answers its own AID and writes nothing.
 * Custody must stand seated (the founding's own key, or a person's unlock).
 */
export async function foundSeedCharter(opts: {
  readonly name:     string;
  readonly chair?:   string;
  readonly readBack: FoundHearthOptions["readBack"];
}): Promise<{ readonly nexusAid: string; readonly seatKey: string; readonly nextDigest: string; readonly seated: boolean }> {
  const sealHome = larSealHome();
  const standing = readNexusDoc(sealHome);
  if (standing === null && nexusCharterStands(sealHome)) {
    throw new HearthFoundingRefused("a charter stands here and reads TORN; nothing was written. Move it aside, then found again.");
  }
  const standingAid = nexusAidOf(standing);
  if (standingAid !== null) {
    // A CHARTER STANDING HERE ANSWERS ONLY WHERE THIS ACT FOUNDED IT: a face already binds its AID (the act ran
    // whole, and the seed may since have rolled), or it stands as this act's own seed, one seat at threshold one
    // under a seat key this vessel holds, armed with its one cold next digest and resting PRIVATE (an earlier run
    // stopped before the face). Any other charter (an imported one, a quorum some rite seated, an unarmed genesis)
    // founds no hearth here.
    const genesis = standing!.sealLineage![0]!;
    const seated = seatedKahuKeys(standing);
    const ownSeed = standing!.sealLineage!.length === 1 && seated.length === 1 && standing!.threshold === 1
      && genesis.keySetHash === sealKeySetHash(seated, 1) && heldSeatKey(seated[0]!) !== null
      && genesis.nextKeyDigests.length === 1 && genesis.nextThreshold === 1
      && federationPostureFromDoc(standing) === "private";
    if (!ownSeed && !(await aFaceBinds(standingAid))) {
      throw new HearthFoundingRefused("a charter stands here that this act did not found as a seed: a hearth founds its own one-seat seed charter. Nothing was written; found the hearth on a fresh root.");
    }
    const head = standing!.sealLineage![standing!.sealLineage!.length - 1]!;
    return { nexusAid: standingAid, seatKey: seated[0] ?? "", nextDigest: head.nextKeyDigests[0] ?? "", seated: false };
  }

  // Persona zero's root, its private label, and its claim on the one chair: the roster line lands with the root.
  await ensureFaceCustodyAtHandle(0, "h0");
  await generateOrLoadPersonaGroupRoot(0);
  if (opts.name.length > 0) await renameOwnPersona(await makeNodePersonaPetnameStore(), 0, opts.name);
  const chair = opts.chair?.trim();
  await standForKahuSeat(await makeNodePersonaDeclarationStore(), 0, true, chair && chair.length > 0 ? chair : undefined);

  // The chair's own seat key, minted behind the custody door, at threshold one.
  const armed = await armGenesis({ threshold: 1 });
  if (armed.seatedKeys.length !== 1) {
    await retireSeats(armed.minted);
    throw new HearthFoundingRefused(`a seed charter seats ONE chair, and ${armed.seatedKeys.length} stood; nothing was written`);
  }
  const seatKey = armed.seatedKeys[0]!;
  const cold = await mintColdKey();
  const card: HearthCard = { chair: armed.kahu.find((k) => k.verifyingKey?.toLowerCase() === seatKey)?.chairLabel ?? "a chair", seed: cold.seed, digest: cold.digest };
  try {
    // The seed's inception: its one seat signs the image through the door, after the card reads back. The AID the
    // card names commits the image, so it names this founding and no other.
    const image = charterInceptionImage([seatKey], 1, { digests: [cold.digest], threshold: 1 });
    let genesis;
    try {
      await opts.readBack([card], genesisOfInception(image).epochCid.slice(-16));
      genesis = genesisOfInception(image, [await signLicensedInception(seatKey, charterInceptionBytes(image))]);
    } catch (err) {
      await retireSeats(armed.minted);
      throw err;
    }
    const doc: NexusDoc = {
      ...emptyFoundingCharterDoc(),
      threshold: 1,
      sealEpochCid: genesis.epochCid,
      sealLineage: [genesis],
      kahu: armed.kahu.map((k) => ({ ...k })),
      federationPosture: "private",
    };
    writeNexusDoc(sealHome, doc);
    await retireSeats(armed.superseded);
    return { nexusAid: genesis.epochCid, seatKey, nextDigest: cold.digest, seated: true };
  } finally {
    cold.seed.fill(0);
    card.seed.fill(0);
  }
}

/**
 * THE STABLE FOUNDING ACT. The place stands first (or stood from an earlier run), then the seed charter, then
 * persona zero's face, which binds the charter's AID. A run that stopped anywhere runs again and completes.
 */
export async function runFoundHearth(opts: FoundHearthOptions): Promise<FoundHearthResult> {
  const label = typeof opts.name === "string" ? opts.name.trim() : "";
  if (label.length === 0 && !opts.restore) {
    throw new HearthFoundingRefused("persona zero needs a private label (--name '<label>'); nothing was written");
  }
  const { name: _name, chair, readBack, restore, ...init } = opts;
  await runInit(init);
  const seed = () => foundSeedCharter({ name: label, ...(chair ? { chair } : {}), readBack });
  // The face lights, then the founding admits its group to the hearth's Kahu cabal (a counted 1-of-1 act at the
  // one seat; a group already admitted lands nothing), so persona zero's group holds the Kahu realm from birth.
  const light = async () => {
    const face = await runFoundTheFace({ repo: opts.repo, ...(opts.genesisDir ? { genesisDir: opts.genesisDir } : {}), handleIndex: 0 });
    await landFoundingAdmission({ repo: opts.repo, sealHome: larSealHome(), personaGroupId: face.personaGroupId });
    await landKahuRealm({ repo: opts.repo, sealHome: larSealHome() });
    return face;
  };
  const pending = await restorePendingRoot();

  if (!restore) {
    // A RESTORE THAT STANDS PENDING owns persona zero's index until it lands: a fresh root never mints over it.
    if (pending !== null) {
      throw new HearthFoundingRefused("a restore of a face stands pending on this vessel: run the same founding again with that face's bundle (--restore <file>), and it completes. Nothing was written.");
    }
    const charter = await seed();
    const face = await light();
    return { nexusAid: charter.nexusAid, seatKey: charter.seatKey, nextDigest: charter.nextDigest, charterSeated: charter.seated, face, restored: null };
  }

  const body = await asFounding(() => openRestoreBody(restore.sealedBody, restore.bundleKey));
  const held = (await listPersonaRosterLines()).find((l) => l.handleIndex === 0);
  if (pending === null && held?.verifyingKey === body.root.verifyingKey) {
    // AN EARLIER RUN OF THIS SAME FOUNDING LANDED THE FACE: its pending row left only once the face lit, so the
    // charter and the face stand, and each step answers what it already wrote.
    const charter = await seed();
    const face = await light();
    return { nexusAid: charter.nexusAid, seatKey: charter.seatKey, nextDigest: charter.nextDigest, charterSeated: charter.seated, face, restored: null };
  }
  let charter: Awaited<ReturnType<typeof seed>> | null = null;
  const restored = await asFounding(() => restoreFaceBody({
    body, as: 0, withRepo: (act) => act(opts.repo), ...(opts.genesisDir ? { genesisDir: opts.genesisDir } : {}),
    founding: async () => { charter = await seed(); },
  }));
  const face = await light();
  const seated = charter as Awaited<ReturnType<typeof seed>> | null;
  if (seated === null) throw new Error("found-hearth: the restore landed and seated no charter");
  return { nexusAid: seated.nexusAid, seatKey: seated.seatKey, nextDigest: seated.nextDigest, charterSeated: seated.seated, face, restored };
}
