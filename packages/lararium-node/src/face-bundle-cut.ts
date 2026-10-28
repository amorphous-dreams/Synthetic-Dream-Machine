/**
 * face-bundle-cut — THE CUT: a standing vessel builds one face's backup bundle body behind its custody door.
 *
 * ── WHO DOES WHAT ───────────────────────────────────────────────────────────────────────────────
 * The command draws the bundle key and binds its routes in its own process. This module runs on the vessel's
 * MAIN THREAD, against the holder a person unlocked: it reads the face's standing section off the sealed rows,
 * asks the daemon island for the memory section sealed to the pair the bundle key derives, and seals the whole
 * body under that key. Ciphertext leaves; no row's plaintext does.
 *
 * ── THE TABLE PICKS THE ROWS ────────────────────────────────────────────────────────────────────
 * The carrier table's `bundle` column names every row a bundle carries (`bundleRows`). The cut walks that column
 * and runs one extractor per row; a row the column names with no extractor here refuses the cut, and
 * `BUNDLE_EXTRACTOR_ROWS` lets a test hold the two sets equal. No hand picks a row.
 *
 * ── WHAT A CUT REFUSES ──────────────────────────────────────────────────────────────────────────
 * The cut reads its vessel's own edge shadow ONCE, at its entry, and refuses under it before any row opens
 * (`own-edge-shadowed`). The island's holder takes that one reading inside the ask the vessel signs and reads none
 * of its own. The cut then refuses, by name: a face this vessel holds no root for (`face-not-held`); a face the
 * standing vessel does not wear, since its island counts keys for the mounted face alone (`face-not-worn`); a board
 * that holds no whole key history for the face (`key-history-unread`); a face whose address secret stands nowhere
 * here (`no-address-secret`), since its restore could derive none of its working addresses; and an island with no
 * content-key holder (`memory-unavailable`). A cut that refuses seals nothing and answers nothing but the name.
 *
 * Node-main only: a worker never imports this module.
 * Canon: lar:///ha.ka.ba/lararium/mesh/custody#/the-cut
 */
import {
  bundleMemoryKeypair, faceBundleBodyBytes, sealFaceBundleBody, verifyPersonaKelFull,
  type FaceBundleBody, type FaceBundleGuardianSet, type FaceBundleHolding, type PersonaKelEvent,
} from "@lararium/mesh";
import { listFaceProofKeys } from "./face-key-custody.js";
import { readFaceAddressSecret } from "./fleet-join-custody.js";
import { readGuardianSet } from "./guardian-enrolment.js";
import { loadIdentityAnchors } from "./identity-anchors.js";
import { IslandVerbRefused } from "./island-verb-ask.js";
import { loadNodeHandleBook } from "./node-circle-store.js";
import {
  listPersonaRosterLines, loadPersonaGroupRootSeed, makeNodePersonaDeclarationStore, makeNodePersonaPetnameStore,
  type PersonaRosterLine,
} from "./node-vessel-identity.js";
import { bundleRows } from "./vault-carriers.js";

/** The names a cut refuses under (custody#/the-cut). */
export const CUT_REFUSALS = ["face-not-held", "face-not-worn", "own-edge-shadowed", "key-history-unread", "memory-unavailable", "no-address-secret"] as const;
export type CutRefusal = (typeof CUT_REFUSALS)[number];

/** A cut that refuses: nothing sealed, nothing answered but the name. */
export class BackupRefused extends Error {
  override readonly name = "BackupRefused";
  constructor(readonly reason: CutRefusal, message: string) { super(message); }
}

/** What the standing composition lends a bundle's cut, and the import of a bundle's memory section. */
export interface BackupDoor {
  /** The face this composition wears, by handle-index: the one its island counts keys for. Null where no face stands lit. */
  readonly wornFace: () => number | null;
  /** This vessel's own reading of its edge on the mounted face's fleet: true under its own shadow. */
  readonly ownEdgeShadowed: () => Promise<boolean>;
  /**
   * Ask the daemon island for the memory section, sealed to `to`, as part of a cut that already read this
   * vessel's shadow at its entry. Null where no daemon island stands. A refusal of the island's rides out as
   * `IslandVerbRefused`, its name in `reason`.
   */
  readonly cutMemory: ((to: Uint8Array) => Promise<{ readonly section: string; readonly holds: readonly FaceBundleHolding[] }>) | null;
  /** The face's key event log as this vessel's board holds it, inception first; empty where the board holds none. */
  readonly kel: (prefix: string) => Promise<readonly PersonaKelEvent[]>;
  /**
   * Ask the daemon island to name a door for ONE import: a fresh public key the section pair's secret half seals
   * to. Null where no daemon island stands.
   */
  readonly memoryDoor: (() => Promise<Uint8Array>) | null;
  /**
   * Hand the island a bundle's memory section (base64) and its pair's secret half sealed to the door the island
   * named (base64); answers one outcome per entry. Null where no daemon island stands. A refusal of the island's
   * rides out as `IslandVerbRefused`, its name in `reason`.
   */
  readonly importMemory: ((section: string, sealedSecret: string) => Promise<ReadonlyArray<{ readonly bagId: string; readonly keyVersion: string; readonly outcome: string; readonly cause?: string }>>) | null;
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type Parts = Partial<Mutable<Omit<FaceBundleBody, "names" | "guardianSet">>> & {
  names: { petname?: string; handle?: string };
  /** The face's guardian-set record as this vessel holds it, with the prefix it names; the key history decides whether it rides. */
  guardianRecord?: FaceBundleGuardianSet & { readonly prefix: string };
};
type Extractor = (line: PersonaRosterLine, parts: Parts) => Promise<void>;

const hexOf = (bytes: Uint8Array): string => Buffer.from(bytes).toString("hex");

/** One extractor per row the table's `bundle` column names: what of that row one face's bundle carries. */
const EXTRACTORS: Readonly<Record<string, Extractor>> = {
  // whole: the face's root, the seed its lineage signs with.
  "persona-root": async (line, parts) => {
    const seed = await loadPersonaGroupRootSeed(line.handleIndex);
    try { parts.root = { signingKey: hexOf(seed), verifyingKey: line.verifyingKey }; } finally { seed.fill(0); }
  },
  // whole: each proof key this vessel holds for the face, under its scope's own name.
  "face-proof-key": async (line, parts) => {
    const keys = await listFaceProofKeys(line.handleIndex);
    try { parts.faceProofKeys = keys.map((k) => ({ scope: k.scope, secret: hexOf(k.secret) })); }
    finally { for (const k of keys) k.secret.fill(0); }
  },
  // lines: the fixed prefix and the signer's name. The veil tag, the device edge and the key group's ids name
  // one vessel's seat, and stay.
  "anchors": async (line, parts) => {
    const anchors = await loadIdentityAnchors(line.handleIndex);
    if (!anchors?.signerDid || !anchors.personaKelPrefix) {
      throw new BackupRefused("face-not-worn", `the face at h${line.handleIndex} holds no anchors on this vessel: it never stood lit here, so nothing wears it`);
    }
    parts.anchors = { signerDid: anchors.signerDid, personaKelPrefix: anchors.personaKelPrefix };
  },
  // lines: the one line that names this face's root.
  "persona-roster": async (line, parts) => { parts.rosterLine = { handleIndex: line.handleIndex, verifyingKey: line.verifyingKey }; },
  // lines: this face's own pet-name.
  "persona-petnames": async (line, parts) => {
    const petname = await (await makeNodePersonaPetnameStore()).get(line.handleIndex);
    if (typeof petname === "string" && petname.length > 0) parts.names.petname = petname;
  },
  // lines: this face's declared Handle. The seat claim and the chair label name a seat on one node, and stay.
  "persona-declarations": async (line, parts) => {
    const handle = (await (await makeNodePersonaDeclarationStore()).get(line.handleIndex))?.handle;
    if (typeof handle === "string" && handle.length > 0) parts.names.handle = handle;
  },
  // whole: the records this face recognised, each under this face's own label; the book rests in the face's own row.
  "handle-book": async (line, parts) => {
    const mine = (await loadNodeHandleBook(line.handleIndex)).snapshot();
    parts.handleBook = { records: JSON.parse(JSON.stringify(mine.records)) as Record<string, unknown>[] };
  },
  // whole: the face's address secret, so the face restored elsewhere derives the working addresses it derives here.
  "face-address-secret": async (line, parts) => {
    const group = (await loadIdentityAnchors(line.handleIndex))?.personaGroupId;
    const secret = group ? await readFaceAddressSecret(group) : null;
    if (!secret) {
      throw new BackupRefused("no-address-secret", `the face at h${line.handleIndex} holds no address secret on this vessel, so a restore could derive none of its working addresses; nothing was cut`);
    }
    try { parts.addressSecret = hexOf(secret); } finally { secret.fill(0); }
  },
  // whole: the guardian set this face's typed first enrolment committed. It rides only where the face's key history,
  // as this vessel's board holds it, commits that very set (read after the history below); a record the head does
  // not show stands pending on this vessel and stays.
  "guardian-set": async (line, parts) => {
    const record = await readGuardianSet(line.handleIndex);
    if (record) parts.guardianRecord = record;
  },
};

/** The rows this module extracts, for the test that holds them equal to the table's column. */
export const BUNDLE_EXTRACTOR_ROWS: readonly string[] = Object.freeze(Object.keys(EXTRACTORS));

/** What a cut answers: the sealed body, what its memory section holds, and the face it carries. Nothing secret. */
export interface FaceBundleCut {
  readonly sealedBody: Uint8Array;
  readonly holds:      readonly FaceBundleHolding[];
  readonly face:       { readonly handleIndex: number; readonly verifyingKey: string };
  /** How many of each standing part the body carries, for the command's own words. */
  readonly carries:    { readonly keyEvents: number; readonly faceProofKeys: number; readonly handleBookRecords: number; readonly petname: boolean; readonly handle: boolean; readonly guardians: number };
}

/**
 * Cut face `face`'s bundle body and seal it under `bundleKey`. The caller owns the key and zero-fills it.
 * Refuses `BackupRefused` by name; a custody refusal (`CustodyLocked`, `CustodyRowUnavailable`) passes through.
 */
export async function cutFaceBundle(args: { readonly face: number; readonly bundleKey: Uint8Array; readonly door: BackupDoor | null }): Promise<FaceBundleCut> {
  const { face, door } = args;
  // THE SHADOW, READ ONCE, AT THE ENTRY, and judged before any row opens: a vessel under its own shadow performs
  // no key act, whatever face the cut names. A raise this vessel counts while the cut runs binds its next act.
  const shadowed = door !== null && door.wornFace() !== null ? await door.ownEdgeShadowed() : false;
  if (shadowed) throw new BackupRefused("own-edge-shadowed", "this vessel reads a shadow over its own edge: a cut hands keys beyond the holder, and a vessel under its own shadow performs no key act");

  const line = (await listPersonaRosterLines()).find((l) => l.handleIndex === face);
  if (!line) throw new BackupRefused("face-not-held", `this vessel holds no root at h${face}: a bundle carries a face's root, and only a vessel that holds it cuts one`);
  const worn = door?.wornFace() ?? null;
  if (door === null || worn !== face) {
    throw new BackupRefused("face-not-worn", worn === null
      ? `this vessel's composition mounts no face, so no island counts keys for h${face}: mount it (\`lares vault unlock --face ${face}\`) on a standing vessel, and cut`
      : `this vessel's composition mounts h${worn}, so its island counts no key for h${face}: mount it (\`lares vault unlock --face ${face}\`) on a standing vessel, and cut`);
  }
  if (door.cutMemory === null) throw new BackupRefused("memory-unavailable", "no daemon island stands in this vessel, so no content-key holder answers the memory section");

  const parts: Parts = { names: {} };
  for (const { row } of bundleRows()) {
    const extract = EXTRACTORS[row];
    if (!extract) throw new Error(`face-bundle-cut: the carrier table's bundle column names "${row}" and no extractor reads it; nothing was cut`);
    await extract(line, parts);
  }

  // THE KEY HISTORY rides as this vessel's board holds it, and only where it verifies whole from its inception.
  const kel = [...await door.kel(parts.anchors!.personaKelPrefix)];
  const verified = kel.length > 0 && kel[0]!.prefix === parts.anchors!.personaKelPrefix ? await verifyPersonaKelFull(kel) : { ok: false, reason: "the board holds no event under the face's prefix" };
  if (!verified.ok) {
    throw new BackupRefused("key-history-unread", `this vessel's board holds no whole key history for the face at h${face} (${verified.reason ?? "it does not verify"}): a restore checks the root against that history, so nothing was cut`);
  }

  // THE MEMORY SECTION seals inside the island, to the pair this bundle's key alone derives.
  const pair = bundleMemoryKeypair(args.bundleKey);
  let memory: { section: string; holds: readonly FaceBundleHolding[] };
  try {
    memory = await door.cutMemory(pair.public);
  } catch (err) {
    if (err instanceof IslandVerbRefused) {
      if (err.reason === "own-edge-shadowed") throw new BackupRefused("own-edge-shadowed", "this vessel's content-key holder reads a shadow over its own edge: nothing was cut");
      throw new BackupRefused("memory-unavailable", `this vessel's island answered no memory section (${err.reason ?? err.message}): nothing was cut`);
    }
    throw err;
  } finally { pair.secret.fill(0); }

  // THE GUARDIAN SET rides where the history's head commits it, under this face's own prefix.
  const head = kel[kel.length - 1]!;
  const record = parts.guardianRecord;
  const guardianSet: FaceBundleGuardianSet | null = record && record.prefix === parts.anchors!.personaKelPrefix && head.nextRecoverySetHash === record.guardianSetHash
    ? { guardianSetHash: record.guardianSetHash, threshold: record.threshold, guardians: record.guardians.map((g) => ({ slot: g.slot, label: g.label, recoveryPubKey: g.recoveryPubKey, confirmPhrase: g.confirmPhrase })) }
    : null;

  const body: FaceBundleBody = {
    root: parts.root!, rosterLine: parts.rosterLine!, anchors: parts.anchors!, kel,
    names: parts.names, faceProofKeys: parts.faceProofKeys ?? [], handleBook: parts.handleBook ?? { records: [] }, guardianSet,
    addressSecret: parts.addressSecret!,
    memory: { section: memory.section, holds: memory.holds.map((h) => ({ bagId: h.bagId, founding: h.founding, keyVersion: h.keyVersion })) },
  };
  const bytes = faceBundleBodyBytes(body);
  try {
    return {
      sealedBody: sealFaceBundleBody(bytes, args.bundleKey),
      holds: body.memory.holds,
      face: { handleIndex: line.handleIndex, verifyingKey: line.verifyingKey },
      carries: {
        keyEvents: kel.length, faceProofKeys: body.faceProofKeys.length, handleBookRecords: body.handleBook.records.length,
        petname: body.names.petname !== undefined, handle: body.names.handle !== undefined,
        guardians: body.guardianSet?.guardians.length ?? 0,
      },
    };
  } finally { bytes.fill(0); }
}
